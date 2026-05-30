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
  templateUrl: './kpi-sparkline-card.component.html',
  styleUrls: ['./kpi-sparkline-card.component.scss'],
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
