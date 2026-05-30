import { ChangeDetectionStrategy, Component, input } from '@angular/core';

type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'excess' | 'transit';

@Component({
  selector: 'app-kpi-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './kpi-card.component.html',
  styleUrls: ['./kpi-card.component.scss'],
})
export class KpiCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly tone = input<Tone>('primary');
  readonly hint = input<string | undefined>(undefined);
}
