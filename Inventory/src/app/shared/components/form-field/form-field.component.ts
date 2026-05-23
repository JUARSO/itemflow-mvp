import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Wrapper estilizado para inputs nativos dentro de modales.
 * Uso: <app-form-field label="Nombre"><input type="text" formControlName="name" /></app-form-field>
 */
@Component({
  selector: 'app-form-field',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="ff">
      <span class="ff__label">
        {{ label() }}
        @if (required()) { <span class="ff__req">*</span> }
      </span>
      <ng-content></ng-content>
      @if (hint()) { <span class="ff__hint">{{ hint() }}</span> }
      @if (error()) { <span class="ff__error">{{ error() }}</span> }
    </label>
  `,
  styles: [`
    .ff {
      display: block;
      margin-bottom: var(--ui-sp-3);
    }
    .ff__label {
      display: block;
      font-size: var(--ui-fs-sm);
      font-weight: var(--ui-fw-bold);
      color: var(--ui-text);
      margin-bottom: 6px;
    }
    .ff__req { color: var(--ui-danger); }
    .ff__hint {
      display: block;
      font-size: var(--ui-fs-xs);
      color: var(--ui-text-muted);
      margin-top: 4px;
    }
    .ff__error {
      display: block;
      font-size: var(--ui-fs-xs);
      color: var(--ui-danger);
      font-weight: var(--ui-fw-bold);
      margin-top: 4px;
    }

    :host ::ng-deep input[type="text"],
    :host ::ng-deep input[type="email"],
    :host ::ng-deep input[type="number"],
    :host ::ng-deep input[type="password"],
    :host ::ng-deep textarea,
    :host ::ng-deep select {
      width: 100%;
      box-sizing: border-box;
      padding: 10px 12px;
      font-family: var(--ui-font-sans);
      font-size: var(--ui-fs-md);
      color: var(--ui-text);
      background: var(--ui-surface);
      border: var(--ui-border-w-md) solid var(--ui-border);
      border-radius: 0;
      outline: none;
      min-height: 44px;
    }
    :host ::ng-deep input.mono,
    :host ::ng-deep input[type="number"] {
      font-family: var(--ui-font-mono);
    }
    :host ::ng-deep input:focus,
    :host ::ng-deep textarea:focus,
    :host ::ng-deep select:focus {
      box-shadow: var(--ui-shadow-sm);
    }
    :host ::ng-deep input.ng-invalid.ng-touched,
    :host ::ng-deep select.ng-invalid.ng-touched,
    :host ::ng-deep textarea.ng-invalid.ng-touched {
      border-color: var(--ui-danger);
    }
    :host ::ng-deep textarea { min-height: 80px; resize: vertical; }
  `],
})
export class FormFieldComponent {
  readonly label = input.required<string>();
  readonly required = input<boolean>(false);
  readonly hint = input<string | undefined>(undefined);
  readonly error = input<string | undefined>(undefined);
}
