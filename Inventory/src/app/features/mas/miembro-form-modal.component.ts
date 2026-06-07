import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonButton } from '@ionic/angular/standalone';
import { FormModalComponent } from '../../shared/components/form-modal/form-modal.component';
import { FormFieldComponent } from '../../shared/components/form-field/form-field.component';
import { Member, UserRole } from '../../core/models';
import { MembersService } from '../../core/services/members.service';
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
  private readonly members = inject(MembersService);
  private readonly toast = inject(ToastService);

  readonly isOpen = input.required<boolean>();
  readonly editing = input<Member | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();

  readonly saving = signal(false);

  readonly form = this.fb.group({
    displayName: this.fb.control('', { nonNullable: true, validators: [Validators.required] }),
    email: this.fb.control('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    role: this.fb.control<UserRole>('ventas', { nonNullable: true, validators: [Validators.required] }),
    password: this.fb.control('', { nonNullable: true, validators: [Validators.required, Validators.minLength(6)] }),
  });

  constructor() {
    effect(() => {
      const m = this.editing();
      if (m) {
        // Al editar solo cambia el rol: el correo/contraseña no aplican.
        this.form.reset({ displayName: m.displayName, email: m.email, role: m.role, password: '' });
        this.form.controls.password.disable();
      } else if (this.isOpen()) {
        this.form.reset({ displayName: '', email: '', role: 'ventas', password: '' });
        this.form.controls.password.enable();
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
    this.saving.set(true);
    try {
      if (editing) {
        await this.members.update(editing.uid, { role: v.role, displayName: v.displayName.trim() });
        await this.toast.show(`Miembro "${v.displayName.trim()}" actualizado (${this.roleLabel(v.role)}).`);
      } else {
        await this.members.invite({
          email: v.email.trim().toLowerCase(),
          displayName: v.displayName.trim(),
          role: v.role,
          password: v.password,
        });
        await this.toast.show(`${v.displayName} creado como ${this.roleLabel(v.role)}.`);
      }
      this.saved.emit();
    } catch (e: unknown) {
      await this.toast.show(e instanceof Error ? e.message : 'No se pudo guardar el miembro.', 'danger');
    } finally {
      this.saving.set(false);
    }
  }
}
