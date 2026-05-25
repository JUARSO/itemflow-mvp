import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
  IonButton, IonIcon,
} from '@ionic/angular/standalone';
import { DataService } from '../../core/services/data.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { CustomerOrder, OrderItem } from '../../core/models';

type ReceptionFilter = 'all' | 'awaiting' | 'received' | 'returned';

/**
 * Historial de pedidos completados. Lista todos los pedidos en estado
 * `completed` (entregados desde producción) con su estado de recepción
 * (Por recibir / Recibido OK / Con devolución) y permite filtrar por
 * rango de fechas, cliente y estado.
 */
@Component({
  selector: 'app-historial-pedidos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, DecimalPipe,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
    IonButton, IonIcon,
    PageHeaderComponent, KpiCardComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-menu-button></ion-menu-button></ion-buttons>
        <ion-title>Historial de pedidos</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <app-page-header
        title="Historial de pedidos"
        subtitle="Pedidos completados, con estado de recepción del cliente y registro de devoluciones.">
        @if (hasActiveFilters()) {
          <ion-button fill="outline" (click)="clearFilters()">Limpiar filtros</ion-button>
        }
      </app-page-header>

      <div class="kpis">
        <app-kpi-card label="Total completados"
          [value]="filtered().length"
          tone="primary"
          [hint]="hasActiveFilters() ? 'con filtros aplicados' : 'todos los pedidos'"></app-kpi-card>
        <app-kpi-card label="Por recibir"
          [value]="awaitingCount()"
          tone="warning"
          hint="esperando confirmación"></app-kpi-card>
        <app-kpi-card label="Con devolución"
          [value]="returnedCount()"
          tone="danger"
          hint="cliente reportó diferencia"></app-kpi-card>
        <app-kpi-card label="Monto final"
          [value]="totalFinalLabel()"
          tone="success"
          hint="confirmado por clientes"></app-kpi-card>
      </div>

      <!-- Filtros -->
      <div class="filters">
        <div class="filter">
          <label>Desde</label>
          <input type="date"
            [value]="fromDate()"
            (change)="fromDate.set($any($event.target).value)" />
        </div>
        <div class="filter">
          <label>Hasta</label>
          <input type="date"
            [value]="toDate()"
            (change)="toDate.set($any($event.target).value)" />
        </div>
        <div class="filter">
          <label>Cliente</label>
          <select [value]="customerFilter()"
            (change)="customerFilter.set($any($event.target).value)">
            <option value="">Todos los clientes</option>
            <option value="__internal__">Sin cliente (interno)</option>
            @for (c of data.customers(); track c.id) {
              <option [value]="c.id">{{ c.name }}</option>
            }
          </select>
        </div>
        <div class="filter">
          <label>Estado de recepción</label>
          <select [value]="receptionFilter()"
            (change)="receptionFilter.set($any($event.target).value)">
            <option value="all">Todos</option>
            <option value="awaiting">Por recibir</option>
            <option value="received">Recibido OK</option>
            <option value="returned">Con devolución</option>
          </select>
        </div>
        <div class="filter">
          <label>Código / cliente</label>
          <input type="search"
            placeholder="Buscar…"
            [value]="search()"
            (input)="search.set($any($event.target).value)" />
        </div>
      </div>

      @if (filtered().length === 0) {
        <div class="empty">
          <h3>No hay pedidos completados</h3>
          <p>
            @if (hasActiveFilters()) {
              Ningún pedido coincide con los filtros aplicados. Ajusta o limpia los filtros.
            } @else {
              Los pedidos que producción complete aparecerán aquí con su estado de recepción.
            }
          </p>
        </div>
      } @else {
        <div class="cards">
          @for (o of filtered(); track o.id) {
            <article class="card"
              [attr.data-reception]="receptionState(o)">
              <header class="card__head">
                <div>
                  <div class="card__code mono">{{ o.code }}</div>
                  <div class="card__customer">
                    @if (customerNameOf(o); as cname) {
                      <ion-icon name="person-outline"></ion-icon> {{ cname }}
                    } @else {
                      <span class="muted">Pedido interno</span>
                    }
                  </div>
                  <div class="card__dates">
                    @if (o.requestedDeliveryDate) {
                      <span><ion-icon name="calendar-outline"></ion-icon> Entrega: {{ o.requestedDeliveryDate | date:'dd-MM-yyyy' }}</span>
                    }
                    <span>Completado: {{ o.completedAt | date:'dd-MM-yyyy HH:mm' }}</span>
                    @if (o.customerConfirmedAt) {
                      <span>Confirmado: {{ o.customerConfirmedAt | date:'dd-MM-yyyy HH:mm' }}</span>
                    }
                  </div>
                </div>
                <span class="status" [attr.data-status]="receptionState(o)">
                  {{ receptionLabel(o) }}
                </span>
              </header>

              <table class="t">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th class="num">Pedido</th>
                    <th class="num">Producido</th>
                    <th class="num">Recibido</th>
                    <th class="num">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  @for (it of o.items; track it.productId) {
                    <tr [class.row-diff]="hasReceptionDiff(it)">
                      <td>{{ it.productName }}</td>
                      <td class="num mono">{{ it.qty }} {{ it.unit }}</td>
                      <td class="num mono">{{ it.fulfilledQty }} {{ it.unit }}</td>
                      <td class="num mono">
                        @if (o.customerConfirmedAt) {
                          {{ it.receivedQty ?? 0 }} {{ it.unit }}
                        } @else {
                          <span class="muted">—</span>
                        }
                      </td>
                      <td class="num mono">
                        ₡{{ subtotalFor(o, it) | number:'1.0-0' }}
                      </td>
                    </tr>
                  }
                </tbody>
              </table>

              @if (hasAnyDiff(o)) {
                <div class="alert alert--return">
                  <ion-icon name="arrow-undo-outline"></ion-icon>
                  Devolución: {{ totalReturned(o) }} unidad(es) volvieron al inventario
                </div>
              }

              @if (o.customerNote) {
                <div class="note">
                  <strong>Nota del cliente:</strong> {{ o.customerNote }}
                </div>
              }

              <footer class="card__foot">
                <span class="muted">Total original</span>
                <span class="mono">₡{{ o.totalAmount | number:'1.0-0' }}</span>
                @if (o.customerConfirmedAt) {
                  <span class="sep">·</span>
                  <span>Total final</span>
                  <strong class="mono">₡{{ (o.finalAmount ?? o.totalAmount) | number:'1.0-0' }}</strong>
                  @if ((o.finalAmount ?? o.totalAmount) < o.totalAmount) {
                    <span class="diff mono">
                      −₡{{ (o.totalAmount - (o.finalAmount ?? 0)) | number:'1.0-0' }}
                    </span>
                  }
                }
              </footer>
            </article>
          }
        </div>
      }
    </ion-content>
  `,
  styles: [`
    .kpis {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: var(--ui-sp-3);
      padding: 0 var(--ui-sp-4) var(--ui-sp-3);
    }
    @media (max-width: 900px) { .kpis { grid-template-columns: 1fr 1fr; } }
    @media (max-width: 480px) { .kpis { grid-template-columns: 1fr; } }

    .filters {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: var(--ui-sp-2);
      padding: 0 var(--ui-sp-4) var(--ui-sp-3);
    }
    @media (max-width: 1100px) { .filters { grid-template-columns: repeat(3, 1fr); } }
    @media (max-width: 700px)  { .filters { grid-template-columns: 1fr 1fr; } }
    @media (max-width: 480px)  { .filters { grid-template-columns: 1fr; } }

    .filter {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .filter label {
      font-size: var(--ui-fs-xs);
      font-weight: var(--ui-fw-black);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--ui-text-muted);
    }
    .filter input,
    .filter select {
      padding: 8px 10px;
      border: var(--ui-border-w-md) solid var(--ui-border);
      background: var(--ui-surface);
      font-family: var(--ui-font-sans);
      font-size: var(--ui-fs-sm);
      color: var(--ui-text);
    }
    .filter input:focus,
    .filter select:focus {
      outline: 2px solid var(--ui-primary);
      outline-offset: -2px;
    }

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
      grid-template-columns: 1fr;
      gap: var(--ui-sp-3);
      padding: 0 var(--ui-sp-4) var(--ui-sp-8);
    }
    @media (min-width: 1200px) {
      .cards { grid-template-columns: 1fr 1fr; }
    }

    .card {
      background: var(--ui-surface);
      border: var(--ui-border-w-md) solid var(--ui-border);
      box-shadow: var(--ui-shadow-md);
      padding: var(--ui-sp-3);
      display: flex;
      flex-direction: column;
      gap: var(--ui-sp-2);
      border-left: 6px solid var(--ui-success);
    }
    .card[data-reception="awaiting"] { border-left-color: var(--ui-warning); }
    .card[data-reception="returned"] { border-left-color: var(--ui-danger); }

    .card__head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: var(--ui-sp-2);
      flex-wrap: wrap;
    }
    .card__code {
      font-size: var(--ui-fs-xs);
      color: var(--ui-text-muted);
      font-weight: var(--ui-fw-bold);
    }
    .card__customer {
      font-weight: var(--ui-fw-black);
      font-size: var(--ui-fs-md);
      margin-top: 2px;
    }
    .card__customer ion-icon { vertical-align: middle; font-size: 14px; color: var(--ui-primary); }
    .card__customer .muted { font-style: italic; color: var(--ui-text-muted); font-weight: var(--ui-fw-bold); }
    .card__dates {
      display: flex;
      gap: var(--ui-sp-2);
      flex-wrap: wrap;
      font-size: var(--ui-fs-xs);
      color: var(--ui-text-muted);
      margin-top: 4px;
    }
    .card__dates ion-icon { vertical-align: middle; font-size: 12px; }

    .status {
      padding: 4px 10px;
      font-size: 10px;
      font-weight: var(--ui-fw-black);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border: var(--ui-border-w-sm) solid var(--ui-border);
      background: var(--ui-surface);
      flex-shrink: 0;
      white-space: nowrap;
    }
    .status[data-status="awaiting"]  { background: var(--ui-warning); color: #000; }
    .status[data-status="received"]  { background: var(--ui-success); color: #fff; }
    .status[data-status="returned"]  { background: var(--ui-danger); color: #fff; }

    .t {
      width: 100%;
      border-collapse: collapse;
      font-size: var(--ui-fs-xs);
    }
    .t th, .t td {
      padding: 6px 8px;
      border-bottom: var(--ui-border-w-sm) solid var(--ui-border);
      text-align: left;
    }
    .t thead th {
      background: var(--ui-text);
      color: var(--ui-surface);
      font-weight: var(--ui-fw-black);
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .t .num { text-align: right; }
    .t .muted { color: var(--ui-text-muted); }
    .t .row-diff { background: var(--ui-danger-tint, #fee); }
    .t .row-diff td { color: var(--ui-danger); font-weight: var(--ui-fw-bold); }

    .alert {
      font-size: var(--ui-fs-xs);
      font-weight: var(--ui-fw-bold);
      padding: 6px 8px;
      background: var(--ui-surface-2);
      border-left: 3px solid var(--ui-danger);
      color: var(--ui-danger);
    }
    .alert ion-icon { vertical-align: middle; font-size: 14px; }

    .note {
      font-size: var(--ui-fs-xs);
      color: var(--ui-text);
      padding: 6px 8px;
      background: var(--ui-surface-2);
      font-style: italic;
    }

    .card__foot {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      padding-top: var(--ui-sp-2);
      border-top: var(--ui-border-w-sm) solid var(--ui-border);
      font-size: var(--ui-fs-sm);
    }
    .card__foot .muted { color: var(--ui-text-muted); font-size: var(--ui-fs-xs); }
    .card__foot .sep { color: var(--ui-text-muted); margin: 0 4px; }
    .card__foot .diff {
      color: var(--ui-danger);
      font-weight: var(--ui-fw-black);
      font-size: var(--ui-fs-xs);
    }
  `],
})
export class HistorialPedidosPage {
  protected readonly data = inject(DataService);

  readonly fromDate = signal('');
  readonly toDate = signal('');
  readonly customerFilter = signal('');
  readonly receptionFilter = signal<ReceptionFilter>('all');
  readonly search = signal('');

  /** Pedidos completados que pasan los filtros, más recientes primero. */
  readonly filtered = computed(() => {
    const from = this.parseDateStart(this.fromDate());
    const to = this.parseDateEnd(this.toDate());
    const cust = this.customerFilter();
    const recep = this.receptionFilter();
    const q = this.search().trim().toLowerCase();

    return [...this.data.completedOrders()]
      .filter(o => {
        const refDate = (o.completedAt ?? o.createdAt).getTime();
        if (from !== null && refDate < from) return false;
        if (to !== null && refDate > to) return false;

        if (cust) {
          if (cust === '__internal__') {
            if (o.customerId) return false;
          } else {
            if (o.customerId !== cust) return false;
          }
        }

        if (recep !== 'all' && this.receptionState(o) !== recep) return false;

        if (q) {
          const cname = this.customerNameOf(o)?.toLowerCase() ?? '';
          if (!o.code.toLowerCase().includes(q) && !cname.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) =>
        (b.completedAt?.getTime() ?? b.createdAt.getTime()) -
        (a.completedAt?.getTime() ?? a.createdAt.getTime())
      );
  });

  readonly hasActiveFilters = computed(() =>
    !!this.fromDate() || !!this.toDate() || !!this.customerFilter() ||
    this.receptionFilter() !== 'all' || !!this.search().trim()
  );

  readonly awaitingCount = computed(() =>
    this.filtered().filter(o => this.receptionState(o) === 'awaiting').length
  );

  readonly returnedCount = computed(() =>
    this.filtered().filter(o => this.receptionState(o) === 'returned').length
  );

  readonly totalFinalAmount = computed(() =>
    this.filtered().reduce((sum, o) =>
      sum + (o.customerConfirmedAt ? (o.finalAmount ?? o.totalAmount) : 0), 0
    )
  );

  readonly totalFinalLabel = computed(() => {
    const v = this.totalFinalAmount();
    return v >= 1_000_000
      ? '₡' + (v / 1_000_000).toFixed(1) + 'M'
      : '₡' + new Intl.NumberFormat('es-CR', { maximumFractionDigits: 0 }).format(v);
  });

  clearFilters() {
    this.fromDate.set('');
    this.toDate.set('');
    this.customerFilter.set('');
    this.receptionFilter.set('all');
    this.search.set('');
  }

  customerNameOf(o: CustomerOrder): string | null {
    if (!o.customerId) return null;
    return this.data.customerById(o.customerId)?.name ?? null;
  }

  receptionState(o: CustomerOrder): 'awaiting' | 'received' | 'returned' {
    if (!o.customerConfirmedAt) return 'awaiting';
    return this.hasAnyDiff(o) ? 'returned' : 'received';
  }

  receptionLabel(o: CustomerOrder): string {
    switch (this.receptionState(o)) {
      case 'awaiting': return 'Por recibir';
      case 'returned': return 'Con devolución';
      case 'received': return 'Recibido OK';
    }
  }

  hasReceptionDiff(it: OrderItem): boolean {
    return it.receivedQty !== undefined && it.receivedQty < it.fulfilledQty;
  }

  hasAnyDiff(o: CustomerOrder): boolean {
    return o.items.some(it => this.hasReceptionDiff(it));
  }

  totalReturned(o: CustomerOrder): number {
    return o.items.reduce((s, it) => {
      const diff = it.fulfilledQty - (it.receivedQty ?? it.fulfilledQty);
      return s + Math.max(0, diff);
    }, 0);
  }

  subtotalFor(o: CustomerOrder, it: OrderItem): number {
    const qty = o.customerConfirmedAt ? (it.receivedQty ?? 0) : it.fulfilledQty;
    return qty * it.unitPrice;
  }

  private parseDateStart(s: string): number | null {
    if (!s) return null;
    const d = new Date(s + 'T00:00:00');
    return isNaN(d.getTime()) ? null : d.getTime();
  }

  private parseDateEnd(s: string): number | null {
    if (!s) return null;
    const d = new Date(s + 'T23:59:59.999');
    return isNaN(d.getTime()) ? null : d.getTime();
  }
}
