---
name: firebase
description: Backend de ItemFlow sobre Firebase (Firestore + Auth + Storage + Cloud Functions). Define el modelo multi-tenant bajo `tenants/{tenantId}/...`, las colecciones de ItemFlow (products, supplies, recipes, warehouses, stock_items, supply_stock_items, kardex_entries, supply_kardex, sale_records, alerts, abc_classifications, demand_predictions, purchase_orders), reglas de seguridad por rol admin/operator, kardex append-only, transacciones de stock por bodega, integración AngularFire, persistencia offline, emuladores y Cloud Functions para ML. Activar al trabajar en Firestore, Auth, Storage, reglas, Cloud Functions, deploy, o cualquier código que toque firebase.json/firestore.rules/storage.rules/src/environments.
---

# Firebase × ItemFlow — Backend

Stack backend: **Firebase** (Firestore + Auth + Storage + Hosting + Functions). Cliente vía **AngularFire** (`@angular/fire`).

ItemFlow es **multi-tenant**: cada empresa es un tenant aislado bajo `tenants/{tenantId}/...`. **Cruzar tenants es bug crítico** (data leak). Esto manda el diseño de modelo, reglas y queries.

---

## 1. Setup inicial (una vez)

1. `npm i firebase @angular/fire`
2. Crear proyecto en Firebase Console → copiar config a `src/environments/environment.ts` y `environment.prod.ts`.
3. Inicializar CLI: `firebase init` → Firestore, Storage, Functions, Hosting, Emulators.
4. Providers en `app.config.ts`:
   ```ts
   import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
   import { provideFirestore, getFirestore, enableMultiTabIndexedDbPersistence } from '@angular/fire/firestore';
   import { provideAuth, getAuth } from '@angular/fire/auth';
   import { provideStorage, getStorage } from '@angular/fire/storage';
   import { provideFunctions, getFunctions } from '@angular/fire/functions';
   import { environment } from '../environments/environment';

   providers: [
     provideFirebaseApp(() => initializeApp(environment.firebase)),
     provideFirestore(() => {
       const fs = getFirestore();
       enableMultiTabIndexedDbPersistence(fs).catch(() => {});
       return fs;
     }),
     provideAuth(() => getAuth()),
     provideStorage(() => getStorage()),
     provideFunctions(() => getFunctions(undefined, 'us-central1')),
   ]
   ```
5. **Nunca commitear claves reales.** El web config es público por diseño de Firebase, pero las reglas + App Check son la defensa real.

---

## 2. Multi-tenancy — la regla fundacional

### 2.1 Cómo se determina el tenant del usuario

Cada usuario tiene un **custom claim** `tenantId` en su token Auth, seteado por una Cloud Function al crear/aceptar invitación. Fallback (legacy / bootstrap del primer owner): documento `tenants/{tenantId}` con `adminEmail` = email del owner.

```ts
// En el cliente, leer el claim
import { user } from '@angular/fire/auth';

const claims = (await firebaseUser.getIdTokenResult()).claims;
const tenantId = claims['tenantId'] as string | undefined;
```

### 2.2 Estructura del path

**Todo** vive bajo `tenants/{tenantId}/...`. Sin excepciones para datos de negocio.

```
tenants/{tenantId}                              # doc raíz del tenant (Company)
  ├── members/{uid}                             # usuarios con acceso, rol admin|operator
  ├── plans/{planId}                            # plan vigente (cupos)
  ├── settings/{singleton}                      # configuración (moneda, zona horaria, idioma)
  ├── products/{productId}                      # catálogo (terminado)
  ├── supplies/{supplyId}                       # insumos
  ├── recipes/{productId}                       # 1 receta por producto, id == productId
  ├── warehouses/{warehouseId}                  # bodegas
  ├── stock_items/{itemId}                      # stock por (productId, warehouseId)
  ├── supply_stock_items/{itemId}               # stock por (supplyId, warehouseId)
  ├── kardex_entries/{entryId}                  # movimientos de productos (append-only)
  ├── supply_kardex/{entryId}                   # movimientos de insumos (append-only)
  ├── sale_records/{saleId}                     # ventas históricas (para ML)
  ├── alerts/{alertId}                          # alertas activas/resueltas
  ├── abc_classifications/{productId}           # clasificación ABC (re-calculada mensualmente)
  ├── demand_predictions/{predictionId}         # predicciones (read-only desde cliente)
  ├── model_comparisons/{comparisonId}          # comparación de modelos (read-only)
  ├── purchase_orders/{poId}                    # órdenes de compra
  └── outliers/{outlierId}                      # ventas outlier detectadas
```

