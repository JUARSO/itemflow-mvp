import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, IonButton, IonIcon } from '@ionic/angular/standalone';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    IonContent, IonButton, IonIcon,
  ],
  template: `
    <ion-content [fullscreen]="true">
      <div class="page">
        <div class="card">
          <div class="brand">
            <ion-icon name="cube-outline" class="brand__logo"></ion-icon>
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

            @if (error()) {
              <div class="error">{{ error() }}</div>
            }

            <ion-button expand="block" type="submit" [disabled]="loading()">
              {{ loading() ? 'Ingresando…' : 'Ingresar' }}
            </ion-button>
          </form>

          <div class="demo">
            <div class="demo__title">Usuarios demo</div>
            <button type="button" class="demo__row" (click)="fillDemo('admin@panyco.cl')">
              <span class="demo__role demo__role--admin">ADMIN</span>
              <span class="demo__email mono">admin&#64;panyco.cl</span>
            </button>
            <button type="button" class="demo__row" (click)="fillDemo('ventas@panyco.cl')">
              <span class="demo__role demo__role--sales">VENTAS</span>
              <span class="demo__email mono">ventas&#64;panyco.cl</span>
            </button>
            <button type="button" class="demo__row" (click)="fillDemo('produccion@panyco.cl')">
              <span class="demo__role demo__role--prod">PRODUCCIÓN</span>
              <span class="demo__email mono">produccion&#64;panyco.cl</span>
            </button>
            <button type="button" class="demo__row" (click)="fillDemo('operario@panyco.cl')">
              <span class="demo__role demo__role--ope">OPERARIO</span>
              <span class="demo__email mono">operario&#64;panyco.cl</span>
            </button>
            <p class="demo__hint">Contraseña: cualquiera ≥ 4 caracteres. Tap en un usuario para autocompletar.</p>
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
    .brand__logo {
      font-size: 56px;
      line-height: 1;
      margin-bottom: var(--ui-sp-2);
      color: var(--ui-primary);
      display: inline-block;
    }
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
    }
    .demo__title {
      font-size: var(--ui-fs-xs);
      font-weight: var(--ui-fw-black);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--ui-text-muted);
      margin-bottom: var(--ui-sp-2);
    }
    .demo__row {
      display: flex;
      align-items: center;
      gap: var(--ui-sp-2);
      width: 100%;
      padding: 8px 10px;
      background: var(--ui-surface);
      border: var(--ui-border-w-sm) solid var(--ui-border);
      margin-bottom: 4px;
      cursor: pointer;
      text-align: left;
      font-family: var(--ui-font-sans);
    }
    .demo__row:hover { background: var(--ui-surface-3); }
    .demo__row:last-of-type { margin-bottom: 0; }
    .demo__role {
      padding: 2px 6px;
      font-size: 9px;
      font-weight: var(--ui-fw-black);
      letter-spacing: 0.5px;
      color: #fff;
      flex-shrink: 0;
      min-width: 78px;
      text-align: center;
    }
    .demo__role--admin { background: var(--ui-primary); }
    .demo__role--sales { background: var(--ui-success); }
    .demo__role--prod  { background: var(--ui-transit); }
    .demo__role--ope   { background: var(--ui-warning); color: #000; }
    .demo__email {
      font-family: var(--ui-font-mono);
      font-size: var(--ui-fs-xs);
      color: var(--ui-text);
    }
    .demo__hint {
      font-size: 10px;
      color: var(--ui-text-muted);
      margin: var(--ui-sp-2) 0 0;
    }
  `],
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.group({
    email: this.fb.control('admin@panyco.cl', { nonNullable: true, validators: [Validators.required, Validators.email] }),
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
      await this.router.navigateByUrl(this.auth.defaultRoute());
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo ingresar.');
    } finally {
      this.loading.set(false);
    }
  }
}
