import type { Unit } from '../units';
export type { Unit } from '../units';

export type StockStatus = 'available' | 'low' | 'critical' | 'out';
export type KardexType = 'in' | 'out' | 'adjustment';
export type AlertType =
  // --- Alertas de stock (nivel + proyectivas) ---
  | 'restock'          // stock <= punto de reorden (bajo / crítico / agotado)
  | 'stockout_risk'    // proyectiva: "se acaba en N días" según consumo diario
  | 'excess'           // exceso de inventario / capital inmovilizado
  | 'order_now'        // cruce LT + proyección: hay que ordenar HOY o se rompe stock
  // --- Alertas de pedidos y proveedores ---
  | 'delivery_today'     // hoy llega tu pedido (OC con entrega esperada hoy)
  | 'delivery_overdue'   // tu pedido no ha llegado (entrega vencida)
  | 'partial_reception'  // llegó menos de lo pedido
  | 'order_day';         // hoy es día de pedido del proveedor X
export type AlertStatus = 'active' | 'acknowledged' | 'resolved';
export type AlertPriority = 'high' | 'medium' | 'low';
/**
 * Roles del sistema (3 roles):
 *  - admin: acceso total — todas las pantallas + análisis + paneles
 *    administrativos + miembros + branding.
 *  - produccion: de catálogo hacia abajo — catálogo, recetas, inventario,
 *    insumos, mermas, ajustes, proveedores, pre-compras, órdenes de compra,
 *    planificación, análisis y alertas. NO toca clientes/pedidos ni paneles
 *    administrativos.
 *  - ventas: la parte de clientes — clientes, crear pedido y cola de pedidos
 *    (recibidos/aceptados/completados). NO toca catálogo, inventario, compras
 *    ni paneles administrativos.
 */
export type UserRole = 'admin' | 'produccion' | 'ventas';
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

/**
 * Presentación comercial de un insumo. Define cómo se compra/maneja en
 * la práctica vs su unidad base. Ej: harina con `unit: 'kg'` y presentación
 * `{ size: 25, label: 'saco' }` significa que 1 saco = 25 kg.
 *
 * Internamente todo se sigue almacenando en la unidad base (kg, L, etc.)
 * para que recetas y kardex no requieran migración. La presentación es una
 * capa de DISPLAY/INPUT: cuando el usuario escribe "3 sacos" guardamos 75 kg,
 * y al mostrar 75 kg le decimos "3 sacos (75 kg)".
 */
export interface SupplyPresentation {
  /** Cuánto de `unit` hay en cada presentación. Ej: 25 (kg por saco). */
  size: number;
  /** Etiqueta visible: 'saco', 'caja', 'bolsa', 'galón'… */
  label: string;
}

export interface Supply {
  id: string;
  sku: string;
  name: string;
  description?: string;
  category?: string;
  /** Unidad base del insumo (siempre se almacena en ésta). */
  unit: Unit;
  /**
   * Costo por presentación (si hay una definida) o por unidad base.
   * Si presentation existe, este costo es por presentación completa.
   */
  cost: number;
  /** Stocks en unidad base — para mostrarse en presentaciones, dividir por presentation.size. */
  minStock: number;
  maxStock: number;
  reorderPoint: number;
  /** Texto libre (legacy) o id del proveedor (`Supplier.id`) si está vinculado. */
  supplier?: string;
  /** Vínculo opcional a un proveedor estructurado. */
  supplierId?: string;
  /** Presentación comercial. Si está vacío, el insumo se maneja en unidad base. */
  presentation?: SupplyPresentation;
  active: boolean;
}

/**
 * Item que entrega un proveedor. Puede ser un insumo crudo o un producto
 * terminado de reventa (productos sin receta). Los productos con receta no
 * se compran a proveedores: se fabrican internamente.
 *
 * `unitCost` es el precio que este proveedor cobra por unidad del item.
 * Si está `undefined`, se asume el costo "global" del Supply/Product como
 * fallback. Permite tener precios distintos del mismo insumo por proveedor.
 */
