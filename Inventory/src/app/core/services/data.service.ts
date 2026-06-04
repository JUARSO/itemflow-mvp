import { Injectable, computed, signal } from '@angular/core';
import {
  Alert, Customer, CustomerOrder, DemandPrediction, KardexEntry, Member,
  OrderItem, OrderReservation, OrderShortfall, Product, ProductionMermaReason,
  PurchaseOrder, Recipe, ReturnedLot, SaleRecord, StockItem,
  SuggestedPrePurchase, SuggestedPrePurchaseItem, SuggestedReason,
  Supplier, Supply, SupplyStockItem, StockStatus, UserRole, POStatus,
  Urna, UrnaLote, UrnaLoteLine, PosSale, PosSaleLine, PaymentMethod, ComprobanteTipo, PosCliente, RecurringOrder, RecurringOrderItem,
  ReservaItem, WeeklyPlanItem, WeeklyProductionPlan,
} from '../models';
import {
  MOCK_ALERTS, MOCK_CUSTOMERS, MOCK_KARDEX, MOCK_MEMBERS, MOCK_ORDERS, MOCK_PREDICTIONS,
  MOCK_PRODUCTS, MOCK_PRODUCT_STOCK, MOCK_PURCHASE_ORDERS, MOCK_RECIPES,
  MOCK_RETURNED_LOTS, MOCK_SALES, MOCK_SUPPLIERS, MOCK_SUPPLIES, MOCK_SUPPLY_STOCK,
  MOCK_URNAS, MOCK_URNA_LOTES, MOCK_CONSUMER_PRICES, DEFAULT_TENANT_ID,
} from '../mocks/dummy-data';
import { computeSupplierLeadTime, LeadTimeResult } from '../lead-time';

/**
 * Instantánea completa de los datos de UN tenant. Se usa para particionar el
 * estado por organización y poder cambiar de tenant sin mezclar información.
 */
interface TenantData {
  products: Product[]; supplies: Supply[]; recipes: Recipe[];
  productStock: StockItem[]; supplyStock: SupplyStockItem[]; kardex: KardexEntry[];
  sales: SaleRecord[]; alerts: Alert[]; predictions: DemandPrediction[];
  pos: PurchaseOrder[]; members: Member[]; orders: CustomerOrder[]; customers: Customer[];
  returnedLots: ReturnedLot[]; suppliers: Supplier[]; urnas: Urna[]; urnaLotes: UrnaLote[];
  posSales: PosSale[]; posClientes: PosCliente[]; recurringOrders: RecurringOrder[];
  reservas: ReservaItem[]; consumerPrices: Record<string, number>;
  manualAdditions: Record<string, { supplyId: string; qty: number }[]>;
  weeklyPlan: WeeklyProductionPlan;
  planDeliveries: Record<string, { at: Date; total: number }>;
}

/**
 * Servicio único in-memory para el MVP, AHORA particionado por tenant.
 * Reemplazar por servicios Firebase (subcolecciones `tenants/{tenantId}/...`)
 * cuando se conecte el backend real — ese será el aislamiento *seguro*.
 */
@Injectable({ providedIn: 'root' })
export class DataService {
  // ----- Estado base como signals editables -----
  private readonly _products = signal<Product[]>([...MOCK_PRODUCTS]);
  private readonly _supplies = signal<Supply[]>([...MOCK_SUPPLIES]);
  private readonly _recipes = signal<Recipe[]>([...MOCK_RECIPES]);
  private readonly _productStock = signal<StockItem[]>([...MOCK_PRODUCT_STOCK]);
  private readonly _supplyStock = signal<SupplyStockItem[]>([...MOCK_SUPPLY_STOCK]);
  private readonly _kardex = signal<KardexEntry[]>([...MOCK_KARDEX]);
  private readonly _sales = signal<SaleRecord[]>([...MOCK_SALES]);
  private readonly _alerts = signal<Alert[]>([...MOCK_ALERTS]);
  private readonly _predictions = signal<DemandPrediction[]>([...MOCK_PREDICTIONS]);
  private readonly _pos = signal<PurchaseOrder[]>([...MOCK_PURCHASE_ORDERS]);
  private readonly _members = signal<Member[]>([...MOCK_MEMBERS]);
  private readonly _orders = signal<CustomerOrder[]>([...MOCK_ORDERS]);
  private readonly _customers = signal<Customer[]>([...MOCK_CUSTOMERS]);
  private readonly _returnedLots = signal<ReturnedLot[]>([...MOCK_RETURNED_LOTS]);
  private readonly _suppliers = signal<Supplier[]>([...MOCK_SUPPLIERS]);
  private readonly _urnas = signal<Urna[]>([...MOCK_URNAS]);
  private readonly _urnaLotes = signal<UrnaLote[]>([...MOCK_URNA_LOTES]);
  private readonly _posSales = signal<PosSale[]>([]);
  private readonly _posClientes = signal<PosCliente[]>([]);
  private readonly _recurringOrders = signal<RecurringOrder[]>([]);
  private readonly _reservas = signal<ReservaItem[]>([]);
  /** Plan de producción semanal recurrente (por día de la semana). */
  private readonly _weeklyPlan = signal<WeeklyProductionPlan>({});
  /** Entregas del plan al almacén ya realizadas (clave: fecha ISO). Evita doble entrega. */
  private readonly _planDeliveries = signal<Record<string, { at: Date; total: number }>>({});
  /** Precio FINAL al consumidor por producto (catálogo de Ventas). */
  private readonly _consumerPrices = signal<Record<string, number>>({ ...MOCK_CONSUMER_PRICES });
  /**
   * Adiciones MANUALES al carrito de pre-compra por proveedor. Es estado
   * efímero (en-memoria) que se limpia al aprobar la pre-compra de ese
   * proveedor. Estructura: { [supplierId]: [{ supplyId, qty }] }.
   * No se persiste — la pre-compra sigue siendo "dinámica", esto es sólo
   * una capa de overlay para que el usuario pueda agregar items.
   */
  private readonly _manualAdditions = signal<Record<string, { supplyId: string; qty: number }[]>>({});

  constructor() {
    // Sembrar alertas auto-derivadas a partir del stock inicial.
    this.regenerateAutoAlerts();
  }

  // ===================== Aislamiento por tenant =====================
  /** Tenant cuyo dataset está cargado en los signals. Arranca en el demo. */
  private _tenantId = DEFAULT_TENANT_ID;
  /** Datasets de otros tenants guardados en memoria mientras no están activos. */
  private readonly _partitions = new Map<string, TenantData>();

  /** Tenant actualmente cargado. */
  tenantId(): string { return this._tenantId; }

  /**
   * Carga el dataset del tenant indicado. Guarda el del tenant actual, restaura
   * el destino si ya existía, o lo inicializa VACÍO (empresa nueva) sembrando
   * sólo a su administrador como primer miembro.
   *
   * NOTA DE SEGURIDAD: esta partición en memoria da aislamiento *lógico* en la
   * sesión, no *seguridad*. El aislamiento real se enforca en el backend.
   */
  loadTenant(tenantId: string, seedMembers: Member[] = []): void {
    if (tenantId === this._tenantId) return;
    this._partitions.set(this._tenantId, this.snapshot());
    const target = this._partitions.get(tenantId);
    if (target) {
      this.applyData(target);
    } else {
      const fresh = DataService.emptyData();
      fresh.members = seedMembers.filter(m => m.tenantId === tenantId);
      this.applyData(fresh);
    }
    this._tenantId = tenantId;
    this.regenerateAutoAlerts();
  }

  private snapshot(): TenantData {
    return {
      products: this._products(), supplies: this._supplies(), recipes: this._recipes(),
      productStock: this._productStock(), supplyStock: this._supplyStock(), kardex: this._kardex(),
      sales: this._sales(), alerts: this._alerts(), predictions: this._predictions(),
      pos: this._pos(), members: this._members(), orders: this._orders(), customers: this._customers(),
      returnedLots: this._returnedLots(), suppliers: this._suppliers(), urnas: this._urnas(),
      urnaLotes: this._urnaLotes(), posSales: this._posSales(), posClientes: this._posClientes(),
      recurringOrders: this._recurringOrders(), reservas: this._reservas(),
      consumerPrices: this._consumerPrices(), manualAdditions: this._manualAdditions(),
      weeklyPlan: this._weeklyPlan(), planDeliveries: this._planDeliveries(),
    };
  }

  private applyData(d: TenantData): void {
    this._products.set(d.products); this._supplies.set(d.supplies); this._recipes.set(d.recipes);
    this._productStock.set(d.productStock); this._supplyStock.set(d.supplyStock); this._kardex.set(d.kardex);
    this._sales.set(d.sales); this._alerts.set(d.alerts); this._predictions.set(d.predictions);
    this._pos.set(d.pos); this._members.set(d.members); this._orders.set(d.orders); this._customers.set(d.customers);
    this._returnedLots.set(d.returnedLots); this._suppliers.set(d.suppliers); this._urnas.set(d.urnas);
    this._urnaLotes.set(d.urnaLotes); this._posSales.set(d.posSales); this._posClientes.set(d.posClientes);
    this._recurringOrders.set(d.recurringOrders); this._reservas.set(d.reservas);
    this._consumerPrices.set(d.consumerPrices); this._manualAdditions.set(d.manualAdditions);
    this._weeklyPlan.set(d.weeklyPlan); this._planDeliveries.set(d.planDeliveries);
  }

  private static emptyData(): TenantData {
    return {
      products: [], supplies: [], recipes: [], productStock: [], supplyStock: [], kardex: [],
      sales: [], alerts: [], predictions: [], pos: [], members: [], orders: [], customers: [],
      returnedLots: [], suppliers: [], urnas: [], urnaLotes: [], posSales: [], posClientes: [],
      recurringOrders: [], reservas: [], consumerPrices: {}, manualAdditions: {}, weeklyPlan: {}, planDeliveries: {},
    };
  }


  // ----- Readonly accessors -----
  readonly products = this._products.asReadonly();
  readonly activeProducts = computed(() => this._products().filter(p => p.active));
  readonly supplies = this._supplies.asReadonly();
  readonly activeSupplies = computed(() => this._supplies().filter(s => s.active));
  readonly recipes = this._recipes.asReadonly();
  readonly productStock = this._productStock.asReadonly();
  readonly supplyStock = this._supplyStock.asReadonly();
  readonly kardex = this._kardex.asReadonly();
  readonly sales = this._sales.asReadonly();
  readonly alerts = this._alerts.asReadonly();
  readonly predictions = this._predictions.asReadonly();
  readonly purchaseOrders = this._pos.asReadonly();
  readonly members = this._members.asReadonly();
  readonly orders = this._orders.asReadonly();
  readonly customers = this._customers.asReadonly();
  readonly activeCustomers = computed(() => this._customers().filter(c => c.active));
  readonly returnedLots = this._returnedLots.asReadonly();
  readonly pendingReturnedLots = computed(() =>
    this._returnedLots().filter(l => l.status === 'pending')
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  );
  readonly processedReturnedLots = computed(() =>
    this._returnedLots().filter(l => l.status === 'reviewed')
      .sort((a, b) => (b.reviewedAt?.getTime() ?? 0) - (a.reviewedAt?.getTime() ?? 0))
  );
  readonly suppliers = this._suppliers.asReadonly();
  readonly activeSuppliers = computed(() => this._suppliers().filter(s => s.active));
  readonly urnas = this._urnas.asReadonly();
  readonly activeUrnas = computed(() => this._urnas().filter(u => u.active));
  readonly urnaLotes = this._urnaLotes.asReadonly();
  readonly posSales = this._posSales.asReadonly();
  readonly consumerPrices = this._consumerPrices.asReadonly();

  /** Modelo de almacén único: el Almacén de Ventas es la primera urna activa. */
  readonly almacen = computed(() => this.activeUrnas()[0] ?? null);

  /** Pedidos de reposición listos para recibir en el almacén (completados, sin recibir). */
  readonly almacenRecepcionesPendientes = computed(() => {
    const id = this.activeUrnas()[0]?.id;
    if (!id) return 0;
    return this._orders().filter(o => o.urnaId === id && o.status === 'completed' && !o.deliveredToUrnaAt).length;
  });

  // ----- Catálogo de Ventas (precios al consumidor) -----

  /** Semilla histórica de precio (campo legacy `sellPrice`). El precio de venta real se
   *  configura en Ventas (catálogo de ventas → consumerPrice); esto solo da el valor inicial. */
  baseSalePrice(productId: string): number {
    return this.productById(productId)?.sellPrice ?? 0;
  }

  /**
   * Precio FINAL de venta (ventanilla y clientes). Lo maneja Ventas (catálogo de ventas),
   * solo el admin. Producción NO fija precio de venta, solo costo. Si aún no se configuró,
   * cae a la semilla histórica.
   */
  consumerPrice(productId: string): number {
    const c = this._consumerPrices()[productId];
    return c != null ? c : this.baseSalePrice(productId);
  }

  /** Configura el precio final al consumidor de un producto. */
  setConsumerPrice(productId: string, price: number): void {
    const p = Math.max(0, Math.round(price || 0));
    this._consumerPrices.update(map => ({ ...map, [productId]: p }));
  }

  /** Tasa de IVA del producto (del CABYS). 0 si no tiene. */
  ivaRate(productId: string): number {
    return this.productById(productId)?.cabysIva ?? 0;
  }
  /** PRECIO REAL de cobro: precio final + IVA del CABYS. Es lo que se factura/cobra. */
  consumerPriceConIva(productId: string): number {
    return Math.round(this.consumerPrice(productId) * (1 + this.ivaRate(productId)));
  }
  /** Precio por cliente con IVA aplicado (precio real de cobro al cliente). */
  priceForCustomerConIva(customer: Customer, productId: string): number {
    return Math.round(this.priceForCustomer(customer, productId) * (1 + this.ivaRate(productId)));
  }

  // ----- Inventario del almacén de Ventas -----

  /** Estado binario del producto en el almacén: disponible si hay stock, agotado si no. */
  almacenProductStatus(productId: string): StockStatus {
    return this.urnaProductQty(this.almacenId(), productId) > 0 ? 'available' : 'out';
  }

  /**
   * Unidades EN CAMINO al almacén para un producto: solicitudes de reposición
   * (con urnaId) aún no recibidas. Para las completadas usa lo producido
   * (fulfilledQty); para las demás, lo solicitado (qty).
   */
  almacenIncomingForProduct(productId: string): number {
    let total = 0;
    for (const o of this._orders()) {
      if (!o.urnaId || o.status === 'cancelled' || o.deliveredToUrnaAt) continue;
      for (const it of o.items) {
        if (it.productId !== productId) continue;
        total += o.status === 'completed' ? it.fulfilledQty : it.qty;
      }
    }
    return total;
  }

  /**
   * Detalle de lo que viene en camino de un producto: cada solicitud de
   * reposición pendiente con su cantidad, estado y fecha en que se necesita.
   * Ordenado por fecha (lo más próximo primero).
   */
  almacenIncomingDetail(productId: string): Array<{
    orderCode: string; qty: number; estado: string; deliveryDate?: Date;
  }> {
    const out: Array<{ orderCode: string; qty: number; estado: string; deliveryDate?: Date }> = [];
    for (const o of this._orders()) {
      if (!o.urnaId || o.status === 'cancelled' || o.deliveredToUrnaAt) continue;
      const it = o.items.find(i => i.productId === productId);
      if (!it) continue;
      const qty = o.status === 'completed' ? it.fulfilledQty : it.qty;
      if (qty <= 0) continue;
      const estado = o.status === 'pending' ? 'En cola'
        : o.status === 'in_production' ? 'En fabricación'
        : 'Listo para recibir';
      out.push({ orderCode: o.code, qty, estado, deliveryDate: o.requestedDeliveryDate });
    }
    out.sort((a, b) => (a.deliveryDate?.getTime() ?? Infinity) - (b.deliveryDate?.getTime() ?? Infinity));
    return out;
  }

  /** Órdenes que aún están abiertas en el flujo (no completadas ni canceladas). */
  // Colas de PEDIDOS DE CLIENTES EXTERNOS (lado Ventas): excluyen las
  // solicitudes de reposición de almacén (esas tienen urnaId y van a Producción).
  readonly openOrders = computed(() =>
    this._orders().filter(o => !o.urnaId && (o.status === 'pending' || o.status === 'in_production'))
  );
  readonly pendingOrders = computed(() =>
    this._orders().filter(o => !o.urnaId && o.status === 'pending')
  );
  readonly inProductionOrders = computed(() =>
    this._orders().filter(o => !o.urnaId && o.status === 'in_production')
  );
  readonly completedOrders = computed(() =>
    this._orders().filter(o => !o.urnaId && o.status === 'completed')
  );

