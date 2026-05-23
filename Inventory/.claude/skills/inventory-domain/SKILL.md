---
name: inventory-domain
description: Contexto de negocio del proyecto ItemFlow — sistema de gestión de inventarios multi-tenant para PYMES con catálogo, insumos, recetas (BOM), kardex, alertas inteligentes, clasificación ABC y predicción de demanda. Úsalo para tomar decisiones de producto, modelar features de inventario, calcular KPIs o interpretar el flujo del negocio.
user-invocable: true
allowed-tools:
  - Read
  - Edit
  - Write
  - Bash
---

# /itemflow — Contexto de Negocio: Gestión de Inventarios

ItemFlow es un **SaaS multi-tenant de gestión de inventarios** orientado a PYMES (típicamente restaurantes, panaderías, manufactura ligera y retail) que necesitan controlar **insumos**, **producto terminado**, **recetas**, **ventas** y **reabastecimiento** con un flujo claro y alertas automáticas.

> **Cuándo invocar este skill:** al trabajar en cualquier feature del dominio de inventarios (alertas, kardex, ABC, predicciones, recetas, órdenes de compra, KPIs). Léelo para no inventar reglas de negocio y mantener consistencia con el flujo establecido.

---

## 1. Quién usa ItemFlow

- **Persona principal:** dueño/gerente de PYME que hoy lleva inventario en Excel y pierde plata por roturas de stock o sobre-stock.
- **Persona secundaria:** operador de bodega (rol `operator`) que registra entradas/salidas y consulta stock por bodega.
- **Pain point central:** no saben **cuánto comprar, cuándo comprar y de qué**. Compran tarde (rotura) o de más (capital congelado y merma).
- **Promesa de valor:** "tu inventario te avisa qué pedir antes de que te quedes sin nada, basado en tus ventas reales y tus recetas".

**Multi-tenant:** cada empresa (`Company`) es un tenant aislado. Un tenant tiene varias **bodegas** (`warehouses`), varias **cuentas** de usuario con rol `admin` u `operator`, y un **plan** con cupos.

---

## 2. Flujo del negocio (orden de configuración obligatorio)

El usuario debe configurar el sistema en este orden — la UI lo refuerza con un wizard de 4 pasos:

```
1. Catálogo  →  2. Insumos  →  3. Recetas (BOM)  →  4. Ventas
                                       ↓
                          Inventario / Kardex / Alertas / ABC / Predicciones
```

| Paso | Qué define | Por qué primero |
|------|------------|-----------------|
| **1. Catálogo** | Productos terminados (lo que se vende al cliente final) | Sin productos no hay nada que vender ni stockear |
| **2. Insumos** | Materias primas (lo que se compra a proveedores) | Son la materia prima de las recetas y lo que realmente se reordena |
| **3. Recetas (BOM)** | Cuántos insumos consume cada producto terminado | Permite descontar insumos automáticamente al vender un producto |
| **4. Ventas** | Registro histórico de ventas | Alimenta predicción de demanda y clasificación ABC |

> **Regla de negocio:** las páginas downstream (Inventario, Alertas, Predicciones) muestran **empty state con CTA al paso faltante** si no se completaron los anteriores. Nunca permitir saltar pasos.

---

## 3. Entidades del dominio (vocabulario)

### Producto terminado (`Product`)
Lo que el negocio vende. Tiene `sku`, `buyPrice`, `sellPrice`, `reorderPoint`, `leadTime` (días hasta que llega el reorden), `unit` (ej. "unidad", "kg").

### Insumo / Materia prima (`Supply`)
Lo que el negocio compra. Tiene `cost`, `minStock`, `maxStock`, `reorderPoint`. **Los insumos son los que típicamente disparan alertas de compra**, porque son los que se reordenan en la práctica.

### Bodega (`Warehouse`)
Ubicación física. El stock es **por (producto/insumo, bodega)**, nunca a nivel global. Soporta **transferencias** entre bodegas.

### Stock (`StockItem` / `SupplyStockItem`)
Cantidad disponible en una bodega. Tiene 4 estados:

