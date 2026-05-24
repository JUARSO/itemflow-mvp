import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
  IonSegment, IonSegmentButton, IonLabel, IonButton, IonIcon,
} from '@ionic/angular/standalone';
import { DataService } from '../../core/services/data.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { LineChartComponent, LinePoint } from '../../shared/components/charts/line-chart.component';
import { BarChartComponent, BarItem } from '../../shared/components/charts/bar-chart.component';

type Range = 7 | 30 | 90;

@Component({
  selector: 'app-admin-financiero',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe, RouterLink,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
    IonSegment, IonSegmentButton, IonLabel, IonButton, IonIcon,
    PageHeaderComponent, KpiCardComponent, LineChartComponent, BarChartComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-menu-button></ion-menu-button></ion-buttons>
        <ion-title>Análisis Financiero</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <app-page-header
        title="Análisis Financiero"
        subtitle="Ingresos, costo de fabricación, márgenes y pérdidas por devoluciones/compras.">
        <ion-button fill="outline" routerLink="/admin">← Dashboard</ion-button>
      </app-page-header>

      <div class="range">
        <span class="range__label">Período</span>
        <ion-segment [value]="range()" (ionChange)="range.set($any($event.detail.value))">
          <ion-segment-button [value]="7"><ion-label>7 días</ion-label></ion-segment-button>
          <ion-segment-button [value]="30"><ion-label>30 días</ion-label></ion-segment-button>
          <ion-segment-button [value]="90"><ion-label>90 días</ion-label></ion-segment-button>
        </ion-segment>
      </div>

      <div class="kpis">
        <app-kpi-card label="Ingresos" [value]="'₡' + (ingresos() | number:'1.0-0')" tone="success"></app-kpi-card>
        <app-kpi-card label="Costo fabricación (COGS)" [value]="'₡' + (cogs() | number:'1.0-0')" tone="warning"
          hint="costo de lo vendido"></app-kpi-card>
        <app-kpi-card label="Margen bruto" [value]="'₡' + (margenBruto() | number:'1.0-0')" tone="primary"
          [hint]="margenPct() + '% de ingresos'"></app-kpi-card>
        <app-kpi-card label="Pérdidas (devoluciones)" [value]="'₡' + (perdidas() | number:'1.0-0')" tone="danger"
          [hint]="returnsCount() + ' devoluciones'"></app-kpi-card>
        <app-kpi-card label="Compras (OCs)" [value]="'₡' + (comprasOC() | number:'1.0-0')" tone="transit"
          [hint]="ocsCount() + ' órdenes recibidas'"></app-kpi-card>
        <app-kpi-card label="Resultado neto" [value]="'₡' + (resultadoNeto() | number:'1.0-0')"
          [tone]="resultadoNeto() >= 0 ? 'success' : 'danger'"
          hint="margen − pérdidas"></app-kpi-card>
      </div>

      <div class="grid">
        <div class="card card--wide">
          <h3 class="card__title">Ingresos vs Costos por día</h3>
          <div class="dual-chart">
            <div>
              <div class="dual-chart__sub">Ingresos ({{ '₡' + (ingresos() | number:'1.0-0') }})</div>
              <app-line-chart [points]="seriesIngresos()" color="var(--ui-success)"></app-line-chart>
            </div>
            <div>
              <div class="dual-chart__sub">Costo fabricación ({{ '₡' + (cogs() | number:'1.0-0') }})</div>
              <app-line-chart [points]="seriesCostos()" color="var(--ui-warning)"></app-line-chart>
            </div>
          </div>
        </div>

        <div class="card">
          <h3 class="card__title">Producto más rentable</h3>
          <app-bar-chart [items]="topMargen()"
            defaultColor="var(--ui-success)" valuePrefix="₡"></app-bar-chart>
        </div>

        <div class="card">
          <h3 class="card__title">Pérdida por producto (devoluciones)</h3>
          @if (perdidasPorProducto().length === 0) {
            <p class="ok"><ion-icon name="checkmark-circle-outline"></ion-icon> Sin devoluciones en el período.</p>
          } @else {
            <app-bar-chart [items]="perdidasPorProducto()"
              defaultColor="var(--ui-danger)" valuePrefix="₡"></app-bar-chart>
          }
        </div>

        <div class="card card--wide">
          <h3 class="card__title">Ranking de rentabilidad por producto</h3>
          <div class="table">
            <div class="table__head">
              <div>Producto</div>
              <div class="num">Unidades</div>
              <div class="num">Ingresos</div>
              <div class="num">Costo</div>
              <div class="num">Margen</div>
              <div class="num">% margen</div>
            </div>
            @for (r of rentabilidad(); track r.productId) {
              <div class="table__row">
                <div>{{ r.productName }}</div>
                <div class="num mono">{{ r.qty }}</div>
                <div class="num mono">₡{{ r.ingresos | number:'1.0-0' }}</div>
                <div class="num mono">₡{{ r.costo | number:'1.0-0' }}</div>
                <div class="num mono"
                  [class.pos]="r.margen >= 0" [class.neg]="r.margen < 0">
                  ₡{{ r.margen | number:'1.0-0' }}
                </div>
                <div class="num mono">{{ r.pct | number:'1.0-1' }}%</div>
              </div>
            }
            @if (rentabilidad().length === 0) {
              <div class="empty">Sin ventas en este período.</div>
            }
          </div>
        </div>
      </div>
    </ion-content>
  `,
  styles: [`
    .range {
      padding: 0 var(--ui-sp-4) var(--ui-sp-3);
      display: flex; align-items: center; gap: var(--ui-sp-3); flex-wrap: wrap;
    }
    .range__label {
      font-size: var(--ui-fs-xs); font-weight: var(--ui-fw-black);
      text-transform: uppercase; letter-spacing: 0.5px; color: var(--ui-text-muted);
    }

    .kpis {
      display: grid; grid-template-columns: repeat(6, 1fr);
      gap: var(--ui-sp-3); padding: 0 var(--ui-sp-4) var(--ui-sp-4);
    }
    @media (max-width: 1200px) { .kpis { grid-template-columns: repeat(3, 1fr); } }
    @media (max-width: 700px) { .kpis { grid-template-columns: 1fr 1fr; } }
    @media (max-width: 400px) { .kpis { grid-template-columns: 1fr; } }

    .grid {
      display: grid; grid-template-columns: 1fr 1fr;
      gap: var(--ui-sp-3); padding: 0 var(--ui-sp-4) var(--ui-sp-8);
    }
    @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
    .card {
      background: var(--ui-surface);
      border: var(--ui-border-w-md) solid var(--ui-border);
      box-shadow: var(--ui-shadow-md);
      padding: var(--ui-sp-3);
    }
    .card--wide { grid-column: 1 / -1; }
    .card__title {
      font-size: var(--ui-fs-sm); font-weight: var(--ui-fw-black);
      text-transform: uppercase; letter-spacing: 0.5px;
      margin: 0 0 var(--ui-sp-2);
    }

    .dual-chart {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--ui-sp-3);
    }
    @media (max-width: 700px) { .dual-chart { grid-template-columns: 1fr; } }
    .dual-chart__sub {
      font-size: var(--ui-fs-xs);
      font-weight: var(--ui-fw-bold);
      color: var(--ui-text-muted);
      margin-bottom: 4px;
    }

    .ok { padding: var(--ui-sp-3); text-align: center; color: var(--ui-success); font-weight: var(--ui-fw-bold); margin: 0; }
    .ok ion-icon { vertical-align: middle; font-size: 18px; }
    .empty { padding: var(--ui-sp-4); text-align: center; color: var(--ui-text-muted); }

    .table {
      border: var(--ui-border-w-sm) solid var(--ui-border);
      background: var(--ui-surface);
    }
    .table__head, .table__row {
      display: grid;
      grid-template-columns: 2fr 80px 110px 110px 110px 90px;
      gap: var(--ui-sp-2);
      padding: 8px var(--ui-sp-3);
      align-items: center;
      font-size: var(--ui-fs-sm);
    }
    .table__head {
      background: var(--ui-text); color: var(--ui-surface);
      font-size: var(--ui-fs-xs); font-weight: var(--ui-fw-black);
      text-transform: uppercase;
    }
    .table__row { border-top: var(--ui-border-w-sm) solid var(--ui-border); }
    .table__row:hover { background: var(--ui-surface-2); }
    .num { text-align: right; }
    .pos { color: var(--ui-success); font-weight: var(--ui-fw-black); }
    .neg { color: var(--ui-danger); font-weight: var(--ui-fw-black); }

    @media (max-width: 700px) {
      .table__head { display: none; }
      .table__row { grid-template-columns: 1fr 1fr; gap: 4px var(--ui-sp-2); }
      .num { text-align: left; }
    }
  `],
})
export class AdminFinancieroPage {
  protected readonly data = inject(DataService);
  readonly range = signal<Range>(30);

  readonly ventasVisibles = computed(() => {
    const cutoff = Date.now() - this.range() * 24 * 60 * 60 * 1000;
    return this.data.sales().filter(s => s.date.getTime() >= cutoff);
  });

  readonly returnsVisibles = computed(() => {
    const cutoff = Date.now() - this.range() * 24 * 60 * 60 * 1000;
    return this.data.returns().filter(r => r.createdAt.getTime() >= cutoff);
  });

  readonly ocsVisibles = computed(() => {
    const cutoff = Date.now() - this.range() * 24 * 60 * 60 * 1000;
    return this.data.purchaseOrders().filter(po => po.status === 'received' && (po.receivedAt?.getTime() ?? 0) >= cutoff);
  });

  readonly ingresos = computed(() => this.ventasVisibles().reduce((s, v) => s + v.total, 0));

  readonly cogs = computed(() => {
    let total = 0;
    for (const v of this.ventasVisibles()) {
      total += this.data.effectiveProductCost(v.productId) * v.qty;
    }
    return Math.round(total);
  });

  readonly margenBruto = computed(() => this.ingresos() - this.cogs());
  readonly margenPct = computed(() => {
    const ing = this.ingresos();
    return ing > 0 ? Math.round((this.margenBruto() / ing) * 100) : 0;
  });

  readonly perdidas = computed(() => this.returnsVisibles().reduce((s, r) => s + r.totalLoss, 0));
  readonly returnsCount = computed(() => this.returnsVisibles().length);

  readonly comprasOC = computed(() => this.ocsVisibles().reduce((s, po) => s + po.totalCost, 0));
  readonly ocsCount = computed(() => this.ocsVisibles().length);

  readonly resultadoNeto = computed(() => this.margenBruto() - this.perdidas());

  readonly seriesIngresos = computed<LinePoint[]>(() => {
    const buckets = this.buildDayBuckets(this.range());
    for (const v of this.ventasVisibles()) {
      const k = this.dayKey(v.date);
      if (buckets.has(k)) buckets.set(k, buckets.get(k)! + v.total);
    }
    return Array.from(buckets.entries()).map(([k, val]) => ({ label: k.slice(5), value: val }));
  });

  readonly seriesCostos = computed<LinePoint[]>(() => {
    const buckets = this.buildDayBuckets(this.range());
    for (const v of this.ventasVisibles()) {
      const cost = this.data.effectiveProductCost(v.productId) * v.qty;
      const k = this.dayKey(v.date);
      if (buckets.has(k)) buckets.set(k, buckets.get(k)! + cost);
    }
    return Array.from(buckets.entries()).map(([k, val]) => ({ label: k.slice(5), value: Math.round(val) }));
  });

  readonly rentabilidad = computed(() => {
    const map = new Map<string, { productId: string; productName: string; qty: number; ingresos: number; costo: number }>();
    for (const v of this.ventasVisibles()) {
      const cost = this.data.effectiveProductCost(v.productId);
      const prev = map.get(v.productId);
      if (prev) {
        prev.qty += v.qty;
        prev.ingresos += v.total;
        prev.costo += cost * v.qty;
      } else {
        map.set(v.productId, {
          productId: v.productId,
          productName: v.productName,
          qty: v.qty,
          ingresos: v.total,
          costo: cost * v.qty,
        });
      }
    }
    return Array.from(map.values())
      .map(r => ({
        ...r,
        margen: r.ingresos - r.costo,
        pct: r.ingresos > 0 ? ((r.ingresos - r.costo) / r.ingresos) * 100 : 0,
      }))
      .sort((a, b) => b.margen - a.margen);
  });

  readonly topMargen = computed<BarItem[]>(() =>
    this.rentabilidad()
      .filter(r => r.margen > 0)
      .slice(0, 8)
      .map(r => ({ label: r.productName, value: Math.round(r.margen) }))
  );

  readonly perdidasPorProducto = computed<BarItem[]>(() => {
    const map = new Map<string, { name: string; loss: number }>();
    for (const r of this.returnsVisibles()) {
      const prev = map.get(r.productId);
      if (prev) prev.loss += r.totalLoss;
      else map.set(r.productId, { name: r.productName, loss: r.totalLoss });
    }
    return Array.from(map.values())
      .sort((a, b) => b.loss - a.loss)
      .slice(0, 8)
      .map(x => ({ label: x.name, value: Math.round(x.loss) }));
  });

  private buildDayBuckets(days: number): Map<string, number> {
    const buckets = new Map<string, number>();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      buckets.set(this.dayKey(d), 0);
    }
    return buckets;
  }
  private dayKey(d: Date): string {
    return d.toISOString().slice(0, 10);
  }
}
