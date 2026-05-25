import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
} from '@ionic/angular/standalone';
import { DataService } from '../../core/services/data.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { LineChartComponent, LinePoint } from '../../shared/components/charts/line-chart.component';
import { BarChartComponent, BarItem } from '../../shared/components/charts/bar-chart.component';
import { DonutChartComponent, DonutSlice } from '../../shared/components/charts/donut-chart.component';
import { KardexEntry } from '../../core/models';

type RangePreset = 'today' | '7d' | '30d' | '90d' | 'mtd' | 'last_month' | 'custom';

/**
 * Panel administrativo — Gestión de inventario.
 * Entradas y salidas, insumos más usados, productos más fabricados, valor
 * total del inventario, alertas de bajo stock.
 */
@Component({
  selector: 'app-panel-inventario',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, DecimalPipe,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
    PageHeaderComponent, KpiCardComponent,
    LineChartComponent, BarChartComponent, DonutChartComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-menu-button></ion-menu-button></ion-buttons>
        <ion-title>Panel — Inventario</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="page">
        <app-page-header
          title="Gestión de inventario"
          subtitle="Movimientos del kardex, insumos más usados, valor del stock y niveles críticos.">
        </app-page-header>

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

        <section class="kpis">
          <app-kpi-card label="Valor inventario"
            [value]="fmtCRC(inventoryValue())" tone="primary"
            hint="insumos + productos al costo"></app-kpi-card>
          <app-kpi-card label="Valor insumos"
            [value]="fmtCRC(suppliesValue())" tone="primary"
            [hint]="data.supplyStock().length + ' insumos'"></app-kpi-card>
          <app-kpi-card label="Valor productos"
            [value]="fmtCRC(productsValue())" tone="primary"
            [hint]="data.productStock().length + ' productos en stock'"></app-kpi-card>
          <app-kpi-card label="Críticos / bajos"
            [value]="lowStockCount()" tone="danger"
            hint="requieren reposición"></app-kpi-card>
          <app-kpi-card label="Entradas (período)"
            [value]="inflowsCount()" tone="success"
            [hint]="inflowsUnitsLabel()"></app-kpi-card>
          <app-kpi-card label="Salidas (período)"
            [value]="outflowsCount()" tone="warning"
            [hint]="outflowsUnitsLabel()"></app-kpi-card>
          <app-kpi-card label="Compras (período)"
            [value]="fmtCRC(purchasesCost())" tone="warning"
            hint="costo de insumos recibidos"></app-kpi-card>
          <app-kpi-card label="Devoluciones pendientes"
            [value]="data.pendingReturnedLots().length" tone="warning"
            hint="lotes por revisar en mermas"></app-kpi-card>
        </section>

        <!-- Movimientos diarios -->
        <section class="block">
          <div class="block__head">
            <h2 class="block__title">Movimientos diarios</h2>
            <span class="block__sub mono">entradas vs salidas</span>
          </div>
          <div class="grid-2">
            <div>
              <div class="block__sub" style="margin-bottom:4px">Entradas</div>
              <app-line-chart [points]="inflowsSeries()" color="#26a269"></app-line-chart>
            </div>
            <div>
              <div class="block__sub" style="margin-bottom:4px">Salidas</div>
              <app-line-chart [points]="outflowsSeries()" color="#e5a00d"></app-line-chart>
            </div>
          </div>
        </section>

        <div class="grid-2">
          <!-- Top insumos -->
          <section class="block">
            <div class="block__head">
              <h2 class="block__title">Insumos más usados</h2>
              <span class="block__sub mono">consumo en producción</span>
            </div>
            <app-bar-chart [items]="topSuppliesUsed()"></app-bar-chart>
          </section>

          <!-- Top productos fabricados -->
          <section class="block">
            <div class="block__head">
              <h2 class="block__title">Productos más entregados</h2>
              <span class="block__sub mono">salidas registradas</span>
            </div>
            <app-bar-chart [items]="topProductsDelivered()"></app-bar-chart>
          </section>
        </div>

        <!-- Distribución valor inventario por categoría -->
        <section class="block">
          <div class="block__head">
            <h2 class="block__title">Valor del inventario por categoría</h2>
            <span class="block__sub mono">distribución al costo</span>
          </div>
          <app-donut-chart
            [data]="categorySlices()"
            centerLabel="₡ total"
            [decimals]="0"></app-donut-chart>
        </section>

        <!-- Últimos movimientos del kardex -->
        <section class="block">
          <div class="block__head">
            <h2 class="block__title">Movimientos recientes</h2>
            <span class="block__sub mono">{{ recentMovements().length }} movimiento(s)</span>
          </div>
          @if (recentMovements().length === 0) {
            <p class="empty">Sin movimientos en el período.</p>
          } @else {
            <table class="t">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Ítem</th>
                  <th class="num">Cantidad</th>
                  <th>Motivo</th>
                  <th>Usuario</th>
                </tr>
              </thead>
              <tbody>
                @for (k of recentMovements(); track k.id) {
                  <tr>
                    <td>{{ k.at | date:'dd-MM HH:mm' }}</td>
                    <td>
                      <span class="tag" [attr.data-type]="k.type">{{ typeLabel(k.type) }}</span>
                    </td>
                    <td>{{ k.itemName }}</td>
                    <td class="num mono"
                      [class.pos]="k.type === 'in'"
                      [class.neg]="k.type === 'out'">
                      {{ k.type === 'in' ? '+' : (k.type === 'out' ? '−' : '') }}{{ k.qty | number:'1.0-2' }}
                    </td>
                    <td>{{ reasonLabel(k.reason) }}</td>
                    <td>{{ k.userName }}</td>
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

    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: var(--ui-sp-3); }
    @media (max-width: 900px) { .grid-2 { grid-template-columns: 1fr; } }

    .block {
      background: var(--ui-surface);
      border: var(--ui-border-w-md) solid var(--ui-border);
      box-shadow: var(--ui-shadow-md);
      padding: var(--ui-sp-3);
      margin-bottom: var(--ui-sp-3);
    }
    .block__head {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: var(--ui-sp-2);
    }
    .block__title {
      margin: 0; font-family: var(--ui-font-display);
      font-weight: var(--ui-fw-black); font-size: var(--ui-fs-lg);
    }
    .block__sub { font-size: var(--ui-fs-xs); color: var(--ui-text-muted); font-weight: var(--ui-fw-bold); }
    .empty {
      padding: var(--ui-sp-4); color: var(--ui-text-muted);
      text-align: center; font-size: var(--ui-fs-sm);
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
    .t .pos { color: var(--ui-success); font-weight: var(--ui-fw-bold); }
    .t .neg { color: var(--ui-danger); font-weight: var(--ui-fw-bold); }
    .tag {
      padding: 2px 8px; font-size: 10px;
      font-weight: var(--ui-fw-black); text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .tag[data-type="in"] { background: var(--ui-success); color: #fff; }
    .tag[data-type="out"] { background: var(--ui-danger); color: #fff; }
    .tag[data-type="adjustment"] { background: var(--ui-warning); color: #000; }
  `],
})
export class PanelInventarioPage {
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

  readonly kardexInRange = computed(() => {
    const from = this.fromDate().getTime();
    const to = this.toDate().getTime();
    return this.data.kardex().filter(k => k.at.getTime() >= from && k.at.getTime() <= to);
  });

  readonly inflows = computed(() => this.kardexInRange().filter(k => k.type === 'in'));
  readonly outflows = computed(() => this.kardexInRange().filter(k => k.type === 'out'));

  readonly inflowsCount = computed(() => this.inflows().length);
  readonly outflowsCount = computed(() => this.outflows().length);
  readonly inflowsUnitsLabel = computed(() => {
    const total = this.inflows().reduce((s, k) => s + k.qty, 0);
    return `${this.fmtNum(total)} unidades`;
  });
  readonly outflowsUnitsLabel = computed(() => {
    const total = this.outflows().reduce((s, k) => s + k.qty, 0);
    return `${this.fmtNum(total)} unidades`;
  });

  // Valor del inventario al costo
  readonly suppliesValue = computed(() =>
    this.data.supplyStock().reduce((s, st) => {
      const sup = this.data.supplyById(st.supplyId);
      return s + st.quantity * (sup?.cost ?? 0);
    }, 0)
  );
  readonly productsValue = computed(() =>
    this.data.productStock().reduce((s, st) => {
      return s + st.quantity * this.data.effectiveProductCost(st.productId);
    }, 0)
  );
  readonly inventoryValue = computed(() => this.suppliesValue() + this.productsValue());

  readonly lowStockCount = computed(() => {
    const supplyLow = this.data.supplyStock().filter(s => s.status === 'critical' || s.status === 'low' || s.status === 'out').length;
    const prodLow = this.data.productStock().filter(s => s.status === 'critical' || s.status === 'low' || s.status === 'out').length;
    return supplyLow + prodLow;
  });

  readonly purchasesCost = computed(() =>
    this.inflows()
      .filter(k => k.reason === 'purchase')
      .reduce((s, k) => s + k.qty * (k.cost ?? 0), 0)
  );

  // Series temporales
  readonly inflowsSeries = computed<LinePoint[]>(() => this.dailyKardexSeries('in'));
  readonly outflowsSeries = computed<LinePoint[]>(() => this.dailyKardexSeries('out'));

  private dailyKardexSeries(type: 'in' | 'out'): LinePoint[] {
    const points: LinePoint[] = [];
    const start = new Date(this.fromDate()); start.setHours(0, 0, 0, 0);
    const end = new Date(this.toDate()); end.setHours(0, 0, 0, 0);
    const byIso = new Map<string, number>();
    const dates: Date[] = [];
    for (let d = new Date(start); d.getTime() <= end.getTime(); d.setDate(d.getDate() + 1)) {
      const iso = this.dateToIso(d);
      byIso.set(iso, 0);
      dates.push(new Date(d));
    }
    for (const k of this.kardexInRange()) {
      if (k.type !== type) continue;
      const iso = this.dateToIso(k.at);
      if (byIso.has(iso)) byIso.set(iso, byIso.get(iso)! + k.qty);
    }
    for (const d of dates) {
      const iso = this.dateToIso(d);
      points.push({
        label: `${d.getDate()}/${d.getMonth() + 1}`,
        value: byIso.get(iso) ?? 0,
      });
    }
    return points;
  }

  readonly topSuppliesUsed = computed<BarItem[]>(() => {
    const map = new Map<string, { name: string; value: number }>();
    for (const k of this.outflows()) {
      if (!k.supplyId) continue;
      const cur = map.get(k.supplyId);
      if (cur) cur.value += k.qty;
      else map.set(k.supplyId, { name: k.itemName, value: k.qty });
    }
    return Array.from(map.values()).sort((a, b) => b.value - a.value)
      .slice(0, 8).map(x => ({ label: x.name, value: x.value }));
  });

  readonly topProductsDelivered = computed<BarItem[]>(() => {
    const map = new Map<string, { name: string; value: number }>();
    for (const k of this.outflows()) {
      if (!k.productId || k.reason !== 'sale') continue;
      const cur = map.get(k.productId);
      if (cur) cur.value += k.qty;
      else map.set(k.productId, { name: k.itemName, value: k.qty });
    }
    return Array.from(map.values()).sort((a, b) => b.value - a.value)
      .slice(0, 8).map(x => ({ label: x.name, value: x.value }));
  });

  readonly categorySlices = computed<DonutSlice[]>(() => {
    const palette = ['#2c5fff', '#ff6b35', '#26a269', '#e5a00d', '#9b59b6', '#16a085', '#c0392b', '#7f8c8d'];
    const map = new Map<string, number>();
    for (const st of this.data.supplyStock()) {
      const sup = this.data.supplyById(st.supplyId);
      const value = st.quantity * (sup?.cost ?? 0);
      const cat = sup?.category ?? 'Insumos';
      map.set(cat, (map.get(cat) ?? 0) + value);
    }
    for (const st of this.data.productStock()) {
      const p = this.data.products().find(x => x.id === st.productId);
      const value = st.quantity * this.data.effectiveProductCost(st.productId);
      const cat = p?.category ?? 'Productos';
      map.set(cat, (map.get(cat) ?? 0) + value);
    }
    return Array.from(map.entries())
      .filter(([, v]) => v > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([label, value], i) => ({ label, value, color: palette[i % palette.length] }));
  });

  readonly recentMovements = computed(() =>
    [...this.kardexInRange()]
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice(0, 25)
  );

  typeLabel(t: KardexEntry['type']): string {
    return { in: 'Entrada', out: 'Salida', adjustment: 'Ajuste' }[t] ?? t;
  }

  reasonLabel(r: string): string {
    return ({
      purchase: 'Compra (OC)',
      sale: 'Venta / entrega',
      production: 'Consumo producción',
      production_cancel: 'Cancelación',
      return_from_customer: 'Devolución de cliente',
      damaged: 'Producto dañado',
      expired: 'Vencido',
      lost: 'Pérdida',
      count_correction: 'Corrección de conteo',
      manual: 'Manual',
      donation: 'Donación',
    } as Record<string, string>)[r] ?? r;
  }

  fmtCRC(v: number): string {
    if (Math.abs(v) >= 1_000_000) return '₡' + (v / 1_000_000).toFixed(1) + 'M';
    if (Math.abs(v) >= 10_000) return '₡' + (v / 1000).toFixed(1) + 'K';
    return '₡' + new Intl.NumberFormat('es-CR', { maximumFractionDigits: 0 }).format(v);
  }

  fmtNum(v: number): string {
    return new Intl.NumberFormat('es-CR', { maximumFractionDigits: 1 }).format(v);
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
