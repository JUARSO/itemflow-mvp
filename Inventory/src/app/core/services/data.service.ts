import { Injectable, computed, signal } from '@angular/core';
import {
  Alert, CustomerOrder, DemandBoost, DemandPrediction, KardexEntry, Member,
  OrderItem, OrderReservation, OrderShortfall, OrderStatus, Product,
  ProductReturn, PurchaseOrder, Recipe, ReturnReason, SaleRecord, StockItem,
  Supply, SupplyStockItem, StockStatus, UserRole, POStatus,
} from '../models';
import {
  MOCK_ALERTS, MOCK_KARDEX, MOCK_MEMBERS, MOCK_ORDERS, MOCK_PREDICTIONS,
  MOCK_PRODUCTS, MOCK_PRODUCT_STOCK, MOCK_PURCHASE_ORDERS, MOCK_RECIPES,
  MOCK_RETURNS, MOCK_SALES, MOCK_SUPPLIES, MOCK_SUPPLY_STOCK,
} from '../mocks/dummy-data';

/**
 * Servicio único in-memory para el MVP.
 * Reemplazar por servicios Firebase cuando se conecte el backend real.
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
  private readonly _boosts = signal<DemandBoost[]>([]);
  private readonly _orders = signal<CustomerOrder[]>([...MOCK_ORDERS]);
  private readonly _returns = signal<ProductReturn[]>([...MOCK_RETURNS]);

  constructor() {
    // Sembrar alertas auto-derivadas a partir del stock inicial.
    this.regenerateRestockAlerts();
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
  readonly boosts = this._boosts.asReadonly();
  readonly orders = this._orders.asReadonly();

  /** Órdenes que aún están abiertas en el flujo (no completadas ni canceladas). */
  readonly openOrders = computed(() =>
    this._orders().filter(o => o.status === 'pending' || o.status === 'in_production')
  );
  readonly pendingOrders = computed(() =>
    this._orders().filter(o => o.status === 'pending')
  );
  readonly inProductionOrders = computed(() =>
    this._orders().filter(o => o.status === 'in_production')
  );
  readonly completedOrders = computed(() =>
    this._orders().filter(o => o.status === 'completed')
  );

  readonly returns = this._returns.asReadonly();

  /**
   * Boosts no cancelados cuyo período cubre la fecha actual o el futuro
   * (no expirados todavía). Útil para mostrar listas y badges.
   */
  readonly activeBoosts = computed(() => {
    const now = Date.now();
    return this._boosts().filter(b => b.status === 'active' && b.endDate.getTime() >= now);
  });

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
    if (product.hasRecipe) {
      const calc = this.computeRecipeCost(productId);
      return calc ?? product.buyPrice;
    }
    return product.buyPrice;
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
      this.regenerateRestockAlerts();
    }
    return product;
  }

  updateProduct(p: Product) {
    this._products.update(list => list.map(x => x.id === p.id ? p : x));
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
      this.regenerateRestockAlerts();
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

  /** Crea N insumos + sus filas de stock inicial en cero. */
  createSuppliesBulk(inputs: Omit<Supply, 'id'>[]) {
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
      this.regenerateRestockAlerts();
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
  //  Ventas
  // ============================================================
  /**
   * Registra una venta al cliente final: descuenta del stock del producto
   * terminado (poblado por producción al completar órdenes) y genera el
   * SaleRecord para histórico/predicción.
   *
   * Ya NO explosiona BOM: los insumos se descuentan durante la fabricación
   * (en startProduction), no al vender. El producto terminado tiene su propio
   * stock que se incrementa cuando producción completa una orden.
   */
  registerSale(input: {
    productId: string; qty: number; unitPrice: number;
    userId: string; userName: string;
  }): SaleRecord {
    const product = this.productById(input.productId);
    if (!product) throw new Error('Producto no encontrado.');

    const sale: SaleRecord = {
      id: `sale-${Date.now()}`,
      productId: input.productId,
      productName: product.name,
      qty: input.qty,
      unitPrice: input.unitPrice,
      total: input.qty * input.unitPrice,
      dayOfWeek: new Date().getDay(),
      month: new Date().getMonth() + 1,
      date: new Date(),
      isOutlier: false,
    };

    {
      const stock = this.productStockFor(input.productId);
      if (!stock || stock.quantity < input.qty) {
        throw new Error(`Stock insuficiente: ${stock?.quantity ?? 0} disponible, ${input.qty} solicitadas. Fabrica una orden de producción primero.`);
      }
      const newQty = stock.quantity - input.qty;
      const newStatus = this.computeProductStatus(newQty, product.reorderPoint, product.minStock);
      this._productStock.update(list => list.map(s =>
        s.id === stock.id ? { ...s, quantity: newQty, status: newStatus } : s
      ));
      this.registerKardexEntry({
        id: `k-${Date.now()}-${product.id}`,
        productId: product.id,
        itemName: product.name,
        type: 'out',
        qty: input.qty,
        balance: newQty,
        // Usar costo efectivo (incluye cálculo desde receta si aplica).
        cost: this.effectiveProductCost(product.id),
        reason: 'sale',
        userId: input.userId,
        userName: input.userName,
        at: new Date(),
      });
    }

    this._sales.update(list => [sale, ...list]);
    this.regenerateRestockAlerts();
    return sale;
  }

  /**
   * Importa ventas históricas sin tocar stock ni kardex.
   * Pensado para migrar data desde otro sistema o cargar histórico para predicciones.
   */
  createSalesBulk(sales: SaleRecord[]) {
    this._sales.update(list => [...sales, ...list]);
  }

  /**
   * Registra múltiples ventas como una sola transacción atómica:
   *  1. Valida que TODOS los items tengan stock suficiente
   *  2. Si alguno falla, no se descuenta nada (rollback implícito)
   *  3. Si todos pasan, descuenta stock + kardex + crea SaleRecord(s)
   *
   * Soporta varias líneas del mismo producto (las suma para validación).
   */
  registerSalesBatch(input: {
    items: { productId: string; qty: number; unitPrice: number }[];
    userId: string; userName: string;
  }): SaleRecord[] {
    if (input.items.length === 0) {
      throw new Error('El carrito está vacío.');
    }

    // Agregar requeridos por producto (para validar contra stock disponible total)
    const required = new Map<string, number>();
    for (const it of input.items) {
      required.set(it.productId, (required.get(it.productId) ?? 0) + it.qty);
    }

    // Validación previa: TODO o nada
    for (const [productId, qty] of required) {
      const product = this.productById(productId);
      if (!product) throw new Error(`Producto no encontrado.`);
      const stock = this.productStockFor(productId);
      const have = stock?.quantity ?? 0;
      if (have < qty) {
        throw new Error(`Stock insuficiente de "${product.name}": ${have} disponible, ${qty} requerido.`);
      }
    }

    // Aplicar mutaciones
    const now = new Date();
    const created: SaleRecord[] = [];
    for (const it of input.items) {
      const product = this.productById(it.productId)!;
      const stock = this.productStockFor(it.productId)!;
      const newQty = stock.quantity - it.qty;
      const newStatus = this.computeProductStatus(newQty, product.reorderPoint, product.minStock);
      this._productStock.update(list => list.map(s =>
        s.id === stock.id ? { ...s, quantity: newQty, status: newStatus } : s
      ));
      this.registerKardexEntry({
        id: `k-${Date.now()}-${product.id}-${Math.random().toString(36).slice(2, 7)}`,
        productId: product.id,
        itemName: product.name,
        type: 'out',
        qty: it.qty,
        balance: newQty,
        cost: this.effectiveProductCost(product.id),
        reason: 'sale',
        userId: input.userId,
        userName: input.userName,
        at: now,
      });
      const sale: SaleRecord = {
        id: `sale-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        productId: product.id,
        productName: product.name,
        qty: it.qty,
        unitPrice: it.unitPrice,
        total: it.qty * it.unitPrice,
        dayOfWeek: now.getDay(),
        month: now.getMonth() + 1,
        date: now,
        isOutlier: false,
      };
      created.push(sale);
    }
    this._sales.update(list => [...created, ...list]);
    this.regenerateRestockAlerts();
    return created;
  }

  // ============================================================
  //  Movimientos manuales de stock
  // ============================================================
  registerKardexEntry(entry: KardexEntry) {
    this._kardex.update(list => [entry, ...list]);
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
    this.regenerateRestockAlerts();
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
    this.regenerateRestockAlerts();
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
    this.regenerateRestockAlerts();
  }

  // ============================================================
  //  Demand Boosts (overrides administrativos de demanda)
  // ============================================================

  /**
   * Registra un nuevo boost de demanda. El status inicial siempre es 'active';
   * `activeBoosts` filtra automáticamente los expirados por fecha.
   */
  createBoost(input: Omit<DemandBoost, 'id' | 'status' | 'createdAt'>): DemandBoost {
    const boost: DemandBoost = {
      ...input,
      id: `boost-${Date.now()}`,
      status: 'active',
      createdAt: new Date(),
    };
    this._boosts.update(list => [boost, ...list]);
    this.regenerateRestockAlerts();
    return boost;
  }

  cancelBoost(id: string) {
    this._boosts.update(list => list.map(b =>
      b.id === id ? { ...b, status: 'cancelled' as const } : b
    ));
    this.regenerateRestockAlerts();
  }

  deleteBoost(id: string) {
    this._boosts.update(list => list.filter(b => b.id !== id));
    this.regenerateRestockAlerts();
  }

  /** Boosts activos que aplican a un item específico. */
  boostsForItem(itemKind: 'supply' | 'product', itemId: string): DemandBoost[] {
    return this.activeBoosts().filter(b => b.itemKind === itemKind && b.itemId === itemId);
  }

  /**
   * Demanda diaria efectiva para un item en una fecha futura.
   *
   * Reglas:
   *  - Los boosts SIEMPRE son de productos (no insumos directos).
   *  - Para un PRODUCTO de reventa (hasRecipe=false): los boosts directos del
   *    producto modifican su consumo propio.
   *  - Para un INSUMO: la demanda extra surge de las recetas de los productos
   *    con boost activo. Cada unidad extra del producto consume `qty/yield`
   *    del insumo según su receta. Sin propagación si el producto es reventa.
   *
   * Modos:
   *  - multiplier  → demanda extra = base × (value - 1)
   *  - absoluteAdd → demanda extra = value (u/día)
   *  - eventTotal  → demanda extra = value / días_rango (u/día durante el período)
   */
  effectiveDailyDemand(itemKind: 'supply' | 'product', itemId: string, dayOffset: number): number {
    const base = this.rollingMean(itemKind, itemId, 7);
    const target = new Date();
    target.setHours(0, 0, 0, 0);
    target.setDate(target.getDate() + dayOffset);
    const targetTs = target.getTime();

    // Helper: ¿este boost cubre la fecha objetivo? Devuelve días del rango si sí.
    const boostCoversDate = (b: DemandBoost): number => {
      const start = new Date(b.startDate); start.setHours(0, 0, 0, 0);
      const end = new Date(b.endDate); end.setHours(23, 59, 59, 999);
      if (targetTs < start.getTime() || targetTs > end.getTime()) return 0;
      return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
    };

    // Helper: demanda extra por día del producto según el boost.
    const productExtraPerDay = (b: DemandBoost, productBaseDemand: number, rangeDays: number): number => {
      switch (b.mode) {
        case 'multiplier':  return productBaseDemand * Math.max(0, b.value - 1);
        case 'absoluteAdd': return b.value;
        case 'eventTotal':  return b.value / rangeDays;
      }
    };

    if (itemKind === 'product') {
      // Boost directo al producto (reventa o con receta, igual lo respetamos).
      const boosts = this.boostsForItem('product', itemId);
      if (boosts.length === 0) return base;

      let result = base;
      for (const b of boosts) {
        const days = boostCoversDate(b);
        if (days === 0) continue;
        if (b.mode === 'multiplier') {
          result = result * b.value;
        } else if (b.mode === 'absoluteAdd') {
          result += b.value;
        } else {
          result += b.value / days;
        }
      }
      return Math.max(0, result);
    }

    // itemKind === 'supply' → propagación vía receta
    let extra = 0;
    const products = this._products();
    for (const boost of this.activeBoosts()) {
      // Skip boosts que no son de producto (no debería haber, pero defensivo)
      if (boost.itemKind !== 'product') continue;
      const days = boostCoversDate(boost);
      if (days === 0) continue;

      const product = products.find(p => p.id === boost.itemId);
      if (!product || !product.hasRecipe) continue;  // reventa no propaga

      const recipe = this.recipeFor(product.id);
      if (!recipe) continue;

      // ¿esta receta usa nuestro insumo?
      const recipeItem = recipe.items.find(ri => ri.supplyId === itemId);
      if (!recipeItem) continue;

      // Demanda extra de producto por día
      const productBase = this.rollingMean('product', product.id, 7);
      const extraProductPerDay = productExtraPerDay(boost, productBase, days);

      // Cada unidad extra de producto consume (item.qty / recipe.yieldQty) del insumo
      const consumptionPerProductUnit = recipeItem.qty / Math.max(1, recipe.yieldQty);
      extra += extraProductPerDay * consumptionPerProductUnit;
    }

    return Math.max(0, base + extra);
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
    /** Boosts activos que tocan el horizonte (para UI). */
    activeBoostsInHorizon: DemandBoost[];
  } {
    // Estado base del item
    let item: { stock: number; reorderPoint: number; minStock: number; maxStock: number; leadTime: number } | null = null;
    if (itemKind === 'supply') {
      const s = this.supplyById(itemId);
      if (!s) return this.emptyBurnDown();
      const stockItem = this.supplyStockFor(itemId);
      item = {
        stock: stockItem?.quantity ?? 0,
        reorderPoint: s.reorderPoint,
        minStock: s.minStock,
        maxStock: s.maxStock,
        leadTime: s.leadTime,
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

    // Boosts que tocan el horizonte
    const horizonEnd = now + horizonDays * 86_400_000;
    const activeBoostsInHorizon = this.boostsForItem(itemKind, itemId).filter(b =>
      b.endDate.getTime() >= now && b.startDate.getTime() <= horizonEnd
    );

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
      activeBoostsInHorizon,
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
      activeBoostsInHorizon: [],
    };
  }

  // ============================================================
  //  Estadísticas de demanda (para Predicciones IA)
  // ============================================================

  /**
   * Calcula el promedio diario de consumo en los últimos N días.
   *  - Para `supply`: usa entradas de kardex tipo `out` (incluye ventas vía receta
   *    y mermas).
   *  - Para `product` (de reventa): usa registros de venta directos.
   * Si no hay actividad en la ventana, devuelve 0.
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
    return this._sales()
      .filter(s => s.productId === itemId && s.date.getTime() >= cutoff)
      .reduce((s, x) => s + x.qty, 0);
  }

  /** Devuelve un array de N elementos con el consumo de cada día (día 0 = más antiguo). */
  private dailyConsumption(itemKind: 'supply' | 'product', itemId: string, windowDays: number): number[] {
    const buckets = new Array<number>(windowDays).fill(0);
    const now = Date.now();
    const items: { at: Date; qty: number }[] = itemKind === 'supply'
      ? this._kardex()
          .filter(k => k.supplyId === itemId && k.type === 'out')
          .map(k => ({ at: k.at, qty: k.qty }))
      : this._sales()
          .filter(s => s.productId === itemId)
          .map(s => ({ at: s.date, qty: s.qty }));
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
   * Re-deriva las alertas auto-generadas de restock a partir del stock actual.
   * Convención: ids con prefijo `auto-` son administradas por esta función; los
   * demás (excess, stockout_risk manual, históricas) se preservan intactos.
   *
   * Se llama después de toda mutación de stock (venta, recepción, ajuste, OC recibida).
   */
  regenerateRestockAlerts() {
    const supplies = this._supplies();
    const products = this._products();
    const supplyStock = this._supplyStock();
    const productStock = this._productStock();
    const existing = this._alerts();

    const autoNext: Alert[] = [];

    // Insumos
    for (const stock of supplyStock) {
      if (stock.status === 'available') continue;
      const sup = supplies.find(s => s.id === stock.supplyId);
      if (!sup || !sup.active) continue;
      const priority: 'high' | 'medium' | 'low' = stock.status === 'out' || stock.status === 'critical' ? 'high' : 'medium';
      const id = `auto-restock-supply-${stock.supplyId}`;
      const prev = existing.find(a => a.id === id);
      autoNext.push({
        id,
        type: 'restock',
        status: prev?.status === 'acknowledged' ? 'acknowledged' : 'active',
        priority,
        supplyId: stock.supplyId,
        itemName: sup.name,
        message: `Stock ${stock.status === 'out' ? 'agotado' : stock.status === 'critical' ? 'crítico' : 'bajo punto de reorden'}: ${stock.quantity} ${sup.unit} (reorden ${sup.reorderPoint}).`,
        currentQty: stock.quantity,
        reorderPoint: sup.reorderPoint,
        createdAt: prev?.createdAt ?? new Date(),
        acknowledgedAt: prev?.acknowledgedAt,
        acknowledgedBy: prev?.acknowledgedBy,
      });
    }

    // Productos de reventa
    for (const stock of productStock) {
      if (stock.status === 'available') continue;
      const prod = products.find(p => p.id === stock.productId);
      if (!prod || !prod.active || prod.hasRecipe) continue;
      if (prod.reorderPoint == null && stock.status !== 'out') continue; // sin umbral, solo alertar si agotado
      const priority: 'high' | 'medium' | 'low' = stock.status === 'out' || stock.status === 'critical' ? 'high' : 'medium';
      const id = `auto-restock-product-${stock.productId}`;
      const prev = existing.find(a => a.id === id);
      autoNext.push({
        id,
        type: 'restock',
        status: prev?.status === 'acknowledged' ? 'acknowledged' : 'active',
        priority,
        productId: stock.productId,
        itemName: prod.name,
        message: `Stock ${stock.status === 'out' ? 'agotado' : stock.status === 'critical' ? 'crítico' : 'bajo punto de reorden'}: ${stock.quantity} ${prod.unit}${prod.reorderPoint != null ? ` (reorden ${prod.reorderPoint})` : ''}. Producto de reventa — generar OC al proveedor.`,
        currentQty: stock.quantity,
        reorderPoint: prod.reorderPoint,
        createdAt: prev?.createdAt ?? new Date(),
        acknowledgedAt: prev?.acknowledgedAt,
        acknowledgedBy: prev?.acknowledgedBy,
      });
    }

    // Pasada extra: alertas proactivas por boosts activos.
    // Si un boost va a tirar el stock por debajo del ROP dentro del lookahead
    // (= lead time + 3 días buffer), emitir alerta aunque el stock actual esté OK.
    // Estas alertas usan prefijo `auto-restock-boost-` para no duplicar las normales.
    for (const boost of this.activeBoosts()) {
      const sameKindKey = `${boost.itemKind}-${boost.itemId}`;
      const normalAlertId = `auto-restock-${sameKindKey}`;
      // Si ya hay una alerta normal para este item, skip (más prioritaria).
      if (autoNext.some(a => a.id === normalAlertId)) continue;

      // Stock + datos del item
      let stockNow = 0; let ropItem = 0; let leadTime = 0; let unit = ''; let itemName = boost.itemName;
      if (boost.itemKind === 'supply') {
        const s = supplies.find(x => x.id === boost.itemId);
        if (!s || !s.active) continue;
        const stk = supplyStock.find(x => x.supplyId === boost.itemId);
        stockNow = stk?.quantity ?? 0;
        ropItem = s.reorderPoint; leadTime = s.leadTime; unit = s.unit; itemName = s.name;
      } else {
        const p = products.find(x => x.id === boost.itemId);
        if (!p || !p.active || p.hasRecipe) continue;
        if (p.reorderPoint == null) continue;
        const stk = productStock.find(x => x.productId === boost.itemId);
        stockNow = stk?.quantity ?? 0;
        ropItem = p.reorderPoint; leadTime = p.leadTime; unit = p.unit; itemName = p.name;
      }

      const lookahead = Math.max(leadTime + 3, 7);
      let projected = stockNow;
      for (let d = 0; d < lookahead; d++) {
        projected -= this.effectiveDailyDemand(boost.itemKind, boost.itemId, d);
        if (projected < 0) projected = 0;
      }
      if (projected >= ropItem) continue; // el stock aguanta con el boost

      const id = `auto-restock-boost-${sameKindKey}`;
      const prev = existing.find(a => a.id === id);
      autoNext.push({
        id,
        type: 'stockout_risk',
        status: prev?.status === 'acknowledged' ? 'acknowledged' : 'active',
        priority: 'high',
        ...(boost.itemKind === 'supply' ? { supplyId: boost.itemId } : { productId: boost.itemId }),
        itemName,
        message: `Boost activo "${boost.reason}" va a llevar el stock de ${Math.round(stockNow)} a ~${Math.round(projected)} ${unit} en ${lookahead} días (ROP: ${ropItem}). Considera generar OC anticipada.`,
        currentQty: stockNow,
        reorderPoint: ropItem,
        projectedDaysUntilStockout: lookahead,
        createdAt: prev?.createdAt ?? new Date(),
        acknowledgedAt: prev?.acknowledgedAt,
        acknowledgedBy: prev?.acknowledgedBy,
      });
    }

    // Preservar alertas no-auto (manuales, históricas, excess, stockout_risk creadas a mano)
    const manual = existing.filter(a => !a.id.startsWith('auto-restock-'));
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
      id: `ord-${Date.now()}`,
      code,
      purpose: input.purpose?.trim() || undefined,
      status: 'pending',
      items: orderItems,
      totalAmount: total,
      notes: input.notes,
      createdAt: new Date(),
      createdBy: input.userName,
      reservations: [],
      shortfalls: [],
    };
    this._orders.update(list => [order, ...list]);
    return order;
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
    this.regenerateRestockAlerts();
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
    this.regenerateRestockAlerts();
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
    this.regenerateRestockAlerts();
    return updated;
  }

  // ============================================================
  //  Devoluciones (Ventas → Producción)
  // ============================================================

  /**
   * Registra una devolución de producto terminado a producción.
   * Descuenta del stock disponible y genera kardex `out` con reason
   * 'return_to_production'. La pérdida monetaria se calcula con el costo
   * efectivo del producto al momento de devolver.
   */
  registerReturn(input: {
    productId: string;
    qty: number;
    reason: ReturnReason;
    notes?: string;
    userId: string;
    userName: string;
  }): ProductReturn {
    if (input.qty <= 0) throw new Error('La cantidad debe ser mayor a 0.');
    const product = this.productById(input.productId);
    if (!product) throw new Error('Producto no encontrado.');
    const stock = this.productStockFor(input.productId);
    const have = stock?.quantity ?? 0;
    if (have < input.qty) {
      throw new Error(`Stock insuficiente de "${product.name}": ${have} disponible, ${input.qty} a devolver.`);
    }

    const newQty = have - input.qty;
    const newStatus = this.computeProductStatus(newQty, product.reorderPoint, product.minStock);
    this._productStock.update(list => list.map(s =>
      s.id === stock!.id ? { ...s, quantity: newQty, status: newStatus } : s
    ));

    const costAtReturn = this.effectiveProductCost(input.productId);
    const totalLoss = +(costAtReturn * input.qty).toFixed(2);

    this.registerKardexEntry({
      id: `k-${Date.now()}-${product.id}-ret`,
      productId: product.id,
      itemName: product.name,
      type: 'out',
      qty: input.qty,
      balance: newQty,
      cost: costAtReturn,
      reason: 'return_to_production',
      note: `Devolución (${input.reason})${input.notes ? ' — ' + input.notes : ''}`,
      userId: input.userId,
      userName: input.userName,
      at: new Date(),
    });

    const ret: ProductReturn = {
      id: `ret-${Date.now()}`,
      productId: product.id,
      productName: product.name,
      qty: input.qty,
      unit: product.unit,
      reason: input.reason,
      notes: input.notes?.trim() || undefined,
      costAtReturn,
      totalLoss,
      createdAt: new Date(),
      createdBy: input.userName,
    };
    this._returns.update(list => [ret, ...list]);
    this.regenerateRestockAlerts();
    return ret;
  }

  /** Próximo correlativo ORD-NNN basado en los pedidos existentes. */
  private nextOrderCode(): string {
    const nums = this._orders()
      .map(o => Number(o.code.replace(/^ORD-/, '')))
      .filter(n => Number.isFinite(n));
    const next = (nums.length > 0 ? Math.max(...nums) : 0) + 1;
    return `ORD-${String(next).padStart(3, '0')}`;
  }
}
