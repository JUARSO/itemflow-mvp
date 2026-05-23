import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
  IonButton,
} from '@ionic/angular/standalone';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { ToastService } from '../../shared/components/toast/toast.service';
import { PredictionService, DECISION_TO_STATUS } from '../../core/services/prediction.service';
import { DataService } from '../../core/services/data.service';
import { PredictionEvent, PredictionRequest } from '../../core/models';
import { UrgencyGaugeComponent } from './urgency-gauge.component';
import { ProjectionChartComponent, ProjectionMarker } from './projection-chart.component';

type CatalogItemKind = 'supply' | 'product';
interface CatalogItem {
  kind: CatalogItemKind;
  id: string;
  name: string;
  sku: string;
  unit: string;
}

type AccordionId = 'inventario' | 'politica' | 'demanda' | 'logistica';

/** Métricas de evaluación fijas (provistas por equipo ML). */
const MODEL_METRICS = [
  { horizonte: 't+7d',  mae:  471, rmse: 1702, r2: 0.919, mape:  7.2 },
  { horizonte: 't+14d', mae:  532, rmse: 1823, r2: 0.909, mape: 10.4 },
  { horizonte: 't+30d', mae:  787, rmse: 1992, r2: 0.896, mape: 14.9 },
  { horizonte: 't+60d', mae: 1589, rmse: 2756, r2: 0.839, mape: 31.5 },
];