  // Solicitudes de REPOSICIÓN DE ALMACÉN (pedidos con urnaId) — lado Producción.
  readonly almacenRequests = computed(() =>
    this._orders()
      .filter(o => o.urnaId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  );
  /** Solicitudes de almacén pendientes de producir (badge de Producción). */
  readonly almacenRequestsPorProducir = computed(() =>
    this._orders().filter(o => o.urnaId && o.status === 'pending').length
  );

  // ----- Flujo de pedidos de CLIENTE (simétrico al de almacén) -----

  /** Pedidos de cliente RECIBIDOS, esperando que Ventas los corrobore. */
  readonly pedidosRecibidos = computed(() =>
    this._orders()
      .filter(o => o.customerId && o.status === 'pending' && !o.acceptedBySalesAt)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  );

  /** Cola UNIFICADA de producción: pedidos de almacén + pedidos de cliente corroborados. */
  readonly produccionQueue = computed(() =>
    this._orders()
      .filter(o =>
        o.status !== 'cancelled' && !o.deliveredToUrnaAt && !o.dispatchedAt &&
        (o.status === 'pending' || o.status === 'in_production' || o.status === 'completed') &&
        (!!o.urnaId || !!o.acceptedBySalesAt),
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  );

  /** Pedidos de cliente ya producidos, esperando DESPACHO al cliente. */
  readonly pedidosPorDespachar = computed(() =>
    this._orders()
      .filter(o => o.customerId && o.status === 'completed' && !o.dispatchedAt)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  );

  /** Pedidos despachados, esperando FACTURACIÓN. */
  readonly pedidosPorFacturar = computed(() =>
    this._orders()
      .filter(o => o.customerId && !!o.dispatchedAt && !o.invoicedAt)
      .sort((a, b) => (b.dispatchedAt?.getTime() ?? 0) - (a.dispatchedAt?.getTime() ?? 0))
  );

  /** Pedidos FACTURADOS (historial). */
  readonly pedidosFacturados = computed(() =>
    this._orders()
      .filter(o => o.customerId && !!o.invoicedAt)
      .sort((a, b) => (b.invoicedAt?.getTime() ?? 0) - (a.invoicedAt?.getTime() ?? 0))
  );

  /** Conteos para badges del menú. */
  readonly pedidosRecibidosCount = computed(() => this.pedidosRecibidos().length);
  readonly produccionPorProducir = computed(() => this.produccionQueue().filter(o => o.status === 'pending').length);
  readonly pedidosPorDespacharCount = computed(() => this.pedidosPorDespachar().length);
  readonly pedidosPorFacturarCount = computed(() => this.pedidosPorFacturar().length);

  // ----- Pedidos recurrentes (plantillas por cliente) -----

  readonly recurringOrders = this._recurringOrders.asReadonly();

  recurringOrdersFor(customerId: string): RecurringOrder[] {
    return this._recurringOrders()
      .filter(r => r.customerId === customerId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  createRecurringOrder(input: {
    customerId: string; label?: string; weekdays: number[]; items: RecurringOrderItem[];
  }): RecurringOrder {
    const items = input.items.filter(i => i.qty > 0);
    if (items.length === 0) throw new Error('Agrega al menos un producto.');
    if (input.weekdays.length === 0) throw new Error('Elige al menos un día de la semana.');
    const ro: RecurringOrder = {
      id: `rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      customerId: input.customerId,
      label: input.label?.trim() || undefined,
      weekdays: [...input.weekdays].sort((a, b) => a - b),
      items,
      active: true,
      createdAt: new Date(),
    };
    this._recurringOrders.update(list => [ro, ...list]);
    return ro;
  }

  deleteRecurringOrder(id: string): void {
    this._recurringOrders.update(list => list.filter(r => r.id !== id));
  }

  /**
   * Genera un pedido real a partir de una plantilla recurrente. La fecha de
   * entrega es el próximo día (desde hoy) que coincida con sus weekdays.
   */
  generateRecurringOrder(id: string, userId: string, userName: string): CustomerOrder {
    const ro = this._recurringOrders().find(r => r.id === id);
    if (!ro) throw new Error('Pedido recurrente no encontrado.');
    const customer = this.customerById(ro.customerId);
    const items = ro.items
      .filter(i => i.qty > 0)
      .map(i => ({ productId: i.productId, qty: i.qty, unitPrice: this.priceForCustomer(customer, i.productId) }));
    if (items.length === 0) throw new Error('La plantilla no tiene productos.');
    const order = this.createOrder({
      customerId: ro.customerId,
      items,
      requestedDeliveryDate: this.nextWeekdayDate(ro.weekdays),
      notes: ro.label ? `Recurrente: ${ro.label}` : 'Pedido recurrente',
      userId, userName,
    });
    this._recurringOrders.update(list => list.map(r => r.id === id ? { ...r, lastGeneratedAt: new Date() } : r));
    return order;
  }

  /** Próxima fecha (desde hoy, inclusive) que cae en alguno de los weekdays. */
  private nextWeekdayDate(weekdays: number[]): Date {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    if (weekdays.length === 0) return d;
    for (let i = 0; i < 14; i++) {
      if (weekdays.includes(d.getDay())) return new Date(d);
      d.setDate(d.getDate() + 1);
    }
    return new Date();
  }

  // ----- Reserva (control informativo de Producción; NO afecta stock) -----

  readonly reservas = this._reservas.asReadonly();

  addReserva(input: { productId: string; qty: number; note?: string; userName: string }): ReservaItem {
    const qty = Math.max(1, Math.floor(input.qty || 0));
    const product = this.productById(input.productId);
    if (!product) throw new Error('Producto no encontrado.');
    const r: ReservaItem = {
      id: `res-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      productId: input.productId,
      productName: product.name,
      qty,
      note: input.note?.trim() || undefined,
      createdAt: new Date(),
      createdBy: input.userName,
    };
    this._reservas.update(list => [r, ...list]);
    return r;
  }

  updateReserva(id: string, patch: { qty?: number; note?: string }): void {
    this._reservas.update(list => list.map(r => r.id === id ? {
      ...r,
      qty: patch.qty != null ? Math.max(1, Math.floor(patch.qty)) : r.qty,
      note: patch.note !== undefined ? (patch.note.trim() || undefined) : r.note,
    } : r));
  }

  removeReserva(id: string): void {
    this._reservas.update(list => list.filter(r => r.id !== id));
  }

  // ----- KPIs computed -----
  readonly totalProducts = computed(() => this._products().filter(p => p.active).length);
  readonly totalSupplies = computed(() => this._supplies().filter(s => s.active).length);

  readonly itemsNeedingPurchase = computed(() => {
    const supplyBad = this._supplyStock().filter(s => s.status !== 'available').length;
    const productBad = this._productStock().filter(s => s.status !== 'available').length;
    return supplyBad + productBad;
  });

  readonly unitsToBuy = computed(() => {
    const supplies = this._supplies();
    let total = 0;
    for (const stock of this._supplyStock()) {
      if (stock.status === 'available') continue;
      const sup = supplies.find(s => s.id === stock.supplyId);
      if (!sup) continue;
      total += Math.max(0, sup.maxStock - stock.quantity);
    }
    return Math.round(total);
  });

  readonly inTransitOrders = computed(() =>
    this._pos().filter(po => po.status === 'pending').length
  );

  readonly inTransitUnits = computed(() => {
    let total = 0;
    for (const po of this._pos()) {
      if (po.status !== 'pending') continue;
      total += po.items.reduce((s, it) => s + it.qty, 0);
    }
    return total;
  });

  readonly activeAlerts = computed(() =>
    this._alerts().filter(a => a.status === 'active')
  );

  readonly alertsHighPriority = computed(() =>
    this.activeAlerts().filter(a => a.priority === 'high').length
  );
  readonly alertsMediumPriority = computed(() =>
    this.activeAlerts().filter(a => a.priority === 'medium').length
  );
  readonly alertsLowPriority = computed(() =>
    this.activeAlerts().filter(a => a.priority === 'low').length
  );

  // ----- Lookups -----
  productById(id: string): Product | undefined {
    return this._products().find(p => p.id === id);
  }

  supplyById(id: string): Supply | undefined {
    return this._supplies().find(s => s.id === id);
  }

  recipeFor(productId: string): Recipe | undefined {
    return this._recipes().find(r => r.productId === productId);
  }

  /**
   * Explosión recursiva de Bill of Materials.
   *
   * Para un producto con receta, devuelve dos listas planas:
   *  - `supplyNeeds`: insumos crudos consumidos (descontados del stock de insumos)
   *  - `reventaNeeds`: subproductos de reventa (sin receta) que deben descontarse
   *    del stock del producto. Los subproductos CON receta se expanden a sus
   *    insumos base recursivamente.
   *
   * Útil para `registerSale` (descontar stock correctamente) y para calcular
   * consumo real cuando hay cadenas multi-nivel (Sandwich → Pan → harina).
   */
  explodeBom(productId: string, qty: number, visited: Set<string> = new Set()): {
    supplyNeeds: { supplyId: string; itemName: string; qty: number }[];
    reventaNeeds: { productId: string; itemName: string; qty: number }[];
  } {
    const supplyMap = new Map<string, { itemName: string; qty: number }>();
    const reventaMap = new Map<string, { itemName: string; qty: number }>();

    const accumulate = (mapTarget: Map<string, { itemName: string; qty: number }>,
                       id: string, name: string, q: number) => {
      const prev = mapTarget.get(id);
      if (prev) prev.qty += q;
      else mapTarget.set(id, { itemName: name, qty: q });
    };

    const walk = (prodId: string, multiplier: number, path: Set<string>) => {
      if (path.has(prodId)) return; // ciclo
      const recipe = this.recipeFor(prodId);
      if (!recipe || recipe.yieldQty <= 0) return;
      const nextPath = new Set(path); nextPath.add(prodId);
      const factor = multiplier / recipe.yieldQty;

      for (const item of recipe.items) {
        const needQty = item.qty * factor;
        if (item.supplyId) {
          const sup = this.supplyById(item.supplyId);
          if (!sup) continue;
          accumulate(supplyMap, item.supplyId, item.itemName, needQty);
        } else if (item.productId) {
          const subProduct = this.productById(item.productId);
          if (!subProduct) continue;
          if (subProduct.hasRecipe) {
            // Subproducto fabricado → seguir expandiendo recursivamente
            walk(item.productId, needQty, nextPath);
          } else {
            // Subproducto de reventa → consume del stock del producto
            accumulate(reventaMap, item.productId, item.itemName, needQty);
          }
        }
      }
    };

    walk(productId, qty, visited);

    return {
      supplyNeeds: Array.from(supplyMap, ([supplyId, v]) => ({ supplyId, itemName: v.itemName, qty: v.qty })),
      reventaNeeds: Array.from(reventaMap, ([pid, v]) => ({ productId: pid, itemName: v.itemName, qty: v.qty })),
    };
  }

  /**
   * Costo unitario de fabricación de un producto con receta.
   *  - Suma costo de cada item: insumo → supply.cost × qty;
   *    subproducto → effectiveProductCost(subProd) × qty
   *  - Divide por el yield (cantidad que rinde la receta)
   *  - Recursivo: si un subproducto tiene receta, se evalúa también
   *  - Detecta ciclos (A usa B, B usa A) para evitar loop infinito
   *
   * Reactivo: depende de signals (_recipes, _supplies, _products).
   */
  computeRecipeCost(productId: string, visited: Set<string> = new Set()): number | null {
    if (visited.has(productId)) {
      // Ciclo detectado — corta la recursión devolviendo 0 (mejor que NaN o crash).
      return 0;
    }
    const recipe = this.recipeFor(productId);
    if (!recipe || recipe.yieldQty <= 0) return null;
    const nextVisited = new Set(visited);
    nextVisited.add(productId);

    let total = 0;
    for (const item of recipe.items) {
      if (item.supplyId) {
        const supply = this.supplyById(item.supplyId);
        if (!supply) continue;
        total += supply.cost * item.qty;
      } else if (item.productId) {
        // Subproducto: si tiene receta, recursión; si es reventa, usa buyPrice
        const subProduct = this.productById(item.productId);
        if (!subProduct) continue;
        let unitCost: number;
        if (subProduct.hasRecipe) {
          unitCost = this.computeRecipeCost(item.productId, nextVisited) ?? 0;
        } else {
          unitCost = subProduct.buyPrice;
        }
        // Incluir mano de obra/otros del subproducto en su costo unitario.
        unitCost += subProduct.otherCost ?? 0;
        total += unitCost * item.qty;
      }
    }
    return +(total / recipe.yieldQty).toFixed(2);
  }

  /**
   * Costo efectivo de un producto:
   *  - Si tiene receta → costo calculado desde insumos
   *  - Si no tiene receta (reventa) → buyPrice almacenado
   */
  effectiveProductCost(productId: string): number {
    const product = this.productById(productId);
    if (!product) return 0;
    const materials = product.hasRecipe
      ? (this.computeRecipeCost(productId) ?? product.buyPrice)
      : product.buyPrice;
    // Costo total = materiales + otros (mano de obra, empaque, etc.).
    return +(materials + (product.otherCost ?? 0)).toFixed(2);
  }

  supplyStockFor(supplyId: string): SupplyStockItem | undefined {
    return this._supplyStock().find(s => s.supplyId === supplyId);
  }

  productStockFor(productId: string): StockItem | undefined {
    return this._productStock().find(s => s.productId === productId);
  }

  kardexFor(itemId: string): KardexEntry[] {
    return this._kardex()
      .filter(k => k.supplyId === itemId || k.productId === itemId)
      .sort((a, b) => b.at.getTime() - a.at.getTime());
  }

  recentKardex(limit = 50): KardexEntry[] {
    return [...this._kardex()]
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice(0, limit);
  }

  // ============================================================
  //  Alertas
  // ============================================================
  acknowledgeAlert(id: string, byName: string) {
    this._alerts.update(list => list.map(a =>
      a.id === id ? { ...a, status: 'acknowledged' as const, acknowledgedAt: new Date(), acknowledgedBy: byName } : a
    ));
  }

  resolveAlert(id: string, byName: string) {
    this._alerts.update(list => list.map(a =>
      a.id === id ? { ...a, status: 'resolved' as const, resolvedAt: new Date(), resolvedBy: byName } : a
    ));
  }

  // ============================================================
  //  Productos
  // ============================================================
  createProduct(input: Omit<Product, 'id'>): Product {
    const product: Product = { ...input, id: `p-${Date.now()}` };
    this._products.update(list => [...list, product]);
    if (!product.hasRecipe) {
      this._productStock.update(list => [...list, {
        id: product.id,
        productId: product.id,
        quantity: 0,
        reservedQty: 0,
        status: 'out' as StockStatus,
      }]);
      this.regenerateAutoAlerts();
    }
    return product;
  }

  updateProduct(p: Product) {
    this._products.update(list => list.map(x => x.id === p.id ? p : x));
  }

  /** Asigna (o limpia, con null) el código CABYS de un producto, con su tasa de IVA. */
  setProductCabys(productId: string, code: string | null, desc: string | null, iva: number | null) {
    const p = this.productById(productId);
    if (!p) return;
    this.updateProduct({
      ...p,
      cabysCode: code ?? undefined,
      cabysDesc: desc ?? undefined,
      cabysIva: iva ?? undefined,
    });
  }

  deleteProduct(id: string) {
    this._products.update(list => list.map(x => x.id === id ? { ...x, active: false } : x));
    this._recipes.update(list => list.filter(r => r.productId !== id));
    this._productStock.update(list => list.filter(s => s.productId !== id));
  }

  /** Crea N productos en una sola actualización del signal. Para los de reventa
   * (hasRecipe=false) también crea su stock inicial en 0. */
  createProductsBulk(inputs: Omit<Product, 'id'>[]) {
    const base = Date.now();
    const items: Product[] = inputs.map((input, i) => ({ ...input, id: `p-${base}-${i}` }));
    this._products.update(list => [...list, ...items]);
    const reventaItems = items.filter(p => !p.hasRecipe);
    if (reventaItems.length > 0) {
      this._productStock.update(list => [
        ...list,
        ...reventaItems.map(p => ({
          id: p.id,
          productId: p.id,
          quantity: 0,
          reservedQty: 0,
          status: 'out' as StockStatus,
        })),
      ]);
      this.regenerateAutoAlerts();
    }
  }

  // ============================================================
  //  Insumos
  // ============================================================
  createSupply(input: Omit<Supply, 'id'>): Supply {
    const supply: Supply = { ...input, id: `s-${Date.now()}` };
    this._supplies.update(list => [...list, supply]);
    this._supplyStock.update(list => [
      ...list,
      {
        id: supply.id,
        supplyId: supply.id,
        quantity: 0,
        status: 'out' as StockStatus,
      },
    ]);
    return supply;
  }

  updateSupply(s: Supply) {
    this._supplies.update(list => list.map(x => x.id === s.id ? s : x));
    this._supplyStock.update(list => list.map(st =>
      st.supplyId === s.id
        ? { ...st, status: this.computeStatus(st.quantity, s.reorderPoint, s.minStock) }
        : st
    ));
  }

  deleteSupply(id: string) {
    this._supplies.update(list => list.map(x => x.id === id ? { ...x, active: false } : x));
    this._supplyStock.update(list => list.filter(s => s.supplyId !== id));
  }

  /** Días de cobertura de un insumo: cuántos días dura el stock al consumo (7d). */
  supplyCoverageDays(supplyId: string): number {
    const stock = this.supplyStockFor(supplyId)?.quantity ?? 0;
    const daily = this.rollingMean('supply', supplyId, 7);
    return daily > 0 ? +(stock / daily).toFixed(1) : Infinity;
  }

  /** Fija el punto de reorden de un insumo (auto-tuneo desde la predicción). */
  updateSupplyReorderPoint(supplyId: string, reorderPoint: number): void {
    const s = this.supplyById(supplyId);
    if (!s) return;
    this.updateSupply({ ...s, reorderPoint: Math.max(0, Math.round(reorderPoint)) });
  }

  /** Crea N insumos + sus filas de stock inicial en cero. */
  createSuppliesBulk(inputs: Omit<Supply, 'id'>[]): Supply[] {
    const base = Date.now();
    const items: Supply[] = inputs.map((input, i) => ({ ...input, id: `s-${base}-${i}` }));
    this._supplies.update(list => [...list, ...items]);
    this._supplyStock.update(list => [
      ...list,
      ...items.map(s => ({
        id: s.id,
        supplyId: s.id,
        quantity: 0,
        status: 'out' as StockStatus,
      })),
    ]);
    return items;
  }

  // ============================================================
  //  Recetas
  // ============================================================
  saveRecipe(recipe: Recipe) {
    const exists = this._recipes().some(r => r.id === recipe.id);
    if (exists) {
      this._recipes.update(list => list.map(r => r.id === recipe.id ? recipe : r));
    } else {
      this._recipes.update(list => [...list, recipe]);
    }
    this._products.update(list => list.map(p =>
      p.id === recipe.productId ? { ...p, hasRecipe: true } : p
    ));
  }

  deleteRecipe(productId: string) {
    this._recipes.update(list => list.filter(r => r.productId !== productId));
    this._products.update(list => list.map(p =>
      p.id === productId ? { ...p, hasRecipe: false } : p
    ));
  }

  /**
   * Crea/reemplaza N recetas en bulk. Cada receta es independiente; si ya existe
   * para el producto se reemplaza. Marca todos los productos correspondientes como hasRecipe.
   */
  saveRecipesBulk(recipes: Recipe[]) {
    const productIds = new Set(recipes.map(r => r.productId));
    this._recipes.update(list => {
      const filtered = list.filter(r => !productIds.has(r.productId));
      return [...filtered, ...recipes];
    });
    this._products.update(list => list.map(p =>
      productIds.has(p.id) ? { ...p, hasRecipe: true } : p
    ));
  }

  // ============================================================
  //  Órdenes de Compra
  // ============================================================
  createPurchaseOrder(input: Omit<PurchaseOrder, 'id' | 'code' | 'createdAt'>): PurchaseOrder {
    const id = `po-${Date.now()}`;
    const code = `OC-${new Date().getFullYear()}-${Math.floor(Date.now() / 1000) % 10000}`;
    const po: PurchaseOrder = {
      ...input,
      id,
      code,
      createdAt: new Date(),
    };
    this._pos.update(list => [po, ...list]);
    return po;
  }

  updatePurchaseOrderStatus(id: string, status: POStatus, userName: string, userId: string) {
    const po = this._pos().find(p => p.id === id);
    if (!po) return;

    if (status === 'received' && po.status === 'pending') {
      for (const it of po.items) {
        if (it.supplyId) {
          // Recepción de insumo
          const supply = this.supplyById(it.supplyId);
          if (!supply) continue;
          const stock = this.supplyStockFor(it.supplyId);
          const currentQty = stock?.quantity ?? 0;
          const newQty = currentQty + it.qty;
          const newStatus = this.computeStatus(newQty, supply.reorderPoint, supply.minStock);

          if (stock) {
            this._supplyStock.update(list => list.map(s =>
              s.id === stock.id ? { ...s, quantity: newQty, status: newStatus } : s
            ));
          } else {
            this._supplyStock.update(list => [...list, {
              id: it.supplyId!,
              supplyId: it.supplyId!,
              quantity: newQty,
              status: newStatus,
            }]);
          }

          this.registerKardexEntry({
            id: `k-${Date.now()}-${it.supplyId}`,
            supplyId: it.supplyId,
            itemName: supply.name,
            type: 'in',
            qty: it.qty,
            balance: newQty,
            cost: it.unitCost,
            reason: 'purchase',
            note: `OC ${po.code} recibida`,
            userId,
            userName,
            at: new Date(),
          });
        } else if (it.productId) {
          // Recepción de producto de reventa
          const product = this.productById(it.productId);
          if (!product || product.hasRecipe) continue;
          const stock = this.productStockFor(it.productId);
          const currentQty = stock?.quantity ?? 0;
          const newQty = currentQty + it.qty;
          const newStatus = this.computeProductStatus(newQty, product.reorderPoint, product.minStock);

          if (stock) {
            this._productStock.update(list => list.map(s =>
              s.id === stock.id ? { ...s, quantity: newQty, status: newStatus } : s
            ));
          } else {
            this._productStock.update(list => [...list, {
              id: it.productId!,
              productId: it.productId!,
              quantity: newQty,
              reservedQty: 0,
              status: newStatus,
            }]);
          }

          this.registerKardexEntry({
            id: `k-${Date.now()}-${it.productId}`,
            productId: it.productId,
            itemName: product.name,
            type: 'in',
            qty: it.qty,
            balance: newQty,
            cost: it.unitCost,
            reason: 'purchase',
            note: `OC ${po.code} recibida`,
            userId,
            userName,
            at: new Date(),
          });
        }
      }
      this.regenerateAutoAlerts();
    }

    this._pos.update(list => list.map(p =>
      p.id === id
        ? { ...p, status, receivedAt: status === 'received' ? new Date() : p.receivedAt, items: status === 'received'
            ? p.items.map(it => ({ ...it, receivedQty: it.qty }))
            : p.items }
        : p
    ));
  }

  deletePurchaseOrder(id: string) {
    this._pos.update(list => list.filter(p => p.id !== id));
  }

  // ============================================================
  //  Pre-compras (sugerencias automáticas — sin persistencia)
  // ============================================================

  /**
   * Cantidad de un insumo que ya viene en camino vía OCs pending. Se usa
   * para evitar sugerir insumos que ya están cubiertos por una OC abierta.
   */
  private pendingIncomingQtyForSupply(supplyId: string): number {
    let qty = 0;
    for (const po of this._pos()) {
      if (po.status !== 'pending') continue;
      for (const it of po.items) {
        if (it.supplyId === supplyId) qty += it.qty;
      }
    }
    return qty;
  }

  /**
   * Lista de OCs pendientes que contienen un insumo dado, con la cantidad
   * que viene y la fecha esperada de llegada (si está definida). Se usa
   * en la UI de insumos para mostrar "en camino" por tarjeta.
   * Ordenado por fecha esperada (más próxima primero).
   */
  pendingPOsForSupply(supplyId: string): Array<{
    poId: string;
    code: string;
    supplier: string;
    qty: number;
    expectedDate?: Date;
  }> {
    const out: Array<{ poId: string; code: string; supplier: string; qty: number; expectedDate?: Date }> = [];
    for (const po of this._pos()) {
      if (po.status !== 'pending') continue;
      const qty = po.items
        .filter(it => it.supplyId === supplyId)
        .reduce((s, it) => s + it.qty, 0);
      if (qty <= 0) continue;
      out.push({
        poId: po.id,
        code: po.code,
        supplier: po.supplier,
        qty,
        expectedDate: po.expectedDate,
      });
    }
    out.sort((a, b) => {
      const at = a.expectedDate?.getTime() ?? Infinity;
      const bt = b.expectedDate?.getTime() ?? Infinity;
      return at - bt;
    });
    return out;
  }

  /**
   * Pre-compras SUGERIDAS, calculadas en runtime.
   *
   * Algoritmo (por cada insumo activo):
   *  1. Stock efectivo = stock actual + pendientes en OCs abiertas.
   *  2. Demanda diaria = rolling mean(7d) del consumo en kardex.
   *  3. LT real = `supplyLeadTime(supplyId, hoy)` — del proveedor con
   *     entrega más temprana según su calendario semanal.
   *  4. Stock proyectado al arribo = stock efectivo - (demanda × LT).
   *  5. Se incluye si:
   *       - stock efectivo ≤ reorderPoint  (ya está bajo)  → `below_rop`
   *       - O stock al arribo ≤ minStock   (no aguanta el LT) → `wont_cover_lt`
   *  6. Cantidad sugerida = maxStock - stockAtArrival, redondeada a
   *     presentación entera si el insumo tiene una.
   *
   * Se agrupa por proveedor más rápido y se calcula totalCost / fechas.
   * **No se guarda nada.** El resultado cambia automáticamente al cambiar
   * stock, recibir OCs, o ajustar calendarios.
   */
  /**
   * Construye el item sugerido completo (con todos los datos derivados) a
   * partir de un insumo + supplierId + cantidad ya decidida. Se usa tanto
   * para los items auto-detectados como para los agregados a mano.
   */
  private buildSuggestedItem(
    supply: Supply,
    supplierId: string,
    qty: number,
    reason: SuggestedReason,
  ): SuggestedPrePurchaseItem {
    const currentStock = this.supplyStockFor(supply.id)?.quantity ?? 0;
    const pendingQty = this.pendingIncomingQtyForSupply(supply.id);
    const dailyDemand = this.rollingMean('supply', supply.id, 7) || 0;
    const daysUntilEmpty = dailyDemand > 0 ? currentStock / dailyDemand : Infinity;
    const unitCost = this.supplierUnitCost(supplierId, supply.id) || supply.cost;
    return {
      supplyId: supply.id,
      itemName: supply.name,
      unit: supply.unit,
      qty,
      unitCost,
      currentStock,
      pendingQty,
      reorderPoint: supply.reorderPoint,
      minStock: supply.minStock,
      dailyDemand,
      daysUntilEmpty,
      reason,
      manual: reason === 'manual',
    };
  }

  suggestedPrePurchases(today: Date = new Date()): SuggestedPrePurchase[] {
    const bucket = new Map<string, SuggestedPrePurchaseItem[]>();
    // Demanda conocida (plan semanal + pedidos) → pre-compras dirigidas por demanda.
    const demandMap = this.aggregateSupplyDemand(7);

    // --- 1. Items auto-detectados por el algoritmo de reposición ---
    for (const supply of this.activeSupplies()) {
      const lt = this.supplyLeadTime(supply.id, today);
      if (!lt) continue; // sin proveedores → no se puede sugerir

      const currentStock = this.supplyStockFor(supply.id)?.quantity ?? 0;
      const pendingQty = this.pendingIncomingQtyForSupply(supply.id);
      const effectiveStock = currentStock + pendingQty;

      const dailyDemand = this.rollingMean('supply', supply.id, 7) || 0;
      const consumeDuringLT = dailyDemand * lt.leadTimeDays;
      const stockAtArrival = effectiveStock - consumeDuringLT;

      // Demanda CONOCIDA (plan + pedidos) que el stock+pendiente no cubre.
      const demanda = demandMap.get(supply.id) ?? 0;
      const demandFaltante = Math.max(0, demanda - effectiveStock);

      // La demanda concreta manda; si no, los disparadores estadísticos.
      let reason: SuggestedReason | null = null;
      if (demandFaltante > 0) reason = 'demand';
      else if (effectiveStock <= supply.reorderPoint) reason = 'below_rop';
      else if (stockAtArrival <= supply.minStock && dailyDemand > 0) reason = 'wont_cover_lt';
      if (!reason) continue;

      // Comprar lo necesario para: cubrir la demanda faltante Y reabastecer hacia maxStock.
      const statTarget = Math.max(0, supply.maxStock - stockAtArrival);
      const rawTarget = Math.max(statTarget, demandFaltante);
      if (rawTarget <= 0) continue;

      // Redondear a presentación entera si el insumo tiene una (no tiene
      // sentido pedir 2.3 sacos: redondear hacia arriba).
      let qty: number;
      if (supply.presentation && supply.presentation.size > 0) {
        const packs = Math.ceil(rawTarget / supply.presentation.size);
        qty = packs * supply.presentation.size;
      } else {
        qty = Math.round(rawTarget * 100) / 100;
      }

      const item = this.buildSuggestedItem(supply, lt.supplierId, qty, reason);
      const list = bucket.get(lt.supplierId) ?? [];
      list.push(item);
      bucket.set(lt.supplierId, list);
    }

    // --- 2. Adiciones MANUALES del usuario (overlay) ---
    // Se agregan a la lista del proveedor correspondiente, evitando
    // duplicar items que ya estén en la sugerencia automática.
    const manual = this._manualAdditions();
    for (const supplierId of Object.keys(manual)) {
      const additions = manual[supplierId];
      if (!additions || additions.length === 0) continue;
      const list = bucket.get(supplierId) ?? [];
      const existingIds = new Set(list.map(i => i.supplyId));
      for (const add of additions) {
        if (existingIds.has(add.supplyId)) continue; // ya estaba auto
        const supply = this.supplyById(add.supplyId);
        if (!supply || !supply.active) continue;
        list.push(this.buildSuggestedItem(supply, supplierId, add.qty, 'manual'));
        existingIds.add(add.supplyId);
      }
      bucket.set(supplierId, list);
    }

    // --- 3. Materializar al shape final ---
    const result: SuggestedPrePurchase[] = [];
    for (const [supplierId, items] of bucket) {
      const sup = this.supplierById(supplierId);
      if (!sup) continue;
      const sLt = this.supplierLeadTime(supplierId, today);
      if (!sLt) continue;
      const totalCost = items.reduce((s, it) => s + it.qty * it.unitCost, 0);
      // Items más críticos primero; los manuales al final.
      items.sort((a, b) => {
        if (a.manual !== b.manual) return a.manual ? 1 : -1;
        return a.daysUntilEmpty - b.daysUntilEmpty;
      });
      result.push({
        supplierId,
        supplierName: sup.name,
        items,
        totalCost,
        nextOrderDate: sLt.nextOrderDate,
        nextDeliveryDate: sLt.nextDeliveryDate,
        leadTimeDays: sLt.leadTimeDays,
        fromCalendar: sLt.fromCalendar,
      });
    }
    result.sort((a, b) => a.leadTimeDays - b.leadTimeDays);
    return result;
  }

  /**
   * Agrega manualmente un insumo al carrito de pre-compra de un proveedor.
   * Si ya existe (sea auto o manual), no hace nada. Sólo permite items
   * que el proveedor entrega (Supplier.suppliedItems).
   */
  addManualPrePurchaseItem(supplierId: string, supplyId: string, qty: number): void {
    const sup = this.supplierById(supplierId);
    if (!sup) throw new Error('Proveedor no encontrado.');
    const supplies = sup.suppliedItems.some(i => i.kind === 'supply' && i.itemId === supplyId);
    if (!supplies) throw new Error('Este proveedor no entrega ese insumo.');
    if (qty <= 0) throw new Error('La cantidad debe ser mayor a cero.');
    this._manualAdditions.update(map => {
      const current = map[supplierId] ?? [];
      if (current.some(it => it.supplyId === supplyId)) return map; // ya está
      return { ...map, [supplierId]: [...current, { supplyId, qty }] };
    });
  }

  /** Quita un item manual del carrito de un proveedor. */
  removeManualPrePurchaseItem(supplierId: string, supplyId: string): void {
    this._manualAdditions.update(map => {
      const current = map[supplierId];
      if (!current) return map;
      const next = current.filter(it => it.supplyId !== supplyId);
      if (next.length === 0) {
        const { [supplierId]: _, ...rest } = map;
        return rest;
      }
      return { ...map, [supplierId]: next };
    });
  }

  /** Limpia todos los items manuales de un proveedor (post-aprobación). */
  private clearManualForSupplier(supplierId: string): void {
    this._manualAdditions.update(map => {
      if (!map[supplierId]) return map;
      const { [supplierId]: _, ...rest } = map;
      return rest;
    });
  }

  /**
   * Materializa la pre-compra sugerida de un proveedor como una OC real.
   * En la próxima consulta de `suggestedPrePurchases`, los insumos que
   * acaban de entrar en OC pending dejan de aparecer (ya están cubiertos).
   */
  approvePrePurchaseForSupplier(supplierId: string, today: Date = new Date()): PurchaseOrder {
    const all = this.suggestedPrePurchases(today);
    const pre = all.find(p => p.supplierId === supplierId);
    if (!pre) throw new Error('No hay sugerencia activa para ese proveedor.');
    if (pre.items.length === 0) throw new Error('La sugerencia no tiene items.');

    const po = this.createPurchaseOrder({
      supplier: pre.supplierName,
      status: 'pending',
      items: pre.items.map(it => ({
        supplyId: it.supplyId,
        itemName: it.itemName,
        qty: it.qty,
        unitCost: it.unitCost,
      })),
      totalCost: pre.totalCost,
      expectedDate: pre.nextDeliveryDate,
    });
    // Las adiciones manuales se materializaron en la OC: limpiamos.
    this.clearManualForSupplier(supplierId);
    return po;
  }

  // ============================================================
  //  Movimientos manuales de stock
  // ============================================================
  registerKardexEntry(entry: KardexEntry) {
    this._kardex.update(list => [entry, ...list]);
  }

  // ============================================================
  //  Urnas (vitrinas / puntos de venta — lado Ventas)
  //  La urna es una ubicación de stock SEPARADA del inventario central.
  // ============================================================

  urnaById(id: string): Urna | undefined {
    return this._urnas().find(u => u.id === id);
  }

  /** Lotes de una urna, ordenados por recepción (más reciente primero, para mostrar). */
  urnaLotesFor(urnaId: string): UrnaLote[] {
    return this._urnaLotes()
      .filter(l => l.urnaId === urnaId)
      .sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());
  }

  // ===== INVENTARIO ÚNICO =====
  // El "almacén/urna" ya no es un pozo separado: estos métodos operan sobre el
  // stock de producto central (`_productStock`). El POS y las pantallas de venta
  // siguen llamándolos, pero ahora todo es UN solo inventario.

  /** Cantidad de un producto en inventario (urnaId se ignora: inventario único). */
  urnaProductQty(_urnaId: string, productId: string): number {
    return this.productStockFor(productId)?.quantity ?? 0;
  }

  /** Totales por producto en inventario (stock > 0). */
  urnaProductTotals(_urnaId: string): { productId: string; productName: string; quantity: number }[] {
    return this._productStock()
      .filter(s => s.quantity > 0)
      .map(s => ({
        productId: s.productId,
        productName: this.productById(s.productId)?.name ?? s.productId,
        quantity: s.quantity,
      }))
      .sort((a, b) => a.productName.localeCompare(b.productName));
  }

  /** Descuenta `qty` de un producto del inventario único. El caller valida antes. */
  private consumeUrnaFifo(_urnaId: string, productId: string, qty: number): void {
    const stock = this.productStockFor(productId);
    if (!stock) return;
    const product = this.productById(productId);
    const after = Math.max(0, stock.quantity - qty);
    const status = this.computeProductStatus(after, product?.reorderPoint, product?.minStock);
    this._productStock.update(list => list.map(s =>
      s.productId === productId ? { ...s, quantity: after, status } : s));
  }

  /** Asegura que exista un StockItem para el producto (lo crea en 0 si falta). */
  private ensureProductStock(productId: string): void {
    if (this.productStockFor(productId)) return;
    this._productStock.update(list => [...list, {
      id: productId, productId, quantity: 0, reservedQty: 0, status: 'out' as StockStatus,
    }]);
  }

  /** Solicitudes de reposición (órdenes con urnaId) de una urna, recientes primero. */
  urnaOrders(urnaId: string): CustomerOrder[] {
    return this._orders().filter(o => o.urnaId === urnaId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  createUrna(input: { name: string; location?: string; responsible?: string; notes?: string }): Urna {
    const urna: Urna = {
      id: `urna-${Date.now()}`,
      name: input.name.trim(),
      location: input.location?.trim() || undefined,
      responsible: input.responsible?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
      active: true,
      createdAt: new Date(),
    };
    this._urnas.update(list => [urna, ...list]);
    return urna;
  }

  updateUrna(id: string, patch: Partial<Omit<Urna, 'id' | 'createdAt'>>): void {
    this._urnas.update(list => list.map(u => u.id === id ? { ...u, ...patch } : u));
  }

  deleteUrna(id: string): void {
    this._urnas.update(list => list.filter(u => u.id !== id));
    this._urnaLotes.update(list => list.filter(l => l.urnaId !== id));
  }

  /**
   * Ventas crea una SOLICITUD DE REPOSICIÓN para una urna: una orden interna
   * con urnaId que entra a la cola de Producción. unitPrice = 0 (no es venta).
   */
  requestUrnaReplenishment(input: {
    urnaId: string;
    items: { productId: string; qty: number }[];
    requestedDeliveryDate?: Date;
    notes?: string;
    userId: string;
    userName: string;
  }): CustomerOrder {
    const urna = this.urnaById(input.urnaId);
    if (!urna) throw new Error('Urna no encontrada.');
    const items = input.items.filter(it => it.qty > 0);
    if (items.length === 0) throw new Error('Agrega al menos un producto con cantidad.');
    return this.createOrder({
      urnaId: input.urnaId,
      items: items.map(it => ({ productId: it.productId, qty: it.qty, unitPrice: 0 })),
      purpose: `Reposición urna ${urna.name}`,
      notes: input.notes,
      requestedDeliveryDate: input.requestedDeliveryDate,
      userId: input.userId,
      userName: input.userName,
    });
  }

  /**
   * Entrega a la urna lo producido por una orden de reposición ya completada:
   * mueve fulfilledQty del stock central a la urna creando un NUEVO LOTE con la
   * fecha de recepción. Registra kardex `urna_in` por producto.
   */
  deliverOrderToUrna(orderId: string, userId: string, userName: string): CustomerOrder {
    const order = this.orderById(orderId);
    if (!order) throw new Error('Orden no encontrada.');
    if (!order.urnaId) throw new Error('La orden no tiene urna de destino.');
    if (order.status !== 'completed') throw new Error('Solo se entrega a la urna una orden completada por producción.');
    if (order.deliveredToUrnaAt) throw new Error('Esta orden ya fue entregada a la urna.');

    const now = new Date();
    const lines: UrnaLoteLine[] = [];
    for (const it of order.items) {
      if (it.fulfilledQty <= 0) continue;
      const product = this.productById(it.productId);
      // Descontar del stock central lo que se despacha a la urna (clamp a lo disponible).
      const central = this.productStockFor(it.productId);
      const move = Math.min(it.fulfilledQty, central?.quantity ?? 0);
      if (central && move > 0) {
        const afterOut = central.quantity - move;
        const newStatus = this.computeProductStatus(afterOut, product?.reorderPoint, product?.minStock);
        this._productStock.update(list => list.map(s =>
          s.productId === it.productId ? { ...s, quantity: afterOut, status: newStatus } : s));
      }
      lines.push({ productId: it.productId, productName: it.productName, qty: it.fulfilledQty });
      this.registerKardexEntry({
        id: `k-${Date.now()}-${it.productId}-uin`,
        productId: it.productId, itemName: it.productName,
        type: 'out', qty: it.fulfilledQty, balance: it.fulfilledQty,
        cost: this.effectiveProductCost(it.productId),
        reason: 'urna_in',
        note: `Entrega a urna ${order.urnaName} — lote orden ${order.code}`,
        userId, userName, at: now,
      });
    }
    // Crear el lote en la urna con lo recibido.
    if (lines.length > 0) {
      const lote: UrnaLote = {
        id: `lote-${Date.now()}`,
        urnaId: order.urnaId,
        code: order.code,
        receivedAt: now,
        orderId: order.id,
        orderCode: order.code,
        lines,
      };
      this._urnaLotes.update(list => [lote, ...list]);
    }
    const updated: CustomerOrder = { ...order, deliveredToUrnaAt: now };
    this._orders.update(list => list.map(o => o.id === orderId ? updated : o));
    return updated;
  }

  /** Registra una venta de un producto desde una urna (POS). */
  registerUrnaSale(input: { urnaId: string; productId: string; qty: number; userId: string; userName: string }): void {
    const { urnaId, productId } = input;
    const qty = Math.floor(input.qty);
    if (qty <= 0) throw new Error('La cantidad debe ser mayor a cero.');
    const available = this.urnaProductQty(urnaId, productId);
    if (qty > available) throw new Error(`Solo hay ${available} unidad(es) en la urna.`);
    const product = this.productById(productId);
    this.consumeUrnaFifo(urnaId, productId, qty);
    this.registerKardexEntry({
      id: `k-${Date.now()}-${productId}-usale`,
      productId, itemName: product?.name ?? productId,
      type: 'out', qty, balance: this.urnaProductQty(urnaId, productId),
      cost: this.effectiveProductCost(productId),
      reason: 'urna_sale',
      note: `Venta en urna ${this.urnaById(urnaId)?.name ?? urnaId} (FIFO)`,
      userId: input.userId, userName: input.userName, at: new Date(),
    });
  }

  /** Registra merma de un producto en una urna (vencido/dañado en vitrina). */
  registerUrnaMerma(input: {
    urnaId: string; productId: string; qty: number;
    reason: ProductionMermaReason; reasonText?: string;
    userId: string; userName: string;
  }): ReturnedLot {
    const { urnaId, productId } = input;
    const qty = Math.floor(input.qty);
    if (qty <= 0) throw new Error('La cantidad debe ser mayor a cero.');
    const available = this.urnaProductQty(urnaId, productId);
    if (qty > available) throw new Error(`Solo hay ${available} unidad(es) en la urna.`);
    const product = this.productById(productId);
    const urna = this.urnaById(urnaId);
    const now = new Date();
    this.consumeUrnaFifo(urnaId, productId, qty);
    this.registerKardexEntry({
      id: `k-${Date.now()}-${productId}-umerma`,
      productId, itemName: product?.name ?? productId,
      type: 'out', qty, balance: this.urnaProductQty(urnaId, productId),
      cost: this.effectiveProductCost(productId),
      reason: 'urna_merma',
      note: `Merma en urna ${urna?.name ?? urnaId} (FIFO)`,
      userId: input.userId, userName: input.userName, at: now,
    });
    const lot: ReturnedLot = {
      id: `lot-${Date.now()}-urna`,
      kind: 'urna',
      productId, productName: product?.name ?? productId,
      unit: product?.unit ?? 'unidad',
      qty, mermaQty: qty,
      productionReason: input.reason,
      productionReasonText: input.reasonText?.trim() || undefined,
      urnaId, urnaName: urna?.name,
      createdAt: now, status: 'reviewed', reviewedAt: now, reviewedBy: input.userName,
    };
    this._returnedLots.update(list => [lot, ...list]);
    return lot;
  }

  /** Id del almacén único de Ventas. */
  almacenId(): string { return this.almacen()?.id ?? ''; }

  /** Tickets del POS de un almacén, recientes primero. */
  posSalesFor(almacenId: string): PosSale[] {
    return this._posSales()
      .filter(s => s.almacenId === almacenId)
      .sort((a, b) => b.at.getTime() - a.at.getTime());
  }

  /**
   * Registra una venta 1 a 1 (ticket con varias líneas) en el POS. Valida el
   * stock de TODAS las líneas antes de descontar, consume FIFO de los lotes del
   * almacén y registra kardex `urna_sale` por línea. Devuelve el ticket.
   */
  // ----- Plan de producción semanal recurrente -----
  readonly weeklyProductionPlan = this._weeklyPlan.asReadonly();
  /** Lista del plan para un día de la semana (0=Dom … 6=Sáb). */
  weeklyPlanFor(weekday: number): WeeklyPlanItem[] {
    return this._weeklyPlan()[weekday] ?? [];
  }
  /** Configura (reemplaza) la lista de un día de la semana. */
  setWeeklyProductionDay(weekday: number, items: WeeklyPlanItem[]): void {
    this._weeklyPlan.update(p => ({ ...p, [weekday]: items.filter(i => i.qty > 0) }));
  }
  /** Lista de producción de HOY, derivada directamente del plan semanal. */
  readonly produccionDeHoy = computed(() => this._weeklyPlan()[new Date().getDay()] ?? []);

  /**
   * COBERTURA DE INSUMOS: agrega la DEMANDA (pedidos de cliente en cola de
   * producción + plan semanal de los próximos 7 días), explota recetas a insumos,
   * y compara contra el stock de insumos disponible. Permite saber si alcanza
   * para completar los pedidos y cuánto falta comprar.
   */
  /**
   * Demanda agregada de INSUMOS para los próximos `dias` días: explota a insumos
   * los pedidos de cliente en cola de producción + el plan semanal. Es la base
   * para la cobertura y para las pre-compras dirigidas por demanda.
   */
  aggregateSupplyDemand(dias = 7): Map<string, number> {
    const need = new Map<string, number>();
    const add = (productId: string, qty: number) => {
      if (qty <= 0) return;
      for (const n of this.explodeBom(productId, qty).supplyNeeds) {
        need.set(n.supplyId, (need.get(n.supplyId) ?? 0) + n.qty);
      }
    };
    // Demanda: pedidos de cliente / reposición en cola de producción
    for (const o of this.produccionQueue()) {
      if (o.status !== 'pending' && o.status !== 'in_production') continue;
      for (const it of o.items) {
        const remaining = o.status === 'in_production' ? Math.max(0, it.qty - it.fulfilledQty) : it.qty;
        add(it.productId, remaining);
      }
    }
    // Demanda: plan semanal proyectado sobre los próximos `dias` días
    const plan = this._weeklyPlan();
    const base = new Date(); base.setHours(0, 0, 0, 0);
    for (let i = 0; i < dias; i++) {
      const wd = new Date(base.getTime() + i * 86_400_000).getDay();
      for (const it of (plan[wd] ?? [])) add(it.productId, it.qty);
    }
    return need;
  }

  readonly coberturaInsumos = computed(() => {
    const need = this.aggregateSupplyDemand(7);
    return [...need.entries()].map(([supplyId, qty]) => {
      const sup = this.supplyById(supplyId);
      const available = this.supplyStockFor(supplyId)?.quantity ?? 0;
      const faltante = Math.max(0, qty - available);
      return {
        supplyId,
        name: sup?.name ?? supplyId,
        unit: sup?.unit ?? '',
        cost: sup?.cost ?? 0,
        requerido: +qty.toFixed(2),
        disponible: available,
        faltante: +faltante.toFixed(2),
        suficiente: faltante <= 0,
      };
    }).sort((a, b) => b.faltante - a.faltante || a.name.localeCompare(b.name));
  });

  /** Insumos que NO alcanzan para la demanda actual (hay que comprar). */
  readonly insumosFaltantes = computed(() => this.coberturaInsumos().filter(c => !c.suficiente));

  readonly planDeliveries = this._planDeliveries.asReadonly();
  private isoOf(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  /** ¿Ya se entregó al almacén el plan de esa fecha? */
  planEntregadoDe(date: Date): { at: Date; total: number } | undefined {
    return this._planDeliveries()[this.isoOf(date)];
  }

  /**
   * Producción PRODUCE el plan de un día: por cada producto del plan explota su
   * receta, DESCUENTA los insumos del inventario de insumos (y subproductos de
   * reventa), y SUMA el producto terminado al inventario único. Registra kardex.
   * Idempotente por fecha (no doble producción).
   */
  entregarPlanDelDia(date: Date, ctx: { userId: string; userName: string }): { total: number } {
    const iso = this.isoOf(date);
    if (this._planDeliveries()[iso]) throw new Error('El plan de este día ya fue producido.');
    const items = (this._weeklyPlan()[date.getDay()] ?? []).filter(i => i.qty > 0);
    if (items.length === 0) throw new Error('No hay plan configurado para este día.');

    const now = new Date();
    let total = 0;
    for (const it of items) {
      this.producirProducto(it.productId, it.qty, ctx, `Plan ${iso}`, now);
      total += it.qty;
    }
    this._planDeliveries.update(m => ({ ...m, [iso]: { at: now, total } }));
    return { total };
  }

  /**
   * Fabrica `qty` de un producto: explota receta, descuenta insumos + subproductos
   * de reventa del inventario, y suma el producto terminado al stock. Hace clamp a
   * lo disponible (no bloquea); usa la cobertura de insumos para avisar antes.
   */
  private producirProducto(productId: string, qty: number, ctx: { userId: string; userName: string }, note: string, now: Date): void {
    const { supplyNeeds, reventaNeeds } = this.explodeBom(productId, qty);
    // Descontar insumos
    for (const need of supplyNeeds) {
      const sup = this.supplyById(need.supplyId);
      const stock = this.supplyStockFor(need.supplyId);
      const after = Math.max(0, (stock?.quantity ?? 0) - need.qty);
      if (stock && sup) {
        const status = this.computeStatus(after, sup.reorderPoint, sup.minStock);
        this._supplyStock.update(list => list.map(s => s.id === stock.id ? { ...s, quantity: after, status } : s));
      }
      this.registerKardexEntry({
        id: `k-${Date.now()}-${need.supplyId}-prod`,
        supplyId: need.supplyId, itemName: need.itemName,
        type: 'out', qty: need.qty, balance: after,
        cost: sup?.cost ?? 0, reason: 'production',
        note: `${note} — produce ${this.productById(productId)?.name ?? productId}`,
        userId: ctx.userId, userName: ctx.userName, at: now,
      });
    }
    // Descontar subproductos de reventa del stock de producto
    for (const rev of reventaNeeds) {
      this.consumeUrnaFifo('', rev.productId, rev.qty);
    }
    // Sumar el producto terminado al inventario único
    this.ensureProductStock(productId);
    const product = this.productById(productId);
    const cur = this.productStockFor(productId);
    const newQty = (cur?.quantity ?? 0) + qty;
    const status = this.computeProductStatus(newQty, product?.reorderPoint, product?.minStock);
    this._productStock.update(list => list.map(s => s.productId === productId ? { ...s, quantity: newQty, status } : s));
    this.registerKardexEntry({
      id: `k-${Date.now()}-${productId}-pin`,
      productId, itemName: product?.name ?? productId,
      type: 'in', qty, balance: newQty,
      cost: this.effectiveProductCost(productId),
      reason: 'production', note,
      userId: ctx.userId, userName: ctx.userName, at: now,
    });
  }

  // ----- Clientes del punto de venta (receptores de factura) -----
  readonly posClientes = this._posClientes.asReadonly();
  posClienteById(id: string): PosCliente | undefined {
    return this._posClientes().find(c => c.id === id);
  }
  createPosCliente(input: Omit<PosCliente, 'id' | 'createdAt'>): PosCliente {
    const c: PosCliente = { ...input, id: `posc-${Date.now()}`, createdAt: new Date() };
    this._posClientes.update(list => [c, ...list]);
    return c;
  }
  updatePosCliente(c: PosCliente) {
    this._posClientes.update(list => list.map(x => x.id === c.id ? c : x));
  }
  deletePosCliente(id: string) {
    this._posClientes.update(list => list.map(x => x.id === id ? { ...x, active: false } : x));
  }

  registerPosSale(input: {
    almacenId: string;
    lines: { productId: string; qty: number }[];
    paymentMethod: PaymentMethod;
    comprobante: ComprobanteTipo;
    customerId?: string;
    userId: string;
    userName: string;
  }): PosSale {
    if (input.comprobante === 'factura') {
      const cust = input.customerId ? this.posClienteById(input.customerId) : undefined;
      if (!cust) throw new Error('Selecciona el cliente para la factura electrónica.');
    }
    const almacenId = input.almacenId;
    if (!this.urnaById(almacenId)) throw new Error('Almacén no encontrado.');
    const clean = input.lines
      .map(l => ({ productId: l.productId, qty: Math.floor(l.qty) }))
      .filter(l => l.qty > 0);
    if (clean.length === 0) throw new Error('Agrega al menos un producto al ticket.');
    // Validar disponibilidad de todas las líneas ANTES de descontar nada.
    for (const l of clean) {
      const avail = this.urnaProductQty(almacenId, l.productId);
      if (l.qty > avail) {
        const name = this.productById(l.productId)?.name ?? l.productId;
        throw new Error(`Stock insuficiente de ${name}: hay ${avail}, pides ${l.qty}.`);
      }
    }
    const now = new Date();
    const saleLines: PosSaleLine[] = [];
    for (const l of clean) {
      const product = this.productById(l.productId);
      const unitPrice = this.consumerPriceConIva(l.productId); // precio real con IVA
      this.consumeUrnaFifo(almacenId, l.productId, l.qty);
      saleLines.push({
        productId: l.productId, productName: product?.name ?? l.productId,
        qty: l.qty, unitPrice, lineTotal: l.qty * unitPrice,
      });
      this.registerKardexEntry({
        id: `k-${Date.now()}-${l.productId}-pos`,
        productId: l.productId, itemName: product?.name ?? l.productId,
        type: 'out', qty: l.qty, balance: this.urnaProductQty(almacenId, l.productId),
        cost: this.effectiveProductCost(l.productId),
        reason: 'urna_sale',
        note: 'Venta POS',
        userId: input.userId, userName: input.userName, at: now,
      });
    }
    const total = saleLines.reduce((s, ln) => s + ln.lineTotal, 0);
    const sale: PosSale = {
      id: `pos-${Date.now()}`,
      code: `VTA-${String(this._posSales().length + 1).padStart(4, '0')}`,
      almacenId, lines: saleLines, total, paymentMethod: input.paymentMethod,
      comprobante: input.comprobante,
      customerId: input.comprobante === 'factura' ? input.customerId : undefined,
      at: now, soldBy: input.userName,
    };
    this._posSales.update(list => [sale, ...list]);
    return sale;
  }

  receiveSupply(input: { supplyId: string; qty: number; cost: number; userName: string; userId: string; note?: string; reason?: string; }) {
    if (input.qty <= 0) throw new Error('La cantidad debe ser mayor a 0.');
    const supply = this.supplyById(input.supplyId);
    if (!supply) throw new Error('Insumo no encontrado');
    const stock = this.supplyStockFor(input.supplyId);
    const currentQty = stock?.quantity ?? 0;
    const newQty = currentQty + input.qty;
    const status = this.computeStatus(newQty, supply.reorderPoint, supply.minStock);

    if (stock) {
      this._supplyStock.update(list => list.map(s =>
        s.id === stock.id ? { ...s, quantity: newQty, status } : s
      ));
    } else {
      this._supplyStock.update(list => [...list, {
        id: input.supplyId,
        supplyId: input.supplyId,
        quantity: newQty,
        status,
      }]);
    }

    this.registerKardexEntry({
      id: `k-${Date.now()}`,
      supplyId: input.supplyId,
      itemName: supply.name,
      type: 'in',
      qty: input.qty,
      balance: newQty,
      cost: input.cost,
      reason: input.reason ?? 'purchase',
      note: input.note,
      userId: input.userId,
      userName: input.userName,
      at: new Date(),
    });
    this.regenerateAutoAlerts();
  }

  adjustSupplyStock(input: {
    supplyId: string; newQty: number;
    reason: string; note?: string; userId: string; userName: string;
  }) {
    const supply = this.supplyById(input.supplyId);
    if (!supply) throw new Error('Insumo no encontrado.');
    const stock = this.supplyStockFor(input.supplyId);
    const currentQty = stock?.quantity ?? 0;
    const delta = input.newQty - currentQty;
    const status = this.computeStatus(input.newQty, supply.reorderPoint, supply.minStock);

    if (stock) {
      this._supplyStock.update(list => list.map(s =>
        s.id === stock.id ? { ...s, quantity: input.newQty, status } : s
      ));
    } else {
      this._supplyStock.update(list => [...list, {
        id: input.supplyId,
        supplyId: input.supplyId,
        quantity: input.newQty,
        status,
      }]);
    }

    this.registerKardexEntry({
      id: `k-${Date.now()}-adj`,
      supplyId: input.supplyId,
      itemName: supply.name,
      type: 'adjustment',
      qty: Math.abs(delta),
      balance: input.newQty,
      cost: supply.cost,
      reason: input.reason,
      note: input.note,
      userId: input.userId,
      userName: input.userName,
      at: new Date(),
    });
    this.regenerateAutoAlerts();
  }

  /**
   * Movimiento genérico de stock para escenarios fuera del flujo OC/venta.
   *  - kind: 'entry'      → suma qty (devolución cliente, donación, carga manual)
   *  - kind: 'exit'       → resta qty (merma: dañado, vencido, perdido)
   *  - kind: 'adjustment' → setea newQty absoluto (corrección por conteo físico)
   *
   * itemKind define si afecta supply o product. Productos solo si !hasRecipe.
   */
  recordStockMovement(input: {
    kind: 'entry' | 'exit' | 'adjustment';
    itemKind: 'supply' | 'product';
    itemId: string;
    qty?: number;     // requerido para entry/exit
    newQty?: number;  // requerido para adjustment
    reason: string;
    note?: string;
    cost?: number;
    userId: string;
    userName: string;
  }) {
    if (input.itemKind === 'supply') {
      const supply = this.supplyById(input.itemId);
      if (!supply) throw new Error('Insumo no encontrado.');
      const stock = this.supplyStockFor(input.itemId);
      const currentQty = stock?.quantity ?? 0;

      let newQty: number;
      let kardexType: 'in' | 'out' | 'adjustment';
      let qtyForKardex: number;

      if (input.kind === 'entry') {
        if (!input.qty || input.qty <= 0) throw new Error('La cantidad debe ser mayor a 0.');
        newQty = currentQty + input.qty;
        kardexType = 'in';
        qtyForKardex = input.qty;
      } else if (input.kind === 'exit') {
        if (!input.qty || input.qty <= 0) throw new Error('La cantidad debe ser mayor a 0.');
        if (input.qty > currentQty) throw new Error(`Stock insuficiente: ${currentQty} ${supply.unit} disponibles.`);
        newQty = currentQty - input.qty;
        kardexType = 'out';
        qtyForKardex = input.qty;
      } else {
        if (input.newQty == null || input.newQty < 0) throw new Error('Stock contado inválido.');
        newQty = input.newQty;
        kardexType = 'adjustment';
        qtyForKardex = Math.abs(newQty - currentQty);
      }

      const status = this.computeStatus(newQty, supply.reorderPoint, supply.minStock);
      if (stock) {
        this._supplyStock.update(list => list.map(s =>
          s.id === stock.id ? { ...s, quantity: newQty, status } : s
        ));
      } else {
        this._supplyStock.update(list => [...list, {
          id: input.itemId, supplyId: input.itemId, quantity: newQty, status,
        }]);
      }
      this.registerKardexEntry({
        id: `k-${Date.now()}-${input.itemId}`,
        supplyId: input.itemId,
        itemName: supply.name,
        type: kardexType,
        qty: qtyForKardex,
        balance: newQty,
        cost: input.cost ?? supply.cost,
        reason: input.reason,
        note: input.note,
        userId: input.userId,
        userName: input.userName,
        at: new Date(),
      });
    } else {
      const product = this.productById(input.itemId);
      if (!product) throw new Error('Producto no encontrado.');
      if (product.hasRecipe) throw new Error('Los productos con receta no manejan stock propio.');
      const stock = this.productStockFor(input.itemId);
      const currentQty = stock?.quantity ?? 0;

      let newQty: number;
      let kardexType: 'in' | 'out' | 'adjustment';
      let qtyForKardex: number;

      if (input.kind === 'entry') {
        if (!input.qty || input.qty <= 0) throw new Error('La cantidad debe ser mayor a 0.');
        newQty = currentQty + input.qty;
        kardexType = 'in';
        qtyForKardex = input.qty;
      } else if (input.kind === 'exit') {
        if (!input.qty || input.qty <= 0) throw new Error('La cantidad debe ser mayor a 0.');
        if (input.qty > currentQty) throw new Error(`Stock insuficiente: ${currentQty} ${product.unit} disponibles.`);
        newQty = currentQty - input.qty;
        kardexType = 'out';
        qtyForKardex = input.qty;
      } else {
        if (input.newQty == null || input.newQty < 0) throw new Error('Stock contado inválido.');
        newQty = input.newQty;
        kardexType = 'adjustment';
        qtyForKardex = Math.abs(newQty - currentQty);
      }

      const status = this.computeProductStatus(newQty, product.reorderPoint, product.minStock);
      if (stock) {
        this._productStock.update(list => list.map(s =>
          s.id === stock.id ? { ...s, quantity: newQty, status } : s
        ));
      } else {
        this._productStock.update(list => [...list, {
          id: input.itemId, productId: input.itemId, quantity: newQty, reservedQty: 0, status,
        }]);
      }
      this.registerKardexEntry({
        id: `k-${Date.now()}-${input.itemId}`,
        productId: input.itemId,
        itemName: product.name,
        type: kardexType,
        qty: qtyForKardex,
        balance: newQty,
        cost: input.cost ?? product.buyPrice,
        reason: input.reason,
        note: input.note,
        userId: input.userId,
        userName: input.userName,
        at: new Date(),
      });
    }
    this.regenerateAutoAlerts();
  }

  /**
   * Demanda diaria efectiva para un item en una fecha futura.
   * Versión sin boosts: simplemente la media móvil 7d del histórico.
   * Mantenida porque burn-down y predicciones la consumen.
   */
  effectiveDailyDemand(itemKind: 'supply' | 'product', itemId: string, _dayOffset: number): number {
    return this.rollingMean(itemKind, itemId, 7);
  }

  // ============================================================
  //  Miembros
  // ============================================================
  inviteMember(input: { email: string; displayName: string; role: UserRole }): Member {
    const m: Member = {
      uid: `u-${Date.now()}`,
      email: input.email,
      displayName: input.displayName,
      role: input.role,
      active: true,
      tenantId: this._tenantId, // miembro pertenece al tenant actual
    };
    this._members.update(list => [...list, m]);
    return m;
  }

  updateMemberRole(uid: string, role: UserRole) {
    this._members.update(list => list.map(m => m.uid === uid ? { ...m, role } : m));
  }

  removeMember(uid: string) {
    this._members.update(list => list.filter(m => m.uid !== uid));
  }

  // ============================================================
  //  Simulación de burn-down (para pantalla de análisis)
  // ============================================================

  /**
   * Proyecta día a día el stock futuro de un item considerando:
   *  - Demanda diaria = `effectiveDailyDemand(itemKind, itemId, día)` que
   *    aplica el rollingMean(7d) + boosts activos que cubran cada día.
   *  - Llegadas programadas: OCs pending del item con expectedDate dentro del horizonte.
   *
   * Devuelve la trayectoria + fechas clave + boosts que afectan el horizonte.
   */
  simulateBurnDown(itemKind: 'supply' | 'product', itemId: string, horizonDays = 90): {
    trayectoria: number[];
    /** Demanda diaria efectiva por día (con boosts aplicados). */
    demandPerDay: number[];
    initialStock: number;
    /** Demanda diaria base (sin boosts) — para comparación. */
    baselineDailyDemand: number;
    leadTime: number;
    reorderPoint: number;
    minStock: number;
    maxStock: number;
    daysOfCoverage: number;
    /** Día (0..horizon) en que el stock cruza ROP. null si nunca lo cruza. */
    dayCrossesReorder: number | null;
    /** Día (0..horizon) en que el stock llega a 0. null si no se vacía en el horizonte. */
    dayHitsZero: number | null;
    /** Día sugerido para colocar la OC (dayCrossesReorder - leadTime). null si N/A. */
    dayToOrder: number | null;
    /** OCs pending del item con fecha esperada en el horizonte. */
    incomingPOs: { code: string; arrivalDay: number; qty: number }[];
    /** Cantidad sugerida a ordenar para llegar al máximo cuando entre la OC. */
    suggestedOrderQty: number;
  } {
    // Estado base del item
    let item: { stock: number; reorderPoint: number; minStock: number; maxStock: number; leadTime: number } | null = null;
    if (itemKind === 'supply') {
      const s = this.supplyById(itemId);
      if (!s) return this.emptyBurnDown();
      const stockItem = this.supplyStockFor(itemId);
      // LT dinámico: depende del calendario semanal del proveedor más
      // rápido del insumo (próxima ventana pedido → próxima entrega).
      // Si no hay proveedores o ninguno tiene calendario, leadTime=0.
      const dynLt = this.supplyLeadTime(itemId, new Date());
      item = {
        stock: stockItem?.quantity ?? 0,
        reorderPoint: s.reorderPoint,
        minStock: s.minStock,
        maxStock: s.maxStock,
        leadTime: dynLt?.leadTimeDays ?? 0,
      };
    } else {
      const p = this.productById(itemId);
      if (!p || p.hasRecipe) return this.emptyBurnDown();
      const stockItem = this.productStockFor(itemId);
      const rop = p.reorderPoint ?? 0;
      const minStock = p.minStock ?? Math.floor(rop / 3);
      item = {
        stock: stockItem?.quantity ?? 0,
        reorderPoint: rop,
        minStock,
        maxStock: Math.max(rop * 3, minStock + 10),
        leadTime: p.leadTime,
      };
    }

    const baselineDailyDemand = this.rollingMean(itemKind, itemId, 7);
    const initialStock = item.stock;
    const trayectoria: number[] = [];
    const demandPerDay: number[] = [];

    // OCs pending que tocan al item y tienen expectedDate dentro del horizonte
    const now = Date.now();
    const incomingPOs: { code: string; arrivalDay: number; qty: number }[] = [];
    for (const po of this._pos()) {
      if (po.status !== 'pending' || !po.expectedDate) continue;
      const matching = po.items.filter(it =>
        itemKind === 'supply' ? it.supplyId === itemId : it.productId === itemId
      );
      if (matching.length === 0) continue;
      const arrivalDay = Math.max(0, Math.floor((po.expectedDate.getTime() - now) / 86_400_000));
      if (arrivalDay > horizonDays) continue;
      const qty = matching.reduce((s, it) => s + it.qty, 0);
      incomingPOs.push({ code: po.code, arrivalDay, qty });
    }

    // Simulación día a día
    let stock = initialStock;
    let dayCrossesReorder: number | null = null;
    let dayHitsZero: number | null = null;

    for (let d = 0; d <= horizonDays; d++) {
      // Llegadas del día d
      for (const po of incomingPOs) {
        if (po.arrivalDay === d) stock += po.qty;
      }
      trayectoria.push(Math.max(0, Math.round(stock)));
      if (dayCrossesReorder === null && stock <= item.reorderPoint && stock > 0) {
        dayCrossesReorder = d;
      }
      if (dayHitsZero === null && stock <= 0) {
        dayHitsZero = d;
      }
      // Demanda del día con boosts aplicados
      const todayDemand = this.effectiveDailyDemand(itemKind, itemId, d);
      demandPerDay.push(todayDemand);
      stock = Math.max(0, stock - todayDemand);
    }

    const dayToOrder = dayCrossesReorder !== null
      ? Math.max(0, dayCrossesReorder - item.leadTime)
      : null;

    const stockAtOrderArrival = dayToOrder !== null && dayToOrder + item.leadTime <= horizonDays
      ? trayectoria[dayToOrder + item.leadTime] ?? 0
      : 0;
    const suggestedOrderQty = Math.max(0, item.maxStock - stockAtOrderArrival);

    // Cobertura usa la demanda promedio del horizonte (con boosts) — más realista.
    const avgDemand = demandPerDay.length > 0
      ? demandPerDay.reduce((s, x) => s + x, 0) / demandPerDay.length
      : baselineDailyDemand;
    const daysOfCoverage = avgDemand > 0 ? initialStock / avgDemand : 0;

    return {
      trayectoria,
      demandPerDay,
      initialStock,
      baselineDailyDemand,
      leadTime: item.leadTime,
      reorderPoint: item.reorderPoint,
      minStock: item.minStock,
      maxStock: item.maxStock,
      daysOfCoverage,
      dayCrossesReorder,
      dayHitsZero,
      dayToOrder,
      incomingPOs,
      suggestedOrderQty,
    };
  }

  private emptyBurnDown() {
    return {
      trayectoria: [],
      demandPerDay: [],
      initialStock: 0,
      baselineDailyDemand: 0,
      leadTime: 0,
      reorderPoint: 0,
      minStock: 0,
      maxStock: 0,
      daysOfCoverage: 0,
      dayCrossesReorder: null,
      dayHitsZero: null,
      dayToOrder: null,
      incomingPOs: [],
      suggestedOrderQty: 0,
    };
  }

  // ============================================================
  //  Estadísticas de demanda (para Predicciones IA)
  // ============================================================

  /**
   * Calcula el promedio diario de consumo en los últimos N días.
   *
   * En ambos casos se usa el kardex (sin depender ya de `SaleRecord`):
   *  - Para `supply`: cualquier `out` (producción consumiendo recetas para
   *    pedidos completados, mermas, etc.).
   *  - Para `product`: `out` con reason `sale` — corresponde a las unidades
   *    efectivamente entregadas al cliente vía `confirmOrderReception`.
   *
   * Así la demanda predicha refleja los pedidos completados a clientes (no
   * ventas fantasma de tabla aparte) y los insumos se descuentan en línea
   * con cómo se gastan al fabricar esos pedidos.
   */
  rollingMean(itemKind: 'supply' | 'product', itemId: string, windowDays: number): number {
    const total = this.sumConsumption(itemKind, itemId, windowDays);
    return windowDays > 0 ? total / windowDays : 0;
  }

  /**
   * Desviación estándar diaria del consumo en los últimos N días.
   * Agrupa por día y calcula desviación estándar muestral. Si hay <2 puntos, 0.
   */
  rollingStd(itemKind: 'supply' | 'product', itemId: string, windowDays: number): number {
    const daily = this.dailyConsumption(itemKind, itemId, windowDays);
    if (daily.length < 2) return 0;
    const mean = daily.reduce((s, x) => s + x, 0) / daily.length;
    const variance = daily.reduce((s, x) => s + (x - mean) ** 2, 0) / (daily.length - 1);
    return Math.sqrt(variance);
  }

  /**
   * Lead time observado: promedio y desviación estándar de los días entre
   * `createdAt` y `receivedAt` de las OCs recibidas que contienen el item.
   * Si no hay histórico devuelve count=0 y el caller debe usar el leadTime
   * configurado en el item como fallback.
   */
  historicalLeadTime(itemKind: 'supply' | 'product', itemId: string): { avg: number; std: number; count: number } {
    const days: number[] = [];
    for (const po of this._pos()) {
      if (po.status !== 'received' || !po.receivedAt) continue;
      const matches = po.items.some(it =>
        itemKind === 'supply' ? it.supplyId === itemId : it.productId === itemId
      );
      if (!matches) continue;
      const elapsed = (po.receivedAt.getTime() - po.createdAt.getTime()) / 86_400_000;
      if (elapsed >= 0) days.push(elapsed);
    }
    if (days.length === 0) return { avg: 0, std: 0, count: 0 };
    const avg = days.reduce((s, x) => s + x, 0) / days.length;
    if (days.length < 2) return { avg, std: 0, count: days.length };
    const variance = days.reduce((s, x) => s + (x - avg) ** 2, 0) / (days.length - 1);
    return { avg, std: Math.sqrt(variance), count: days.length };
  }

  /**
   * Días transcurridos desde la última entrada (`in` reason='purchase') del item.
   * Si no hay registro, devuelve 0.
   */
  daysSinceLastRestock(itemKind: 'supply' | 'product', itemId: string): number {
    const entries = this._kardex().filter(k => {
      if (k.type !== 'in') return false;
      if (k.reason !== 'purchase') return false;
      return itemKind === 'supply' ? k.supplyId === itemId : k.productId === itemId;
    });
    if (entries.length === 0) return 0;
    const last = entries.reduce((acc, e) => e.at.getTime() > acc.at.getTime() ? e : acc);
    return Math.max(0, Math.floor((Date.now() - last.at.getTime()) / 86_400_000));
  }

  private sumConsumption(itemKind: 'supply' | 'product', itemId: string, windowDays: number): number {
    const cutoff = Date.now() - windowDays * 86_400_000;
    if (itemKind === 'supply') {
      return this._kardex()
        .filter(k => k.supplyId === itemId && k.type === 'out' && k.at.getTime() >= cutoff)
        .reduce((s, k) => s + k.qty, 0);
    }
    // Productos: kardex `out` reason `sale` = entregado al cliente.
    return this._kardex()
      .filter(k => k.productId === itemId && k.type === 'out' && k.reason === 'sale'
        && k.at.getTime() >= cutoff)
      .reduce((s, k) => s + k.qty, 0);
  }

  /** Devuelve un array de N elementos con el consumo de cada día (día 0 = más antiguo). */
  private dailyConsumption(itemKind: 'supply' | 'product', itemId: string, windowDays: number): number[] {
    const buckets = new Array<number>(windowDays).fill(0);
    const now = Date.now();
    const items: { at: Date; qty: number }[] = itemKind === 'supply'
      ? this._kardex()
          .filter(k => k.supplyId === itemId && k.type === 'out')
          .map(k => ({ at: k.at, qty: k.qty }))
      : this._kardex()
          .filter(k => k.productId === itemId && k.type === 'out' && k.reason === 'sale')
          .map(k => ({ at: k.at, qty: k.qty }));
    for (const it of items) {
      const ageDays = Math.floor((now - it.at.getTime()) / 86_400_000);
      if (ageDays < 0 || ageDays >= windowDays) continue;
      buckets[windowDays - 1 - ageDays] += it.qty;
    }
    return buckets;
  }

  // ============================================================
  computeStatus(qty: number, reorderPoint: number, minStock: number): StockStatus {
    if (qty <= 0) return 'out';
    if (qty <= minStock) return 'critical';
    if (qty <= reorderPoint) return 'low';
    return 'available';
  }

  /**
   * Variante para productos: reorderPoint y minStock son opcionales. Si no están
   * definidos (producto sin monitoreo de reorden), el status es binario available/out.
   */
  computeProductStatus(qty: number, reorderPoint?: number, minStock?: number): StockStatus {
    if (qty <= 0) return 'out';
    if (minStock != null && qty <= minStock) return 'critical';
    if (reorderPoint != null && qty <= reorderPoint) return 'low';
    return 'available';
  }

  /**
   * Re-deriva TODAS las alertas auto-generadas a partir del estado actual del
   * negocio. Cubre tres familias:
   *
   *  **Stock** (por insumo / producto de reventa):
   *   - `restock`       — stock ≤ punto de reorden (bajo / crítico / agotado).
   *   - `stockout_risk` — proyectiva: se agotará en ≤7 días según consumo diario.
   *   - `order_now`     — cruce LT + proyección: el stock no aguanta ni la
   *                       entrega más rápida; hay que ordenar HOY o se rompe.
   *   - `excess`        — stock por sobre el máximo (capital inmovilizado).
   *
   *  **Pedidos** (por OC):
   *   - `delivery_today`    — entrega esperada hoy.
   *   - `delivery_overdue`  — entrega vencida y no recibida.
   *   - `partial_reception` — llegó menos de lo pedido.
   *
   *  **Proveedores** (por proveedor):
   *   - `order_day` — hoy es ventana de pedido y hay insumos por reordenar.
   *
   * Convención: ids con prefijo `auto-` son administradas por esta función; las
   * demás (manuales, históricas) se preservan intactas. Si ya existe una alerta
   * MANUAL para el mismo (tipo, item), no se duplica con una auto.
   *
   * Se llama tras toda mutación de stock/OC y al iniciar el servicio.
   */
  regenerateAutoAlerts(today: Date = new Date()) {
    const supplies = this._supplies();
    const products = this._products();
    const supplyStock = this._supplyStock();
    const productStock = this._productStock();
    const pos = this._pos();
    const existing = this._alerts();

    const t0 = new Date(today);
    t0.setHours(0, 0, 0, 0);
    const startOfToday = t0.getTime();
    const DAY = 86_400_000;
    const STOCKOUT_HORIZON = 7; // días de anticipación para "se va a acabar"
    const r1 = (n: number) => Math.round(n * 10) / 10;

    const autoNext: Alert[] = [];

    // Claves de alertas manuales existentes — para no duplicar con auto.
    const manualKeys = new Set(
      existing
        .filter(a => !a.id.startsWith('auto-'))
        .map(a => `${a.type}:${a.supplyId ?? a.productId ?? a.poId ?? a.supplierId ?? ''}`),
    );

    // Conserva el estado `acknowledged` y la fecha de creación de una alerta
    // auto previa con el mismo id; si fue resuelta pero la condición persiste,
    // vuelve a 'active'. Omite si ya hay una alerta manual equivalente.
    const push = (base: Alert) => {
      const key = `${base.type}:${base.supplyId ?? base.productId ?? base.poId ?? base.supplierId ?? ''}`;
      if (manualKeys.has(key)) return;
      const prev = existing.find(a => a.id === base.id);
      autoNext.push({
        ...base,
        status: prev?.status === 'acknowledged' ? 'acknowledged' : 'active',
        createdAt: prev?.createdAt ?? today,
        acknowledgedAt: prev?.acknowledgedAt,
        acknowledgedBy: prev?.acknowledgedBy,
      });
    };

    // ---------- 1. Insumos: reabastecimiento + proyección + exceso ----------
    for (const stock of supplyStock) {
      const sup = supplies.find(s => s.id === stock.supplyId);
      if (!sup || !sup.active) continue;

      const qty = stock.quantity;
      const dailyDemand = this.rollingMean('supply', sup.id, 7) || 0;
      const pendingQty = this.pendingIncomingQtyForSupply(sup.id);
      const effectiveStock = qty + pendingQty;
      const lt = this.supplyLeadTime(sup.id, today);

      // 1a. Reabastecimiento (nivel) — stock bajo el punto de reorden.
      if (stock.status !== 'available') {
        const id = `auto-restock-supply-${sup.id}`;
        push({
          id, type: 'restock', status: 'active',
          priority: stock.status === 'out' || stock.status === 'critical' ? 'high' : 'medium',
          supplyId: sup.id, itemName: sup.name,
          message: `Stock ${stock.status === 'out' ? 'agotado' : stock.status === 'critical' ? 'crítico' : 'bajo punto de reorden'}: ${qty} ${sup.unit} (reorden ${sup.reorderPoint}).`,
          currentQty: qty, reorderPoint: sup.reorderPoint,
          createdAt: today,
        });
      }

      // 1b. Proyección de agotamiento — requiere consumo y stock restante.
      if (dailyDemand > 0 && qty > 0) {
        const daysUntilEmpty = effectiveStock / dailyDemand;
        const ltDays = lt?.leadTimeDays ?? 0;
        const stockoutDate = new Date(startOfToday + Math.floor(daysUntilEmpty) * DAY);

        if (lt && daysUntilEmpty <= ltDays) {
          // 1b-i. order_now: no alcanza ni ordenando hoy — la entrega más
          // rápida llega después de que el stock se agote.
          const id = `auto-ordernow-supply-${sup.id}`;
          push({
            id, type: 'order_now', status: 'active', priority: 'high',
            supplyId: sup.id, supplierId: lt.supplierId,
            supplierName: this.supplierById(lt.supplierId)?.name,
            itemName: sup.name,
            message: `Ordena hoy: el stock dura ~${Math.floor(daysUntilEmpty)} día(s) y la entrega más rápida tarda ${ltDays}. Si esperas, rompes stock.`,
            currentQty: qty, reorderPoint: sup.reorderPoint,
            projectedStockoutDate: stockoutDate,
            projectedDaysUntilStockout: Math.floor(daysUntilEmpty),
            leadTimeDays: ltDays,
            createdAt: today,
          });
        } else if (daysUntilEmpty <= STOCKOUT_HORIZON) {
          // 1b-ii. stockout_risk: aviso proyectivo con holgura para reaccionar.
          const days = Math.floor(daysUntilEmpty);
          const id = `auto-stockout-supply-${sup.id}`;
          push({
            id, type: 'stockout_risk', status: 'active',
            priority: days <= 3 ? 'high' : 'medium',
            supplyId: sup.id, itemName: sup.name,
            message: `Se agotará en ~${days} día(s) al ritmo actual (${r1(dailyDemand)} ${sup.unit}/día).`,
            currentQty: qty, reorderPoint: sup.reorderPoint,
            projectedStockoutDate: stockoutDate,
            projectedDaysUntilStockout: days,
            createdAt: today,
          });
        }
      }

      // 1c. Exceso de inventario — capital inmovilizado.
      if (sup.maxStock > 0 && qty > sup.maxStock) {
        const excessUnits = qty - sup.maxStock;
        const id = `auto-excess-supply-${sup.id}`;
        push({
          id, type: 'excess', status: 'active', priority: 'low',
          supplyId: sup.id, itemName: sup.name,
          message: `Exceso de inventario: ${qty} ${sup.unit} sobre el máximo de ${sup.maxStock}. Sobran ${r1(excessUnits)} ${sup.unit}.`,
          currentQty: qty, excessValue: Math.round(excessUnits * sup.cost),
          createdAt: today,
        });
      }
    }

    // ---------- 2. Productos de reventa: reabastecimiento ----------
    for (const stock of productStock) {
      if (stock.status === 'available') continue;
      const prod = products.find(p => p.id === stock.productId);
      if (!prod || !prod.active || prod.hasRecipe) continue;
      if (prod.reorderPoint == null && stock.status !== 'out') continue; // sin umbral, solo alertar si agotado
      const id = `auto-restock-product-${stock.productId}`;
      push({
        id, type: 'restock', status: 'active',
        priority: stock.status === 'out' || stock.status === 'critical' ? 'high' : 'medium',
        productId: stock.productId, itemName: prod.name,
        message: `Stock ${stock.status === 'out' ? 'agotado' : stock.status === 'critical' ? 'crítico' : 'bajo punto de reorden'}: ${stock.quantity} ${prod.unit}${prod.reorderPoint != null ? ` (reorden ${prod.reorderPoint})` : ''}. Producto de reventa — generar OC al proveedor.`,
        currentQty: stock.quantity, reorderPoint: prod.reorderPoint ?? undefined,
        createdAt: today,
      });
    }

    // ---------- 3. Órdenes de compra: entrega hoy / vencida / parcial ----------
    for (const po of pos) {
      const ordered = po.items.reduce((s, it) => s + it.qty, 0);

      // 3a + 3b: OCs pendientes con fecha esperada de entrega.
      if (po.status === 'pending' && po.expectedDate) {
        const due = new Date(po.expectedDate);
        due.setHours(0, 0, 0, 0);
        const diffDays = Math.round((due.getTime() - startOfToday) / DAY);

        if (diffDays === 0) {
          const id = `auto-delivery-today-${po.id}`;
          push({
            id, type: 'delivery_today', status: 'active', priority: 'medium',
            itemName: `${po.code} · ${po.supplier}`,
            message: `Hoy llega tu pedido: ${ordered} unidad(es) de ${po.supplier}. Prepárate para recibir y registrar el ingreso.`,
            poId: po.id, poCode: po.code, supplierName: po.supplier,
            expectedDate: po.expectedDate, orderedQty: ordered,
            createdAt: today,
          });
        } else if (diffDays < 0) {
          const id = `auto-delivery-overdue-${po.id}`;
          push({
            id, type: 'delivery_overdue', status: 'active', priority: 'high',
            itemName: `${po.code} · ${po.supplier}`,
            message: `Tu pedido no ha llegado: la OC ${po.code} de ${po.supplier} venció hace ${-diffDays} día(s). Contacta al proveedor.`,
            poId: po.id, poCode: po.code, supplierName: po.supplier,
            expectedDate: po.expectedDate, orderedQty: ordered,
            createdAt: today,
          });
        }
      }

      // 3c: recepción parcial — llegó menos de lo pedido.
      const received = po.items.reduce((s, it) => s + (it.receivedQty ?? 0), 0);
      const hasReception = po.items.some(it => it.receivedQty != null);
      if (po.status !== 'cancelled' && hasReception && received < ordered) {
        const id = `auto-partial-${po.id}`;
        push({
          id, type: 'partial_reception', status: 'active', priority: 'medium',
          itemName: `${po.code} · ${po.supplier}`,
          message: `Recepción parcial: de ${ordered} unidad(es) pedidas a ${po.supplier} llegaron ${received}. Faltan ${ordered - received}.`,
          poId: po.id, poCode: po.code, supplierName: po.supplier,
          orderedQty: ordered, receivedQty: received,
          createdAt: today,
        });
      }
    }

    // ---------- 4. Día de pedido del proveedor ----------
    // Si hoy es ventana de pedido de un proveedor y tiene insumos por
    // reordenar, avisar para no perder el ciclo y esperar al próximo.
    const weekday = t0.getDay();
    const suggestions = this.suggestedPrePurchases(today);
    for (const sup of this.activeSuppliers()) {
      if (!sup.orderDays?.includes(weekday)) continue;
      const sg = suggestions.find(s => s.supplierId === sup.id);
      const itemCount = sg?.items.length ?? 0;
      if (itemCount === 0) continue;
      const id = `auto-orderday-${sup.id}`;
      push({
        id, type: 'order_day', status: 'active', priority: 'medium',
        supplierId: sup.id, supplierName: sup.name, itemName: sup.name,
        message: `Hoy es día de pedido de ${sup.name}: ${itemCount} insumo(s) por reordenar. Aprovecha la ventana para no esperar al próximo ciclo.`,
        createdAt: today,
      });
    }

    // ---------- 5. Preservar alertas manuales / históricas ----------
    const manual = existing.filter(a => !a.id.startsWith('auto-'));
    this._alerts.set([...autoNext, ...manual]);
  }
  // ============================================================
  //  Pedidos (Ventas → Producción)
  // ============================================================

  orderById(id: string): CustomerOrder | undefined {
    return this._orders().find(o => o.id === id);
  }

  /**
   * Analiza un pedido (real o hipotético) contra el stock actual y devuelve:
   *  - itemAnalysis: por cada item del pedido, requested vs canFulfill (parcial)
   *  - shortfalls: lista de insumos/productos faltantes con cuánto se necesita extra
   *
   * NO muta nada. Útil tanto para previsualizar (estado pending) como para calcular
   * lo que se va a reservar al iniciar producción.
   *
   * Cumplimiento parcial: si un item necesita 10 panes y solo alcanza para 7,
   * canFulfill=7 y los faltantes para los 3 restantes aparecen en shortfalls.
   */
  analyzeOrder(items: OrderItem[]): {
    itemAnalysis: { productId: string; productName: string; requested: number; canFulfill: number }[];
    shortfalls: OrderShortfall[];
  } {
    const itemAnalysis: { productId: string; productName: string; requested: number; canFulfill: number }[] = [];
    const shortfalls: OrderShortfall[] = [];

    // Working copy del stock disponible (varios items del mismo pedido compiten entre sí)
    const supplyAvail = new Map<string, number>();
    const productAvail = new Map<string, number>();
    for (const ss of this._supplyStock()) supplyAvail.set(ss.supplyId, ss.quantity);
    for (const ps of this._productStock()) productAvail.set(ps.productId, ps.quantity);

    for (const item of items) {
      const product = this.productById(item.productId);
      if (!product) {
        itemAnalysis.push({ productId: item.productId, productName: item.productName, requested: item.qty, canFulfill: 0 });
        continue;
      }

      if (product.hasRecipe) {
        // Cuánto se puede producir según el insumo/subproducto más limitante
        const fullNeed = this.explodeBom(item.productId, item.qty);
        let ratio = 1;
        for (const need of fullNeed.supplyNeeds) {
          if (need.qty <= 0) continue;
          const avail = supplyAvail.get(need.supplyId) ?? 0;
          ratio = Math.min(ratio, Math.max(0, avail / need.qty));
        }
        for (const need of fullNeed.reventaNeeds) {
          if (need.qty <= 0) continue;
          const avail = productAvail.get(need.productId) ?? 0;
          ratio = Math.min(ratio, Math.max(0, avail / need.qty));
        }
        const canFulfill = Math.floor(item.qty * ratio);

        // Descontar working copy según lo que sí podremos fabricar
        if (canFulfill > 0) {
          const actual = this.explodeBom(item.productId, canFulfill);
          for (const n of actual.supplyNeeds) {
            supplyAvail.set(n.supplyId, (supplyAvail.get(n.supplyId) ?? 0) - n.qty);
          }
          for (const n of actual.reventaNeeds) {
            productAvail.set(n.productId, (productAvail.get(n.productId) ?? 0) - n.qty);
          }
        }

        // Faltantes (sobre las unidades que NO podemos fabricar)
        const missingQty = item.qty - canFulfill;
        if (missingQty > 0) {
          const miss = this.explodeBom(item.productId, missingQty);
          for (const need of miss.supplyNeeds) {
            const avail = Math.max(0, supplyAvail.get(need.supplyId) ?? 0);
            const sup = this.supplyById(need.supplyId);
            shortfalls.push({
              kind: 'supply',
              itemId: need.supplyId,
              itemName: need.itemName,
              unit: sup?.unit ?? 'unidad',
              required: +need.qty.toFixed(3),
              available: +avail.toFixed(3),
              short: +Math.max(0, need.qty - avail).toFixed(3),
              forProductId: item.productId,
            });
          }
          for (const need of miss.reventaNeeds) {
            const avail = Math.max(0, productAvail.get(need.productId) ?? 0);
            const subProd = this.productById(need.productId);
            shortfalls.push({
              kind: 'product',
              itemId: need.productId,
              itemName: need.itemName,
              unit: subProd?.unit ?? 'unidad',
              required: +need.qty.toFixed(3),
              available: +avail.toFixed(3),
              short: +Math.max(0, need.qty - avail).toFixed(3),
              forProductId: item.productId,
            });
          }
        }

        itemAnalysis.push({ productId: item.productId, productName: item.productName, requested: item.qty, canFulfill });
      } else {
        // Producto de reventa: comparar directo con stock del producto
        const avail = productAvail.get(item.productId) ?? 0;
        const canFulfill = Math.min(item.qty, Math.floor(avail));
        productAvail.set(item.productId, avail - canFulfill);
        if (canFulfill < item.qty) {
          shortfalls.push({
            kind: 'product',
            itemId: item.productId,
            itemName: item.productName,
            unit: product.unit,
            required: item.qty,
            available: Math.max(0, avail),
            short: item.qty - canFulfill,
            forProductId: item.productId,
          });
        }
        itemAnalysis.push({ productId: item.productId, productName: item.productName, requested: item.qty, canFulfill });
      }
    }

    return { itemAnalysis, shortfalls };
  }

  /** Crea una orden de producción en estado pending. No toca stock. */
  createOrder(input: {
    purpose?: string;
    items: { productId: string; qty: number; unitPrice: number }[];
    notes?: string;
    userId: string;
    userName: string;
    /** Cliente que originó el pedido (cuando viene del portal). */
    customerId?: string;
    /** Urna de destino cuando es una solicitud de reposición interna de Ventas. */
    urnaId?: string;
    /** Fecha de entrega solicitada (portal) o requerida (reposición de urna). */
    requestedDeliveryDate?: Date;
  }): CustomerOrder {
    if (input.items.length === 0) {
      throw new Error('La orden debe tener al menos un item.');
    }
    const code = this.nextOrderCode();
    const orderItems: OrderItem[] = input.items.map(it => {
      const p = this.productById(it.productId);
      return {
        productId: it.productId,
        productName: p?.name ?? '',
        unit: p?.unit ?? 'unidad',
        qty: it.qty,
        unitPrice: it.unitPrice,
        fulfilledQty: 0,
      };
    });
    const total = orderItems.reduce((s, it) => s + it.qty * it.unitPrice, 0);
    const order: CustomerOrder = {
      // Sufijo aleatorio: al crear varias órdenes en el mismo milisegundo (una
      // por día en "Pedir a producción"), Date.now() solo no garantiza un id único.
      id: `ord-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      code,
      customerId: input.customerId,
      urnaId: input.urnaId,
      urnaName: input.urnaId ? this.urnaById(input.urnaId)?.name : undefined,
      purpose: input.purpose?.trim() || undefined,
      status: 'pending',
      items: orderItems,
      totalAmount: total,
      notes: input.notes,
      createdAt: new Date(),
      createdBy: input.userName,
      reservations: [],
      shortfalls: [],
      requestedDeliveryDate: input.requestedDeliveryDate,
    };
    this._orders.update(list => [order, ...list]);
    return order;
  }

  /**
   * Reemplaza los items de un pedido que aún está PENDIENTE (producción no lo
   * aceptó). Recalcula el total. Usado para editar pedidos a producción.
   */
  updateOrderItems(orderId: string, items: { productId: string; qty: number }[]): CustomerOrder {
    const order = this.orderById(orderId);
    if (!order) throw new Error('Pedido no encontrado.');
    if (order.status !== 'pending') {
      throw new Error('No se puede editar: producción ya aceptó este pedido.');
    }
    const clean = items.filter(i => i.qty > 0);
    if (clean.length === 0) throw new Error('El pedido debe tener al menos un producto.');
    const orderItems: OrderItem[] = clean.map(it => {
      const p = this.productById(it.productId);
      return {
        productId: it.productId,
        productName: p?.name ?? '',
        unit: p?.unit ?? 'unidad',
        qty: it.qty,
        unitPrice: order.customerId ? this.priceForCustomer(order.customerId, it.productId) : 0,
        fulfilledQty: 0,
      };
    });
    const total = orderItems.reduce((s, it) => s + it.qty * it.unitPrice, 0);
    const updated: CustomerOrder = { ...order, items: orderItems, totalAmount: total };
    this._orders.update(list => list.map(o => o.id === orderId ? updated : o));
    return updated;
  }

  /**
   * Pasa un pedido a "in_production":
   *  - Analiza stock disponible
   *  - Descuenta del stock real lo que pueda producirse (cumplimiento parcial)
   *  - Registra kardex de tipo 'out' con reason 'production'
   *  - Guarda reservations y shortfalls en el pedido
   *  - Actualiza fulfilledQty por item
   */
  startProduction(orderId: string, userId: string, userName: string): CustomerOrder {
    const order = this.orderById(orderId);
    if (!order) throw new Error('Pedido no encontrado.');
    if (order.status !== 'pending') {
      throw new Error('Solo se puede iniciar producción desde estado pendiente.');
    }

    const { itemAnalysis, shortfalls } = this.analyzeOrder(order.items);
    const reservations: OrderReservation[] = [];

    // Descontar stock realmente por cada item, en su qty cumplible
    for (const an of itemAnalysis) {
      if (an.canFulfill <= 0) continue;
      const product = this.productById(an.productId);
      if (!product) continue;

      if (product.hasRecipe) {
        const exploded = this.explodeBom(an.productId, an.canFulfill);
        for (const need of exploded.supplyNeeds) {
          const stock = this.supplyStockFor(need.supplyId);
          const supply = this.supplyById(need.supplyId);
          if (!stock || !supply) continue;
          const newQty = Math.max(0, stock.quantity - need.qty);
          const newStatus = this.computeStatus(newQty, supply.reorderPoint, supply.minStock);
          this._supplyStock.update(list => list.map(s =>
            s.id === stock.id ? { ...s, quantity: newQty, status: newStatus } : s
          ));
          this.registerKardexEntry({
            id: `k-${Date.now()}-${need.supplyId}-${Math.random().toString(36).slice(2, 7)}`,
            supplyId: need.supplyId,
            itemName: need.itemName,
            type: 'out',
            qty: need.qty,
            balance: newQty,
            cost: supply.cost,
            reason: 'production',
            note: `Pedido ${order.code} — ${product.name}`,
            userId,
            userName,
            at: new Date(),
          });
          reservations.push({ kind: 'supply', itemId: need.supplyId, itemName: need.itemName, unit: supply.unit, qty: need.qty });
        }
        for (const need of exploded.reventaNeeds) {
          const stock = this.productStockFor(need.productId);
          const subProd = this.productById(need.productId);
          if (!stock || !subProd) continue;
          const newQty = Math.max(0, stock.quantity - need.qty);
          const newStatus = this.computeProductStatus(newQty, subProd.reorderPoint, subProd.minStock);
          this._productStock.update(list => list.map(s =>
            s.id === stock.id ? { ...s, quantity: newQty, status: newStatus } : s
          ));
          this.registerKardexEntry({
            id: `k-${Date.now()}-${need.productId}-${Math.random().toString(36).slice(2, 7)}`,
            productId: need.productId,
            itemName: need.itemName,
            type: 'out',
            qty: need.qty,
            balance: newQty,
            cost: subProd.buyPrice,
            reason: 'production',
            note: `Pedido ${order.code} — ${product.name} (subproducto)`,
            userId,
            userName,
            at: new Date(),
          });
          reservations.push({ kind: 'product', itemId: need.productId, itemName: need.itemName, unit: subProd.unit, qty: need.qty });
        }
      } else {
        const stock = this.productStockFor(an.productId);
        if (!stock) continue;
        const newQty = Math.max(0, stock.quantity - an.canFulfill);
        const newStatus = this.computeProductStatus(newQty, product.reorderPoint, product.minStock);
        this._productStock.update(list => list.map(s =>
          s.id === stock.id ? { ...s, quantity: newQty, status: newStatus } : s
        ));
        this.registerKardexEntry({
          id: `k-${Date.now()}-${an.productId}`,
          productId: an.productId,
          itemName: product.name,
          type: 'out',
          qty: an.canFulfill,
          balance: newQty,
          cost: product.buyPrice,
          reason: 'production',
          note: `Pedido ${order.code}`,
          userId,
          userName,
          at: new Date(),
        });
        reservations.push({ kind: 'product', itemId: an.productId, itemName: product.name, unit: product.unit, qty: an.canFulfill });
      }
    }

    const updated: CustomerOrder = {
      ...order,
      status: 'in_production',
      productionStartedAt: new Date(),
      reservations,
      shortfalls,
      items: order.items.map(it => {
        const an = itemAnalysis.find(a => a.productId === it.productId);
        return { ...it, fulfilledQty: an?.canFulfill ?? 0 };
      }),
    };
    this._orders.update(list => list.map(o => o.id === orderId ? updated : o));
    this.regenerateAutoAlerts();
    return updated;
  }

  /**
   * Producción terminó la fabricación: suma las unidades fabricadas al stock
   * del producto terminado (creando un StockItem si no existe — los productos
   * con receta no tenían stock propio hasta ahora). Cierra la orden.
   *
   * No genera SaleRecord: la venta al cliente final es un evento separado.
   */
  completeOrder(orderId: string, userId: string, userName: string): CustomerOrder {
    const order = this.orderById(orderId);
    if (!order) throw new Error('Orden no encontrada.');
    if (order.status !== 'in_production') {
      throw new Error('Solo se puede completar desde "en producción".');
    }

    const now = new Date();
    for (const it of order.items) {
      if (it.fulfilledQty <= 0) continue;
      const product = this.productById(it.productId);
      if (!product) continue;

      // Asegurar que exista StockItem para el producto fabricado
      let stock = this.productStockFor(it.productId);
      if (!stock) {
        stock = {
          id: it.productId,
          productId: it.productId,
          quantity: 0,
          reservedQty: 0,
          status: 'out',
        };
        this._productStock.update(list => [...list, stock!]);
      }

      const newQty = stock.quantity + it.fulfilledQty;
      const newStatus = this.computeProductStatus(newQty, product.reorderPoint, product.minStock);
      this._productStock.update(list => list.map(s =>
        s.productId === it.productId ? { ...s, quantity: newQty, status: newStatus } : s
      ));

      this.registerKardexEntry({
        id: `k-${Date.now()}-${it.productId}-${Math.random().toString(36).slice(2, 7)}`,
        productId: it.productId,
        itemName: it.productName,
        type: 'in',
        qty: it.fulfilledQty,
        balance: newQty,
        cost: this.effectiveProductCost(it.productId),
        reason: 'production',
        note: `Orden ${order.code} completada`,
        userId,
        userName,
        at: now,
      });
    }

    const updated: CustomerOrder = { ...order, status: 'completed', completedAt: now };
    this._orders.update(list => list.map(o => o.id === orderId ? updated : o));
    this.regenerateAutoAlerts();
    return updated;
  }

  /**
   * Ventas CORROBORA un pedido de cliente recibido y lo envía a producción.
   * No consume insumos (eso lo hace Producción al iniciar); solo lo habilita
   * para la cola de producción.
   */
  corroborateOrder(orderId: string): CustomerOrder {
    const order = this.orderById(orderId);
    if (!order) throw new Error('Pedido no encontrado.');
    if (!order.customerId) throw new Error('Solo se corroboran pedidos de cliente.');
    if (order.status !== 'pending') throw new Error('Solo se corroboran pedidos recibidos (pendientes).');
    if (order.acceptedBySalesAt) throw new Error('Este pedido ya fue enviado a producción.');
    const updated: CustomerOrder = { ...order, acceptedBySalesAt: new Date() };
    this._orders.update(list => list.map(o => o.id === orderId ? updated : o));
    return updated;
  }

  /**
   * Ventas DESPACHA un pedido de cliente ya producido: descuenta del stock
   * central lo fabricado (kardex `sale`) y marca el pedido como despachado.
   */
  dispatchOrder(orderId: string, userId: string, userName: string): CustomerOrder {
    const order = this.orderById(orderId);
    if (!order) throw new Error('Pedido no encontrado.');
    if (!order.customerId) throw new Error('Solo se despachan pedidos de cliente.');
    if (order.status !== 'completed') throw new Error('Solo se despacha un pedido ya producido (completado).');
    if (order.dispatchedAt) throw new Error('Este pedido ya fue despachado.');

    const now = new Date();
    const customerName = this.customerById(order.customerId)?.name ?? 'cliente';
    for (const it of order.items) {
      if (it.fulfilledQty <= 0) continue;
      const product = this.productById(it.productId);
      const central = this.productStockFor(it.productId);
      const move = Math.min(it.fulfilledQty, central?.quantity ?? 0);
      if (central && move > 0) {
        const afterOut = central.quantity - move;
        const newStatus = this.computeProductStatus(afterOut, product?.reorderPoint, product?.minStock);
        this._productStock.update(list => list.map(s =>
          s.productId === it.productId ? { ...s, quantity: afterOut, status: newStatus } : s));
      }
      this.registerKardexEntry({
        id: `k-${Date.now()}-${it.productId}-disp`,
        productId: it.productId, itemName: it.productName,
        type: 'out', qty: it.fulfilledQty, balance: this.productStockFor(it.productId)?.quantity ?? 0,
        cost: this.effectiveProductCost(it.productId),
        reason: 'sale',
        note: `Pedido ${order.code} despachado a ${customerName}`,
        userId, userName, at: now,
      });
    }
    const updated: CustomerOrder = { ...order, dispatchedAt: now };
    this._orders.update(list => list.map(o => o.id === orderId ? updated : o));
    this.regenerateAutoAlerts();
    return updated;
  }

  /**
   * Ventas FACTURA un pedido despachado. `lines` indica cuánto se entregó
   * realmente de cada producto; la diferencia con lo despachado (fulfilledQty)
   * se manda a MERMA (problema de entrega). Calcula el monto final facturado.
   */
  invoiceOrder(
    orderId: string,
    lines: Array<{ productId: string; deliveredQty: number }>,
    _userId: string,
    userName: string,
  ): CustomerOrder {
    const order = this.orderById(orderId);
    if (!order) throw new Error('Pedido no encontrado.');
    if (!order.dispatchedAt) throw new Error('Solo se factura un pedido ya despachado.');
    if (order.invoicedAt) throw new Error('Este pedido ya fue facturado.');

    const now = new Date();
    const map = new Map(lines.map(l => [l.productId, Math.max(0, Math.floor(l.deliveredQty))]));
    const customerName = order.customerId ? (this.customerById(order.customerId)?.name ?? 'cliente') : 'cliente';

    let finalAmount = 0;
    const updatedItems = order.items.map(it => {
      const delivered = Math.min(map.get(it.productId) ?? it.fulfilledQty, it.fulfilledQty);
      finalAmount += delivered * it.unitPrice;
      const merma = it.fulfilledQty - delivered;
      if (merma > 0) {
        const lot: ReturnedLot = {
          id: `lot-${Date.now()}-${it.productId}-fact`,
          kind: 'delivery',
          productId: it.productId, productName: it.productName, unit: it.unit,
          qty: merma, mermaQty: merma,
          sourceOrderId: order.id, sourceOrderCode: order.code,
          customerId: order.customerId, customerName,
          customerNote: 'Problema de entrega — no recibido (facturación)',
          createdAt: now, status: 'reviewed', reviewedAt: now, reviewedBy: userName,
        };
        this._returnedLots.update(list => [lot, ...list]);
      }
      return { ...it, receivedQty: delivered };
    });

    const updated: CustomerOrder = { ...order, items: updatedItems, invoicedAt: now, finalAmount };
    this._orders.update(list => list.map(o => o.id === orderId ? updated : o));
    return updated;
  }

  /**
   * Cancela el pedido. Si tenía reservas (estado in_production o ready), las
   * devuelve al stock y registra entradas de kardex de tipo 'in' como reversión.
   */
  cancelOrder(orderId: string, userId: string, userName: string, motivo?: string): CustomerOrder {
    const order = this.orderById(orderId);
    if (!order) throw new Error('Orden no encontrada.');
    if (order.status === 'completed' || order.status === 'cancelled') {
      throw new Error('No se puede cancelar una orden ya completada o cancelada.');
    }

    // Revertir reservas si las había
    for (const r of order.reservations) {
      if (r.kind === 'supply') {
        const stock = this.supplyStockFor(r.itemId);
        const supply = this.supplyById(r.itemId);
        if (!stock || !supply) continue;
        const newQty = stock.quantity + r.qty;
        const newStatus = this.computeStatus(newQty, supply.reorderPoint, supply.minStock);
        this._supplyStock.update(list => list.map(s =>
          s.id === stock.id ? { ...s, quantity: newQty, status: newStatus } : s
        ));
        this.registerKardexEntry({
          id: `k-${Date.now()}-${r.itemId}-${Math.random().toString(36).slice(2, 7)}`,
          supplyId: r.itemId,
          itemName: r.itemName,
          type: 'in',
          qty: r.qty,
          balance: newQty,
          cost: supply.cost,
          reason: 'production_cancel',
          note: `Cancelación pedido ${order.code}${motivo ? ` — ${motivo}` : ''}`,
          userId,
          userName,
          at: new Date(),
        });
      } else {
        const stock = this.productStockFor(r.itemId);
        const product = this.productById(r.itemId);
        if (!stock || !product) continue;
        const newQty = stock.quantity + r.qty;
        const newStatus = this.computeProductStatus(newQty, product.reorderPoint, product.minStock);
        this._productStock.update(list => list.map(s =>
          s.id === stock.id ? { ...s, quantity: newQty, status: newStatus } : s
        ));
        this.registerKardexEntry({
          id: `k-${Date.now()}-${r.itemId}-${Math.random().toString(36).slice(2, 7)}`,
          productId: r.itemId,
          itemName: r.itemName,
          type: 'in',
          qty: r.qty,
          balance: newQty,
          cost: product.buyPrice,
          reason: 'production_cancel',
          note: `Cancelación pedido ${order.code}${motivo ? ` — ${motivo}` : ''}`,
          userId,
          userName,
          at: new Date(),
        });
      }
    }

    const updated: CustomerOrder = {
      ...order,
      status: 'cancelled',
      cancelledAt: new Date(),
      reservations: [],
      items: order.items.map(it => ({ ...it, fulfilledQty: 0 })),
      notes: motivo ? `${order.notes ? order.notes + ' · ' : ''}Cancelado: ${motivo}` : order.notes,
    };
    this._orders.update(list => list.map(o => o.id === orderId ? updated : o));
    this.regenerateAutoAlerts();
    return updated;
  }

  /**
   * Confirmación de recepción por parte del cliente. Recibe el detalle real
   * por producto (cuánto se aceptó de lo entregado).
   *
   * Movimientos por cada item:
   *  1. Salida `sale` por el `fulfilledQty` (entrega total al cliente).
   *  2. Si el cliente reportó menos (`receivedQty < fulfilledQty`), se crea
   *     un `ReturnedLot` `pending` por la diferencia. Las unidades devueltas
   *     NO se reincorporan automáticamente al stock — esperan revisión en la
   *     pantalla de Mermas, donde el admin decide cuánto descartar y cuánto
   *     vuelve al inventario como producto utilizable.
   *
   * El monto final se recalcula con los precios unitarios originales.
   */
  confirmOrderReception(
    orderId: string,
    receipt: Array<{ productId: string; receivedQty: number }>,
    note: string | undefined,
    userId: string,
    userName: string,
  ): CustomerOrder {
    const order = this.orderById(orderId);
    if (!order) throw new Error('Pedido no encontrado.');
    if (order.status !== 'completed') {
      throw new Error('Solo se confirman pedidos ya producidos y completados.');
    }
    if (order.customerConfirmedAt) {
      throw new Error('Este pedido ya fue confirmado por el cliente.');
    }

    const receiptMap = new Map(receipt.map(r => [r.productId, r.receivedQty]));
    const now = new Date();
    let finalAmount = 0;

    const updatedItems: OrderItem[] = order.items.map(it => {
      const raw = receiptMap.get(it.productId);
      const received = Math.max(0, Math.min(raw ?? it.fulfilledQty, it.fulfilledQty));
      finalAmount += received * it.unitPrice;
      return { ...it, receivedQty: received };
    });

    const customerLabel = order.customerId
      ? this.customerById(order.customerId)?.name ?? 'cliente'
      : 'cliente';

    for (const it of updatedItems) {
      const received = it.receivedQty ?? 0;
      const diff = it.fulfilledQty - received;

      const product = this.productById(it.productId);
      if (!product) continue;

      // Asegurar StockItem (productos con receta podrían no tenerlo).
      let stock = this.productStockFor(it.productId);
      if (!stock) {
        stock = {
          id: it.productId,
          productId: it.productId,
          quantity: 0,
          reservedQty: 0,
          status: 'out',
        };
        this._productStock.update(list => [...list, stock!]);
      }

      // 1) Salida total: entrega al cliente del fulfilledQty
      if (it.fulfilledQty > 0) {
        const afterOut = Math.max(0, stock.quantity - it.fulfilledQty);
        const statusAfterOut = this.computeProductStatus(afterOut, product.reorderPoint, product.minStock);
        this._productStock.update(list => list.map(s =>
          s.productId === it.productId ? { ...s, quantity: afterOut, status: statusAfterOut } : s
        ));

        this.registerKardexEntry({
          id: `k-${Date.now()}-${it.productId}-out-${Math.random().toString(36).slice(2, 6)}`,
          productId: it.productId,
          itemName: it.productName,
          type: 'out',
          qty: it.fulfilledQty,
          balance: afterOut,
          cost: this.effectiveProductCost(it.productId),
          reason: 'sale',
          note: `Pedido ${order.code} entregado a ${customerLabel}`,
          userId,
          userName,
          at: now,
        });
      }

      // 2) Devolución: crear ReturnedLot pendiente de revisión (no toca stock).
      if (diff > 0) {
        const lot: ReturnedLot = {
          id: `lot-${Date.now()}-${it.productId}-${Math.random().toString(36).slice(2, 7)}`,
          kind: 'customer_return',
          productId: it.productId,
          productName: it.productName,
          // Las mermas se manejan siempre en unidades, independientemente de
          // la unidad de medida del producto.
          unit: 'unidad',
          qty: diff,
          mermaQty: 0,
          sourceOrderId: order.id,
          sourceOrderCode: order.code,
          customerId: order.customerId,
          customerName: order.customerId ? this.customerById(order.customerId)?.name : undefined,
          customerNote: note?.trim() || undefined,
          createdAt: now,
          status: 'pending',
        };
        this._returnedLots.update(list => [lot, ...list]);
      }
    }

    const updated: CustomerOrder = {
      ...order,
      items: updatedItems,
      customerConfirmedAt: now,
      customerNote: note?.trim() || undefined,
      finalAmount,
    };
    this._orders.update(list => list.map(o => o.id === orderId ? updated : o));
    this.regenerateAutoAlerts();
    return updated;
  }

  /**
   * Procesa un lote devuelto:
   *  - `mermaQty`: cantidad a descartar (0..lot.qty).
   *  - `usableQty = lot.qty - mermaQty`: vuelve al stock como producto
   *    utilizable (kardex `in` con reason `return_from_customer`).
   *  - El lote queda `reviewed`.
   *
   * Si `mermaQty === lot.qty` toda la devolución se descarta y no se mueve
   * stock. Si `mermaQty === 0` se reintegra todo al inventario.
   */
  processReturnedLot(
    lotId: string,
    mermaQty: number,
    reviewNote: string | undefined,
    userId: string,
    userName: string,
  ): ReturnedLot {
    const lot = this._returnedLots().find(l => l.id === lotId);
    if (!lot) throw new Error('Lote de devolución no encontrado.');
    if (lot.status !== 'pending') {
      throw new Error('Este lote ya fue procesado.');
    }
    const merma = Math.max(0, Math.min(Math.floor(mermaQty), lot.qty));
    const usable = lot.qty - merma;
    const product = this.productById(lot.productId);
    if (!product) throw new Error('Producto no encontrado para el lote.');

    // Reintegrar al stock la porción utilizable
    if (usable > 0) {
      let stock = this.productStockFor(lot.productId);
      if (!stock) {
        stock = {
          id: lot.productId,
          productId: lot.productId,
          quantity: 0,
          reservedQty: 0,
          status: 'out',
        };
        this._productStock.update(list => [...list, stock!]);
      }
      const newQty = stock.quantity + usable;
      const newStatus = this.computeProductStatus(newQty, product.reorderPoint, product.minStock);
      this._productStock.update(list => list.map(s =>
        s.productId === lot.productId ? { ...s, quantity: newQty, status: newStatus } : s
      ));

      const customerLabel = lot.customerName ?? 'cliente';
      this.registerKardexEntry({
        id: `k-${Date.now()}-${lot.productId}-reuse-${Math.random().toString(36).slice(2, 6)}`,
        productId: lot.productId,
        itemName: lot.productName,
        type: 'in',
        qty: usable,
        balance: newQty,
        cost: this.effectiveProductCost(lot.productId),
        reason: 'return_from_customer',
        note: `Reintegrado tras revisión — devolución pedido ${lot.sourceOrderCode} (${customerLabel})`
          + (reviewNote?.trim() ? ` · ${reviewNote.trim()}` : ''),
        userId,
        userName,
        at: new Date(),
      });
    }

    const reviewed: ReturnedLot = {
      ...lot,
      mermaQty: merma,
      status: 'reviewed',
      reviewedAt: new Date(),
      reviewedBy: userName,
      reviewNote: reviewNote?.trim() || undefined,
    };
    this._returnedLots.update(list => list.map(l => l.id === lotId ? reviewed : l));
    this.regenerateAutoAlerts();
    return reviewed;
  }

  /**
   * Registra una merma de producción: X unidades de un producto fallaron
   * durante la fabricación y no se pueden vender. NO toca el stock del
   * producto (las unidades nunca entraron a inventario), pero sí descuenta
   * del stock de insumos lo que se gastó produciéndolas (vía `explodeBom`)
   * y registra esas salidas en el kardex con reason `lost`. El lote se
   * crea ya en estado `reviewed` (toda la qty es merma).
   */
  registerProductionMerma(input: {
    productId: string;
    qty: number;
    reason: ProductionMermaReason;
    reasonText?: string;
    reviewNote?: string;
    userId: string;
    userName: string;
  }): ReturnedLot {
    const product = this.productById(input.productId);
    if (!product) throw new Error('Producto no encontrado.');
    if (input.qty <= 0) throw new Error('La cantidad debe ser mayor a cero.');

    const now = new Date();
    const noteFragments = [
      `Merma producción — ${product.name}`,
      input.reasonText ? `Detalle: ${input.reasonText}` : '',
      input.reviewNote ? `Nota: ${input.reviewNote}` : '',
    ].filter(Boolean);
    const kardexNote = noteFragments.join(' · ');

    // Descontar insumos consumidos en la fabricación fallida (solo si tiene receta)
    if (product.hasRecipe) {
      const exploded = this.explodeBom(input.productId, input.qty);
      for (const need of exploded.supplyNeeds) {
        const stock = this.supplyStockFor(need.supplyId);
        const supply = this.supplyById(need.supplyId);
        if (!stock || !supply) continue;
        const newQty = Math.max(0, stock.quantity - need.qty);
        const newStatus = this.computeStatus(newQty, supply.reorderPoint, supply.minStock);
        this._supplyStock.update(list => list.map(s =>
          s.id === stock.id ? { ...s, quantity: newQty, status: newStatus } : s
        ));
        this.registerKardexEntry({
          id: `k-${Date.now()}-${need.supplyId}-merma-${Math.random().toString(36).slice(2, 6)}`,
          supplyId: need.supplyId,
          itemName: need.itemName,
          type: 'out',
          qty: need.qty,
          balance: newQty,
          cost: supply.cost,
          reason: 'lost',
          note: kardexNote,
          userId: input.userId,
          userName: input.userName,
          at: now,
        });
      }
      // Subproductos (reventa interna usada en receta)
      for (const need of exploded.reventaNeeds) {
        const stock = this.productStockFor(need.productId);
        const subProd = this.productById(need.productId);
        if (!stock || !subProd) continue;
        const newQty = Math.max(0, stock.quantity - need.qty);
        const newStatus = this.computeProductStatus(newQty, subProd.reorderPoint, subProd.minStock);
        this._productStock.update(list => list.map(s =>
          s.id === stock.id ? { ...s, quantity: newQty, status: newStatus } : s
        ));
        this.registerKardexEntry({
          id: `k-${Date.now()}-${need.productId}-merma-${Math.random().toString(36).slice(2, 6)}`,
          productId: need.productId,
          itemName: need.itemName,
          type: 'out',
          qty: need.qty,
          balance: newQty,
          cost: subProd.buyPrice,
          reason: 'lost',
          note: kardexNote,
          userId: input.userId,
          userName: input.userName,
          at: now,
        });
      }
    }

    const lot: ReturnedLot = {
      id: `lot-${Date.now()}-${input.productId}-prod-${Math.random().toString(36).slice(2, 6)}`,
      kind: 'production',
      productId: input.productId,
      productName: product.name,
      // Las mermas se manejan siempre en unidades, independientemente de
      // la unidad de medida del producto.
      unit: 'unidad',
      qty: input.qty,
      mermaQty: input.qty,
      productionReason: input.reason,
      productionReasonText: input.reasonText?.trim() || undefined,
      reviewNote: input.reviewNote?.trim() || undefined,
      createdAt: now,
      status: 'reviewed',
      reviewedAt: now,
      reviewedBy: input.userName,
    };
    this._returnedLots.update(list => [lot, ...list]);
    this.regenerateAutoAlerts();
    return lot;
  }

  // ============================================================
  //  Clientes (portal externo)
  // ============================================================

  customerById(id: string): Customer | undefined {
    return this._customers().find(c => c.id === id);
  }

  /**
   * Precio de un producto PARA un cliente: si el cliente tiene un precio
   * personalizado en `productPrices`, se usa ese; sino, el `sellPrice`
   * global del producto. `customer` puede ser el id o el objeto.
   */
  /**
   * Precio de venta a un cliente. Jerarquía:
   *  1. Precio personalizado por cliente (lo fija el admin), si existe.
   *  2. Precio FINAL del catálogo (consumerPrice) — el mismo de ventanilla.
   * (El precio base de producción solo aplica si no hay precio final configurado.)
   */
  priceForCustomer(customer: string | Customer | null | undefined, productId: string): number {
    const c = typeof customer === 'string' ? this.customerById(customer) : customer;
    const custom = c?.productPrices?.[productId];
    if (custom != null && custom >= 0) return custom;
    return this.consumerPrice(productId);
  }

  /** Busca un cliente por su token público (URL /c/:token). */
  customerByToken(token: string): Customer | undefined {
    if (!token) return undefined;
    return this._customers().find(c => c.publicToken === token && c.active);
  }

  /** Valida el PIN del cliente. */
  validateCustomerPin(customerId: string, pin: string): boolean {
    const c = this.customerById(customerId);
    if (!c) return false;
    return c.accessPin === pin;
  }

  /** Genera un token aleatorio de 16 chars hex. */
  private generateToken(): string {
    return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
  }

  /** Genera un PIN de 6 dígitos. */
  private generatePin(): string {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  createCustomer(input: Omit<Customer, 'id' | 'publicToken' | 'accessPin' | 'createdAt'> & {
    publicToken?: string; accessPin?: string;
  }): Customer {
    const c: Customer = {
      ...input,
      id: `cust-${Date.now()}`,
      publicToken: input.publicToken || this.generateToken(),
      accessPin: input.accessPin || this.generatePin(),
      createdAt: new Date(),
    };
    this._customers.update(list => [c, ...list]);
    return c;
  }

  updateCustomer(c: Customer) {
    this._customers.update(list => list.map(x => x.id === c.id ? c : x));
  }

  deleteCustomer(id: string) {
    this._customers.update(list => list.filter(c => c.id !== id));
  }

  /** Regenera el PIN del cliente y devuelve el nuevo PIN. */
  regenerateCustomerPin(id: string): string | null {
    const c = this.customerById(id);
    if (!c) return null;
    const newPin = this.generatePin();
    this.updateCustomer({ ...c, accessPin: newPin });
    return newPin;
  }

  /** Regenera el token del cliente (invalida el link anterior). */
  regenerateCustomerToken(id: string): string | null {
    const c = this.customerById(id);
    if (!c) return null;
    const newToken = this.generateToken();
    this.updateCustomer({ ...c, publicToken: newToken });
    return newToken;
  }

  /**
   * ¿El día actual permite crear pedidos para este cliente?
   * (revisa la ventana de orderDays).
   */
  canCustomerOrderToday(customerId: string): boolean {
    const c = this.customerById(customerId);
    if (!c) return false;
    if (c.window.orderDays.length === 0) return true; // sin restricción
    return c.window.orderDays.includes(new Date().getDay());
  }

  /**
   * Devuelve los productos del catálogo que este cliente puede pedir.
   * Si allowedProductIds está vacío → devuelve todos los productos activos.
   */
  customerProducts(customerId: string): Product[] {
    const c = this.customerById(customerId);
    if (!c) return [];
    if (c.allowedProductIds.length === 0) return this.activeProducts();
    return this.activeProducts().filter(p => c.allowedProductIds.includes(p.id));
  }

  /** Próximo correlativo ORD-NNN basado en los pedidos existentes. */
  private nextOrderCode(): string {
    const nums = this._orders()
      .map(o => Number(o.code.replace(/^ORD-/, '')))
      .filter(n => Number.isFinite(n));
    const next = (nums.length > 0 ? Math.max(...nums) : 0) + 1;
    return `ORD-${String(next).padStart(3, '0')}`;
  }

  // ============================================================
  //  Proveedores
  // ============================================================

  supplierById(id: string): Supplier | undefined {
    return this._suppliers().find(s => s.id === id);
  }

  createSupplier(input: Omit<Supplier, 'id' | 'createdAt'>): Supplier {
    const s: Supplier = {
      ...input,
      id: `sup-${Date.now()}`,
      createdAt: new Date(),
    };
    this._suppliers.update(list => [s, ...list]);
    return s;
  }

  updateSupplier(id: string, patch: Partial<Omit<Supplier, 'id' | 'createdAt'>>): void {
    this._suppliers.update(list => list.map(s => s.id === id ? { ...s, ...patch } : s));
  }

  deleteSupplier(id: string): void {
    this._suppliers.update(list => list.filter(s => s.id !== id));
  }

  /** True si hoy es día de pedidos según la ventana del proveedor. */
  canOrderToSupplierToday(supplierId: string): boolean {
    const s = this.supplierById(supplierId);
    if (!s) return false;
    if (s.orderDays.length === 0) return true;
    return s.orderDays.includes(new Date().getDay());
  }

  /**
   * Lista de proveedores que entregan un insumo específico (N..M).
   * La relación se modela en `Supplier.suppliedItems` — esto solo invierte
   * la query para acceder desde la perspectiva del insumo.
   */
  suppliersForSupply(supplyId: string): Supplier[] {
    return this._suppliers().filter(s =>
      s.suppliedItems.some(i => i.kind === 'supply' && i.itemId === supplyId)
    );
  }

  /**
   * Lista de proveedores que entregan un producto de reventa.
   */
  suppliersForProduct(productId: string): Supplier[] {
    return this._suppliers().filter(s =>
      s.suppliedItems.some(i => i.kind === 'product' && i.itemId === productId)
    );
  }

  /**
   * Sincroniza qué proveedores entregan un insumo y a qué precio. Recibe la
   * lista deseada con su `unitCost` opcional. Actualiza `suppliedItems` en
   * cada proveedor afectado: agrega, quita o actualiza precio según el caso.
   *
   * Si pasás solo strings (ids sin precios), llamá la sobrecarga sin precios.
   */
  setSuppliersForSupply(
    supplyId: string,
    entries: Array<{ supplierId: string; unitCost?: number }>,
  ): void {
    const byId = new Map(entries.map(e => [e.supplierId, e.unitCost]));
    this._suppliers.update(list => list.map(s => {
      const existing = s.suppliedItems.find(i => i.kind === 'supply' && i.itemId === supplyId);
      const shouldHave = byId.has(s.id);
      const wantedCost = byId.get(s.id);

      if (!existing && !shouldHave) return s; // nada que hacer
      if (existing && !shouldHave) {
        // Remover
        return {
          ...s,
          suppliedItems: s.suppliedItems.filter(
            i => !(i.kind === 'supply' && i.itemId === supplyId)
          ),
        };
      }
      if (!existing && shouldHave) {
        // Agregar
        return {
          ...s,
          suppliedItems: [...s.suppliedItems, { kind: 'supply', itemId: supplyId, unitCost: wantedCost }],
        };
      }
      // Actualizar precio si cambió
      if (existing && shouldHave && existing.unitCost !== wantedCost) {
        return {
          ...s,
          suppliedItems: s.suppliedItems.map(i =>
            i.kind === 'supply' && i.itemId === supplyId ? { ...i, unitCost: wantedCost } : i
          ),
        };
      }
      return s;
    }));
    // Tras cualquier cambio en proveedores/precios, refrescar el costo
    // promedio del insumo. Si ningún proveedor tiene precio, queda el manual.
    this.recomputeSupplyCostFromSuppliers(supplyId);
  }

  /**
   * Devuelve el costo unitario que cobra un proveedor específico por un
   * insumo. Cae al `Supply.cost` global si el proveedor no tiene un precio
   * propio asignado.
   */
  supplierUnitCost(supplierId: string, supplyId: string): number {
    const sup = this.supplierById(supplierId);
    const item = sup?.suppliedItems.find(i => i.kind === 'supply' && i.itemId === supplyId);
    if (item?.unitCost != null) return item.unitCost;
    return this.supplyById(supplyId)?.cost ?? 0;
  }

  /**
   * Promedio aritmético de los precios que cobran los proveedores que
   * entregan un insumo. Solo considera entradas con `unitCost` definido.
   * Devuelve `null` si ningún proveedor tiene precio asignado.
   */
  averageSupplierPrice(supplyId: string): number | null {
    const prices: number[] = [];
    for (const s of this._suppliers()) {
      const item = s.suppliedItems.find(i => i.kind === 'supply' && i.itemId === supplyId);
      if (item?.unitCost != null && item.unitCost > 0) prices.push(item.unitCost);
    }
    if (prices.length === 0) return null;
    return prices.reduce((a, b) => a + b, 0) / prices.length;
  }

  /**
   * Recalcula `Supply.cost` como el promedio de los precios de sus
   * proveedores. Si ninguno tiene precio asignado, deja el cost sin tocar
   * (queda el valor manual). Llamar después de modificar suppliedItems.
   */
  recomputeSupplyCostFromSuppliers(supplyId: string): void {
    const avg = this.averageSupplierPrice(supplyId);
    if (avg == null) return;
    const rounded = Math.round(avg * 100) / 100; // 2 decimales
    this._supplies.update(list => list.map(s =>
      s.id === supplyId && s.cost !== rounded ? { ...s, cost: rounded } : s
    ));
  }

  /**
   * Lead time efectivo de un proveedor en `today`, calculado contra su
   * calendario semanal (orderDays + deliveryDays). Si el calendario está
   * vacío, cae al `leadTimeDays` fijo. Útil para mostrar en la UI o para
   * planificar una OC puntual.
   */
  supplierLeadTime(supplierId: string, today: Date = new Date()): LeadTimeResult | null {
    const sup = this.supplierById(supplierId);
    if (!sup) return null;
    return computeSupplierLeadTime(sup, today);
  }

  /**
   * Lead time efectivo de un INSUMO. Toma todos sus proveedores activos,
   * calcula el LT dinámico de cada uno y devuelve el del proveedor que
   * entrega antes desde `today`. Refleja "si necesito el insumo, ¿cuál es
   * la entrega más rápida que puedo conseguir?". Devuelve null si el insumo
   * no tiene proveedores.
   */
  supplyLeadTime(supplyId: string, today: Date = new Date()): (LeadTimeResult & { supplierId: string }) | null {
    const sups = this.suppliersForSupply(supplyId).filter(s => s.active);
    if (sups.length === 0) return null;
    let best: (LeadTimeResult & { supplierId: string }) | null = null;
    for (const s of sups) {
      const lt = computeSupplierLeadTime(s, today);
      if (!best || lt.leadTimeDays < best.leadTimeDays) {
        best = { ...lt, supplierId: s.id };
      }
    }
    return best;
  }
}
