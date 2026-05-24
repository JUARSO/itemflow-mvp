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
import { DonutChartComponent, DonutSlice } from '../../shared/components/charts/donut-chart.component';
import { ReturnReason } from '../../core/models';

type Range = 7 | 30 | 90;

const REASON_COLORS: Record<ReturnReason, string> = {
  defective: 'var(--ui-danger)',
  expired: 'var(--ui-warning)',
  leftover: 'var(--ui-transit)',
  damaged: 'var(--ui-excess)',
  other: 'var(--ui-surface-3)',
};
const REASON_LABELS: Record<ReturnReason, string> = {
  defective: 'Defectuoso',
  expired: 'Vencido',
  leftover: 'Sobra fin de día',
  damaged: 'Daño',
  other: 'Otro',
};

@Component({
  selector: 'app-admin-devoluciones',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe, RouterLink,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
    IonSegment, IonSegmentButton, IonLabel, IonButton,
    PageHeaderComponent, KpiCardComponent,
    LineChartComponent, BarChartComponent, DonutChartComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-menu-button></ion-menu-button></ion-buttons>
        <ion-title>Análisis de Devoluciones</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <app-page-header
        title="Análisis de Devoluciones"
        subtitle="Distribución por motivo, productos más problemáticos y tasa de devolución sobre ventas.">
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
        <app-kpi-card label="Total devoluciones" [value]="visibles().length" tone="warning"></app-kpi-card>
        <app-kpi-card label="Unidades devueltas" [value]="totalUnidades()" tone="excess"></app-kpi-card>
        <app-kpi-card label="Pérdida total" [value]="'₡' + (totalPerdida() | number:'1.0-0')" tone="danger"></app-kpi-card>
        <app-kpi-card label="Tasa devolución" [value]="tasaDevolucion() + '%'" tone="primary"
          hint="devueltas / vendidas"></app-kpi-card>
        <app-kpi-card label="Motivo principal" [value]="motivoTop()" tone="transit"></app-kpi-card>
      </div>

      <div class="grid">
        <div class="card card--wide">
          <h3 class="card__title">Devoluciones por día (unidades)</h3>
          <app-line-chart [points]="seriesDevoluciones()" color="var(--ui-danger)"></app-line-chart>
        </div>

        <div class="card">
          <h3 class="card__title">Distribución por motivo (unidades)</h3>
          <app-donut-chart [data]="distribucionMotivos()" centerLabel="UNIDADES"></app-donut-chart>
        </div>

        <div class="card">
          <h3 class="card__title">Pérdida por motivo</h3>
          <app-donut-chart [data]="distribucionPorPerdida()" centerLabel="PÉRDIDA"></app-donut-chart>
        </div>

        <div class="card">
          <h3 class="card__title">Top productos devueltos (unidades)</h3>
          <app-bar-chart [items]="topProductos()"
            defaultColor="var(--ui-danger)" valueSuffix=" u"></app-bar-chart>
        </div>

        <div class="card">
          <h3 class="card__title">Top productos por pérdida</h3>
          <app-bar-chart [items]="topPorPerdida()"
            defaultColor="var(--ui-excess)" valuePrefix="₡"></app-bar-chart>
        </div>

        <div class="card card--wide">
          <h3 class="card__title">Detalle de devoluciones recientes</h3>
          <div class="table">
            <div class="table__head">
              <div>Fecha</div>
              <div>Producto</div>
              <div>Motivo</div>
              <div class="num">Cantidad</div>
              <div class="num">Pérdida</div>
              <div>Por</div>
            </div>
            @for (r of recent(); track r.id) {
              <div class="table__row">
                <div class="mono small">{{ r.createdAt.toLocaleString() }}</div>
                <div>{{ r.productName }}</div>
                <div>
                  <span class="reason" [attr.data-reason]="r.reason">{{ reasonLabel(r.reason) }}</span>
                </div>
                <div class="num mono">{{ r.qty }} {{ r.unit }}</div>
                <div class="num mono loss">₡{{ r.totalLoss | number:'1.0-0' }}</div>
                <div class="small">{{ r.createdBy }}</div>
              </div>
            }
            @if (recent().length === 0) {
              <div class="empty">Sin devoluciones en este período.</div>
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

    .table {
      border: var(--ui-border-w-sm) solid var(--ui-border);
      background: var(--ui-surface);
    }
    .table__head, .table__row {
      display: grid;
      grid-template-columns: 150px 1.5fr 120px 90px 110px 120px;
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
    .loss { color: var(--ui-danger); font-weight: var(--ui-fw-black); }
    .small { font-size: var(--ui-fs-xs); color: var(--ui-text-muted); }
    .empty { padding: var(--ui-sp-4); text-align: center; color: var(--ui-text-muted); }

    .reason {
      display: inline-block; padding: 2px 8px;
      font-size: 10px; font-weight: var(--ui-fw-black);
      text-transform: uppercase; letter-spacing: 0.5px;
      border: var(--ui-border-w-sm) solid var(--ui-border);
      background: var(--ui-surface);
    }
    .reason[data-reason="defective"] { background: var(--ui-danger); color: #fff; }
    .reason[data-reason="expired"]   { background: var(--ui-warning); color: #000; }
    .reason[data-reason="leftover"]  { background: var(--ui-transit); color: #fff; }
    .reason[data-reason="damaged"]   { background: var(--ui-excess); color: #fff; }
    .reason[data-reason="other"]     { background: var(--ui-surface-3); color: var(--ui-text); }

    @media (max-width: 700px) {
      .table__head { display: none; }
      .table__row { grid-template-columns: 1fr 1fr; gap: 4px var(--ui-sp-2); }
      .num { text-align: left; }
    }
  `],
})
export class AdminDevolucionesPage {
  protected readonly data = inject(DataService);
  readonly range = signal<Range>(30);

  readonly visibles = computed(() => {
    const cutoff = Date.now() - this.range() * 24 * 60 * 60 * 1000;
    return this.data.returns().filter(r => r.createdAt.getTime() >= cutoff);
  });

  readonly ventasEnRango = computed(() => {
    const cutoff = Date.now() - this.range() * 24 * 60 * 60 * 1000;
    return this.data.sales().filter(s => s.date.getTime() >= cutoff);
  });

  readonly totalUnidades = computed(() => this.visibles().reduce((s, r) => s + r.qty, 0));
  readonly totalPerdida = computed(() => this.visibles().reduce((s, r) => s + r.totalLoss, 0));

  readonly tasaDevolucion = computed(() => {
    const vendidas = this.ventasEnRango().reduce((s, v) => s + v.qty, 0);
    if (vendidas === 0) return 0;
    return Math.round((this.totalUnidades() / vendidas) * 100 * 10) / 10;
  });

  readonly motivoTop = computed(() => {
    const counts = new Map<ReturnReason, number>();
    for (const r of this.visibles()) {
      counts.set(r.reason, (counts.get(r.reason) ?? 0) + r.qty);
    }
    if (counts.size === 0) return '—';
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    return REASON_LABELS[top[0]];
  });

  readonly seriesDevoluciones = computed<LinePoint[]>(() => {
    const buckets = this.buildDayBuckets(this.range());
    for (const r of this.visibles()) {
      const k = this.dayKey(r.createdAt);
      if (buckets.has(k)) buckets.set(k, buckets.get(k)! + r.qty);
    }
    return Array.from(buckets.entries()).map(([k, v]) => ({ label: k.slice(5), value: v }));
  });

  readonly distribucionMotivos = computed<DonutSlice[]>(() => {
    const counts = new Map<ReturnReason, number>();
    for (const r of this.visibles()) {
      counts.set(r.reason, (counts.get(r.reason) ?? 0) + r.qty);
    }
    return Array.from(counts.entries()).map(([reason, value]) => ({
      label: REASON_LABELS[reason],
      value,
      color: REASON_COLORS[reason],
    }));
  });

  readonly distribucionPorPerdida = computed<DonutSlice[]>(() => {
    const counts = new Map<ReturnReason, number>();
    for (const r of this.visibles()) {
      counts.set(r.reason, (counts.get(r.reason) ?? 0) + r.totalLoss);
    }
    return Array.from(counts.entries()).map(([reason, value]) => ({
      label: REASON_LABELS[reason],
      value: Math.round(value),
      color: REASON_COLORS[reason],
    }));
  });

  readonly topProductos = computed<BarItem[]>(() => {
    const map = new Map<string, { name: string; qty: number }>();
    for (const r of this.visibles()) {
      const prev = map.get(r.productId);
      if (prev) prev.qty += r.qty;
      else map.set(r.productId, { name: r.productName, qty: r.qty });
    }
    return Array.from(map.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 8)
      .map(x => ({ label: x.name, value: x.qty }));
  });

  readonly topPorPerdida = computed<BarItem[]>(() => {
    const map = new Map<string, { name: string; loss: number }>();
    for (const r of this.visibles()) {
      const prev = map.get(r.productId);
      if (prev) prev.loss += r.totalLoss;
      else map.set(r.productId, { name: r.productName, loss: r.totalLoss });
    }
    return Array.from(map.values())
      .sort((a, b) => b.loss - a.loss)
      .slice(0, 8)
      .map(x => ({ label: x.name, value: Math.round(x.loss) }));
  });

  readonly recent = computed(() =>
    [...this.visibles()]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 20)
  );

  reasonLabel(r: ReturnReason): string {
    return REASON_LABELS[r];
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
