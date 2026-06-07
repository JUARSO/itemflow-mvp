import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonContent, IonButton, IonIcon, NavController } from '@ionic/angular/standalone';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule, RouterLink,
    IonContent, IonButton, IonIcon,
  ],
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly navCtrl = inject(NavController);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  /** Mostrar/ocultar el texto de la contraseña. */
  readonly showPwd = signal(false);

  readonly form = this.fb.group({
    email: this.fb.control('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: this.fb.control('', { nonNullable: true, validators: [Validators.required, Validators.minLength(6)] }),
  });

  /** ¿Mostrar el estado de error de un campo? (inválido y ya tocado/escrito). */
  invalid(name: string): boolean {
    const c = this.form.get(name);
    return !!c && c.invalid && (c.touched || c.dirty);
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
      const { email, password } = this.form.getRawValue();
      await this.auth.login(email, password);
      // navigateRoot resetea la pila de Ionic al entrar a la app tras el login.
      await this.navCtrl.navigateRoot(this.auth.defaultRoute(), { animationDirection: 'forward' });
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo ingresar.');
    } finally {
      this.loading.set(false);
    }
  }
}
