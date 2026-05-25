import type { Unit } from '../units';
export type { Unit } from '../units';

export type StockStatus = 'available' | 'low' | 'critical' | 'out';
export type KardexType = 'in' | 'out' | 'adjustment';
export type AlertType = 'restock' | 'stockout_risk' | 'excess';
export type AlertStatus = 'active' | 'acknowledged' | 'resolved';
export type AlertPriority = 'high' | 'medium' | 'low';
/**
 * Roles del sistema:
 *  - admin (administrativos): acceso total — todas las pantallas + análisis +
 *    paneles administrativos + miembros + branding + PDFs contables.
 *  - production (encargado de producción): clientes, pedidos de clientes,
 *    creación de pedidos, planificación, historial de pedidos y gestión de
 *    recetas. NO toca inventario ni proveedores.
 *  - inventory (encargado de inventario): catálogo, insumos, inventario,
 *    ajustes, mermas, proveedores, órdenes de compra, ingresos y alertas.
 *    NO toca pedidos de clientes ni paneles administrativos.
 *  - operator (operario de producción): solo cola de pedidos, planificación
 *    y recetas en lectura. Ejecuta producción, no toma decisiones.
 */
export type UserRole = 'admin' | 'production' | 'inventory' | 'operator';
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
  /** Texto libre (legacy) o id del proveedor (`Supplier.id`) si está vinculado. */
  supplier?: string;
  /** Vínculo opcional a un proveedor estructurado. */
  supplierId?: string;
  active: boolean;
}

/**
 * Item que entrega un proveedor. Puede ser un insumo crudo o un producto
 * terminado de reventa (productos sin receta). Los productos con receta no
 * se compran a proveedores: se fabrican internamente.
 */
export interface SupplierItem {
  kind: 'supply' | 'product';
  itemId: string;
}

/**
 * Proveedor estructurado con datos de contacto, lead time y ventanas
 * semanales de pedido/entrega. Se usa en la pantalla de Proveedores para
 * planificar reposiciones y en /ingresos para registrar la mercadería que
 * llega.
 */
