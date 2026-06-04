# Atlas — Gestión de inventario y producción
### Presentación del flujo completo de la aplicación

---

## 1. ¿Qué es Atlas?

Un **SaaS multi-tenant** para PYMES de producción (ej. panaderías): conecta de punta a
punta la **gestión de inventarios** con la **venta de productos**.

> Una sola cadena: **Insumos → Recetas → Producción → Inventario → Venta**,
> con costos, precios, IVA y reportes coherentes en todo el recorrido.

- **Multi-tenant:** cada empresa se registra sola, tiene su propia marca, usuarios y
  **datos aislados**. Un mismo Atlas opera muchas organizaciones a la vez.
- **3 roles:** Admin (todo) · Producción (catálogo → inventario) · Ventas (clientes y POS).

---

## 2. Acceso y organización (SaaS)

```
Registro de empresa  →  crea Tenant + Admin (automático)  →  14 días de prueba
        │
        ├─ Login (resuelve el tenant del usuario)
        └─ Cada tenant: su marca, sus usuarios, su inventario (aislado)
```

- **Auto-registro:** `/auth/register` crea la organización y su administrador sin
  intervención manual. Planes: Free / Pro / Business.
- **Roles por tenant** controlan qué ve y qué puede editar cada usuario.
- **Configuración** (pantalla "Más"): marca, miembros del equipo y **datos de
  facturación electrónica** del emisor (Hacienda CR).

---

## 3. El flujo completo (vista de pájaro)

```
                          ┌─────────────── GESTIÓN DE INVENTARIOS ───────────────┐
  Proveedores → Órdenes de compra / Pre-compras → INSUMOS (stock)
                                                      │
                                       Recetas (BOM): qué insumos consume cada producto
                                                      │
   Ventas configura ► PEDIR A PRODUCCIÓN (plan semanal recurrente, Lun–Dom)
                                                      │
                          PLANIFICACIÓN  ◄── combina plan semanal + pedidos de clientes
                          (se actualiza sola; muestra cobertura de insumos)
                                                      │
   Producción ► "Plan de hoy" → MARCAR PRODUCIDO ─────┘
                          │  (consume insumos  ▼  + sube producto)
                          ▼
                 INVENTARIO ÚNICO de producto terminado
                          │
        ┌─────────────────┴───────────────────┐
        ▼                                       ▼
   PUNTO DE VENTA (POS)                   PEDIDOS DE CLIENTES (portal)
   venta de mostrador                     crear → corroborar → producir
   tiquete / factura, IVA                 → despachar → facturar
        │                                       │
        └──────────────► REPORTES / KARDEX / ALERTAS ◄──────────────┘
```

---

## 4. Catálogo, costos y precios

**Producción maneja el COSTO; Ventas (admin) maneja el PRECIO.**

| Concepto | Dónde | Cómo se calcula |
|---|---|---|
| Costo de materiales | Catálogo de producción | Precio de compra (reventa) o **receta** (BOM) |
| Otros costos | Campo "Otros" del producto | **Mano de obra**, empaque, energía… se suma al costo |
| **Costo total** | Automático | Materiales + Otros (incluye subproductos anidados) |
| **Precio de venta** | Catálogo de ventas (solo Admin) | Precio final al consumidor |
| **IVA** | Código **CABYS** del producto | Cada CABYS define su tasa → precio con IVA |
| Precio por cliente | Ficha del cliente | Override opcional por cliente |

- En **Recetas** se ve cuánto **aporta cada insumo** al costo (₡ y %).
- En **Catálogo de ventas**: costo real vs precio sin IVA vs **precio final con IVA**,
  y un asterisco marca los productos **sin CABYS** asignado.

---

## 5. Insumos y compras (¿alcanza? ¿cuándo comprar?)

```
Proveedores → Órdenes de compra → recibir → sube stock de INSUMOS
                                              │
        COBERTURA DE INSUMOS (en Planificación):
        demanda (pedidos + plan semanal 7 días) → explota recetas → vs stock
                                              │
                 ¿Faltante? → botón "Comprar" → Pre-compras
```

