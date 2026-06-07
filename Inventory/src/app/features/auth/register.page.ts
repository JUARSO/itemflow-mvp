import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonContent, IonButton, IonIcon, NavController } from '@ionic/angular/standalone';
import { AuthService } from '../../core/services/auth.service';
import { PlanId } from '../../core/models';

/** Valida que `password` y `confirmPassword` coincidan (a nivel de grupo). */
function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const pass = group.get('password')?.value;
  const confirm = group.get('confirmPassword')?.value;
  if (!confirm) return null; // que el 'required' del campo gobierne el vacío
  return pass === confirm ? null : { mismatch: true };
}

@Component({
  selector: 'app-register',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, IonContent, IonButton, IonIcon],
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
})
export class RegisterPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly navCtrl = inject(NavController);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  /** Mostrar/ocultar el texto de cada contraseña. */
  readonly showPwd = signal(false);
  readonly showConfirm = signal(false);

  readonly form = this.fb.group({
    orgName: this.fb.control('', { nonNullable: true, validators: [Validators.required, Validators.minLength(2)] }),
    adminName: this.fb.control('', { nonNullable: true, validators: [Validators.required] }),
    adminEmail: this.fb.control('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: this.fb.control('', { nonNullable: true, validators: [Validators.required, Validators.minLength(6)] }),
    confirmPassword: this.fb.control('', { nonNullable: true, validators: [Validators.required] }),
    // Plan por defecto (sin selección en UI): el modelo de suscripción/trial lo sigue usando.
    planId: this.fb.control<PlanId>('pro', { nonNullable: true }),
  }, { validators: passwordsMatch });

  /** ¿Mostrar el estado de error de un campo? (inválido y ya tocado/escrito). */
  invalid(name: string): boolean {
    const c = this.form.get(name);
    return !!c && c.invalid && (c.touched || c.dirty);
  }

  /** ¿Las contraseñas no coinciden y el usuario ya tocó el campo de repetición? */
  mismatch(): boolean {
    const confirm = this.form.controls.confirmPassword;
    return this.form.hasError('mismatch') && (confirm.touched || confirm.dirty);
  }

  async onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched(); // revela los errores visuales por campo
      this.error.set('Revisa los campos marcados antes de continuar.');
      return;
    }
    this.error.set(null);
    this.loading.set(true);
    try {
      const v = this.form.getRawValue();
      await this.auth.register(v);
      await this.navCtrl.navigateRoot(this.auth.defaultRoute(), { animationDirection: 'forward' });
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo crear la empresa.');
    } finally {
      this.loading.set(false);
    }
  }
}
