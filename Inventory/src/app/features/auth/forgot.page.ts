import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonContent, IonButton } from '@ionic/angular/standalone';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-forgot',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, IonContent, IonButton],
  templateUrl: './forgot.page.html',
  styleUrls: ['./forgot.page.scss'],
})
export class ForgotPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  /** true cuando ya se intentó el envío del correo de restablecimiento. */
  readonly sent = signal(false);

  readonly form = this.fb.group({
    email: this.fb.control('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
  });

  /** ¿Mostrar el estado de error de un campo? (inválido y ya tocado/escrito). */
  invalid(name: string): boolean {
    const c = this.form.get(name);
    return !!c && c.invalid && (c.touched || c.dirty);
  }

  async onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Escribe un correo válido para continuar.');
      return;
    }
    this.error.set(null);
    this.loading.set(true);
    try {
      await this.auth.resetPassword(this.form.controls.email.value);
      this.sent.set(true);
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo enviar el correo.');
    } finally {
      this.loading.set(false);
    }
  }
}
