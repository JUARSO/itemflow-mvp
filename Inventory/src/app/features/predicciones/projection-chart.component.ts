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
  template: `
    @if (hasStockout()) {
      <div class="banner" role="status">
        ⚠️ Quiebre de stock detectado · ROP mínimo recomendado: {{ recommendedRop() }} u
      </div>
    }

    <div class="chart" #wrap>
      <svg
        [attr.viewBox]="'0 0 ' + W + ' ' + H"
        preserveAspectRatio="none"
        class="chart__svg"
        (mousemove)="onMove($event, wrap)"
        (mouseleave)="hoverDay.set(null)">

        <!-- Regiones de fondo (eje Y) -->
        <rect [attr.x]="PAD_L" [attr.y]="yFor(maxY())" [attr.width]="W - PAD_L - PAD_R"
              [attr.height]="yFor(0) - yFor(maxY())" fill="transparent" />

        <rect [attr.x]="PAD_L" [attr.y]="yFor(stockMin())" [attr.width]="W - PAD_L - PAD_R"
              [attr.height]="yFor(0) - yFor(stockMin())"
              fill="var(--ui-danger-tint)" opacity="0.45" />

        <rect [attr.x]="PAD_L" [attr.y]="yFor(reorderPoint())" [attr.width]="W - PAD_L - PAD_R"
              [attr.height]="yFor(stockMin()) - yFor(reorderPoint())"
              fill="var(--ui-warning-tint)" opacity="0.45" />

        @if (maxY() > stockMax()) {
          <rect [attr.x]="PAD_L" [attr.y]="yFor(maxY())" [attr.width]="W - PAD_L - PAD_R"
                [attr.height]="yFor(stockMax()) - yFor(maxY())"
                fill="var(--ui-excess-tint)" opacity="0.45" />
        }

        <!-- Líneas de referencia -->
        <line [attr.x1]="PAD_L" [attr.x2]="W - PAD_R"
              [attr.y1]="yFor(stockMin())" [attr.y2]="yFor(stockMin())"
              stroke="var(--ui-danger)" stroke-width="1" stroke-dasharray="4 4" opacity="0.7" />
        <text [attr.x]="W - PAD_R" [attr.y]="yFor(stockMin()) - 4"
              text-anchor="end" font-size="10" fill="var(--ui-danger)">mín {{ stockMin() }}</text>

        <line [attr.x1]="PAD_L" [attr.x2]="W - PAD_R"
              [attr.y1]="yFor(reorderPoint())" [attr.y2]="yFor(reorderPoint())"
              stroke="var(--ui-warning)" stroke-width="1" stroke-dasharray="4 4" opacity="0.7" />
        <text [attr.x]="W - PAD_R" [attr.y]="yFor(reorderPoint()) - 4"
              text-anchor="end" font-size="10" fill="var(--ui-warning)">ROP {{ reorderPoint() }}</text>

        <line [attr.x1]="PAD_L" [attr.x2]="W - PAD_R"
              [attr.y1]="yFor(stockMax())" [attr.y2]="yFor(stockMax())"
              stroke="var(--ui-secondary)" stroke-width="1" stroke-dasharray="4 4" opacity="0.7" />
        <text [attr.x]="W - PAD_R" [attr.y]="yFor(stockMax()) - 4"
              text-anchor="end" font-size="10" fill="var(--ui-secondary)">máx {{ stockMax() }}</text>

        <!-- Trayectoria por segmentos clasificados -->
        @for (seg of segments(); track $index) {
          <polyline
            [attr.points]="seg.points"
            fill="none"
            [attr.stroke]="strokeFor(seg.status)"
            stroke-width="2"
            stroke-linejoin="round"
            stroke-linecap="round" />
        }

        <!-- Marcadores IA (t+7, t+14, t+30, t+60) -->
        @for (m of visibleMarkers(); track m.day) {
          <g class="marker">
            <circle [attr.cx]="xFor(m.day)" [attr.cy]="yFor(m.value)" r="5"
                    fill="var(--ui-surface)" stroke="var(--ui-primary)" stroke-width="2" />
            <circle [attr.cx]="xFor(m.day)" [attr.cy]="yFor(m.value)" r="2"
                    fill="var(--ui-primary)" />
            <text [attr.x]="xFor(m.day)" [attr.y]="yFor(m.value) - 10"
                  text-anchor="middle" font-size="9" font-weight="600"
                  fill="var(--ui-primary)">{{ m.label }}</text>
          </g>
        }

        <!-- Eje X: ticks principales -->
        @for (t of xTicks(); track t.day) {
          <line [attr.x1]="xFor(t.day)" [attr.x2]="xFor(t.day)"
                [attr.y1]="H - PAD_B" [attr.y2]="H - PAD_B + 4"
                stroke="var(--ui-border-strong)" stroke-width="1" />
          <text [attr.x]="xFor(t.day)" [attr.y]="H - PAD_B + 16"
                text-anchor="middle" font-size="10" fill="var(--ui-text-muted)">{{ t.label }}</text>
        }

        <!-- Cursor hover -->
        @if (hoverDay() != null) {
          <line [attr.x1]="xFor(hoverDay()!)" [attr.x2]="xFor(hoverDay()!)"
                [attr.y1]="PAD_T" [attr.y2]="H - PAD_B"
                stroke="var(--ui-text-muted)" stroke-width="1" stroke-dasharray="2 3" />
          <circle [attr.cx]="xFor(hoverDay()!)" [attr.cy]="yFor(valueAt(hoverDay()!))"
                  r="4" fill="var(--ui-text-strong)" />
        }
      </svg>

      @if (hoverDay() != null) {
        <div class="tooltip"
             [style.left.px]="tooltipLeft()"
             [style.top.px]="tooltipTop()">
          <div><strong>Día {{ hoverDay() }}</strong></div>
          <div>Stock: <span class="mono">{{ valueAt(hoverDay()!) }} u</span></div>
          <div>Estado: {{ statusLabel(statusAt(hoverDay()!)) }}</div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; position: relative; }
    .chart {
      position: relative;
      width: 100%;
      height: 320px;
    }
    .chart__svg {
      width: 100%; height: 100%;
      display: block;
    }
    @media (max-width: 768px) {
      .chart { height: 240px; }
      .banner { font-size: var(--ui-fs-xs); }
    }
    .banner {
      padding: var(--ui-sp-2) var(--ui-sp-3);
      margin-bottom: var(--ui-sp-2);
      background: var(--ui-danger-tint);
      border: var(--ui-border-w-sm) solid var(--ui-danger);
      border-radius: var(--ui-radius);
      color: var(--ui-danger);
      font-size: var(--ui-fs-sm);
      font-weight: var(--ui-fw-medium);
    }
    .tooltip {
      position: absolute;
      background: var(--ui-text-strong);
      color: #fff;
      padding: 6px 10px;
      font-size: var(--ui-fs-xs);
      border-radius: var(--ui-radius);
      pointer-events: none;
      white-space: nowrap;
      transform: translate(-50%, -100%);
      margin-top: -8px;
      box-shadow: var(--ui-shadow-md);
    }
    .tooltip strong { color: #fff; }
    .tooltip .mono { font-family: var(--ui-font-mono); }
  `],
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
