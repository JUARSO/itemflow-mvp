import { EnvironmentInjector, Injectable, inject, runInInjectionContext } from '@angular/core';
import { Storage, ref, uploadString, getDownloadURL, deleteObject } from '@angular/fire/storage';
import { AuthService } from './auth.service';

/**
 * Subida de imágenes a Firebase Storage bajo `tenants/{tenantId}/...`.
 *
 * Las imágenes (fotos de recetas, logo de marca) ANTES se guardaban como data
 * URL base64 dentro de los documentos de Firestore (pesado y con límite de 1 MB
 * por doc). Ahora se suben a Storage y en Firestore se guarda solo la URL.
 */
@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly storage = inject(Storage);
  private readonly auth = inject(AuthService);
  private readonly injector = inject(EnvironmentInjector);

  private inCtx<T>(fn: () => T): T { return runInInjectionContext(this.injector, fn); }

  /** ¿Es un data URL (imagen embebida base64) y no una URL ya subida? */
  static isDataUrl(value: string | undefined | null): boolean {
    return !!value && value.startsWith('data:');
  }

  /**
   * Sube un data URL a `tenants/{tenantId}/{path}` y devuelve la URL de descarga.
   * `path` es relativo al tenant, p. ej. `recipes/abc/photo.jpg`.
   */
  async uploadDataUrl(path: string, dataUrl: string): Promise<string> {
    const fullPath = `tenants/${this.auth.tenantId()}/${path}`;
    const r = ref(this.storage, fullPath);
    await this.inCtx(() => uploadString(r, dataUrl, 'data_url'));
    return this.inCtx(() => getDownloadURL(r));
  }

  /** Borra un archivo por su ruta relativa al tenant. Silencioso si no existe. */
  async deletePath(path: string): Promise<void> {
    try {
      await this.inCtx(() => deleteObject(ref(this.storage, `tenants/${this.auth.tenantId()}/${path}`)));
    } catch { /* no existe / ya borrado */ }
  }
}