export interface Supplier {
  id: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  /** Días promedio entre que se hace el pedido y se recibe el insumo. */
  leadTimeDays: number;
  /**
   * Días de la semana (0=domingo..6=sábado) en que conviene hacer pedidos a
   * este proveedor. Si está vacío, cualquier día.
   */
  orderDays: number[];
  /**
   * Días de la semana en que el proveedor entrega. Si está vacío, cualquier
   * día.
   */
  deliveryDays: number[];
  /** Términos de pago (texto libre: contado, 30 días, etc.). */
  paymentTerms?: string;
  /**
   * Items (insumos + productos sin receta) que este proveedor entrega.
   * Se usa para filtrar el selector en /ingresos al elegir un proveedor.
   */
  suppliedItems: SupplierItem[];
  notes?: string;
  active: boolean;
  createdAt: Date;
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

/**
 * Lote devuelto por un cliente, pendiente de decidir cuánto es merma
 * (descarte) y cuánto vuelve al inventario como producto utilizable.
 *
 * Flujo:
 *  - Cliente confirma recepción con `receivedQty < fulfilledQty`. La diferencia
 *    NO se añade al stock inmediatamente — se crea un lote `pending`.
 *  - En la pantalla de Mermas el admin revisa el lote y procesa:
 *      mermaQty = cuántas unidades descartar (0..qty)
 *      usableQty = qty - mermaQty  → se agregan al stock como producto
 *      utilizable (kardex `in` con reason `return_from_customer`).
 *    El lote queda `reviewed`.
 */
export interface ReturnedLot {
  id: string;
  productId: string;
  productName: string;
  unit: Unit;
  /** Unidades devueltas (igual a fulfilledQty - receivedQty del pedido). */
  qty: number;
  /** Unidades marcadas como merma al procesar el lote. */
  mermaQty: number;
  sourceOrderId: string;
  sourceOrderCode: string;
  customerId?: string;
  customerName?: string;
  /** Nota que dejó el cliente al confirmar la recepción. */
  customerNote?: string;
  createdAt: Date;
  status: 'pending' | 'reviewed';
  reviewedAt?: Date;
  reviewedBy?: string;
  /** Nota interna que dejó el admin al procesar la merma. */
  reviewNote?: string;
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
//  Órdenes de fabricación
// =========================================================

/**
 * Ciclo de vida de una orden de fabricación interna:
 *  - pending: orden creada, producción aún no la procesa
 *  - in_production: producción reservó insumos disponibles; pueden faltar
 *  - completed: producción terminó la fabricación y el stock del producto
 *    terminado fue actualizado. La orden queda cerrada.
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
  unit: Unit;
  qty: number;
}

export interface OrderItem {
  productId: string;
  productName: string;
  unit: Unit;
  /** Cantidad solicitada por el cliente. */
  qty: number;
  unitPrice: number;
  /** Cantidad producida y marcada como lista para entrega. */
  fulfilledQty: number;
  /**
   * Cantidad efectivamente recibida y aceptada por el cliente.
   * Solo se setea cuando el cliente confirma la recepción.
   * Si es menor que fulfilledQty, la diferencia se reintegra al stock.
   */
  receivedQty?: number;
}

export interface OrderShortfall {
  kind: 'supply' | 'product';
  itemId: string;
  itemName: string;
  unit: Unit;
  required: number;
  available: number;
  short: number;
  forProductId?: string;
}

/**
 * Orden de fabricación interna. Puede crearla producción directamente, o
 * generarse automáticamente desde un pedido del portal cliente (en cuyo caso
 * `customerId` apunta al cliente que la solicitó).
 */
export interface CustomerOrder {
  id: string;
  code: string;
  /** Cliente que originó la orden (si vino del portal). */
  customerId?: string;
  /** Motivo o destino interno del lote. Opcional. */
  purpose?: string;
  status: OrderStatus;
  items: OrderItem[];
  totalAmount: number;
  notes?: string;
  createdAt: Date;
  createdBy: string;
  reservations: OrderReservation[];
  shortfalls: OrderShortfall[];
  productionStartedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  /** Fecha de entrega solicitada por el cliente (solo si vino del portal). */
  requestedDeliveryDate?: Date;
  /** Fecha en que el cliente confirmó la recepción del pedido. */
  customerConfirmedAt?: Date;
  /** Nota del cliente al confirmar (motivo si reportó diferencias). */
  customerNote?: string;
  /**
   * Monto final cobrado al cliente, calculado a partir de receivedQty.
   * Solo presente tras la confirmación del cliente. Si todo se recibió
   * completo, coincide con totalAmount.
   */
  finalAmount?: number;
}

// =========================================================
//  Clientes (portal externo)
// =========================================================

/**
 * Configuración de ventanas semanales: arrays con días de la semana
 * (0=domingo, 1=lunes, ..., 6=sábado) en los que se permite la acción.
 */
export interface CustomerWindow {
  /** Días de la semana en que el cliente puede crear pedidos. */
  orderDays: number[];
  /** Días de la semana en que se entregan los pedidos. */
  deliveryDays: number[];
}

/**
 * Cliente con acceso al portal externo. Cada cliente tiene un link público
 * (token aleatorio en la URL) protegido por un PIN numérico.
 *
 * Los pedidos que crea el cliente desde el portal generan automáticamente
 * una `CustomerOrder` con `customerId` apuntando aquí.
 */
export interface Customer {
  id: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  /** Token aleatorio para la URL pública (/c/:token). */
  publicToken: string;
  /** PIN numérico (4-6 dígitos) requerido para entrar al portal. */
  accessPin: string;
  /**
   * IDs de productos del catálogo que este cliente puede pedir.
   * Si el array está vacío → puede pedir todos los productos activos.
   */
  allowedProductIds: string[];
  /** Ventanas de pedido y entrega (días de la semana). */
  window: CustomerWindow;
  notes?: string;
  active: boolean;
  createdAt: Date;
}
