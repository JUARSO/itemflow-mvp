import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
  IonButton, IonBadge,
} from '@ionic/angular/standalone';
import { AuthService } from '../../core/services/auth.service';
import { TenantContextService } from '../../core/services/tenant-context.service';
import { DataService } from '../../core/services/data.service';
import { ThemeService } from '../../core/services/theme.service';
import { BrandingService } from '../../core/services/branding.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { ToastService } from '../../shared/components/toast/toast.service';
import { MiembroFormModalComponent } from './miembro-form-modal.component';
import { Member } from '../../core/models';

@Component({
  selector: 'app-mas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
    IonButton, IonBadge,
    PageHeaderComponent, ConfirmDialogComponent, MiembroFormModalComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-menu-button></ion-menu-button></ion-buttons>
        <ion-title>Más</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <app-page-header
        title="Más"
        subtitle="Cuenta, miembros, configuración y demo">
      </app-page-header>

      <section class="card">
        <h3>Perfil</h3>
        <div class="kv">
          <span class="muted">Nombre</span>
          <strong>{{ auth.user()?.displayName }}</strong>
        </div>
        <div class="kv">
          <span class="muted">Email</span>
          <span class="mono">{{ auth.user()?.email }}</span>
        </div>
        <div class="kv">
          <span class="muted">Rol</span>
          <ion-badge [color]="auth.isAdmin() ? 'primary' : 'medium'">
            {{ auth.isAdmin() ? 'Administrador' : 'Operador' }}
          </ion-badge>
        </div>
      </section>

      <section class="card">
        <div class="card__head">
          <h3>Marca</h3>
          @if (brandingDirty()) {
            <span class="dirty-pill">Sin guardar</span>
          }
        </div>
        <p class="muted brand-hint">
          Personaliza el nombre y el logo que aparecen en el menú lateral y la pestaña del navegador.
        </p>

        <div class="brand-preview">
          <div class="brand-preview__logo">
            @if (branding.branding().logoImage) {
              <img [src]="branding.branding().logoImage" alt="Logo" />
            } @else {
              <span>{{ logoDraft() || '—' }}</span>
            }
          </div>
          <div class="brand-preview__text">
            <div class="brand-preview__name">{{ nameDraft() || 'ItemFlow' }}</div>
            <div class="brand-preview__company">{{ tenant.company().name }}</div>
          </div>
        </div>

        <div class="form-row">
          <label class="field">
            <span class="field__label">Nombre visible</span>
            <input
              type="text"
              [(ngModel)]="nameDraftRaw"
              (ngModelChange)="onBrandingChange()"
              maxlength="32"
              placeholder="ItemFlow" />
          </label>
          <label class="field field--narrow">
            <span class="field__label">Logo (emoji o texto)</span>
            <input
              type="text"
              [(ngModel)]="logoDraftRaw"
              (ngModelChange)="onBrandingChange()"
              maxlength="3"
              placeholder="📦"
              [disabled]="!!branding.branding().logoImage" />
          </label>
        </div>

        <div class="upload-row">
          <div class="upload-row__info">
            <div class="field__label">Imagen de logo</div>
            <div class="upload-row__hint">
              @if (branding.branding().logoImage) {
                Imagen cargada. Reemplaza el texto/emoji. Quítala para volver al texto.
              } @else {
                PNG/JPG hasta 2 MB. Se redimensiona automáticamente a 192px.
              }
            </div>
          </div>
          <div class="upload-row__actions">
            <label class="file-btn">
              <input
                type="file"
                accept="image/*"
                (change)="onLogoFile($event)"
                hidden />
              <span>{{ branding.branding().logoImage ? '📷 Reemplazar imagen' : '📷 Subir imagen…' }}</span>
            </label>
            @if (branding.branding().logoImage) {
              <ion-button fill="clear" class="ghost" size="small" (click)="clearLogo()">
                Quitar imagen
              </ion-button>
            }
          </div>
        </div>

        <div class="actions">
          <ion-button (click)="saveBranding()" [disabled]="!brandingDirty()">
            Guardar marca
          </ion-button>
          <ion-button fill="clear" class="ghost" (click)="resetBranding()">
            Restaurar default
          </ion-button>
        </div>
      </section>

      <section class="card">
        <h3>Apariencia</h3>
        <p class="muted brand-hint">
          Tema visual del color principal de marca. Los colores semánticos (éxito, alerta, error) se mantienen estables.
        </p>

        <div class="theme-selector">
          <div class="theme-selector__current">
            <span class="theme-selector__swatch" [style.background]="theme.current().primary"></span>
            <div class="theme-selector__meta">
              <div class="theme-selector__name">{{ theme.current().name }}</div>
              <div class="theme-selector__desc">{{ theme.current().description }}</div>
            </div>
          </div>
          <label class="field">
            <span class="field__label">Cambiar tema</span>
            <select
              [value]="theme.currentId()"
              (change)="selectTheme($any($event.target).value)">
              @for (t of theme.availableThemes; track t.id) {
                <option [value]="t.id">{{ t.name }} — {{ t.description }}</option>
              }
            </select>
          </label>
        </div>
      </section>

      <section class="card">
        <h3>Empresa</h3>
        <div class="kv">
          <span class="muted">Tenant</span>
          <strong>{{ tenant.company().name }}</strong>
        </div>
        <div class="kv">
          <span class="muted">ID</span>
          <span class="mono">{{ tenant.tenantId() }}</span>
        </div>
        <div class="kv">
          <span class="muted">Moneda</span>
          <span class="mono">{{ tenant.company().currency }}</span>
        </div>
        <div class="kv">
          <span class="muted">Zona horaria</span>
          <span class="mono">{{ tenant.company().timezone }}</span>
        </div>
      </section>

      <section class="card">
        <div class="card__head">
          <h3>Miembros del equipo</h3>
          @if (tenant.isAdmin()) {
            <ion-button size="small" (click)="abrirInvitar()">+ Invitar</ion-button>
          }
        </div>
        <div class="members">
          @for (m of data.members(); track m.uid) {
            <div class="member">
              <div class="member__avatar">{{ initials(m.displayName) }}</div>
              <div class="member__info">
                <div class="member__name">{{ m.displayName }}</div>
                <div class="member__email mono">{{ m.email }}</div>
              </div>
              <div class="member__right">
                <ion-badge [color]="m.role === 'admin' ? 'primary' : 'medium'">
                  {{ m.role === 'admin' ? 'Admin' : 'Operador' }}
                </ion-badge>
                @if (tenant.isAdmin() && m.uid !== auth.user()?.uid) {
                  <div class="member__actions">
                    <button class="link-btn" (click)="abrirEditar(m)">Editar</button>
                    <button class="link-btn link-btn--danger" (click)="pedirEliminar(m)">Eliminar</button>
                  </div>
                }
              </div>
            </div>
          }
        </div>
      </section>

      <section class="card demo-card">
        <h3>Demo</h3>
        <p class="muted">
          Este MVP usa datos en memoria. Cambia entre admin y operador para ver permisos diferentes
          (operador no ve costos ni puede gestionar catálogo/recetas).
        </p>
        <div class="actions">
          <ion-button (click)="switchTo('admin')" [disabled]="auth.isAdmin()">
            Cambiar a Admin
          </ion-button>
          <ion-button (click)="switchTo('operator')" [disabled]="auth.isOperator()" fill="clear" class="ghost">
            Cambiar a Operador
          </ion-button>
        </div>
      </section>

      <section class="card">
        <h3>Acceso</h3>
        <ion-button (click)="logout()" color="danger" expand="block">
          Cerrar sesión
        </ion-button>
      </section>

      <app-miembro-form-modal
        [isOpen]="modalOpen()"
        [editing]="miembroEdit()"
        (closed)="cerrarModal()"
        (saved)="cerrarModal()">
      </app-miembro-form-modal>

      <app-confirm-dialog
        [isOpen]="confirmOpen()"
        title="Eliminar miembro"
        [message]="confirmMessage()"
        tone="danger"
        confirmLabel="Sí, eliminar"
        (confirmed)="eliminar()"
        (cancelled)="confirmOpen.set(false)">
      </app-confirm-dialog>
    </ion-content>
  `,
  styles: [`
    ion-content { --padding-bottom: var(--ui-sp-8); }
    .card {
      margin: 0 var(--ui-sp-4) var(--ui-sp-3);
      padding: var(--ui-sp-4);
      background: var(--ui-surface-2);
      border: var(--ui-border-w-md) solid var(--ui-border);
      box-shadow: var(--ui-shadow-md);
    }
    .card h3 {
      font-family: var(--ui-font-display);
      font-weight: var(--ui-fw-black);
      font-size: var(--ui-fs-lg);
      margin: 0 0 var(--ui-sp-3);
    }
    .card__head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: var(--ui-sp-3);
    }
    .card__head h3 { margin: 0; }
    .kv {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--ui-sp-2) 0;
      border-bottom: 1px dashed var(--ui-border);
      font-size: var(--ui-fs-sm);
      gap: var(--ui-sp-3);
    }
    .kv:last-child { border-bottom: none; }
    .muted { color: var(--ui-text-muted); }

    .members { display: grid; gap: var(--ui-sp-2); }
    .member {
      display: grid;
      grid-template-columns: 48px 1fr auto;
      gap: var(--ui-sp-3);
      align-items: center;
      padding: var(--ui-sp-2);
      background: var(--ui-surface);
      border: var(--ui-border-w-sm) solid var(--ui-border);
    }
    .member__avatar {
      width: 40px; height: 40px;
      display: flex; align-items: center; justify-content: center;
      background: var(--ui-primary);
      color: var(--ui-primary-contrast);
      border: var(--ui-border-w-sm) solid var(--ui-border);
      font-weight: var(--ui-fw-black);
      font-size: var(--ui-fs-sm);
    }
    .member__name { font-weight: var(--ui-fw-bold); font-size: var(--ui-fs-md); }
    .member__email { font-size: var(--ui-fs-xs); color: var(--ui-text-muted); }
    .member__right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
    .member__actions { display: flex; gap: var(--ui-sp-2); }
    .link-btn {
      background: none;
      border: none;
      color: var(--ui-primary);
      font-size: var(--ui-fs-xs);
      font-weight: var(--ui-fw-bold);
      cursor: pointer;
      padding: 2px 4px;
      text-decoration: underline;
    }
    .link-btn--danger { color: var(--ui-danger); }

    .actions { display: flex; gap: var(--ui-sp-2); flex-wrap: wrap; }
    .demo-card { background: var(--ui-warning-tint); border-color: var(--ui-border); }

    .brand-hint { font-size: var(--ui-fs-sm); margin: 0 0 var(--ui-sp-3); }
    .dirty-pill {
      font-size: var(--ui-fs-xs);
      font-weight: var(--ui-fw-medium);
      padding: 3px 10px;
      background: var(--ui-warning-tint);
      color: var(--ui-warning);
      border-radius: var(--ui-radius-pill);
    }
    .brand-preview {
      display: flex;
      align-items: center;
      gap: var(--ui-sp-3);
      padding: var(--ui-sp-3);
      background: var(--ui-primary);
      color: var(--ui-primary-contrast);
      border-radius: var(--ui-radius);
      margin-bottom: var(--ui-sp-3);
    }
    .brand-preview__logo {
      width: 48px; height: 48px;
      display: flex; align-items: center; justify-content: center;
      background: var(--ui-surface);
      color: var(--ui-text-strong);
      font-size: 28px;
      border-radius: var(--ui-radius);
      border: var(--ui-border-w-sm) solid var(--ui-border);
      overflow: hidden;
      flex-shrink: 0;
    }
    .brand-preview__logo img {
      width: 100%; height: 100%; object-fit: contain;
    }
    .brand-preview__name {
      font-family: var(--ui-font-display);
      font-weight: var(--ui-fw-bold);
      font-size: var(--ui-fs-lg);
      line-height: 1.1;
    }
    .brand-preview__company {
      font-size: var(--ui-fs-xs);
      opacity: 0.9;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 160px;
      gap: var(--ui-sp-3);
      margin-bottom: var(--ui-sp-3);
    }
    @media (max-width: 600px) { .form-row { grid-template-columns: 1fr; } }
    .field { display: flex; flex-direction: column; gap: 4px; }
    .field__label {
      font-size: var(--ui-fs-xs);
      font-weight: var(--ui-fw-medium);
      color: var(--ui-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .field input {
      padding: 10px 12px;
      border: var(--ui-border-w-sm) solid var(--ui-border-strong);
      border-radius: var(--ui-radius);
      background: var(--ui-surface);
      font-family: var(--ui-font-sans);
      font-size: var(--ui-fs-md);
      color: var(--ui-text);
      min-height: 44px;
    }
    .field input:focus {
      outline: none;
      border-color: var(--ui-primary);
      box-shadow: 0 0 0 3px rgba(63, 120, 114, 0.18);
    }

    .theme-selector {
      display: flex;
      flex-direction: column;
      gap: var(--ui-sp-3);
    }
    .theme-selector__current {
      display: flex;
      gap: var(--ui-sp-3);
      align-items: center;
      padding: var(--ui-sp-3);
      background: var(--ui-surface);
      border: var(--ui-border-w-sm) solid var(--ui-border);
      border-radius: var(--ui-radius);
    }
    .theme-selector__swatch {
      width: 42px; height: 42px;
      border-radius: var(--ui-radius);
      flex-shrink: 0;
      border: var(--ui-border-w-sm) solid var(--ui-border);
    }
    .theme-selector__meta { flex: 1; min-width: 0; }
    .theme-selector__name {
      font-weight: var(--ui-fw-semibold);
      font-size: var(--ui-fs-md);
      color: var(--ui-text-strong);
    }
    .theme-selector__desc {
      font-size: var(--ui-fs-xs);
      color: var(--ui-text-muted);
    }
    .field select {
      padding: 10px 12px;
      border: var(--ui-border-w-sm) solid var(--ui-border-strong);
      border-radius: var(--ui-radius);
      background: var(--ui-surface);
      font-family: var(--ui-font-sans);
      font-size: var(--ui-fs-md);
      color: var(--ui-text);
      min-height: 44px;
      cursor: pointer;
    }
    .field select:focus {
      outline: none;
      border-color: var(--ui-primary);
      box-shadow: 0 0 0 3px rgba(63, 120, 114, 0.18);
    }

    .upload-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--ui-sp-3);
      padding: var(--ui-sp-3);
      background: var(--ui-surface);
      border: var(--ui-border-w-sm) solid var(--ui-border);
      border-radius: var(--ui-radius);
      margin-bottom: var(--ui-sp-3);
      flex-wrap: wrap;
    }
    .upload-row__info { flex: 1; min-width: 200px; }
    .upload-row__hint {
      font-size: var(--ui-fs-xs);
      color: var(--ui-text-muted);
      margin-top: 2px;
    }
    .upload-row__actions {
      display: flex;
      gap: var(--ui-sp-2);
      align-items: center;
      flex-wrap: wrap;
    }
    .file-btn {
      display: inline-flex;
      align-items: center;
      gap: var(--ui-sp-2);
      padding: 10px 14px;
      background: var(--ui-primary);
      color: var(--ui-primary-contrast);
      border: var(--ui-border-w-sm) solid var(--ui-border-strong);
      border-radius: var(--ui-radius);
      box-shadow: var(--ui-shadow-sm);
      font-weight: var(--ui-fw-medium);
      cursor: pointer;
      font-size: var(--ui-fs-sm);
      min-height: 40px;
    }
    .file-btn:hover { box-shadow: var(--ui-shadow-md); }
  `],
})
export class MasPage {
  protected readonly auth = inject(AuthService);
  protected readonly tenant = inject(TenantContextService);
  protected readonly data = inject(DataService);
  protected readonly theme = inject(ThemeService);
  protected readonly branding = inject(BrandingService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly modalOpen = signal(false);
  readonly miembroEdit = signal<Member | null>(null);
  readonly confirmOpen = signal(false);
  readonly miembroAEliminar = signal<Member | null>(null);

  // Borradores de branding antes de guardar.
  readonly nameDraft = signal<string>('');
  readonly logoDraft = signal<string>('');

  /** Bindings ngModel directos a inputs (no signals) — sincronizan vía onBrandingChange. */
  nameDraftRaw = '';
  logoDraftRaw = '';

  readonly brandingDirty = computed(() =>
    this.nameDraft() !== this.branding.branding().displayName ||
    this.logoDraft() !== this.branding.branding().logo
  );

  constructor() {
    effect(() => {
      const b = this.branding.branding();
      this.nameDraft.set(b.displayName);
      this.logoDraft.set(b.logo);
      this.nameDraftRaw = b.displayName;
      this.logoDraftRaw = b.logo;
    });
  }

  onBrandingChange() {
    this.nameDraft.set(this.nameDraftRaw);
    this.logoDraft.set(this.logoDraftRaw);
  }

  async saveBranding() {
    this.branding.update({
      displayName: this.nameDraft(),
      logo: this.logoDraft(),
    });
    await this.toast.show('Marca actualizada.', 'success');
  }

  async resetBranding() {
    this.branding.reset();
    await this.toast.show('Marca restaurada al default.');
  }

  selectTheme(id: string) {
    this.theme.setTheme(id);
  }

  async onLogoFile(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      await this.branding.uploadLogoImage(file);
      await this.toast.show('Imagen de logo cargada.', 'success');
    } catch (e: unknown) {
      await this.toast.show(e instanceof Error ? e.message : 'No se pudo cargar la imagen.', 'danger');
    }
  }

  async clearLogo() {
    this.branding.clearLogoImage();
    await this.toast.show('Imagen quitada. Se usa el texto/emoji.');
  }

  readonly confirmMessage = computed(() => {
    const m = this.miembroAEliminar();
    if (!m) return '';
    return `Vas a eliminar el acceso de "${m.displayName}" (${m.email}). No podrá ingresar más al tenant.`;
  });

  initials(name: string): string {
    return name.split(' ').map(s => s[0]?.toUpperCase()).slice(0, 2).join('');
  }

  switchTo(role: 'admin' | 'operator') {
    this.auth.switchRole(role);
  }

  abrirInvitar() {
    this.miembroEdit.set(null);
    this.modalOpen.set(true);
  }
  abrirEditar(m: Member) {
    this.miembroEdit.set(m);
    this.modalOpen.set(true);
  }
  cerrarModal() {
    this.modalOpen.set(false);
    this.miembroEdit.set(null);
  }
  pedirEliminar(m: Member) {
    this.miembroAEliminar.set(m);
    this.confirmOpen.set(true);
  }
  async eliminar() {
    const m = this.miembroAEliminar();
    if (!m) return;
    this.data.removeMember(m.uid);
    this.confirmOpen.set(false);
    this.miembroAEliminar.set(null);
    await this.toast.show(`Miembro "${m.displayName}" eliminado.`, 'success');
  }

  async logout() {
    this.auth.logout();
    await this.router.navigateByUrl('/auth/login');
  }
}
