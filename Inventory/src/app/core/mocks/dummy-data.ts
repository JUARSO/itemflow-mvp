import {
  Member, Company, Product, Supply, Recipe,
  StockItem, SupplyStockItem, KardexEntry, SaleRecord,
  Alert, DemandPrediction, PurchaseOrder, CustomerOrder, ProductReturn
} from '../models';

export const MOCK_COMPANY: Company = {
  id: 'tenant-demo',
  name: 'Panadería Pan & Co',
  adminEmail: 'admin@panyco.cl',
  currency: 'CRC',
  timezone: 'America/Costa_Rica',
};

export const MOCK_MEMBERS: Member[] = [
  { uid: 'u-admin', email: 'admin@panyco.cl', displayName: 'María González', role: 'admin', active: true },
  { uid: 'u-ventas', email: 'ventas@panyco.cl', displayName: 'Juan Pérez', role: 'sales', active: true },
  { uid: 'u-produccion', email: 'produccion@panyco.cl', displayName: 'Sofía Rojas', role: 'production', active: true },
  { uid: 'u-operario', email: 'operario@panyco.cl', displayName: 'Carlos Mora', role: 'operator', active: true },
];

export const MOCK_SUPPLIES: Supply[] = [
  { id: 's-harina', sku: 'INS-HARINA-001', name: 'Harina de trigo', category: 'Cereales', unit: 'kg', cost: 850, minStock: 20, maxStock: 200, reorderPoint: 50, leadTime: 3, supplier: 'Molinos del Sur', active: true },
  { id: 's-azucar', sku: 'INS-AZUCAR-001', name: 'Azúcar granulada', category: 'Endulzantes', unit: 'kg', cost: 950, minStock: 10, maxStock: 100, reorderPoint: 25, leadTime: 2, supplier: 'IANSA', active: true },
  { id: 's-sal', sku: 'INS-SAL-001', name: 'Sal de mesa', category: 'Sazonadores', unit: 'kg', cost: 600, minStock: 3, maxStock: 30, reorderPoint: 8, leadTime: 2, supplier: 'Lobos', active: true },
  { id: 's-levadura', sku: 'INS-LEVADURA-001', name: 'Levadura fresca', category: 'Leudantes', unit: 'kg', cost: 4200, minStock: 2, maxStock: 15, reorderPoint: 5, leadTime: 1, supplier: 'Lefersa', active: true },
  { id: 's-mantequilla', sku: 'INS-MANTEQ-001', name: 'Mantequilla sin sal', category: 'Lácteos', unit: 'kg', cost: 7500, minStock: 5, maxStock: 40, reorderPoint: 12, leadTime: 2, supplier: 'Soprole', active: true },
  { id: 's-huevos', sku: 'INS-HUEVO-001', name: 'Huevos', category: 'Lácteos', unit: 'unidad', cost: 220, minStock: 60, maxStock: 600, reorderPoint: 180, leadTime: 1, supplier: 'Coliumo', active: true },
  { id: 's-leche', sku: 'INS-LECHE-001', name: 'Leche entera', category: 'Lácteos', unit: 'L', cost: 1100, minStock: 10, maxStock: 80, reorderPoint: 25, leadTime: 1, supplier: 'Soprole', active: true },
  { id: 's-aceite', sku: 'INS-ACEITE-001', name: 'Aceite vegetal', category: 'Aceites', unit: 'L', cost: 2800, minStock: 5, maxStock: 30, reorderPoint: 10, leadTime: 3, supplier: 'Natura', active: true },
  { id: 's-choco', sku: 'INS-CHOCO-001', name: 'Chocolate cobertura', category: 'Especiales', unit: 'kg', cost: 9800, minStock: 3, maxStock: 25, reorderPoint: 8, leadTime: 5, supplier: 'Costa', active: true },
  { id: 's-cacao', sku: 'INS-CACAO-001', name: 'Cacao en polvo', category: 'Especiales', unit: 'kg', cost: 6500, minStock: 2, maxStock: 15, reorderPoint: 5, leadTime: 4, supplier: 'Costa', active: true },
  { id: 's-canela', sku: 'INS-CANELA-001', name: 'Canela molida', category: 'Especias', unit: 'kg', cost: 12000, minStock: 1, maxStock: 8, reorderPoint: 2, leadTime: 5, supplier: 'McCormick', active: true },
  { id: 's-bicarb', sku: 'INS-BICARB-001', name: 'Bicarbonato de sodio', category: 'Leudantes', unit: 'kg', cost: 1800, minStock: 1, maxStock: 10, reorderPoint: 3, leadTime: 2, supplier: 'Diquimica', active: true },
  { id: 's-vainilla', sku: 'INS-VAINILLA-001', name: 'Esencia de vainilla', category: 'Aromas', unit: 'L', cost: 8500, minStock: 0.5, maxStock: 5, reorderPoint: 1.5, leadTime: 3, supplier: 'Gourmet', active: true },
  { id: 's-mermelada', sku: 'INS-MERM-001', name: 'Mermelada de frutilla', category: 'Rellenos', unit: 'kg', cost: 3200, minStock: 4, maxStock: 30, reorderPoint: 10, leadTime: 4, supplier: 'Watts', active: true },
  { id: 's-queso', sku: 'INS-QUESO-001', name: 'Queso crema', category: 'Lácteos', unit: 'kg', cost: 5400, minStock: 3, maxStock: 25, reorderPoint: 8, leadTime: 2, supplier: 'Soprole', active: true },
];

