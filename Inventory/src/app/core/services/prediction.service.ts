import { Injectable, inject, signal } from '@angular/core';
import {
  PredictionDecision, PredictionRequest, PredictionResponse,
  PredictionEvent,
} from '../models';
import { DataService } from './data.service';

/**
 * Contexto opcional del item analizado. Si se pasa, el simulador local usa
 * `effectiveDailyDemand` (rolling + boosts activos) en vez de la rolling_mean
 * plana del request — produce una trayectoria que respeta promos/eventos.
 */
export interface PredictionItemContext {
  kind: 'supply' | 'product';
  id: string;
}

/**
 * Endpoint del backend. Si la respuesta no es OK o falla la red, se usa
 * un simulador local determinista que produce la misma shape de respuesta
 * para que la UI sea operable sin backend durante desarrollo.
 */
const ENDPOINT = '/api/predict';
const SIMULATION_DAYS = 181;

/** Estado público observable por la UI. */
export interface PredictionState {
  loading: boolean;
  error: string | null;
  result: PredictionResponse | null;
  request: PredictionRequest | null;
  /** true si la última respuesta vino del fallback local en vez de la red. */
  simulated: boolean;
}

@Injectable({ providedIn: 'root' })
export class PredictionService {
  private readonly data = inject(DataService);
  private readonly _state = signal<PredictionState>({
    loading: false,
    error: null,
    result: null,
    request: null,
    simulated: false,
  });
  readonly state = this._state.asReadonly();

  async predict(req: PredictionRequest, itemContext?: PredictionItemContext): Promise<PredictionResponse> {
    this._state.update(s => ({ ...s, loading: true, error: null, request: req }));
    try {
      let result: PredictionResponse;
      let simulated = false;
      try {
        result = await this.callBackend(req);
      } catch {
        result = this.simulateLocally(req, itemContext);
        simulated = true;
      }
      this._state.set({ loading: false, error: null, result, request: req, simulated });
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error desconocido al ejecutar la predicción.';
      this._state.update(s => ({ ...s, loading: false, error: msg }));
      throw e;
    }
  }

  clear() {
    this._state.set({ loading: false, error: null, result: null, request: null, simulated: false });
  }

  // ------------------------------------------------------------
  //  Backend real
  // ------------------------------------------------------------
  private async callBackend(req: PredictionRequest): Promise<PredictionResponse> {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json() as PredictionResponse;
  }

  /**
   * Calcula la predicción LOCALMENTE (determinista, sin backend ni estado).
   * Útil para evaluar muchos ítems a la vez (ej. la grilla de tarjetas).
   */
  simulate(req: PredictionRequest, itemContext?: PredictionItemContext): PredictionResponse {
    return this.simulateLocally(req, itemContext);
  }