- La **Cobertura de insumos** te dice si tienes lo suficiente para completar la demanda
  y **cuánto falta** comprar de cada insumo — base para comprar en el momento óptimo.
- **Pre-compras** sugiere reposición (por punto de reorden + lo que agregues a mano).

---

## 6. Pedir a producción — plan semanal recurrente

- Es una **lista por día de la semana** (Lun, Mar, Mié … Dom) que se **configura una
  vez** y **se repite todas las semanas**. Editarla cambia ese día para siempre.
- Se muestra como **ventana rodante de 7 días desde hoy** (hoy → +6).
- Producción ve la lista de cada día **automáticamente**.

```
Lunes:    Pan ×40 · Croissant ×20      (se aplica todos los lunes)
Martes:   Pan ×30 · Queque ×10         (se aplica todos los martes)
...
```

---

## 7. Producción → Inventario único

1. Producción abre **"Pedidos a producir"** y ve el **Plan de hoy**.
2. Pulsa **"Marcar producido y entregar al almacén"**.
3. El sistema **explota la receta**: descuenta los **insumos** y **suma el producto
   terminado** al inventario. (Idempotente: no se produce dos veces el mismo día.)

> **Inventario único:** ya no hay "urna" separada. El POS y los pedidos de clientes
> venden del **mismo** stock de producto. Sin doble conteo.

---

## 8. Punto de venta (POS)

```
Catálogo (stock disponible) → toca productos → Ticket
   │                                            │
   ├─ Comprobante: TIQUETE  o  FACTURA ELECTRÓNICA (elige cliente con datos fiscales)
   ├─ Método de pago: Efectivo · Tarjeta · SINPE · Transferencia
   └─ COBRAR → descuenta inventario (FIFO) · precio CON IVA · registra la venta
```

- **Precio real con IVA** del CABYS (no solo informativo).
- **Control de venta del día:** cada producto muestra "Vendido N hoy" / "Sin vender",
  con filtros — sabes qué se mueve y qué no.
- **Clientes de factura del POS:** registro propio y ligero (solo datos fiscales),
  se pueden crear desde el mismo POS con "+ Nuevo".

---

## 9. Ventas externas — pedidos de clientes (portal)

```
Cliente (portal con link + PIN)  →  crea pedido
        │
   VENTAS corrobora  →  entra a la cola de PRODUCCIÓN
        │
   Producción fabrica  →  DESPACHAR (descuenta stock)  →  FACTURAR
                                                            │
                                  Si algo sale mal en la entrega → merma de entrega
```

- Cada cliente tiene: productos permitidos, precios, días de pedido/entrega, pedidos
  recurrentes, y sus **datos fiscales** para factura electrónica.
- Pantallas dedicadas: **Despachar pedidos** y **Facturar pedidos** (historial).

---

## 10. Trazabilidad y reportes

- **Kardex:** cada movimiento (compra, producción, venta, ajuste, merma) deja registro.
- **Ventas del día:** totales por rango de fechas, tickets, unidades.
- **Alertas:** stock bajo, quiebres proyectados, pedidos en camino.
- **Predicciones / Burn-down / ABC:** análisis de demanda y consumo.
- **Mermas:** producción y devoluciones de clientes.

---

## 11. Estado actual y siguientes pasos

**Listo y conectado de punta a punta (en local):**
- Multi-tenant + auto-registro + roles + suscripción (scaffolding).
- Costo (materiales + mano de obra) → precio → IVA real en POS.
- Insumos → recetas → producción (consume insumos) → inventario único → venta.
- Plan semanal recurrente → planificación automática → cobertura de insumos.

**Pendiente (requiere backend real — Firebase):**
- **Aislamiento y seguridad reales** (hoy el aislamiento es lógico en el cliente;
  la seguridad de verdad se enforca en el servidor: `firestore.rules` ya está listo).
- **Facturación electrónica real** ante Hacienda (firma + envío).
- **Billing real** de suscripciones (Stripe + webhooks).
- IVA también en pedidos/facturas de clientes (hoy aplicado en POS).

> Detalle técnico del plan multi-tenant en `MULTITENANT.md`.
