import { Injectable, signal } from '@angular/core';

/**
 * Branding editable por el usuario: nombre visible y "logo".
 *
 * Logo tiene dos modos:
 *  - `logoImage`: data URL (PNG redimensionado) — toma precedencia si está presente.
 *  - `logo`: emoji o texto corto (1-3 chars) usado como fallback.
 *
 * Todo se persiste en localStorage. El nombre legal/ID del tenant sigue siendo
 * administrado por TenantContextService.
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
  private readonly _branding = signal<Branding>(this.readInitial());
  readonly branding = this._branding.asReadonly();

  constructor() {
    if (typeof document !== 'undefined') {
      document.title = this._branding().displayName;
    }
  }

  update(input: Partial<Branding>) {
    const current = this._branding();
    const next: Branding = {
      displayName: (input.displayName ?? current.displayName).trim() || DEFAULTS.displayName,
      logo: (input.logo ?? current.logo).trim() || DEFAULTS.logo,
      // logoImage: si viene undefined NO se toca; si viene '' se elimina; si viene string se setea
      logoImage: input.logoImage === '' ? undefined : (input.logoImage ?? current.logoImage),
    };
    this._branding.set(next);
    this.persist(next);
    if (typeof document !== 'undefined') {
      document.title = next.displayName;
    }
  }

  /** Sube y procesa un archivo de imagen, redimensionándolo y guardándolo como data URL PNG. */
  async uploadLogoImage(file: File): Promise<void> {
    if (!file.type.startsWith('image/')) {
      throw new Error('El archivo debe ser una imagen.');
    }
    if (file.size > MAX_RAW_BYTES) {
      throw new Error('La imagen es demasiado grande (máx 2MB).');
    }
    const dataUrl = await this.resizeAndEncode(file);
    this.update({ logoImage: dataUrl });
  }

  /** Elimina la imagen y vuelve al logo textual. */
  clearLogoImage() {
    this.update({ logoImage: '' });
  }

  reset() {
    this._branding.set({ ...DEFAULTS });
    if (typeof window !== 'undefined') localStorage.removeItem(STORAGE_KEY);
    if (typeof document !== 'undefined') document.title = DEFAULTS.displayName;
  }

  private persist(b: Branding) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(b));
    } catch (e) {
      // localStorage puede estar lleno; lo más probable es por la imagen.
      console.error('No se pudo persistir branding:', e);
      throw new Error('No se pudo guardar la imagen (almacenamiento lleno). Prueba con una imagen más pequeña.');
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
