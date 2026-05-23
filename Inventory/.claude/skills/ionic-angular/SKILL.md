---
name: ionic-angular
description: Desarrollo frontend de ItemFlow con Ionic 8 + Angular 20 + Capacitor — standalone components, signals, inject, control flow blocks (@if/@for), OnPush, lazy routing por módulo de ItemFlow (catálogo, insumos, recetas, ventas, inventario, kardex, alertas, ABC, predicciones, bodegas, OC), Reactive Forms tipados, RxJS↔signals interop con Firestore, guards por rol admin/operator, TenantContext, plugins Capacitor (camera, barcode-scanner, network, preferences). Activar al escribir o refactorizar cualquier `.ts/.html/.scss` en `src/app/`, definir rutas, crear servicios/componentes/pages/guards/forms, o trabajar con Capacitor.
---

# Ionic 8 + Angular 20 — Frontend de ItemFlow

Stack: **Angular 20 + Ionic 8 + Capacitor**, TypeScript 5.9, RxJS 7.8. UI en **español**. Multi-tenant: el cliente siempre opera dentro del tenant del usuario logueado.

---

## 1. Convenciones del proyecto

- **Solo standalone components.** Cero `NgModule`. Cada componente declara sus `imports: []`.
- **Signals como state primario.** `signal()`, `computed()`, `effect()`. RxJS solo para streams (HTTP, Firestore observables, debounce, switchMap).
- **Control flow blocks** (`@if`, `@for`, `@switch`). Nunca `*ngIf` / `*ngFor`.
- **`inject()` function** en campos de clase, no constructor injection.
- **OnPush por defecto.** Todos los componentes con `changeDetection: ChangeDetectionStrategy.OnPush`.
- **TypeScript estricto.** Sin `any`. `unknown` + narrowing cuando sea necesario.
- **UI en español.** Templates, validation messages, error strings, todo en español. Vocabulario canónico ItemFlow ("Insumo", "Receta", "Bodega", "Punto de reorden", "Kardex"). Sin inglés en strings visibles al usuario.

---

## 2. Estructura de archivos (alineada con el dominio ItemFlow)

```
src/app/
  core/                          # singletons globales
    services/
      auth.service.ts            # Firebase Auth + custom claims
      tenant-context.service.ts  # tenantId activo (signal)
      breakpoint.service.ts      # isMobile() / isDesktop() signals
      network.service.ts         # online/offline via Capacitor
    guards/
      auth.guard.ts
      admin.guard.ts             # solo admin
      tenant-loaded.guard.ts     # espera a que tenantId esté disponible
    models/                      # interfaces compartidas
      product.model.ts
      supply.model.ts
      recipe.model.ts
      warehouse.model.ts
      stock-item.model.ts
      kardex-entry.model.ts
      sale-record.model.ts
      alert.model.ts
      abc-item.model.ts
      demand-prediction.model.ts
      purchase-order.model.ts
      member.model.ts
    interceptors/                # si aplica HTTP
  shared/                        # presentational reutilizable
    components/
      status-badge/              # StockStatus → píldora con color
      alert-card/                # AlertCard según tipo
      kardex-row/                # fila monospace del kardex
      abc-class-badge/           # A/B/C cuadrado
      wizard-step/               # paso del flujo de 4 pasos
      empty-state-cta/           # empty state con CTA al paso faltante
      kpi-card/                  # cards del dashboard de inventario
    pipes/
      currency-tenant.pipe.ts    # formatea según moneda del tenant
      unit.pipe.ts               # "5.0 kg" formateado
    directives/
  features/
    catalogo/                    # paso 1
      pages/
        producto-list.page.ts
        producto-detail.page.ts
        producto-form.page.ts
      services/
        producto.service.ts
    insumos/                     # paso 2
      pages/
        insumo-list.page.ts
        insumo-detail.page.ts
        insumo-form.page.ts
      services/
        insumo.service.ts
    recetas/                     # paso 3
      pages/
        receta-list.page.ts
        receta-edit.page.ts
      services/
        receta.service.ts
    ventas/                      # paso 4
      pages/
        venta-list.page.ts
        venta-registrar.page.ts
      services/
        venta.service.ts
    inventario/                  # vista downstream
      pages/
        inventario-dashboard.page.ts
        stock-detail.page.ts
      components/
        kpi-cards/
        stock-list/
      services/
        stock.service.ts
    kardex/
      pages/
        kardex-list.page.ts
      services/
        kardex.service.ts
    alertas/
      pages/
        alertas.page.ts
      services/
        alertas.service.ts
    abc/
      pages/
        abc.page.ts
      services/
        abc.service.ts
    predicciones/
      pages/
        predicciones.page.ts
      components/
        prediction-vs-actual-chart/
        prediction-explanation/
      services/
        predicciones.service.ts
    bodegas/
      pages/
        bodega-list.page.ts
        bodega-form.page.ts
        transferir.page.ts
      services/
        bodega.service.ts
    ordenes-compra/
      pages/
        oc-list.page.ts
        oc-detail.page.ts
        oc-form.page.ts
      services/
        oc.service.ts
    onboarding/
      pages/
        wizard.page.ts            # flujo de 4 pasos para tenant nuevo
    auth/
      pages/
        login.page.ts
        register.page.ts
    mas/                         # tab "Más" móvil → reportes, settings, miembros
      pages/
        more.page.ts
        reportes.page.ts
        settings.page.ts
        miembros.page.ts
  app.component.ts
  app.config.ts
  app.routes.ts
```