export const MOCK_PRODUCTS: Product[] = [
  { id: 'p-baguette', sku: 'PROD-BAG-001', name: 'Baguette tradicional', category: 'Panes', unit: 'unidad', buyPrice: 380, sellPrice: 1200, leadTime: 1, active: true, hasRecipe: true },
  { id: 'p-marraqueta', sku: 'PROD-MAR-001', name: 'Marraqueta', category: 'Panes', unit: 'unidad', buyPrice: 120, sellPrice: 350, leadTime: 1, active: true, hasRecipe: true },
  { id: 'p-hallulla', sku: 'PROD-HAL-001', name: 'Hallulla', category: 'Panes', unit: 'unidad', buyPrice: 90, sellPrice: 300, leadTime: 1, active: true, hasRecipe: true },
  { id: 'p-croissant', sku: 'PROD-CRO-001', name: 'Croissant mantequilla', category: 'Pastelería', unit: 'unidad', buyPrice: 650, sellPrice: 1900, leadTime: 1, active: true, hasRecipe: true },
  { id: 'p-empanada', sku: 'PROD-EMP-001', name: 'Empanada queso', category: 'Salados', unit: 'unidad', buyPrice: 550, sellPrice: 1700, leadTime: 1, active: true, hasRecipe: true },
  { id: 'p-brownie', sku: 'PROD-BRO-001', name: 'Brownie chocolate', category: 'Pastelería', unit: 'unidad', buyPrice: 720, sellPrice: 2200, leadTime: 1, active: true, hasRecipe: true },
  { id: 'p-pie', sku: 'PROD-PIE-001', name: 'Pie de limón', category: 'Pastelería', unit: 'unidad', buyPrice: 5800, sellPrice: 18000, leadTime: 1, active: true, hasRecipe: true },
  { id: 'p-galleta', sku: 'PROD-GAL-001', name: 'Galleta avena pasas', category: 'Galletas', unit: 'unidad', buyPrice: 180, sellPrice: 600, leadTime: 1, active: true, hasRecipe: true },
  { id: 'p-cafe', sku: 'PROD-CAF-001', name: 'Café molido 250g (reventa)', category: 'Bebidas', unit: 'unidad', buyPrice: 3500, sellPrice: 5900, leadTime: 7, active: true, hasRecipe: false, reorderPoint: 12, minStock: 4 },
  { id: 'p-mermelada-rev', sku: 'PROD-MER-001', name: 'Mermelada artesanal (reventa)', category: 'Conservas', unit: 'unidad', buyPrice: 2800, sellPrice: 4900, leadTime: 7, active: true, hasRecipe: false, reorderPoint: 8, minStock: 3 },
];

