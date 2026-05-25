import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
  IonSegment, IonSegmentButton, IonLabel, IonButton, IonIcon,
} from '@ionic/angular/standalone';
import { DataService } from '../../core/services/data.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { PedidoDetailModalComponent } from '../pedidos/pedido-detail-modal.component';
import { CustomerOrder, OrderShortfall, OrderStatus } from '../../core/models';

type Tab = 'all' | 'pending' | 'in_production';

@Component({
  selector: 'app-produccion',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, DecimalPipe, RouterLink,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
    IonSegment, IonSegmentButton, IonLabel, IonButton, IonIcon,
    PageHeaderComponent, KpiCardComponent, PedidoDetailModalComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-menu-button></ion-menu-button></ion-buttons>
        <ion-title>Pedidos de clientes</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <app-page-header
        title="Pedidos de clientes"
        subtitle="Peticiones que los clientes envían desde el portal. Acepta cada pedido para iniciar producción.">
        <ion-button fill="outline" routerLink="/clientes">Ver clientes</ion-button>
        <ion-button fill="outline" routerLink="/insumos">Ver insumos</ion-button>
      </app-page-header>

      
      <div class="kpis">
        <app-kpi-card label="Pendientes" [value]="data.pendingOrders().length" tone="warning"></app-kpi-card>
        <app-kpi-card label="En producción" [value]="data.inProductionOrders().length" tone="transit"></app-kpi-card>
        <app-kpi-card label="Completadas (hoy)" [value]="completedTodayCount()" tone="success"></app-kpi-card>
        <app-kpi-card label="Faltantes globales" [value]="totalShortfallItems()" tone="danger"
          [hint]="totalShortfallItems() > 0 ? 'insumos a reponer' : 'todo cubierto'"></app-kpi-card>
      </div>

      @if (globalShortfalls().length > 0) {
        <div class="global-shortfalls">
          <div class="global-shortfalls__head">
            <strong><ion-icon name="warning-outline"></ion-icon> Faltantes acumulados (todas las órdenes en producción)</strong>
            <a routerLink="/ordenes-compra" class="link">→ Crear orden de compra</a>
          </div>
          <div class="global-shortfalls__list">
            @for (sf of globalShortfalls(); track sf.itemId) {
              <div class="global-shortfalls__row">
                <span>{{ sf.itemName }} <small>({{ sf.kind === 'supply' ? 'insumo' : 'producto' }})</small></span>
                <span class="mono short">Faltan {{ sf.short | number:'1.0-3' }} {{ sf.unit }}</span>
              </div>
            }
          </div>
        </div>
      }

      <div class="tabs">
        <ion-segment [value]="tab()" (ionChange)="tab.set($any($event.detail.value))">
          <ion-segment-button value="all"><ion-label>Todas ({{ data.openOrders().length }})</ion-label></ion-segment-button>
          <ion-segment-button value="pending"><ion-label>Pendientes</ion-label></ion-segment-button>
          <ion-segment-button value="in_production"><ion-label>En producción</ion-label></ion-segment-button>
        </ion-segment>
      </div>

      @if (visibles().length === 0) {
        <div class="empty">
          <h3>No hay órdenes en esta vista</h3>
          <p>Las órdenes generadas por ventas aparecen aquí para que producción las procese.</p>
        </div>
      }

      <div class="cards">
        @for (o of visibles(); track o.id) {
          <button class="card" (click)="openDetail(o)" [attr.data-status]="o.status">
            <div class="card__head">
              <div>
                <div class="card__code mono">{{ o.code }}</div>
                <div class="card__purpose">
                  @if (customerNameOf(o); as cname) {
                    <ion-icon name="person-outline"></ion-icon> {{ cname }}
                  } @else {
                    {{ o.purpose || 'Pedido interno' }}
                  }
                </div>
              </div>
              <span class="status" [attr.data-status]="o.status">{{ statusLabel(o.status) }}</span>
            </div>

            <!-- Bloque de fechas: ingreso vs entrega -->
            <div class="dates">
              <div class="date-cell">
                <div class="date-cell__label">
                  <ion-icon name="time-outline"></ion-icon> Ingreso
                </div>
                <div class="date-cell__value mono">{{ o.createdAt | date:'dd-MM-yyyy' }}</div>
                <div class="date-cell__sub mono">{{ o.createdAt | date:'HH:mm' }}</div>
              </div>
              <div class="date-cell date-cell--delivery"
                [class.date-cell--overdue]="isOverdue(o)"
                [class.date-cell--soon]="isSoon(o)">
                <div class="date-cell__label">
                  <ion-icon name="calendar-outline"></ion-icon> Entrega
                </div>
                @if (o.requestedDeliveryDate) {
                  <div class="date-cell__value mono">{{ o.requestedDeliveryDate | date:'dd-MM-yyyy' }}</div>
                  <div class="date-cell__sub mono">{{ deliveryHint(o) }}</div>
                } @else {
                  <div class="date-cell__value muted">Sin fecha</div>
                  <div class="date-cell__sub">—</div>
                }
              </div>
            </div>

            <div class="card__items">
              @for (it of o.items; track it.productId) {
                <div class="line">
                  <span class="line__name">{{ it.productName }}</span>
                  <span class="line__qty mono"
                    [class.warn]="it.fulfilledQty < it.qty && o.status !== 'pending'">
                    @if (o.status === 'pending') {
                      {{ it.qty }} {{ it.unit }}
                    } @else {
                      {{ it.fulfilledQty }}/{{ it.qty }} {{ it.unit }}
                    }
                  </span>
                </div>
              }
            </div>

            @if (o.shortfalls.length > 0) {
              <div class="card__alert">
                <ion-icon name="warning-outline"></ion-icon> Faltan {{ o.shortfalls.length }} insumo(s): {{ shortNames(o) }}
              </div>
            }

            <div class="card__foot">
              <span class="cta">
                @switch (o.status) {
                  @case ('pending') { Iniciar → }
                  @case ('in_production') { Completar → }
                }
              </span>
            </div>
          </button>
        }
      </div>

      <app-pedido-detail-modal
        [isOpen]="detailOpen()"
        [order]="selected()"
        (closed)="closeDetail()"
        (mutated)="onMutated()">
      </app-pedido-detail-modal>
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

    .global-shortfalls {
      margin: 0 var(--ui-sp-4) var(--ui-sp-4);
      border: var(--ui-border-w-md) solid var(--ui-border);
      background: var(--ui-surface);
      box-shadow: var(--ui-shadow-md);
    }
    .global-shortfalls__head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--ui-sp-3) var(--ui-sp-4);
      background: var(--ui-danger);
      color: #fff;
      gap: var(--ui-sp-3);
    }
    .link {
      color: #fff;
      text-decoration: underline;
      font-weight: var(--ui-fw-bold);
      font-size: var(--ui-fs-sm);
    }
    .global-shortfalls__list { padding: var(--ui-sp-2) var(--ui-sp-4); }
    .global-shortfalls__row {
      display: flex;
      justify-content: space-between;
      padding: var(--ui-sp-2) 0;
      border-bottom: var(--ui-border-w-sm) solid var(--ui-border);
      font-size: var(--ui-fs-sm);
    }
    .global-shortfalls__row:last-child { border-bottom: none; }
    .short { color: var(--ui-danger); font-weight: var(--ui-fw-black); }

    .tabs { padding: 0 var(--ui-sp-4) var(--ui-sp-3); }

    .empty {
      margin: var(--ui-sp-4);
      padding: var(--ui-sp-6) var(--ui-sp-4);
      text-align: center;
      background: var(--ui-surface-2);
      border: var(--ui-border-w-md) dashed var(--ui-border);
    }
    .empty h3 { margin: 0 0 var(--ui-sp-2); font-size: var(--ui-fs-lg); }
    .empty p { margin: 0; color: var(--ui-text-muted); font-size: var(--ui-fs-sm); }

    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: var(--ui-sp-3);
      padding: 0 var(--ui-sp-4) var(--ui-sp-8);
    }
    .card {
      text-align: left;
      background: var(--ui-surface);
      border: var(--ui-border-w-md) solid var(--ui-border);
      box-shadow: var(--ui-shadow-md);
      padding: var(--ui-sp-3);
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: var(--ui-sp-2);
      font-family: var(--ui-font-sans);
      color: var(--ui-text);
    }
    .card:hover { background: var(--ui-surface-2); }
    .card:active { box-shadow: none; transform: translate(2px, 2px); }
    .card[data-status="pending"]       { border-left: 6px solid var(--ui-warning); }
    .card[data-status="in_production"] { border-left: 6px solid var(--ui-transit); }

    .card__head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: var(--ui-sp-2);
    }
    .card__code {
      font-size: var(--ui-fs-xs);
      color: var(--ui-text-muted);
      font-weight: var(--ui-fw-bold);
    }
    .card__purpose {
      font-weight: var(--ui-fw-black);
      font-size: var(--ui-fs-md);
      margin-top: 2px;
    }
    .card__purpose ion-icon { vertical-align: middle; font-size: 14px; color: var(--ui-primary); }
    .card__delivery {
      font-size: var(--ui-fs-xs);
      color: var(--ui-text-muted);
      margin-top: 2px;
    }
    .card__delivery ion-icon { vertical-align: middle; font-size: 12px; }
    .status {
      padding: 3px 8px;
      font-size: 10px;
      font-weight: var(--ui-fw-black);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border: var(--ui-border-w-sm) solid var(--ui-border);
      background: var(--ui-surface);
      flex-shrink: 0;
    }
    .status[data-status="pending"]       { background: var(--ui-warning); color: #000; }
    .status[data-status="in_production"] { background: var(--ui-transit); color: #fff; }

    /* === Bloque de fechas (ingreso / entrega) === */
    .dates {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1px;
      background: var(--ui-border);
      border: var(--ui-border-w-sm) solid var(--ui-border);
    }
    .date-cell {
      background: var(--ui-surface-2);
      padding: 6px 8px;
      display: flex; flex-direction: column;
      gap: 1px;
    }
    .date-cell__label {
      display: flex; align-items: center; gap: 4px;
      font-size: 10px;
      font-weight: var(--ui-fw-black);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--ui-text-muted);
    }
    .date-cell__label ion-icon { font-size: 11px; }
    .date-cell__value {
      font-size: var(--ui-fs-sm);
      font-weight: var(--ui-fw-black);
      color: var(--ui-text);
    }
    .date-cell__value.muted { color: var(--ui-text-muted); font-style: italic; font-weight: var(--ui-fw-bold); }
    .date-cell__sub {
      font-size: 10px;
      color: var(--ui-text-muted);
    }
    .date-cell--delivery { background: var(--ui-surface); }
    .date-cell--soon {
      background: var(--ui-warning);
      color: #000;
    }
    .date-cell--soon .date-cell__label,
    .date-cell--soon .date-cell__value,
    .date-cell--soon .date-cell__sub { color: #000; }
    .date-cell--overdue {
      background: var(--ui-danger);
      color: #fff;
    }
    .date-cell--overdue .date-cell__label,
    .date-cell--overdue .date-cell__value,
    .date-cell--overdue .date-cell__sub { color: #fff; }

    .card__items {
      display: grid;
      gap: 4px;
      font-size: var(--ui-fs-sm);
    }
    .line {
      display: flex;
      justify-content: space-between;
      gap: var(--ui-sp-2);
    }
    .line__name { color: var(--ui-text); }
    .line__qty { color: var(--ui-text-muted); }
    .line__qty.warn { color: var(--ui-danger); font-weight: var(--ui-fw-black); }

    .card__alert {
      font-size: var(--ui-fs-xs);
      color: var(--ui-danger);
      font-weight: var(--ui-fw-bold);
      padding: 6px 8px;
      background: var(--ui-surface-2);
      border-left: 3px solid var(--ui-danger);
    }
    .card__alert ion-icon { vertical-align: middle; font-size: 14px; }
    .global-shortfalls__head ion-icon { vertical-align: middle; font-size: 18px; }

    .card__foot {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: var(--ui-fs-sm);
      padding-top: var(--ui-sp-2);
      border-top: var(--ui-border-w-sm) solid var(--ui-border);
    }
    .cta {
      font-weight: var(--ui-fw-black);
      color: var(--ui-primary);
      font-size: var(--ui-fs-sm);
    }
  `],
})
export class ProduccionPage {
  protected readonly data = inject(DataService);
  readonly tab = signal<Tab>('all');
  readonly detailOpen = signal(false);
  readonly selected = signal<CustomerOrder | null>(null);

  readonly visibles = computed(() => {
    const t = this.tab();
    const open = [...this.data.openOrders()].sort((a, b) =>
      this.statusRank(a.status) - this.statusRank(b.status) ||
      a.createdAt.getTime() - b.createdAt.getTime()
    );
    if (t === 'all') return open;
    return open.filter(o => o.status === t);
  });

  /** Faltantes consolidados de todos los pedidos en producción. */
  readonly globalShortfalls = computed(() => {
    const map = new Map<string, OrderShortfall>();
    for (const o of this.data.inProductionOrders()) {
      for (const sf of o.shortfalls) {
        const key = `${sf.kind}:${sf.itemId}`;
        const prev = map.get(key);
        if (prev) {
          map.set(key, { ...prev, required: prev.required + sf.required, short: prev.short + sf.short });
        } else {
          map.set(key, { ...sf });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.short - a.short);
  });

  readonly totalShortfallItems = computed(() => this.globalShortfalls().length);

  readonly completedTodayCount = computed(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return this.data.completedOrders().filter(o => (o.completedAt?.getTime() ?? 0) >= cutoff).length;
  });

  private statusRank(s: OrderStatus): number {
    return { pending: 0, in_production: 1, completed: 2, cancelled: 3 }[s];
  }

  statusLabel(s: OrderStatus): string {
    return {
      pending: 'Pendiente',
      in_production: 'En producción',
      completed: 'Completada',
      cancelled: 'Cancelada',
    }[s];
  }

  shortNames(o: CustomerOrder): string {
    const names = o.shortfalls.slice(0, 3).map(s => s.itemName).join(', ');
    return o.shortfalls.length > 3 ? `${names}…` : names;
  }

  /** Nombre del cliente si el pedido vino del portal, sino null. */
  customerNameOf(o: CustomerOrder): string | null {
    if (!o.customerId) return null;
    return this.data.customerById(o.customerId)?.name ?? null;
  }

  /** Días entre hoy y la fecha de entrega (negativo si ya pasó). */
  private daysToDelivery(o: CustomerOrder): number | null {
    if (!o.requestedDeliveryDate) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const target = new Date(o.requestedDeliveryDate); target.setHours(0, 0, 0, 0);
    return Math.round((target.getTime() - today.getTime()) / 86_400_000);
  }

  isOverdue(o: CustomerOrder): boolean {
    const d = this.daysToDelivery(o);
    return d !== null && d < 0;
  }
  isSoon(o: CustomerOrder): boolean {
    const d = this.daysToDelivery(o);
    return d !== null && d >= 0 && d <= 1;
  }
  deliveryHint(o: CustomerOrder): string {
    const d = this.daysToDelivery(o);
    if (d === null) return '';
    if (d === 0) return 'HOY';
    if (d === 1) return 'mañana';
    if (d < 0) return `hace ${-d} día(s)`;
    return `en ${d} día(s)`;
  }

  openDetail(o: CustomerOrder) {
    this.selected.set(o);
    this.detailOpen.set(true);
  }

  closeDetail() {
    this.detailOpen.set(false);
    this.selected.set(null);
  }

  onMutated() {
    const id = this.selected()?.id;
    if (id) {
      const refreshed = this.data.orderById(id);
      this.selected.set(refreshed ?? null);
      // Si la orden salió del flujo abierto (completed/cancelled), cerrar el modal
      if (!refreshed || refreshed.status === 'completed' || refreshed.status === 'cancelled') {
        this.closeDetail();
      }
    }
  }
}
