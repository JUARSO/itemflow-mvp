import {
  AfterViewInit, ChangeDetectionStrategy, Component, ElementRef,
  OnDestroy, ViewChild, computed, effect, input,
} from '@angular/core';
import Chart from 'chart.js/auto';

export interface LinePoint { label: string; value: number; }

/**
 * Gráfico de línea suavizada con área degradada, basado en Chart.js.
 * Mantiene API estable: `points`, `title`, `color`, `mini`.
 * En modo `mini=true` se renderiza ultra-compacto para usar dentro de KPI cards.
 */
@Component({
  selector: 'app-line-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './line-chart.component.html',
  styleUrls: ['./line-chart.component.scss'],
})
export class LineChartComponent implements AfterViewInit, OnDestroy {
  readonly points = input.required<LinePoint[]>();
  readonly title = input<string | undefined>(undefined);
  readonly color = input<string>('#2c5fff');
  readonly mini = input<boolean>(false);

  @ViewChild('canvas') canvasRef?: ElementRef<HTMLCanvasElement>;
  private chart?: Chart;
  private viewReady = false;

  // Detecta cambios en cualquiera de las signals y re-renderiza
  private readonly inputsKey = computed(() => ({
    pts: this.points(),
    color: this.color(),
    mini: this.mini(),
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
      // Extraer nombre de var y leer el computed style del documento
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

    const pts = this.points();
    if (pts.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const colorHex = this.resolveColor(this.color());
    const mini = this.mini();

    // Gradiente para el área debajo de la línea
    const gradient = ctx.createLinearGradient(0, 0, 0, mini ? 60 : 200);
    gradient.addColorStop(0, this.hexWithAlpha(colorHex, 0.35));
    gradient.addColorStop(1, this.hexWithAlpha(colorHex, 0));

    const textMuted = this.resolveColor('var(--ui-text-muted)') || '#7a7a7a';
    const borderColor = this.resolveColor('var(--ui-border)') || '#e0e0e0';

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: pts.map(p => p.label),
        datasets: [{
          data: pts.map(p => p.value),
          borderColor: colorHex,
          backgroundColor: gradient,
          borderWidth: mini ? 2 : 2.5,
          tension: 0.4,
          fill: true,
          pointRadius: mini ? 0 : (ctx2: { dataIndex: number; dataset: { data: unknown[] } }) =>
            ctx2.dataIndex === ctx2.dataset.data.length - 1 ? 4 : 0,
          pointHoverRadius: mini ? 0 : 5,
          pointBackgroundColor: colorHex,
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: mini ? { enabled: false } : {
            backgroundColor: 'rgba(20,20,20,0.92)',
            padding: 10,
            borderColor,
            borderWidth: 1,
            cornerRadius: 4,
            titleColor: '#fff',
            bodyColor: '#fff',
            displayColors: false,
            callbacks: {
              label: (ctx2) => `${this.formatValue(Number(ctx2.parsed.y) || 0)}`,
            },
          },
        },
        scales: {
          x: {
            display: !mini,
            grid: { display: false, drawTicks: false },
            border: { display: false },
            ticks: {
              color: textMuted,
              font: { size: 10, family: 'monospace' },
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 5,
            },
          },
          y: {
            display: !mini,
            beginAtZero: true,
            grid: { color: borderColor, lineWidth: 1, drawTicks: false },
            border: { display: false },
            ticks: {
              color: textMuted,
              font: { size: 10, family: 'monospace' },
              maxTicksLimit: 4,
              callback: (val) => this.formatValueShort(Number(val)),
            },
          },
        },
      },
    });
  }

  private hexWithAlpha(hex: string, alpha: number): string {
    // Acepta #rrggbb o rgb()/hsl(); si es hex calcula rgba()
    if (hex.startsWith('#') && hex.length === 7) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r},${g},${b},${alpha})`;
    }
    return hex;
  }

  private formatValue(n: number): string {
    if (Math.abs(n) >= 1000) return n.toLocaleString('es-CR');
    return String(Math.round(n * 100) / 100);
  }

  private formatValueShort(n: number): string {
    if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (Math.abs(n) >= 1000) return (n / 1000).toFixed(0) + 'k';
    return String(Math.round(n));
  }
}