export interface SupplierItem {
  kind: 'supply' | 'product';
  itemId: string;
  unitCost?: number;
}

/**
 * Proveedor estructurado con datos de contacto, lead time y ventanas
 * semanales de pedido/entrega. Se usa en la pantalla de Proveedores para
 * planificar reposiciones.
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
   * Se usa para filtrar el selector al armar una orden de compra.
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

/** Medidas físicas de un producto (en cm normalmente). Todo opcional. */
export interface RecipeSize {
  alto?: string;
  largo?: string;
  ancho?: string;
  diametro?: string;
}

/**
 * Datos extendidos de la "ficha técnica" de producción de una receta.
 * Todo opcional: una receta puede no tener ficha completa.
 */
export interface RecipeSheet {
  /** Condiciones de almacenamiento del producto. */
  storage?: string;
  /** Pesos por unidad (en gramos). */
  weightRaw?: number;     // crudo
  weightBaked?: number;   // horneado
  weightFinal?: number;   // final
  /** Pasos del procedimiento (uno por elemento). */
  procedure?: string[];
  /** Gruesor del laminado (ej. "3mm"). */
  laminationThickness?: string;
  /** Tiempo de fermentación (ej. "12 horas"). */
  fermentationTime?: string;
  /** Temperatura de horneo (texto libre, ej. "200°C"). */
  ovenTempTop?: string;     // arriba
  ovenTempBottom?: string;  // abajo
  /** Tiempo de horneo (ej. "20 minutos"). */
  bakingTime?: string;
  /** Medidas del producto tras fermentar y ya terminado. */
  fermentedSize?: RecipeSize;
  finishedSize?: RecipeSize;
  /** Tipo de remate / decoración. */
  decoration?: string;
}

export interface Recipe {
  id: string;
  productId: string;
  productName: string;
  yieldQty: number;
  items: RecipeItem[];
  /** Observaciones / notas de preparación, tiempos, advertencias. Opcional. */
  notes?: string;
  /** Ficha técnica de producción (campos extendidos). Opcional. */
  sheet?: RecipeSheet;
  /** Foto del producto (data URL). Se muestra en la tarjeta y en la ficha. */
  imageUrl?: string;
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

/**
 * Urna (vitrina / punto de venta) del lado de Ventas. Es una ubicación de
 * stock SEPARADA del inventario central: producción fabrica y entrega a una
 * urna, y Ventas vende y registra merma desde ahí. El stock central NO se
 * mezcla con el de las urnas.
 */
export interface Urna {
  id: string;
  name: string;
  /** Ubicación física (sucursal, esquina, etc.). */
  location?: string;
  /** Persona a cargo de la urna (texto libre). */
  responsible?: string;
  notes?: string;
  active: boolean;
  createdAt: Date;
}

/**
 * Línea de producto dentro de un lote de urna. `qty` es la cantidad RESTANTE
 * de ese producto en ese lote (baja al vender/mermar).
 */
export interface UrnaLoteLine {
  productId: string;
  productName: string;
  qty: number;
}

/** Línea de un ticket de venta del punto de venta (POS). */
export interface PosSaleLine {
  productId: string;
  productName: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

/**
 * Venta 1 a 1 en el punto de venta (un ticket puede tener varias líneas).
 * Descuenta stock del almacén en modo FIFO y registra kardex `urna_sale`.
 */
export interface PosSale {
  id: string;
  code: string;
  almacenId: string;
  lines: PosSaleLine[];
  total: number;
  at: Date;
  soldBy: string;
}

/**
 * Lote (tanda) recibido en una urna: el stock de la urna se maneja por lotes,
 * no como un total plano. Cada entrega de producción genera un lote con su
 * fecha; el consumo (venta / merma) es FIFO — primero el lote más antiguo.
 */
export interface UrnaLote {
  id: string;
  urnaId: string;
  /** Código legible del lote (normalmente el de la orden que lo originó). */
  code: string;
  /** Fecha en que se recibió la tanda en la urna. */
  receivedAt: Date;
  /** Orden de reposición que originó el lote (si aplica). */
  orderId?: string;
  orderCode?: string;
  lines: UrnaLoteLine[];
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
 * Origen del lote de merma:
 *  - `customer_return`: cliente devolvió unidades al recibir.
 *  - `production`: fallaron durante la fabricación antes de salir a entrega.
 */
export type MermaKind = 'customer_return' | 'production' | 'urna' | 'delivery';

/** Motivo común de una merma de producción (panadería). */
export type ProductionMermaReason =
  | 'damaged'        // dañado/quebrado al manipular
  | 'underbaked'     // crudo / poco cocido
  | 'overbaked'      // quemado / sobrecocido
  | 'wrong_shape'    // mal formado / con defecto visual
  | 'contaminated'   // contaminado
  | 'other';

/**
 * Lote de merma. Dos orígenes según `kind`:
 *
 * 1. `customer_return`: cliente confirmó recepción con `receivedQty < fulfilledQty`.
 *    La diferencia NO se añade al stock inmediatamente — se crea un lote `pending`.
 *    En /mermas el admin decide cuánto descartar y cuánto reintegrar al stock.
 *
 * 2. `production`: durante la fabricación X unidades fallaron y no pueden
 *    venderse. Se registra directo en estado `reviewed` (mermaQty = qty,
 *    todo es pérdida). Los insumos consumidos en esas unidades se descuentan
 *    del stock vía kardex `out` reason `lost`. El stock del producto NO se
 *    toca (las unidades nunca entraron al inventario).
 */
export interface ReturnedLot {
  id: string;
  kind: MermaKind;
  productId: string;
  productName: string;
  unit: Unit;
  /** Unidades afectadas (devueltas por cliente o producidas y descartadas). */
  qty: number;
  /** Unidades marcadas como merma. */
  mermaQty: number;
  createdAt: Date;
  status: 'pending' | 'reviewed';
  reviewedAt?: Date;
  reviewedBy?: string;
  /** Nota interna del revisor. */
  reviewNote?: string;

