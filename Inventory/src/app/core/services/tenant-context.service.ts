import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { MOCK_COMPANY } from '../mocks/dummy-data';

/**
 * Contexto del tenant + helpers de permisos por feature.
 *
 * Modelo de roles:
 *  - admin (administrativos): TODO + análisis + paneles + miembros + branding.
 *  - production (encargado de producción): pedidos de clientes, planificación,
 *    creación de pedidos, historial, recetas (edición).
 *  - inventory (encargado de inventario): catálogo, insumos, recetas (lectura
 *    para vincular en BOM), inventario, mermas, ajustes, proveedores, OCs,
 *    ingresos, alertas.
 *  - operator (operario de producción): cola de pedidos (ejecución),
 *    planificación, recetas (lectura).
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
  readonly isInventory = this.auth.isInventory;
  readonly isOperator = this.auth.isOperator;

  // ===== Permisos por feature =====
  // INVENTARIO (admin + inventory + production)
  // Producción tiene acceso completo a todo lo que no sea panel administrativo,
  // por eso también puede editar catálogo, insumos, OCs, etc.
  private readonly canManageInventory = computed(() =>
    this.auth.isAdmin() || this.auth.isInventory() || this.auth.isProduction()
  );

  /** Edita catálogo de productos. Inventory NO entra al catálogo. */
  readonly canEditCatalog = computed(() => this.auth.isAdmin() || this.auth.isProduction());

  /** Edita insumos / materias primas. */
  readonly canEditSupplies = this.canManageInventory;

  /** Crea/recibe/cancela órdenes de compra. */
  readonly canManagePurchaseOrders = this.canManageInventory;

  /** Registra ajustes de stock. */
  readonly canAdjustStock = this.canManageInventory;

  /** Registra entradas/movimientos en inventario (recepciones). */
  readonly canMoveInventory = this.canManageInventory;

  /** Reconoce / resuelve alertas (de inventario). */
  readonly canManageAlerts = this.canManageInventory;

  /** Gestiona proveedores. */
  readonly canManageSuppliers = this.canManageInventory;

  /** Procesa lotes de merma. */
  readonly canProcessMermas = this.canManageInventory;

  // PRODUCCIÓN (admin + production)

  /** Edita recetas (BOM). Producción define; inventario solo lee. */
  readonly canEditRecipes = computed(() => this.auth.isAdmin() || this.auth.isProduction());

  /** Crear órdenes de fabricación (pedidos de clientes manuales). */
  readonly canCreateOrder = computed(() => this.auth.isAdmin() || this.auth.isProduction());

  /** Cancelar órdenes. Admin y production (no operario). */
  readonly canCancelOrder = computed(() => this.auth.isAdmin() || this.auth.isProduction());

  /** Gestiona clientes externos. */
  readonly canManageCustomers = computed(() => this.auth.isAdmin() || this.auth.isProduction());

  // PRODUCCIÓN OPERATIVA (admin + production + operator)

  /** Operar la cola: iniciar y completar órdenes. */
  readonly canOperateProduction = computed(() =>
    this.auth.isAdmin() || this.auth.isProduction() || this.auth.isOperator()
  );

  // SOLO ADMIN

  /** Gestiona miembros del tenant. */
  readonly canManageMembers = computed(() => this.auth.isAdmin());

  /** Edita branding del tenant. */
  readonly canManageBranding = computed(() => this.auth.isAdmin());

  /** Ve paneles administrativos (control de pedidos, inventario, contable). */
  readonly canViewAdminPanels = computed(() => this.auth.isAdmin());
}
