import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { KardexEntry } from '../../../core/models';

@Component({
  selector: 'app-kardex-row',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe],
  template: `
    <div class="row" [attr.data-type]="entry().type">
      <div class="row__date mono">{{ entry().at | date:'dd-MM HH:mm' }}</div>
      <div class="row__type">
        <span class="icon">{{ icon() }}</span>
        <span class="label">{{ typeLabel() }}</span>
      </div>
      <div class="row__qty mono" [attr.data-sign]="sign()">
        {{ sign() }}{{ entry().qty | number:'1.0-3' }}
      </div>
      <div class="row__balance mono">{{ entry().balance | number:'1.0-3' }}</div>
      <div class="row__user">{{ entry().userName }}</div>
      <div class="row__reason">{{ reasonLabel() }}</div>
    </div>
  `,
  styles: [`
    .row {
      display: grid;
      grid-template-columns: 110px 110px 90px 90px 1fr 1fr;
      gap: var(--ui-sp-3);
      align-items: center;
      padding: var(--ui-sp-3) var(--ui-sp-4);
      border-bottom: var(--ui-border-w-sm) solid var(--ui-border);
      font-size: var(--ui-fs-sm);
    }
    .row:hover { background: var(--ui-surface-3); }

    .row__date { color: var(--ui-text-muted); }
    .row__type { display: flex; align-items: center; gap: 6px; font-weight: var(--ui-fw-bold); }
    .row__type .icon { font-size: 16px; }
    .row[data-type="in"]         .row__type { color: var(--ui-success); }
    .row[data-type="out"]        .row__type { color: var(--ui-danger); }
    .row[data-type="adjustment"] .row__type { color: var(--ui-warning); }

    .row__qty { font-weight: var(--ui-fw-bold); }
    .row__qty[data-sign="+"] { color: var(--ui-success); }
    .row__qty[data-sign="-"] { color: var(--ui-danger); }
    .row__qty[data-sign="±"] { color: var(--ui-warning); }

    .row__balance { font-weight: var(--ui-fw-bold); color: var(--ui-text); }
    .row__user { color: var(--ui-text); }
    .row__reason { color: var(--ui-text-muted); font-size: var(--ui-fs-xs); }

    @media (max-width: 768px) {
      .row {
        grid-template-columns: 1fr 1fr;
        gap: var(--ui-sp-2);
      }
      .row__user, .row__reason { grid-column: 1 / -1; }
    }
  `],
})
export class KardexRowComponent {
  readonly entry = input.required<KardexEntry>();

  readonly icon = computed(() => {
    switch (this.entry().type) {
      case 'in': return '↑';
      case 'out': return '↓';
      case 'adjustment': return '⚙';
    }
  });

  readonly sign = computed(() => {
    switch (this.entry().type) {
      case 'in': return '+';
      case 'out': return '-';
      case 'adjustment': return '±';
    }
  });

  readonly typeLabel = computed(() => {
    switch (this.entry().type) {
      case 'in': return 'Entrada';
      case 'out': return 'Salida';
      case 'adjustment': return 'Ajuste';
    }
  });

  readonly reasonLabel = computed(() => {
    const map: Record<string, string> = {
      purchase: 'Compra recibida',
      sale: 'Venta',
      damaged: 'Producto dañado',
      expired: 'Vencido',
      lost: 'Pérdida',
      count_correction: 'Corrección de conteo',
      manual: 'Manual',
      return_from_customer: 'Devolución cliente',
    };
    return map[this.entry().reason] ?? this.entry().reason;
  });
}
