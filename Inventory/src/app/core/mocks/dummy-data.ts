import {
  Member, Company, Product, Supply, Supplier, Recipe,
  StockItem, SupplyStockItem, KardexEntry, SaleRecord,
  Alert, DemandPrediction, PurchaseOrder, CustomerOrder, Customer,
  ReturnedLot,
} from '../models';

export const MOCK_COMPANY: Company = {
  id: 'tenant-noble',
  name: 'NOBLE',
  adminEmail: 'hola@noble.cr',
  currency: 'CRC',
  timezone: 'America/Costa_Rica',
};

export const MOCK_MEMBERS: Member[] = [
  { uid: 'u-admin', email: 'admin@noble.cr', displayName: 'María González', role: 'admin', active: true },
  { uid: 'u-produccion', email: 'produccion@noble.cr', displayName: 'Sofía Rojas', role: 'production', active: true },
  { uid: 'u-inventario', email: 'inventario@noble.cr', displayName: 'Diego Soto', role: 'inventory', active: true },
  { uid: 'u-operario', email: 'operario@noble.cr', displayName: 'Carlos Mora', role: 'operator', active: true },
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
  // Pan de masa madre
  { id: 'p-baguette', sku: 'PROD-BAG-001', name: 'Baguette de masa madre', description: 'Fermentación lenta 24h, corteza dorada', category: 'Pan masa madre', unit: 'unidad', buyPrice: 950, sellPrice: 2400, leadTime: 2, active: true, hasRecipe: true },
  { id: 'p-marraqueta', sku: 'PROD-PCA-001', name: 'Pain de campagne', description: 'Hogaza rústica de masa madre con centeno', category: 'Pan masa madre', unit: 'unidad', buyPrice: 1800, sellPrice: 4200, leadTime: 2, active: true, hasRecipe: true },
  { id: 'p-hallulla', sku: 'PROD-SDB-001', name: 'Sourdough boule', description: 'Pan redondo de masa madre, miga abierta', category: 'Pan masa madre', unit: 'unidad', buyPrice: 2200, sellPrice: 5500, leadTime: 2, active: true, hasRecipe: true },
  // Viennoiserie
  { id: 'p-croissant', sku: 'PROD-CRO-001', name: 'Croissant au beurre', description: 'Hojaldre de mantequilla, 72 capas', category: 'Viennoiserie', unit: 'unidad', buyPrice: 850, sellPrice: 2200, leadTime: 2, active: true, hasRecipe: true },
  { id: 'p-empanada', sku: 'PROD-FOC-001', name: 'Focaccia rústica', description: 'Aceite de oliva, romero y sal en escamas', category: 'Panes especiales', unit: 'unidad', buyPrice: 1400, sellPrice: 3600, leadTime: 1, active: true, hasRecipe: true },
  // Pastelería
  { id: 'p-brownie', sku: 'PROD-BRO-001', name: 'Brownie chocolate 70%', description: 'Cacao de origen único, textura fudge', category: 'Pastelería', unit: 'unidad', buyPrice: 950, sellPrice: 2600, leadTime: 2, active: true, hasRecipe: true },
  { id: 'p-pie', sku: 'PROD-TAR-001', name: 'Tarta de limón meringue', description: 'Base sablée, lemon curd y merengue italiano', category: 'Pastelería', unit: 'unidad', buyPrice: 6800, sellPrice: 19500, leadTime: 3, active: true, hasRecipe: true },
  { id: 'p-galleta', sku: 'PROD-MAC-001', name: 'Macaron surtido', description: 'Edición de la semana — 6 sabores', category: 'Pastelería', unit: 'unidad', buyPrice: 380, sellPrice: 1100, leadTime: 1, active: true, hasRecipe: true },
  // Reventa
  { id: 'p-cafe', sku: 'PROD-CAF-001', name: 'Café de altura Tarrazú 250g', description: 'Tueste medio · Los Santos · grano entero', category: 'Café & bebidas', unit: 'unidad', buyPrice: 4200, sellPrice: 7500, leadTime: 7, active: true, hasRecipe: false, reorderPoint: 12, minStock: 4 },
  { id: 'p-mermelada-rev', sku: 'PROD-MER-001', name: 'Mermelada artesanal fresa', description: 'Sin pectina añadida · 280g', category: 'Conservas', unit: 'unidad', buyPrice: 3200, sellPrice: 5800, leadTime: 7, active: true, hasRecipe: false, reorderPoint: 8, minStock: 3 },
];

