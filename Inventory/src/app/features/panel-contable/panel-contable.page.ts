import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
} from '@ionic/angular/standalone';
import { DataService } from '../../core/services/data.service';
import { TenantContextService } from '../../core/services/tenant-context.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { CustomerOrder, PurchaseOrder } from '../../core/models';

type RangePreset = 'today' | '7d' | '30d' | '90d' | 'mtd' | 'last_month' | 'custom';

/**
 * Panel administrativo — Contabilidad.
 * Estado de resultados, detalle de pedidos confirmados, detalle de mermas,
 * gastos en compras (órdenes recibidas). Genera PDFs imprimibles vía el
 * diálogo del navegador (`window.print()`).
 */
@Component({
  selector: 'app-panel-contable',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, DecimalPipe,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
    PageHeaderComponent, KpiCardComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-menu-button></ion-menu-button></ion-buttons>
        <ion-title>Panel — Contabilidad</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="page">
        <app-page-header
          title="Panel contable"
          subtitle="Estado de resultados, gastos y ganancias del negocio.">
        </app-page-header>

        <!-- Filtros -->
        <div class="filters">
          <div class="presets">
            @for (p of presets; track p.value) {
              <button class="chip"
                [class.chip--active]="rangePreset() === p.value"
                (click)="setPreset(p.value)">{{ p.label }}</button>
            }
          </div>
          <div class="dates">
            <div class="dates__field">
              <label>Desde</label>
              <input type="date" [value]="fromIso()" (change)="setFromIso($any($event.target).value)" />
            </div>
            <div class="dates__field">
              <label>Hasta</label>
              <input type="date" [value]="toIso()" (change)="setToIso($any($event.target).value)" />
            </div>
          </div>
        </div>

        <!-- KPIs financieros -->
        <section class="kpis">
          <app-kpi-card label="Ingresos"
            [value]="fmtCRC(totalRevenue())" tone="success"
            [hint]="confirmedCount() + ' pedido(s) confirmado(s)'"></app-kpi-card>
          <app-kpi-card label="Costo producción"
            [value]="fmtCRC(totalCost())" tone="warning"
            hint="costo de insumos/receta"></app-kpi-card>
          <app-kpi-card label="Margen bruto"
            [value]="fmtCRC(grossMargin())" tone="primary"
            [hint]="marginPctLabel()"></app-kpi-card>
          <app-kpi-card label="Merma"
            [value]="fmtCRC(mermaCost())" tone="danger"
            [hint]="mermaUnits() + ' unid. descartadas'"></app-kpi-card>
          <app-kpi-card label="Gastos compras"
            [value]="fmtCRC(purchasesTotal())" tone="warning"
            [hint]="receivedPOs().length + ' OC(s) recibidas'"></app-kpi-card>
          <app-kpi-card label="Utilidad neta"
            [value]="fmtCRC(netProfit())" tone="success"
            hint="margen bruto − merma"></app-kpi-card>
          <app-kpi-card label="Ticket promedio"
            [value]="fmtCRC(avgTicket())" tone="primary"
            hint="por pedido confirmado"></app-kpi-card>
          <app-kpi-card label="Descuentos otorgados"
            [value]="fmtCRC(discountsGiven())" tone="danger"
            hint="diferencia entre original y final"></app-kpi-card>
        </section>

        <!-- Estado de resultados -->
        <section class="block">
          <h2 class="block__title">Estado de resultados</h2>
          <table class="acc">
            <tbody>
              <tr>
                <td>Ingresos por ventas (pedidos confirmados)</td>
                <td class="num mono pos">₡{{ totalRevenue() | number:'1.0-0' }}</td>
              </tr>
              <tr>
                <td class="indent">Total original facturado</td>
                <td class="num mono muted">₡{{ totalOriginal() | number:'1.0-0' }}</td>
              </tr>
              <tr>
                <td class="indent">(−) Descuentos por diferencias en recepción</td>
                <td class="num mono neg">−₡{{ discountsGiven() | number:'1.0-0' }}</td>
              </tr>
              <tr>
                <td>(−) Costo de producción (insumos/recetas)</td>
                <td class="num mono neg">−₡{{ totalCost() | number:'1.0-0' }}</td>
              </tr>
              <tr class="strong">
                <td>= Utilidad bruta</td>
                <td class="num mono"
                  [class.pos]="grossMargin() >= 0" [class.neg]="grossMargin() < 0">
                  ₡{{ grossMargin() | number:'1.0-0' }}
                </td>
              </tr>
              <tr>
                <td>(−) Merma de productos devueltos</td>
                <td class="num mono neg">−₡{{ mermaCost() | number:'1.0-0' }}</td>
              </tr>
              <tr class="strong">
                <td>= Utilidad neta del período</td>
                <td class="num mono"
                  [class.pos]="netProfit() >= 0" [class.neg]="netProfit() < 0">
                  ₡{{ netProfit() | number:'1.0-0' }}
                </td>
              </tr>
              <tr class="separator"><td colspan="2"></td></tr>
              <tr>
                <td>Gastos en compras (insumos recibidos)</td>
                <td class="num mono neg">−₡{{ purchasesTotal() | number:'1.0-0' }}</td>
              </tr>
              <tr class="muted">
                <td class="indent">
                  Nota: las compras son inversión en inventario; no afectan la
                  utilidad hasta que esos insumos se consumen en producción.
                </td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </section>

        <!-- Detalle de pedidos (full PDF) -->
        <section class="block">
          <h2 class="block__title">Detalle de pedidos confirmados</h2>
          @if (confirmedInRange().length === 0) {
            <p class="empty">Sin pedidos en el período.</p>
          } @else {
            <table class="acc acc--detail">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th class="num">Items</th>
                  <th class="num">Original</th>
                  <th class="num">Final</th>
                  <th class="num">Costo</th>
                  <th class="num">Margen</th>
                </tr>
              </thead>
              <tbody>
                @for (o of confirmedInRange(); track o.id) {
                  <tr>
                    <td class="mono">{{ o.code }}</td>
                    <td>{{ (o.customerConfirmedAt ?? o.completedAt ?? o.createdAt) | date:'dd-MM-yyyy' }}</td>
                    <td>{{ customerOf(o) }}</td>
                    <td class="num mono">{{ o.items.length }}</td>
                    <td class="num mono">₡{{ o.totalAmount | number:'1.0-0' }}</td>
                    <td class="num mono">₡{{ (o.finalAmount ?? o.totalAmount) | number:'1.0-0' }}</td>
                    <td class="num mono">₡{{ orderCost(o) | number:'1.0-0' }}</td>
                    <td class="num mono"
                      [class.pos]="orderMargin(o) >= 0"
                      [class.neg]="orderMargin(o) < 0">
                      ₡{{ orderMargin(o) | number:'1.0-0' }}
                    </td>
                  </tr>
                }
              </tbody>
              <tfoot>
                <tr class="strong">
                  <td colspan="4">Totales</td>
                  <td class="num mono">₡{{ totalOriginal() | number:'1.0-0' }}</td>
                  <td class="num mono">₡{{ totalRevenue() | number:'1.0-0' }}</td>
                  <td class="num mono">₡{{ totalCost() | number:'1.0-0' }}</td>
                  <td class="num mono pos">₡{{ grossMargin() | number:'1.0-0' }}</td>
                </tr>
              </tfoot>
            </table>
          }
        </section>

        <!-- Detalle de mermas (full PDF) -->
        <section class="block">
          <h2 class="block__title">Detalle de mermas procesadas</h2>
          @if (mermaLotsInRange().length === 0) {
            <p class="empty">Sin mermas en el período.</p>
          } @else {
            <table class="acc acc--detail">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Producto</th>
                  <th>Pedido origen</th>
                  <th>Cliente</th>
                  <th class="num">Devuelto</th>
                  <th class="num">Merma</th>
                  <th class="num">Costo perdido</th>
                </tr>
              </thead>
              <tbody>
                @for (l of mermaLotsInRange(); track l.id) {
                  <tr>
                    <td>{{ l.reviewedAt | date:'dd-MM-yyyy' }}</td>
                    <td>{{ l.productName }}</td>
                    <td class="mono">{{ l.sourceOrderCode }}</td>
                    <td>{{ l.customerName ?? '—' }}</td>
                    <td class="num mono">{{ l.qty }} {{ l.unit }}</td>
                    <td class="num mono">{{ l.mermaQty }} {{ l.unit }}</td>
                    <td class="num mono neg">−₡{{ mermaCostOf(l) | number:'1.0-0' }}</td>
                  </tr>
                }
              </tbody>
              <tfoot>
                <tr class="strong">
                  <td colspan="6">Total merma</td>
                  <td class="num mono neg">−₡{{ mermaCost() | number:'1.0-0' }}</td>
                </tr>
              </tfoot>
            </table>
          }
        </section>

        <!-- Detalle de gastos en compras (full PDF) -->
        <section class="block">
          <h2 class="block__title">Detalle de gastos en compras (OCs recibidas)</h2>
          @if (receivedPOs().length === 0) {
            <p class="empty">Sin órdenes de compra recibidas en el período.</p>
          } @else {
            <table class="acc acc--detail">
              <thead>
                <tr>
                  <th>Código OC</th>
                  <th>Fecha recibido</th>
                  <th>Proveedor</th>
                  <th class="num">Items</th>
                  <th class="num">Costo total</th>
                </tr>
              </thead>
              <tbody>
                @for (po of receivedPOs(); track po.id) {
                  <tr>
                    <td class="mono">{{ po.code }}</td>
                    <td>{{ po.receivedAt | date:'dd-MM-yyyy' }}</td>
                    <td>{{ po.supplier }}</td>
                    <td class="num mono">{{ po.items.length }}</td>
                    <td class="num mono">₡{{ po.totalCost | number:'1.0-0' }}</td>
                  </tr>
                }
              </tbody>
              <tfoot>
                <tr class="strong">
                  <td colspan="4">Total compras</td>
                  <td class="num mono neg">−₡{{ purchasesTotal() | number:'1.0-0' }}</td>
                </tr>
              </tfoot>
            </table>
          }
        </section>
      </div>
    </ion-content>
  `,
  styles: [`
    .page { padding: 0 var(--ui-sp-4) var(--ui-sp-8); }

    .filters {
      display: flex; gap: var(--ui-sp-3); flex-wrap: wrap;
      align-items: flex-end; padding: 0 0 var(--ui-sp-3);
    }
    .presets { display: flex; gap: 4px; flex-wrap: wrap; }
    .chip {
      padding: 6px 10px;
      border: var(--ui-border-w-sm) solid var(--ui-border);
      background: var(--ui-surface);
      cursor: pointer;
      font-size: var(--ui-fs-xs);
      font-weight: var(--ui-fw-bold);
      color: var(--ui-text);
      font-family: var(--ui-font-sans);
    }
    .chip:hover { background: var(--ui-surface-2); }
    .chip--active { background: var(--ui-text); color: var(--ui-surface); border-color: var(--ui-text); }
    .dates { display: flex; gap: var(--ui-sp-2); }
    .dates__field { display: flex; flex-direction: column; gap: 4px; }
    .dates__field label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--ui-text-muted);
      font-weight: var(--ui-fw-black);
    }
    .dates__field input {
      padding: 6px 8px;
      border: var(--ui-border-w-md) solid var(--ui-border);
      font-family: var(--ui-font-sans);
      font-size: var(--ui-fs-xs);
    }
    .kpis {
      display: grid; grid-template-columns: repeat(4, 1fr);
      gap: var(--ui-sp-3); padding: 0 0 var(--ui-sp-3);
    }
    @media (max-width: 1100px) { .kpis { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 480px)  { .kpis { grid-template-columns: 1fr; } }

    .block {
      background: var(--ui-surface);
      border: var(--ui-border-w-md) solid var(--ui-border);
      box-shadow: var(--ui-shadow-md);
      padding: var(--ui-sp-3);
      margin-bottom: var(--ui-sp-3);
    }
    .block__title {
      margin: 0 0 var(--ui-sp-2);
      font-family: var(--ui-font-display);
      font-weight: var(--ui-fw-black);
      font-size: var(--ui-fs-lg);
    }
    .empty {
      padding: var(--ui-sp-4); color: var(--ui-text-muted);
      text-align: center; font-size: var(--ui-fs-sm);
    }

    .acc { width: 100%; border-collapse: collapse; font-size: var(--ui-fs-sm); }
    .acc th, .acc td {
      padding: 8px 10px;
      border-bottom: var(--ui-border-w-sm) solid var(--ui-border);
      text-align: left;
    }
    .acc thead th {
      background: var(--ui-text); color: var(--ui-surface);
      font-weight: var(--ui-fw-black); text-transform: uppercase;
      letter-spacing: 0.3px; font-size: var(--ui-fs-xs);
    }
    .acc .num { text-align: right; }
    .acc .pos { color: var(--ui-success); font-weight: var(--ui-fw-bold); }
    .acc .neg { color: var(--ui-danger); font-weight: var(--ui-fw-bold); }
    .acc .muted td { color: var(--ui-text-muted); font-size: var(--ui-fs-xs); font-style: italic; }
    .acc .indent td:first-child,
    .acc .indent { padding-left: 26px; }
    .acc tr.strong td {
      font-weight: var(--ui-fw-black);
      background: var(--ui-surface-2);
    }
    .acc tfoot tr td {
      border-top: 2px solid var(--ui-text);
      font-weight: var(--ui-fw-black);
      background: var(--ui-surface-2);
    }
    .acc tr.separator td { padding: 0; border: none; height: 8px; background: transparent; }
    .acc--detail th, .acc--detail td { font-size: var(--ui-fs-xs); padding: 6px 8px; }
  `],
})
export class PanelContablePage {
  protected readonly data = inject(DataService);
  protected readonly tenant = inject(TenantContextService);

  readonly presets: { value: RangePreset; label: string }[] = [
    { value: 'today', label: 'Hoy' },
    { value: '7d', label: '7 días' },
    { value: '30d', label: '30 días' },
    { value: '90d', label: '90 días' },
    { value: 'mtd', label: 'Mes actual' },
    { value: 'last_month', label: 'Mes pasado' },
    { value: 'custom', label: 'Personalizado' },
  ];
  readonly rangePreset = signal<RangePreset>('30d');
  readonly fromDate = signal<Date>(this.dateDaysAgo(29));
  readonly toDate = signal<Date>(this.endOfToday());
  readonly fromIso = computed(() => this.dateToIso(this.fromDate()));
  readonly toIso = computed(() => this.dateToIso(this.toDate()));

  readonly ordersInRange = computed(() => {
    const from = this.fromDate().getTime();
    const to = this.toDate().getTime();
    return this.data.orders().filter(o => {
      const ref = (o.customerConfirmedAt ?? o.completedAt ?? o.createdAt).getTime();
      return ref >= from && ref <= to;
    });
  });

  readonly confirmedInRange = computed(() =>
    this.ordersInRange()
      .filter(o => !!o.customerConfirmedAt)
      .sort((a, b) => b.customerConfirmedAt!.getTime() - a.customerConfirmedAt!.getTime())
  );
  readonly confirmedCount = computed(() => this.confirmedInRange().length);

  readonly totalRevenue = computed(() =>
    this.confirmedInRange().reduce((s, o) => s + (o.finalAmount ?? o.totalAmount), 0)
  );
  readonly totalOriginal = computed(() =>
    this.confirmedInRange().reduce((s, o) => s + o.totalAmount, 0)
  );
  readonly discountsGiven = computed(() => this.totalOriginal() - this.totalRevenue());
  readonly totalCost = computed(() =>
    this.confirmedInRange().reduce((s, o) => s + this.orderCost(o), 0)
  );
  readonly grossMargin = computed(() => this.totalRevenue() - this.totalCost());
  readonly marginPctLabel = computed(() => {
    const r = this.totalRevenue();
    if (r === 0) return '—';
    return `${Math.round((this.grossMargin() / r) * 100)}% sobre ingresos`;
  });
  readonly avgTicket = computed(() => {
    const n = this.confirmedCount();
    return n === 0 ? 0 : this.totalRevenue() / n;
  });

  readonly mermaLotsInRange = computed(() => {
    const from = this.fromDate().getTime();
    const to = this.toDate().getTime();
    return this.data.processedReturnedLots().filter(l => {
      const at = l.reviewedAt?.getTime() ?? 0;
      return at >= from && at <= to;
    });
  });
  readonly mermaCost = computed(() =>
    this.mermaLotsInRange().reduce((s, l) => s + this.mermaCostOf(l), 0)
  );
  readonly mermaUnits = computed(() =>
    this.mermaLotsInRange().reduce((s, l) => s + l.mermaQty, 0)
  );

  readonly netProfit = computed(() => this.grossMargin() - this.mermaCost());

  readonly receivedPOs = computed<PurchaseOrder[]>(() => {
    const from = this.fromDate().getTime();
    const to = this.toDate().getTime();
    return this.data.purchaseOrders()
      .filter(po => po.status === 'received' && po.receivedAt
        && po.receivedAt.getTime() >= from && po.receivedAt.getTime() <= to)
      .sort((a, b) => (b.receivedAt!.getTime() - a.receivedAt!.getTime()));
  });
  readonly purchasesTotal = computed(() =>
    this.receivedPOs().reduce((s, po) => s + po.totalCost, 0)
  );

  customerOf(o: CustomerOrder): string {
    if (!o.customerId) return 'Interno';
    return this.data.customerById(o.customerId)?.name ?? '—';
  }
  orderCost(o: CustomerOrder): number {
    return o.items.reduce((s, it) => {
      const qty = it.receivedQty ?? it.fulfilledQty;
      return s + qty * this.data.effectiveProductCost(it.productId);
    }, 0);
  }
  orderMargin(o: CustomerOrder): number {
    return (o.finalAmount ?? o.totalAmount) - this.orderCost(o);
  }
  mermaCostOf(l: { productId: string; mermaQty: number }): number {
    return l.mermaQty * this.data.effectiveProductCost(l.productId);
  }
  fmtCRC(v: number): string {
    if (Math.abs(v) >= 1_000_000) return '₡' + (v / 1_000_000).toFixed(1) + 'M';
    if (Math.abs(v) >= 10_000) return '₡' + (v / 1000).toFixed(1) + 'K';
    return '₡' + new Intl.NumberFormat('es-CR', { maximumFractionDigits: 0 }).format(v);
  }

  setPreset(p: RangePreset) {
    this.rangePreset.set(p);
    const today = this.endOfToday();
    switch (p) {
      case 'today': this.fromDate.set(this.startOfToday()); this.toDate.set(today); break;
      case '7d':    this.fromDate.set(this.dateDaysAgo(6)); this.toDate.set(today); break;
      case '30d':   this.fromDate.set(this.dateDaysAgo(29)); this.toDate.set(today); break;
      case '90d':   this.fromDate.set(this.dateDaysAgo(89)); this.toDate.set(today); break;
      case 'mtd': {
        const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0);
        this.fromDate.set(d); this.toDate.set(today); break;
      }
      case 'last_month': {
        const f = new Date(); f.setMonth(f.getMonth() - 1, 1); f.setHours(0, 0, 0, 0);
        const t = new Date(f.getFullYear(), f.getMonth() + 1, 0); t.setHours(23, 59, 59, 999);
        this.fromDate.set(f); this.toDate.set(t); break;
      }
      case 'custom': break;
    }
  }
  setFromIso(iso: string) {
    if (!iso) return;
    const d = new Date(iso + 'T00:00:00');
    if (!isNaN(d.getTime())) { this.fromDate.set(d); this.rangePreset.set('custom'); }
  }
  setToIso(iso: string) {
    if (!iso) return;
    const d = new Date(iso + 'T23:59:59.999');
    if (!isNaN(d.getTime())) { this.toDate.set(d); this.rangePreset.set('custom'); }
  }
  private startOfToday(): Date { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  private endOfToday(): Date { const d = new Date(); d.setHours(23, 59, 59, 999); return d; }
  private dateDaysAgo(n: number): Date {
    const d = new Date(); d.setDate(d.getDate() - n); d.setHours(0, 0, 0, 0); return d;
  }
  private dateToIso(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
