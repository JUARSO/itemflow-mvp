import { ChangeDetectionStrategy, Component, computed, ElementRef, input, signal, viewChild } from '@angular/core';

/**
 * Gráfico SVG inline de proyección de stock.
 *
 *  - Eje X: días 0..maxDay (configurable, default 60).
 *  - Eje Y: unidades en stock.
 *  - Serie principal: trayectoria día a día (segmentos clasificados
 *    por color según política).
 *  - Marcadores especiales: t+7, t+14, t+30, t+60 (predicciones IA).
 *  - Regiones de fondo: bajo mínimo, alerta, sobrestock.
 *  - Líneas de referencia: stock_min, stock_max, reorder_point.
 *  - Banner sobre el gráfico si hay quiebre (stock=0 en algún punto).
 *  - Tooltip al hover sobre cualquier día.
 *
 *  Diseño visual delegado a tokens del sistema.
 */
export interface ProjectionMarker {
  day: number;
  value: number;
  label: string;
}

@Component({
  selector: 'app-projection-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './projection-chart.component.html',
  styleUrls: ['./projection-chart.component.scss'],
})
export class ProjectionChartComponent {
  readonly trayectoria = input.required<number[]>();
  readonly markers = input<ProjectionMarker[]>([]);
  readonly stockMin = input.required<number>();
  readonly stockMax = input.required<number>();
  readonly reorderPoint = input.required<number>();
  /** Día máximo a graficar. Por defecto 60. */
  readonly maxDay = input<number>(60);
  /** Etiquetas de eje X. Si no se pasan se infieren a partir de maxDay. */
  readonly xTickLabels = input<{ day: number; label: string }[] | undefined>(undefined);

  /** ROP mínimo recomendado mostrado en el banner cuando hay quiebre. */
  readonly recommendedRop = input<number>(0);

  // Geometría
  readonly W = 800;
  readonly H = 320;
  readonly PAD_L = 36;
  readonly PAD_R = 24;
  readonly PAD_T = 16;
  readonly PAD_B = 28;

  readonly hoverDay = signal<number | null>(null);
  readonly tooltipLeft = signal(0);
  readonly tooltipTop = signal(0);

  readonly clippedTraj = computed(() =>
    this.trayectoria().slice(0, this.maxDay() + 1)
  );

  readonly maxY = computed(() => {
    const fromTraj = Math.max(...this.clippedTraj(), 0);
    const fromPolicy = Math.max(this.stockMax(), this.reorderPoint(), this.stockMin());
    return Math.ceil(Math.max(fromTraj, fromPolicy) * 1.1);
  });

  readonly hasStockout = computed(() => this.clippedTraj().some(v => v <= 0));

  readonly xTicks = computed(() => {
    if (this.xTickLabels()) return this.xTickLabels()!;
    const max = this.maxDay();
    return [
      { day: 0, label: 'Hoy' },
      { day: 7, label: 't+7d' },
      { day: 14, label: 't+14d' },
      { day: 30, label: 't+30d' },
      { day: max, label: `t+${max}d` },
    ].filter((t, i, arr) => arr.findIndex(x => x.day === t.day) === i && t.day <= max);
  });

  readonly visibleMarkers = computed(() =>
    this.markers().filter(m => m.day <= this.maxDay())
  );

  /** Trayectoria segmentada por status para colorear el polyline. */
  readonly segments = computed(() => {
    const traj = this.clippedTraj();
    const segs: { status: 'critico' | 'alerta' | 'optimo'; points: string }[] = [];
    if (traj.length === 0) return segs;
    let currentStatus = this.statusFor(traj[0]);
    let currentPoints: string[] = [`${this.xFor(0)},${this.yFor(traj[0])}`];
    for (let i = 1; i < traj.length; i++) {
      const s = this.statusFor(traj[i]);
      currentPoints.push(`${this.xFor(i)},${this.yFor(traj[i])}`);
      if (s !== currentStatus) {
        segs.push({ status: currentStatus, points: currentPoints.join(' ') });
        currentStatus = s;
        currentPoints = [`${this.xFor(i)},${this.yFor(traj[i])}`];
      }
    }
    if (currentPoints.length > 0) {
      segs.push({ status: currentStatus, points: currentPoints.join(' ') });
    }
    return segs;
  });

  // Mapeo de coordenadas
  xFor(day: number): number {
    const innerW = this.W - this.PAD_L - this.PAD_R;
    const pct = day / Math.max(1, this.maxDay());
    return this.PAD_L + pct * innerW;
  }
  yFor(value: number): number {
    const innerH = this.H - this.PAD_T - this.PAD_B;
    const pct = value / Math.max(1, this.maxY());
    return this.PAD_T + (1 - pct) * innerH;
  }

  statusFor(v: number): 'critico' | 'alerta' | 'optimo' {
    if (v < this.stockMin()) return 'critico';
    if (v < this.reorderPoint()) return 'alerta';
    return 'optimo';
  }

  statusLabel(s: 'critico' | 'alerta' | 'optimo'): string {
    return s === 'critico' ? 'CRÍTICO' : s === 'alerta' ? 'ALERTA' : 'ÓPTIMO';
  }

  strokeFor(status: 'critico' | 'alerta' | 'optimo'): string {
    return status === 'critico' ? 'var(--ui-danger)'
         : status === 'alerta'  ? 'var(--ui-warning)'
         : 'var(--ui-success)';
  }

  valueAt(day: number): number {
    const traj = this.clippedTraj();
    return traj[Math.max(0, Math.min(day, traj.length - 1))] ?? 0;
  }

  statusAt(day: number): 'critico' | 'alerta' | 'optimo' {
    return this.statusFor(this.valueAt(day));
  }

  onMove(ev: MouseEvent, wrap: HTMLElement) {
    const rect = wrap.getBoundingClientRect();
    const px = ev.clientX - rect.left;
    const innerW = rect.width;
    // Convertir x absoluto en día del eje
    const padLeftPct = this.PAD_L / this.W;
    const padRightPct = this.PAD_R / this.W;
    const usableWidthPct = 1 - padLeftPct - padRightPct;
    const usablePx = innerW * usableWidthPct;
    const offsetPx = px - innerW * padLeftPct;
    const dayPct = Math.max(0, Math.min(1, offsetPx / usablePx));
    const day = Math.round(dayPct * this.maxDay());
    this.hoverDay.set(day);
    this.tooltipLeft.set(px);
    const valueY = this.yFor(this.valueAt(day));
    this.tooltipTop.set(rect.height * (valueY / this.H));
  }
}
