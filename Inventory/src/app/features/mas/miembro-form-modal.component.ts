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
  templateUrl: './miembro-form-modal.component.html',
  styleUrls: ['./miembro-form-modal.component.scss'],
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
    role: this.fb.control<UserRole>('ventas', { nonNullable: true, validators: [Validators.required] }),
  });

  constructor() {
    effect(() => {
      const m = this.editing();
      if (m) {
        this.form.reset({ displayName: m.displayName, email: m.email, role: m.role });
      } else if (this.isOpen()) {
        this.form.reset({ displayName: '', email: '', role: 'ventas' });
      }
    });
  }

  private roleLabel(r: UserRole): string {
    if (r === 'admin') return 'Administrativo';
    if (r === 'produccion') return 'Producción';
    return 'Ventas';
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
