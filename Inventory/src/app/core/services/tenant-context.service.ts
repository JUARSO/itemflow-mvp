import { Injectable, computed, effect, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { TenantService } from './tenant.service';
import { DataService } from './data.service';
import { MOCK_COMPANY } from '../mocks/dummy-data';

/**
 * Contexto del tenant ACTUAL + helpers de permisos por feature.
 *
 * El tenant ya no está cableado: deriva del usuario autenticado. Al cambiar de
 * tenant (login/registro), se carga su dataset aislado en `DataService`.
 *
 * Modelo de roles (3 roles):
 *  - admin: TODO + análisis + paneles + miembros + branding.
 *  - produccion: de catálogo hacia abajo (catálogo, inventario, compras…).
 *  - ventas: la parte de clientes (clientes, pedidos, punto de venta).
 */
@Injectable({ providedIn: 'root' })
export class TenantContextService {
  private readonly auth = inject(AuthService);
  private readonly tenants = inject(TenantService);
  private readonly data = inject(DataService);

  /** Tenant actual (deriva del usuario); cae al demo si aún no hay sesión. */
  readonly company = computed(() => this.tenants.byId(this.auth.tenantId()) ?? MOCK_COMPANY);
  readonly tenantId = this.auth.tenantId;

  /** Suscripción y plan del tenant actual. */
  readonly subscription = computed(() => this.company().subscription);
  readonly plan = computed(() => this.tenants.planById(this.subscription().planId));
  /** ¿La suscripción permite operar (activa o en prueba vigente)? */
  readonly isSubscriptionActive = computed(() => this.tenants.isUsable(this.company()));

  readonly isReady = computed(() => this.auth.isAuthenticated());
  readonly role = this.auth.role;
  readonly isAdmin = this.auth.isAdmin;
  readonly isProduccion = this.auth.isProduccion;
  readonly isVentas = this.auth.isVentas;

  constructor() {
    // Cuando cambia el tenant del usuario, cargar su dataset aislado. Sembramos
    // al usuario actual como primer miembro si la organización es nueva/vacía.
    effect(() => {
      const id = this.auth.tenantId();
      const u = this.auth.user();
      this.data.loadTenant(id, u ? [u] : []);
    });
  }

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

  /**
   * Define PRECIOS FINALES (al consumidor / ventanilla y por cliente).
   * SOLO el administrador. Producción define el precio base; Ventas solo vende
   * al precio final que fijó el administrador.
   */
  readonly canSetFinalPrices = computed(() => this.auth.isAdmin());
}
