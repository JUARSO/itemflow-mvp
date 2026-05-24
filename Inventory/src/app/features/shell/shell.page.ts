import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import {
  IonSplitPane, IonMenu, IonContent,
  IonBadge, IonRouterOutlet, MenuController,
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
    IonBadge, IonRouterOutlet,
  ],
  template: `
    <!--
      Menú hamburguesa en TODOS los tamaños.
      ion-split-pane con [disabled]="true" mantiene la estructura de layout
      Ionic (toolbar arriba, tab-bar bottom, contenido scrolleable) pero NUNCA
      activa el modo persistente — el menú siempre es overlay y se abre con ☰.
    -->
    <ion-split-pane contentId="main-content" [disabled]="true">
      <ion-menu contentId="main-content" type="overlay">
        <ion-content>
          <div class="brand">
            <div class="brand__logo">
              @if (branding.branding().logoImage) {
                <img [src]="branding.branding().logoImage" alt="Logo" class="brand__logo-img" />
              } @else {
                <span>{{ branding.branding().logo }}</span>
              }
            </div>
            <div class="brand__text">
              <div class="brand__name">{{ branding.branding().displayName }}</div>
              <div class="brand__company">{{ tenant.company().name }}</div>
            </div>
          </div>

          <div class="menu-section">Flujo principal</div>
          <a routerLink="/catalogo" routerLinkActive="active" class="menu-item" (click)="closeMenuOnMobile()">
            <span class="menu-item__icon">1</span>
            <span class="menu-item__label">Catálogo</span>
          </a>
          <a routerLink="/insumos" routerLinkActive="active" class="menu-item" (click)="closeMenuOnMobile()">
            <span class="menu-item__icon">2</span>
            <span class="menu-item__label">Insumos</span>
          </a>
          <a routerLink="/recetas" routerLinkActive="active" class="menu-item" (click)="closeMenuOnMobile()">
            <span class="menu-item__icon">3</span>
            <span class="menu-item__label">Recetas</span>
          </a>
          <a routerLink="/ventas" routerLinkActive="active" class="menu-item" (click)="closeMenuOnMobile()">
            <span class="menu-item__icon">4</span>
            <span class="menu-item__label">Ventas</span>
          </a>
          <a routerLink="/ajustes" routerLinkActive="active" class="menu-item" (click)="closeMenuOnMobile()">
            <span class="menu-item__icon">5</span>
            <span class="menu-item__label">Ajustes</span>
          </a>

          <div class="menu-section">Operación</div>
          <a routerLink="/inventario" routerLinkActive="active" class="menu-item" (click)="closeMenuOnMobile()">
            <span class="menu-item__icon">📊</span>
            <span class="menu-item__label">Inventario</span>
          </a>
          <a routerLink="/ordenes-compra" routerLinkActive="active" class="menu-item" (click)="closeMenuOnMobile()">
            <span class="menu-item__icon">📝</span>
            <span class="menu-item__label">Órdenes de Compra</span>
          </a>
          <a routerLink="/alertas" routerLinkActive="active" class="menu-item" (click)="closeMenuOnMobile()">
            <span class="menu-item__icon">🔔</span>
            <span class="menu-item__label">Alertas</span>
            @if (data.activeAlerts().length > 0) {
              <ion-badge color="danger" class="menu-item__badge">
                {{ data.activeAlerts().length }}
              </ion-badge>
            }
          </a>
          <a routerLink="/boosts" routerLinkActive="active" class="menu-item" (click)="closeMenuOnMobile()">
            <span class="menu-item__icon">⚡</span>
            <span class="menu-item__label">Boosts de demanda</span>
            @if (data.activeBoosts().length > 0) {
              <ion-badge color="warning" class="menu-item__badge">
                {{ data.activeBoosts().length }}
              </ion-badge>
            }
          </a>

          <div class="menu-section">Análisis</div>
          <a routerLink="/predicciones" routerLinkActive="active" class="menu-item" (click)="closeMenuOnMobile()">
            <span class="menu-item__icon">📈</span>
            <span class="menu-item__label">Predicciones</span>
          </a>
          <a routerLink="/burn-down" routerLinkActive="active" class="menu-item" (click)="closeMenuOnMobile()">
            <span class="menu-item__icon">📉</span>
            <span class="menu-item__label">Análisis de stock</span>
          </a>

          <div class="menu-section">Cuenta</div>
          <a routerLink="/mas" routerLinkActive="active" class="menu-item" (click)="closeMenuOnMobile()">
            <span class="menu-item__icon">⚙️</span>
            <span class="menu-item__label">Más</span>
          </a>

          <div class="user-block">
            <div class="user-block__name">{{ auth.user()?.displayName }}</div>
            <div class="user-block__role">{{ roleLabel() }}</div>
            <button class="user-block__logout" (click)="logout()">Cerrar sesión</button>
          </div>
        </ion-content>
      </ion-menu>

      <div class="ion-page" id="main-content">
        <ion-router-outlet></ion-router-outlet>
      </div>
    </ion-split-pane>
  `,
  styles: [`
    ion-menu {
      --width: 280px;
      --background: var(--ui-surface);
    }
    ion-menu::part(container) {
      border-right: var(--ui-border-w-md) solid var(--ui-border);
      box-shadow: var(--ui-shadow-md);
    }
    ion-menu ion-content {
      --background: var(--ui-surface);
      --padding-bottom: 80px;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: var(--ui-sp-3);
      padding: var(--ui-sp-4);
      border-bottom: var(--ui-border-w-md) solid var(--ui-border);
      background: var(--ui-primary);
      color: var(--ui-primary-contrast);
    }
    .brand__logo {
      font-size: 32px;
      line-height: 1;
      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--ui-surface);
      border: var(--ui-border-w-md) solid var(--ui-border);
      overflow: hidden;
    }
    .brand__logo-img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    .brand__text { min-width: 0; }
    .brand__name {
      font-family: var(--ui-font-display);
      font-weight: var(--ui-fw-black);
      font-size: var(--ui-fs-lg);
      line-height: 1.1;
    }
    .brand__company {
      font-size: var(--ui-fs-xs);
      opacity: 0.9;
    }

    .menu-section {
      padding: var(--ui-sp-4) var(--ui-sp-4) var(--ui-sp-1);
      font-size: var(--ui-fs-xs);
      font-weight: var(--ui-fw-black);
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--ui-text-muted);
    }

    .menu-item {
      display: flex;
      align-items: center;
      gap: var(--ui-sp-3);
      padding: var(--ui-sp-3) var(--ui-sp-4);
      color: var(--ui-text);
      text-decoration: none;
      font-weight: var(--ui-fw-medium);
      font-size: var(--ui-fs-md);
      border-left: 4px solid transparent;
      transition: background 80ms;
    }
    .menu-item:hover { background: var(--ui-surface-3); }
    .menu-item.active {
      background: var(--ui-surface-2);
      border-left-color: var(--ui-primary);
      font-weight: var(--ui-fw-bold);
    }
    .menu-item__icon {
      width: 28px;
      text-align: center;
      font-weight: var(--ui-fw-black);
      font-family: var(--ui-font-display);
    }
    .menu-item__label { flex: 1; }
    .menu-item__badge { margin-left: auto; }

    .user-block {
      margin: var(--ui-sp-4);
      padding: var(--ui-sp-3);
      background: var(--ui-surface-2);
      border: var(--ui-border-w-md) solid var(--ui-border);
    }
    .user-block__name {
      font-weight: var(--ui-fw-bold);
      font-size: var(--ui-fs-md);
      color: var(--ui-text);
    }
    .user-block__role {
      font-size: var(--ui-fs-xs);
      color: var(--ui-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: var(--ui-sp-2);
    }
    .user-block__logout {
      width: 100%;
      padding: 10px;
      background: var(--ui-danger);
      color: #fff;
      border: var(--ui-border-w-md) solid var(--ui-border);
      box-shadow: var(--ui-shadow-sm);
      font-weight: var(--ui-fw-bold);
      cursor: pointer;
      font-size: var(--ui-fs-sm);
    }
    .user-block__logout:active {
      box-shadow: none;
      transform: translate(2px, 2px);
    }

  `],
})
export class ShellPage {
  protected readonly auth = inject(AuthService);
  private readonly menuCtrl = inject(MenuController);
  protected readonly tenant = inject(TenantContextService);
  protected readonly data = inject(DataService);
  protected readonly branding = inject(BrandingService);
  private readonly router = inject(Router);

  roleLabel() {
    return this.auth.isAdmin() ? 'Administrador' : 'Operador';
  }

  /**
   * Cierra el menú overlay después de navegar.
   * Aplica en todos los tamaños porque ya no hay sidebar persistente.
   */
  closeMenuOnMobile() {
    this.menuCtrl.close().catch(() => { /* sin menú abierto, ignorar */ });
  }

  async logout() {
    this.auth.logout();
    await this.router.navigateByUrl('/auth/login');
  }
}