export const MOCK_RECIPES: Recipe[] = [
  {
    id: 'p-baguette', productId: 'p-baguette', productName: 'Baguette tradicional', yieldQty: 10,
    items: [
      { supplyId: 's-harina', itemName: 'Harina de trigo', qty: 1.5, unit: 'kg' },
      { supplyId: 's-sal', itemName: 'Sal de mesa', qty: 0.03, unit: 'kg' },
      { supplyId: 's-levadura', itemName: 'Levadura fresca', qty: 0.02, unit: 'kg' },
    ],
    notes: 'Amasar 12 min. Primera fermentación 1h en bloque. Formar baguettes y fermentar 45 min más. Hornear a 220°C con vapor por 22 min.',
  },
  {
    id: 'p-marraqueta', productId: 'p-marraqueta', productName: 'Marraqueta', yieldQty: 20,
    items: [
      { supplyId: 's-harina', itemName: 'Harina de trigo', qty: 2.0, unit: 'kg' },
      { supplyId: 's-sal', itemName: 'Sal de mesa', qty: 0.04, unit: 'kg' },
      { supplyId: 's-levadura', itemName: 'Levadura fresca', qty: 0.025, unit: 'kg' },
    ],
  },
  {
    id: 'p-hallulla', productId: 'p-hallulla', productName: 'Hallulla', yieldQty: 20,
    items: [
      { supplyId: 's-harina', itemName: 'Harina de trigo', qty: 1.8, unit: 'kg' },
      { supplyId: 's-sal', itemName: 'Sal de mesa', qty: 0.035, unit: 'kg' },
      { supplyId: 's-mantequilla', itemName: 'Mantequilla sin sal', qty: 0.18, unit: 'kg' },
    ],
  },
  {
    id: 'p-croissant', productId: 'p-croissant', productName: 'Croissant mantequilla', yieldQty: 12,
    items: [
      { supplyId: 's-harina', itemName: 'Harina de trigo', qty: 0.6, unit: 'kg' },
      { supplyId: 's-mantequilla', itemName: 'Mantequilla sin sal', qty: 0.3, unit: 'kg' },
      { supplyId: 's-leche', itemName: 'Leche entera', qty: 0.25, unit: 'L' },
      { supplyId: 's-levadura', itemName: 'Levadura fresca', qty: 0.015, unit: 'kg' },
      { supplyId: 's-azucar', itemName: 'Azúcar granulada', qty: 0.06, unit: 'kg' },
    ],
    notes: 'Mantequilla SIEMPRE fría. 3 vueltas dobles con reposo de 30 min entre cada una. Fermentar 2h antes de hornear. 200°C por 18 min.',
  },
  {
    id: 'p-empanada', productId: 'p-empanada', productName: 'Empanada queso', yieldQty: 10,
    items: [
      { supplyId: 's-harina', itemName: 'Harina de trigo', qty: 0.5, unit: 'kg' },
      { supplyId: 's-queso', itemName: 'Queso crema', qty: 0.35, unit: 'kg' },
      { supplyId: 's-mantequilla', itemName: 'Mantequilla sin sal', qty: 0.1, unit: 'kg' },
      { supplyId: 's-sal', itemName: 'Sal de mesa', qty: 0.01, unit: 'kg' },
    ],
  },
  {
    id: 'p-brownie', productId: 'p-brownie', productName: 'Brownie chocolate', yieldQty: 16,
    items: [
      { supplyId: 's-choco', itemName: 'Chocolate cobertura', qty: 0.25, unit: 'kg' },
      { supplyId: 's-mantequilla', itemName: 'Mantequilla sin sal', qty: 0.2, unit: 'kg' },
      { supplyId: 's-azucar', itemName: 'Azúcar granulada', qty: 0.3, unit: 'kg' },
      { supplyId: 's-huevos', itemName: 'Huevos', qty: 4, unit: 'unidad' },
      { supplyId: 's-harina', itemName: 'Harina de trigo', qty: 0.15, unit: 'kg' },
      { supplyId: 's-cacao', itemName: 'Cacao en polvo', qty: 0.05, unit: 'kg' },
    ],
  },
  {
    id: 'p-pie', productId: 'p-pie', productName: 'Pie de limón', yieldQty: 1,
    items: [
      { supplyId: 's-harina', itemName: 'Harina de trigo', qty: 0.25, unit: 'kg' },
      { supplyId: 's-mantequilla', itemName: 'Mantequilla sin sal', qty: 0.15, unit: 'kg' },
      { supplyId: 's-azucar', itemName: 'Azúcar granulada', qty: 0.2, unit: 'kg' },
      { supplyId: 's-huevos', itemName: 'Huevos', qty: 6, unit: 'unidad' },
      { supplyId: 's-leche', itemName: 'Leche entera', qty: 0.4, unit: 'L' },
    ],
  },
  {
    id: 'p-galleta', productId: 'p-galleta', productName: 'Galleta avena pasas', yieldQty: 24,
    items: [
      { supplyId: 's-harina', itemName: 'Harina de trigo', qty: 0.3, unit: 'kg' },
      { supplyId: 's-mantequilla', itemName: 'Mantequilla sin sal', qty: 0.15, unit: 'kg' },
      { supplyId: 's-azucar', itemName: 'Azúcar granulada', qty: 0.18, unit: 'kg' },
      { supplyId: 's-huevos', itemName: 'Huevos', qty: 2, unit: 'unidad' },
      { supplyId: 's-canela', itemName: 'Canela molida', qty: 0.005, unit: 'kg' },
    ],
  },
];

