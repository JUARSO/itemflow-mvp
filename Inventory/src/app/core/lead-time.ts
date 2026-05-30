/**
 * Cálculo dinámico del lead time según calendario semanal del proveedor.
 *
 * Los proveedores no entregan cualquier día: tienen días fijos de pedido y
 * días fijos de entrega. El LT real depende del día actual, porque hay que
 * esperar a la próxima ventana de pedido y, desde ahí, a la próxima entrega.
 *
 * Ejemplo: proveedor recibe pedidos los lunes y entrega los jueves.
 *  - Hoy martes → próximo pedido lunes (en 6 días) → entrega jueves (en 9). LT=9.
 *  - Hoy domingo → próximo pedido lunes (en 1 día) → entrega jueves (en 4). LT=4.
 */

export interface SupplierSchedule {
  /** Días (0=domingo..6=sábado) en que el proveedor acepta pedidos. */
  orderDays: number[];
  /** Días en que el proveedor entrega. */
  deliveryDays: number[];
  /** LT fijo histórico — fallback si el calendario no está configurado. */
  leadTimeDays: number;
}

export interface LeadTimeResult {
  /** Días desde hoy hasta la próxima entrega efectiva. */
  leadTimeDays: number;
  /** Fecha estimada en que se haría el pedido. */
  nextOrderDate: Date;
  /** Fecha estimada en que llegaría la entrega. */
  nextDeliveryDate: Date;
  /** true si se usó el calendario; false si se cayó al leadTimeDays fijo. */
  fromCalendar: boolean;
}

const MS_PER_DAY = 86_400_000;

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/**
 * Próximo día (en 0..6 saltos desde `from`, inclusivo o exclusivo) cuyo
 * weekday() esté en `allowed`. Devuelve null si `allowed` está vacío.
 */
function nextMatchingDay(from: Date, allowed: number[], inclusive: boolean): Date | null {
  if (allowed.length === 0) return null;
  for (let i = inclusive ? 0 : 1; i < 14; i++) {
    const cand = addDays(from, i);
    if (allowed.includes(cand.getDay())) return cand;
  }
  return null;
}

/**
 * Calcula el lead time efectivo desde `today` para un proveedor con
 * calendario semanal. Si `orderDays` o `deliveryDays` está vacío, cae al
 * `leadTimeDays` fijo (compat con proveedores sin calendario configurado).
 */
export function computeSupplierLeadTime(schedule: SupplierSchedule, today: Date = new Date()): LeadTimeResult {
  const t0 = startOfDay(today);

  const hasCalendar = schedule.orderDays.length > 0 && schedule.deliveryDays.length > 0;
  if (!hasCalendar) {
    return {
      leadTimeDays: schedule.leadTimeDays ?? 0,
      nextOrderDate: t0,
      nextDeliveryDate: addDays(t0, schedule.leadTimeDays ?? 0),
      fromCalendar: false,
    };
  }

  // Próximo día de pedido — hoy cuenta si hoy es día de pedido.
  const orderDate = nextMatchingDay(t0, schedule.orderDays, true)!;
  // Próxima entrega — estrictamente DESPUÉS del día de pedido.
  const deliveryDate = nextMatchingDay(orderDate, schedule.deliveryDays, false)!;
  const leadTimeDays = Math.round((deliveryDate.getTime() - t0.getTime()) / MS_PER_DAY);

  return {
    leadTimeDays,
    nextOrderDate: orderDate,
    nextDeliveryDate: deliveryDate,
    fromCalendar: true,
  };
}
