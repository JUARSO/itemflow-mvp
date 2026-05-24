import {
  AfterViewInit, ChangeDetectionStrategy, Component, ElementRef,
  OnDestroy, ViewChild, computed, effect, input,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import Chart from 'chart.js/auto';

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

/**
 * Donut chart con Chart.js — canvas + leyenda lateral propia (más rica que la
 * leyenda nativa). Muestra valor total en el centro.
 */
@Component({
  selector: 'app-donut-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe],
  template: `
    @if (total() === 0) {
      <div class="empty">Sin datos.</div>
    } @else {
      <div class="donut">
        <div class="donut__chart">
          <canvas #canvas></canvas>
          <div class="donut__center">
            <div class="donut__value mono">{{ total() | number:'1.0-' + decimals() }}</div>
            <div class="donut__label">{{ centerLabel() }}</div>
          </div>
        </div>
        <div class="legend">
          @for (s of slicesWithPct(); track s.label) {
            <div class="legend__row">
              <span class="legend__dot" [style.background]="s.color"></span>
              <div class="legend__main">
                <span class="legend__label">{{ s.label }}</span>
                <span class="legend__pct mono">{{ s.pct | number:'1.0-1' }}%</span>
              </div>
              <span class="legend__value mono">{{ s.value | number:'1.0-' + decimals() }}</span>
            </div>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    .donut {
      display: grid;
      grid-template-columns: 180px 1fr;
      gap: var(--ui-sp-3);
      align-items: center;
    }
    @media (max-width: 480px) {
      .donut { grid-template-columns: 1fr; }
    }
    .donut__chart {
      position: relative;
      width: 180px;
      height: 180px;
    }
    canvas { width: 180px !important; height: 180px !important; }
    .donut__center {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      pointer-events: none;
    }
    .donut__value {
      font-size: var(--ui-fs-xl);
      font-weight: var(--ui-fw-black);
      color: var(--ui-text);
      line-height: 1;
    }
    .donut__label {
      font-size: 9px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      color: var(--ui-text-muted);
      margin-top: 2px;
      font-weight: var(--ui-fw-bold);
    }

    .legend { display: flex; flex-direction: column; gap: 8px; }
    .legend__row {
      display: grid;
      grid-template-columns: 12px 1fr auto;
      gap: 8px;
      align-items: center;
    }
    .legend__dot {
      width: 10px;
      height: 10px;
      border-radius: 2px;
    }
    .legend__main {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .legend__label {
      font-size: var(--ui-fs-sm);
      font-weight: var(--ui-fw-bold);
      color: var(--ui-text);
      line-height: 1.2;
    }
    .legend__pct {
      font-size: var(--ui-fs-xs);
      color: var(--ui-text-muted);
    }
    .legend__value {
      font-size: var(--ui-fs-sm);
      font-weight: var(--ui-fw-black);
      color: var(--ui-text);
    }

    .empty {
      padding: var(--ui-sp-4);
      text-align: center;
      color: var(--ui-text-muted);
      font-size: var(--ui-fs-sm);
      background: var(--ui-surface-2);
      border-radius: 4px;
    }
  `],
})
export class DonutChartComponent implements AfterViewInit, OnDestroy {
  readonly data = input.required<DonutSlice[]>();
  readonly centerLabel = input<string>('TOTAL');
  readonly decimals = input<number>(0);

  @ViewChild('canvas') canvasRef?: ElementRef<HTMLCanvasElement>;
  private chart?: Chart;
  private viewReady = false;

  protected readonly total = computed(() =>
    this.data().reduce((s, x) => s + x.value, 0)
  );

  protected readonly slicesWithPct = computed(() => {
    const t = this.total();
    if (t === 0) return [];
    return this.data().map(s => ({ ...s, pct: (s.value / t) * 100 }));
  });

  private readonly inputsKey = computed(() => ({
    data: this.data(),
  }));

  constructor() {
    effect(() => {
      this.inputsKey();
      if (this.viewReady) this.render();
    });
  }

  ngAfterViewInit() {
    this.viewReady = true;
    this.render();
  }

  ngOnDestroy() {
    this.chart?.destroy();
  }

  private resolveColor(c: string): string {
    if (c.startsWith('var(')) {
      const name = c.slice(4, -1).trim();
      const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return value || '#2c5fff';
    }
    return c;
  }

  private render() {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;
    if (this.chart) { this.chart.destroy(); this.chart = undefined; }

    const data = this.data();
    if (data.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const colors = data.map(d => this.resolveColor(d.color));
    const borderColor = this.resolveColor('var(--ui-surface)') || '#ffffff';

    this.chart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: data.map(d => d.label),
        datasets: [{
          data: data.map(d => d.value),
          backgroundColor: colors,
          borderColor,
          borderWidth: 2,
          hoverOffset: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(20,20,20,0.92)',
            padding: 10,
            cornerRadius: 4,
            titleColor: '#fff',
            bodyColor: '#fff',
            displayColors: true,
            callbacks: {
              label: (c) => {
                const total = data.reduce((s, x) => s + x.value, 0) || 1;
                const v = Number(c.parsed);
                const pct = ((v / total) * 100).toFixed(1);
                return ` ${v.toLocaleString('es-CR')} (${pct}%)`;
              },
            },
          },
        },
      },
    });
  }
}
