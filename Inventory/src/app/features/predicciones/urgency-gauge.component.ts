import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Semicírculo tipo velocímetro.
 *  - Aguja apunta al valor `value` (0..1).
 *  - Tres segmentos visualmente separados:
 *      óptimo  0..0.4
 *      alerta  0.4..0.7
 *      crítico 0.7..1
 *  - Variantes vía atributos data-* para que el sistema de diseño
 *    pueda estilizar sin acoplarse al componente.
 */
@Component({
  selector: 'app-urgency-gauge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="gauge" [attr.data-status]="status()">
      <svg viewBox="0 0 200 130" class="gauge__svg" aria-hidden="true">
        <!-- Segmentos del arco: óptimo, alerta, crítico -->
        <path d="M 20 110 A 80 80 0 0 1 92 31"
          fill="none" stroke="var(--ui-success)" stroke-width="14"
          [attr.opacity]="status() === 'optimo' ? 1 : 0.25" />
        <path d="M 92 31 A 80 80 0 0 1 144 47"
          fill="none" stroke="var(--ui-warning)" stroke-width="14"
          [attr.opacity]="status() === 'alerta' ? 1 : 0.25" />
        <path d="M 144 47 A 80 80 0 0 1 180 110"
          fill="none" stroke="var(--ui-danger)" stroke-width="14"
          [attr.opacity]="status() === 'critico' ? 1 : 0.25" />

        <!-- Aguja -->
        <line
          x1="100" y1="110"
          [attr.x2]="needleX()" [attr.y2]="needleY()"
          stroke="var(--ui-text-strong)" stroke-width="3" stroke-linecap="round" />
        <circle cx="100" cy="110" r="6" fill="var(--ui-text-strong)" />

        <!-- Etiquetas extremos -->
        <text x="20" y="125" font-size="10" fill="var(--ui-text-muted)" text-anchor="middle">0%</text>
        <text x="180" y="125" font-size="10" fill="var(--ui-text-muted)" text-anchor="middle">100%</text>
      </svg>
      <div class="gauge__value mono" [attr.data-status]="status()">{{ percentLabel() }}</div>
    </div>
  `,
  styles: [`
    .gauge {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--ui-sp-2);
    }
    .gauge__svg {
      width: 100%;
      max-width: 220px;
      height: auto;
    }
    .gauge__value {
      font-size: var(--ui-fs-2xl);
      font-weight: var(--ui-fw-bold);
      line-height: 1;
    }
    .gauge__value[data-status="optimo"]  { color: var(--ui-success); }
    .gauge__value[data-status="alerta"]  { color: var(--ui-warning); }
    .gauge__value[data-status="critico"] { color: var(--ui-danger); }
  `],
})
export class UrgencyGaugeComponent {
  readonly value = input.required<number>();   // 0..1

  readonly status = computed<'optimo' | 'alerta' | 'critico'>(() => {
    const v = this.value();
    if (v >= 0.7) return 'critico';
    if (v >= 0.4) return 'alerta';
    return 'optimo';
  });

  readonly percentLabel = computed(() => `${Math.round(this.value() * 100)}%`);

  /** Posición de la aguja: arco semicircular de 180° desde (20,110) a (180,110). */
  readonly needleX = computed(() => {
    const angle = Math.PI * (1 - this.value()); // de π (izquierda) a 0 (derecha)
    return 100 + Math.cos(angle) * 75;
  });

  readonly needleY = computed(() => {
    const angle = Math.PI * (1 - this.value());
    return 110 - Math.sin(angle) * 75;
  });
}
