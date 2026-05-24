import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { MOCK_COMPANY } from '../mocks/dummy-data';

/**
 * Contexto del tenant + helpers de permisos por feature.
 *
 * Reglas del modelo de roles:
 *  - admin: SOLO LECTURA en todos los datos operativos. Únicas acciones permitidas:
 *    gestión de miembros y branding (config administrativa del tenant).
 *  - sales: puede crear pedidos, vender, registrar devoluciones. Catálogo solo lectura.
 *  - production: puede operar la cola de producción, editar catálogo/recetas/insumos,
 *    ajustar stock, crear OCs, gestionar alertas y boosts.
 */
@Injectable({ providedIn: 'root' })
export class TenantContextService {
  private readonly auth = inject(AuthService);

  readonly company = signal(MOCK_COMPANY);
  readonly tenantId = computed(() => MOCK_COMPANY.id);
  readonly isReady = computed(() => this.auth.isAuthenticated());
  readonly role = this.auth.role;
  readonly isAdmin = this.auth.isAdmin;
  readonly isSales = this.auth.isSales;
  readonly isProduction = this.auth.isProduction;
  readonly isOperator = this.auth.isOperator;

  // ===== Permisos derivados (canActx) =====

  /** Admin = solo lectura en datos operativos. */
  readonly isReadOnly = computed(() => this.auth.isAdmin());

  /**
   * Edita datos del catálogo de productos. Antes: admin.
   * Ahora: producción (admin solo ve).
   */
  readonly canEditCatalog = computed(() => this.auth.isProduction());

  /** Edita recetas (BOM). Producción. */
  readonly canEditRecipes = computed(() => this.auth.isProduction());

  /** Edita insumos / materias primas. Producción. */
  readonly canEditSupplies = computed(() => this.auth.isProduction());

  /** Crea/recibe/cancela órdenes de compra. Producción. */
  readonly canManagePurchaseOrders = computed(() => this.auth.isProduction());

  /** Registra ajustes de stock. Producción. */
  readonly canAdjustStock = computed(() => this.auth.isProduction());

  /** Registra entradas/movimientos en inventario. Producción. */
  readonly canMoveInventory = computed(() => this.auth.isProduction());

  /** Reconoce / resuelve alertas. Producción. */
  readonly canManageAlerts = computed(() => this.auth.isProduction());

  /** Crea boosts de demanda. Producción. */
  readonly canManageBoosts = computed(() => this.auth.isProduction());

  /**
   * Acciones de la cola de producción: iniciar y completar órdenes.
   * Producción y operario (operario es quien físicamente fabrica).
   */
  readonly canOperateProduction = computed(() =>
    this.auth.isProduction() || this.auth.isOperator()
  );

  /**
   * Cancelar una orden ya en cola. Solo Producción — el operario solo
   * ejecuta el trabajo, no decide cancelar lotes.
   */
  readonly canCancelOrder = computed(() => this.auth.isProduction());

  /** Crea órdenes a producción (pedidos desde ventas). Sales. */
  readonly canCreateOrder = computed(() => this.auth.isSales());

  /** Registra venta al cliente. Sales. */
  readonly canSell = computed(() => this.auth.isSales());

  /** Registra devolución de producto a producción. Sales. */
  readonly canRegisterReturn = computed(() => this.auth.isSales());

  /** Cancela una orden de producción desde ventas. Sales. */
  readonly canCancelOrderFromSales = computed(() => this.auth.isSales());

  /** Gestiona miembros del tenant (invitar, cambiar rol, eliminar). Admin. */
  readonly canManageMembers = computed(() => this.auth.isAdmin());

  /** Edita branding del tenant (nombre, logo, tema). Admin. */
  readonly canManageBranding = computed(() => this.auth.isAdmin());
}
