import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IonButton, IonIcon } from '@ionic/angular/standalone';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonButton, IonIcon],
  templateUrl: './empty-state.component.html',
  styleUrls: ['./empty-state.component.scss'],
})
export class EmptyStateComponent {
  /** Nombre de un icono de Ionic (ej: 'cube-outline'). */
  readonly icon = input<string>('cube-outline');
  readonly title = input.required<string>();
  readonly body = input.required<string>();
  readonly ctaLabel = input<string | undefined>(undefined);
  readonly ctaClick = output<void>();
}