export const MOCK_RECIPES: Recipe[] = [
  {
    id: 'p-baguette', productId: 'p-baguette', productName: 'Baguette de masa madre', yieldQty: 10,
    items: [
      { supplyId: 's-harina', itemName: 'Harina de trigo', qty: 1.5, unit: 'kg' },
      { supplyId: 's-sal', itemName: 'Sal de mesa', qty: 0.03, unit: 'kg' },
      { supplyId: 's-levadura', itemName: 'Levadura fresca', qty: 0.02, unit: 'kg' },
    ],
    notes: 'Amasar 12 min. Primera fermentación 1h en bloque. Formar baguettes y fermentar 45 min más. Hornear a 220°C con vapor por 22 min.',
  },
  {
    id: 'p-marraqueta', productId: 'p-marraqueta', productName: 'Pain de campagne', yieldQty: 20,
    items: [
      { supplyId: 's-harina', itemName: 'Harina de trigo', qty: 2.0, unit: 'kg' },
      { supplyId: 's-sal', itemName: 'Sal de mesa', qty: 0.04, unit: 'kg' },
      { supplyId: 's-levadura', itemName: 'Levadura fresca', qty: 0.025, unit: 'kg' },
    ],
  },
  {
    id: 'p-hallulla', productId: 'p-hallulla', productName: 'Sourdough boule', yieldQty: 20,
    items: [
      { supplyId: 's-harina', itemName: 'Harina de trigo', qty: 1.8, unit: 'kg' },
      { supplyId: 's-sal', itemName: 'Sal de mesa', qty: 0.035, unit: 'kg' },
      { supplyId: 's-mantequilla', itemName: 'Mantequilla sin sal', qty: 0.18, unit: 'kg' },
    ],
  },
  {
    id: 'p-croissant', productId: 'p-croissant', productName: 'Croissant au beurre', yieldQty: 12,
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
    id: 'p-empanada', productId: 'p-empanada', productName: 'Focaccia rústica', yieldQty: 10,
    items: [
      { supplyId: 's-harina', itemName: 'Harina de trigo', qty: 0.5, unit: 'kg' },
      { supplyId: 's-queso', itemName: 'Queso crema', qty: 0.35, unit: 'kg' },
      { supplyId: 's-mantequilla', itemName: 'Mantequilla sin sal', qty: 0.1, unit: 'kg' },
      { supplyId: 's-sal', itemName: 'Sal de mesa', qty: 0.01, unit: 'kg' },
    ],
  },
  {
    id: 'p-brownie', productId: 'p-brownie', productName: 'Brownie chocolate 70%', yieldQty: 16,
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
    id: 'p-pie', productId: 'p-pie', productName: 'Tarta de limón meringue', yieldQty: 1,
    items: [
      { supplyId: 's-harina', itemName: 'Harina de trigo', qty: 0.25, unit: 'kg' },
      { supplyId: 's-mantequilla', itemName: 'Mantequilla sin sal', qty: 0.15, unit: 'kg' },
      { supplyId: 's-azucar', itemName: 'Azúcar granulada', qty: 0.2, unit: 'kg' },
      { supplyId: 's-huevos', itemName: 'Huevos', qty: 6, unit: 'unidad' },
      { supplyId: 's-leche', itemName: 'Leche entera', qty: 0.4, unit: 'L' },
    ],
  },
  {
    id: 'p-galleta', productId: 'p-galleta', productName: 'Macaron surtido', yieldQty: 24,
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
  // Productos sin receta: stock de reventa.
  // Productos con receta: aparecen aquí solo si tienen unidades disponibles
  // (sobras de producción o devoluciones ya procesadas en Mermas).
  const stockByItem: Record<string, number> = {
    'p-cafe':           7,   // low (entre minStock=4 y reorderPoint=12)
    'p-mermelada-rev':  2,   // critical (≤ minStock=3)
  };
  return MOCK_PRODUCTS
    .filter(p => !p.hasRecipe || stockByItem[p.id] !== undefined)
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
const daysFromNow = (d: number) => {
  const x = new Date();
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() + d);
  return x;
};

/**
 * Genera 30 días de kardex 'out' para productos terminados, simulando
 * entregas a clientes (pedidos completados). Esto es lo que alimenta las
 * predicciones: el rolling-mean/std se computa sobre estas entradas.
 *
 * La distribución usa los mismos baseQty / multiplicadores semanales que el
 * generador anterior basado en SaleRecord, así las predicciones mantienen
 * su realismo histórico ahora que dependen de "productos completados a
 * clientes" en vez de un stream de ventas separado.
 */
const HISTORICAL_PRODUCT_DELIVERIES_KARDEX: KardexEntry[] = (() => {
  const entries: KardexEntry[] = [];
  let id = 1;
  for (let d = 0; d < 30; d++) {
    const date = daysAgo(d);
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
      const isOutlier = Math.random() < 0.04;
      const finalQty = isOutlier ? Math.round(qty * 2.5) : qty;
      entries.push({
        id: `k-hist-${id++}`,
        productId: product.id,
        itemName: product.name,
        type: 'out',
        qty: finalQty,
        balance: 0, // histórico — balance no es relevante para predicciones
        cost: product.buyPrice,
        reason: 'sale',
        note: 'Pedido completado entregado al cliente',
        userId: 'u-produccion',
        userName: 'Sofía Rojas',
        at: date,
      });
    }
  }
  return entries;
})();

