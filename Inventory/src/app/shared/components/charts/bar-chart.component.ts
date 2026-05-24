import {
  AfterViewInit, ChangeDetectionStrategy, Component, ElementRef,
  OnDestroy, ViewChild, computed, effect, input,
} from '@angular/core';
import Chart from 'chart.js/auto';

export interface BarItem {
  label: string;
  value: number;
  color?: string;
}

/**
 * Gráfico de barras horizontales con Chart.js — limpio, con barras redondeadas
 * y tooltip al hover. Útil para rankings y distribuciones.
 */
@Component({
  selector: 'app-bar-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (items().length === 0) {
      <div class="empty">Sin datos.</div>
    } @else {
      <div class="chart__canvas" [style.height.px]="chartHeight()">
        <canvas #canvas></canvas>
      </div>
    }
  `,
  styles: [`
    .chart__canvas { position: relative; width: 100%; }
    canvas { width: 100% !important; }
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
export class BarChartComponent implements AfterViewInit, OnDestroy {
  readonly items = input.required<BarItem[]>();
  readonly defaultColor = input<string>('#2c5fff');
  readonly valuePrefix = input<string>('');
  readonly valueSuffix = input<string>('');
  readonly decimals = input<number>(0);

  @ViewChild('canvas') canvasRef?: ElementRef<HTMLCanvasElement>;
  private chart?: Chart;
  private viewReady = false;

  protected readonly chartHeight = computed(() =>
    Math.max(160, Math.min(420, this.items().length * 36 + 20))
  );

  private readonly inputsKey = computed(() => ({
    items: this.items(),
    color: this.defaultColor(),
    prefix: this.valuePrefix(),
    suffix: this.valueSuffix(),
    decimals: this.decimals(),
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

    const items = this.items();
    if (items.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const defaultC = this.resolveColor(this.defaultColor());
    const textMuted = this.resolveColor('var(--ui-text-muted)') || '#7a7a7a';
    const text = this.resolveColor('var(--ui-text)') || '#1a1a1a';
    const borderColor = this.resolveColor('var(--ui-border)') || '#e0e0e0';

    const colors = items.map(i => i.color ? this.resolveColor(i.color) : defaultC);

    this.chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: items.map(i => i.label),
        datasets: [{
          data: items.map(i => i.value),
          backgroundColor: colors,
          borderRadius: 4,
          borderSkipped: false,
          barPercentage: 0.78,
          categoryPercentage: 0.85,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(20,20,20,0.92)',
            padding: 10,
            borderColor,
            borderWidth: 1,
            cornerRadius: 4,
            titleColor: '#fff',
            bodyColor: '#fff',
            displayColors: false,
            callbacks: {
              label: (c) => this.formatValue(Number(c.parsed.x)),
            },
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: borderColor, lineWidth: 1, drawTicks: false },
            border: { display: false },
            ticks: {
              color: textMuted,
              font: { size: 10, family: 'monospace' },
              maxTicksLimit: 4,
              callback: (v) => this.formatValueShort(Number(v)),
            },
          },
          y: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              color: text,
              font: { size: 12, weight: 'bold' },
              padding: 6,
              autoSkip: false,
            },
          },
        },
      },
    });
  }

  private formatValue(n: number): string {
    const dec = this.decimals();
    const formatted = n.toLocaleString('es-CR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: dec,
    });
    return `${this.valuePrefix()}${formatted}${this.valueSuffix()}`;
  }

  private formatValueShort(n: number): string {
    if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (Math.abs(n) >= 1000) return (n / 1000).toFixed(0) + 'k';
    return String(Math.round(n));
  }
}
