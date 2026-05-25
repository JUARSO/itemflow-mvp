import { ChangeDetectionStrategy, Component, effect, inject, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonButton } from '@ionic/angular/standalone';
import { FormModalComponent } from '../../shared/components/form-modal/form-modal.component';
import { FormFieldComponent } from '../../shared/components/form-field/form-field.component';
import { Member, UserRole } from '../../core/models';
import { DataService } from '../../core/services/data.service';
import { ToastService } from '../../shared/components/toast/toast.service';

@Component({
  selector: 'app-miembro-form-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, IonButton, FormModalComponent, FormFieldComponent],
  template: `
    <app-form-modal
      [isOpen]="isOpen()"
      [title]="editing() ? 'Editar miembro' : 'Invitar miembro'"
      (dismissed)="closed.emit()">

      <form body [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
        <app-form-field label="Nombre completo" [required]="true">
          <input type="text" formControlName="displayName" />
        </app-form-field>

        <app-form-field label="Correo electrónico" [required]="true">
          <input
            type="email"
            formControlName="email"
            [readOnly]="!!editing()"
            class="mono" />
        </app-form-field>

        <app-form-field label="Rol" [required]="true" hint="Define qué pantallas y acciones puede usar el miembro">
          <select formControlName="role">
            <option value="admin">Administrador (acceso completo)</option>
            <option value="production">Encargado de Producción</option>
            <option value="operator">Operario (fabricación)</option>
          </select>
        </app-form-field>

        @if (!editing()) {
          <p class="hint-block">
            En el MVP la invitación crea el miembro directamente. En producción enviaría un email con un link de activación.
          </p>
        }
      </form>

      <div footer>
        <ion-button fill="clear" class="ghost" (click)="closed.emit()">Cancelar</ion-button>
        <ion-button (click)="onSubmit()" [disabled]="form.invalid">
          {{ editing() ? 'Guardar cambios' : 'Invitar' }}
        </ion-button>
      </div>
    </app-form-modal>
  `,
  styles: [`
    .hint-block {
      margin-top: var(--ui-sp-3);
      padding: var(--ui-sp-3);
      background: var(--ui-surface-2);
      border: var(--ui-border-w-sm) dashed var(--ui-border);
      font-size: var(--ui-fs-xs);
      color: var(--ui-text-muted);
    }
  `],
})
export class MiembroFormModalComponent {
  private readonly fb = inject(FormBuilder);
  private readonly data = inject(DataService);
  private readonly toast = inject(ToastService);

  readonly isOpen = input.required<boolean>();
  readonly editing = input<Member | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();

  readonly form = this.fb.group({
    displayName: this.fb.control('', { nonNullable: true, validators: [Validators.required] }),
    email: this.fb.control('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    role: this.fb.control<UserRole>('production', { nonNullable: true, validators: [Validators.required] }),
  });

  constructor() {
    effect(() => {
      const m = this.editing();
      if (m) {
        this.form.reset({ displayName: m.displayName, email: m.email, role: m.role });
      } else if (this.isOpen()) {
        this.form.reset({ displayName: '', email: '', role: 'production' });
      }
    });
  }

  private roleLabel(r: UserRole): string {
    if (r === 'admin') return 'Administrador';
    if (r === 'production') return 'Encargado de Producción';
    return 'Operario';
  }

  async onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      await this.toast.show('Revisa los campos requeridos.', 'danger');
      return;
    }
    const v = this.form.getRawValue();
    const editing = this.editing();
    if (editing) {
      this.data.updateMemberRole(editing.uid, v.role);
      await this.toast.show(`Rol de "${editing.displayName}" actualizado a ${this.roleLabel(v.role)}.`);
    } else {
      this.data.inviteMember({
        email: v.email.trim().toLowerCase(),
        displayName: v.displayName.trim(),
        role: v.role,
      });
      await this.toast.show(`${v.displayName} invitado como ${this.roleLabel(v.role)}.`);
    }
    this.saved.emit();
  }
}
