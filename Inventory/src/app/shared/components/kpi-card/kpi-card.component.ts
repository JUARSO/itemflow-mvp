import { ChangeDetectionStrategy, Component, input } from '@angular/core';

type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'excess' | 'transit';

@Component({
  selector: 'app-kpi-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card" [attr.data-tone]="tone()">
      <div class="card__stripe"></div>
      <div class="card__body">
        <div class="card__label">{{ label() }}</div>
        <div class="card__value mono">{{ value() }}</div>
        @if (hint()) {
          <div class="card__hint">{{ hint() }}</div>
        }
      </div>
    </div>
  `,
  styles: [`
    .card {
      display: flex;
      background: var(--ui-surface-2);
      border: var(--ui-border-w-md) solid var(--ui-border);
      box-shadow: var(--ui-shadow-md);
      min-height: 110px;
      height: 100%;
    }
    .card__stripe {
      width: 12px;
      flex-shrink: 0;
    }
    .card[data-tone="primary"] .card__stripe { background: var(--ui-primary); }
    .card[data-tone="success"] .card__stripe { background: var(--ui-success); }
    .card[data-tone="warning"] .card__stripe { background: var(--ui-warning); }
    .card[data-tone="danger"]  .card__stripe { background: var(--ui-danger); }
    .card[data-tone="excess"]  .card__stripe { background: var(--ui-excess); }
    .card[data-tone="transit"] .card__stripe { background: var(--ui-transit); }
    .card__body {
      padding: var(--ui-sp-3) var(--ui-sp-4);
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }
    .card__label {
      font-size: var(--ui-fs-xs);
      font-weight: var(--ui-fw-bold);
      letter-spacing: 0.4px;
      text-transform: uppercase;
      color: var(--ui-text-muted);
    }
    .card__value {
      /* Tamaño fluido: escala 16px → 22px según ancho disponible,
         caben montos hasta 10 cifras (mil millones) sin overflow. */
      font-size: clamp(16px, 1.9vw, 22px);
      font-weight: var(--ui-fw-black);
      line-height: 1.05;
      color: var(--ui-text);
      letter-spacing: -0.3px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .card__hint {
      font-size: var(--ui-fs-xs);
      color: var(--ui-text-muted);
      margin-top: 4px;
    }
  `],
})
export class KpiCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly tone = input<Tone>('primary');
  readonly hint = input<string | undefined>(undefined);
}