@Component({
  selector: 'app-predicciones',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe, ReactiveFormsModule, FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton, IonButton,
    PageHeaderComponent, UrgencyGaugeComponent, ProjectionChartComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-menu-button></ion-menu-button></ion-buttons>
        <ion-title>Predicciones IA</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <app-page-header
        title="Panel de Predicciones"
        subtitle="Decisión de compra y proyección de stock basadas en dos modelos LightGBM.">
      </app-page-header>

      <div class="layout">
        <!-- ============ ZONA IZQUIERDA: FORMULARIO ============ -->
        <aside class="form-zone">

          <!-- Cargar desde catálogo -->
          <div class="load-bar">
            <div class="load-bar__label">📦 Cargar desde catálogo</div>
            <p class="load-bar__hint">
              Selecciona un insumo o producto de reventa para autollenar el formulario
              con su stock, política y demanda histórica.
            </p>
            <div class="load-bar__row">
              <select [(ngModel)]="selectedItemRef" class="load-bar__select">
                <option value="">— Selecciona item —</option>
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
              <ion-button
                size="small"
                (click)="loadFromCatalog()"
                [disabled]="!selectedItemRef">
                Cargar datos
              </ion-button>
            </div>
            @if (loadedItemLabel()) {
              <div class="load-bar__loaded">
                ✓ Datos cargados de: <strong>{{ loadedItemLabel() }}</strong>
              </div>
            }
          </div>

          <form [formGroup]="form" novalidate (ngSubmit)="onSubmit()">

            <!-- INVENTARIO -->
            <details class="acc" [open]="isOpen('inventario')" (toggle)="onToggle('inventario', $event)">
              <summary class="acc__summary">
                <span class="acc__title">Inventario</span>
                <span class="acc__chevron">▾</span>
              </summary>
              <div class="acc__body">
                <label class="field">
                  <span class="field__label">Stock actual (u) <span class="req">*</span></span>
                  <input type="number" formControlName="actual_stock" min="0" step="1" />
                  @if (showError('actual_stock')) {
                    <span class="field__error">{{ errorFor('actual_stock') }}</span>
                  }
                </label>
                <label class="field">
                  <span class="field__label">Días desde último restock <span class="req">*</span></span>
                  <input type="number" formControlName="dias_desde_ultimo_restock" min="0" step="1" />
                  @if (showError('dias_desde_ultimo_restock')) {
                    <span class="field__error">{{ errorFor('dias_desde_ultimo_restock') }}</span>
                  }
                </label>
              </div>
            </details>

            <!-- POLÍTICA -->
            <details class="acc" [open]="isOpen('politica')" (toggle)="onToggle('politica', $event)">
              <summary class="acc__summary">
                <span class="acc__title">Política de inventario</span>
                <span class="acc__chevron">▾</span>
              </summary>
              <div class="acc__body">
                <div class="row-2">
                  <label class="field">
                    <span class="field__label">Stock mínimo <span class="req">*</span></span>
                    <input type="number" formControlName="stock_min" min="0" step="1" />
                    @if (showError('stock_min')) {
                      <span class="field__error">{{ errorFor('stock_min') }}</span>
                    }
                  </label>
                  <label class="field">
                    <span class="field__label">Stock máximo <span class="req">*</span></span>
                    <input type="number" formControlName="stock_max" min="0" step="1" />
                    @if (showError('stock_max')) {
                      <span class="field__error">{{ errorFor('stock_max') }}</span>
                    }
                  </label>
                </div>
                <label class="field">
                  <span class="field__label">Punto de reorden manual <span class="req">*</span></span>
                  <input type="number" formControlName="reorder_point_manual" min="0" step="1" />
                  <span class="field__hint mono">
                    Mínimo teórico:
                    @if (theoreticalMin() != null) {
                      {{ theoreticalMin() | number:'1.0-0' }} u
                    } @else {
                      —
                    }
                  </span>
                  @if (showError('reorder_point_manual')) {
                    <span class="field__error">{{ errorFor('reorder_point_manual') }}</span>
                  }
                </label>
              </div>
            </details>

            <!-- DEMANDA -->
            <details class="acc" [open]="isOpen('demanda')" (toggle)="onToggle('demanda', $event)">
              <summary class="acc__summary">
                <span class="acc__title">Demanda histórica</span>
                <span class="acc__chevron">▾</span>
              </summary>
              <div class="acc__body">
                <label class="field">
                  <span class="field__label">Promedio diario 7d (un/día) <span class="req">*</span></span>
                  <input type="number" formControlName="rolling_mean_7d" min="0" step="0.01" />
                  @if (showError('rolling_mean_7d')) {
                    <span class="field__error">{{ errorFor('rolling_mean_7d') }}</span>
                  }
                </label>
                <label class="field">
                  <span class="field__label">Promedio diario 14d (un/día) <span class="req">*</span></span>
                  <input type="number" formControlName="rolling_mean_14d" min="0" step="0.01" />
                </label>
                <label class="field">
                  <span class="field__label">Promedio diario 30d (un/día) <span class="req">*</span></span>
                  <input type="number" formControlName="rolling_mean_30d" min="0" step="0.01" />
                </label>
                <label class="field">
                  <span class="field__label">Desv. estándar 7d (un/día) <span class="req">*</span></span>
                  <input type="number" formControlName="rolling_std_7d" min="0" step="0.01" />
                </label>
              </div>
            </details>

            <!-- LOGÍSTICA -->
            <details class="acc" [open]="isOpen('logistica')" (toggle)="onToggle('logistica', $event)">
              <summary class="acc__summary">
                <span class="acc__title">Logística</span>
                <span class="acc__chevron">▾</span>
              </summary>
              <div class="acc__body">
                <div class="row-2">
                  <label class="field">
                    <span class="field__label">Lead time prom. (días) <span class="req">*</span></span>
                    <input type="number" formControlName="lt_avg" min="1" step="0.1" />
                    @if (showError('lt_avg')) {
                      <span class="field__error">{{ errorFor('lt_avg') }}</span>
                    }
                  </label>
                  <label class="field">
                    <span class="field__label">Lead time desv. est. (días) <span class="req">*</span></span>
                    <input type="number" formControlName="lt_std" min="0" step="0.1" />
                  </label>
                </div>
              </div>
            </details>

            <div class="submit-wrap">
              <ion-button
                type="submit"
                expand="block"
                [disabled]="!canSubmit() || pred.state().loading">
                @if (pred.state().loading) {
                  ⏳ Procesando…
                } @else {
                  ⚡ Analizar con IA
                }
              </ion-button>
              @if (!canSubmit() && form.touched) {
                <p class="submit-hint">Revisa los campos con error para habilitar el análisis.</p>
              }
              @if (pred.state().simulated && pred.state().result) {
                <p class="submit-hint">⚠️ Backend no disponible — resultado generado por simulador local determinista.</p>
              }
            </div>
          </form>
        </aside>

        <!-- ============ ZONA DERECHA: RESULTADOS ============ -->
        <main class="result-zone">

          @if (!pred.state().result && !pred.state().loading) {
            <div class="placeholder">
              <div class="placeholder__icon">🔮</div>
              <h2>Complete los parámetros y presione "Analizar con IA"</h2>
              <p>Los resultados aparecerán aquí: decisión de compra, proyección de stock y consulta interactiva por día.</p>
            </div>
          }

          @if (pred.state().loading) {
            <div class="skeleton skeleton--cards"></div>
            <div class="skeleton skeleton--chart"></div>
          }

          @if (pred.state().result; as r) {
            <!-- SECCIÓN 1: DECISIÓN DE COMPRA -->
            <section class="card-section">
              <div class="cards-row">
                <!-- A: Decisión -->
                <article class="result-card" [attr.data-status]="decisionMeta().status">
                  <div class="result-card__label">Decisión de compra</div>
                  <div class="result-card__main">
                    <span class="result-card__icon">{{ decisionMeta().icon }}</span>
                    <span class="result-card__title">{{ decisionMeta().title }}</span>
                  </div>
                  <div class="result-card__sub">Stock cubre ~{{ r.derivados.dias_cobertura | number:'1.0-1' }} días</div>
                </article>

                <!-- B: Gauge -->
                <article class="result-card">
                  <div class="result-card__label">Urgencia de orden</div>
                  <app-urgency-gauge [value]="r.orden.urgencia"></app-urgency-gauge>
                </article>

                <!-- C: Cantidad -->
                <article class="result-card">
                  <div class="result-card__label">Cantidad recomendada</div>
                  <div class="result-card__bignum mono">{{ r.orden.cantidad_final | number:'1.0-0' }}</div>
                  <div class="result-card__sub">unidades a ordenar</div>
                  @if (r.orden.cantidad_final < r.orden.cantidad_modelo) {
                    <div class="result-card__note">Limitado por capacidad máxima ({{ r.orden.cantidad_modelo }} u sugeridas por el modelo)</div>
                  }
                </article>
              </div>

              <!-- Chips derivados -->
              <div class="chips">
                <div class="chip" [attr.data-status]="chipStatus('cobertura', r.derivados.dias_cobertura)">
                  <div class="chip__label">Días cobertura</div>
                  <div class="chip__value mono">{{ r.derivados.dias_cobertura | number:'1.0-1' }} d</div>
                </div>
                <div class="chip">
                  <div class="chip__label">Punto de reorden</div>
                  <div class="chip__value mono">{{ r.derivados.reorder_point | number:'1.0-0' }} u</div>
                </div>
                <div class="chip">
                  <div class="chip__label">Stock seguridad</div>
                  <div class="chip__value mono">{{ r.derivados.safety_stock | number:'1.0-0' }} u</div>
                </div>
                <div class="chip" [attr.data-status]="chipStatus('ratio', r.derivados.stock_ratio)">
                  <div class="chip__label">Stock / ROP</div>
                  <div class="chip__value mono">{{ r.derivados.stock_ratio | number:'1.2-2' }}</div>
                </div>
                <div class="chip" [attr.data-status]="r.derivados.tendencia >= 0 ? 'optimo' : 'alerta'">
                  <div class="chip__label">Tendencia demanda</div>
                  <div class="chip__value mono">{{ r.derivados.tendencia > 0 ? '+' : '' }}{{ r.derivados.tendencia | number:'1.0-2' }}</div>
                </div>
              </div>
            </section>

            <!-- SECCIÓN 2: PROYECCIÓN -->
            <section class="card-section">
              <header class="section-head">
                <h2>Simulación de Stock (consumo diario + reposición)</h2>
              </header>
              <app-projection-chart
                [trayectoria]="r.simulacion.trayectoria"
                [markers]="markersForChart()"
                [stockMin]="pred.state().request!.stock_min"
                [stockMax]="pred.state().request!.stock_max"
                [reorderPoint]="r.derivados.reorder_point"
                [recommendedRop]="recommendedRop()"
                [maxDay]="60">
              </app-projection-chart>

              <div class="metrics">
                <table class="metrics__table">
                  <thead>
                    <tr>
                      <th>Horizonte</th>
                      <th class="num">MAE</th>
                      <th class="num">RMSE</th>
                      <th class="num">R²</th>
                      <th class="num">MAPE</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (m of METRICS; track m.horizonte) {
                      <tr>
                        <td>{{ m.horizonte }}</td>
                        <td class="num mono">{{ m.mae }}u</td>
                        <td class="num mono">{{ m.rmse }}u</td>
                        <td class="num mono">{{ m.r2 }}</td>
                        <td class="num mono">{{ m.mape }}%</td>
                      </tr>
                    }
                  </tbody>
                </table>
                <p class="metrics__note">Métricas evaluadas en test set (15% temporal).</p>
              </div>
            </section>

            <!-- SECCIÓN 3: CONSULTA POR DÍA -->
            <section class="card-section">
              <header class="section-head">
                <h2>¿En cuántos días quiero conocer mi stock?</h2>
              </header>

              <div class="slider-row">
                <input
                  type="range"
                  min="1"
                  max="180"
                  step="1"
                  [value]="sliderDay()"
                  (input)="sliderDay.set(+$any($event.target).value)"
                  class="slider" />
                <span class="slider__value mono">Día {{ sliderDay() }}</span>
              </div>

              <div class="cards-row">
                <article class="result-card" [attr.data-status]="sliderStatus()">
                  <div class="result-card__label">Stock proyectado</div>
                  <div class="result-card__bignum mono">{{ sliderStock() | number:'1.0-0' }}</div>
                  <div class="result-card__sub">unidades en día {{ sliderDay() }}</div>
                </article>

                <article class="result-card" [attr.data-status]="sliderStatus()">
                  <div class="result-card__label">Estado</div>
                  <div class="result-card__main">
                    <span class="result-card__icon">{{ sliderStatusIcon() }}</span>
                    <span class="result-card__title">{{ sliderStatusLabel() }}</span>
                  </div>
                  <div class="result-card__sub">{{ sliderStatusExplain() }}</div>
                </article>

                <article class="result-card">
                  <div class="result-card__label">Pedidos hasta día {{ sliderDay() }}</div>
                  <div class="events-list">
                    @if (eventsUntilSlider().length === 0) {
                      <div class="events-empty">Sin pedidos en este período</div>
                    } @else {
                      @for (e of eventsUntilSlider(); track e.trigger) {
                        <div class="event-row" [attr.data-status]="e.arrival <= sliderDay() ? 'recibido' : 'transito'">
                          <span class="mono">Día {{ e.trigger }} → llega día {{ e.arrival }}</span>
                          <span class="event-row__qty mono">+{{ e.qty }} u</span>
                          <span class="event-row__tag">{{ e.arrival <= sliderDay() ? 'recibido' : 'en tránsito' }}</span>
                        </div>
                      }
                    }
                  </div>
                </article>
              </div>

              <app-projection-chart
                [trayectoria]="r.simulacion.trayectoria"
                [markers]="[{ day: sliderDay(), value: sliderStock(), label: 'Día ' + sliderDay() }]"
                [stockMin]="pred.state().request!.stock_min"
                [stockMax]="pred.state().request!.stock_max"
                [reorderPoint]="r.derivados.reorder_point"
                [maxDay]="sliderDay()">
              </app-projection-chart>
            </section>

            <!-- BARRA DE ESTADO INFERIOR -->
            <div class="status-bar">
              ✓ Análisis completado · Urgencia: <strong class="mono">{{ (r.orden.urgencia * 100) | number:'1.0-0' }}%</strong> · Cantidad recomendada: <strong class="mono">{{ r.orden.cantidad_final }} u</strong>
            </div>
          }
        </main>
      </div>
    </ion-content>
  `,
  styles: [`
    .layout {
      display: grid;
      grid-template-columns: 380px 1fr;
      gap: var(--ui-sp-4);
      padding: 0 var(--ui-sp-4) var(--ui-sp-8);
    }
    @media (max-width: 1100px) {
      .layout { grid-template-columns: 1fr; }
    }

    /* === FORM === */
    .form-zone {
      display: flex;
      flex-direction: column;
      gap: var(--ui-sp-2);
    }

    .load-bar {
      padding: var(--ui-sp-3);
      background: var(--ui-surface-2);
      border: var(--ui-border-w-sm) solid var(--ui-border);
      border-left: 3px solid var(--ui-primary);
      border-radius: var(--ui-radius);
      margin-bottom: var(--ui-sp-2);
    }
    .load-bar__label {
      font-size: var(--ui-fs-sm);
      font-weight: var(--ui-fw-semibold);
      color: var(--ui-text-strong);
      margin-bottom: 4px;
    }
    .load-bar__hint {
      font-size: var(--ui-fs-xs);
      color: var(--ui-text-muted);
      margin: 0 0 var(--ui-sp-2);
    }
    .load-bar__row {
      display: flex;
      gap: var(--ui-sp-2);
      align-items: stretch;
    }
    .load-bar__select {
      flex: 1;
      min-width: 0;
      padding: 8px 10px;
      border: var(--ui-border-w-sm) solid var(--ui-border-strong);
      border-radius: var(--ui-radius);
      background: var(--ui-surface);
      font-family: var(--ui-font-sans);
      font-size: var(--ui-fs-sm);
      color: var(--ui-text);
      min-height: 38px;
    }
    .load-bar__select:focus {
      outline: none;
      border-color: var(--ui-primary);
      box-shadow: 0 0 0 3px rgba(63, 120, 114, 0.18);
    }
    .load-bar__loaded {
      margin-top: var(--ui-sp-2);
      padding: 6px 10px;
      background: var(--ui-success-tint);
      color: var(--ui-success);
      border-radius: var(--ui-radius-sm);
      font-size: var(--ui-fs-xs);
      font-weight: var(--ui-fw-medium);
    }

    .acc {
      border: var(--ui-border-w-sm) solid var(--ui-border);
      background: var(--ui-surface);
      border-radius: var(--ui-radius);
      overflow: hidden;
    }
    .acc__summary {
      list-style: none;
      cursor: pointer;
      padding: var(--ui-sp-3);
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: var(--ui-fw-semibold);
      font-size: var(--ui-fs-md);
      color: var(--ui-text-strong);
      background: var(--ui-surface-2);
    }
    .acc__summary::-webkit-details-marker { display: none; }
    .acc__chevron { transition: transform 200ms ease; }
    .acc[open] .acc__chevron { transform: rotate(180deg); }
    .acc__body {
      padding: var(--ui-sp-3);
      display: flex;
      flex-direction: column;
      gap: var(--ui-sp-3);
    }
    .row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: var(--ui-sp-3); }

    .field { display: flex; flex-direction: column; gap: 4px; }
    .field__label {
      font-size: var(--ui-fs-xs);
      font-weight: var(--ui-fw-medium);
      color: var(--ui-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .field input, .field select {
      padding: 8px 10px;
      border: var(--ui-border-w-sm) solid var(--ui-border-strong);
      border-radius: var(--ui-radius);
      background: var(--ui-surface);
      font-family: var(--ui-font-sans);
      font-size: var(--ui-fs-sm);
      color: var(--ui-text);
      min-height: 38px;
    }
    .field input:focus, .field select:focus {
      outline: none;
      border-color: var(--ui-primary);
      box-shadow: 0 0 0 3px rgba(63, 120, 114, 0.18);
    }
    .field__hint { font-size: var(--ui-fs-xs); color: var(--ui-text-muted); margin-top: 2px; }
    .field__error {
      font-size: var(--ui-fs-xs);
      color: var(--ui-danger);
      margin-top: 2px;
    }
    .req { color: var(--ui-danger); }

    .submit-wrap { margin-top: var(--ui-sp-3); }
    .submit-hint {
      font-size: var(--ui-fs-xs);
      color: var(--ui-text-muted);
      margin-top: var(--ui-sp-2);
      text-align: center;
    }

    /* === RESULT ZONE === */
    .result-zone { display: flex; flex-direction: column; gap: var(--ui-sp-4); min-width: 0; }

    .placeholder {
      padding: var(--ui-sp-8) var(--ui-sp-4);
      text-align: center;
      background: var(--ui-surface);
      border: var(--ui-border-w-sm) dashed var(--ui-border-strong);
      border-radius: var(--ui-radius);
      color: var(--ui-text-muted);
    }
    .placeholder__icon { font-size: 64px; margin-bottom: var(--ui-sp-3); }
    .placeholder h2 { font-size: var(--ui-fs-lg); color: var(--ui-text-strong); margin-bottom: var(--ui-sp-2); }

    .skeleton {
      background: linear-gradient(90deg, var(--ui-surface-2), var(--ui-surface-3), var(--ui-surface-2));
      background-size: 200% 100%;
      border-radius: var(--ui-radius);
      animation: pulse 1.5s ease-in-out infinite;
    }
    .skeleton--cards { height: 160px; }
    .skeleton--chart { height: 360px; }
    @keyframes pulse { 0%, 100% { background-position: 0% 0; } 50% { background-position: -100% 0; } }

    .card-section {
      background: var(--ui-surface);
      border: var(--ui-border-w-sm) solid var(--ui-border);
      border-radius: var(--ui-radius);
      padding: var(--ui-sp-4);
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

    .cards-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--ui-sp-3);
    }
    @media (max-width: 900px) { .cards-row { grid-template-columns: 1fr; } }

    .result-card {
      padding: var(--ui-sp-3);
      background: var(--ui-surface-2);
      border: var(--ui-border-w-sm) solid var(--ui-border);
      border-radius: var(--ui-radius);
      display: flex;
      flex-direction: column;
      gap: var(--ui-sp-2);
      min-width: 0;
    }
    .result-card[data-status="optimo"] { border-left: 4px solid var(--ui-success); }
    .result-card[data-status="alerta"] { border-left: 4px solid var(--ui-warning); }
    .result-card[data-status="critico"] { border-left: 4px solid var(--ui-danger); }
    .result-card[data-status="critico_extremo"] { border-left: 4px solid var(--ui-danger); background: var(--ui-danger-tint); }
    .result-card[data-status="informativo"] { border-left: 4px solid var(--ui-secondary); }
    .result-card__label {
      font-size: var(--ui-fs-xs);
      font-weight: var(--ui-fw-medium);
      color: var(--ui-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .result-card__main { display: flex; gap: var(--ui-sp-2); align-items: center; }
    .result-card__icon { font-size: 28px; }
    .result-card__title { font-size: var(--ui-fs-lg); font-weight: var(--ui-fw-bold); color: var(--ui-text-strong); }
    .result-card__bignum { font-size: var(--ui-fs-3xl); font-weight: var(--ui-fw-bold); color: var(--ui-text-strong); line-height: 1; }
    .result-card__sub { font-size: var(--ui-fs-sm); color: var(--ui-text-muted); }
    .result-card__note {
      font-size: var(--ui-fs-xs);
      color: var(--ui-warning);
      padding: 6px 8px;
      background: var(--ui-warning-tint);
      border-radius: var(--ui-radius-sm);
    }

    .chips {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: var(--ui-sp-2);
      margin-top: var(--ui-sp-3);
    }
    @media (max-width: 900px) { .chips { grid-template-columns: repeat(2, 1fr); } }
    .chip {
      padding: var(--ui-sp-2);
      background: var(--ui-surface-2);
      border: var(--ui-border-w-sm) solid var(--ui-border);
      border-radius: var(--ui-radius);
      text-align: center;
    }
    .chip[data-status="optimo"]  { border-color: var(--ui-success); }
    .chip[data-status="alerta"]  { border-color: var(--ui-warning); }
    .chip[data-status="critico"] { border-color: var(--ui-danger); }
    .chip__label {
      font-size: var(--ui-fs-xs);
      color: var(--ui-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .chip__value { font-size: var(--ui-fs-md); font-weight: var(--ui-fw-bold); color: var(--ui-text-strong); }

    .metrics { margin-top: var(--ui-sp-3); }
    .metrics__table {
      width: 100%;
      border-collapse: collapse;
      font-size: var(--ui-fs-sm);
    }
    .metrics__table th, .metrics__table td {
      padding: var(--ui-sp-2) var(--ui-sp-3);
      border-bottom: var(--ui-border-w-sm) solid var(--ui-border);
      text-align: left;
    }
    .metrics__table th { color: var(--ui-text-muted); font-weight: var(--ui-fw-medium); font-size: var(--ui-fs-xs); text-transform: uppercase; }
    .metrics__table .num { text-align: right; }
    .metrics__note { font-size: var(--ui-fs-xs); color: var(--ui-text-muted); margin-top: var(--ui-sp-2); font-style: italic; }

    .slider-row { display: flex; align-items: center; gap: var(--ui-sp-3); margin-bottom: var(--ui-sp-3); }
    .slider { flex: 1; min-width: 0; accent-color: var(--ui-primary); }
    .slider__value { font-size: var(--ui-fs-md); font-weight: var(--ui-fw-bold); color: var(--ui-text-strong); min-width: 80px; text-align: right; }

    .events-list { display: flex; flex-direction: column; gap: 4px; max-height: 140px; overflow-y: auto; }
    .events-empty { font-size: var(--ui-fs-sm); color: var(--ui-text-muted); padding: var(--ui-sp-2) 0; }
    .event-row {
      display: grid;
      grid-template-columns: 1fr auto auto;
      gap: var(--ui-sp-2);
      align-items: center;
      padding: 6px 8px;
      background: var(--ui-surface);
      border-radius: var(--ui-radius-sm);
      font-size: var(--ui-fs-xs);
    }
    .event-row__qty { color: var(--ui-success); font-weight: var(--ui-fw-bold); }
    .event-row__tag {
      font-size: var(--ui-fs-xs);
      padding: 2px 8px;
      border-radius: var(--ui-radius-pill);
    }
    .event-row[data-status="recibido"] .event-row__tag { background: var(--ui-success-tint); color: var(--ui-success); }
    .event-row[data-status="transito"] .event-row__tag { background: var(--ui-warning-tint); color: var(--ui-warning); }

    .status-bar {
      padding: var(--ui-sp-3) var(--ui-sp-4);
      background: var(--ui-success-tint);
      border: var(--ui-border-w-sm) solid var(--ui-success);
      border-radius: var(--ui-radius);
      font-size: var(--ui-fs-sm);
      color: var(--ui-text-strong);
    }
  `],
})
export class PrediccionesPage {
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  protected readonly pred = inject(PredictionService);
  private readonly data = inject(DataService);

  protected readonly METRICS = MODEL_METRICS;

  // ---------- Cargar desde catálogo ----------
  selectedItemRef = '';
  readonly loadedItemLabel = signal<string>('');

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

  async loadFromCatalog() {
    if (!this.selectedItemRef) return;
    const [kind, id] = this.selectedItemRef.split(':') as [CatalogItemKind, string];
    if (kind === 'supply') {
      this.loadFromSupply(id);
    } else {
      this.loadFromProduct(id);
    }
  }

  private loadFromSupply(id: string) {
    const supply = this.data.supplyById(id);
    if (!supply) return;
    const stock = this.data.supplyStockFor(id);
    const lt = this.data.historicalLeadTime('supply', id);

    this.form.patchValue({
      actual_stock: stock?.quantity ?? 0,
      dias_desde_ultimo_restock: this.data.daysSinceLastRestock('supply', id),
      stock_min: supply.minStock,
      stock_max: supply.maxStock,
      reorder_point_manual: supply.reorderPoint,
      rolling_mean_7d:  +this.data.rollingMean('supply', id, 7).toFixed(2),
      rolling_mean_14d: +this.data.rollingMean('supply', id, 14).toFixed(2),
      rolling_mean_30d: +this.data.rollingMean('supply', id, 30).toFixed(2),
      rolling_std_7d:   +this.data.rollingStd('supply', id, 7).toFixed(2),
      // Lead time: si hay OCs recibidas para este insumo, usar el promedio
      // y std observados; sino caer al leadTime configurado en el insumo.
      lt_avg: lt.count >= 1 ? +lt.avg.toFixed(2) : supply.leadTime,
      lt_std: lt.count >= 2 ? +lt.std.toFixed(2) : Math.max(0.5, +(supply.leadTime * 0.3).toFixed(1)),
    });
    const ltNote = lt.count > 0
      ? ` · LT real promedio: ${lt.avg.toFixed(1)}d (n=${lt.count})`
      : '';
    this.loadedItemLabel.set(`${supply.name} (${supply.sku})${ltNote}`);
    this.toast.show(`Datos de "${supply.name}" cargados.`, 'success');
  }

  private loadFromProduct(id: string) {
    const product = this.data.productById(id);
    if (!product) return;
    const stock = this.data.productStockFor(id);
    const lt = this.data.historicalLeadTime('product', id);

    // Productos de reventa no siempre tienen min/max nativo; derivamos defaults.
    const reorderPoint = product.reorderPoint ?? 0;
    const minStock = product.minStock ?? Math.floor(reorderPoint / 3);
    const maxStock = Math.max(reorderPoint * 3, minStock + 10);

    this.form.patchValue({
      actual_stock: stock?.quantity ?? 0,
      dias_desde_ultimo_restock: this.data.daysSinceLastRestock('product', id),
      stock_min: minStock,
      stock_max: maxStock,
      reorder_point_manual: reorderPoint || Math.floor((minStock + maxStock) / 2),
      rolling_mean_7d:  +this.data.rollingMean('product', id, 7).toFixed(2),
      rolling_mean_14d: +this.data.rollingMean('product', id, 14).toFixed(2),
      rolling_mean_30d: +this.data.rollingMean('product', id, 30).toFixed(2),
      rolling_std_7d:   +this.data.rollingStd('product', id, 7).toFixed(2),
      lt_avg: lt.count >= 1 ? +lt.avg.toFixed(2) : product.leadTime,
      lt_std: lt.count >= 2 ? +lt.std.toFixed(2) : Math.max(0.5, +(product.leadTime * 0.3).toFixed(1)),
    });
    const ltNote = lt.count > 0
      ? ` · LT real promedio: ${lt.avg.toFixed(1)}d (n=${lt.count})`
      : '';
    this.loadedItemLabel.set(`${product.name} (${product.sku})${ltNote}`);
    this.toast.show(`Datos de "${product.name}" cargados.`, 'success');
  }

  private readonly openSet = signal<Set<AccordionId>>(new Set(['inventario', 'politica', 'demanda']));
  isOpen(id: AccordionId): boolean { return this.openSet().has(id); }
  onToggle(id: AccordionId, ev: Event) {
    const open = (ev.target as HTMLDetailsElement).open;
    this.openSet.update(s => {
      const next = new Set(s);
      if (open) next.add(id); else next.delete(id);
      return next;
    });
  }

  /**
   * Form arranca completamente vacío (null en todos los controles). El usuario
   * debe cargar un item del catálogo o completar manualmente antes de analizar.
   * Esto evita análisis con datos default ficticios.
   */
  readonly form = this.fb.group({
    actual_stock:              this.fb.control<number | null>(null, [Validators.required, Validators.min(0)]),
    dias_desde_ultimo_restock: this.fb.control<number | null>(null, [Validators.required, Validators.min(0)]),
    rolling_mean_7d:           this.fb.control<number | null>(null, [Validators.required, Validators.min(0)]),
    rolling_mean_14d:          this.fb.control<number | null>(null, [Validators.required, Validators.min(0)]),
    rolling_mean_30d:          this.fb.control<number | null>(null, [Validators.required, Validators.min(0)]),
    rolling_std_7d:            this.fb.control<number | null>(null, [Validators.required, Validators.min(0)]),
    lt_avg:                    this.fb.control<number | null>(null, [Validators.required, Validators.min(1)]),
    lt_std:                    this.fb.control<number | null>(null, [Validators.required, Validators.min(0)]),
    stock_min:                 this.fb.control<number | null>(null, [Validators.required, Validators.min(0)]),
    stock_max:                 this.fb.control<number | null>(null, [Validators.required, Validators.min(0)]),
    reorder_point_manual:      this.fb.control<number | null>(null, [Validators.required, Validators.min(0)]),
  });

  private readonly formValueSig = signal<typeof this.form.value | null>(null);
  constructor() {
    this.form.valueChanges.subscribe(v => this.formValueSig.set(v));
    this.formValueSig.set(this.form.getRawValue());

    effect(() => {
      const r = this.pred.state().result;
      if (r) this.sliderDay.set(7);
    });
  }

  /** Mínimo teórico (rolling_mean_7d × lt_avg). null cuando falta info. */
  readonly theoreticalMin = computed<number | null>(() => {
    const v = this.formValueSig();
    if (!v) return null;
    if (v.rolling_mean_7d == null || v.lt_avg == null) return null;
    return v.rolling_mean_7d * v.lt_avg;
  });

  readonly canSubmit = computed(() => {
    const v = this.formValueSig();
    if (!v || this.form.invalid) return false;
    if ((v.stock_max ?? 0) <= (v.stock_min ?? 0)) return false;
    const rop = v.reorder_point_manual ?? 0;
    if (rop < (v.stock_min ?? 0) || rop > (v.stock_max ?? 0)) return false;
    return true;
  });

  showError(name: keyof typeof this.form.controls): boolean {
    const ctrl = this.form.get(name as string);
    return !!ctrl && ctrl.invalid && (ctrl.dirty || ctrl.touched);
  }

  errorFor(name: keyof typeof this.form.controls): string {
    const v = this.formValueSig();
    if (!v) return 'Requerido';
    const ctrl = this.form.get(name as string);
    if (ctrl?.errors?.['required']) return 'Requerido';
    if (ctrl?.errors?.['min']) return `Mínimo: ${ctrl.errors['min'].min}`;
    if (name === 'stock_max' && (v.stock_max ?? 0) <= (v.stock_min ?? 0)) return 'Debe ser mayor a stock_min';
    if (name === 'reorder_point_manual') {
      const rop = v.reorder_point_manual ?? 0;
      if (rop < (v.stock_min ?? 0)) return 'No puede ser menor a stock_min';
      if (rop > (v.stock_max ?? 0)) return 'No puede ser mayor a stock_max';
    }
    return '';
  }

  async onSubmit() {
    if (!this.canSubmit()) {
      this.form.markAllAsTouched();
      return;
    }
    try {
      // dia_semana_num y mes_num los inyectamos desde la fecha actual: el contrato
      // del backend los exige pero el usuario no debe configurarlos manualmente.
      // canSubmit() ya validó que ningún campo es null, así que el cast es seguro.
      const now = new Date();
      const v = this.form.getRawValue();
      const payload: PredictionRequest = {
        actual_stock:              v.actual_stock!,
        dias_desde_ultimo_restock: v.dias_desde_ultimo_restock!,
        rolling_mean_7d:           v.rolling_mean_7d!,
        rolling_mean_14d:          v.rolling_mean_14d!,
        rolling_mean_30d:          v.rolling_mean_30d!,
        rolling_std_7d:            v.rolling_std_7d!,
        lt_avg:                    v.lt_avg!,
        lt_std:                    v.lt_std!,
        stock_min:                 v.stock_min!,
        stock_max:                 v.stock_max!,
        reorder_point_manual:      v.reorder_point_manual!,
        dia_semana_num: ((now.getDay() + 6) % 7) + 1, // JS dom=0..sáb=6 → lun=1..dom=7
        mes_num: now.getMonth() + 1,
      };
      await this.pred.predict(payload);
    } catch (e: unknown) {
      await this.toast.show(
        e instanceof Error ? e.message : 'Error al ejecutar la predicción.',
        'danger'
      );
    }
  }

  // -------- Sección 1 ----------
  readonly decisionMeta = computed(() => {
    const r = this.pred.state().result;
    if (!r) return { status: 'optimo' as const, title: '', icon: '' };
    return DECISION_TO_STATUS[r.orden.decision];
  });

  chipStatus(kind: 'cobertura' | 'ratio', value: number): 'optimo' | 'alerta' | 'critico' {
    if (kind === 'cobertura') {
      if (value < 3) return 'critico';
      if (value < 7) return 'alerta';
      return 'optimo';
    }
    if (value < 0.8) return 'critico';
    if (value < 1.2) return 'alerta';
    return 'optimo';
  }

  // -------- Sección 2 ----------
  readonly markersForChart = computed<ProjectionMarker[]>(() => {
    const r = this.pred.state().result;
    if (!r) return [];
    return [
      { day: 7,  value: r.stock_proyeccion.t7,  label: 't+7' },
      { day: 14, value: r.stock_proyeccion.t14, label: 't+14' },
      { day: 30, value: r.stock_proyeccion.t30, label: 't+30' },
      { day: 60, value: r.stock_proyeccion.t60, label: 't+60' },
    ];
  });

  readonly recommendedRop = computed(() => {
    const r = this.pred.state().result;
    return r ? Math.round(r.derivados.reorder_point + r.derivados.safety_stock) : 0;
  });

  // -------- Sección 3 ----------
  readonly sliderDay = signal<number>(7);

  readonly sliderStock = computed(() => {
    const r = this.pred.state().result;
    if (!r) return 0;
    return r.simulacion.trayectoria[Math.min(this.sliderDay(), r.simulacion.trayectoria.length - 1)];
  });

  readonly sliderStatus = computed<'optimo' | 'alerta' | 'critico'>(() => {
    const r = this.pred.state().result;
    const req = this.pred.state().request;
    if (!r || !req) return 'optimo';
    const v = this.sliderStock();
    if (v < req.stock_min) return 'critico';
    if (v < r.derivados.reorder_point) return 'alerta';
    return 'optimo';
  });

  readonly sliderStatusLabel = computed(() => {
    const s = this.sliderStatus();
    return s === 'critico' ? 'Crítico' : s === 'alerta' ? 'Alerta' : 'Óptimo';
  });

  readonly sliderStatusIcon = computed(() => {
    const s = this.sliderStatus();
    return s === 'critico' ? '🚨' : s === 'alerta' ? '⚠️' : '✓';
  });

  readonly sliderStatusExplain = computed(() => {
    const s = this.sliderStatus();
    return s === 'critico' ? 'Stock por debajo del mínimo. Riesgo de quiebre.'
         : s === 'alerta'  ? 'Stock entre mínimo y punto de reorden. Conviene ordenar pronto.'
         : 'Stock por encima del punto de reorden. Operación normal.';
  });

  readonly eventsUntilSlider = computed<PredictionEvent[]>(() => {
    const r = this.pred.state().result;
    if (!r) return [];
    return r.simulacion.eventos.filter(e => e.trigger <= this.sliderDay());
  });
}
