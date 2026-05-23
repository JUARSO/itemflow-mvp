import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent, IonButton, IonLabel,
  IonSegment, IonSegmentButton,
} from '@ionic/angular/standalone';
import { AuthService } from '../../core/services/auth.service';
import { UserRole } from '../../core/models';

@Component({
  selector: 'app-login',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    IonContent, IonButton, IonLabel,
    IonSegment, IonSegmentButton,
  ],
  template: `
    <ion-content [fullscreen]="true">
      <div class="page">
        <div class="card">
          <div class="brand">
            <div class="brand__logo">📦</div>
            <h1 class="brand__title">ItemFlow</h1>
            <p class="brand__tagline">Tu inventario te avisa qué pedir, antes de que te quedes sin nada.</p>
          </div>

          <form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
            <label class="field-label" for="email">Correo electrónico</label>
            <input
              id="email"
              type="email"
              formControlName="email"
              autocomplete="email"
              placeholder="tu@empresa.com"
              class="input"
            />

            <label class="field-label" for="password">Contraseña</label>
            <input
              id="password"
              type="password"
              formControlName="password"
              autocomplete="current-password"
              placeholder="••••••••"
              class="input"
            />

            <div class="role">
              <div class="field-label">Iniciar como (solo demo)</div>
              <ion-segment [value]="role()" (ionChange)="role.set($any($event.detail.value))">
                <ion-segment-button value="admin">
                  <ion-label>Admin</ion-label>
                </ion-segment-button>
                <ion-segment-button value="operator">
                  <ion-label>Operador</ion-label>
                </ion-segment-button>
              </ion-segment>
              <p class="role__hint muted">
                Admin: catálogo, recetas, reportes, costos. Operador: movimientos y alertas, sin acceso a costos.
              </p>
            </div>

            @if (error()) {
              <div class="error">{{ error() }}</div>
            }

            <ion-button expand="block" type="submit" [disabled]="loading()">
              {{ loading() ? 'Ingresando…' : 'Ingresar' }}
            </ion-button>
          </form>

          <div class="demo">
            <strong>Demo:</strong> cualquier email + contraseña entran. Probar:
            <code>admin&#64;panyco.cl</code> / <code>juan&#64;panyco.cl</code>
          </div>
        </div>
      </div>
    </ion-content>
  `,
  styles: [`
    :host {
      --bg-stripe: repeating-linear-gradient(
        45deg,
        var(--ui-surface) 0px,
        var(--ui-surface) 20px,
        var(--ui-surface-2) 20px,
        var(--ui-surface-2) 22px
      );
    }
    ion-content { --background: var(--ui-surface); }
    .page {
      min-height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--ui-sp-6) var(--ui-sp-4);
      background: var(--bg-stripe);
    }
    .card {
      width: 100%;
      max-width: 440px;
      background: var(--ui-surface);
      border: var(--ui-border-w-lg) solid var(--ui-border);
      box-shadow: var(--ui-shadow-lg);
      padding: var(--ui-sp-8) var(--ui-sp-6);
    }
    .brand { text-align: center; margin-bottom: var(--ui-sp-6); }
    .brand__logo { font-size: 56px; line-height: 1; margin-bottom: var(--ui-sp-2); }
    .brand__title {
      font-family: var(--ui-font-display);
      font-weight: var(--ui-fw-black);
      font-size: var(--ui-fs-2xl);
      margin: 0 0 var(--ui-sp-2);
      color: var(--ui-text);
    }
    .brand__tagline {
      font-size: var(--ui-fs-sm);
      color: var(--ui-text-muted);
      margin: 0;
    }
    .field-label {
      display: block;
      font-size: var(--ui-fs-sm);
      font-weight: var(--ui-fw-bold);
      color: var(--ui-text);
      margin: var(--ui-sp-3) 0 var(--ui-sp-1);
    }
    .input {
      width: 100%;
      box-sizing: border-box;
      padding: 12px;
      font-family: var(--ui-font-sans);
      font-size: var(--ui-fs-md);
      color: var(--ui-text);
      background: var(--ui-surface);
      border: var(--ui-border-w-md) solid var(--ui-border);
      border-radius: 0;
      outline: none;
    }
    .input:focus {
      box-shadow: var(--ui-shadow-sm);
    }
    .role { margin: var(--ui-sp-4) 0 var(--ui-sp-3); }
    .role__hint {
      font-size: var(--ui-fs-xs);
      margin: var(--ui-sp-2) 0 0;
      color: var(--ui-text-muted);
    }
    .error {
      margin: var(--ui-sp-3) 0;
      padding: var(--ui-sp-3);
      background: var(--ui-danger-tint);
      color: var(--ui-danger);
      border: var(--ui-border-w-md) solid var(--ui-danger);
      font-weight: var(--ui-fw-bold);
      font-size: var(--ui-fs-sm);
    }
    ion-button { margin-top: var(--ui-sp-4); }
    .demo {
      margin-top: var(--ui-sp-6);
      padding: var(--ui-sp-3);
      background: var(--ui-surface-2);
      border: var(--ui-border-w-md) dashed var(--ui-border);
      font-size: var(--ui-fs-xs);
      color: var(--ui-text-muted);
    }
    .demo code {
      font-family: var(--ui-font-mono);
      font-size: var(--ui-fs-xs);
      background: var(--ui-surface);
      padding: 2px 4px;
      border: var(--ui-border-w-sm) solid var(--ui-border);
    }
    .muted { color: var(--ui-text-muted); }
  `],
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly role = signal<UserRole>('admin');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.group({
    email: this.fb.control('admin@panyco.cl', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: this.fb.control('demo1234', { nonNullable: true, validators: [Validators.required, Validators.minLength(4)] }),
  });

  async onSubmit() {
    if (this.form.invalid) {
      this.error.set('Revisa los datos: email válido y contraseña de al menos 4 caracteres.');
      return;
    }
    this.error.set(null);
    this.loading.set(true);
    try {
      const { email, password } = this.form.getRawValue();
      await this.auth.login(email, password, this.role());
      await this.router.navigateByUrl('/inventario');
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo ingresar.');
    } finally {
      this.loading.set(false);
    }
  }
}
