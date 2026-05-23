import { ChangeDetectionStrategy, Component, EventEmitter, input, output, Output } from '@angular/core';
import { IonModal, IonButton } from '@ionic/angular/standalone';

/**
 * Wrapper neobrutalism para ion-modal con header, body y footer.
 * Uso:
 *  <app-form-modal [isOpen]="abierto()" title="Nuevo producto" (dismissed)="abierto.set(false)">
 *    <div body>...contenido del form...</div>
 *    <div footer>
 *      <ion-button fill="clear" (click)="abierto.set(false)">Cancelar</ion-button>
 *      <ion-button (click)="guardar()">Guardar</ion-button>
 *    </div>
 *  </app-form-modal>
 */
@Component({
  selector: 'app-form-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonModal],
  template: `
    <ion-modal
      [isOpen]="isOpen()"
      [backdropDismiss]="true"
      (didDismiss)="dismissed.emit()"
      class="nb-modal">
      <ng-template>
        <div class="modal-shell">
          <header class="modal-shell__head">
            <div class="modal-shell__title">{{ title() }}</div>
            <button type="button" class="modal-shell__close" (click)="dismissed.emit()" aria-label="Cerrar">×</button>
          </header>
          <div class="modal-shell__body">
            <ng-content select="[body]"></ng-content>
          </div>
          <footer class="modal-shell__foot">
            <ng-content select="[footer]"></ng-content>
          </footer>
        </div>
      </ng-template>
    </ion-modal>
  `,
  styles: [`
    :host ::ng-deep ion-modal.nb-modal {
      --width: 540px;
      --max-width: 95vw;
      --height: auto;
      --max-height: 90vh;
      --border-radius: 0;
      --box-shadow: none;
      --background: transparent;
      --backdrop-opacity: 0.6;
    }
    :host ::ng-deep ion-modal.nb-modal::part(content) {
      border: var(--ui-border-w-lg) solid var(--ui-border);
      box-shadow: var(--ui-shadow-lg);
      background: var(--ui-surface);
    }
    @media (max-width: 600px) {
      :host ::ng-deep ion-modal.nb-modal {
        --width: 100%;
        --max-width: 100%;
        --height: 100%;
        --max-height: 100%;
      }
    }

    .modal-shell {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--ui-surface);
    }
    .modal-shell__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--ui-sp-4);
      background: var(--ui-primary);
      color: var(--ui-primary-contrast);
      border-bottom: var(--ui-border-w-md) solid var(--ui-border);
    }
    .modal-shell__title {
      font-family: var(--ui-font-display);
      font-weight: var(--ui-fw-black);
      font-size: var(--ui-fs-lg);
    }
    .modal-shell__close {
      background: var(--ui-surface);
      color: var(--ui-text);
      border: var(--ui-border-w-md) solid var(--ui-border);
      width: 36px;
      height: 36px;
      font-size: 24px;
      line-height: 1;
      cursor: pointer;
      font-weight: var(--ui-fw-black);
    }
    .modal-shell__close:hover { background: var(--ui-surface-3); }
    .modal-shell__body {
      flex: 1;
      overflow-y: auto;
      padding: var(--ui-sp-4);
    }
    .modal-shell__foot {
      display: flex;
      gap: var(--ui-sp-2);
      justify-content: flex-end;
      padding: var(--ui-sp-3) var(--ui-sp-4);
      background: var(--ui-surface-2);
      border-top: var(--ui-border-w-md) solid var(--ui-border);
    }
  `],
})
export class FormModalComponent {
  readonly isOpen = input.required<boolean>();
  readonly title = input.required<string>();
  readonly dismissed = output<void>();
}