| Estado | Regla | Color UI | Acción típica |
|--------|-------|----------|---------------|
| `available` | `quantity > reorderPoint` | verde | ninguna |
| `low` | `reorderPoint >= quantity > minStock` | amarillo | considerar reorden |
| `critical` | `quantity <= minStock && quantity > 0` | naranja | reorden urgente |
| `out` | `quantity == 0` | rojo | quiebre — pérdida de venta |

> **Recálculo:** `status` se debe recalcular en cada movimiento de kardex. No confiar en el valor persistido sin validarlo cuando se haga lectura crítica.

### Receta / BOM (`Recipe`)
Una receta **por producto terminado** (`id == productId`). Define `items: RecipeItem[]` con la cantidad de cada `Supply` que consume **una unidad** del producto (o `yieldQty` unidades si la receta rinde múltiples).

Ejemplo: receta de "Pan baguette" (`yieldQty: 10`) consume `harina: 1.5 kg`, `sal: 30 g`, `levadura: 20 g` para producir 10 baguettes.

### Kardex (`KardexEntry`, `supply_kardex`)
**Append-only**. Historial de movimientos. Tipos:
- `in` — entrada (compra recibida, devolución de cliente, ajuste positivo)
- `out` — salida (venta, merma, ajuste negativo)
- `adjustment` — ajuste por inventario físico (recuento)
- `transfer` — movimiento entre bodegas (genera 2 entradas: out en origen, in en destino)

Cada entrada guarda `balance` = saldo resultante tras el movimiento, `userId`/`userName` (auditoría), `reason`, `cost?` (para costeo PEPS/promedio).

### Venta (`SaleRecord`)
Registro histórico para ML. Tiene `dayOfWeek` y `month` precalculados como features. Marca `isOutlier` y `zScore` cuando se detectan ventas atípicas (IQR o Z-Score).

### Alerta (`Alert`)
Generada automáticamente. 3 tipos:
- **`restock`** — stock bajo el `reorderPoint`. Naranja `#D97706`. Sugiere generar orden de compra.
- **`stockout_risk`** — predicción ML indica quiebre en X días aunque stock actual parezca ok. Rojo `#DC2626`. Incluye `projectedStockoutDate` y `projectedDaysUntilStockout`.
- **`excess`** — stock > `maxStock` o demanda real << proyectada. Violeta `#7C3AED`. Incluye `excessValue` (capital congelado).

Estados: `active → acknowledged → resolved`. Prioridades: `high | medium | low`. El operador puede **marcar como revisada** o **resolver** desde el action sheet.

### ABC (`ABCItem`)
Clasifica productos por **valor anual consumido** (cantidad × precio):
- **A:** top 80% del valor (≈20% de los SKUs). Control estricto, conteo frecuente.
- **B:** siguiente 15% del valor. Control medio.
- **C:** último 5% del valor (la mayoría de SKUs). Control relajado, lotes grandes.

### Predicciones (`DemandPrediction`, `ModelComparison`)
Dos modelos por producto: `linear_regression` y `decision_tree`. Se elige el de mejor `r2`/`mae`. Devuelve `predictedValue` con `lowerBound`/`upperBound` (intervalo de confianza). El cliente **solo lee**; el entrenamiento corre en backend (Cloud Functions, aún por implementar).

### Orden de compra (`PurchaseOrder`)
Estado `pending → received | cancelled`. Cuando se marca `received`, debe generar automáticamente entrada de kardex tipo `in` por la cantidad recibida.

---

## 4. Reglas de negocio clave

### Reabastecimiento
- **Punto de reorden** (`reorderPoint`): nivel en el que se debe pedir más. Fórmula recomendada: `demanda_promedio_diaria × leadTime + safetyStock`.
- **Safety stock**: colchón para variabilidad de demanda y lead time.
- **Lote económico**: cantidad sugerida a comprar = `maxStock - quantity_actual` (simplificación; en futuro EOQ).

### Costeo
- `cost` (insumo) y `buyPrice` (producto) se usan para valorizar inventario.
- Margen = `sellPrice - costo_unitario_real` (vía recetas + costo de insumos).
- ABC usa `annualConsumptionValue = quantity_anual × cost`.

