import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
  IonButton, IonIcon, IonBadge,
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
  customerName: string | null;
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
    IonButton, IonIcon, IonBadge,
    PageHeaderComponent, KpiCardComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-menu-button></ion-menu-button></ion-buttons>
        <ion-title>Planificación</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <app-page-header
        title="Planificación de producción"
        subtitle="Tareas activas agregadas por producto y fecha de entrega. Si varios clientes piden el mismo producto el mismo día, se fabrica en un solo lote.">
        <ion-button fill="outline" routerLink="/produccion">Ver pedidos</ion-button>
      </app-page-header>

      <!-- KPIs -->
      <div class="kpis">
        <app-kpi-card label="Tareas activas" [value]="totalTasks()" tone="primary"
          hint="lotes a fabricar"></app-kpi-card>
        <app-kpi-card label="Unidades totales" [value]="totalUnits()" tone="transit"
          hint="suma de todos los lotes"></app-kpi-card>
        <app-kpi-card label="Hoy a iniciar" [value]="todayStarting()" tone="warning"></app-kpi-card>
        <app-kpi-card label="Atrasadas" [value]="overdueTasks()" tone="danger"
          [hint]="overdueTasks() > 0 ? 'inicio sugerido en el pasado' : 'al día'"></app-kpi-card>
      </div>

      @if (totalTasks() === 0) {
        <div class="empty">
          <h3>Sin tareas activas</h3>
          <p>Acepta pedidos de clientes en la cola de producción para que aparezcan aquí planificados.</p>
          <ion-button routerLink="/produccion">Ir a pedidos</ion-button>
        </div>
      } @else {
        <!-- Selector de vista -->
        <div class="toolbar">
          <div class="view-switch">
            <button class="view-btn" [class.view-btn--on]="view() === 'calendar'" (click)="view.set('calendar')">
              <ion-icon name="calendar-outline"></ion-icon> Calendario
            </button>
            <button class="view-btn" [class.view-btn--on]="view() === 'list'" (click)="view.set('list')">
              <ion-icon name="receipt-outline"></ion-icon> Lista cronológica
            </button>
          </div>
          <span class="period mono">
            {{ firstDay() | date:'dd MMM' }} → {{ lastDay() | date:'dd MMM yyyy' }}
          </span>
        </div>

        @if (view() === 'calendar') {
          <!-- Vista calendario -->
          <div class="calendar">
            <div class="calendar__head">
              @for (h of weekdayHeaders; track h) {
                <div class="calendar__hday">{{ h }}</div>
              }
            </div>
            <div class="calendar__grid">
              @for (slot of calendarSlots(); track $index) {
                @if (slot) {
                  <button class="cell"
                    [class.cell--today]="slot.isToday"
                    [class.cell--past]="slot.isPast"
                    [class.cell--selected]="slot.iso === selectedIso()"
                    [class.cell--busy]="(slot.starting.length + slot.delivering.length) > 0"
                    (click)="selectDay(slot.iso)">
                    <div class="cell__num">{{ slot.date | date:'d' }}</div>
                    @if (slot.starting.length > 0) {
                      <div class="cell__chip cell__chip--start" title="Iniciar">
                        <ion-icon name="hammer-outline"></ion-icon> {{ slot.starting.length }}
                      </div>
                    }
                    @if (slot.delivering.length > 0) {
                      <div class="cell__chip cell__chip--deliver" title="Entregar">
                        <ion-icon name="arrow-forward-outline"></ion-icon> {{ slot.delivering.length }}
                      </div>
                    }
                  </button>
                } @else {
                  <div class="cell cell--empty"></div>
                }
              }
            </div>
          </div>

          <!-- Detalle del día seleccionado -->
          @if (selectedBucket(); as b) {
            <div class="day-detail">
              <h3 class="day-detail__title">
                <ion-icon name="calendar-outline"></ion-icon>
                {{ b.date | date:'EEEE dd MMMM yyyy' }}
              </h3>

              @if (b.starting.length === 0 && b.delivering.length === 0) {
                <p class="day-detail__empty">Sin tareas para este día.</p>
              }

              @if (b.starting.length > 0) {
                <h4 class="day-detail__section">
                  <ion-icon name="hammer-outline"></ion-icon>
                  Iniciar fabricación ({{ b.starting.length }} lote(s))
                </h4>
                @for (t of b.starting; track t.key) {
                  <div class="task" [class.task--overdue]="t.overdue">
                    <div class="task__head">
                      <div>
                        <div class="task__name">{{ t.productName }}</div>
                        <div class="task__totals mono">
                          <strong>{{ t.totalQty | number:'1.0-0' }}</strong> {{ t.unit }}
                          · {{ t.sources.length }} pedido(s)
                        </div>
                      </div>
                      <ion-badge color="medium">
                        Entrega {{ t.deliveryDate | date:'dd-MM' }}
                      </ion-badge>
                    </div>
                    @if (t.sources.length > 1) {
                      <div class="task__sources">
                        <span class="task__sources-label">Desglose por cliente:</span>
                        @for (s of t.sources; track s.orderId) {
                          <div class="task__source">
                            <span class="task__source-name">
                              {{ s.customerName ?? 'Sin cliente' }}
                            </span>
                            <span class="task__source-qty mono">
                              {{ s.qty | number:'1.0-0' }} {{ t.unit }}
                            </span>
                            <span class="task__source-code mono">{{ s.orderCode }}</span>
                          </div>
                        }
                      </div>
                    } @else {
                      <div class="task__single">
                        Pedido <span class="mono">{{ t.sources[0].orderCode }}</span>
                        @if (t.sources[0].customerName) {
                          · {{ t.sources[0].customerName }}
                        }
                      </div>
                    }
                    <div class="task__lead">
                      Lead time {{ t.leadTime }} día(s) · inicio sugerido {{ t.startDate | date:'dd-MM' }}
                    </div>
                  </div>
                }
              }

              @if (b.delivering.length > 0) {
                <h4 class="day-detail__section day-detail__section--deliver">
                  <ion-icon name="arrow-forward-outline"></ion-icon>
                  Entregar ({{ b.delivering.length }} lote(s))
                </h4>
                @for (t of b.delivering; track t.key) {
                  <div class="task task--deliver">
                    <div class="task__head">
                      <div>
                        <div class="task__name">{{ t.productName }}</div>
                        <div class="task__totals mono">
                          <strong>{{ t.totalQty | number:'1.0-0' }}</strong> {{ t.unit }}
                          · {{ t.sources.length }} pedido(s)
                        </div>
                      </div>
                    </div>
                    @if (t.sources.length > 1) {
                      <div class="task__sources">
                        @for (s of t.sources; track s.orderId) {
                          <div class="task__source">
                            <span class="task__source-name">{{ s.customerName ?? 'Sin cliente' }}</span>
                            <span class="task__source-qty mono">
                              {{ s.qty | number:'1.0-0' }} {{ t.unit }}
                            </span>
                            <span class="task__source-code mono">{{ s.orderCode }}</span>
                          </div>
                        }
                      </div>
                    } @else {
                      <div class="task__single">
                        Pedido <span class="mono">{{ t.sources[0].orderCode }}</span>
                        @if (t.sources[0].customerName) {
                          · {{ t.sources[0].customerName }}
                        }
                      </div>
                    }
                  </div>
                }
              }
            </div>
          }
        } @else {
          <!-- Vista lista cronológica -->
          <div class="list">
            @for (b of nonEmptyDays(); track b.iso) {
              <div class="list-day" [class.list-day--today]="b.isToday" [class.list-day--past]="b.isPast">
                <div class="list-day__date">
                  <div class="list-day__weekday">{{ b.date | date:'EEEE' }}</div>
                  <div class="list-day__num mono">{{ b.date | date:'dd-MM' }}</div>
                </div>
                <div class="list-day__body">
                  @if (b.starting.length > 0) {
                    <div class="list-day__section">
                      <strong><ion-icon name="hammer-outline"></ion-icon> Iniciar:</strong>
                      <ul>
                        @for (t of b.starting; track t.key) {
                          <li [class.task--overdue]="t.overdue">
                            <strong class="mono">{{ t.totalQty | number:'1.0-0' }}</strong> {{ t.unit }}
                            de <strong>{{ t.productName }}</strong>
                            · entrega <span class="mono">{{ t.deliveryDate | date:'dd-MM' }}</span>
                            @if (t.sources.length > 1) {
                              <span class="lot-badge">{{ t.sources.length }} clientes</span>
                            }
                          </li>
                        }
                      </ul>
                    </div>
                  }
                  @if (b.delivering.length > 0) {
                    <div class="list-day__section">
                      <strong><ion-icon name="arrow-forward-outline"></ion-icon> Entregar:</strong>
                      <ul>
                        @for (t of b.delivering; track t.key) {
                          <li>
                            <strong class="mono">{{ t.totalQty | number:'1.0-0' }}</strong> {{ t.unit }}
                            de <strong>{{ t.productName }}</strong>
                            @if (t.sources.length > 1) {
                              <span class="lot-badge">{{ t.sources.length }} clientes</span>
                            }
                          </li>
                        }
                      </ul>
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        }
      }
    </ion-content>
  `,
  styles: [`
    .kpis {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: var(--ui-sp-3);
      padding: 0 var(--ui-sp-4) var(--ui-sp-4);
    }
    @media (max-width: 900px) { .kpis { grid-template-columns: 1fr 1fr; } }
    @media (max-width: 480px) { .kpis { grid-template-columns: 1fr; } }

    .empty {
      margin: var(--ui-sp-4);
      padding: var(--ui-sp-6);
      text-align: center;
      background: var(--ui-surface-2);
      border: var(--ui-border-w-md) dashed var(--ui-border);
    }
    .empty h3 { margin: 0 0 var(--ui-sp-2); font-size: var(--ui-fs-lg); }
    .empty p { margin: 0 0 var(--ui-sp-3); color: var(--ui-text-muted); font-size: var(--ui-fs-sm); }

    .toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0 var(--ui-sp-4) var(--ui-sp-3);
      gap: var(--ui-sp-3);
      flex-wrap: wrap;
    }
    .view-switch { display: flex; gap: 4px; }
    .view-btn {
      padding: 8px 14px;
      background: var(--ui-surface);
      border: var(--ui-border-w-md) solid var(--ui-border);
      cursor: pointer;
      font-weight: var(--ui-fw-bold);
      font-size: var(--ui-fs-sm);
      color: var(--ui-text-muted);
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .view-btn:hover { background: var(--ui-surface-2); }
    .view-btn ion-icon { font-size: 16px; }
    .view-btn--on {
      background: var(--ui-text);
      color: var(--ui-surface);
      border-color: var(--ui-text);
    }
    .view-btn--on ion-icon { color: var(--ui-surface); }
    .period {
      font-size: var(--ui-fs-sm);
      color: var(--ui-text-muted);
      font-weight: var(--ui-fw-bold);
    }

    /* === Calendario === */
    .calendar {
      margin: 0 var(--ui-sp-4) var(--ui-sp-4);
      border: var(--ui-border-w-md) solid var(--ui-border);
      background: var(--ui-surface);
      box-shadow: var(--ui-shadow-md);
    }
    .calendar__head {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      background: var(--ui-text);
      color: var(--ui-surface);
    }
    .calendar__hday {
      padding: 8px;
      text-align: center;
      font-size: var(--ui-fs-xs);
      font-weight: var(--ui-fw-black);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .calendar__grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
    }
    .cell {
      min-height: 78px;
      padding: 6px;
      background: var(--ui-surface);
      border: var(--ui-border-w-sm) solid var(--ui-border);
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 3px;
      text-align: left;
      font-family: var(--ui-font-sans);
      color: var(--ui-text);
    }
    .cell:hover { background: var(--ui-surface-2); }
    .cell--empty { cursor: default; background: var(--ui-surface-2); opacity: 0.4; }
    .cell--past { opacity: 0.55; }
    .cell--today {
      background: var(--ui-warning);
      color: #000;
      font-weight: var(--ui-fw-black);
    }
    .cell--busy { box-shadow: inset 3px 0 0 0 var(--ui-primary); }
    .cell--today.cell--busy { box-shadow: inset 3px 0 0 0 var(--ui-text); }
    .cell--selected {
      outline: 2px solid var(--ui-primary);
      outline-offset: -2px;
    }

    .cell__num { font-weight: var(--ui-fw-black); font-size: var(--ui-fs-md); }
    .cell__chip {
      font-size: 10px;
      padding: 2px 6px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-weight: var(--ui-fw-bold);
      width: fit-content;
    }
    .cell__chip ion-icon { font-size: 11px; }
    .cell__chip--start   { background: var(--ui-transit); color: #fff; }
    .cell__chip--deliver { background: var(--ui-success); color: #fff; }

    /* Detalle del día */
    .day-detail {
      margin: 0 var(--ui-sp-4) var(--ui-sp-8);
      padding: var(--ui-sp-4);
      background: var(--ui-surface);
      border: var(--ui-border-w-md) solid var(--ui-border);
      box-shadow: var(--ui-shadow-md);
    }
    .day-detail__title {
      margin: 0 0 var(--ui-sp-3);
      font-family: var(--ui-font-display);
      font-weight: var(--ui-fw-black);
      font-size: var(--ui-fs-lg);
      text-transform: capitalize;
    }
    .day-detail__title ion-icon { vertical-align: middle; font-size: 18px; margin-right: 4px; }
    .day-detail__empty {
      color: var(--ui-text-muted);
      font-size: var(--ui-fs-sm);
      text-align: center;
      padding: var(--ui-sp-3);
    }
    .day-detail__section {
      font-size: var(--ui-fs-sm);
      font-weight: var(--ui-fw-black);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--ui-transit);
      margin: var(--ui-sp-3) 0 var(--ui-sp-2);
    }
    .day-detail__section--deliver { color: var(--ui-success); }
    .day-detail__section ion-icon { vertical-align: middle; font-size: 14px; }

    .task {
      padding: var(--ui-sp-3);
      background: var(--ui-surface-2);
      border-left: 4px solid var(--ui-transit);
      margin-bottom: var(--ui-sp-2);
    }
    .task--deliver { border-left-color: var(--ui-success); }
    .task--overdue { border-left-color: var(--ui-danger); background: var(--ui-danger-tint, #fee); }

    .task__head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: var(--ui-sp-2);
    }
    .task__name {
      font-weight: var(--ui-fw-black);
      font-size: var(--ui-fs-md);
    }
    .task__totals {
      font-size: var(--ui-fs-sm);
      color: var(--ui-text);
      margin-top: 2px;
    }
    .task__sources {
      margin-top: var(--ui-sp-2);
      padding-top: var(--ui-sp-2);
      border-top: var(--ui-border-w-sm) solid var(--ui-border);
    }
    .task__sources-label {
      font-size: var(--ui-fs-xs);
      font-weight: var(--ui-fw-bold);
      color: var(--ui-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      display: block;
      margin-bottom: 4px;
    }
    .task__source {
      display: grid;
      grid-template-columns: 1fr auto 80px;
      gap: var(--ui-sp-2);
      padding: 4px 0;
      font-size: var(--ui-fs-xs);
      border-bottom: var(--ui-border-w-sm) dashed var(--ui-border);
    }
    .task__source:last-child { border-bottom: none; }
    .task__source-name { font-weight: var(--ui-fw-bold); }
    .task__source-qty { text-align: right; }
    .task__source-code {
      color: var(--ui-text-muted);
      text-align: right;
    }
    .task__single {
      margin-top: 4px;
      font-size: var(--ui-fs-xs);
      color: var(--ui-text-muted);
    }
    .task__lead {
      margin-top: 6px;
      font-size: var(--ui-fs-xs);
      color: var(--ui-text-muted);
    }

    /* === Lista cronológica === */
    .list {
      margin: 0 var(--ui-sp-4) var(--ui-sp-8);
      display: flex;
      flex-direction: column;
      gap: var(--ui-sp-2);
    }
    .list-day {
      display: grid;
      grid-template-columns: 110px 1fr;
      gap: var(--ui-sp-3);
      background: var(--ui-surface);
      border: var(--ui-border-w-md) solid var(--ui-border);
      box-shadow: var(--ui-shadow-sm);
      padding: var(--ui-sp-3);
    }
    @media (max-width: 600px) { .list-day { grid-template-columns: 1fr; } }
    .list-day--past { opacity: 0.6; }
    .list-day--today {
      border-color: var(--ui-warning);
      box-shadow: var(--ui-shadow-md);
    }
    .list-day__date {
      border-right: var(--ui-border-w-sm) solid var(--ui-border);
      padding-right: var(--ui-sp-3);
    }
    @media (max-width: 600px) {
      .list-day__date { border-right: none; padding-right: 0; padding-bottom: var(--ui-sp-2); border-bottom: var(--ui-border-w-sm) solid var(--ui-border); }
    }
    .list-day__weekday {
      font-size: var(--ui-fs-xs);
      text-transform: uppercase;
      font-weight: var(--ui-fw-bold);
      color: var(--ui-text-muted);
      letter-spacing: 0.5px;
    }
    .list-day__num {
      font-size: var(--ui-fs-lg);
      font-weight: var(--ui-fw-black);
      color: var(--ui-text);
    }
    .list-day__section {
      margin-bottom: var(--ui-sp-2);
      font-size: var(--ui-fs-sm);
    }
    .list-day__section strong ion-icon { vertical-align: middle; font-size: 12px; }
    .list-day__section ul { list-style: none; padding: 0; margin: 4px 0 0; }
    .list-day__section li {
      padding: 4px 8px;
      background: var(--ui-surface-2);
      margin-bottom: 2px;
      font-size: var(--ui-fs-xs);
    }
    .list-day__section li.task--overdue {
      border-left: 3px solid var(--ui-danger);
    }
    .lot-badge {
      display: inline-block;
      margin-left: 6px;
      padding: 1px 6px;
      background: var(--ui-primary);
      color: var(--ui-primary-contrast);
      font-size: 9px;
      font-weight: var(--ui-fw-black);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
  `],
})
export class PlanificacionPage {
  protected readonly data = inject(DataService);

  readonly view = signal<'calendar' | 'list'>('calendar');
  readonly selectedIso = signal<string>(this.todayIso());

  protected readonly weekdayHeaders = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  /**
   * Tareas agregadas por (producto, fecha de entrega).
   * Optimización: si dos clientes piden el mismo producto el mismo día,
   * se cuentan como UN solo lote a fabricar con cantidad sumada.
   * Incluye TODOS los pedidos abiertos sin filtro de fecha.
   */
  readonly tasks = computed<ProductionTask[]>(() => {
    const todayMs = this.todayMs();
    const map = new Map<string, ProductionTask>();

    for (const o of this.data.orders()) {
      // Solo pedidos NO completados ni cancelados
      if (o.status !== 'in_production' && o.status !== 'pending') continue;

      const customer = o.customerId ? this.data.customerById(o.customerId) : null;

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
          customerName: customer?.name ?? null,
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

  /** Grid de calendario con padding inicial según día de la semana. */
  readonly calendarSlots = computed<(DayBucket | null)[]>(() => {
    const days = this.days();
    if (days.length === 0) return [];
    const slots: (DayBucket | null)[] = [];
    const first = days[0].date;
    const firstWeekday = (first.getDay() + 6) % 7; // lunes-first
    for (let i = 0; i < firstWeekday; i++) slots.push(null);
    slots.push(...days);
    return slots;
  });

  readonly firstDay = computed(() => this.days()[0]?.date);
  readonly lastDay = computed(() => this.days()[this.days().length - 1]?.date);

  readonly totalTasks = computed(() => this.tasks().length);
  readonly totalUnits = computed(() => this.tasks().reduce((s, t) => s + t.totalQty, 0));
  readonly todayStarting = computed(() => this.days()[0]?.starting.length ?? 0);
  readonly overdueTasks = computed(() => this.tasks().filter(t => t.overdue).length);

  readonly selectedBucket = computed<DayBucket | null>(() => {
    const iso = this.selectedIso();
    return this.days().find(b => b.iso === iso) ?? null;
  });

  selectDay(iso: string) {
    this.selectedIso.set(iso);
  }

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