**Por qué subcollections planas (no anidadas por warehouse):** queries como "todas las alertas activas del tenant" o "todo el stock crítico" se vuelven imposibles si está anidado por bodega. Filtramos por `warehouseId` en el doc.

---

## 3. Modelos de datos (interfaces TypeScript)

Definir en `src/app/core/models/`. Estos son los contratos compartidos.

### 3.1 Tenant y miembros

```ts
export interface Company {
  id: string;
  name: string;
  adminEmail: string;        // fallback de identificación si no hay custom claim
  currency: string;          // ISO 4217 ej. "CLP", "USD"
  timezone: string;          // ej. "America/Santiago"
  createdAt: Timestamp;
  planId: string;
}

export interface Member {
  uid: string;
  email: string;
  displayName: string;
  role: 'admin' | 'operator';   // NO owner/staff — ItemFlow usa 2 roles
  warehouseIds?: string[];      // operator puede ser restringido a bodegas específicas (opcional)
  createdAt: Timestamp;
  active: boolean;
}

export interface Plan {
  id: string;                   // 'free' | 'pro' | 'business'
  maxProducts: number;
  maxSupplies: number;
  maxWarehouses: number;
  maxMembers: number;
  features: string[];           // ['ml_predictions', 'abc_analysis', ...]
}
```

### 3.2 Catálogo

```ts
export interface Product {
  id: string;
  sku: string;                  // único en tenant
  name: string;
  description?: string;
  category?: string;
  unit: string;                 // "unidad", "kg", "L"
  buyPrice: number;             // costo de adquisición (cuando no hay receta)
  sellPrice: number;
  reorderPoint: number;         // umbral para alerta restock
  leadTime: number;             // días hasta recibir reorden
  imageUrl?: string;
  active: boolean;              // soft delete
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Supply {
  id: string;
  sku: string;
  name: string;
  description?: string;
  category?: string;
  unit: string;                 // "kg", "g", "L", "ml", "unidad"
  cost: number;                 // costo unitario actual (promedio o último)
  minStock: number;             // bajo esto = critical
  maxStock: number;             // sobre esto = excess
  reorderPoint: number;
  leadTime: number;
  supplier?: string;
  active: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 3.3 Recetas (BOM)

```ts
export interface Recipe {
  id: string;                   // == productId
  productId: string;
  yieldQty: number;             // unidades de producto que produce una corrida de la receta
  items: RecipeItem[];
  updatedAt: Timestamp;
}

export interface RecipeItem {
  supplyId: string;
  supplyName: string;           // denormalizado para listar sin join
  qty: number;                  // cantidad de supply por yieldQty unidades
  unit: string;
}
```

### 3.4 Bodegas y stock

```ts
export interface Warehouse {
  id: string;
  name: string;                 // "Bodega Central", "Sucursal Norte"
  address?: string;
  active: boolean;
  createdAt: Timestamp;
}

export type StockStatus = 'available' | 'low' | 'critical' | 'out';

export interface StockItem {
  id: string;                   // p.ej. `${productId}_${warehouseId}` o autoId
  productId: string;
  warehouseId: string;
  quantity: number;
  reservedQty: number;          // allocated a OCs pendientes / ventas en proceso
  status: StockStatus;          // recalculado en cada movimiento
  updatedAt: Timestamp;
}

export interface SupplyStockItem {
  id: string;
  supplyId: string;
  warehouseId: string;
  quantity: number;
  status: StockStatus;
  updatedAt: Timestamp;
}
```

### 3.5 Kardex (append-only)

```ts
export type KardexType = 'in' | 'out' | 'adjustment' | 'transfer';

