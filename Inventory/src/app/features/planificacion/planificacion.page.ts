import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
  IonButton, IonIcon,
} from '@ionic/angular/standalone';
import { DataService } from '../../core/services/data.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { UnitShortPipe } from '../../shared/pipes/unit-short.pipe';

const MS_PER_DAY = 86_400_000;
/** Días mínimos a visualizar aunque no haya entregas más allá. */
const MIN_HORIZON_DAYS = 30;
/** Días hacia adelante que proyecta el plan semanal recurrente (2 semanas). */
const PLAN_HORIZON_DAYS = 14;

/**
 * Origen individual de una tarea agregada: un pedido específico de un
 * cliente que contribuye con `qty` al total a fabricar.
 */
interface TaskSource {
  orderId: string;
  orderCode: string;
  /** Para quién es: nombre del cliente, o "Almacén · <urna>" si es reposición. */
  cliente: string;
  qty: number;
}

/**
 * Tarea de producción AGREGADA por (producto, fecha de entrega).
 * Optimiza la fabricación: si dos clientes piden el mismo producto para el
 * mismo día, se fabrica TODO junto en un solo lote (ej: 10 + 5 = 15 unidades).
 */
interface ProductionTask {
  /** Clave única (productId + ISO del día de entrega). */
  key: string;
  productId: string;
  productName: string;
  unit: string;
  leadTime: number;
  startDate: Date;
  deliveryDate: Date;
  totalQty: number;
  /** Pedidos individuales que componen esta tarea. */
  sources: TaskSource[];
  /** El inicio sugerido ya pasó. */
  overdue: boolean;
}

/** Línea de un día ya CONSOLIDADA por producto (suma de todos los lotes del día). */
interface PlanLine {
  productId: string;
  productName: string;
  unit: string;
  totalQty: number;
  /** Algún lote de esta línea tiene el inicio sugerido en el pasado. */
  overdue: boolean;
}

interface DayBucket {
  date: Date;
  iso: string;
  isToday: boolean;
  isPast: boolean;
  starting: PlanLine[];
  delivering: PlanLine[];
}

/** Resumen consolidado: total a producir por producto, sumando todos los lotes. */
interface ProductSummary {
  productId: string;
  productName: string;
  unit: string;
  totalQty: number;
  /** Cantidad de lotes (producto+fecha) que se agregan en este total. */
  lots: number;
}

@Component({
  selector: 'app-planificacion',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, DecimalPipe, RouterLink,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
    IonButton, IonIcon,
    PageHeaderComponent, KpiCardComponent,
    UnitShortPipe,
  ],
  templateUrl: './planificacion.page.html',
  styleUrls: ['./planificacion.page.scss'],
})
export class PlanificacionPage {
  protected readonly data = inject(DataService);

  /**
   * Tareas agregadas por (producto, fecha de entrega).
   * Optimización: si dos clientes piden el mismo producto el mismo día,
   * se cuentan como UN solo lote a fabricar con cantidad sumada.
   * Incluye TODOS los pedidos abiertos sin filtro de fecha.
   */
  readonly tasks = computed<ProductionTask[]>(() => {
    const todayMs = this.todayMs();
    const map = new Map<string, ProductionTask>();

    for (const o of this.data.produccionQueue()) {
      // Solo trabajo de producción activo (no completado/cancelado)
      if (o.status !== 'in_production' && o.status !== 'pending') continue;

      // Para quién es el pedido: cliente externo, reposición de almacén, o interno.
      const cliente = o.customerId
        ? (this.data.customerById(o.customerId)?.name ?? 'Cliente')
        : o.urnaId
          ? `Almacén · ${o.urnaName ?? 'reposición'}`
          : (o.purpose || 'Interno');

      for (const it of o.items) {
        // Si la orden ya está in_production y este item ya se cumplió, no aparece
        if (o.status === 'in_production' && it.fulfilledQty >= it.qty) continue;

        const remaining = o.status === 'in_production'
          ? Math.max(0, it.qty - it.fulfilledQty)
          : it.qty;
        if (remaining <= 0) continue;

        const prod = this.data.productById(it.productId);
        const leadTime = prod?.leadTime ?? 1;

        // Fecha de entrega: si el pedido la trae, se respeta.
        // Si no, se asume "lo antes posible" = hoy + leadTime.
        const deliveryDate = o.requestedDeliveryDate
          ? this.normalizeDate(o.requestedDeliveryDate)
          : new Date(todayMs + leadTime * MS_PER_DAY);
        const deliveryIso = this.toIso(deliveryDate);
        const startDate = new Date(deliveryDate.getTime() - leadTime * MS_PER_DAY);
        const key = `${it.productId}::${deliveryIso}`;

        const source: TaskSource = {
          orderId: o.id,
          orderCode: o.code,
          cliente,
          qty: remaining,
        };

        const existing = map.get(key);
        if (existing) {
          existing.totalQty += remaining;
          existing.sources.push(source);
        } else {
          map.set(key, {
            key,
            productId: it.productId,
            productName: it.productName,
            unit: it.unit,
            leadTime,
            startDate,
            deliveryDate,
            totalQty: remaining,
            sources: [source],
            overdue: startDate.getTime() < todayMs,
          });
        }
      }
    }

    // ----- Plan de producción SEMANAL recurrente (almacén) -----
    // Proyecta la config semanal sobre los próximos días: cada día toma la lista
    // de su día de la semana. Al editar la config, esto se recalcula solo.
    const plan = this.data.weeklyProductionPlan();
    for (let i = 0; i < PLAN_HORIZON_DAYS; i++) {
      const day = this.normalizeDate(new Date(todayMs + i * MS_PER_DAY));
      const items = plan[day.getDay()] ?? [];
      if (items.length === 0) continue;
      const deliveryIso = this.toIso(day);
      for (const it of items) {
        if (it.qty <= 0) continue;
        const prod = this.data.productById(it.productId);
        const leadTime = prod?.leadTime ?? 1;
        const startDate = new Date(day.getTime() - leadTime * MS_PER_DAY);
        const key = `${it.productId}::${deliveryIso}`;
        const source: TaskSource = {
          orderId: `plan-${deliveryIso}-${it.productId}`,
          orderCode: 'Plan semanal',
          cliente: 'Almacén · plan semanal',
          qty: it.qty,
        };
        const existing = map.get(key);
        if (existing) {
          existing.totalQty += it.qty;
          existing.sources.push(source);
        } else {
          map.set(key, {
            key,
            productId: it.productId,
            productName: prod?.name ?? it.productId,
            unit: prod?.unit ?? 'u',
            leadTime,
            startDate,
            deliveryDate: day,
            totalQty: it.qty,
            sources: [source],
            overdue: startDate.getTime() < todayMs,
          });
        }
      }
    }

    return Array.from(map.values())
      .sort((a, b) => a.deliveryDate.getTime() - b.deliveryDate.getTime());
  });

