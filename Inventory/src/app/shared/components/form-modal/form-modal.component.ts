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
  templateUrl: './form-modal.component.html',
  styleUrls: ['./form-modal.component.scss'],
})
export class FormModalComponent {
  readonly isOpen = input.required<boolean>();
  readonly title = input.required<string>();
  /** 'wide' ensancha el modal (formularios largos como la ficha técnica). */
  readonly size = input<'default' | 'wide'>('default');
  readonly dismissed = output<void>();
}
