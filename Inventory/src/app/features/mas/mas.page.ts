import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
  IonButton, IonBadge, IonIcon,
} from '@ionic/angular/standalone';
import { AuthService } from '../../core/services/auth.service';
import { TenantContextService } from '../../core/services/tenant-context.service';
import { DataService } from '../../core/services/data.service';
import { MembersService } from '../../core/services/members.service';
import { ThemeService } from '../../core/services/theme.service';
import { BrandingService } from '../../core/services/branding.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { ToastService } from '../../shared/components/toast/toast.service';
import { MiembroFormModalComponent } from './miembro-form-modal.component';
import { FacturacionConfigComponent } from './facturacion-config.component';
import { Member, UserRole } from '../../core/models';

@Component({
  selector: 'app-mas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
    IonButton, IonBadge, IonIcon,
    PageHeaderComponent, ConfirmDialogComponent, MiembroFormModalComponent,
    FacturacionConfigComponent,
  ],
  templateUrl: './mas.page.html',
  styleUrls: ['./mas.page.scss'],
})
export class MasPage {
  protected readonly auth = inject(AuthService);
  protected readonly tenant = inject(TenantContextService);
  protected readonly data = inject(DataService);
  protected readonly members = inject(MembersService);
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
    try {
      await this.branding.save({
        displayName: this.nameDraft(),
        logo: this.logoDraft(),
      });
      await this.toast.show('Marca actualizada.', 'success');
    } catch (e: unknown) {
      await this.toast.show(e instanceof Error ? e.message : 'No se pudo guardar la marca.', 'danger');
    }
  }

  async resetBranding() {
    try {
      await this.branding.reset();
      await this.toast.show('Marca restaurada al default.');
    } catch (e: unknown) {
      await this.toast.show(e instanceof Error ? e.message : 'No se pudo restaurar la marca.', 'danger');
    }
  }

  async selectTheme(id: string) {
    try {
      await this.theme.setTheme(id);
    } catch (e: unknown) {
      await this.toast.show(e instanceof Error ? e.message : 'No se pudo guardar la apariencia.', 'danger');
    }
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
    try {
      await this.branding.clearLogoImage();
      await this.toast.show('Imagen quitada. Se usa el texto/emoji.');
    } catch (e: unknown) {
      await this.toast.show(e instanceof Error ? e.message : 'No se pudo quitar la imagen.', 'danger');
    }
  }

  readonly confirmMessage = computed(() => {
    const m = this.miembroAEliminar();
    if (!m) return '';
    return `Vas a eliminar el acceso de "${m.displayName}" (${m.email}). No podrá ingresar más al tenant.`;
  });

  initials(name: string): string {
    return name.split(' ').map(s => s[0]?.toUpperCase()).slice(0, 2).join('');
  }

  roleLabel(): string {
    if (this.auth.isAdmin()) return 'Administrativo';
    if (this.auth.isProduccion()) return 'Producción';
    if (this.auth.isVentas()) return 'Ventas';
    return '—';
  }

  roleColor(): string {
    if (this.auth.isAdmin()) return 'primary';
    if (this.auth.isProduccion()) return 'success';
    if (this.auth.isVentas()) return 'tertiary';
    return 'medium';
  }

  memberBadgeLabel(r: UserRole): string {
    switch (r) {
      case 'admin': return 'Administrativo';
      case 'produccion': return 'Producción';
      case 'ventas': return 'Ventas';
    }
  }

  memberBadgeColor(r: UserRole): string {
    switch (r) {
      case 'admin': return 'primary';
      case 'produccion': return 'success';
      case 'ventas': return 'tertiary';
    }
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
    try {
      await this.members.remove(m.uid);
      await this.toast.show(`Miembro "${m.displayName}" eliminado.`, 'success');
    } catch (e: unknown) {
      await this.toast.show(e instanceof Error ? e.message : 'No se pudo eliminar el miembro.', 'danger');
    } finally {
      this.confirmOpen.set(false);
      this.miembroAEliminar.set(null);
    }
  }

  async logout() {
    await this.auth.logout();
    await this.router.navigateByUrl('/auth/login');
  }
}
