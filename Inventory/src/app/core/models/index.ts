import type { Unit } from '../units';
export type { Unit } from '../units';

export type StockStatus = 'available' | 'low' | 'critical' | 'out';
export type KardexType = 'in' | 'out' | 'adjustment';
export type AlertType = 'restock' | 'stockout_risk' | 'excess';
export type AlertStatus = 'active' | 'acknowledged' | 'resolved';
export type AlertPriority = 'high' | 'medium' | 'low';
/**
 * Roles del sistema:
 *  - admin: SOLO LECTURA en datos operativos (visualiza dashboards y análisis).
 *    Únicas acciones: gestión de miembros y branding.
 *  - sales: encargado de ventas — pedidos, catálogo (lectura), vender, devoluciones
 *  - production: encargado de producción — cola, insumos, recetas, inventario,
 *    ajustes, órdenes de compra, alertas, boosts
 *  - operator: operario de fabricación — ve recetas (lectura) y cola de
 *    producción; puede iniciar y completar órdenes pero NO cancelarlas.
 */
export type UserRole = 'admin' | 'sales' | 'production' | 'operator';
export type POStatus = 'pending' | 'received' | 'cancelled';

export interface Member {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  active: boolean;
}

export interface Company {
  id: string;
  name: string;
  adminEmail: string;
  currency: string;
  timezone: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string;
  category?: string;
  unit: Unit;
  buyPrice: number;
  sellPrice: number;
  leadTime: number;
  imageUrl?: string;
  active: boolean;
  hasRecipe: boolean;
  /**
   * Solo aplica a productos de reventa (hasRecipe=false): umbral por debajo del cual
   * el stock se marca como `low` y se genera alerta de restock. Opcional para no
   * forzar a quien no quiere monitoreo de reorden.
   */
  reorderPoint?: number;
  /**
   * Solo aplica a productos de reventa: si stock <= minStock se marca como `critical`.
   */
  minStock?: number;
}

export interface Supply {
  id: string;
  sku: string;
  name: string;
  description?: string;
  category?: string;
  unit: Unit;
  cost: number;
  minStock: number;
  maxStock: number;
  reorderPoint: number;
  leadTime: number;
  supplier?: string;
  active: boolean;
}

/**
 * Item de una receta. Puede referir a:
 *  - un INSUMO crudo (supplyId definido), o
 *  - un SUBPRODUCTO con su propia receta (productId definido)
 *
 * Exactamente uno de supplyId/productId debe estar presente.
 * `itemName` es el nombre legible cacheado para evitar lookups en UI.
 */
export interface RecipeItem {
  supplyId?: string;
  productId?: string;
  itemName: string;
  qty: number;
  unit: Unit;
}

export interface Recipe {
  id: string;
  productId: string;
  productName: string;
  yieldQty: number;
  items: RecipeItem[];
  /** Observaciones / notas de preparación, tiempos, advertencias. Opcional. */
  notes?: string;
}

export interface StockItem {
  id: string;
  productId: string;
  quantity: number;
  reservedQty: number;
  status: StockStatus;
}

export interface SupplyStockItem {
  id: string;
  supplyId: string;
  quantity: number;
  status: StockStatus;
}

export interface KardexEntry {
  id: string;
  productId?: string;
  supplyId?: string;
  itemName: string;
  type: KardexType;
  qty: number;
  balance: number;
  cost?: number;
  reason: string;
  note?: string;
  userId: string;
  userName: string;
  at: Date;
}

export interface SaleRecord {
  id: string;
  productId: string;
  productName: string;
  qty: number;
  unitPrice: number;
  total: number;
  dayOfWeek: number;
  month: number;
  date: Date;
  isOutlier: boolean;
  zScore?: number;
}

export interface Alert {
  id: string;
  type: AlertType;
  status: AlertStatus;
  priority: AlertPriority;
  productId?: string;
  supplyId?: string;
  itemName: string;
  message: string;
  currentQty?: number;
  reorderPoint?: number;
  projectedStockoutDate?: Date;
  projectedDaysUntilStockout?: number;
  excessValue?: number;
  createdAt: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolvedAt?: Date;
  resolvedBy?: string;
}

