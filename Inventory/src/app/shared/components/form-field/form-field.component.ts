import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Wrapper estilizado para inputs nativos dentro de modales.
 * Uso: <app-form-field label="Nombre"><input type="text" formControlName="name" /></app-form-field>
 */
@Component({
  selector: 'app-form-field',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './form-field.component.html',
  styleUrls: ['./form-field.component.scss'],
})
export class FormFieldComponent {
  readonly label = input.required<string>();
  readonly required = input<boolean>(false);
  readonly hint = input<string | undefined>(undefined);
  readonly error = input<string | undefined>(undefined);
}
