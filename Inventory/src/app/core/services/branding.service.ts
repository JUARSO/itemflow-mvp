import { EnvironmentInjector, Injectable, effect, inject, runInInjectionContext, signal } from '@angular/core';
import { Firestore, doc, getDoc, setDoc } from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import { StorageService } from './storage.service';

/**
 * Branding por-tenant: nombre visible y "logo".
 *
 * Logo tiene dos modos:
 *  - `logoImage`: data URL (PNG redimensionado) — toma precedencia si está presente.
 *  - `logo`: emoji o texto corto (1-3 chars) usado como fallback.
 *
 * Persistencia: documento `tenants/{tenantId}/settings/app` en Firestore (fuente
 * de verdad por empresa; solo el admin escribe, todos los miembros lo leen) +
 * caché en localStorage para aplicar al instante y evitar parpadeo al cargar.
 */
export interface Branding {
  displayName: string;
  logo: string;
  logoImage?: string;
}

const STORAGE_KEY = 'atlas_branding_v1';

/** Marca por defecto = la plataforma (Atlas). Cada tenant la personaliza. */
const DEFAULTS: Branding = {
  displayName: 'Atlas',
  logo: 'A',
  logoImage: 'assets/branding/atlas-logo.svg',
};

/** Tamaño máximo (lado mayor) al que se redimensiona la imagen subida. */
const MAX_IMAGE_DIMENSION = 192;
/** Máximo de bytes permitidos para el archivo crudo. */
const MAX_RAW_BYTES = 2 * 1024 * 1024; // 2 MB

@Injectable({ providedIn: 'root' })
export class BrandingService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);
  private readonly storage = inject(StorageService);
  private readonly injector = inject(EnvironmentInjector);

  /** Ejecuta una llamada a Firebase dentro del contexto de inyección (AngularFire lo exige). */
  private inCtx<T>(fn: () => T): T { return runInInjectionContext(this.injector, fn); }

  private readonly _branding = signal<Branding>(this.readInitial());
  readonly branding = this._branding.asReadonly();

  constructor() {
    if (typeof document !== 'undefined') {
      document.title = this._branding().displayName;
    }
    // Carga el branding real del tenant desde Firestore cuando hay sesión.
    effect(() => {
      if (this.auth.authReady() && this.auth.isAuthenticated()) {
        void this.loadFromFirestore(this.auth.tenantId());
      }
    });
  }

  /** Aplica un cambio localmente (signal + caché + título). No toca Firestore. */
  update(input: Partial<Branding>) {
    const current = this._branding();
    const next: Branding = {
      displayName: (input.displayName ?? current.displayName).trim() || DEFAULTS.displayName,
      logo: (input.logo ?? current.logo).trim() || DEFAULTS.logo,
      // logoImage: si viene undefined NO se toca; si viene '' se elimina; si viene string se setea
      logoImage: input.logoImage === '' ? undefined : (input.logoImage ?? current.logoImage),
    };
    this._branding.set(next);
    this.persistLocal(next);
    if (typeof document !== 'undefined') {
      document.title = next.displayName;
    }
  }

  /** Aplica el cambio y lo guarda en Firestore (solo admin). Lanza si falla. */
  async save(input: Partial<Branding>): Promise<void> {
    this.update(input);
    await this.persistRemote(this._branding());
  }

  /** Sube y procesa un archivo de imagen, lo guarda como data URL PNG y persiste. */
  async uploadLogoImage(file: File): Promise<void> {
    if (!file.type.startsWith('image/')) {
      throw new Error('El archivo debe ser una imagen.');
    }
    if (file.size > MAX_RAW_BYTES) {
      throw new Error('La imagen es demasiado grande (máx 2MB).');
    }
    const dataUrl = await this.resizeAndEncode(file);
    // Subir a Storage y guardar la URL (antes se guardaba el data URL en Firestore).
    const url = await this.storage.uploadDataUrl('branding/logo.png', dataUrl);
    await this.save({ logoImage: url });
  }

  /** Elimina la imagen y vuelve al logo textual. */
  async clearLogoImage(): Promise<void> {
    await this.storage.deletePath('branding/logo.png');
    await this.save({ logoImage: '' });
  }

  async reset(): Promise<void> {
    this._branding.set({ ...DEFAULTS });
    if (typeof window !== 'undefined') localStorage.removeItem(STORAGE_KEY);
    if (typeof document !== 'undefined') document.title = DEFAULTS.displayName;
    await this.persistRemote({ ...DEFAULTS });
  }

  private settingsRef(tenantId: string) {
    return doc(this.firestore, `tenants/${tenantId}/settings/app`);
  }

  /** Lee el branding del tenant desde Firestore y lo aplica (si existe). */
  private async loadFromFirestore(tenantId: string): Promise<void> {
    try {
      const snap = await this.inCtx(() => getDoc(this.settingsRef(tenantId)));
      const b = snap.exists() ? (snap.data()['branding'] as Partial<Branding> | undefined) : undefined;
      if (!b) return;
      const next: Branding = {
        displayName: b.displayName?.trim() || DEFAULTS.displayName,
        logo: b.logo?.trim() || DEFAULTS.logo,
        logoImage: b.logoImage || undefined,
      };
      this._branding.set(next);
      this.persistLocal(next);
      if (typeof document !== 'undefined') document.title = next.displayName;
    } catch (e) {
      console.error('No se pudo cargar el branding del tenant:', e);
    }
  }

  /** Escribe el branding en Firestore (merge). Requiere admin por reglas. */
  private async persistRemote(b: Branding): Promise<void> {
    if (!this.auth.isAuthenticated()) return;
    try {
      await this.inCtx(() => setDoc(this.settingsRef(this.auth.tenantId()), { branding: b }, { merge: true }));
    } catch (e) {
      console.error('No se pudo guardar el branding en Firestore:', e);
      throw new Error('No se pudo guardar la marca. Verifica tu conexión o permisos.');
    }
  }

  private persistLocal(b: Branding) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(b));
    } catch {
      // localStorage lleno (probablemente por la imagen). Firestore sigue siendo la verdad.
    }
  }

  private readInitial(): Branding {
    if (typeof window === 'undefined') return { ...DEFAULTS };
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    try {
      const parsed = JSON.parse(raw) as Partial<Branding>;
      return {
        displayName: parsed.displayName?.trim() || DEFAULTS.displayName,
        logo: parsed.logo?.trim() || DEFAULTS.logo,
        logoImage: parsed.logoImage || undefined,
      };
    } catch {
      return { ...DEFAULTS };
    }
  }

  /**
   * Lee el archivo, lo dibuja en un canvas redimensionado y devuelve un data URL PNG.
   * Mantiene aspecto, limita el lado mayor a MAX_IMAGE_DIMENSION.
   */
  private resizeAndEncode(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error ?? new Error('Error leyendo archivo.'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('La imagen está corrupta o no es válida.'));
        img.onload = () => {
          const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(img.width, img.height));
          const w = Math.round(img.width * scale);
          const h = Math.round(img.height * scale);
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error('No se pudo procesar la imagen.'));
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/png'));
        };
        img.src = String(reader.result ?? '');
      };
      reader.readAsDataURL(file);
    });
  }
}
