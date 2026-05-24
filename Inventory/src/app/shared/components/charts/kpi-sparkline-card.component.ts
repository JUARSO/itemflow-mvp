import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LineChartComponent, LinePoint } from './line-chart.component';

type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'excess' | 'transit' | 'neutral';

/**
 * KPI con sparkline integrada — estilo dashboard ejecutivo.
 *
 * Layout:
 *   - Header: etiqueta corta arriba ("Month to date" / "Hoy" / etc.)
 *   - Centro: valor grande (con color según tono)
 *   - Mini-chart sparkline al final
 *   - Footer opcional: hint o fuente del dato + delta %
 */
@Component({
  selector: 'app-kpi-sparkline-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LineChartComponent],
  template: `
    <div class="kpi" [attr.data-tone]="tone()">
      @if (period()) {
        <div class="kpi__period">{{ period() }}</div>
      }
      <div class="kpi__label">{{ label() }}</div>
      <div class="kpi__value mono">{{ value() }}</div>

      @if (series() && series()!.length > 0) {
        <div class="kpi__chart">
          <app-line-chart [points]="series()!" [color]="sparkColor()" [mini]="true"></app-line-chart>
        </div>
      } @else if (hint()) {
        <div class="kpi__hint">{{ hint() }}</div>
      }

      @if (footer() || delta() !== undefined) {
        <div class="kpi__foot">
          @if (footer()) {
            <span class="kpi__source">{{ footer() }}</span>
          }
          @if (delta() !== undefined) {
            <span class="kpi__delta" [attr.data-pos]="(delta() ?? 0) >= 0">
              {{ (delta() ?? 0) >= 0 ? '▲' : '▼' }} {{ absDelta() }}%
            </span>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .kpi {
      display: flex;
      flex-direction: column;
      background: var(--ui-surface);
      border: var(--ui-border-w-md) solid var(--ui-border);
      box-shadow: var(--ui-shadow-md);
      padding: var(--ui-sp-3) var(--ui-sp-4);
      min-height: 170px;
      position: relative;
    }
    .kpi__period {
      font-size: 9px;
      letter-spacing: 0.6px;
      text-transform: uppercase;
      color: var(--ui-text-muted);
      font-weight: var(--ui-fw-bold);
      margin-bottom: 2px;
    }
    .kpi__label {
      font-size: var(--ui-fs-sm);
      font-weight: var(--ui-fw-bold);
      color: var(--ui-text-muted);
      text-align: center;
      margin-bottom: var(--ui-sp-2);
    }
    .kpi__value {
      /* Tamaño fluido: cabe hasta ₡9,999,999,999 cómodamente.
         clamp(min, preferred, max) — escala según ancho disponible. */
      font-size: clamp(18px, 2.2vw, 26px);
      font-weight: var(--ui-fw-black);
      text-align: center;
      line-height: 1.05;
      color: var(--ui-text);
      letter-spacing: -0.3px;
      margin-bottom: var(--ui-sp-2);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .kpi[data-tone="success"]  .kpi__value { color: var(--ui-success); }
    .kpi[data-tone="danger"]   .kpi__value { color: var(--ui-danger); }
    .kpi[data-tone="warning"]  .kpi__value { color: var(--ui-warning); }
    .kpi[data-tone="primary"]  .kpi__value { color: var(--ui-primary); }
    .kpi[data-tone="excess"]   .kpi__value { color: var(--ui-excess); }
    .kpi[data-tone="transit"]  .kpi__value { color: var(--ui-transit); }
    .kpi[data-tone="neutral"]  .kpi__value { color: var(--ui-text); }

    .kpi__chart {
      flex: 1;
      min-height: 64px;
      display: flex;
      align-items: flex-end;
    }
    .kpi__hint {
      font-size: var(--ui-fs-xs);
      color: var(--ui-text-muted);
      text-align: center;
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .kpi__foot {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: var(--ui-sp-2);
      margin-top: var(--ui-sp-2);
      border-top: var(--ui-border-w-sm) solid var(--ui-border);
      font-size: var(--ui-fs-xs);
    }
    .kpi__source {
      color: var(--ui-text-muted);
      font-weight: var(--ui-fw-medium);
    }
    .kpi__delta {
      font-weight: var(--ui-fw-black);
      padding: 2px 6px;
      font-size: 11px;
    }
    .kpi__delta[data-pos="true"]  { color: var(--ui-success); }
    .kpi__delta[data-pos="false"] { color: var(--ui-danger); }
  `],
})
export class KpiSparklineCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly tone = input<Tone>('neutral');
  readonly period = input<string | undefined>(undefined);
  readonly series = input<LinePoint[] | undefined>(undefined);
  readonly hint = input<string | undefined>(undefined);
  readonly footer = input<string | undefined>(undefined);
  /** Delta % vs período previo. Positivo = verde, negativo = rojo. */
  readonly delta = input<number | undefined>(undefined);

  protected readonly sparkColor = computed(() => {
    const t = this.tone();
    if (t === 'neutral') return 'var(--ui-primary)';
    return `var(--ui-${t})`;
  });

  protected absDelta(): string {
    const d = this.delta();
    if (d === undefined) return '0';
    return Math.abs(d).toFixed(1);
  }
}