export interface KardexEntry {
  id: string;
  productId?: string;           // uno de productId o supplyId
  supplyId?: string;
  warehouseId: string;
  type: KardexType;
  qty: number;                  // siempre positiva; el tipo da el signo
  balance: number;              // saldo resultante tras este movimiento
  cost?: number;                // costo unitario aplicable (PEPS/promedio)
  reason: string;               // 'sale' | 'purchase' | 'damaged' | 'expired' | 'count_correction' | 'transfer_out' | 'transfer_in' | 'manual'
  note?: string;                // texto libre opcional
  transferId?: string;          // si type=transfer, link a la otra entrada
  saleId?: string;              // si type=out por venta
  purchaseOrderId?: string;     // si type=in por OC
  userId: string;
  userName: string;             // denormalizado para auditoría sin join
  at: Timestamp;
}
```

> **Regla:** mismo modelo `KardexEntry` se usa para `kardex_entries` (productos) y `supply_kardex` (insumos). Distintas colecciones para que las queries del kardex de productos no traigan también los del insumo.

### 3.6 Ventas, alertas, ABC, predicciones, OCs

```ts
export interface SaleRecord {
  id: string;
  productId: string;
  qty: number;
  unitPrice: number;
  total: number;
  warehouseId: string;
  dayOfWeek: number;            // 0–6 (precalculado para ML feature)
  month: number;                // 1–12
  date: Timestamp;
  isOutlier: boolean;
  zScore?: number;
  createdAt: Timestamp;
}

export type AlertType = 'restock' | 'stockout_risk' | 'excess';
export type AlertStatus = 'active' | 'acknowledged' | 'resolved';
export type AlertPriority = 'high' | 'medium' | 'low';

export interface Alert {
  id: string;
  type: AlertType;
  status: AlertStatus;
  priority: AlertPriority;
  productId?: string;
  supplyId?: string;
  warehouseId: string;
  message: string;              // texto en español
  projectedStockoutDate?: Timestamp;       // solo stockout_risk
  projectedDaysUntilStockout?: number;     // solo stockout_risk
  excessValue?: number;                    // solo excess (capital congelado)
  createdAt: Timestamp;
  acknowledgedAt?: Timestamp;
  acknowledgedBy?: string;
  resolvedAt?: Timestamp;
  resolvedBy?: string;
}

export interface ABCItem {
  id: string;                   // productId
  productId: string;
  productName: string;
  annualConsumptionValue: number;
  percentOfTotal: number;
  accumulatedPercent: number;
  class: 'A' | 'B' | 'C';
  calculatedAt: Timestamp;
}

export interface DemandPrediction {
  id: string;
  productId: string;
  modelType: 'linear_regression' | 'decision_tree';
  predictedValue: number;
  lowerBound: number;
  upperBound: number;
  forDate: Timestamp;
  mse: number;
  r2: number;
  mae: number;
  featureImportance?: Record<string, number>;
  createdAt: Timestamp;
}

export interface PurchaseOrder {
  id: string;
  supplier: string;
  warehouseId: string;          // bodega destino
  status: 'pending' | 'received' | 'cancelled';
  items: PurchaseOrderItem[];
  totalCost: number;
  expectedDate?: Timestamp;
  receivedAt?: Timestamp;
  createdBy: string;
  createdAt: Timestamp;
}

export interface PurchaseOrderItem {
  supplyId: string;
  supplyName: string;
  qty: number;
  unitCost: number;
  receivedQty?: number;
}
```

---

## 4. Queries — patrones canónicos

Siempre **scope-by-tenant** vía path. Nunca confiar en filtros `where` para aislamiento (eso es lo que hacen las reglas).

```ts
import { Firestore, collection, query, where, orderBy, limit, collectionData } from '@angular/fire/firestore';

@Injectable({ providedIn: 'root' })
export class StockQueryService {
  private readonly firestore = inject(Firestore);
  private readonly tenantId = inject(TenantContext).id;

