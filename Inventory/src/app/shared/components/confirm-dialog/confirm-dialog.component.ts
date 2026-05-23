import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IonModal, IonButton } from '@ionic/angular/standalone';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonModal, IonButton],
  template: `
    <ion-modal
      [isOpen]="isOpen()"
      [backdropDismiss]="true"
      (didDismiss)="cancelled.emit()"
      class="nb-confirm">
      <ng-template>
        <div class="confirm">
          <div class="confirm__icon" [attr.data-tone]="tone()">
            @switch (tone()) {
              @case ('danger') { ⚠ }
              @case ('warning') { ⚠ }
              @default { ? }
            }
          </div>
          <h2 class="confirm__title">{{ title() }}</h2>
          @if (message()) {
            <p class="confirm__message">{{ message() }}</p>
          }
          <div class="confirm__actions">
            <ion-button fill="clear" class="ghost" (click)="cancelled.emit()">
              {{ cancelLabel() }}
            </ion-button>
            <ion-button
              [color]="tone() === 'danger' ? 'danger' : 'primary'"
              (click)="confirmed.emit()">
              {{ confirmLabel() }}
            </ion-button>
          </div>
        </div>
      </ng-template>
    </ion-modal>
  `,
  styles: [`
    :host ::ng-deep ion-modal.nb-confirm {
      --width: 420px;
      --max-width: 95vw;
      --height: auto;
      --border-radius: 0;
      --box-shadow: none;
      --background: transparent;
      --backdrop-opacity: 0.6;
    }
    :host ::ng-deep ion-modal.nb-confirm::part(content) {
      border: var(--ui-border-w-lg) solid var(--ui-border);
      box-shadow: var(--ui-shadow-lg);
      background: var(--ui-surface);
    }
    .confirm {
      padding: var(--ui-sp-6);
      text-align: center;
    }
    .confirm__icon {
      width: 64px;
      height: 64px;
      margin: 0 auto var(--ui-sp-4);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 32px;
      font-weight: var(--ui-fw-black);
      border: var(--ui-border-w-lg) solid var(--ui-border);
      background: var(--ui-warning-tint);
      color: var(--ui-warning);
    }
    .confirm__icon[data-tone="danger"] {
      background: var(--ui-danger-tint);
      color: var(--ui-danger);
    }
    .confirm__title {
      font-family: var(--ui-font-display);
      font-weight: var(--ui-fw-black);
      font-size: var(--ui-fs-xl);
      margin: 0 0 var(--ui-sp-3);
    }
    .confirm__message {
      font-size: var(--ui-fs-md);
      color: var(--ui-text-muted);
      margin: 0 0 var(--ui-sp-6);
      line-height: var(--ui-lh-base);
    }
    .confirm__actions {
      display: flex;
      gap: var(--ui-sp-2);
      justify-content: center;
    }
  `],
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