// Stock por insumo — generamos cantidades variadas para producir diferentes status
function statusOf(qty: number, reorderPoint: number, minStock: number): 'available' | 'low' | 'critical' | 'out' {
  if (qty <= 0) return 'out';
  if (qty <= minStock) return 'critical';
  if (qty <= reorderPoint) return 'low';
  return 'available';
}

export const MOCK_SUPPLY_STOCK: SupplyStockItem[] = (() => {
  // Cantidades únicas por insumo (mix de status)
  const stockByItem: Record<string, number> = {
    's-harina':     163,    // available
    's-azucar':     97,     // available
    's-sal':        31.5,   // available
    's-levadura':   11,     // available
    's-mantequilla':42,     // available
    's-huevos':     600,    // available
    's-leche':      86,     // available
    's-aceite':     33,     // available
    's-choco':      4,      // critical
    's-cacao':      0,      // out
    's-canela':     1.7,    // critical
    's-bicarb':     2.5,    // critical
    's-vainilla':   4.8,    // available
    's-mermelada':  30,     // available
    's-queso':      6,      // critical
  };
  return MOCK_SUPPLIES.map(supply => {
    const qty = stockByItem[supply.id] ?? supply.maxStock * 0.5;
    return {
      id: supply.id,
      supplyId: supply.id,
      quantity: qty,
      status: statusOf(qty, supply.reorderPoint, supply.minStock),
    };
  });
})();

export const MOCK_PRODUCT_STOCK: StockItem[] = (() => {
  // solo productos sin receta tienen stock propio
  const stockByItem: Record<string, number> = {
    'p-cafe':           7,   // low (entre minStock=4 y reorderPoint=12)
    'p-mermelada-rev':  2,   // critical (≤ minStock=3)
  };
  return MOCK_PRODUCTS
    .filter(p => !p.hasRecipe)
    .map(product => {
      const qty = stockByItem[product.id] ?? 0;
      return {
        id: product.id,
        productId: product.id,
        quantity: qty,
        reservedQty: 0,
        status: statusOfProduct(qty, product.reorderPoint, product.minStock),
      };
    });
})();

function statusOfProduct(qty: number, reorderPoint?: number, minStock?: number): 'available' | 'low' | 'critical' | 'out' {
  if (qty <= 0) return 'out';
  if (minStock != null && qty <= minStock) return 'critical';
  if (reorderPoint != null && qty <= reorderPoint) return 'low';
  return 'available';
}

// Helper para fechas relativas
const daysAgo = (d: number) => new Date(Date.now() - d * 24 * 60 * 60 * 1000);
const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000);