  /** Stock que requiere compra (low/critical/out) por bodega */
  needsRestock(warehouseId: string): Observable<StockItem[]> {
    const ref = collection(this.firestore, `tenants/${this.tenantId}/stock_items`);
    const q = query(
      ref,
      where('warehouseId', '==', warehouseId),
      where('status', 'in', ['low', 'critical', 'out']),
      orderBy('quantity'),
      limit(200),
    );
    return collectionData(q, { idField: 'id' }) as Observable<StockItem[]>;
  }

  /** Alertas activas del tenant */
  activeAlerts(): Observable<Alert[]> {
    const ref = collection(this.firestore, `tenants/${this.tenantId}/alerts`);
    const q = query(ref, where('status', '==', 'active'), orderBy('createdAt', 'desc'), limit(100));
    return collectionData(q, { idField: 'id' }) as Observable<Alert[]>;
  }

  /** Kardex de un insumo en una bodega */
  supplyKardex(supplyId: string, warehouseId: string): Observable<KardexEntry[]> {
    const ref = collection(this.firestore, `tenants/${this.tenantId}/supply_kardex`);
    const q = query(
      ref,
      where('supplyId', '==', supplyId),
      where('warehouseId', '==', warehouseId),
      orderBy('at', 'desc'),
      limit(100),
    );
    return collectionData(q, { idField: 'id' }) as Observable<KardexEntry[]>;
  }
}
```

**Índices compuestos:** Firestore loguea un link en consola la primera vez que falla un query — crear desde ahí. Confirma que `firestore.indexes.json` queda commiteado.

---

## 5. Mutaciones de stock — siempre en transacción

**Toda mutación de stock va en una transacción Firestore atómica** + escribe la entrada de kardex correspondiente. Sin excepciones.

### 5.1 Registrar entrada (recepción de compra)

```ts
import { runTransaction, doc, collection, serverTimestamp } from '@angular/fire/firestore';

async receiveSupply(input: {
  supplyId: string;
  warehouseId: string;
  qty: number;
  unitCost: number;
  reason: 'purchase' | 'return_from_customer' | 'manual';
  purchaseOrderId?: string;
  note?: string;
}) {
  const tenantId = this.tenantId;
  const fs = this.firestore;
  const stockRef = doc(fs, `tenants/${tenantId}/supply_stock_items/${input.supplyId}_${input.warehouseId}`);
  const kardexRef = doc(collection(fs, `tenants/${tenantId}/supply_kardex`));
  const supplyRef = doc(fs, `tenants/${tenantId}/supplies/${input.supplyId}`);

  await runTransaction(fs, async (tx) => {
    const stockSnap = await tx.get(stockRef);
    const supplySnap = await tx.get(supplyRef);
    if (!supplySnap.exists()) throw new Error('Insumo no existe');
    const supply = supplySnap.data() as Supply;

    const currentQty = stockSnap.exists() ? (stockSnap.data() as SupplyStockItem).quantity : 0;
    const newQty = currentQty + input.qty;
    const status = this.computeStatus(newQty, supply.reorderPoint, supply.minStock);

    if (stockSnap.exists()) {
      tx.update(stockRef, { quantity: newQty, status, updatedAt: serverTimestamp() });
    } else {
      tx.set(stockRef, {
        supplyId: input.supplyId,
        warehouseId: input.warehouseId,
        quantity: newQty,
        status,
        updatedAt: serverTimestamp(),
      });
    }

    tx.set(kardexRef, {
      supplyId: input.supplyId,
      warehouseId: input.warehouseId,
      type: 'in',
      qty: input.qty,
      balance: newQty,
      cost: input.unitCost,
      reason: input.reason,
      note: input.note ?? null,
      purchaseOrderId: input.purchaseOrderId ?? null,
      userId: this.currentUid(),
      userName: this.currentUserName(),
      at: serverTimestamp(),
    });

    // Actualizar costo promedio del supply (simplificación: promedio ponderado)
    const newCost = currentQty === 0
      ? input.unitCost
      : ((supply.cost * currentQty) + (input.unitCost * input.qty)) / newQty;
    tx.update(supplyRef, { cost: newCost, updatedAt: serverTimestamp() });
  });
}

