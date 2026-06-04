# Migración a SaaS Multi-Tenant

Documento de arquitectura y estado de la migración de la app (un solo cliente → SaaS
multi-tenant). Acompaña al código de la **Fase 1** y define el contrato de **Fase 2/3**.

## Principio rector

> El aislamiento de datos, la autenticación y el billing **se enforzan en el backend**.
> Todo lo que vive en el navegador (esta app) es orquestación y UX, **no seguridad**.

## Estado por objetivo

| Objetivo | Estado | Dónde |
|---|---|---|
| Entidad Tenant/Organization | ✅ Fase 1 | `models` (`Tenant`, `Subscription`), `TenantService` |
| Asociar usuarios a tenants | ✅ Fase 1 | `Member.tenantId`, directorio en `TenantService` |
| Aislar datos entre tenants | ✅ lógico (cliente) / 🔜 seguro (backend) | `DataService.loadTenant()` + `firestore.rules` |
| Auth identifica el tenant | ✅ Fase 1 | `AuthService.tenantId`, custom claims (Fase 2) |
| Roles/permisos por tenant | ✅ Fase 1 | `TenantContextService` + `canWrite()` en reglas |
| Auto-registro de empresas | ✅ Fase 1 | `/auth/register`, `AuthService.register()` |
| Creación automática de admin | ✅ Fase 1 | `TenantService.registerTenant()` |
| Planes de suscripción | ✅ scaffolding | `PLAN_CATALOG`, `Subscription`; billing real → Fase 3 |
| Quitar cliente hardcodeado | ✅ Fase 1 | `MOCK_COMPANY` pasó a ser el *tenant demo*, no el único |

## Modelo de datos (Firestore — Fase 2)

```
tenants/{tenantId}                      # doc: name, slug, subscription, ...
  members/{uid}                         # equipo del tenant
  products/{id}  supplies/{id}  recipes/{id}
  product_stock/{id}  supply_stock/{id}  kardex/{id}
  orders/{id}  customers/{id}  suppliers/{id}
  urnas/{id}  urna_lotes/{id}  pos_sales/{id}  pos_clientes/{id}
  purchase_orders/{id}  returned_lots/{id}  alerts/{id}  predictions/{id}
  recurring_orders/{id}  reservas/{id}  consumer_prices/{id}
users/{uid}                             # directorio global uid → { tenantId, role }
plans/{planId}                          # catálogo público de planes
```

Cada array in-memory de `DataService` mapea 1:1 a una subcolección bajo el tenant.

## Cómo se vuelve SEGURO (Fase 2)

1. **Firebase Auth** real (email/password, OAuth).
2. **Cloud Function `onSignup`**: crea `tenants/{id}`, el `users/{uid}` y fija los
   **custom claims** `{ tenantId, role }` en el token. El cliente nunca elige su tenant.
3. **`firestore.rules`** (incluido): toda lectura/escritura se valida contra
   `request.auth.token.tenantId` y `role`. Un usuario no puede leer otro tenant.
4. **AngularFire** reemplaza el `DataService` in-memory por consultas a
   `tenants/{tenantId}/...` (el `tenantId` sale del claim, no de la URL ni del cliente).

## Billing (Fase 3)

- Stripe Checkout para alta de plan; **webhook** → Cloud Function actualiza
  `tenants/{id}.subscription.status`.
- Gating por estado: `TenantContextService.isSubscriptionActive` ya existe en el
  cliente para mostrar/bloquear UI; el enforcement duro se hace en reglas/funciones.

## Notas de compatibilidad

- El **tenant demo** (`tenant-demo`, "Empresa Demo") conserva los datos mock; las empresas nuevas
  arrancan **vacías**. Sesiones previas sin `tenantId` caen al tenant demo.
- Pendientes menores: branding por-tenant (hoy global), y registrar en el directorio
  de `TenantService` a los miembros invitados desde "Miembros" para que puedan entrar.