**Reglas:**
- Una feature por subcarpeta. Servicios y componentes específicos viven dentro de su feature.
- `core/` solo singletons globales. `shared/` solo componentes presentacionales reutilizables.
- Nombres de archivo en español (`producto-list.page.ts`, no `product-list.page.ts`) — refuerza el vocabulario ItemFlow.

---

## 3. Bootstrap (`app.config.ts`)

```ts
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideFirestore, getFirestore, enableMultiTabIndexedDbPersistence } from '@angular/fire/firestore';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { provideStorage, getStorage } from '@angular/fire/storage';
import { provideFunctions, getFunctions } from '@angular/fire/functions';
import { routes } from './app.routes';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding()),
    provideIonicAngular({ mode: 'md' }), // 'md' para que web/Android/iOS se vean igual con el neobrutalism custom
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideFirestore(() => {
      const fs = getFirestore();
      enableMultiTabIndexedDbPersistence(fs).catch(() => {});
      return fs;
    }),
    provideAuth(() => getAuth()),
    provideStorage(() => getStorage()),
    provideFunctions(() => getFunctions(undefined, 'us-central1')),
  ],
};
```

**Modo Ionic:** forzamos `'md'` para que el neobrutalism no compita con estilos iOS nativos.

---

## 4. TenantContext — patrón obligatorio

El `tenantId` es la pieza de contexto que todos los servicios necesitan. Encapsular en un solo lugar.

```ts
@Injectable({ providedIn: 'root' })
export class TenantContextService {
  private readonly auth = inject(AuthService);
  private readonly _tenantId = signal<string | null>(null);
  private readonly _role = signal<'admin' | 'operator' | null>(null);

  readonly tenantId = this._tenantId.asReadonly();
  readonly role = this._role.asReadonly();
  readonly isAdmin = computed(() => this._role() === 'admin');
  readonly isOperator = computed(() => this._role() === 'operator');
  readonly isReady = computed(() => this._tenantId() !== null);

  async refreshFromToken(): Promise<void> {
    const user = this.auth.currentUser();
    if (!user) {
      this._tenantId.set(null);
      this._role.set(null);
      return;
    }
    const token = await user.getIdTokenResult();
    this._tenantId.set((token.claims['tenantId'] as string) ?? null);
    this._role.set((token.claims['role'] as 'admin' | 'operator') ?? null);
  }
}
```

**Regla:** ningún servicio Firestore construye paths sin pasar por `TenantContext`. Si `tenantId()` es null, el servicio devuelve `EMPTY` / signal vacía hasta que se resuelva.

---

## 5. Plantilla de componente (ej. lista de insumos)

