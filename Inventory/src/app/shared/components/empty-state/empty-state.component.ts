import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IonButton } from '@ionic/angular/standalone';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonButton],
  templateUrl: './empty-state.component.html',
  styleUrls: ['./empty-state.component.scss'],
})
export class EmptyStateComponent {
  readonly icon = input<string>('📦');
  readonly title = input.required<string>();
  readonly body = input.required<string>();
  readonly ctaLabel = input<string | undefined>(undefined);
  readonly ctaClick = output<void>();
}