  // ------------------------------------------------------------
  //  Simulador local determinista (fallback sin backend)
  //
  //  Reproduce la lógica que tendría el Modelo 2: día a día,
  //  consume `rolling_mean_7d` unidades, y cuando el stock cae
  //  por debajo del punto de reorden dispara un pedido que llega
  //  `lt_avg` días después con cantidad = stock_max - stock_actual
  //  (acotado a cantidad_modelo del Modelo 1).
  // ------------------------------------------------------------
  private simulateLocally(req: PredictionRequest, itemContext?: PredictionItemContext): PredictionResponse {
    const safety_stock = +(req.rolling_std_7d * Math.sqrt(req.lt_avg) * 1.65).toFixed(2);
    const reorder_point = +(req.rolling_mean_7d * req.lt_avg + safety_stock).toFixed(2);
    const dias_cobertura = req.rolling_mean_7d > 0
      ? +(req.actual_stock / req.rolling_mean_7d).toFixed(1)
      : 0;
    const tendencia = +(req.rolling_mean_7d - req.rolling_mean_30d).toFixed(2);
    const stock_ratio = reorder_point > 0
      ? +(req.actual_stock / reorder_point).toFixed(2)
      : 0;

    // Cantidad modelo: heurística que apunta a llenar hasta stock_max + buffer por demanda durante lead time.
    const cantidad_modelo = Math.max(0, Math.round(
      req.stock_max - req.actual_stock + req.rolling_mean_7d * req.lt_avg
    ));
    const cantidad_final = Math.min(cantidad_modelo, req.stock_max - req.stock_min);

    const urgencia = this.computeUrgencia(req, reorder_point);
    const decision = this.computeDecision(req, urgencia, reorder_point);

    // Simulación de 181 días
    const trayectoria: number[] = [];
    const eventos: PredictionEvent[] = [];
    let stock = req.actual_stock;
    const lt = Math.max(1, Math.round(req.lt_avg));
    const ropEfectivo = Math.max(reorder_point, req.reorder_point_manual);

    for (let d = 0; d < SIMULATION_DAYS; d++) {
      trayectoria.push(Math.round(stock));
      // Llegadas programadas en este día
      for (const ev of eventos) {
        if (ev.arrival === d) stock += ev.qty;
      }
      // ¿Hay que disparar pedido?
      const yaHayEnTransito = eventos.some(ev => ev.trigger < d && ev.arrival > d);
      if (!yaHayEnTransito && stock <= ropEfectivo && stock > 0) {
        const qty = Math.max(0, Math.min(cantidad_final, req.stock_max - Math.round(stock)));
        if (qty > 0) eventos.push({ trigger: d, arrival: d + lt, qty });
      }
      // Consumo del día: si tenemos contexto de item, usamos demanda efectiva
      // (rolling + boosts). Sin contexto caemos al rolling_mean_7d del request.
      const dayDemand = itemContext
        ? this.data.effectiveDailyDemand(itemContext.kind, itemContext.id, d)
        : req.rolling_mean_7d;
      stock = Math.max(0, stock - dayDemand);
    }

    const get = (i: number) => trayectoria[Math.min(i, trayectoria.length - 1)];
    const stock_proyeccion = {
      t7: get(7),
      t14: get(14),
      t30: get(30),
      t60: get(60),
    };

    return {
      orden: { urgencia, cantidad_modelo, cantidad_final, decision },
      stock_proyeccion,
      simulacion: { trayectoria, eventos },
      derivados: {
        safety_stock,
        reorder_point,
        dias_cobertura,
        tendencia,
        stock_ratio,
      },
    };
  }

  private computeUrgencia(req: PredictionRequest, rop: number): number {
    if (req.actual_stock <= req.stock_min) return 1;
    if (rop <= 0) return 0;
    // 0 cuando stock ≥ rop, sube linealmente hasta 1 cuando stock = stock_min
    const range = rop - req.stock_min;
    if (range <= 0) return req.actual_stock < rop ? 1 : 0;
    const u = (rop - req.actual_stock) / range;
    return +Math.max(0, Math.min(1, u)).toFixed(3);
  }

  private computeDecision(req: PredictionRequest, urgencia: number, rop: number): PredictionDecision {
    if (req.actual_stock <= req.stock_min) return 'CRITICO_BAJO_MINIMO';
    if (req.actual_stock >= req.stock_max) return 'SOBRESTOCK';
    if (urgencia >= 0.7) return 'ORDENAR_URGENTE';
    if (urgencia >= 0.4) return 'EVALUAR_ORDEN';
    return req.actual_stock >= rop ? 'STOCK_SUFICIENTE' : 'EVALUAR_ORDEN';
  }
}

/** Mapa de decision → estado semántico para la UI. */
export const DECISION_TO_STATUS: Record<PredictionDecision, {
  status: 'critico' | 'critico_extremo' | 'alerta' | 'optimo' | 'informativo';
  title: string;
  icon: string;
}> = {
  ORDENAR_URGENTE:     { status: 'critico',          title: 'Ordenar urgente',        icon: 'alert-circle-outline' },
  EVALUAR_ORDEN:       { status: 'alerta',           title: 'Evaluar orden',          icon: 'warning-outline' },
  STOCK_SUFICIENTE:    { status: 'optimo',           title: 'Stock suficiente',       icon: 'checkmark-outline' },
  SOBRESTOCK:          { status: 'informativo',      title: 'Sobrestock',             icon: 'information-circle-outline' },
  CRITICO_BAJO_MINIMO: { status: 'critico_extremo',  title: 'Crítico — bajo mínimo',  icon: 'close-circle-outline' },
};
