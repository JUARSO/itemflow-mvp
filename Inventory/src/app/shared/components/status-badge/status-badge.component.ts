import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { StockStatus } from '../../../core/models';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './status-badge.component.html',
  styleUrls: ['./status-badge.component.scss'],
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
