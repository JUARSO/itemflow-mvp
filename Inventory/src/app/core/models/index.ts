export type StockStatus = 'available' | 'low' | 'critical' | 'out';
export type KardexType = 'in' | 'out' | 'adjustment';
export type AlertType = 'restock' | 'stockout_risk' | 'excess';
export type AlertStatus = 'active' | 'acknowledged' | 'resolved';
export type AlertPriority = 'high' | 'medium' | 'low';
export type UserRole = 'admin' | 'operator';
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
  unit: string;
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
  unit: string;
  cost: number;
  minStock: number;
  maxStock: number;
  reorderPoint: number;
  leadTime: number;
  supplier?: string;
  active: boolean;
}

export interface RecipeItem {
  supplyId: string;
  supplyName: string;
  qty: number;
  unit: string;
}

export interface Recipe {
  id: string;
  productId: string;
  productName: string;
  yieldQty: number;
  items: RecipeItem[];
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
