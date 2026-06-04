import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonContent, IonButton, NavController } from '@ionic/angular/standalone';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule, RouterLink,
    IonContent, IonButton,
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

  readonly form = this.fb.group({
    email: this.fb.control('admin@demo.cr', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: this.fb.control('demo1234', { nonNullable: true, validators: [Validators.required, Validators.minLength(4)] }),
  });

  fillDemo(email: string) {
    this.form.patchValue({ email, password: 'demo1234' });
  }

  async onSubmit() {
    if (this.form.invalid) {
      this.error.set('Revisa los datos: email válido y contraseña de al menos 4 caracteres.');
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