// =========================================================
//  Demand Boost (override administrativo de la demanda)
// =========================================================

export type BoostMode =
  | 'multiplier'   // demanda diaria = histórico × value
  | 'absoluteAdd'  // demanda diaria = histórico + value (u/día)
  | 'eventTotal';  // se consumirán value unidades en TODO el período

export type BoostReason =
  | 'promo'
  | 'evento'
  | 'contrato'
  | 'feriado'
  | 'campaña'
  | 'otro';

export type BoostStatus = 'active' | 'expired' | 'cancelled';

/**
 * Override declarativo de la demanda esperada para un item durante un período.
 * Se aplica a:
 *  - regenerateRestockAlerts (lookahead)
 *  - simulateBurnDown (consumo diario)
 *  - PredictionService.simulateLocally (trayectoria 180d)
 *
 * `status='expired'` se calcula on-the-fly por activeBoosts() en runtime —
 * lo guardado es 'active' o 'cancelled'.
 */
export interface DemandBoost {
  id: string;
  itemKind: 'supply' | 'product';
  itemId: string;
  itemName: string;       // cacheado al crear para evitar lookups
  startDate: Date;
  endDate: Date;
  mode: BoostMode;
  value: number;
  reason: BoostReason;
  description?: string;
  status: BoostStatus;
  createdAt: Date;
  createdBy: string;
}

// =========================================================
//  Predicción IA (Modelos LightGBM)
// =========================================================

export type PredictionDecision =
  | 'ORDENAR_URGENTE'
  | 'EVALUAR_ORDEN'
  | 'STOCK_SUFICIENTE'
  | 'SOBRESTOCK'
  | 'CRITICO_BAJO_MINIMO';

/** Estado semántico derivado (para clasificar visualmente sin imponer colores). */
export type PredictionStatus = 'critico' | 'critico_extremo' | 'alerta' | 'optimo' | 'informativo';

/** Payload exacto enviado a POST /api/predict. */
export interface PredictionRequest {
  actual_stock: number;
  dias_desde_ultimo_restock: number;
  rolling_mean_7d: number;
  rolling_mean_14d: number;
  rolling_mean_30d: number;
  rolling_std_7d: number;
  lt_avg: number;
  lt_std: number;
  dia_semana_num: number;   // 1..7
  mes_num: number;          // 1..12
  stock_min: number;
  stock_max: number;
  reorder_point_manual: number;
}

export interface PredictionOrden {
  urgencia: number;          // 0..1
  cantidad_modelo: number;
  cantidad_final: number;
  decision: PredictionDecision;
}

export interface PredictionStockProyeccion {
  t7: number;
  t14: number;
  t30: number;
  t60: number;
}

export interface PredictionEvent {
  trigger: number;   // día en que se dispara la orden
  arrival: number;   // día en que llega el stock
  qty: number;
}

export interface PredictionSimulacion {
  trayectoria: number[];     // 181 valores (días 0..180)
  eventos: PredictionEvent[];
}

export interface PredictionDerivados {
  safety_stock: number;
  reorder_point: number;
  dias_cobertura: number;
  tendencia: number;
  stock_ratio: number;
}

export interface PredictionResponse {
  orden: PredictionOrden;
  stock_proyeccion: PredictionStockProyeccion;
  simulacion: PredictionSimulacion;
  derivados: PredictionDerivados;
}

export interface DemandPrediction {
  id: string;
  productId: string;
  productName: string;
  modelType: 'linear_regression' | 'decision_tree';
  predictedValue: number;
  lowerBound: number;
  upperBound: number;
  forDate: Date;
  mse: number;
  r2: number;
  mae: number;
  featureImportance?: Record<string, number>;
}

export interface PurchaseOrderItem {
  /**
   * Una línea de OC representa O un insumo O un producto de reventa.
   * Exactamente uno de supplyId / productId debe estar definido.
   */
  supplyId?: string;
  productId?: string;
  /** Nombre legible para mostrar (cacheado al crear la OC). */
  itemName: string;
  qty: number;
  unitCost: number;
  receivedQty?: number;
}