private computeStatus(qty: number, reorderPoint: number, minStock: number): StockStatus {
  if (qty <= 0) return 'out';
  if (qty <= minStock) return 'critical';
  if (qty <= reorderPoint) return 'low';
  return 'available';
}
```

### 5.2 Registrar venta (descuenta insumos vía receta)

Regla de negocio: vender un producto con receta descuenta **los insumos**, no el producto.

```ts
async registerSale(input: { productId: string; qty: number; warehouseId: string; unitPrice: number; }) {
  const tenantId = this.tenantId;
  const fs = this.firestore;
  const productRef = doc(fs, `tenants/${tenantId}/products/${input.productId}`);
  const recipeRef = doc(fs, `tenants/${tenantId}/recipes/${input.productId}`);
  const saleRef = doc(collection(fs, `tenants/${tenantId}/sale_records`));

  await runTransaction(fs, async (tx) => {
    const productSnap = await tx.get(productRef);
    if (!productSnap.exists()) throw new Error('Producto no existe');
    const product = productSnap.data() as Product;

    const recipeSnap = await tx.get(recipeRef);

    // Caso A: producto con receta — descontar insumos proporcionalmente
    if (recipeSnap.exists()) {
      const recipe = recipeSnap.data() as Recipe;
      const factor = input.qty / recipe.yieldQty;

      for (const item of recipe.items) {
        const stockRef = doc(fs, `tenants/${tenantId}/supply_stock_items/${item.supplyId}_${input.warehouseId}`);
        const supplyRef = doc(fs, `tenants/${tenantId}/supplies/${item.supplyId}`);
        const stockSnap = await tx.get(stockRef);
        const supplySnap = await tx.get(supplyRef);
        if (!stockSnap.exists()) throw new Error(`Sin stock de ${item.supplyName} en bodega`);
        const supply = supplySnap.data() as Supply;
        const current = (stockSnap.data() as SupplyStockItem).quantity;
        const needed = item.qty * factor;
        if (current < needed) throw new Error(`Stock insuficiente de ${item.supplyName}: ${current} < ${needed}`);
        const newQty = current - needed;
        const status = this.computeStatus(newQty, supply.reorderPoint, supply.minStock);
        tx.update(stockRef, { quantity: newQty, status, updatedAt: serverTimestamp() });

        const kardexRef = doc(collection(fs, `tenants/${tenantId}/supply_kardex`));
        tx.set(kardexRef, {
          supplyId: item.supplyId,
          warehouseId: input.warehouseId,
          type: 'out',
          qty: needed,
          balance: newQty,
          cost: supply.cost,
          reason: 'sale',
          saleId: saleRef.id,
          userId: this.currentUid(),
          userName: this.currentUserName(),
          at: serverTimestamp(),
        });
      }
    } else {
      // Caso B: producto sin receta — descontar el producto mismo
      const stockRef = doc(fs, `tenants/${tenantId}/stock_items/${input.productId}_${input.warehouseId}`);
      const stockSnap = await tx.get(stockRef);
      if (!stockSnap.exists()) throw new Error('Sin stock del producto');
      const current = (stockSnap.data() as StockItem).quantity;
      if (current < input.qty) throw new Error(`Stock insuficiente: ${current} < ${input.qty}`);
      const newQty = current - input.qty;
      const status = this.computeStatus(newQty, product.reorderPoint, 0);
      tx.update(stockRef, { quantity: newQty, status, updatedAt: serverTimestamp() });

      const kardexRef = doc(collection(fs, `tenants/${tenantId}/kardex_entries`));
      tx.set(kardexRef, {
        productId: input.productId,
        warehouseId: input.warehouseId,
        type: 'out',
        qty: input.qty,
        balance: newQty,
        cost: product.buyPrice,
        reason: 'sale',
        saleId: saleRef.id,
        userId: this.currentUid(),
        userName: this.currentUserName(),
        at: serverTimestamp(),
      });
    }

    // Crear el SaleRecord (features para ML precalculadas)
    const now = new Date();
    tx.set(saleRef, {
      productId: input.productId,
      qty: input.qty,
      unitPrice: input.unitPrice,
      total: input.qty * input.unitPrice,
      warehouseId: input.warehouseId,
      dayOfWeek: now.getDay(),
      month: now.getMonth() + 1,
      date: serverTimestamp(),
      isOutlier: false,
      createdAt: serverTimestamp(),
    });
  });
}
```

### 5.3 Transferencia entre bodegas

Dos entradas de kardex linkeadas por `transferId`, atómicas.

```ts
async transferSupply(input: {
  supplyId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  qty: number;
}) {
  // Similar: 1 transaction, 2 KardexEntries (transfer_out / transfer_in)
  // mismo transferId en ambas, recálculo de status en ambas bodegas
}
```

### 5.4 Ajuste por conteo físico

```ts
async adjustStock(input: {
  supplyId: string;
  warehouseId: string;
  countedQty: number;
  reason: 'count_correction' | 'damaged' | 'expired' | 'lost' | 'theft';  // OBLIGATORIO
  note?: string;
}) {
  // Transaction: lee qty actual, computa delta, escribe stock + kardex tipo 'adjustment'
}
```

---

## 6. Reglas de seguridad (`firestore.rules`)

Estrictas por defecto. Aislamiento por tenant + control por rol.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() { return request.auth != null; }
    function tokenTenant() { return request.auth.token.tenantId; }
    function isInTenant(tenantId) { return isSignedIn() && tokenTenant() == tenantId; }
    function memberRole(tenantId) {
      return get(/databases/$(database)/documents/tenants/$(tenantId)/members/$(request.auth.uid)).data.role;
    }
    function isAdmin(tenantId) { return isInTenant(tenantId) && memberRole(tenantId) == 'admin'; }
    function isOperator(tenantId) { return isInTenant(tenantId) && memberRole(tenantId) == 'operator'; }
    function isAnyMember(tenantId) { return isAdmin(tenantId) || isOperator(tenantId); }

    match /tenants/{tenantId} {
      allow read: if isAnyMember(tenantId);
      allow update: if isAdmin(tenantId);
      allow create, delete: if false;  // crear tenant solo vía Cloud Function

      match /members/{uid} {
        allow read: if isAnyMember(tenantId);
        allow write: if isAdmin(tenantId);
      }

      match /plans/{planId} {
        allow read: if isAnyMember(tenantId);
        allow write: if false;  // solo backend (Cloud Function de billing)
      }

      // Catálogo y configuración: solo admin escribe
      match /products/{productId} {
        allow read: if isAnyMember(tenantId);
        allow write: if isAdmin(tenantId);
      }
      match /supplies/{supplyId} {
        allow read: if isAnyMember(tenantId);
        allow write: if isAdmin(tenantId);
      }
      match /recipes/{recipeId} {
        allow read: if isAnyMember(tenantId);
        allow write: if isAdmin(tenantId);
      }
      match /warehouses/{warehouseId} {
        allow read: if isAnyMember(tenantId);
        allow write: if isAdmin(tenantId);
      }
      match /settings/{document} {
        allow read: if isAnyMember(tenantId);
        allow write: if isAdmin(tenantId);
      }

      // Stock: lectura todos, escritura idealmente solo desde Cloud Functions
      // (en v1, permitir cliente con transacción; en v2 mover a Functions)
      match /stock_items/{itemId} {
        allow read: if isAnyMember(tenantId);
        allow write: if isAnyMember(tenantId);
      }
      match /supply_stock_items/{itemId} {
        allow read: if isAnyMember(tenantId);
        allow write: if isAnyMember(tenantId);
      }

      // Kardex: APPEND-ONLY. Crear sí, actualizar/borrar NUNCA.
      match /kardex_entries/{entryId} {
        allow read: if isAnyMember(tenantId);
        allow create: if isAnyMember(tenantId)
                      && request.resource.data.userId == request.auth.uid;
        allow update, delete: if false;
      }
      match /supply_kardex/{entryId} {
        allow read: if isAnyMember(tenantId);
        allow create: if isAnyMember(tenantId)
                      && request.resource.data.userId == request.auth.uid;
        allow update, delete: if false;
      }

      // Ventas: crear cualquier miembro, modificar nadie (auditoría)
      match /sale_records/{saleId} {
        allow read: if isAnyMember(tenantId);
        allow create: if isAnyMember(tenantId);
        allow update, delete: if false;
      }

      // Alertas: crear/leer todos, actualizar (acknowledge/resolve) todos, eliminar nadie
      match /alerts/{alertId} {
        allow read: if isAnyMember(tenantId);
        allow create: if isAnyMember(tenantId);
        allow update: if isAnyMember(tenantId);
        allow delete: if false;
      }

      // OCs
      match /purchase_orders/{poId} {
        allow read: if isAnyMember(tenantId);
        allow create, update: if isAdmin(tenantId);
        allow delete: if false;
      }

      // ML / ABC: read-only desde cliente
      match /abc_classifications/{id} {
        allow read: if isAnyMember(tenantId);
        allow write: if false;
      }
      match /demand_predictions/{id} {
        allow read: if isAnyMember(tenantId);
        allow write: if false;
      }
      match /model_comparisons/{id} {
        allow read: if isAnyMember(tenantId);
        allow write: if false;
      }
      match /outliers/{id} {
        allow read: if isAnyMember(tenantId);
        allow write: if false;
      }
    }
  }
}
```