export const MOCK_KARDEX: KardexEntry[] = [
  { id: 'k-1', supplyId: 's-harina', itemName: 'Harina de trigo', type: 'in', qty: 50, balance: 163, cost: 850, reason: 'purchase', note: 'OC #142 recibida', userId: 'u-admin', userName: 'María González', at: hoursAgo(3) },

  { id: 'k-2', supplyId: 's-harina', itemName: 'Harina de trigo', type: 'out', qty: 7.5, balance: 113, cost: 850, reason: 'sale', userId: 'u-ventas', userName: 'Juan Pérez', at: hoursAgo(8) },
  { id: 'k-3', supplyId: 's-levadura', itemName: 'Levadura fresca', type: 'out', qty: 0.5, balance: 11, cost: 4200, reason: 'sale', userId: 'u-produccion', userName: 'Sofía Rojas', at: hoursAgo(12) },
  { id: 'k-6', supplyId: 's-azucar', itemName: 'Azúcar granulada', type: 'adjustment', qty: 2, balance: 97, cost: 950, reason: 'count_correction', note: 'Diferencia inventario físico', userId: 'u-admin', userName: 'María González', at: daysAgo(2) },
  { id: 'k-7', supplyId: 's-cacao', itemName: 'Cacao en polvo', type: 'out', qty: 0.3, balance: 0, cost: 6500, reason: 'sale', userId: 'u-produccion', userName: 'Sofía Rojas', at: daysAgo(2) },
  { id: 'k-8', supplyId: 's-choco', itemName: 'Chocolate cobertura', type: 'in', qty: 10, balance: 4, cost: 9800, reason: 'purchase', note: 'OC #138', userId: 'u-admin', userName: 'María González', at: daysAgo(3) },
  { id: 'k-9', supplyId: 's-huevos', itemName: 'Huevos', type: 'in', qty: 180, balance: 600, cost: 220, reason: 'purchase', userId: 'u-admin', userName: 'María González', at: daysAgo(3) },
  { id: 'k-10', supplyId: 's-leche', itemName: 'Leche entera', type: 'adjustment', qty: -2, balance: 86, cost: 1100, reason: 'damaged', note: 'Cartones vencidos', userId: 'u-produccion', userName: 'Sofía Rojas', at: daysAgo(4) },
  { id: 'k-11', supplyId: 's-harina', itemName: 'Harina de trigo', type: 'out', qty: 12, balance: 120, cost: 850, reason: 'sale', userId: 'u-produccion', userName: 'Sofía Rojas', at: daysAgo(5) },
  { id: 'k-12', productId: 'p-cafe', itemName: 'Café molido 250g', type: 'out', qty: 1, balance: 33, cost: 3500, reason: 'sale', userId: 'u-produccion', userName: 'Sofía Rojas', at: daysAgo(6) },
];

export const MOCK_SALES: SaleRecord[] = (() => {
  const sales: SaleRecord[] = [];
  let id = 1;
  for (let d = 0; d < 30; d++) {
    const date = daysAgo(d);
    // ventas variables por producto y día
    const dayMultiplier = [0.6, 1.0, 1.0, 1.1, 1.1, 1.3, 1.5][date.getDay()];
    for (const product of MOCK_PRODUCTS) {
      const baseQty = product.id === 'p-baguette' ? 35 :
                      product.id === 'p-marraqueta' ? 80 :
                      product.id === 'p-hallulla' ? 60 :
                      product.id === 'p-croissant' ? 20 :
                      product.id === 'p-empanada' ? 18 :
                      product.id === 'p-brownie' ? 12 :
                      product.id === 'p-galleta' ? 30 :
                      product.id === 'p-cafe' ? 5 :
                      product.id === 'p-mermelada-rev' ? 3 :
                      product.id === 'p-pie' ? 1 : 5;
      const qty = Math.max(0, Math.round(baseQty * dayMultiplier * (0.7 + Math.random() * 0.6)));
      if (qty === 0) continue;
      // outlier ocasional
      const isOutlier = Math.random() < 0.04;
      const finalQty = isOutlier ? Math.round(qty * 2.5) : qty;
      sales.push({
        id: `sale-${id++}`,
        productId: product.id,
        productName: product.name,
        qty: finalQty,
        unitPrice: product.sellPrice,
        total: finalQty * product.sellPrice,
        dayOfWeek: date.getDay(),
        month: date.getMonth() + 1,
        date,
        isOutlier,
        zScore: isOutlier ? 2.8 + Math.random() : undefined,
      });
    }
  }
  return sales;
})();

/**
 * Alertas mock para tipos que NO genera automáticamente regenerateRestockAlerts:
 * stockout_risk, excess y restock histórico (resolved). Las alertas activas de
 * tipo `restock` se derivan en runtime desde supplyStock/productStock al iniciar
 * el servicio, evitando duplicación con los ids `auto-restock-*`.
 */