export interface PurchaseOrder {
  id: string;
  code: string;
  supplier: string;
  status: POStatus;
  items: PurchaseOrderItem[];
  totalCost: number;
  expectedDate?: Date;
  receivedAt?: Date;
  createdAt: Date;
}

// =========================================================
//  Devoluciones (Ventas → Producción)
// =========================================================

/**
 * Motivos por los que ventas devuelve producto terminado a producción.
 * El stock siempre sale del inventario disponible al registrar la devolución.
 */
export type ReturnReason =
  | 'defective'   // mal hecho, quemado, mal cocido
  | 'expired'     // vencido o en mal estado
  | 'leftover'    // sobra de fin de día
  | 'damaged'     // golpe, caída, mojadura
  | 'other';

export interface ProductReturn {
  id: string;
  productId: string;
  productName: string;
  qty: number;
  unit: Unit;
  reason: ReturnReason;
  notes?: string;
  /** Costo unitario al momento de devolver (snapshot para reporting). */
  costAtReturn: number;
  /** qty * costAtReturn — pérdida estimada del lote devuelto. */
  totalLoss: number;
  createdAt: Date;
  createdBy: string;
}

// =========================================================
//  Pedidos (Ventas → Producción)
// =========================================================

/**
 * Ciclo de vida de una orden de producción interna:
 *  - pending: ventas la registró, producción aún no la procesa
 *  - in_production: producción reservó insumos disponibles; pueden faltar
 *  - completed: producción terminó la fabricación y el stock del producto
 *    terminado fue actualizado. La orden queda cerrada — la venta al consumidor
 *    final es un evento separado que descuenta del stock.
 *  - cancelled: cancelada; libera reservas si las había
 */
export type OrderStatus = 'pending' | 'in_production' | 'completed' | 'cancelled';

/**
 * Reserva concreta de stock realizada al iniciar producción.
 * Es lo que efectivamente se descontó (cumplimiento parcial: puede ser menor a lo pedido).
 */
export interface OrderReservation {
  kind: 'supply' | 'product';
  itemId: string;
  itemName: string;
  /** Unidad de medida del insumo/producto reservado. */
  unit: Unit;
  qty: number;
}

/**
 * Item solicitado en un pedido. `fulfilledQty` registra cuántas unidades del
 * producto se han podido reservar/producir (0 si aún no se inició producción,
 * menor a `qty` si hubo faltante de insumos).
 */
export interface OrderItem {
  productId: string;
  productName: string;
  /** Unidad del producto (unidad, kg, L, etc.) — cacheada al crear el pedido. */
  unit: Unit;
  qty: number;
  unitPrice: number;
  fulfilledQty: number;
}

/**
 * Faltante detectado al iniciar producción: lo que se requería vs lo que había.
 * Útil para que producción genere OC o avise a compras.
 */
export interface OrderShortfall {
  kind: 'supply' | 'product';
  itemId: string;
  itemName: string;
  /** Unidad de medida del insumo/producto (kg, L, unidad, etc.). */
  unit: Unit;
  required: number;
  available: number;
  short: number;
  /** Sugerencia: el item del pedido que generó el faltante (productId). */
  forProductId?: string;
}

/**
 * Orden de producción interna creada por ventas para organizar el trabajo
 * de fábrica/cocina. NO representa un compromiso de entrega a cliente externo;
 * el producto fabricado queda en stock disponible para vender después.
 */
export interface CustomerOrder {
  id: string;
  code: string;
  /** Motivo o destino interno del lote (ej: "Reposición stock", "Evento Sub-30"). Opcional. */
  purpose?: string;
  status: OrderStatus;
  items: OrderItem[];
  totalAmount: number;
  notes?: string;
  createdAt: Date;
  createdBy: string;
  /** Reservas activas (poblado al pasar a in_production, vaciado al cancelar). */
  reservations: OrderReservation[];
  /** Snapshot del análisis hecho al iniciar producción. */
  shortfalls: OrderShortfall[];
  productionStartedAt?: Date;
  /** Cuándo producción terminó y se sumó al stock de producto terminado. */
  completedAt?: Date;
  cancelledAt?: Date;
}