  // ----- Solo para `kind === 'customer_return'` -----
  sourceOrderId?: string;
  sourceOrderCode?: string;
  customerId?: string;
  customerName?: string;
  /** Nota del cliente al confirmar la recepción. */
  customerNote?: string;

  // ----- Solo para `kind === 'production'` y `kind === 'urna'` -----
  productionReason?: ProductionMermaReason;
  /** Texto libre cuando productionReason === 'other'. */
  productionReasonText?: string;

  // ----- Solo para `kind === 'urna'` (merma en vitrina) -----
  urnaId?: string;
  urnaName?: string;
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
  // ----- Contexto de pedidos / proveedores -----
  supplierId?: string;
  supplierName?: string;
  poId?: string;
  poCode?: string;
  /** Entrega esperada (delivery_today / delivery_overdue). */
  expectedDate?: Date;
  /** Cantidades para recepción parcial. */
  orderedQty?: number;
  receivedQty?: number;
  /** Lead time de la entrega más rápida (order_now). */
  leadTimeDays?: number;
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
//  Pre-compras (sugerencias automáticas, sin persistencia)
// =========================================================

/**
 * Pre-compra SUGERIDA: estructura puramente derivada del estado actual del
 * inventario, las recepciones pendientes y el calendario del proveedor.
 *
 * **No se guarda.** Se recalcula cada vez que se consulta. La única acción
 * posible es "aprobar", que la materializa como una `PurchaseOrder` real.
 * En la siguiente consulta, esa sugerencia desaparece o cambia porque el
 * pendiente de OC ya cubre la necesidad.
 */
export interface SuggestedPrePurchase {
  supplierId: string;
  supplierName: string;
  items: SuggestedPrePurchaseItem[];
  /** Suma qty * unitCost de todos los items. */
  totalCost: number;
  /** Próxima fecha en que conviene colocar la orden con este proveedor. */
  nextOrderDate: Date;
  /** Próxima fecha estimada de entrega según el calendario semanal. */
  nextDeliveryDate: Date;
  /** Días desde hoy hasta `nextDeliveryDate`. */
  leadTimeDays: number;
  /** true si `leadTimeDays` salió del calendario (orderDays + deliveryDays). */
  fromCalendar: boolean;
}

/**
 * Razón por la que un insumo aparece en la sugerencia:
 *  - `below_rop`: el stock actual (descontando pendientes que llegarán a
 *    tiempo) ya está bajo el punto de reorden.
 *  - `wont_cover_lt`: el stock alcanza para hoy pero, considerando el
 *    consumo diario y el LT del proveedor, al momento de la entrega va a
 *    estar bajo el stock mínimo.
 *  - `manual`: agregado a mano por el usuario al carrito del proveedor.
 *    No surge del algoritmo de reposición.
 */
export type SuggestedReason = 'below_rop' | 'wont_cover_lt' | 'manual';

export interface SuggestedPrePurchaseItem {
  supplyId: string;
  itemName: string;
  /** Cantidad sugerida (ya redondeada a presentación si aplica). */
  qty: number;
  unitCost: number;
  /** Stock actual real del insumo (sin contar pendientes). */
  currentStock: number;
  /** Cantidad ya en camino vía OCs pending — descuenta el faltante. */
  pendingQty: number;
  reorderPoint: number;
  minStock: number;
  /** Consumo diario promedio (rolling 7d). */
  dailyDemand: number;
  /** Días hasta agotar el stock al ritmo actual. */
  daysUntilEmpty: number;
  reason: SuggestedReason;
  /** true si el item lo agregó el usuario manualmente al carrito. */
  manual: boolean;
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
  /**
   * Urna de destino cuando la orden es una SOLICITUD DE REPOSICIÓN interna
   * creada por Ventas. Si está presente, al entregarse el stock va a la urna
   * (no a un cliente). Mutuamente excluyente con `customerId` en la práctica.
   */
  urnaId?: string;
  /** Nombre de la urna cacheado para mostrar. */
  urnaName?: string;
  /** Marca true cuando se entregó/repuso el stock en la urna de destino. */
  deliveredToUrnaAt?: Date;
  /**
   * Pedido de CLIENTE corroborado/aceptado por Ventas y enviado a producción.
   * Hasta que está presente, el pedido vive en "Pedidos recibidos" y NO entra
   * a la cola de producción. (Los pedidos de almacén no lo necesitan.)
   */
  acceptedBySalesAt?: Date;
  /** Pedido de cliente despachado/entregado al cliente por Ventas. */
  dispatchedAt?: Date;
  /** Pedido facturado por Ventas (cierre final, tras despachar). */
  invoicedAt?: Date;
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
  /**
   * Precios personalizados por producto para este cliente (productId → precio).
   * Si un producto no está acá, se usa el `sellPrice` global del producto.
   */
  productPrices?: Record<string, number>;
  /** Ventanas de pedido y entrega (días de la semana). */
  window: CustomerWindow;
  notes?: string;
  active: boolean;
  createdAt: Date;
}

/** Línea de un pedido recurrente. */
export interface RecurringOrderItem {
  productId: string;
  qty: number;
}

/**
 * Pedido RECURRENTE: una plantilla de pedido que se repite para un cliente en
 * ciertos días de la semana. Genera `CustomerOrder` reales (manual o al estar
 * "vencido" ese día). No descuenta stock por sí mismo.
 */
export interface RecurringOrder {
  id: string;
  customerId: string;
  /** Nombre opcional (ej. "Pedido semanal vitrina"). */
  label?: string;
  /** Días de la semana en que se repite (0=domingo..6=sábado). */
  weekdays: number[];
  items: RecurringOrderItem[];
  active: boolean;
  createdAt: Date;
  /** Última vez que se generó un pedido a partir de esta plantilla. */
  lastGeneratedAt?: Date;
}