export const MOCK_ALERTS: Alert[] = [
  {
    id: 'a-4', type: 'stockout_risk', status: 'active', priority: 'medium',
    supplyId: 's-canela', itemName: 'Canela molida',
    message: 'Quiebre proyectado en 4 días si no se reabastece.',
    currentQty: 1.7, reorderPoint: 2,
    projectedStockoutDate: hoursAgo(-96), projectedDaysUntilStockout: 4,
    createdAt: daysAgo(1),
  },
  {
    id: 'a-6', type: 'excess', status: 'active', priority: 'medium',
    supplyId: 's-huevos', itemName: 'Huevos',
    message: 'Stock excesivo: 600 unidades en el máximo. Demanda real menor a la proyectada.',
    currentQty: 600, excessValue: 132000,
    createdAt: daysAgo(2),
  },
  {
    id: 'a-8', type: 'restock', status: 'resolved', priority: 'high',
    supplyId: 's-harina', itemName: 'Harina de trigo',
    message: 'OC #142 recibida. Stock repuesto a 163 kg.',
    createdAt: daysAgo(4), resolvedAt: daysAgo(3), resolvedBy: 'María González',
  },
];

export const MOCK_PREDICTIONS: DemandPrediction[] = MOCK_PRODUCTS.slice(0, 8).flatMap(p => [
  {
    id: `pred-${p.id}-lr`,
    productId: p.id,
    productName: p.name,
    modelType: 'linear_regression' as const,
    predictedValue: Math.round(20 + Math.random() * 80),
    lowerBound: Math.round(15 + Math.random() * 60),
    upperBound: Math.round(40 + Math.random() * 100),
    forDate: daysAgo(-7),
    mse: 4.2 + Math.random() * 3,
    r2: 0.72 + Math.random() * 0.2,
    mae: 1.5 + Math.random() * 2,
    featureImportance: {
      'día_semana': 0.42,
      'mes': 0.28,
      'tendencia': 0.20,
      'temperatura': 0.10,
    },
  },
  {
    id: `pred-${p.id}-dt`,
    productId: p.id,
    productName: p.name,
    modelType: 'decision_tree' as const,
    predictedValue: Math.round(22 + Math.random() * 78),
    lowerBound: Math.round(18 + Math.random() * 55),
    upperBound: Math.round(45 + Math.random() * 95),
    forDate: daysAgo(-7),
    mse: 3.8 + Math.random() * 2.5,
    r2: 0.78 + Math.random() * 0.18,
    mae: 1.3 + Math.random() * 1.8,
    featureImportance: {
      'día_semana': 0.51,
      'mes': 0.22,
      'tendencia': 0.18,
      'temperatura': 0.09,
    },
  },
]);

export const MOCK_PURCHASE_ORDERS: PurchaseOrder[] = [
  {
    id: 'po-1', code: 'OC-2025-142', supplier: 'Molinos del Sur',
    status: 'received',
    items: [{ supplyId: 's-harina', itemName: 'Harina de trigo', qty: 50, unitCost: 850, receivedQty: 50 }],
    totalCost: 42500,
    expectedDate: daysAgo(1), receivedAt: hoursAgo(3), createdAt: daysAgo(4),
  },
  {
    id: 'po-2', code: 'OC-2025-143', supplier: 'Costa',
    status: 'pending',
    items: [
      { supplyId: 's-choco', itemName: 'Chocolate cobertura', qty: 15, unitCost: 9800 },
      { supplyId: 's-cacao', itemName: 'Cacao en polvo', qty: 8, unitCost: 6500 },
    ],
    totalCost: 199000,
    expectedDate: daysAgo(-3), createdAt: daysAgo(1),
  },
  {
    id: 'po-3', code: 'OC-2025-144', supplier: 'Lefersa',
    status: 'pending',
    items: [{ supplyId: 's-levadura', itemName: 'Levadura fresca', qty: 10, unitCost: 4200 }],
    totalCost: 42000,
    expectedDate: daysAgo(-1), createdAt: hoursAgo(6),
  },
  {
    id: 'po-4', code: 'OC-2025-141', supplier: 'IANSA',
    status: 'received',
    items: [{ supplyId: 's-azucar', itemName: 'Azúcar granulada', qty: 80, unitCost: 950, receivedQty: 80 }],
    totalCost: 76000,
    expectedDate: daysAgo(5), receivedAt: daysAgo(5), createdAt: daysAgo(8),
  },
  {
    id: 'po-5', code: 'OC-2025-140', supplier: 'Soprole',
    status: 'cancelled',
    items: [{ supplyId: 's-queso', itemName: 'Queso crema', qty: 10, unitCost: 5400 }],
    totalCost: 54000,
    createdAt: daysAgo(10),
  },
  {
    id: 'po-6', code: 'OC-2025-145', supplier: 'Tostaduría Origen',
    status: 'pending',
    items: [{ productId: 'p-cafe', itemName: 'Café molido 250g', qty: 30, unitCost: 3500 }],
    totalCost: 105000,
    expectedDate: daysAgo(-5), createdAt: hoursAgo(2),
  },
];

