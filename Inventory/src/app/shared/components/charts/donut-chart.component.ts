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
  templateUrl: './donut-chart.component.html',
  styleUrls: ['./donut-chart.component.scss'],
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