### Movimientos (kardex)
- **Toda salida de stock genera kardex**. Sin excepción. Incluso una corrección por conteo físico va como `adjustment`.
- **Una venta de un producto con receta descuenta insumos**, no el producto. (Modelo manufactura justo-a-tiempo; productos sin receta se descuentan ellos mismos.)
- **Transferencias** generan dos entradas atómicas (batch).

### Alertas
- Se evalúan en cada cambio de stock relevante y idealmente vía job diario.
- Una alerta `restock` se **auto-resuelve** cuando llega stock que sube por encima del `reorderPoint`.
- Una alerta `excess` se **auto-resuelve** cuando se vende suficiente para volver a rango.
- Las `stockout_risk` requieren acción manual (generar OC o ajustar predicción).

### Multi-bodega
- Las alertas y el stock se evalúan **por bodega**. Un producto puede estar OK en bodega central y `critical` en sucursal.
- ABC y predicciones se calculan a nivel **tenant** (no por bodega).

### Roles
- **Admin** (`role: 'admin'`): puede CRUD productos, insumos, recetas, bodegas, configurar tenant, ver reportes.
- **Operator** (`role: 'operator'`): registra movimientos (entradas, salidas, ventas, transferencias), revisa/resuelve alertas, consulta stock. **No puede** modificar catálogo, recetas ni reglas de stock.

---

## 5. KPIs y métricas que muestra la app

### Página Inventario (cards superiores)
- **Total Productos** — count de SKUs activos en catálogo.
- **Requieren Compra** — count de items con `status` ∈ {`low`, `critical`, `out`}.
- **Unidades a Comprar** — suma sugerida = Σ `(maxStock - quantity)` de los items que requieren compra.
- **En Tránsito** — count y unidades de `PurchaseOrder` con `status: 'pending'`.

### Página Alertas
- Conteos por prioridad: `high`, `medium`, `low`.
- Segmentos: `active`, `restock`, `excess`, `resolved`.

### Página ABC
- Distribución %SKUs vs %valor por clase.
- Tabla con `class`, `annualConsumptionValue`, `percentOfTotal`, `accumulatedPercent`.

### Página Predicciones
- Métricas por modelo: `mse`, `r2`, `mae`.
- Gráfico `PredictionVsActual` (predicho vs real por semana).
- `PredictionExplanation` con `feature importance` (qué pesa más: día de semana, mes, tendencia).

### Proyección de stock
- `StockProjection` por fecha futura: `projectedStock`, `safetyStock`, `isBelowThreshold`.
- Calendario visual de cuándo se proyecta quiebre.

---

## 6. Reportes esperados (módulo `more/reports`)

- **Rotación de inventario** = `costo_de_ventas / inventario_promedio`. Alta = sano. Baja = capital congelado.
- **Días de inventario** = `365 / rotación`. Cuántos días dura el stock actual al ritmo de ventas.
- **Fill rate** = `unidades vendidas / unidades demandadas`. Mide qué tan bien evitamos quiebres.
- **Costo de quiebre** = ventas perdidas estimadas durante `status: 'out'`.
- **Outliers de venta** (`OutlierResult`) — ventas atípicas detectadas vía IQR o Z-Score, para revisar antes de entrenar modelos.

---

## 7. Convenciones de UX inventario

- **Empty state educativo:** cada página muestra el flujo de 4 pasos y CTA al paso faltante si no hay datos. Nunca dejar la página vacía sin guía.
- **Colores de estado** (consistencia obligatoria):
  - Verde `#10B981`/`emerald`: available, success, healthy.
  - Ámbar `#D97706`: low, restock, warning.
  - Rojo `#DC2626`: critical, out, stockout_risk, error.
  - Violeta `#7C3AED`: excess, capital congelado.
  - Teal `#0D9488`: en tránsito, neutral-positivo.