  /**
   * Resumen inicial: TOTAL a producir por producto, consolidando todos los
   * lotes (pedidos + plan semanal) sin importar la fecha de entrega. Sirve para
   * ver de un vistazo cuánto hay que fabricar de cada producto en total.
   */
  readonly productionSummary = computed<ProductSummary[]>(() => {
    const map = new Map<string, ProductSummary>();
    for (const t of this.tasks()) {
      const ex = map.get(t.productId);
      if (ex) {
        ex.totalQty += t.totalQty;
        ex.lots += 1;
      } else {
        map.set(t.productId, {
          productId: t.productId,
          productName: t.productName,
          unit: t.unit,
          totalQty: t.totalQty,
          lots: 1,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.totalQty - a.totalQty);
  });

  /**
   * Horizonte dinámico: desde hoy hasta la fecha de entrega más lejana
   * (mínimo 30 días para que se vea siempre algo).
   */
  readonly horizonDays = computed(() => {
    const todayMs = this.todayMs();
    const maxDelivery = this.tasks().reduce((max, t) => {
      const dt = t.deliveryDate.getTime();
      return dt > max ? dt : max;
    }, todayMs);
    const diffDays = Math.ceil((maxDelivery - todayMs) / MS_PER_DAY) + 2;
    return Math.max(MIN_HORIZON_DAYS, diffDays);
  });

  /**
   * Buckets diarios desde hoy hasta el horizonte. Cada día consolida sus tareas
   * POR PRODUCTO: si varios lotes del mismo producto inician (o se entregan) el
   * mismo día, se muestran como una sola línea con la cantidad sumada.
   */
  readonly days = computed<DayBucket[]>(() => {
    const start = this.today();
    const horizon = this.horizonDays();
    interface Acc { date: Date; iso: string; isToday: boolean; isPast: boolean; start: Map<string, PlanLine>; deliver: Map<string, PlanLine>; }
    const buckets = new Map<string, Acc>();
    for (let i = 0; i < horizon; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const iso = this.toIso(d);
      buckets.set(iso, { date: d, iso, isToday: i === 0, isPast: false, start: new Map(), deliver: new Map() });
    }
    const today = buckets.get(this.todayIso());

    const add = (map: Map<string, PlanLine>, t: ProductionTask) => {
      const ex = map.get(t.productId);
      if (ex) {
        ex.totalQty += t.totalQty;
        ex.overdue = ex.overdue || t.overdue;
      } else {
        map.set(t.productId, { productId: t.productId, productName: t.productName, unit: t.unit, totalQty: t.totalQty, overdue: t.overdue });
      }
    };

    for (const t of this.tasks()) {
      const startBucket = buckets.get(this.toIso(t.startDate)) ?? today;
      if (startBucket) add(startBucket.start, t);
      const deliverBucket = buckets.get(this.toIso(t.deliveryDate));
      if (deliverBucket) add(deliverBucket.deliver, t);
    }

    const byQty = (a: PlanLine, b: PlanLine) => b.totalQty - a.totalQty;
    return Array.from(buckets.values()).map(b => ({
      date: b.date, iso: b.iso, isToday: b.isToday, isPast: b.isPast,
      starting: Array.from(b.start.values()).sort(byQty),
      delivering: Array.from(b.deliver.values()).sort(byQty),
    }));
  });

  readonly nonEmptyDays = computed(() =>
    this.days().filter(b => b.starting.length > 0 || b.delivering.length > 0)
  );

  readonly firstDay = computed(() => this.days()[0]?.date);
  readonly lastDay = computed(() => this.days()[this.days().length - 1]?.date);

  readonly totalTasks = computed(() => this.tasks().length);
  readonly totalUnits = computed(() => this.tasks().reduce((s, t) => s + t.totalQty, 0));
  readonly todayStarting = computed(() => this.days()[0]?.starting.length ?? 0);
  readonly overdueTasks = computed(() => this.tasks().filter(t => t.overdue).length);

  // ---- Helpers de fecha ----
  private today(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }
  private todayMs(): number {
    return this.today().getTime();
  }
  private todayIso(): string {
    return this.toIso(this.today());
  }
  private toIso(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  private normalizeDate(d: Date): Date {
    const out = new Date(d);
    out.setHours(0, 0, 0, 0);
    return out;
  }
}
