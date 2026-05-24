import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
  IonSegment, IonSegmentButton, IonLabel, IonButton,
} from '@ionic/angular/standalone';
import { DataService } from '../../core/services/data.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { LineChartComponent, LinePoint } from '../../shared/components/charts/line-chart.component';
import { BarChartComponent, BarItem } from '../../shared/components/charts/bar-chart.component';

type Range = 7 | 30 | 90;

@Component({
  selector: 'app-admin-ventas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe, RouterLink,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
    IonSegment, IonSegmentButton, IonLabel, IonButton,
    PageHeaderComponent, KpiCardComponent, LineChartComponent, BarChartComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-menu-button></ion-menu-button></ion-buttons>
        <ion-title>Análisis de Ventas</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <app-page-header
        title="Análisis de Ventas"
        subtitle="Tendencias, productos más vendidos y desempeño por categoría.">
        <ion-button fill="outline" routerLink="/admin">← Dashboard</ion-button>
      </app-page-header>

      <div class="range">
        <span class="range__label">Período de análisis</span>
        <ion-segment [value]="range()" (ionChange)="range.set($any($event.detail.value))">
          <ion-segment-button [value]="7"><ion-label>7 días</ion-label></ion-segment-button>
          <ion-segment-button [value]="30"><ion-label>30 días</ion-label></ion-segment-button>
          <ion-segment-button [value]="90"><ion-label>90 días</ion-label></ion-segment-button>
        </ion-segment>
      </div>

      <div class="kpis">
        <app-kpi-card label="Total ventas" [value]="visibles().length" tone="primary"></app-kpi-card>
        <app-kpi-card label="Unidades" [value]="totalUnidades()" tone="transit"></app-kpi-card>
        <app-kpi-card label="Ingresos" [value]="'₡' + (totalIngresos() | number:'1.0-0')" tone="success"></app-kpi-card>
        <app-kpi-card label="Ticket promedio" [value]="'₡' + (ticketPromedio() | number:'1.0-0')" tone="warning"
          hint="ingreso / cantidad de ventas"></app-kpi-card>
        <app-kpi-card label="SKUs vendidos" [value]="skusUnicos()" tone="excess"
          hint="productos distintos en el período"></app-kpi-card>
      </div>

      <div class="grid">
        <div class="card card--wide">
          <h3 class="card__title">Ingresos por día</h3>
          <app-line-chart [points]="seriesIngresos()" color="var(--ui-success)"></app-line-chart>
        </div>

        <div class="card card--wide">
          <h3 class="card__title">Unidades vendidas por día</h3>
          <app-line-chart [points]="seriesUnidades()" color="var(--ui-primary)"></app-line-chart>
        </div>

        <div class="card">
          <h3 class="card__title">Top 10 productos (unidades)</h3>
          <app-bar-chart [items]="topPorUnidades()"
            defaultColor="var(--ui-primary)" valueSuffix=" u"></app-bar-chart>
        </div>

        <div class="card">
          <h3 class="card__title">Top 10 productos (ingresos)</h3>
          <app-bar-chart [items]="topPorIngresos()"
            defaultColor="var(--ui-success)" valuePrefix="₡"></app-bar-chart>
        </div>

        <div class="card card--wide">
          <h3 class="card__title">Ranking completo de productos</h3>
          <div class="table">
            <div class="table__head">
              <div>Producto</div>
              <div class="num">Unidades</div>
              <div class="num">Ingresos</div>
              <div class="num">% total</div>
              <div class="num">Precio prom.</div>
            </div>
            @for (r of rankingProductos(); track r.productId) {
              <div class="table__row">
                <div>{{ r.productName }}</div>
                <div class="num mono">{{ r.qty | number:'1.0-0' }}</div>
                <div class="num mono">₡{{ r.ingresos | number:'1.0-0' }}</div>
                <div class="num mono">{{ r.pct | number:'1.0-1' }}%</div>
                <div class="num mono">₡{{ r.avgPrice | number:'1.0-0' }}</div>
              </div>
            }
            @if (rankingProductos().length === 0) {
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
      display: flex;
      align-items: center;
      gap: var(--ui-sp-3);
      flex-wrap: wrap;
    }
    .range__label {
      font-size: var(--ui-fs-xs);
      font-weight: var(--ui-fw-black);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--ui-text-muted);
    }
    .kpis {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: var(--ui-sp-3);
      padding: 0 var(--ui-sp-4) var(--ui-sp-4);
    }
    @media (max-width: 1100px) { .kpis { grid-template-columns: repeat(3, 1fr); } }
    @media (max-width: 700px) { .kpis { grid-template-columns: 1fr 1fr; } }
    @media (max-width: 400px) { .kpis { grid-template-columns: 1fr; } }

    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--ui-sp-3);
      padding: 0 var(--ui-sp-4) var(--ui-sp-8);
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
      font-size: var(--ui-fs-sm);
      font-weight: var(--ui-fw-black);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 0 0 var(--ui-sp-2);
    }

    .table {
      border: var(--ui-border-w-sm) solid var(--ui-border);
      background: var(--ui-surface);
    }
    .table__head, .table__row {
      display: grid;
      grid-template-columns: 2fr 100px 110px 80px 110px;
      gap: var(--ui-sp-2);
      padding: 8px var(--ui-sp-3);
      align-items: center;
      font-size: var(--ui-fs-sm);
    }
    .table__head {
      background: var(--ui-text);
      color: var(--ui-surface);
      font-size: var(--ui-fs-xs);
      font-weight: var(--ui-fw-black);
      text-transform: uppercase;
    }
    .table__row { border-top: var(--ui-border-w-sm) solid var(--ui-border); }
    .table__row:hover { background: var(--ui-surface-2); }
    .num { text-align: right; }
    .empty { padding: var(--ui-sp-4); text-align: center; color: var(--ui-text-muted); }

    @media (max-width: 600px) {
      .table__head { display: none; }
      .table__row { grid-template-columns: 1fr 1fr; gap: 4px var(--ui-sp-2); }
      .num { text-align: left; }
    }
  `],
})
export class AdminVentasPage {
  protected readonly data = inject(DataService);
  readonly range = signal<Range>(30);

  readonly visibles = computed(() => {
    const cutoff = Date.now() - this.range() * 24 * 60 * 60 * 1000;
    return this.data.sales().filter(s => s.date.getTime() >= cutoff);
  });

  readonly totalIngresos = computed(() => this.visibles().reduce((s, v) => s + v.total, 0));
  readonly totalUnidades = computed(() => this.visibles().reduce((s, v) => s + v.qty, 0));
  readonly ticketPromedio = computed(() => {
    const n = this.visibles().length;
    return n > 0 ? this.totalIngresos() / n : 0;
  });
  readonly skusUnicos = computed(() => new Set(this.visibles().map(v => v.productId)).size);

  readonly seriesIngresos = computed<LinePoint[]>(() => {
    const buckets = this.buildDayBuckets(this.range());
    for (const v of this.visibles()) {
      const key = this.dayKey(v.date);
      if (buckets.has(key)) buckets.set(key, buckets.get(key)! + v.total);
    }
    return Array.from(buckets.entries()).map(([k, val]) => ({ label: k.slice(5), value: val }));
  });

  readonly seriesUnidades = computed<LinePoint[]>(() => {
    const buckets = this.buildDayBuckets(this.range());
    for (const v of this.visibles()) {
      const key = this.dayKey(v.date);
      if (buckets.has(key)) buckets.set(key, buckets.get(key)! + v.qty);
    }
    return Array.from(buckets.entries()).map(([k, val]) => ({ label: k.slice(5), value: val }));
  });

  readonly rankingProductos = computed(() => {
    const map = new Map<string, { productId: string; productName: string; qty: number; ingresos: number }>();
    for (const v of this.visibles()) {
      const prev = map.get(v.productId);
      if (prev) { prev.qty += v.qty; prev.ingresos += v.total; }
      else map.set(v.productId, { productId: v.productId, productName: v.productName, qty: v.qty, ingresos: v.total });
    }
    const total = this.totalIngresos() || 1;
    return Array.from(map.values())
      .sort((a, b) => b.ingresos - a.ingresos)
      .map(r => ({
        ...r,
        pct: (r.ingresos / total) * 100,
        avgPrice: r.qty > 0 ? r.ingresos / r.qty : 0,
      }));
  });

  readonly topPorUnidades = computed<BarItem[]>(() =>
    [...this.rankingProductos()]
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10)
      .map(r => ({ label: r.productName, value: r.qty }))
  );

  readonly topPorIngresos = computed<BarItem[]>(() =>
    this.rankingProductos()
      .slice(0, 10)
      .map(r => ({ label: r.productName, value: r.ingresos }))
  );

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