export const MOCK_KARDEX: KardexEntry[] = [
  { id: 'k-1', supplyId: 's-harina', itemName: 'Harina de trigo', type: 'in', qty: 50, balance: 163, cost: 850, reason: 'purchase', note: 'OC #142 recibida', userId: 'u-admin', userName: 'María González', at: hoursAgo(3) },

  { id: 'k-2', supplyId: 's-harina', itemName: 'Harina de trigo', type: 'out', qty: 7.5, balance: 113, cost: 850, reason: 'sale', userId: 'u-produccion', userName: 'Sofía Rojas', at: hoursAgo(8) },
  { id: 'k-3', supplyId: 's-levadura', itemName: 'Levadura fresca', type: 'out', qty: 0.5, balance: 11, cost: 4200, reason: 'sale', userId: 'u-produccion', userName: 'Sofía Rojas', at: hoursAgo(12) },
  { id: 'k-6', supplyId: 's-azucar', itemName: 'Azúcar granulada', type: 'adjustment', qty: 2, balance: 97, cost: 950, reason: 'count_correction', note: 'Diferencia inventario físico', userId: 'u-admin', userName: 'María González', at: daysAgo(2) },
  { id: 'k-7', supplyId: 's-cacao', itemName: 'Cacao en polvo', type: 'out', qty: 0.3, balance: 0, cost: 6500, reason: 'sale', userId: 'u-produccion', userName: 'Sofía Rojas', at: daysAgo(2) },
  { id: 'k-8', supplyId: 's-choco', itemName: 'Chocolate cobertura', type: 'in', qty: 10, balance: 4, cost: 9800, reason: 'purchase', note: 'OC #138', userId: 'u-admin', userName: 'María González', at: daysAgo(3) },
  { id: 'k-9', supplyId: 's-huevos', itemName: 'Huevos', type: 'in', qty: 180, balance: 600, cost: 220, reason: 'purchase', userId: 'u-admin', userName: 'María González', at: daysAgo(3) },
  { id: 'k-10', supplyId: 's-leche', itemName: 'Leche entera', type: 'adjustment', qty: -2, balance: 86, cost: 1100, reason: 'damaged', note: 'Cartones vencidos', userId: 'u-produccion', userName: 'Sofía Rojas', at: daysAgo(4) },
  { id: 'k-11', supplyId: 's-harina', itemName: 'Harina de trigo', type: 'out', qty: 12, balance: 120, cost: 850, reason: 'sale', userId: 'u-produccion', userName: 'Sofía Rojas', at: daysAgo(5) },

  // ORD-009 confirmado con devolución (24 entregados, 4 devueltos). El reintegro al
  // stock ocurre cuando el lote se procesa en la pantalla de Mermas.
  { id: 'k-ord9-out', productId: 'p-croissant', itemName: 'Croissant au beurre', type: 'out', qty: 24, balance: 0, cost: 650, reason: 'sale', note: 'Pedido ORD-009 entregado a Cafetería La Esquina', userId: 'cust-1', userName: 'Cafetería La Esquina', at: daysAgo(2) },

  // 30 días de historial de entregas de pedidos completados (alimenta predicciones)
  ...HISTORICAL_PRODUCT_DELIVERIES_KARDEX,
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
    items: [{ productId: 'p-cafe', itemName: 'Café de altura Tarrazú 250g', qty: 30, unitCost: 3500 }],
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
    customerId: 'cust-1',
    requestedDeliveryDate: daysFromNow(2),
    items: [
      { productId: 'p-baguette', productName: 'Baguette de masa madre', unit: 'unidad', qty: 24, unitPrice: 1200, fulfilledQty: 0 },
      { productId: 'p-croissant', productName: 'Croissant au beurre', unit: 'unidad', qty: 18, unitPrice: 1900, fulfilledQty: 0 },
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
    customerId: 'cust-2',
    requestedDeliveryDate: daysFromNow(3),
    items: [
      { productId: 'p-marraqueta', productName: 'Pain de campagne', unit: 'unidad', qty: 80, unitPrice: 320, fulfilledQty: 0 },
      { productId: 'p-hallulla', productName: 'Sourdough boule', unit: 'unidad', qty: 60, unitPrice: 280, fulfilledQty: 0 },
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
    customerId: 'cust-3',
    requestedDeliveryDate: daysFromNow(1),
    items: [
      { productId: 'p-empanada', productName: 'Focaccia rústica', unit: 'unidad', qty: 30, unitPrice: 1700, fulfilledQty: 20 },
      { productId: 'p-brownie', productName: 'Brownie chocolate 70%', unit: 'unidad', qty: 20, unitPrice: 2200, fulfilledQty: 20 },
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
    customerId: 'cust-3',
    requestedDeliveryDate: daysFromNow(5),
    items: [
      { productId: 'p-pie', productName: 'Tarta de limón meringue', unit: 'unidad', qty: 6, unitPrice: 18000, fulfilledQty: 4 },
      { productId: 'p-galleta', productName: 'Macaron surtido', unit: 'unidad', qty: 100, unitPrice: 600, fulfilledQty: 100 },
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
      { productId: 'p-baguette', productName: 'Baguette de masa madre', unit: 'unidad', qty: 40, unitPrice: 1200, fulfilledQty: 40 },
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
      { productId: 'p-croissant', productName: 'Croissant au beurre', unit: 'unidad', qty: 50, unitPrice: 1900, fulfilledQty: 50 },
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
  {
    id: 'ord-7', code: 'ORD-007', purpose: 'Pedido cliente segundo',
    status: 'pending',
    customerId: 'cust-2',
    requestedDeliveryDate: daysFromNow(2),
    items: [
      { productId: 'p-croissant', productName: 'Croissant au beurre', unit: 'unidad', qty: 12, unitPrice: 1900, fulfilledQty: 0 },
      { productId: 'p-baguette', productName: 'Baguette de masa madre', unit: 'unidad', qty: 10, unitPrice: 1200, fulfilledQty: 0 },
    ],
    totalAmount: 12 * 1900 + 10 * 1200,
    notes: 'Mismo día que ORD-001: produce todo junto',
    createdAt: hoursAgo(2),
    createdBy: 'Cliente: Hotel Plaza Centro',
    reservations: [],
    shortfalls: [],
  },
  // Pedido completed esperando confirmación del cliente
  {
    id: 'ord-8', code: 'ORD-008', purpose: 'Lote vitrina',
    status: 'completed',
    customerId: 'cust-1',
    requestedDeliveryDate: daysAgo(0),
    items: [
      { productId: 'p-baguette', productName: 'Baguette de masa madre', unit: 'unidad', qty: 20, unitPrice: 1200, fulfilledQty: 20 },
      { productId: 'p-empanada', productName: 'Focaccia rústica', unit: 'unidad', qty: 15, unitPrice: 1700, fulfilledQty: 15 },
    ],
    totalAmount: 20 * 1200 + 15 * 1700,
    createdAt: daysAgo(2),
    createdBy: 'Cliente: Cafetería La Esquina',
    productionStartedAt: daysAgo(1),
    completedAt: hoursAgo(2),
    reservations: [
      { kind: 'supply', itemId: 's-harina', itemName: 'Harina de trigo', unit: 'kg', qty: 5 },
      { kind: 'supply', itemId: 's-queso', itemName: 'Queso crema', unit: 'kg', qty: 0.9 },
    ],
    shortfalls: [],
  },
  // Pedido ya confirmado por el cliente con diferencia (muestra historial con monto final)
  {
    id: 'ord-9', code: 'ORD-009', purpose: 'Reposición semanal',
    status: 'completed',
    customerId: 'cust-1',
    requestedDeliveryDate: daysAgo(3),
    items: [
      { productId: 'p-croissant', productName: 'Croissant au beurre', unit: 'unidad', qty: 24, unitPrice: 1900, fulfilledQty: 24, receivedQty: 20 },
      { productId: 'p-baguette', productName: 'Baguette de masa madre', unit: 'unidad', qty: 15, unitPrice: 1200, fulfilledQty: 15, receivedQty: 15 },
    ],
    totalAmount: 24 * 1900 + 15 * 1200,
    finalAmount: 20 * 1900 + 15 * 1200,
    customerConfirmedAt: daysAgo(2),
    customerNote: '4 croissants llegaron quebrados, los devolvimos',
    createdAt: daysAgo(5),
    createdBy: 'Cliente: Cafetería La Esquina',
    productionStartedAt: daysAgo(4),
    completedAt: daysAgo(3),
    reservations: [],
    shortfalls: [],
  },
];


// Clientes de muestra con sus tokens públicos y PINs.
export const MOCK_CUSTOMERS: Customer[] = [
  {
    id: 'cust-1',
    name: 'Cafetería La Esquina',
    contactPerson: 'Daniel Vargas',
    email: 'daniel@laesquina.cr',
    phone: '+506 8888-1111',
    publicToken: 'esquina-abc123',
    accessPin: '482915',
    allowedProductIds: ['p-baguette', 'p-croissant', 'p-empanada'],
    window: {
      orderDays: [1, 2, 3, 4, 5],  // lunes a viernes
      deliveryDays: [2, 3, 4, 5, 6], // martes a sábado
    },
    notes: 'Entregar a las 7:00 AM al ingreso de carga.',
    active: true,
    createdAt: daysAgo(30),
  },
  {
    id: 'cust-2',
    name: 'Hotel Plaza Centro',
    contactPerson: 'Sandra Mora',
    email: 'compras@hotelplaza.cr',
    phone: '+506 2222-3333',
    publicToken: 'plaza-xyz789',
    accessPin: '731264',
    allowedProductIds: ['p-marraqueta', 'p-hallulla', 'p-baguette', 'p-croissant', 'p-cafe'],
    window: {
      orderDays: [0, 1, 2, 3, 4, 5, 6],   // todos los días
      deliveryDays: [1, 3, 5],            // lun, mié, vie
    },
    active: true,
    createdAt: daysAgo(15),
  },
  {
    id: 'cust-3',
    name: 'Catering Eventos Sur',
    contactPerson: 'Roberto Soto',
    email: 'eventos@cateringsur.cr',
    publicToken: 'catering-def456',
    accessPin: '109238',
    allowedProductIds: [],   // vacío → todos los productos
    window: {
      orderDays: [1, 4],     // lun y jue
      deliveryDays: [5, 6],  // vie y sáb
    },
    notes: 'Pedidos para eventos con al menos 48h de anticipación.',
    active: true,
    createdAt: daysAgo(7),
  },
];

// Proveedores estructurados con sus ventanas de pedido/entrega.
export const MOCK_SUPPLIERS: Supplier[] = [
  {
    id: 'sup-1',
    name: 'Molinos del Sur',
    contactPerson: 'Carlos Méndez',
    email: 'ventas@molinosdelsur.cr',
    phone: '+506 2222-4400',
    leadTimeDays: 3,
    orderDays: [1, 3],          // lunes y miércoles
    deliveryDays: [3, 5],       // miércoles y viernes
    paymentTerms: '30 días',
    suppliedItems: [
      { kind: 'supply', itemId: 's-harina' },
    ],
    notes: 'Pedido mínimo 50kg. Descuento por volumen sobre 200kg.',
    active: true,
    createdAt: daysAgo(120),
  },
  {
    id: 'sup-2',
    name: 'IANSA',
    contactPerson: 'Ana Vargas',
    email: 'pedidos@iansa.cr',
    phone: '+506 2255-8800',
    leadTimeDays: 2,
    orderDays: [2, 4],          // martes y jueves
    deliveryDays: [4, 6],       // jueves y sábado
    paymentTerms: 'Contado',
    suppliedItems: [
      { kind: 'supply', itemId: 's-azucar' },
    ],
    active: true,
    createdAt: daysAgo(80),
  },
  {
    id: 'sup-3',
    name: 'Soprole',
    contactPerson: 'Roberto Cruz',
    email: 'cuentas@soprole.cr',
    phone: '+506 4000-1212',
    leadTimeDays: 1,
    orderDays: [1, 2, 3, 4, 5],
    deliveryDays: [1, 2, 3, 4, 5, 6],
    paymentTerms: '15 días',
    suppliedItems: [
      { kind: 'supply', itemId: 's-mantequilla' },
      { kind: 'supply', itemId: 's-leche' },
      { kind: 'supply', itemId: 's-queso' },
    ],
    notes: 'Entrega temprana antes de 8am.',
    active: true,
    createdAt: daysAgo(60),
  },
  {
    id: 'sup-4',
    name: 'Costa Chocolates',
    contactPerson: 'Diego Soto',
    email: 'wholesale@costa.cr',
    phone: '+506 2233-9900',
    leadTimeDays: 5,
    orderDays: [1],             // solo lunes
    deliveryDays: [5],          // entrega viernes
    paymentTerms: '30 días',
    suppliedItems: [
      { kind: 'supply', itemId: 's-choco' },
      { kind: 'supply', itemId: 's-cacao' },
      { kind: 'product', itemId: 'p-cafe' },        // café de reventa
      { kind: 'product', itemId: 'p-mermelada-rev' }, // mermelada de reventa
    ],
    notes: 'Productos premium. Almacenar bajo 18°C.',
    active: true,
    createdAt: daysAgo(45),
  },
];

// Lotes devueltos pendientes de revisar en la pantalla de Mermas.
export const MOCK_RETURNED_LOTS: ReturnedLot[] = [
  {
    id: 'lot-ord9-croissant',
    kind: 'customer_return',
    productId: 'p-croissant',
    productName: 'Croissant au beurre',
    unit: 'unidad',
    qty: 4,
    mermaQty: 0,
    sourceOrderId: 'ord-9',
    sourceOrderCode: 'ORD-009',
    customerId: 'cust-1',
    customerName: 'Cafetería La Esquina',
    customerNote: '4 croissants llegaron quebrados, los devolvimos',
    createdAt: daysAgo(2),
    status: 'pending',
  },
  // Ejemplo de merma de producción: 3 baguettes que se quemaron al hornear
  {
    id: 'lot-prod-baguette-1',
    kind: 'production',
    productId: 'p-baguette',
    productName: 'Baguette de masa madre',
    unit: 'unidad',
    qty: 3,
    mermaQty: 3,
    productionReason: 'overbaked',
    productionReasonText: undefined,
    reviewNote: 'Horno quedó 15 min de más, corteza muy oscura',
    createdAt: daysAgo(1),
    status: 'reviewed',
    reviewedAt: daysAgo(1),
    reviewedBy: 'Sofía Rojas',
  },
];
