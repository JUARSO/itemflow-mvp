import { Injectable, signal } from '@angular/core';

export interface UbicNode { codigo: string; nombre: string; }
export interface CantonNode extends UbicNode { distritos: UbicNode[]; }
export interface ProvinciaNode extends UbicNode { cantones: CantonNode[]; }

/**
 * División territorial de Costa Rica (provincias → cantones → distritos) con los
 * códigos de Hacienda, para autocompletar en cascada los datos de ubicación.
 * El dataset (~22KB) se carga bajo demanda la primera vez y se cachea.
 */
@Injectable({ providedIn: 'root' })
export class UbicacionesService {
  private _provincias: ProvinciaNode[] = [];
  private loading = false;
  private readonly _ready = signal(false);
  readonly ready = this._ready.asReadonly();

  async ensureLoaded(): Promise<void> {
    if (this._ready() || this.loading) return;
    this.loading = true;
    try {
      const res = await fetch('assets/ubicaciones-cr.json');
      const data = await res.json() as { provincias: ProvinciaNode[] };
      this._provincias = data.provincias ?? [];
      this._ready.set(true);
    } catch {
      // queda vacío si falla la carga
    } finally {
      this.loading = false;
    }
  }

  provincias(): ProvinciaNode[] {
    return this._provincias;
  }

  cantones(provinciaCodigo: string): CantonNode[] {
    return this._provincias.find(p => p.codigo === provinciaCodigo)?.cantones ?? [];
  }

  distritos(provinciaCodigo: string, cantonCodigo: string): UbicNode[] {
    return this.cantones(provinciaCodigo).find(c => c.codigo === cantonCodigo)?.distritos ?? [];
  }
}
