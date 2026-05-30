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

const MS_PER_DAY = 86_400_000;
/** Días mínimos a visualizar aunque no haya entregas más allá. */
const MIN_HORIZON_DAYS = 30;

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

interface DayBucket {
  date: Date;
  iso: string;
  isToday: boolean;
  isPast: boolean;
  starting: ProductionTask[];
  delivering: ProductionTask[];
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

    return Array.from(map.values())
      .sort((a, b) => a.deliveryDate.getTime() - b.deliveryDate.getTime());
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

  /** Buckets diarios desde hoy hasta el horizonte. */
  readonly days = computed<DayBucket[]>(() => {
    const start = this.today();
    const horizon = this.horizonDays();
    const buckets = new Map<string, DayBucket>();
    for (let i = 0; i < horizon; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const iso = this.toIso(d);
      buckets.set(iso, {
        date: d,
        iso,
        isToday: i === 0,
        isPast: false,
        starting: [],
        delivering: [],
      });
    }
    // Bucket virtual para tareas atrasadas (las metemos en hoy)
    const today = buckets.get(this.todayIso());
    for (const t of this.tasks()) {
      const startIso = this.toIso(t.startDate);
      const deliverIso = this.toIso(t.deliveryDate);
      const startBucket = buckets.get(startIso) ?? today;
      if (startBucket) startBucket.starting.push(t);
      const deliverBucket = buckets.get(deliverIso);
      if (deliverBucket) deliverBucket.delivering.push(t);
    }
    return Array.from(buckets.values());
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
