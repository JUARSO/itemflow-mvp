import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { MOCK_COMPANY } from '../mocks/dummy-data';

/**
 * Contexto del tenant + helpers de permisos por feature.
 *
 * Modelo de roles:
 *  - admin: acceso completo a todas las pantallas, análisis y configuración
 *  - production: opera catálogo, recetas, insumos, inventario, ajustes, OCs,
 *    alertas
 *  - operator: consulta recetas (lectura)
 */
@Injectable({ providedIn: 'root' })
export class TenantContextService {
  private readonly auth = inject(AuthService);

  readonly company = signal(MOCK_COMPANY);
  readonly tenantId = computed(() => MOCK_COMPANY.id);
  readonly isReady = computed(() => this.auth.isAuthenticated());
  readonly role = this.auth.role;
  readonly isAdmin = this.auth.isAdmin;
  readonly isProduction = this.auth.isProduction;
  readonly isOperator = this.auth.isOperator;

  // ===== Permisos por feature =====

  /** Edita catálogo de productos. */
  readonly canEditCatalog = computed(() => this.auth.isAdmin() || this.auth.isProduction());

  /** Edita recetas (BOM). */
  readonly canEditRecipes = computed(() => this.auth.isAdmin() || this.auth.isProduction());

  /** Edita insumos / materias primas. */
  readonly canEditSupplies = computed(() => this.auth.isAdmin() || this.auth.isProduction());

  /** Crea/recibe/cancela órdenes de compra. */
  readonly canManagePurchaseOrders = computed(() => this.auth.isAdmin() || this.auth.isProduction());

  /** Registra ajustes de stock. */
  readonly canAdjustStock = computed(() => this.auth.isAdmin() || this.auth.isProduction());

  /** Registra entradas/movimientos en inventario. */
  readonly canMoveInventory = computed(() => this.auth.isAdmin() || this.auth.isProduction());

  /** Reconoce / resuelve alertas. */
  readonly canManageAlerts = computed(() => this.auth.isAdmin() || this.auth.isProduction());

  /** Crear órdenes de fabricación. Admin y production. */
  readonly canCreateOrder = computed(() => this.auth.isAdmin() || this.auth.isProduction());

  /** Cancelar órdenes de fabricación. Admin y production (no operario). */
  readonly canCancelOrder = computed(() => this.auth.isAdmin() || this.auth.isProduction());

  /** Operar la cola: iniciar y completar órdenes. Admin, production y operator. */
  readonly canOperateProduction = computed(() =>
    this.auth.isAdmin() || this.auth.isProduction() || this.auth.isOperator()
  );

  /** Gestiona miembros del tenant. Solo admin. */
  readonly canManageMembers = computed(() => this.auth.isAdmin());

  /** Edita branding del tenant. Solo admin. */
  readonly canManageBranding = computed(() => this.auth.isAdmin());
}
