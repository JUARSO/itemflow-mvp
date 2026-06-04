import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IonModal, IonButton, IonIcon } from '@ionic/angular/standalone';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonModal, IonButton, IonIcon],
  templateUrl: './confirm-dialog.component.html',
  styleUrls: ['./confirm-dialog.component.scss'],
})
export class ConfirmDialogComponent {
  readonly isOpen = input.required<boolean>();
  readonly title = input.required<string>();
  readonly message = input<string | undefined>(undefined);
  readonly tone = input<'danger' | 'warning' | 'info'>('warning');
  readonly confirmLabel = input<string>('Confirmar');
  readonly cancelLabel = input<string>('Cancelar');

  readonly confirmed = output<void>();
  readonly cancelled = output<void>();
}
