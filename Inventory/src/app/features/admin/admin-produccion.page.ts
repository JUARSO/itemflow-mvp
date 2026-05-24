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
import { DonutChartComponent, DonutSlice } from '../../shared/components/charts/donut-chart.component';
import { OrderStatus } from '../../core/models';

type Range = 7 | 30 | 90;

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: 'var(--ui-warning)',
  in_production: 'var(--ui-transit)',
  completed: 'var(--ui-success)',
  cancelled: 'var(--ui-danger)',
};
const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pendiente',
  in_production: 'En producción',
  completed: 'Completada',
  cancelled: 'Cancelada',
};

@Component({
  selector: 'app-admin-produccion',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe, RouterLink,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
    IonSegment, IonSegmentButton, IonLabel, IonButton, IonIcon,
    PageHeaderComponent, KpiCardComponent,
    LineChartComponent, BarChartComponent, DonutChartComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-menu-button></ion-menu-button></ion-buttons>
        <ion-title>Análisis de Producción</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <app-page-header
        title="Análisis de Producción"
        subtitle="Cumplimiento, distribución por estado, tiempos y faltantes recurrentes.">
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
        <app-kpi-card label="Órdenes totales" [value]="visibles().length" tone="primary"></app-kpi-card>
        <app-kpi-card label="Completadas" [value]="completadasCount()" tone="success"
          [hint]="tasaCumplimiento() + '% de cumplimiento'"></app-kpi-card>
        <app-kpi-card label="En curso" [value]="enCursoCount()" tone="transit"
          [hint]="data.pendingOrders().length + ' pend · ' + data.inProductionOrders().length + ' fab'"></app-kpi-card>
        <app-kpi-card label="Canceladas" [value]="canceladasCount()" tone="danger"></app-kpi-card>
        <app-kpi-card label="Unidades producidas" [value]="unidadesProducidas()" tone="excess"></app-kpi-card>
      </div>

      <div class="grid">
        <div class="card card--wide">
          <h3 class="card__title">Órdenes creadas por día</h3>
          <app-line-chart [points]="ordenesCreadasPorDia()" color="var(--ui-primary)"></app-line-chart>
        </div>

        <div class="card">
          <h3 class="card__title">Distribución por estado</h3>
          <app-donut-chart [data]="distribucionEstados()" centerLabel="ÓRDENES"></app-donut-chart>
        </div>

        <div class="card">
          <h3 class="card__title">Cumplimiento por orden completada</h3>
          @if (cumplimientoPromedio() === null) {
            <p class="empty">No hay órdenes completadas en el período.</p>
          } @else {
            <div class="big-stat">
              <div class="big-stat__value mono">{{ cumplimientoPromedio() | number:'1.0-1' }}%</div>
              <div class="big-stat__label">unidades fabricadas / pedidas</div>
            </div>
            <div class="hint">
              {{ completadasParciales() }} con cumplimiento parcial de {{ completadasCount() }} completadas.
            </div>
          }
        </div>

        <div class="card">
          <h3 class="card__title">Top productos fabricados</h3>
          <app-bar-chart [items]="topFabricados()"
            defaultColor="var(--ui-transit)" valueSuffix=" u"></app-bar-chart>
        </div>

        <div class="card">
          <h3 class="card__title">Faltantes recurrentes (insumos)</h3>
          @if (faltantesRecurrentes().length === 0) {
            <p class="ok"><ion-icon name="checkmark-circle-outline"></ion-icon> Sin faltantes en órdenes recientes.</p>
          } @else {
            <app-bar-chart [items]="faltantesRecurrentes()"
              defaultColor="var(--ui-danger)" valueSuffix=" u"></app-bar-chart>
          }
        </div>

        <div class="card card--wide">
          <h3 class="card__title">Detalle de órdenes recientes</h3>
          <div class="table">
            <div class="table__head">
              <div>Código</div>
              <div>Estado</div>
              <div>Motivo</div>
              <div class="num">Items</div>
              <div class="num">Cumplim.</div>
              <div>Creada</div>
            </div>
            @for (o of recentOrders(); track o.id) {
              <div class="table__row">
                <div class="mono">{{ o.code }}</div>
                <div>
                  <span class="status" [attr.data-status]="o.status">{{ statusLabel(o.status) }}</span>
                </div>
                <div>{{ o.purpose || '—' }}</div>
                <div class="num mono">{{ o.items.length }}</div>
                <div class="num mono">{{ fulfillmentPct(o) | number:'1.0-0' }}%</div>
                <div class="mono small">{{ o.createdAt.toLocaleString() }}</div>
              </div>
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
      display: grid; grid-template-columns: repeat(5, 1fr);
      gap: var(--ui-sp-3); padding: 0 var(--ui-sp-4) var(--ui-sp-4);
    }
    @media (max-width: 1100px) { .kpis { grid-template-columns: repeat(3, 1fr); } }
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

    .big-stat { text-align: center; padding: var(--ui-sp-3); }
    .big-stat__value { font-size: var(--ui-fs-3xl, 32px); font-weight: var(--ui-fw-black); color: var(--ui-success); }
    .big-stat__label { font-size: var(--ui-fs-xs); color: var(--ui-text-muted); }
    .hint { font-size: var(--ui-fs-xs); color: var(--ui-text-muted); text-align: center; }

    .ok { padding: var(--ui-sp-3); text-align: center; color: var(--ui-success); font-weight: var(--ui-fw-bold); }
    .ok ion-icon { vertical-align: middle; font-size: 18px; }
    .empty { padding: var(--ui-sp-3); text-align: center; color: var(--ui-text-muted); }

    .table {
      border: var(--ui-border-w-sm) solid var(--ui-border);
      background: var(--ui-surface);
    }
    .table__head, .table__row {
      display: grid;
      grid-template-columns: 100px 130px 1fr 60px 90px 140px;
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
    .num { text-align: right; }
    .small { font-size: var(--ui-fs-xs); color: var(--ui-text-muted); }

    .status {
      padding: 2px 8px; font-size: 10px; font-weight: var(--ui-fw-black);
      text-transform: uppercase; letter-spacing: 0.5px;
      border: var(--ui-border-w-sm) solid var(--ui-border); background: var(--ui-surface);
    }
    .status[data-status="pending"]       { background: var(--ui-warning); color: #000; }
    .status[data-status="in_production"] { background: var(--ui-transit); color: #fff; }
    .status[data-status="completed"]     { background: var(--ui-success); color: #fff; }
    .status[data-status="cancelled"]     { background: var(--ui-danger); color: #fff; }

    @media (max-width: 700px) {
      .table__head { display: none; }
      .table__row { grid-template-columns: 1fr 1fr; gap: 4px var(--ui-sp-2); }
      .num { text-align: left; }
    }
  `],
})
export class AdminProduccionPage {
  protected readonly data = inject(DataService);
  readonly range = signal<Range>(30);

  readonly visibles = computed(() => {
    const cutoff = Date.now() - this.range() * 24 * 60 * 60 * 1000;
    return this.data.orders().filter(o => o.createdAt.getTime() >= cutoff);
  });

  readonly completadasCount = computed(() => this.visibles().filter(o => o.status === 'completed').length);
  readonly enCursoCount = computed(() => this.visibles().filter(o => o.status === 'pending' || o.status === 'in_production').length);
  readonly canceladasCount = computed(() => this.visibles().filter(o => o.status === 'cancelled').length);

  readonly tasaCumplimiento = computed(() => {
    const total = this.visibles().length;
    if (total === 0) return 0;
    return Math.round((this.completadasCount() / total) * 100);
  });

  readonly unidadesProducidas = computed(() =>
    this.visibles()
      .filter(o => o.status === 'completed' || o.status === 'in_production')
      .reduce((s, o) => s + o.items.reduce((ss, it) => ss + it.fulfilledQty, 0), 0)
  );

  readonly completadasParciales = computed(() =>
    this.visibles().filter(o =>
      o.status === 'completed' && o.items.some(it => it.fulfilledQty < it.qty)
    ).length
  );

  readonly cumplimientoPromedio = computed<number | null>(() => {
    const completadas = this.visibles().filter(o => o.status === 'completed');
    if (completadas.length === 0) return null;
    let totalReq = 0, totalDone = 0;
    for (const o of completadas) {
      for (const it of o.items) {
        totalReq += it.qty;
        totalDone += it.fulfilledQty;
      }
    }
    return totalReq > 0 ? (totalDone / totalReq) * 100 : 0;
  });

  readonly ordenesCreadasPorDia = computed<LinePoint[]>(() => {
    const buckets = this.buildDayBuckets(this.range());
    for (const o of this.visibles()) {
      const k = this.dayKey(o.createdAt);
      if (buckets.has(k)) buckets.set(k, buckets.get(k)! + 1);
    }
    return Array.from(buckets.entries()).map(([k, v]) => ({ label: k.slice(5), value: v }));
  });

  readonly distribucionEstados = computed<DonutSlice[]>(() => {
    const counts = new Map<OrderStatus, number>();
    for (const o of this.visibles()) counts.set(o.status, (counts.get(o.status) ?? 0) + 1);
    return Array.from(counts.entries()).map(([s, v]) => ({
      label: STATUS_LABELS[s],
      value: v,
      color: STATUS_COLORS[s],
    }));
  });

  readonly topFabricados = computed<BarItem[]>(() => {
    const map = new Map<string, { name: string; qty: number }>();
    for (const o of this.visibles()) {
      if (o.status !== 'completed' && o.status !== 'in_production') continue;
      for (const it of o.items) {
        if (it.fulfilledQty <= 0) continue;
        const prev = map.get(it.productId);
        if (prev) prev.qty += it.fulfilledQty;
        else map.set(it.productId, { name: it.productName, qty: it.fulfilledQty });
      }
    }
    return Array.from(map.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10)
      .map(x => ({ label: x.name, value: x.qty }));
  });

  readonly faltantesRecurrentes = computed<BarItem[]>(() => {
    const map = new Map<string, { name: string; short: number }>();
    for (const o of this.visibles()) {
      for (const sf of o.shortfalls) {
        const key = `${sf.kind}:${sf.itemId}`;
        const prev = map.get(key);
        if (prev) prev.short += sf.short;
        else map.set(key, { name: sf.itemName, short: sf.short });
      }
    }
    return Array.from(map.values())
      .sort((a, b) => b.short - a.short)
      .slice(0, 8)
      .map(x => ({ label: x.name, value: x.short }));
  });

  readonly recentOrders = computed(() =>
    [...this.visibles()]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 15)
  );

  statusLabel(s: OrderStatus): string {
    return STATUS_LABELS[s];
  }

  fulfillmentPct(o: { items: { qty: number; fulfilledQty: number }[] }): number {
    const req = o.items.reduce((s, it) => s + it.qty, 0);
    const done = o.items.reduce((s, it) => s + it.fulfilledQty, 0);
    return req > 0 ? (done / req) * 100 : 0;
  }

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