**Testear reglas obligatoriamente** con `@firebase/rules-unit-testing` antes de cualquier deploy. Hay casos especialmente delicados:
- Operator no puede modificar catálogo/recetas/bodegas.
- Operator no puede ver `supplies.cost` ni `products.buyPrice` — esto requiere reglas a nivel **campo** (no soportado directamente en Firestore rules; usar **field masking en queries** o **Cloud Function intermedia** para reportes con costos).

---

## 7. Auth y guards

```ts
import { Auth, user } from '@angular/fire/auth';
import { toSignal } from '@angular/core/rxjs-interop';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = inject(Auth);
  readonly currentUser = toSignal(user(this.auth), { initialValue: null });

  async getTenantId(): Promise<string | undefined> {
    const u = this.auth.currentUser;
    if (!u) return undefined;
    const token = await u.getIdTokenResult();
    return token.claims['tenantId'] as string | undefined;
  }

  async getRole(): Promise<'admin' | 'operator' | undefined> {
    const u = this.auth.currentUser;
    if (!u) return undefined;
    const token = await u.getIdTokenResult();
    return token.claims['role'] as 'admin' | 'operator' | undefined;
  }
}
```

Guards funcionales:

```ts
export const authGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);
  return user(auth).pipe(take(1), map(u => !!u || router.createUrlTree(['/login'])));
};

export const adminGuard: CanActivateFn = async () => {
  const role = await inject(AuthService).getRole();
  return role === 'admin' || inject(Router).createUrlTree(['/forbidden']);
};
```

