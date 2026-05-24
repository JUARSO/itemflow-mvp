import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
  IonBadge, IonIcon,
} from '@ionic/angular/standalone';
import { DataService } from '../../core/services/data.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { LineChartComponent, LinePoint } from '../../shared/components/charts/line-chart.component';
import { BarChartComponent, BarItem } from '../../shared/components/charts/bar-chart.component';
import { DonutChartComponent, DonutSlice } from '../../shared/components/charts/donut-chart.component';
import { KpiSparklineCardComponent } from '../../shared/components/charts/kpi-sparkline-card.component';
import { OrderStatus, ReturnReason } from '../../core/models';

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
  leftover: 'Sobra',
  damaged: 'Daño',
  other: 'Otro',
};
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
  selector: 'app-admin-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe, RouterLink,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton, IonBadge, IonIcon,
    PageHeaderComponent,
    LineChartComponent, BarChartComponent, DonutChartComponent, KpiSparklineCardComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-menu-button></ion-menu-button></ion-buttons>
        <ion-title>Administración</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <app-page-header
        title="Dashboard"
        subtitle="Resumen global de la operación. Navega a un área para ver análisis detallado.">
      </app-page-header>

      <!-- KPIs globales con sparklines -->
      <div class="kpis">
        <app-kpi-sparkline-card
          period="Hoy"
          label="Ingresos"
          [value]="'₡' + (ingresosHoy() | number:'1.0-0')"
          tone="success"
          [series]="ingresos7dSerie()"
          footer="Ventas del día"
          [delta]="deltaIngresos()">
        </app-kpi-sparkline-card>

        <app-kpi-sparkline-card
          period="Hoy"
          label="Ventas"
          [value]="ventasHoy()"
          tone="primary"
          [series]="ventas7dSerie()"
          [footer]="totalUnidadesHoy() + ' unidades'">
        </app-kpi-sparkline-card>

        <app-kpi-sparkline-card
          period="Ahora"
          label="Órdenes abiertas"
          [value]="data.openOrders().length"
          tone="warning"
          [series]="ordenes7dSerie()"
          [footer]="data.pendingOrders().length + ' pend · ' + data.inProductionOrders().length + ' en fab'">
        </app-kpi-sparkline-card>

        <app-kpi-sparkline-card
          period="Ahora"
          label="Alertas activas"
          [value]="data.activeAlerts().length"
          tone="danger"
          [hint]="data.alertsHighPriority() + ' críticas / ' + data.alertsMediumPriority() + ' medias'"
          footer="Stock + boosts">
        </app-kpi-sparkline-card>

        <app-kpi-sparkline-card
          period="Snapshot"
          label="Valor inventario"
          [value]="'₡' + (valorInventario() | number:'1.0-0')"
          tone="transit"
          [hint]="'Insumos + producto terminado'"
          footer="Costo total en stock">
        </app-kpi-sparkline-card>

        <app-kpi-sparkline-card
          period="30 días"
          label="Pérdida devoluciones"
          [value]="'₡' + (perdidaMes() | number:'1.0-0')"
          tone="excess"
          [series]="perdidas7dSerie()"
          [footer]="returnsMes().length + ' devoluciones'">
        </app-kpi-sparkline-card>
      </div>

      <!-- Accesos rápidos por área -->
      <h3 class="section-title">Áreas administrativas</h3>
      <div class="tiles">
        <a routerLink="/admin/ventas" class="tile">
          <ion-icon class="tile__icon" name="cash-outline"></ion-icon>
          <div>
            <div class="tile__title">Análisis de Ventas</div>
            <div class="tile__desc">Tendencias, top productos, rankings</div>
          </div>
        </a>
        <a routerLink="/admin/produccion" class="tile">
          <ion-icon class="tile__icon" name="hammer-outline"></ion-icon>
          <div>
            <div class="tile__title">Análisis de Producción</div>
            <div class="tile__desc">Cumplimiento, estados, faltantes</div>
          </div>
        </a>
        <a routerLink="/admin/financiero" class="tile">
          <ion-icon class="tile__icon" name="pie-chart-outline"></ion-icon>
          <div>
            <div class="tile__title">Análisis Financiero</div>
            <div class="tile__desc">Ingresos, costos, márgenes</div>
          </div>
        </a>
        <a routerLink="/admin/devoluciones" class="tile">
          <ion-icon class="tile__icon" name="return-up-back-outline"></ion-icon>
          <div>
            <div class="tile__title">Análisis de Devoluciones</div>
            <div class="tile__desc">Motivos, productos problemáticos</div>
          </div>
        </a>
      </div>

      <!-- Grid 2 columnas con gráficas resumidas -->
      <div class="grid">
        <div class="card">
          <h3 class="card__title">Ventas últimos 7 días</h3>
          <app-line-chart [points]="ventas7d()" color="var(--ui-success)"></app-line-chart>
          <div class="card__foot">
            <span><strong>{{ totalVentas7d() }}</strong> ventas · </span>
            <span><strong>₡{{ totalIngresos7d() | number:'1.0-0' }}</strong> ingresos</span>
          </div>
        </div>

        <div class="card">
          <h3 class="card__title">Top 5 productos vendidos (30d)</h3>
          <app-bar-chart [items]="topProductos()"
            defaultColor="var(--ui-primary)" valueSuffix=" u"></app-bar-chart>
        </div>

        <div class="card">
          <h3 class="card__title">Órdenes de producción por estado</h3>
          <app-donut-chart [data]="ordenesPorEstado()" centerLabel="ÓRDENES"></app-donut-chart>
        </div>

        <div class="card">
          <h3 class="card__title">Motivos de devolución (mes)</h3>
          <app-donut-chart [data]="motivosDevolucion()" centerLabel="UNIDADES"></app-donut-chart>
        </div>

        <div class="card">
          <h3 class="card__title">Stock crítico y bajo</h3>
          @if (stockEnRiesgo().length === 0) {
            <p class="ok"><ion-icon name="checkmark-circle-outline"></ion-icon> Todo el stock está dentro de niveles normales.</p>
          } @else {
            <app-bar-chart [items]="stockEnRiesgo()" valueSuffix=" und"></app-bar-chart>
          }
        </div>

        <div class="card">
          <h3 class="card__title">Alertas activas recientes</h3>
          @if (data.activeAlerts().length === 0) {
            <p class="ok"><ion-icon name="checkmark-circle-outline"></ion-icon> Sin alertas activas.</p>
          } @else {
            <ul class="alerts">
              @for (a of alertasRecientes(); track a.id) {
                <li class="alert" [attr.data-priority]="a.priority">
                  <span class="alert__pri">{{ a.priority }}</span>
                  <span class="alert__msg">{{ a.itemName }}: {{ a.message }}</span>
                </li>
              }
            </ul>
            @if (data.activeAlerts().length > 5) {
              <a routerLink="/alertas" class="see-more">Ver todas →</a>
            }
          }
        </div>
      </div>

      <!-- Accesos rápidos a todas las funcionalidades -->
      <h3 class="section-title">Funcionalidades</h3>
      <div class="funcs">
        <a routerLink="/pedidos" class="func"><ion-icon name="receipt-outline"></ion-icon> Órdenes a producción <ion-badge color="primary">{{ data.openOrders().length }}</ion-badge></a>
        <a routerLink="/produccion" class="func"><ion-icon name="hammer-outline"></ion-icon> Cola de producción</a>
        <a routerLink="/ventas" class="func"><ion-icon name="cash-outline"></ion-icon> Vender</a>
        <a routerLink="/devoluciones" class="func"><ion-icon name="return-up-back-outline"></ion-icon> Devoluciones</a>
        <a routerLink="/catalogo" class="func"><ion-icon name="library-outline"></ion-icon> Catálogo</a>
        <a routerLink="/insumos" class="func"><ion-icon name="leaf-outline"></ion-icon> Insumos</a>
        <a routerLink="/recetas" class="func"><ion-icon name="book-outline"></ion-icon> Recetas</a>
        <a routerLink="/inventario" class="func"><ion-icon name="cube-outline"></ion-icon> Inventario</a>
        <a routerLink="/ajustes" class="func"><ion-icon name="create-outline"></ion-icon> Ajustes de stock</a>
        <a routerLink="/ordenes-compra" class="func"><ion-icon name="document-text-outline"></ion-icon> Órdenes de compra</a>
        <a routerLink="/alertas" class="func"><ion-icon name="notifications-outline"></ion-icon> Alertas <ion-badge color="danger">{{ data.activeAlerts().length }}</ion-badge></a>
        <a routerLink="/boosts" class="func"><ion-icon name="flash-outline"></ion-icon> Boosts demanda</a>
        <a routerLink="/predicciones" class="func"><ion-icon name="trending-up-outline"></ion-icon> Predicciones</a>
        <a routerLink="/burn-down" class="func"><ion-icon name="trending-down-outline"></ion-icon> Análisis stock</a>
        <a routerLink="/mas" class="func"><ion-icon name="settings-outline"></ion-icon> Configuración</a>
      </div>
    </ion-content>
  `,
  styles: [`
    .kpis {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--ui-sp-3);
      padding: 0 var(--ui-sp-4) var(--ui-sp-4);
    }
    @media (min-width: 1400px) { .kpis { grid-template-columns: repeat(6, 1fr); } }
    @media (max-width: 900px) { .kpis { grid-template-columns: 1fr 1fr; } }
    @media (max-width: 480px) { .kpis { grid-template-columns: 1fr; } }

    .section-title {
      font-family: var(--ui-font-display);
      font-size: var(--ui-fs-lg);
      font-weight: var(--ui-fw-black);
      margin: var(--ui-sp-4) var(--ui-sp-4) var(--ui-sp-2);
      color: var(--ui-text);
    }

    .tiles {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: var(--ui-sp-3);
      padding: 0 var(--ui-sp-4) var(--ui-sp-4);
    }
    @media (max-width: 900px) { .tiles { grid-template-columns: 1fr 1fr; } }
    @media (max-width: 480px) { .tiles { grid-template-columns: 1fr; } }
    .tile {
      display: flex;
      gap: var(--ui-sp-3);
      align-items: center;
      padding: var(--ui-sp-3);
      background: var(--ui-surface);
      border: var(--ui-border-w-md) solid var(--ui-border);
      box-shadow: var(--ui-shadow-md);
      color: var(--ui-text);
      text-decoration: none;
    }
    .tile:hover { background: var(--ui-surface-2); }
    .tile:active { box-shadow: none; transform: translate(2px, 2px); }
    .tile__icon { font-size: 28px; color: var(--ui-primary); flex-shrink: 0; }
    .tile__title { font-weight: var(--ui-fw-black); font-size: var(--ui-fs-md); }
    .tile__desc { font-size: var(--ui-fs-xs); color: var(--ui-text-muted); margin-top: 2px; }

    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--ui-sp-3);
      padding: 0 var(--ui-sp-4) var(--ui-sp-4);
    }
    @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }

    .card {
      background: var(--ui-surface);
      border: var(--ui-border-w-md) solid var(--ui-border);
      box-shadow: var(--ui-shadow-md);
      padding: var(--ui-sp-3);
    }
    .card__title {
      font-size: var(--ui-fs-sm);
      font-weight: var(--ui-fw-black);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 0 0 var(--ui-sp-2);
      color: var(--ui-text);
    }
    .card__foot {
      margin-top: var(--ui-sp-2);
      font-size: var(--ui-fs-xs);
      color: var(--ui-text-muted);
    }
    .ok {
      padding: var(--ui-sp-3);
      text-align: center;
      color: var(--ui-success);
      font-weight: var(--ui-fw-bold);
      margin: 0;
    }
    .ok ion-icon { vertical-align: middle; font-size: 18px; }

    .alerts { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 4px; }
    .alert {
      display: flex;
      gap: var(--ui-sp-2);
      align-items: center;
      padding: 6px 8px;
      border-left: 4px solid var(--ui-surface-3);
      background: var(--ui-surface-2);
      font-size: var(--ui-fs-xs);
    }
    .alert[data-priority="high"]   { border-left-color: var(--ui-danger); }
    .alert[data-priority="medium"] { border-left-color: var(--ui-warning); }
    .alert[data-priority="low"]    { border-left-color: var(--ui-transit); }
    .alert__pri {
      font-weight: var(--ui-fw-black);
      text-transform: uppercase;
      font-size: 9px;
      color: var(--ui-text-muted);
      min-width: 40px;
    }
    .see-more {
      display: block;
      margin-top: var(--ui-sp-2);
      font-size: var(--ui-fs-xs);
      color: var(--ui-primary);
      font-weight: var(--ui-fw-bold);
      text-decoration: none;
    }

    .funcs {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 6px;
      padding: 0 var(--ui-sp-4) var(--ui-sp-8);
    }
    .func {
      display: flex;
      align-items: center;
      gap: var(--ui-sp-2);
      padding: var(--ui-sp-2) var(--ui-sp-3);
      background: var(--ui-surface);
      border: var(--ui-border-w-sm) solid var(--ui-border);
      color: var(--ui-text);
      text-decoration: none;
      font-size: var(--ui-fs-sm);
      font-weight: var(--ui-fw-bold);
    }
    .func:hover { background: var(--ui-surface-2); }
    .func ion-icon { font-size: 18px; color: var(--ui-text-muted); flex-shrink: 0; }
    .func:hover ion-icon { color: var(--ui-primary); }
    .func ion-badge { margin-left: auto; }
  `],
})
export class AdminDashboardPage {
  protected readonly data = inject(DataService);

  private readonly cutoffMs = (days: number) => Date.now() - days * 24 * 60 * 60 * 1000;

  readonly ventasDeHoy = computed(() =>
    this.data.sales().filter(v => v.date.getTime() >= this.cutoffMs(1))
  );
  readonly ventasHoy = computed(() => this.ventasDeHoy().length);
  readonly ingresosHoy = computed(() => this.ventasDeHoy().reduce((s, v) => s + v.total, 0));
  readonly totalUnidadesHoy = computed(() => this.ventasDeHoy().reduce((s, v) => s + v.qty, 0));

  /** Suma del costo × quantity de todos los stocks. */
  readonly valorInventario = computed(() => {
    let total = 0;
    for (const ss of this.data.supplyStock()) {
      const supply = this.data.supplies().find(s => s.id === ss.supplyId);
      if (supply) total += supply.cost * ss.quantity;
    }
    for (const ps of this.data.productStock()) {
      total += this.data.effectiveProductCost(ps.productId) * ps.quantity;
    }
    return Math.round(total);
  });

  readonly returnsMes = computed(() =>
    this.data.returns().filter(r => r.createdAt.getTime() >= this.cutoffMs(30))
  );
  readonly perdidaMes = computed(() => this.returnsMes().reduce((s, r) => s + r.totalLoss, 0));

  /** Serie ventas últimos 7 días: ingresos por día. */
  readonly ventas7d = computed<LinePoint[]>(() => {
    const buckets = this.buildDayBuckets(7);
    for (const v of this.data.sales()) {
      const key = this.dayKey(v.date);
      if (buckets.has(key)) buckets.set(key, buckets.get(key)! + v.total);
    }
    return Array.from(buckets.entries()).map(([key, val]) => ({ label: key.slice(5), value: val }));
  });

  /** Alias para sparkline de ingresos (mismo dataset). */
  readonly ingresos7dSerie = computed(() => this.ventas7d());

  /** Serie de cantidad de ventas (no monto) por día. */
  readonly ventas7dSerie = computed<LinePoint[]>(() => {
    const buckets = this.buildDayBuckets(7);
    for (const v of this.data.sales()) {
      const key = this.dayKey(v.date);
      if (buckets.has(key)) buckets.set(key, buckets.get(key)! + 1);
    }
    return Array.from(buckets.entries()).map(([k, v]) => ({ label: k.slice(5), value: v }));
  });

  /** Órdenes creadas por día (últimos 7d). */
  readonly ordenes7dSerie = computed<LinePoint[]>(() => {
    const buckets = this.buildDayBuckets(7);
    for (const o of this.data.orders()) {
      const key = this.dayKey(o.createdAt);
      if (buckets.has(key)) buckets.set(key, buckets.get(key)! + 1);
    }
    return Array.from(buckets.entries()).map(([k, v]) => ({ label: k.slice(5), value: v }));
  });

  /** Pérdidas por devolución por día (últimos 7d). */
  readonly perdidas7dSerie = computed<LinePoint[]>(() => {
    const buckets = this.buildDayBuckets(7);
    for (const r of this.data.returns()) {
      const key = this.dayKey(r.createdAt);
      if (buckets.has(key)) buckets.set(key, buckets.get(key)! + r.totalLoss);
    }
    return Array.from(buckets.entries()).map(([k, v]) => ({ label: k.slice(5), value: v }));
  });

  /** Delta % de ingresos hoy vs ayer (para badge en sparkline card). */
  readonly deltaIngresos = computed<number | undefined>(() => {
    const series = this.ventas7d();
    if (series.length < 2) return undefined;
    const last = series[series.length - 1].value;
    const prev = series[series.length - 2].value;
    if (prev === 0) return last > 0 ? 100 : 0;
    return ((last - prev) / prev) * 100;
  });

  readonly totalVentas7d = computed(() =>
    this.data.sales().filter(v => v.date.getTime() >= this.cutoffMs(7)).length
  );
  readonly totalIngresos7d = computed(() =>
    this.data.sales()
      .filter(v => v.date.getTime() >= this.cutoffMs(7))
      .reduce((s, v) => s + v.total, 0)
  );

  /** Top 5 productos por unidades vendidas en 30 días. */
  readonly topProductos = computed<BarItem[]>(() => {
    const map = new Map<string, { name: string; qty: number }>();
    const cutoff = this.cutoffMs(30);
    for (const v of this.data.sales()) {
      if (v.date.getTime() < cutoff) continue;
      const prev = map.get(v.productId);
      if (prev) prev.qty += v.qty;
      else map.set(v.productId, { name: v.productName, qty: v.qty });
    }
    return Array.from(map.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5)
      .map(x => ({ label: x.name, value: x.qty }));
  });

  /** Distribución de órdenes por estado (todas las históricas). */
  readonly ordenesPorEstado = computed<DonutSlice[]>(() => {
    const counts = new Map<OrderStatus, number>();
    for (const o of this.data.orders()) {
      counts.set(o.status, (counts.get(o.status) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([status, value]) => ({
      label: STATUS_LABELS[status],
      value,
      color: STATUS_COLORS[status],
    }));
  });

  /** Motivos de devolución del último mes (unidades). */
  readonly motivosDevolucion = computed<DonutSlice[]>(() => {
    const counts = new Map<ReturnReason, number>();
    for (const r of this.returnsMes()) {
      counts.set(r.reason, (counts.get(r.reason) ?? 0) + r.qty);
    }
    return Array.from(counts.entries()).map(([reason, value]) => ({
      label: REASON_LABELS[reason],
      value,
      color: REASON_COLORS[reason],
    }));
  });

  /** Items (insumos y productos) con stock crítico o bajo. */
  readonly stockEnRiesgo = computed<BarItem[]>(() => {
    const items: BarItem[] = [];
    for (const ss of this.data.supplyStock()) {
      if (ss.status === 'critical' || ss.status === 'low' || ss.status === 'out') {
        const sup = this.data.supplies().find(s => s.id === ss.supplyId);
        if (sup) items.push({
          label: sup.name,
          value: ss.quantity,
          color: ss.status === 'critical' || ss.status === 'out' ? 'var(--ui-danger)' : 'var(--ui-warning)',
        });
      }
    }
    for (const ps of this.data.productStock()) {
      if (ps.status === 'critical' || ps.status === 'low' || ps.status === 'out') {
        const p = this.data.productById(ps.productId);
        if (p) items.push({
          label: p.name,
          value: ps.quantity,
          color: ps.status === 'critical' || ps.status === 'out' ? 'var(--ui-danger)' : 'var(--ui-warning)',
        });
      }
    }
    return items.sort((a, b) => a.value - b.value).slice(0, 8);
  });

  readonly alertasRecientes = computed(() =>
    [...this.data.activeAlerts()]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 5)
  );

  private dayKey(d: Date): string {
    return d.toISOString().slice(0, 10);
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
}
