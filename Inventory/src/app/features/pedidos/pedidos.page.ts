import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
  IonButton, IonSegment, IonSegmentButton, IonLabel, IonIcon,
} from '@ionic/angular/standalone';
import { DataService } from '../../core/services/data.service';
import { TenantContextService } from '../../core/services/tenant-context.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { PedidoFormModalComponent } from './pedido-form-modal.component';
import { PedidoDetailModalComponent } from './pedido-detail-modal.component';
import { ReadOnlyBannerComponent } from '../../shared/components/readonly-banner/readonly-banner.component';
import { CustomerOrder, OrderStatus } from '../../core/models';

type Tab = 'open' | 'completed' | 'cancelled' | 'all';

@Component({
  selector: 'app-pedidos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, DecimalPipe,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
    IonButton, IonSegment, IonSegmentButton, IonLabel, IonIcon,
    PageHeaderComponent, KpiCardComponent,
    PedidoFormModalComponent, PedidoDetailModalComponent, ReadOnlyBannerComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-menu-button></ion-menu-button></ion-buttons>
        <ion-title>Órdenes de producción</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <app-page-header
        title="Órdenes de producción"
        subtitle="Ventas crea órdenes para organizar el trabajo de Producción. Al completarse, los productos quedan disponibles en stock.">
        @if (tenant.canCreateOrder()) {
          <ion-button (click)="openForm()">+ Nueva orden</ion-button>
        }
      </app-page-header>

      <app-readonly-banner></app-readonly-banner>

      <div class="kpis">
        <app-kpi-card label="Pendientes" [value]="data.pendingOrders().length" tone="warning"></app-kpi-card>
        <app-kpi-card label="En producción" [value]="data.inProductionOrders().length" tone="transit"></app-kpi-card>
        <app-kpi-card label="Completadas (hoy)" [value]="completedTodayCount()" tone="success"></app-kpi-card>
        <app-kpi-card label="Total programado" [value]="'₡' + (totalAbiertos() | number:'1.0-0')" tone="primary"
          hint="valor potencial de venta"></app-kpi-card>
      </div>

      <div class="tabs">
        <ion-segment [value]="tab()" (ionChange)="tab.set($any($event.detail.value))">
          <ion-segment-button value="open"><ion-label>Abiertas ({{ openCount() }})</ion-label></ion-segment-button>
          <ion-segment-button value="completed"><ion-label>Completadas</ion-label></ion-segment-button>
          <ion-segment-button value="cancelled"><ion-label>Canceladas</ion-label></ion-segment-button>
          <ion-segment-button value="all"><ion-label>Todas</ion-label></ion-segment-button>
        </ion-segment>
      </div>

      @if (visibles().length === 0) {
        <div class="empty">
          <h3>No hay órdenes en esta vista</h3>
          @if (tenant.canCreateOrder()) {
            <p>Crea una orden para enviar trabajo a producción.</p>
          } @else {
            <p>Cuando ventas cree órdenes aparecerán aquí.</p>
          }
        </div>
      }

      <div class="cards">
        @for (o of visibles(); track o.id) {
          <button class="card" (click)="openDetail(o)">
            <div class="card__head">
              <div>
                <div class="card__code mono">{{ o.code }}</div>
                <div class="card__purpose">{{ o.purpose || 'Sin motivo' }}</div>
              </div>
              <span class="status" [attr.data-status]="o.status">{{ statusLabel(o.status) }}</span>
            </div>
            <div class="card__items">
              {{ o.items.length }} producto(s) ·
              {{ totalUnits(o) }} unidades
              @if (hasPartial(o)) {
                <span class="parcial">parcial</span>
              }
            </div>
            <div class="card__foot">
              <span class="mono">{{ o.createdAt | date:'dd-MM HH:mm' }}</span>
              <span class="mono total">₡{{ o.totalAmount | number:'1.0-0' }}</span>
            </div>
            @if (o.shortfalls.length > 0 && o.status !== 'completed' && o.status !== 'cancelled') {
              <div class="card__alert"><ion-icon name="warning-outline"></ion-icon> {{ o.shortfalls.length }} faltante(s) de insumo</div>
            }
          </button>
        }
      </div>

      <app-pedido-form-modal
        [isOpen]="formOpen()"
        (closed)="formOpen.set(false)"
        (saved)="formOpen.set(false)">
      </app-pedido-form-modal>

      <app-pedido-detail-modal
        [isOpen]="detailOpen()"
        [order]="selected()"
        mode="sales"
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
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
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
    .card__items {
      font-size: var(--ui-fs-sm);
      color: var(--ui-text-muted);
    }
    .card__foot {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: var(--ui-fs-sm);
      padding-top: var(--ui-sp-2);
      border-top: var(--ui-border-w-sm) solid var(--ui-border);
    }
    .total {
      font-weight: var(--ui-fw-black);
      font-size: var(--ui-fs-md);
    }
    .card__alert {
      font-size: var(--ui-fs-xs);
      font-weight: var(--ui-fw-bold);
      color: var(--ui-danger);
    }
    .card__alert ion-icon { vertical-align: middle; font-size: 14px; }

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
    .status[data-status="completed"]     { background: var(--ui-success); color: #fff; }
    .status[data-status="cancelled"]     { background: var(--ui-danger); color: #fff; }

    .parcial {
      display: inline-block;
      font-size: 9px;
      background: var(--ui-warning);
      color: #000;
      padding: 1px 4px;
      margin-left: 4px;
      font-weight: var(--ui-fw-black);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
  `],
})
export class PedidosPage {
  protected readonly data = inject(DataService);
  protected readonly tenant = inject(TenantContextService);
  readonly tab = signal<Tab>('open');
  readonly formOpen = signal(false);
  readonly detailOpen = signal(false);
  readonly selected = signal<CustomerOrder | null>(null);

  readonly visibles = computed(() => {
    const t = this.tab();
    const all = [...this.data.orders()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    if (t === 'all') return all;
    if (t === 'completed') return all.filter(o => o.status === 'completed');
    if (t === 'cancelled') return all.filter(o => o.status === 'cancelled');
    return all.filter(o => o.status === 'pending' || o.status === 'in_production');
  });

  readonly openCount = computed(() => this.data.openOrders().length);

  readonly totalAbiertos = computed(() =>
    this.data.openOrders().reduce((s, o) => s + o.totalAmount, 0)
  );

  readonly completedTodayCount = computed(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return this.data.completedOrders().filter(o => (o.completedAt?.getTime() ?? 0) >= cutoff).length;
  });

  statusLabel(s: OrderStatus): string {
    return {
      pending: 'Pendiente',
      in_production: 'En producción',
      completed: 'Completada',
      cancelled: 'Cancelada',
    }[s];
  }

  totalUnits(o: CustomerOrder): number {
    return o.items.reduce((s, it) => s + it.qty, 0);
  }

  hasPartial(o: CustomerOrder): boolean {
    if (o.status !== 'in_production' && o.status !== 'completed') return false;
    return o.items.some(it => it.fulfilledQty < it.qty);
  }

  openForm() {
    this.formOpen.set(true);
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
    // Re-sincroniza la orden seleccionada con la versión actual del store
    const id = this.selected()?.id;
    if (id) {
      const refreshed = this.data.orderById(id);
      this.selected.set(refreshed ?? null);
    }
  }
}