---

## 8. Storage

Para imágenes de productos/insumos: `/tenants/{tenantId}/products/{productId}/photo.jpg` etc.

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /tenants/{tenantId}/{folder}/{itemId}/{fileName} {
      allow read: if request.auth != null && request.auth.token.tenantId == tenantId;
      allow write: if request.auth != null
                   && request.auth.token.tenantId == tenantId
                   && request.resource.size < 5 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
    }
  }
}
```

Comprimir antes de upload (`@capacitor/camera` `quality: 70`, `width: 1280`).

---

## 9. Cloud Functions (qué corre en backend)

Funciones v2 TypeScript. Region `us-central1` por default.

**Obligatorias en ItemFlow:**

1. **`onUserCreate`** — al crear cuenta, asignar `tenantId` y `role` como custom claims.
2. **`onTenantCreate`** — crear `tenants/{id}` con plan free + member admin inicial.
3. **`recomputeAlerts`** (schedule diario + onWrite stock_items) — evaluar `restock` / `excess` / `stockout_risk` y crear/auto-resolver alertas.
4. **`trainPredictionModels`** (schedule semanal) — entrenar linear_regression + decision_tree por producto, escribir `demand_predictions` y `model_comparisons`.
5. **`recomputeABC`** (schedule mensual) — clasificar productos en A/B/C por consumo anual.
6. **`detectOutliers`** (onCreate sale_records) — IQR + Z-Score; marcar `isOutlier`/`zScore` en el sale; crear `outliers/{id}` si pasa umbral.
7. **`onPurchaseOrderReceived`** (onUpdate purchase_orders) — cuando `status` cambia a `received`, generar entradas `in` en `supply_kardex` automáticamente.
8. **`exportCsv`** (callable HTTPS) — generar CSV de stock/kardex/reportes (auditable, gating por rol).

No usar Functions para lo que un cliente puede hacer transaccionalmente — cold-start latency + costo.

---

## 10. Offline (Capacitor + Firestore)

- `enableMultiTabIndexedDbPersistence()` ya está en setup — Firestore cachea reads y encola writes.
- Detectar online con `@capacitor/network`:
  ```ts
  import { Network } from '@capacitor/network';
  const status = await Network.getStatus();
  this.online.set(status.connected);
  Network.addListener('networkStatusChange', s => this.online.set(s.connected));
  ```
- En offline:
  - Banner persistente: "Sin conexión — los cambios se sincronizarán cuando vuelvas a estar online".
  - Toast de "Guardado localmente, pendiente de sincronizar" (no decir "Guardado" a secas).
  - Bloquear creación de OC y registros que requieran timestamp del servidor para auditoría crítica.

---

## 11. Emuladores (dev local)

Antes de tocar prod:
```bash
firebase emulators:start --only auth,firestore,storage,functions
```

Wire en `app.config.ts` solo en dev:
```ts
import { connectFirestoreEmulator } from '@angular/fire/firestore';
import { connectAuthEmulator } from '@angular/fire/auth';