- **Acciones destructivas** (eliminar producto, anular OC) requieren confirmación y solo `admin`.
- **Importación masiva**: catálogo e insumos soportan XLSX/CSV. El template tiene columnas: `sku, nombre, categoria, unidad, proveedor, descripcion, stockActual, stockMin, stockMax, reorderPoint, leadTime, costo, precioVenta`.
- **Idioma:** UI en español. Términos canónicos: "Insumo" (no "materia prima" en UI), "Receta" (no "BOM" en UI), "Bodega" (no "almacén"), "Punto de reorden" (no "ROP").

---

## 8. Reglas de seguridad / aislamiento

- **Todo dato vive bajo `tenants/{tenantId}/...`**. Cruzar tenants es bug crítico.
- Custom claim `tenantId` (Firebase Auth) determina acceso; fallback por `adminEmail`.
- Kardex y `supply_kardex` son **append-only por regla Firestore** — nunca editar ni borrar entradas. Si se necesita corregir, generar movimiento compensatorio.
- Modelos IA (`model_comparisons`, `demand_predictions`) son **read-only desde el cliente** — solo backend escribe.

---

## 9. Decisiones de producto ya tomadas (no re-litigar)

- **Una receta por producto.** No se soportan recetas alternativas ni versionado (por ahora).
- **Sin lotes/series ni fechas de vencimiento.** Si surge demanda real, añadir como entidad nueva, no extender `KardexEntry`.
- **Sin multi-moneda.** Todo en la moneda del tenant (definida implícitamente).
- **Predicciones a nivel producto terminado**, no insumo. Los insumos se reordenan vía explosión de receta + predicción del producto.
- **No es un POS.** ItemFlow registra ventas (`SaleRecord`) para el motor de predicción, pero no procesa cobros ni emite facturas.
- **Plan freemium por tenant** — `plans/{planId}` define cupos (productos máx, bodegas máx, etc.). No bloquear features silenciosamente: avisar al usuario cuando se acerque al límite.

---

## 10. Checklist al diseñar/implementar una feature de inventario

1. **¿A qué paso del flujo pertenece** (catálogo / insumos / recetas / ventas / stock / alertas / predicciones)? Si rompe el orden, ajustar.
2. **¿Genera o consume kardex?** Si modifica stock, debe registrar `KardexEntry` con `userId`, `reason`, `balance`.
3. **¿Recalcula `StockStatus`?** Cualquier cambio de cantidad debe revaluar el estado.
4. **¿Dispara alerta?** Verificar tipos `restock`/`excess`/`stockout_risk` y auto-resolución cuando aplique.
5. **¿Respeta roles?** Operaciones de catálogo/recetas → solo `admin`. Movimientos y alertas → ambos roles.
6. **¿Es por bodega o por tenant?** Stock y alertas: bodega. ABC y predicciones: tenant.
7. **¿Tiene empty state con CTA al paso anterior?** Obligatorio si depende de datos del flujo.
8. **¿Usa el vocabulario en español canónico?** "Insumo", "Receta", "Bodega", "Punto de reorden".

---

## 11. Glosario rápido (español ↔ técnico)

| UI (español) | Modelo / código |
|--------------|-----------------|
| Catálogo | `Product` / `products` |
| Insumo / Materia prima | `Supply` / `supplies` |
| Bodega / Almacén | `Warehouse` / `warehouses` |
| Stock / Existencias | `StockItem` / `stock_items` |
| Movimiento / Kardex | `KardexEntry` / `kardex_entries` |
| Receta | `Recipe` / `recipes` |
| Lista de materiales (BOM) | `RecipeItem` (interno) |
| Punto de reorden | `reorderPoint` |
| Tiempo de entrega | `leadTime` |
| Stock mínimo / máximo | `minStock` / `maxStock` |
| Stock de seguridad | `safetyStock` |
| Orden de compra | `PurchaseOrder` / `purchase_orders` |
| Venta | `SaleRecord` / `sale_records` |
| Quiebre de stock | `status: 'out'` / `AlertType: 'stockout_risk'` |
| Reabastecimiento | `AlertType: 'restock'` |
| Exceso / Sobre-stock | `AlertType: 'excess'` |
| Clasificación ABC | `ABCItem` / `abc_classifications` |
| Predicción de demanda | `DemandPrediction` / `demand_predictions` |
