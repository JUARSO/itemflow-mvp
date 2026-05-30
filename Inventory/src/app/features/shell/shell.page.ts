import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import {
  IonSplitPane, IonMenu, IonContent,
  IonBadge, IonRouterOutlet, IonIcon, MenuController, NavController,
} from '@ionic/angular/standalone';
import { AuthService } from '../../core/services/auth.service';
import { TenantContextService } from '../../core/services/tenant-context.service';
import { DataService } from '../../core/services/data.service';
import { BrandingService } from '../../core/services/branding.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink, RouterLinkActive,
    IonSplitPane, IonMenu, IonContent,
    IonBadge, IonRouterOutlet, IonIcon,
  ],
  templateUrl: './shell.page.html',
  styleUrls: ['./shell.page.scss'],
})
export class ShellPage {
  protected readonly auth = inject(AuthService);
  private readonly menuCtrl = inject(MenuController);
  protected readonly tenant = inject(TenantContextService);
  protected readonly data = inject(DataService);
  protected readonly branding = inject(BrandingService);
  private readonly navCtrl = inject(NavController);

  roleLabel(): string {
    if (this.auth.isAdmin()) return 'Administrativo';
    if (this.auth.isProduccion()) return 'Producción';
    if (this.auth.isVentas()) return 'Ventas';
    return '—';
  }

  /**
   * Cierra el menú overlay después de navegar.
   * Aplica en todos los tamaños porque ya no hay sidebar persistente.
   */
  closeMenuOnMobile() {
    this.menuCtrl.close().catch(() => { /* sin menú abierto, ignorar */ });
  }

  async logout() {
    // Cerrar el menú overlay antes de salir, para que no quede encima.
    await this.menuCtrl.close().catch(() => { /* sin menú abierto */ });
    this.auth.logout();
    // navigateRoot resetea la pila de ion-router-outlet: sin esto, la página
    // anterior queda montada encima y la app "deja de responder".
    await this.navCtrl.navigateRoot('/auth/login', { animationDirection: 'back' });
  }
}