if (!environment.production) {
  connectFirestoreEmulator(firestore, 'localhost', 8080);
  connectAuthEmulator(auth, 'http://localhost:9099');
}
```

Tener seeds (`firestore.seed.json`) con un tenant demo + 1 admin + 1 operator + 5 productos + 10 insumos + 3 recetas + 2 bodegas para arrancar.

---

## 12. Hosting

Build de la app web (Ionic + Angular):
```bash
ng build --configuration production
firebase deploy --only hosting
```

`firebase.json` (rewrites SPA):
```json
{
  "hosting": {
    "public": "www",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  }
}
```

Confirmar `outputPath` en `angular.json`. Ionic 8 + Angular 20 default es `www/`.

---

## 13. Costos — alertas y mitigaciones

- Cada `where`/`orderBy` lee N docs; se cobra por read.
- `onSnapshot` solo cobra deltas — preferir sobre polling.
- Paginar con `startAfter()` cursors, nunca traer todo y slicear.
- Storage egress: comprimir imágenes antes de subir.
- Functions: cold-start cuesta; consolidar en menos funciones cuando posible.

---

## 14. Anti-patrones (prohibidos en ItemFlow)

| Don't | Por qué |
|---|---|
| Crear cualquier doc fuera de `tenants/{tenantId}/...` | Rompe aislamiento multi-tenant |
| Confiar en filtros `where('tenantId', '==', ...)` para aislamiento | Reglas son la defensa; un filtro sin regla deja el data abierto |
| Actualizar o borrar entradas del kardex | Append-only por regla de negocio Y por reglas Firestore |
| Mutar stock fuera de una `runTransaction` | Conduce a oversells por race conditions |
| Modelos `model_comparisons` / `demand_predictions` escribiendo desde cliente | Solo backend escribe; reglas lo bloquean |
| Operator escribiendo en `products` / `supplies` / `recipes` | Solo admin |
| Permitir borrar `purchase_orders` | Auditoría; en su lugar `status: 'cancelled'` |
| Guardar binarios en Firestore | Eso es Storage |
| Queries sin `limit()` en colecciones que crezcan | Lectura cara + UI colgada |
| Deploy sin correr rules tests + emulator smoke tests | Una regla mal escrita expone todo el tenant |
| Calcular ABC / predicciones en el cliente | El cliente solo lee resultados; entrenamiento en Functions |
| Hardcodear `tenantId` para testing | Fácil que se quede en prod — usar emulator + claims |
