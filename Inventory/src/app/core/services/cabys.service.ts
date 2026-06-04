import { Injectable, signal } from '@angular/core';

/** Entrada del catálogo CABYS (subset de los campos que usamos). */
export interface CabysEntry {
  codigo: string;
  descripcion: string;
  busqueda: string;
  tasa_iva: number;
}

/**
 * Acceso al catálogo CABYS (Hacienda CR). El archivo (~31MB, 20k+ entradas) se
 * carga BAJO DEMANDA la primera vez que se abre el buscador, no al iniciar la app,
 * y se cachea en memoria. La búsqueda es por substring sobre el campo `busqueda`
 * (descripción normalizada) o por código, limitada para mantener la UI ágil.
 */
@Injectable({ providedIn: 'root' })
export class CabysService {
  private entries: CabysEntry[] | null = null;
  private readonly _ready = signal(false);
  private readonly _loading = signal(false);
  private readonly _error = signal(false);

  /** true cuando el catálogo ya está cargado en memoria. */
  readonly ready = this._ready.asReadonly();
  /** true mientras se descarga/parsea el archivo. */
  readonly loading = this._loading.asReadonly();
  /** true si falló la carga. */
  readonly error = this._error.asReadonly();

  /** Descarga y cachea el catálogo una sola vez. Idempotente. */
  async ensureLoaded(): Promise<void> {
    if (this._ready() || this._loading()) return;
    this._loading.set(true);
    this._error.set(false);
    try {
      const res = await fetch('assets/catalogo-cabys.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.json() as Array<Record<string, unknown>>;
      // Conservamos solo los campos necesarios para reducir memoria.
      this.entries = raw.map(e => ({
        codigo: String(e['codigo'] ?? ''),
        descripcion: String(e['descripcion'] ?? ''),
        busqueda: String(e['busqueda'] ?? e['descripcion'] ?? '').toLowerCase(),
        tasa_iva: Number(e['tasa_iva'] ?? 0),
      }));
      this._ready.set(true);
    } catch {
      this._error.set(true);
    } finally {
      this._loading.set(false);
    }
  }

  /** Busca por substring (descripción o código). Devuelve hasta `limit` resultados. */
  search(query: string, limit = 50): CabysEntry[] {
    if (!this.entries) return [];
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const out: CabysEntry[] = [];
    for (const e of this.entries) {
      if (e.busqueda.includes(q) || e.codigo.includes(q)) {
        out.push(e);
        if (out.length >= limit) break;
      }
    }
    return out;
  }

  /** Busca una entrada exacta por código. */
  byCode(code: string): CabysEntry | undefined {
    return this.entries?.find(e => e.codigo === code);
  }
}
