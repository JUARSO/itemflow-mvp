import { Injectable, computed, signal } from '@angular/core';
import { TipoIdentificacion } from '../models';

export type { TipoIdentificacion };

/**
 * Datos del emisor para generar facturas electrónicas en Costa Rica.
 * Incluye identidad fiscal, ubicación, contacto y credenciales de Hacienda (ATV).
 */
export interface EmisorFE {
  // Identificación
  nombre: string;               // Razón social / nombre completo
  tipoIdentificacion: TipoIdentificacion;
  identificacion: string;       // Número de cédula (solo dígitos)
  nombreComercial: string;
  actividadEconomica: string;   // Código de actividad económica
  sucursal: string;             // Código de sucursal (3 dígitos, ej. 001)
  terminal: string;             // Código de terminal (5 dígitos, ej. 00001)

  // Ubicación
  provincia: string;
  canton: string;
  distrito: string;
  barrio: string;
  otrasSenas: string;

  // Contacto
  codigoPaisTel: string;        // Ej. 506
  telefono: string;
  correo: string;

  // Hacienda / ATV
  usuarioHacienda: string;
  passwordHacienda: string;
  certificadoPin: string;       // PIN de la llave criptográfica (.p12)
  certificadoNombre?: string;   // Nombre del archivo .p12 cargado
  certificadoData?: string;     // Contenido del .p12 en base64 (data URL)
}

const STORAGE_KEY = 'atlas_fe_emisor_v1';

const DEFAULTS: EmisorFE = {
  nombre: '',
  tipoIdentificacion: '02',
  identificacion: '',
  nombreComercial: '',
  actividadEconomica: '',
  sucursal: '001',
  terminal: '00001',
  provincia: '',
  canton: '',
  distrito: '',
  barrio: '',
  otrasSenas: '',
  codigoPaisTel: '506',
  telefono: '',
  correo: '',
  usuarioHacienda: '',
  passwordHacienda: '',
  certificadoPin: '',
};

@Injectable({ providedIn: 'root' })
export class FacturacionService {
  private readonly _emisor = signal<EmisorFE>(this.readInitial());
  readonly emisor = this._emisor.asReadonly();

  /** true cuando están los campos mínimos para emitir (identidad + contacto). */
  readonly configurado = computed(() => {
    const e = this._emisor();
    return !!(e.nombre && e.identificacion && e.correo);
  });

  save(value: EmisorFE): void {
    this._emisor.set(value);
    this.persist(value);
  }

  private readInitial(): EmisorFE {
    if (typeof localStorage === 'undefined') return { ...DEFAULTS };
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULTS };
      return { ...DEFAULTS, ...JSON.parse(raw) as Partial<EmisorFE> };
    } catch {
      return { ...DEFAULTS };
    }
  }

  private persist(value: EmisorFE): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {
      // Silencioso: si falla localStorage (modo privado / cuota), mantenemos en memoria.
    }
  }
}
