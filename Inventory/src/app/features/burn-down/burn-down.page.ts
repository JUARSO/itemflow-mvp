import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
  IonButton,
} from '@ionic/angular/standalone';
import { DataService } from '../../core/services/data.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { ProjectionChartComponent, ProjectionMarker } from '../predicciones/projection-chart.component';

type CatalogItemKind = 'supply' | 'product';
interface CatalogItem { kind: CatalogItemKind; id: string; name: string; sku: string; unit: string; }

/**
 * Análisis de burn-down: para el item seleccionado proyecta cuánto stock queda
 * día a día y señala el día sugerido para ordenar.
 *
 * Reutiliza `simulateBurnDown` del DataService y el ProjectionChartComponent
 * de la pantalla de Predicciones.
 */
@Component({
  selector: 'app-burn-down',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe, FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton, IonButton,
    PageHeaderComponent, ProjectionChartComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-menu-button></ion-menu-button></ion-buttons>
        <ion-title>Análisis de stock</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <app-page-header
        title="Análisis de stock (burn-down)"
        subtitle="Proyecta cuánto stock queda día a día y cuándo conviene generar la orden de compra.">
      </app-page-header>

      <!-- Selector de item -->
      <section class="picker">
        <div class="picker__row">
          <label class="field">
            <span class="field__label">Selecciona item a analizar</span>
            <select [(ngModel)]="selectedRef" (ngModelChange)="onSelect()">
              <option value="">— Selecciona insumo o producto —</option>
              @if (supplyItems().length > 0) {
                <optgroup label="Insumos">
                  @for (it of supplyItems(); track it.id) {
                    <option [value]="'supply:' + it.id">{{ it.name }} ({{ it.unit }})</option>
                  }
                </optgroup>
              }
              @if (productItems().length > 0) {
                <optgroup label="Productos de reventa">
                  @for (it of productItems(); track it.id) {
                    <option [value]="'product:' + it.id">{{ it.name }} ({{ it.unit }})</option>
                  }
                </optgroup>
              }
            </select>
          </label>
          <label class="field field--narrow">
            <span class="field__label">Horizonte (días)</span>
            <select [(ngModel)]="horizon" (ngModelChange)="onSelect()">
              <option [ngValue]="30">30 días</option>
              <option [ngValue]="60">60 días</option>
              <option [ngValue]="90">90 días</option>
              <option [ngValue]="180">180 días</option>
            </select>
          </label>
        </div>
      </section>

      @if (!sim()) {
        <div class="placeholder">
          <div class="placeholder__icon">📉</div>
          <h2>Selecciona un item para empezar</h2>
          <p>Verás su trayectoria de stock proyectada, el día en que debes ordenar y la cantidad sugerida.</p>
        </div>
      } @else {
        <!-- ============ MÉTRICAS CLAVE ============ -->
        <section class="card-section">
          <div class="kpis">
            <div class="kpi" [attr.data-status]="coverageStatus()">
              <div class="kpi__label">Stock actual</div>
              <div class="kpi__value mono">{{ sim()!.initialStock | number:'1.0-2' }}</div>
              <div class="kpi__unit">{{ unitLabel() }}</div>
            </div>
            <div class="kpi" [attr.data-status]="coverageStatus()">
              <div class="kpi__label">Días de cobertura</div>
              <div class="kpi__value mono">{{ sim()!.daysOfCoverage | number:'1.0-1' }}</div>
              <div class="kpi__unit">días al consumo actual</div>
            </div>
            <div class="kpi">
              <div class="kpi__label">Demanda diaria</div>
              <div class="kpi__value mono">{{ sim()!.dailyDemand | number:'1.0-2' }}</div>
              <div class="kpi__unit">{{ unitLabel() }}/día (rolling 7d)</div>
            </div>
            <div class="kpi">
              <div class="kpi__label">Lead time</div>
              <div class="kpi__value mono">{{ sim()!.leadTime }}</div>
              <div class="kpi__unit">días desde la orden</div>
            </div>
          </div>
        </section>

        <!-- ============ FECHAS CLAVE ============ -->
        <section class="card-section">
          <header class="section-head">
            <h2>Fechas clave</h2>
          </header>
          <div class="dates">
            <div class="date-row" [attr.data-status]="orderUrgencyStatus()">
              <div class="date-row__icon">📅</div>
              <div class="date-row__body">
                <div class="date-row__title">Día sugerido para ordenar</div>
                <div class="date-row__detail">
                  @if (sim()!.dayToOrder !== null) {
                    <strong>Día {{ sim()!.dayToOrder }}</strong> · {{ dateOf(sim()!.dayToOrder!) }}
                  } @else {
                    Sin recomendación — stock no cruza ROP en el horizonte
                  }
                </div>
              </div>
              @if (sim()!.dayToOrder !== null) {
                <ion-button size="small" (click)="goToCreatePO()">
                  Crear OC →
                </ion-button>
              }
            </div>

            <div class="date-row" [attr.data-status]="sim()!.dayCrossesReorder !== null ? 'alerta' : 'optimo'">
              <div class="date-row__icon">⚠️</div>
              <div class="date-row__body">
                <div class="date-row__title">Cruce de punto de reorden ({{ sim()!.reorderPoint }} {{ unitLabel() }})</div>
                <div class="date-row__detail">
                  @if (sim()!.dayCrossesReorder !== null) {
                    <strong>Día {{ sim()!.dayCrossesReorder }}</strong> · {{ dateOf(sim()!.dayCrossesReorder!) }}
                  } @else {
                    No cruza en el horizonte proyectado
                  }
                </div>
              </div>
            </div>

            <div class="date-row" [attr.data-status]="sim()!.dayHitsZero !== null ? 'critico' : 'optimo'">
              <div class="date-row__icon">🚨</div>
              <div class="date-row__body">
                <div class="date-row__title">Stock = 0 si NO ordenas</div>
                <div class="date-row__detail">
                  @if (sim()!.dayHitsZero !== null) {
                    <strong>Día {{ sim()!.dayHitsZero }}</strong> · {{ dateOf(sim()!.dayHitsZero!) }}
                  } @else {
                    No llega a cero en el horizonte (cobertura suficiente o llegada de OC programada)
                  }
                </div>
              </div>
            </div>

            @if (sim()!.suggestedOrderQty > 0 && sim()!.dayToOrder !== null) {
              <div class="date-row" data-status="informativo">
                <div class="date-row__icon">📦</div>
                <div class="date-row__body">
                  <div class="date-row__title">Cantidad sugerida a ordenar</div>
                  <div class="date-row__detail">
                    <strong class="mono">{{ sim()!.suggestedOrderQty | number:'1.0-0' }} {{ unitLabel() }}</strong>
                    · llevar al máximo ({{ sim()!.maxStock }} {{ unitLabel() }}) tras la recepción
                  </div>
                </div>
              </div>
            }
          </div>
        </section>

        <!-- ============ OCs EN TRÁNSITO ============ -->
        @if (sim()!.incomingPOs.length > 0) {
          <section class="card-section">
            <header class="section-head">
              <h2>Órdenes en tránsito que aportan stock</h2>
            </header>
            <ul class="incoming">
              @for (po of sim()!.incomingPOs; track po.code) {
                <li class="incoming__item">
                  <span class="mono">{{ po.code }}</span>
                  · llega <strong>día {{ po.arrivalDay }}</strong> ({{ dateOf(po.arrivalDay) }})
                  · <span class="incoming__qty mono">+{{ po.qty }} {{ unitLabel() }}</span>
                </li>
              }
            </ul>
          </section>
        }

        <!-- ============ CHART ============ -->
        <section class="card-section">
          <header class="section-head">
            <h2>Trayectoria proyectada de stock</h2>
          </header>
          <app-projection-chart
            [trayectoria]="sim()!.trayectoria"
            [markers]="chartMarkers()"
            [stockMin]="sim()!.minStock"
            [stockMax]="sim()!.maxStock"
            [reorderPoint]="sim()!.reorderPoint"
            [maxDay]="horizon">
          </app-projection-chart>
          <p class="legend">
            <strong>Cómo leer:</strong> la línea cae a ritmo de la demanda diaria histórica
            (rolling 7d). Saltos hacia arriba son llegadas de OCs pending con fecha esperada.
            La línea cambia de color al cruzar punto de reorden (amarillo) o stock mínimo (rojo).
          </p>
        </section>
      }
    </ion-content>
  `,
  styles: [`
    .picker {
      padding: 0 var(--ui-sp-4) var(--ui-sp-3);
    }
    .picker__row {
      display: grid;
      grid-template-columns: 1fr 160px;
      gap: var(--ui-sp-3);
      padding: var(--ui-sp-3);
      background: var(--ui-surface-2);
      border: var(--ui-border-w-sm) solid var(--ui-border);
      border-radius: var(--ui-radius);
    }
    @media (max-width: 600px) { .picker__row { grid-template-columns: 1fr; } }
    .field { display: flex; flex-direction: column; gap: 4px; }
    .field__label {
      font-size: var(--ui-fs-xs);
      font-weight: var(--ui-fw-medium);
      color: var(--ui-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .field select {
      padding: 10px 12px;
      border: var(--ui-border-w-sm) solid var(--ui-border-strong);
      border-radius: var(--ui-radius);
      background: var(--ui-surface);
      font-family: var(--ui-font-sans);
      font-size: var(--ui-fs-sm);
      color: var(--ui-text);
      min-height: 44px;
    }
    .field select:focus {
      outline: none;
      border-color: var(--ui-primary);
      box-shadow: 0 0 0 3px rgba(63, 120, 114, 0.18);
    }

    .placeholder {
      padding: var(--ui-sp-8) var(--ui-sp-4);
      text-align: center;
      margin: 0 var(--ui-sp-4);
      background: var(--ui-surface);
      border: var(--ui-border-w-sm) dashed var(--ui-border-strong);
      border-radius: var(--ui-radius);
      color: var(--ui-text-muted);
    }
    .placeholder__icon { font-size: 64px; margin-bottom: var(--ui-sp-3); }
    .placeholder h2 { font-size: var(--ui-fs-lg); color: var(--ui-text-strong); margin-bottom: var(--ui-sp-2); }

    .card-section {
      margin: 0 var(--ui-sp-4) var(--ui-sp-3);
      padding: var(--ui-sp-4);
      background: var(--ui-surface);
      border: var(--ui-border-w-sm) solid var(--ui-border);
      border-radius: var(--ui-radius);
      box-shadow: var(--ui-shadow-sm);
    }
    .section-head { margin-bottom: var(--ui-sp-3); }
    .section-head h2 {
      font-family: var(--ui-font-display);
      font-weight: var(--ui-fw-semibold);
      font-size: var(--ui-fs-lg);
      color: var(--ui-text-strong);
      margin: 0;
    }

    .kpis {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: var(--ui-sp-3);
    }
    @media (max-width: 900px) { .kpis { grid-template-columns: 1fr 1fr; } }
    .kpi {
      padding: var(--ui-sp-3);
      background: var(--ui-surface-2);
      border: var(--ui-border-w-sm) solid var(--ui-border);
      border-radius: var(--ui-radius);
      border-left: 4px solid var(--ui-border-strong);
    }
    .kpi[data-status="optimo"]  { border-left-color: var(--ui-success); }
    .kpi[data-status="alerta"]  { border-left-color: var(--ui-warning); }
    .kpi[data-status="critico"] { border-left-color: var(--ui-danger); }
    .kpi__label {
      font-size: var(--ui-fs-xs);
      color: var(--ui-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .kpi__value {
      font-size: var(--ui-fs-2xl);
      font-weight: var(--ui-fw-bold);
      color: var(--ui-text-strong);
      line-height: 1;
    }
    .kpi__unit {
      font-size: var(--ui-fs-xs);
      color: var(--ui-text-muted);
      margin-top: 4px;
    }

    .dates { display: flex; flex-direction: column; gap: var(--ui-sp-2); }
    .date-row {
      display: grid;
      grid-template-columns: 32px 1fr auto;
      gap: var(--ui-sp-3);
      align-items: center;
      padding: var(--ui-sp-3);
      background: var(--ui-surface-2);
      border: var(--ui-border-w-sm) solid var(--ui-border);
      border-left: 4px solid var(--ui-border-strong);
      border-radius: var(--ui-radius);
    }
    .date-row[data-status="optimo"]      { border-left-color: var(--ui-success); }
    .date-row[data-status="alerta"]      { border-left-color: var(--ui-warning); background: var(--ui-warning-tint); }
    .date-row[data-status="critico"]     { border-left-color: var(--ui-danger);  background: var(--ui-danger-tint); }
    .date-row[data-status="informativo"] { border-left-color: var(--ui-secondary); background: var(--ui-excess-tint); }
    .date-row__icon { font-size: 24px; text-align: center; }
    .date-row__title {
      font-size: var(--ui-fs-sm);
      font-weight: var(--ui-fw-semibold);
      color: var(--ui-text-strong);
    }
    .date-row__detail {
      font-size: var(--ui-fs-sm);
      color: var(--ui-text-muted);
      margin-top: 2px;
    }

    .incoming {
      margin: 0;
      padding: 0;
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .incoming__item {
      padding: var(--ui-sp-2) var(--ui-sp-3);
      background: var(--ui-surface-2);
      border-radius: var(--ui-radius-sm);
      font-size: var(--ui-fs-sm);
      color: var(--ui-text);
    }
    .incoming__qty { color: var(--ui-success); font-weight: var(--ui-fw-bold); }

    .legend {
      margin-top: var(--ui-sp-3);
      padding: var(--ui-sp-3);
      background: var(--ui-surface-2);
      border-radius: var(--ui-radius-sm);
      font-size: var(--ui-fs-xs);
      color: var(--ui-text-muted);
      line-height: var(--ui-lh-base);
    }
  `],
})
export class BurnDownPage {
  protected readonly data = inject(DataService);
  private readonly router = inject(Router);

  selectedRef = '';
  horizon = 60;

  private readonly _selection = signal<{ kind: CatalogItemKind; id: string } | null>(null);

  readonly supplyItems = computed<CatalogItem[]>(() =>
    this.data.activeSupplies().map(s => ({
      kind: 'supply' as const, id: s.id, name: s.name, sku: s.sku, unit: s.unit,
    }))
  );

  readonly productItems = computed<CatalogItem[]>(() =>
    this.data.activeProducts()
      .filter(p => !p.hasRecipe)
      .map(p => ({
        kind: 'product' as const, id: p.id, name: p.name, sku: p.sku, unit: p.unit,
      }))
  );

  readonly selectedItem = computed<CatalogItem | null>(() => {
    const sel = this._selection();
    if (!sel) return null;
    const pool = sel.kind === 'supply' ? this.supplyItems() : this.productItems();
    return pool.find(i => i.id === sel.id) ?? null;
  });

  readonly sim = computed(() => {
    const sel = this._selection();
    if (!sel) return null;
    return this.data.simulateBurnDown(sel.kind, sel.id, this.horizon);
  });

  readonly unitLabel = computed(() => this.selectedItem()?.unit ?? '');

  readonly coverageStatus = computed<'optimo' | 'alerta' | 'critico'>(() => {
    const s = this.sim();
    if (!s) return 'optimo';
    const days = s.daysOfCoverage;
    if (days < 7) return 'critico';
    if (days < 14) return 'alerta';
    return 'optimo';
  });

  readonly orderUrgencyStatus = computed<'optimo' | 'alerta' | 'critico' | 'informativo'>(() => {
    const s = this.sim();
    if (!s || s.dayToOrder === null) return 'optimo';
    if (s.dayToOrder <= 3) return 'critico';
    if (s.dayToOrder <= 7) return 'alerta';
    return 'informativo';
  });

  readonly chartMarkers = computed<ProjectionMarker[]>(() => {
    const s = this.sim();
    if (!s) return [];
    const markers: ProjectionMarker[] = [];
    if (s.dayToOrder !== null && s.dayToOrder <= this.horizon) {
      markers.push({
        day: s.dayToOrder,
        value: s.trayectoria[s.dayToOrder] ?? 0,
        label: '📅 Ordenar',
      });
    }
    if (s.dayCrossesReorder !== null && s.dayCrossesReorder <= this.horizon) {
      markers.push({
        day: s.dayCrossesReorder,
        value: s.reorderPoint,
        label: 'ROP',
      });
    }
    if (s.dayHitsZero !== null && s.dayHitsZero <= this.horizon) {
      markers.push({
        day: s.dayHitsZero,
        value: 0,
        label: '🚨 Stock 0',
      });
    }
    return markers;
  });

  onSelect() {
    if (!this.selectedRef) {
      this._selection.set(null);
      return;
    }
    const [kind, id] = this.selectedRef.split(':') as [CatalogItemKind, string];
    this._selection.set({ kind, id });
  }

  dateOf(dayOffset: number): string {
    const d = new Date();
    d.setDate(d.getDate() + dayOffset);
    return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', weekday: 'short' });
  }

  goToCreatePO() {
    // Navega a OC. (En una iteración futura podríamos pasar item+qty pre-cargados.)
    this.router.navigateByUrl('/ordenes-compra');
  }
}
