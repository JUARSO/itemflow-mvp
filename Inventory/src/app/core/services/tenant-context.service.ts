import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { MOCK_COMPANY } from '../mocks/dummy-data';

/**
 * Contexto del tenant + helpers de permisos por feature.
 *
 * Modelo de roles (3 roles):
 *  - admin: TODO + análisis + paneles + miembros + branding.
 *  - produccion: de catálogo hacia abajo — catálogo, recetas, inventario,
 *    insumos, mermas, ajustes, proveedores, pre-compras, OCs, planificación,
 *    análisis y alertas. NO toca clientes/pedidos ni paneles administrativos.
 *  - ventas: la parte de clientes — clientes, crear pedido y cola de pedidos
 *    (recibidos/aceptados/completados).
 */
@Injectable({ providedIn: 'root' })
export class TenantContextService {
  private readonly auth = inject(AuthService);

  readonly company = signal(MOCK_COMPANY);
  readonly tenantId = computed(() => MOCK_COMPANY.id);
  readonly isReady = computed(() => this.auth.isAuthenticated());
  readonly role = this.auth.role;
  readonly isAdmin = this.auth.isAdmin;
  readonly isProduccion = this.auth.isProduccion;
  readonly isVentas = this.auth.isVentas;

  // ===== Permisos por feature =====
  // CATÁLOGO HACIA ABAJO (admin + produccion): catálogo, recetas, inventario,
  // insumos, mermas, ajustes, proveedores, compras, análisis y alertas.
  private readonly canManageInventory = computed(() =>
    this.auth.isAdmin() || this.auth.isProduccion()
  );

  /** Edita catálogo de productos. */
  readonly canEditCatalog = computed(() => this.auth.isAdmin() || this.auth.isProduccion());

  /** Edita insumos / materias primas. */
  readonly canEditSupplies = this.canManageInventory;

  /** Crea/recibe/cancela órdenes de compra. */
  readonly canManagePurchaseOrders = this.canManageInventory;

  /**
   * Crea y aprueba pre-compras. Mismo grupo que OCs; la regla "el aprobador
   * debe ser distinto del creador" se valida a nivel de servicio.
   */
  readonly canManagePrePurchaseOrders = this.canManageInventory;

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

  /** Edita recetas (BOM). Forma parte de "catálogo hacia abajo". */
  readonly canEditRecipes = computed(() => this.auth.isAdmin() || this.auth.isProduccion());

  // CLIENTES Y PEDIDOS (admin + ventas)

  /** Crear órdenes de fabricación (pedidos de clientes). */
  readonly canCreateOrder = computed(() => this.auth.isAdmin() || this.auth.isVentas());

  /** Cancelar órdenes. */
  readonly canCancelOrder = computed(() => this.auth.isAdmin() || this.auth.isVentas());

  /** Gestiona clientes externos. */
  readonly canManageCustomers = computed(() => this.auth.isAdmin() || this.auth.isVentas());

  /** Gestiona urnas (vitrinas) y su sistema de ventas. */
  readonly canManageUrnas = computed(() => this.auth.isAdmin() || this.auth.isVentas());

  /** Operar la cola de pedidos de clientes: aceptar, iniciar y completar. Lado Ventas. */
  readonly canOperateProduction = computed(() => this.auth.isAdmin() || this.auth.isVentas());

  /** Fabricar las solicitudes de reposición de almacén. Lado Producción. */
  readonly canFulfillAlmacenRequests = computed(() => this.auth.isAdmin() || this.auth.isProduccion());

  // SOLO ADMIN

  /** Gestiona miembros del tenant. */
  readonly canManageMembers = computed(() => this.auth.isAdmin());

  /** Edita branding del tenant. */
  readonly canManageBranding = computed(() => this.auth.isAdmin());

  /** Ve paneles administrativos (control de pedidos, inventario, contable). */
  readonly canViewAdminPanels = computed(() => this.auth.isAdmin());
}