// Órdenes de producción de muestra cubriendo todos los estados.
// El "purpose" es el motivo/destino interno del lote — no representa un
// compromiso con un cliente externo; el producto fabricado queda en stock.
export const MOCK_ORDERS: CustomerOrder[] = [
  {
    id: 'ord-1', code: 'ORD-001', purpose: 'Reposición vitrina mañana',
    status: 'pending',
    items: [
      { productId: 'p-baguette', productName: 'Baguette tradicional', unit: 'unidad', qty: 24, unitPrice: 1200, fulfilledQty: 0 },
      { productId: 'p-croissant', productName: 'Croissant mantequilla', unit: 'unidad', qty: 18, unitPrice: 1900, fulfilledQty: 0 },
    ],
    totalAmount: 24 * 1200 + 18 * 1900,
    notes: 'Para el primer turno del día siguiente',
    createdAt: hoursAgo(1),
    createdBy: 'María González',
    reservations: [],
    shortfalls: [],
  },
  {
    id: 'ord-2', code: 'ORD-002', purpose: 'Stock del fin de semana',
    status: 'pending',
    items: [
      { productId: 'p-marraqueta', productName: 'Marraqueta', unit: 'unidad', qty: 80, unitPrice: 320, fulfilledQty: 0 },
      { productId: 'p-hallulla', productName: 'Hallulla', unit: 'unidad', qty: 60, unitPrice: 280, fulfilledQty: 0 },
    ],
    totalAmount: 80 * 320 + 60 * 280,
    createdAt: hoursAgo(3),
    createdBy: 'Juan Pérez',
    reservations: [],
    shortfalls: [],
  },
  {
    id: 'ord-3', code: 'ORD-003', purpose: 'Lote tarde',
    status: 'in_production',
    items: [
      { productId: 'p-empanada', productName: 'Empanada queso', unit: 'unidad', qty: 30, unitPrice: 1700, fulfilledQty: 30 },
      { productId: 'p-brownie', productName: 'Brownie chocolate', unit: 'unidad', qty: 20, unitPrice: 2200, fulfilledQty: 20 },
    ],
    totalAmount: 30 * 1700 + 20 * 2200,
    createdAt: hoursAgo(5),
    createdBy: 'María González',
    productionStartedAt: hoursAgo(4),
    reservations: [
      { kind: 'supply', itemId: 's-harina', itemName: 'Harina de trigo', unit: 'kg', qty: 4.5 },
      { kind: 'supply', itemId: 's-queso', itemName: 'Queso crema', unit: 'kg', qty: 1.8 },
      { kind: 'supply', itemId: 's-choco', itemName: 'Chocolate cobertura', unit: 'kg', qty: 1.2 },
    ],
    shortfalls: [],
  },
  {
    id: 'ord-4', code: 'ORD-004', purpose: 'Pedido evento especial',
    status: 'in_production',
    items: [
      { productId: 'p-pie', productName: 'Pie de limón', unit: 'unidad', qty: 6, unitPrice: 18000, fulfilledQty: 4 },
      { productId: 'p-galleta', productName: 'Galleta avena pasas', unit: 'unidad', qty: 100, unitPrice: 600, fulfilledQty: 100 },
    ],
    totalAmount: 6 * 18000 + 100 * 600,
    notes: 'Esperando reposición de huevos y leche',
    createdAt: hoursAgo(8),
    createdBy: 'Sofía Rojas',
    productionStartedAt: hoursAgo(6),
    reservations: [
      { kind: 'supply', itemId: 's-mantequilla', itemName: 'Mantequilla sin sal', unit: 'kg', qty: 1.6 },
      { kind: 'supply', itemId: 's-azucar', itemName: 'Azúcar granulada', unit: 'kg', qty: 1.4 },
    ],
    shortfalls: [
      { kind: 'supply', itemId: 's-huevos', itemName: 'Huevos', unit: 'unidad', required: 12, available: 4, short: 8, forProductId: 'p-pie' },
      { kind: 'supply', itemId: 's-leche', itemName: 'Leche entera', unit: 'L', required: 2, available: 0.8, short: 1.2, forProductId: 'p-pie' },
    ],
  },
  {
    id: 'ord-5', code: 'ORD-005', purpose: 'Reposición principal',
    status: 'completed',
    items: [
      { productId: 'p-baguette', productName: 'Baguette tradicional', unit: 'unidad', qty: 40, unitPrice: 1200, fulfilledQty: 40 },
    ],
    totalAmount: 40 * 1200,
    createdAt: hoursAgo(20),
    createdBy: 'Juan Pérez',
    productionStartedAt: hoursAgo(18),
    completedAt: hoursAgo(2),
    reservations: [
      { kind: 'supply', itemId: 's-harina', itemName: 'Harina de trigo', unit: 'kg', qty: 30 },
      { kind: 'supply', itemId: 's-levadura', itemName: 'Levadura fresca', unit: 'kg', qty: 0.4 },
      { kind: 'supply', itemId: 's-sal', itemName: 'Sal de mesa', unit: 'kg', qty: 0.4 },
    ],
    shortfalls: [],
  },
  {
    id: 'ord-6', code: 'ORD-006', purpose: 'Lote viernes',
    status: 'completed',
    items: [
      { productId: 'p-croissant', productName: 'Croissant mantequilla', unit: 'unidad', qty: 50, unitPrice: 1900, fulfilledQty: 50 },
    ],
    totalAmount: 50 * 1900,
    createdAt: daysAgo(1),
    createdBy: 'María González',
    productionStartedAt: daysAgo(1),
    completedAt: hoursAgo(18),
    reservations: [
      { kind: 'supply', itemId: 's-harina', itemName: 'Harina de trigo', unit: 'kg', qty: 7.5 },
      { kind: 'supply', itemId: 's-mantequilla', itemName: 'Mantequilla sin sal', unit: 'kg', qty: 2.5 },
    ],
    shortfalls: [],
  },
];