```ts
import { Component, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel,
  IonSearchbar, IonSegment, IonSegmentButton, IonIcon, IonFab, IonFabButton,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { add, alertCircle } from 'ionicons/icons';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { EmptyStateCtaComponent } from '../../../shared/components/empty-state-cta/empty-state-cta.component';
import { InsumoService } from '../services/insumo.service';
import { TenantContextService } from '../../../core/services/tenant-context.service';

@Component({
  selector: 'app-insumo-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './insumo-list.page.html',
  styleUrls: ['./insumo-list.page.scss'],
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel,
    IonSearchbar, IonSegment, IonSegmentButton, IonIcon, IonFab, IonFabButton,
    StatusBadgeComponent, EmptyStateCtaComponent,
  ],
})
export class InsumoListPage {
  private readonly insumos = inject(InsumoService);
  protected readonly tenant = inject(TenantContextService);

  readonly query = signal('');
  readonly filtroStatus = signal<'todos' | 'low' | 'critical' | 'out'>('todos');

  readonly items = this.insumos.list; // signal
  readonly visibles = computed(() => {
    const q = this.query().toLowerCase();
    const status = this.filtroStatus();
    return this.items().filter(i =>
      (status === 'todos' || i.status === status) &&
      (i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q))
    );
  });

  readonly hayInsumos = computed(() => this.items().length > 0);

  constructor() {
    addIcons({ add, alertCircle });
  }

  irACrear() { /* router.navigate(['/insumos/nuevo']) */ }
}
```

**Reglas de plantilla:**
- Imports explícitos de Ionic standalone (jamás `@ionic/angular`).
- Icons registrados en constructor con `addIcons({ name })`.
- Empty state cuando `!hayInsumos()`: usar `<app-empty-state-cta>` con CTA al paso faltante.

---

## 6. Routing

`app.routes.ts` con lazy `loadComponent` por página:

```ts
import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';
import { tenantLoadedGuard } from './core/guards/tenant-loaded.guard';

export const routes: Routes = [
  {
    path: '',
    canActivate: [authGuard, tenantLoadedGuard],
    children: [
      { path: '', redirectTo: 'inventario', pathMatch: 'full' },
      {
        path: 'onboarding',
        loadComponent: () => import('./features/onboarding/pages/wizard.page').then(m => m.WizardPage),
      },
      {
        path: 'catalogo',
        loadComponent: () => import('./features/catalogo/pages/producto-list.page').then(m => m.ProductoListPage),
      },
      {
        path: 'catalogo/nuevo',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/catalogo/pages/producto-form.page').then(m => m.ProductoFormPage),
      },
      {
        path: 'catalogo/:id',
        loadComponent: () => import('./features/catalogo/pages/producto-detail.page').then(m => m.ProductoDetailPage),
      },
      {
        path: 'insumos',
        loadComponent: () => import('./features/insumos/pages/insumo-list.page').then(m => m.InsumoListPage),
      },
      {
        path: 'recetas',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/recetas/pages/receta-list.page').then(m => m.RecetaListPage),
      },
      {
        path: 'ventas',
        loadComponent: () => import('./features/ventas/pages/venta-list.page').then(m => m.VentaListPage),
      },
      {
        path: 'inventario',
        loadComponent: () => import('./features/inventario/pages/inventario-dashboard.page').then(m => m.InventarioDashboardPage),
      },
      {
        path: 'kardex',
        loadComponent: () => import('./features/kardex/pages/kardex-list.page').then(m => m.KardexListPage),
      },
      {
        path: 'alertas',
        loadComponent: () => import('./features/alertas/pages/alertas.page').then(m => m.AlertasPage),
      },
      {
        path: 'abc',
        loadComponent: () => import('./features/abc/pages/abc.page').then(m => m.AbcPage),
      },
      {
        path: 'predicciones',
        loadComponent: () => import('./features/predicciones/pages/predicciones.page').then(m => m.PrediccionesPage),
      },
      {
        path: 'bodegas',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/bodegas/pages/bodega-list.page').then(m => m.BodegaListPage),
      },
      {
        path: 'ordenes-compra',
        loadComponent: () => import('./features/ordenes-compra/pages/oc-list.page').then(m => m.OcListPage),
      },
      {
        path: 'mas',
        loadComponent: () => import('./features/mas/pages/more.page').then(m => m.MorePage),
      },
    ],
  },
  {
    path: 'auth',
    children: [
      { path: 'login', loadComponent: () => import('./features/auth/pages/login.page').then(m => m.LoginPage) },
      { path: 'register', loadComponent: () => import('./features/auth/pages/register.page').then(m => m.RegisterPage) },
    ],
  },
];
```

