import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonContent, IonButton, NavController } from '@ionic/angular/standalone';
import { AuthService } from '../../core/services/auth.service';
import { TenantService } from '../../core/services/tenant.service';
import { PlanId } from '../../core/models';

@Component({
  selector: 'app-register',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, ReactiveFormsModule, RouterLink, IonContent, IonButton],
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
})
export class RegisterPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly tenants = inject(TenantService);
  private readonly navCtrl = inject(NavController);

  readonly plans = this.tenants.plans;
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.group({
    orgName: this.fb.control('', { nonNullable: true, validators: [Validators.required, Validators.minLength(2)] }),
    adminName: this.fb.control('', { nonNullable: true, validators: [Validators.required] }),
    adminEmail: this.fb.control('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: this.fb.control('', { nonNullable: true, validators: [Validators.required, Validators.minLength(6)] }),
    planId: this.fb.control<PlanId>('pro', { nonNullable: true, validators: [Validators.required] }),
  });

  async onSubmit() {
    if (this.form.invalid) {
      this.error.set('Revisa los campos: nombre, correo válido y contraseña de al menos 6 caracteres.');
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
