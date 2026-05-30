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
  templateUrl: './urgency-gauge.component.html',
  styleUrls: ['./urgency-gauge.component.scss'],
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
