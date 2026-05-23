import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { StockStatus } from '../../../core/models';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="badge" [class]="cssClass()">{{ label() }}</span>`,
  styles: [`
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      border: var(--ui-border-w-sm) solid var(--ui-border);
      border-radius: 9999px;
      font-size: var(--ui-fs-xs);
      font-weight: var(--ui-fw-bold);
      line-height: 1;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      white-space: nowrap;
    }
    .badge::before {
      content: '';
      width: 8px;
      height: 8px;
      border-radius: 9999px;
      background: currentColor;
    }
    .badge--available {
      background: var(--ui-success-tint);
      color: var(--ui-success);
    }
    .badge--low {
      background: var(--ui-warning-tint);
      color: var(--ui-warning);
    }
    .badge--critical {
      background: var(--ui-danger-tint);
      color: var(--ui-danger);
    }
    .badge--out {
      background: var(--ui-danger);
      color: #fff;
    }
    .badge--out::before { background: #fff; }
  `],
})
export class StatusBadgeComponent {
  readonly status = input.required<StockStatus>();
  readonly label = computed(() => {
    switch (this.status()) {
      case 'available': return 'Disponible';
      case 'low': return 'Bajo';
      case 'critical': return 'Crítico';
      case 'out': return 'Agotado';
    }
  });
  readonly cssClass = computed(() => `badge--${this.status()}`);
}
