import { Injectable, computed, signal } from '@angular/core';
import {
  Alert, DemandPrediction, KardexEntry, Member, Product,
  PurchaseOrder, Recipe, SaleRecord, StockItem, Supply, SupplyStockItem,
  StockStatus, UserRole, POStatus,
} from '../models';
import {
  MOCK_ALERTS, MOCK_KARDEX, MOCK_MEMBERS, MOCK_PREDICTIONS,
  MOCK_PRODUCTS, MOCK_PRODUCT_STOCK, MOCK_PURCHASE_ORDERS, MOCK_RECIPES,
  MOCK_SALES, MOCK_SUPPLIES, MOCK_SUPPLY_STOCK,
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

    if (product.hasRecipe) {
      const recipe = this.recipeFor(product.id);
      if (recipe) {
        const factor = input.qty / recipe.yieldQty;
        for (const item of recipe.items) {
          const stock = this.supplyStockFor(item.supplyId);
          const supply = this.supplyById(item.supplyId);
          if (!stock || !supply) {
            throw new Error(`Sin stock de ${item.supplyName}.`);
          }
          const needed = item.qty * factor;
          if (stock.quantity < needed) {
            throw new Error(`Stock insuficiente de ${item.supplyName}: ${stock.quantity.toFixed(3)} disponible, ${needed.toFixed(3)} requerido.`);
          }
          const newQty = stock.quantity - needed;
          const newStatus = this.computeStatus(newQty, supply.reorderPoint, supply.minStock);
          this._supplyStock.update(list => list.map(s =>
            s.id === stock.id ? { ...s, quantity: newQty, status: newStatus } : s
          ));
          this.registerKardexEntry({
            id: `k-${Date.now()}-${item.supplyId}`,
            supplyId: item.supplyId,
            itemName: item.supplyName,
            type: 'out',
            qty: needed,
            balance: newQty,
            cost: supply.cost,
            reason: 'sale',
            userId: input.userId,
            userName: input.userName,
            at: new Date(),
          });
        }
      }
    } else {
      const stock = this.productStockFor(input.productId);
      if (!stock || stock.quantity < input.qty) {
        throw new Error(`Stock insuficiente del producto: ${stock?.quantity ?? 0} disponible.`);
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
        cost: product.buyPrice,
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
   *  - Demanda diaria = rollingMean(item, 7 días).
   *  - Llegadas programadas: OCs pending del item con expectedDate dentro del horizonte.
   *
   * Devuelve la trayectoria + fechas clave (cruce ROP, stock 0, día sugerido de orden).
   *
   * NOTA: este método NO considera "boosts" de demanda todavía. Cuando se
   * implemente el sistema de boosts, sustituir `dailyDemand` por
   * `effectiveDailyDemand(itemKind, itemId, day)`.
   */
  simulateBurnDown(itemKind: 'supply' | 'product', itemId: string, horizonDays = 90): {
    trayectoria: number[];
    initialStock: number;
    dailyDemand: number;
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

    const dailyDemand = this.rollingMean(itemKind, itemId, 7);
    const initialStock = item.stock;
    const trayectoria: number[] = [];

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
      stock = Math.max(0, stock - dailyDemand);
    }

    const dayToOrder = dayCrossesReorder !== null
      ? Math.max(0, dayCrossesReorder - item.leadTime)
      : null;

    const stockAtOrderArrival = dayToOrder !== null && dayToOrder + item.leadTime <= horizonDays
      ? trayectoria[dayToOrder + item.leadTime] ?? 0
      : 0;
    const suggestedOrderQty = Math.max(0, item.maxStock - stockAtOrderArrival);

    const daysOfCoverage = dailyDemand > 0 ? initialStock / dailyDemand : 0;

    return {
      trayectoria,
      initialStock,
      dailyDemand,
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
      initialStock: 0,
      dailyDemand: 0,
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

    // Preservar alertas no-auto (manuales, históricas, excess, stockout_risk creadas a mano)
    const manual = existing.filter(a => !a.id.startsWith('auto-restock-'));
    this._alerts.set([...autoNext, ...manual]);
  }
}