**Guards:**
- `authGuard` — usuario logueado
- `tenantLoadedGuard` — `TenantContext.isReady()` true (espera al claim)
- `adminGuard` — `TenantContext.isAdmin()` true; si no, redirige

---

## 7. Formularios — Reactive Forms tipados

Para registrar entrada de stock:

```ts
import { FormBuilder, Validators } from '@angular/forms';

@Component({...})
export class RegistrarEntradaPage {
  private readonly fb = inject(FormBuilder);
  private readonly insumoSvc = inject(InsumoService);
  private readonly stockSvc = inject(StockService);

  readonly form = this.fb.group({
    supplyId: this.fb.control('', { nonNullable: true, validators: [Validators.required] }),
    warehouseId: this.fb.control('', { nonNullable: true, validators: [Validators.required] }),
    qty: this.fb.control(0, { nonNullable: true, validators: [Validators.required, Validators.min(0.01)] }),
    unitCost: this.fb.control(0, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
    reason: this.fb.control<'purchase' | 'return_from_customer' | 'manual'>('purchase', { nonNullable: true }),
    note: this.fb.control(''),
  });

  async onSubmit() {
    if (this.form.invalid) return;
    try {
      await this.stockSvc.receiveSupply(this.form.getRawValue());
      // toast "Entrada registrada"
    } catch (e: unknown) {
      // toast con e.message en español
    }
  }
}
```

**Mensajes de validación:** en español, accionables.
- ✅ "La cantidad debe ser mayor a 0."
- ❌ "Required field" / "Invalid input"

---

## 8. Servicio con signals (ej. AlertasService)

```ts
import { Injectable, inject, computed } from '@angular/core';
import { Firestore, collection, query, where, orderBy, limit, collectionData, doc, updateDoc, serverTimestamp } from '@angular/fire/firestore';
import { toSignal } from '@angular/core/rxjs-interop';
import { TenantContextService } from '../../../core/services/tenant-context.service';
import { AuthService } from '../../../core/services/auth.service';
import { Alert } from '../../../core/models/alert.model';

@Injectable({ providedIn: 'root' })
export class AlertasService {
  private readonly firestore = inject(Firestore);
  private readonly tenant = inject(TenantContextService);
  private readonly auth = inject(AuthService);

  readonly all = toSignal(this.observeAll(), { initialValue: [] as Alert[] });
  readonly activas = computed(() => this.all().filter(a => a.status === 'active'));
  readonly altaPrioridad = computed(() => this.activas().filter(a => a.priority === 'high'));
  readonly resueltas = computed(() => this.all().filter(a => a.status === 'resolved'));

  private observeAll() {
    const tenantId = this.tenant.tenantId();
    if (!tenantId) return of([] as Alert[]);
    const ref = collection(this.firestore, `tenants/${tenantId}/alerts`);
    const q = query(ref, orderBy('createdAt', 'desc'), limit(500));
    return collectionData(q, { idField: 'id' }) as Observable<Alert[]>;
  }

  async marcarRevisada(alertId: string) {
    const tenantId = this.tenant.tenantId();
    if (!tenantId) throw new Error('Sin tenant');
    await updateDoc(doc(this.firestore, `tenants/${tenantId}/alerts/${alertId}`), {
      status: 'acknowledged',
      acknowledgedAt: serverTimestamp(),
      acknowledgedBy: this.auth.currentUser()?.uid,
    });
  }

  async resolver(alertId: string) {
    const tenantId = this.tenant.tenantId();
    if (!tenantId) throw new Error('Sin tenant');
    await updateDoc(doc(this.firestore, `tenants/${tenantId}/alerts/${alertId}`), {
      status: 'resolved',
      resolvedAt: serverTimestamp(),
      resolvedBy: this.auth.currentUser()?.uid,
    });
  }
}
```

**Patrón:** servicios exponen **signals readonly + computed derivados**; mutación solo vía métodos async que delegan en Firestore.

---

## 9. RxJS ↔ Signals interop

- Firestore observables → `toSignal()`:
  ```ts
  readonly insumos = toSignal(collectionData(q, { idField: 'id' }), { initialValue: [] as Supply[] });
  ```