// Devoluciones de muestra (Ventas → Producción).
export const MOCK_RETURNS: ProductReturn[] = [
  {
    id: 'ret-1',
    productId: 'p-baguette', productName: 'Baguette tradicional',
    qty: 4, unit: 'unidad',
    reason: 'defective',
    notes: 'Sobrecocidas, muy oscuras',
    costAtReturn: 380, totalLoss: 1520,
    createdAt: hoursAgo(2),
    createdBy: 'Juan Pérez',
  },
  {
    id: 'ret-2',
    productId: 'p-croissant', productName: 'Croissant mantequilla',
    qty: 6, unit: 'unidad',
    reason: 'leftover',
    notes: 'Quedaron del cierre de ayer',
    costAtReturn: 650, totalLoss: 3900,
    createdAt: hoursAgo(14),
    createdBy: 'Sofía Rojas',
  },
  {
    id: 'ret-3',
    productId: 'p-galleta', productName: 'Galleta avena pasas',
    qty: 3, unit: 'unidad',
    reason: 'damaged',
    costAtReturn: 180, totalLoss: 540,
    createdAt: daysAgo(1),
    createdBy: 'María González',
  },
  {
    id: 'ret-4',
    productId: 'p-cafe', productName: 'Café molido 250g (reventa)',
    qty: 1, unit: 'unidad',
    reason: 'expired',
    notes: 'Pasó la fecha del envase',
    costAtReturn: 3500, totalLoss: 3500,
    createdAt: daysAgo(2),
    createdBy: 'María González',
  },
];
