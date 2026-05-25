import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
} from '@ionic/angular/standalone';
import { DataService } from '../../core/services/data.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { LineChartComponent, LinePoint } from '../../shared/components/charts/line-chart.component';
import { BarChartComponent, BarItem } from '../../shared/components/charts/bar-chart.component';
import { DonutChartComponent, DonutSlice } from '../../shared/components/charts/donut-chart.component';
import { CustomerOrder } from '../../core/models';

type RangePreset = 'today' | '7d' | '30d' | '90d' | 'mtd' | 'last_month' | 'custom';

interface DailyPoint { iso: string; date: Date; revenue: number; orders: number; }

/**
 * Panel administrativo — Control de pedidos (operativo).
 * Muestra toda la información operativa: pedidos completados, top clientes,
 * top productos, merma, costo de producción y cumplimiento. Sin export PDF
 * (eso vive en /panel-contable).
 */
@Component({
  selector: 'app-panel-pedidos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
    PageHeaderComponent, KpiCardComponent,
    LineChartComponent, BarChartComponent, DonutChartComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-menu-button></ion-menu-button></ion-buttons>
        <ion-title>Panel — Control de pedidos</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="page">
        <app-page-header
          title="Control de pedidos"
          subtitle="Visión operativa: pedidos completados, top clientes/productos, merma y costo de producción.">
        </app-page-header>

        <!-- Filtros -->
        <div class="filters">
          <div class="presets">
            @for (p of presets; track p.value) {
              <button class="chip"
                [class.chip--active]="rangePreset() === p.value"
                (click)="setPreset(p.value)">
                {{ p.label }}
              </button>
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

        <!-- KPIs operativos -->
        <section class="kpis">
          <app-kpi-card label="Pedidos completados"
            [value]="completedCount()" tone="primary"
            hint="pasaron por producción"></app-kpi-card>
          <app-kpi-card label="Pedidos confirmados"
            [value]="confirmedCount()" tone="success"
            hint="recibidos por cliente"></app-kpi-card>
          <app-kpi-card label="Pendientes / en curso"
            [value]="openCount()" tone="warning"
            hint="aún en flujo de producción"></app-kpi-card>
          <app-kpi-card label="Devoluciones"
            [value]="returnedOrdersCount()" tone="danger"
            hint="pedidos con diferencia"></app-kpi-card>
          <app-kpi-card label="Ticket promedio"
            [value]="fmtCRC(avgTicket())" tone="primary"
            hint="por pedido confirmado"></app-kpi-card>
          <app-kpi-card label="Costo producción"
            [value]="fmtCRC(totalCost())" tone="warning"
            hint="suma de costos por receta"></app-kpi-card>
          <app-kpi-card label="Merma"
            [value]="fmtCRC(mermaCost())" tone="danger"
            [hint]="mermaUnits() + ' unid. descartadas'"></app-kpi-card>
          <app-kpi-card label="% cumplimiento"
            [value]="fulfillmentPctLabel()" tone="success"
            hint="entregado vs pedido"></app-kpi-card>
        </section>

        <!-- Línea de pedidos diarios -->
        <section class="block">
          <div class="block__head">
            <h2 class="block__title">Pedidos completados por día</h2>
            <span class="block__sub mono">{{ dailySeries().length }} día(s)</span>
          </div>
          <app-line-chart [points]="ordersSeries()" color="#26a269"></app-line-chart>
        </section>

        <div class="grid-2">
          <!-- Top productos -->
          <section class="block">
            <div class="block__head">
              <h2 class="block__title">Top productos</h2>
              <span class="block__sub mono">por unidades entregadas</span>
            </div>
            <app-bar-chart [items]="topProducts()" valueSuffix=" unid."></app-bar-chart>
          </section>

          <!-- Top clientes -->
          <section class="block">
            <div class="block__head">
              <h2 class="block__title">Top clientes</h2>
              <span class="block__sub mono">por # de pedidos</span>
            </div>
            <app-donut-chart
              [data]="clientSlices()"
              centerLabel="pedidos"
              [decimals]="0"></app-donut-chart>
          </section>
        </div>

        <!-- Pedidos recientes -->
        <section class="block">
          <div class="block__head">
            <h2 class="block__title">Pedidos confirmados recientes</h2>
            <span class="block__sub mono">{{ recentConfirmed().length }}</span>
          </div>
          @if (recentConfirmed().length === 0) {
            <p class="empty">Sin pedidos confirmados en el período.</p>
          } @else {
            <table class="t">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Cliente</th>
                  <th>Confirmado</th>
                  <th class="num">Items</th>
                  <th class="num">Unidades</th>
                  <th>Estado recepción</th>
                </tr>
              </thead>
              <tbody>
                @for (o of recentConfirmed(); track o.id) {
                  <tr>
                    <td class="mono">{{ o.code }}</td>
                    <td>{{ customerOf(o) }}</td>
                    <td>{{ o.customerConfirmedAt | date:'dd-MM HH:mm' }}</td>
                    <td class="num mono">{{ o.items.length }}</td>
                    <td class="num mono">{{ totalReceived(o) }} / {{ totalRequested(o) }}</td>
                    <td>
                      @if (hasDiff(o)) {
                        <span class="tag tag--danger">Con devolución</span>
                      } @else {
                        <span class="tag tag--ok">Completo</span>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </section>
      </div>
    </ion-content>
  `,
  styles: [`
    .page { padding: 0 var(--ui-sp-4) var(--ui-sp-8); }

    .filters {
      display: flex;
      gap: var(--ui-sp-3);
      flex-wrap: wrap;
      align-items: flex-end;
      padding: 0 0 var(--ui-sp-3);
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
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: var(--ui-sp-3);
      padding: 0 0 var(--ui-sp-3);
    }
    @media (max-width: 1100px) { .kpis { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 480px)  { .kpis { grid-template-columns: 1fr; } }

    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--ui-sp-3);
    }
    @media (max-width: 900px) { .grid-2 { grid-template-columns: 1fr; } }

    .block {
      background: var(--ui-surface);
      border: var(--ui-border-w-md) solid var(--ui-border);
      box-shadow: var(--ui-shadow-md);
      padding: var(--ui-sp-3);
      margin-bottom: var(--ui-sp-3);
    }
    .block__head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: var(--ui-sp-2);
    }
    .block__title {
      margin: 0;
      font-family: var(--ui-font-display);
      font-weight: var(--ui-fw-black);
      font-size: var(--ui-fs-lg);
    }
    .block__sub {
      font-size: var(--ui-fs-xs);
      color: var(--ui-text-muted);
      font-weight: var(--ui-fw-bold);
    }
    .empty {
      padding: var(--ui-sp-4);
      color: var(--ui-text-muted);
      text-align: center;
      font-size: var(--ui-fs-sm);
    }

    .t { width: 100%; border-collapse: collapse; font-size: var(--ui-fs-sm); }
    .t th, .t td {
      padding: 8px 10px;
      border-bottom: var(--ui-border-w-sm) solid var(--ui-border);
      text-align: left;
    }
    .t thead th {
      background: var(--ui-text); color: var(--ui-surface);
      font-weight: var(--ui-fw-black); text-transform: uppercase;
      letter-spacing: 0.3px; font-size: var(--ui-fs-xs);
    }
    .t .num { text-align: right; }
    .tag {
      padding: 2px 8px;
      font-size: 10px;
      font-weight: var(--ui-fw-black);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .tag--ok { background: var(--ui-success); color: #fff; }
    .tag--danger { background: var(--ui-danger); color: #fff; }
  `],
})
export class PanelPedidosPage {
  protected readonly data = inject(DataService);

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
    this.ordersInRange().filter(o => !!o.customerConfirmedAt)
  );
  readonly completedInRange = computed(() =>
    this.ordersInRange().filter(o => o.status === 'completed')
  );
  readonly recentConfirmed = computed(() =>
    this.confirmedInRange()
      .sort((a, b) => b.customerConfirmedAt!.getTime() - a.customerConfirmedAt!.getTime())
      .slice(0, 15)
  );

  readonly confirmedCount = computed(() => this.confirmedInRange().length);
  readonly completedCount = computed(() => this.completedInRange().length);
  readonly openCount = computed(() => {
    const from = this.fromDate().getTime();
    const to = this.toDate().getTime();
    return this.data.orders().filter(o => {
      if (o.status !== 'pending' && o.status !== 'in_production') return false;
      const ref = o.createdAt.getTime();
      return ref >= from && ref <= to;
    }).length;
  });
  readonly returnedOrdersCount = computed(() =>
    this.confirmedInRange().filter(o =>
      o.items.some(it => it.receivedQty !== undefined && it.receivedQty < it.fulfilledQty)
    ).length
  );

  readonly totalRevenue = computed(() =>
    this.confirmedInRange().reduce((s, o) => s + (o.finalAmount ?? o.totalAmount), 0)
  );
  readonly avgTicket = computed(() => {
    const n = this.confirmedCount();
    return n === 0 ? 0 : this.totalRevenue() / n;
  });
  readonly totalCost = computed(() =>
    this.confirmedInRange().reduce((s, o) => s + this.orderCost(o), 0)
  );

  readonly mermaLotsInRange = computed(() => {
    const from = this.fromDate().getTime();
    const to = this.toDate().getTime();
    return this.data.processedReturnedLots().filter(l => {
      const at = l.reviewedAt?.getTime() ?? 0;
      return at >= from && at <= to;
    });
  });
  readonly mermaCost = computed(() =>
    this.mermaLotsInRange().reduce((s, l) => s + l.mermaQty * this.data.effectiveProductCost(l.productId), 0)
  );
  readonly mermaUnits = computed(() =>
    this.mermaLotsInRange().reduce((s, l) => s + l.mermaQty, 0)
  );

  readonly fulfillmentPctLabel = computed(() => {
    let req = 0, got = 0;
    for (const o of this.confirmedInRange()) {
      for (const it of o.items) {
        req += it.qty;
        got += it.receivedQty ?? 0;
      }
    }
    if (req === 0) return '—';
    return `${Math.round((got / req) * 100)}%`;
  });

  // Series temporales
  readonly dailySeries = computed<DailyPoint[]>(() => {
    const points: DailyPoint[] = [];
    const start = new Date(this.fromDate()); start.setHours(0, 0, 0, 0);
    const end = new Date(this.toDate()); end.setHours(0, 0, 0, 0);
    const byIso = new Map<string, DailyPoint>();
    for (let d = new Date(start); d.getTime() <= end.getTime(); d.setDate(d.getDate() + 1)) {
      const iso = this.dateToIso(d);
      const p: DailyPoint = { iso, date: new Date(d), revenue: 0, orders: 0 };
      points.push(p);
      byIso.set(iso, p);
    }
    for (const o of this.confirmedInRange()) {
      const ref = o.customerConfirmedAt ?? o.completedAt ?? o.createdAt;
      const p = byIso.get(this.dateToIso(ref));
      if (!p) continue;
      p.revenue += o.finalAmount ?? o.totalAmount;
      p.orders += 1;
    }
    return points;
  });
  readonly ordersSeries = computed<LinePoint[]>(() =>
    this.dailySeries().map(p => ({
      label: `${p.date.getDate()}/${p.date.getMonth() + 1}`,
      value: p.orders,
    }))
  );

  readonly topProducts = computed<BarItem[]>(() => {
    const map = new Map<string, { name: string; value: number }>();
    for (const o of this.confirmedInRange()) {
      for (const it of o.items) {
        const qty = it.receivedQty ?? it.fulfilledQty;
        if (qty <= 0) continue;
        const cur = map.get(it.productId);
        if (cur) cur.value += qty;
        else map.set(it.productId, { name: it.productName, value: qty });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.value - a.value)
      .slice(0, 8).map(x => ({ label: x.name, value: x.value }));
  });

  readonly clientSlices = computed<DonutSlice[]>(() => {
    const palette = ['#2c5fff', '#ff6b35', '#26a269', '#e5a00d', '#9b59b6', '#16a085', '#c0392b', '#7f8c8d'];
    const map = new Map<string, number>();
    let internal = 0;
    for (const o of this.confirmedInRange()) {
      if (!o.customerId) { internal++; continue; }
      map.set(o.customerId, (map.get(o.customerId) ?? 0) + 1);
    }
    const slices = Array.from(map.entries())
      .map(([id, v]) => ({ label: this.data.customerById(id)?.name ?? 'Cliente', value: v }))
      .sort((a, b) => b.value - a.value);
    if (internal > 0) slices.push({ label: 'Internos', value: internal });
    return slices.slice(0, 8).map((s, i) => ({ ...s, color: palette[i % palette.length] }));
  });

  customerOf(o: CustomerOrder): string {
    if (!o.customerId) return 'Interno';
    return this.data.customerById(o.customerId)?.name ?? '—';
  }
  totalRequested(o: CustomerOrder): number { return o.items.reduce((s, it) => s + it.qty, 0); }
  totalReceived(o: CustomerOrder): number {
    return o.items.reduce((s, it) => s + (it.receivedQty ?? it.fulfilledQty), 0);
  }
  hasDiff(o: CustomerOrder): boolean {
    return o.items.some(it => it.receivedQty !== undefined && it.receivedQty < it.fulfilledQty);
  }
  orderCost(o: CustomerOrder): number {
    return o.items.reduce((s, it) => {
      const qty = it.receivedQty ?? it.fulfilledQty;
      return s + qty * this.data.effectiveProductCost(it.productId);
    }, 0);
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