- Input del usuario (búsqueda con debounce) → signal + `toObservable()`:
  ```ts
  readonly query = signal('');
  private readonly results$ = toObservable(this.query).pipe(
    debounceTime(250),
    distinctUntilChanged(),
    switchMap(q => this.searchSvc.search(q)),
  );
  readonly results = toSignal(this.results$, { initialValue: [] });
  ```

---

## 10. Capacitor plugins relevantes

- `@capacitor/camera` — fotos de productos/insumos. Comprimir antes de subir.
- `@capacitor-mlkit/barcode-scanning` — escanear SKU para entradas/salidas rápidas.
- `@capacitor/network` — detectar offline para mostrar banner.
- `@capacitor/preferences` — KV pequeño (preferencia de bodega activa, último filtro). NO para datos de inventario.
- `@capacitor/share` — compartir CSV exportados.

Patrón obligatorio: envolver cada plugin en un service y proveer fallback web con `Capacitor.isNativePlatform()`:

```ts
@Injectable({ providedIn: 'root' })
export class ScannerService {
  async scan(): Promise<string | null> {
    if (!Capacitor.isNativePlatform()) {
      // fallback web: abrir modal con input manual
      return prompt('Ingresa el SKU manualmente') ?? null;
    }
    const { barcodes } = await BarcodeScanner.scan();
    return barcodes[0]?.rawValue ?? null;
  }
}
```

---

## 11. Roles y permisos en UI

Verificar `tenant.isAdmin()` en templates para ocultar acciones que solo admin puede ejecutar:

```html
@if (tenant.isAdmin()) {
  <ion-button (click)="eliminarInsumo()" color="danger">
    Eliminar insumo
  </ion-button>
}
```

**Reglas:**
- Operator **nunca** ve `cost` ni `buyPrice` ni reportes de margen — esconder columnas/campos en templates Y en queries.
- Operator no ve botones de catálogo/recetas/bodegas write.
- La UI es la primera defensa, las reglas Firestore son la real (ver `firebase` skill §6).

---

## 12. Testing

- **Unit (Jasmine + Karma)** ya configurado. Testear:
  - Servicios con lógica (cálculo de `StockStatus`, factor de receta, computed signals).
  - Pipes (currency, unit).
  - NO testear bindings triviales de componentes.
- Para componentes: `TestBed` con `imports: [ComponentUnderTest]` (standalone).
- **E2E:** si se agrega, preferir **Playwright** (mejor soporte para Ionic web) sobre Cypress.

---

## 13. Performance

- `@for` con `track` siempre — usar ID estable (`track item.id`), nunca index.
- `<ion-img>` para lazy load de fotos de producto (IntersectionObserver built-in).
- Virtual scroll (CDK `cdk-virtual-scroll-viewport`) para listas > 100 items. Útil en kardex y catálogos grandes.
- `OnPush` + signals → re-render solo cuando cambia lo necesario.
- Lazy load por route (ya en §6).

---

## 14. Anti-patrones (prohibidos en ItemFlow)

| Don't | Por qué |
|---|---|
| Usar `NgModule` | Stack es 100% standalone |
| Constructor injection | Usar `inject()` |
| `*ngIf` / `*ngFor` | Usar `@if` / `@for` |
| Subscribir manualmente en componentes | Usar `toSignal()` o `async` pipe |
| Importar de `@ionic/angular` (legacy) | Siempre `@ionic/angular/standalone` |
| Guardar inventario en `localStorage` o `Preferences` | Firestore con offline persistence ya lo cachea |
| Hardcodear `tenantId` en queries | Siempre vía `TenantContextService` |
| Construir paths Firestore sin scope `tenants/{tenantId}` | Rompe multi-tenancy |
| Mostrar `cost` / `buyPrice` a operator | Información restringida a admin |
| Mutar stock sin transacción Firestore | Race conditions; ver `firebase` skill |
| Strings inline en templates ("Add", "Save") | i18n obligatorio; vocabulario español canónico |
| Lógica de negocio en componentes | Va en servicios; componentes solo orquestan |
| Editar/eliminar entradas del kardex desde la UI | Append-only por regla de negocio |
| Bypassear guards con condicionales en componentes | Guards son la fuente de verdad de acceso |
