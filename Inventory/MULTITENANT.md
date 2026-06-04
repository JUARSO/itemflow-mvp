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

---

## Runbook de implementación (Fase 0 → 3)

Plan acordado para conectar la app a Firebase real con **múltiples tenants**. Enfoque de
identidad: **custom claims vía Cloud Function** (lo que ya asumen las `firestore.rules`:
`request.auth.token.tenantId` / `role`). El cliente nunca elige su tenant.

> Estado de partida: **no hay Firebase instalado** (`package.json` sin deps,
> `src/environments/*.ts` vacíos). Identidad y datos viven en `localStorage`
> (`TenantService`, `AuthService`) y en signals en memoria (`DataService`).

Orden obligatorio: **0 → 1 → 2 → 3**. Auth va primero porque el `tenantId` del claim
es lo que las reglas y los listeners de datos necesitan para aislar.

### Fase 0 — Base (proyecto + SDK)
1. Crear proyecto en Firebase Console. Habilitar **Firestore** (modo producción) y
   **Authentication → Email/Password**. Subir a plan **Blaze** (requerido para Cloud Functions).
2. `cd Inventory && npm i firebase @angular/fire`.
3. Rellenar `src/environments/environment.ts` y `environment.prod.ts` con
   `firebase: { apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId }`.
4. En `app.config.ts` añadir providers: `provideFirebaseApp(() => initializeApp(environment.firebase))`,
   `provideFirestore(() => getFirestore())`, `provideAuth(() => getAuth())`.

### Fase 1 — Auth real (identidad + tenant)
5. **Cloud Function `onSignup`** (callable, en `functions/`): recibe `{ orgName, adminName, planId }`,
   y de forma atómica crea `tenants/{id}`, `tenants/{id}/members/{uid}`, `users/{uid} = { tenantId, role }`
   y fija **custom claims** `{ tenantId, role: 'admin' }` con el Admin SDK. Reemplaza
   `TenantService.registerTenant` (localStorage).
6. Reescribir `AuthService`:
   - `register()` → `createUserWithEmailAndPassword` + llamar al callable `onSignup` + `getIdToken(true)`
     (refresco forzado para traer los claims recién puestos).
   - `login()` → `signInWithEmailAndPassword` + `getIdTokenResult()` para leer `tenantId`/`role`.
   - `tenantId`/`role` salen del **claim**, no de localStorage ni de la URL.
7. `onAuthStateChanged` rehidrata la sesión al cargar (reemplaza `localStorage 'atlas_session_v1'`).
   Quitar el directorio de usuarios de `TenantService` (lo sustituye `users/{uid}` + claims).
8. Invitar miembros: Cloud Function `inviteMember` que crea el usuario, su `members/{uid}`,
   `users/{uid}` y sus claims con el `tenantId` del admin que invita.

### Fase 2 — Datos en Firestore (sin reescribir los ~100 componentes)
> Clave: **mantener intacta la API de signals de `DataService`**. Los componentes que hacen
> `data.products()` no cambian; solo cambia de dónde se llenan los signals.
9. Convertir `DataService` en *store respaldado por Firestore*:
   - `loadTenant(tenantId)` abre un `onSnapshot` por subcolección (`tenants/{tid}/products`, …)
     y vuelca cada snapshot al signal existente (`_products.set(...)`).
   - Cada método de escritura (`addProduct`, `adjustStock`, …) pasa a `addDoc/setDoc/updateDoc/deleteDoc`
     sobre la subcolección. **No** actualizar el signal a mano: lo hace el listener (single source of truth).
   - Guardar los `unsubscribe` y cerrarlos al cambiar de tenant / logout. Eliminar `_partitions` y los `MOCK_*` del constructor.
10. Migración sync→async: es el trabajo grueso y el único riesgo real. Ir colección por colección,
    verificando una pantalla por colección antes de pasar a la siguiente.
11. Seeding: el tenant demo deja de inyectar MOCK en cliente. Opcional: script `seed.ts` (Admin SDK)
    que escribe los datos demo una vez en `tenants/tenant-demo/...`. Empresas nuevas arrancan vacías (ya es el contrato).

### Fase 3 — Seguridad y despliegue
12. `firebase deploy --only firestore:rules` (las reglas ya están en `firestore.rules`).
13. **Probar el aislamiento**: loguear dos tenants distintos y confirmar que ninguno ve datos del otro
    (intentar leer `tenants/{otroId}/...` debe fallar por reglas).
14. `firestore.indexes.json` para las queries compuestas que aparezcan; desplegar con `--only firestore:indexes`.
15. Hosting opcional: `ng build && firebase deploy --only hosting`.

### Fase 4 — Billing (posterior)
16. Stripe Checkout para alta de plan + webhook (Cloud Function) → actualiza
    `tenants/{id}.subscription.status`. El gating de UI ya existe (`TenantContextService.isSubscriptionActive`);
    el enforcement duro va en reglas/funciones.

### Riesgos y notas
- **El paso 9–10 es el 80% del esfuerzo.** El resto es configuración.
- Las reglas dependen 100% de que los claims `tenantId`/`role` existan en el token → la
  Cloud Function `onSignup` es prerrequisito de todo lo seguro.
- Tras cambiar claims (invitar, cambiar rol), el cliente debe `getIdToken(true)` para refrescarlos.
- Cloud Functions requiere plan **Blaze** (de pago por uso; tiene capa gratuita generosa).
