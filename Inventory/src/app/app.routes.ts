import { Routes } from '@angular/router';
import {
  authGuard, guestGuard, requireRoles, roleHomeRedirect, adminGuard,
} from './core/guards/auth.guard';

// Combos de roles reutilizables
const adminOnly = requireRoles('admin');
const adminOrSales = requireRoles('admin', 'sales');
const adminOrProduction = requireRoles('admin', 'production');
/** Cola de producción: production + operator + admin (lectura). */
const productionOrOperator = requireRoles('admin', 'production', 'operator');
/** Recetas: production edita, operator/admin solo lectura. */
const recipesAccess = requireRoles('admin', 'production', 'operator');

export const routes: Routes = [
  {
    path: 'auth/login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login.page').then(m => m.LoginPage),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./features/shell/shell.page').then(m => m.ShellPage),
    children: [
      // Raíz: redirigir según rol del usuario
      { path: '', pathMatch: 'full', canActivate: [roleHomeRedirect], children: [] },

      // ===== Ventas (admin + sales) =====
      {
        path: 'pedidos',
        canActivate: [adminOrSales],
        loadComponent: () => import('./features/pedidos/pedidos.page').then(m => m.PedidosPage),
      },
      {
        path: 'ventas',
        canActivate: [adminOrSales],
        loadComponent: () => import('./features/ventas/ventas.page').then(m => m.VentasPage),
      },
      {
        path: 'devoluciones',
        canActivate: [adminOrSales],
        loadComponent: () => import('./features/devoluciones/devoluciones.page').then(m => m.DevolucionesPage),
      },
      {
        // Catálogo es lectura para sales; admin sí puede editar (los botones de editar
        // ya están condicionados a tenant.isAdmin() dentro del componente)
        path: 'catalogo',
        canActivate: [adminOrSales],
        loadComponent: () => import('./features/catalogo/catalogo.page').then(m => m.CatalogoPage),
      },

      // ===== Producción (admin + production) =====
      {
        path: 'produccion',
        canActivate: [productionOrOperator],
        loadComponent: () => import('./features/produccion/produccion.page').then(m => m.ProduccionPage),
      },
      {
        path: 'inventario',
        canActivate: [adminOrProduction],
        loadComponent: () => import('./features/inventario/inventario.page').then(m => m.InventarioPage),
      },
      {
        path: 'insumos',
        canActivate: [adminOrProduction],
        loadComponent: () => import('./features/insumos/insumos.page').then(m => m.InsumosPage),
      },
      {
        path: 'recetas',
        canActivate: [recipesAccess],
        loadComponent: () => import('./features/recetas/recetas.page').then(m => m.RecetasPage),
      },
      {
        path: 'ajustes',
        canActivate: [adminOrProduction],
        loadComponent: () => import('./features/ajustes/ajustes.page').then(m => m.AjustesPage),
      },
      {
        path: 'ordenes-compra',
        canActivate: [adminOrProduction],
        loadComponent: () => import('./features/ordenes-compra/ordenes-compra.page').then(m => m.OrdenesCompraPage),
      },
      {
        path: 'alertas',
        canActivate: [adminOrProduction],
        loadComponent: () => import('./features/alertas/alertas.page').then(m => m.AlertasPage),
      },
      {
        path: 'boosts',
        canActivate: [adminOrProduction],
        loadComponent: () => import('./features/boosts/boosts.page').then(m => m.BoostsPage),
      },

      // ===== Solo admin =====
      {
        path: 'predicciones',
        canActivate: [adminOnly],
        loadComponent: () => import('./features/predicciones/predicciones.page').then(m => m.PrediccionesPage),
      },
      {
        path: 'burn-down',
        canActivate: [adminOnly],
        loadComponent: () => import('./features/burn-down/burn-down.page').then(m => m.BurnDownPage),
      },
      {
        path: 'admin',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/admin/admin-dashboard.page').then(m => m.AdminDashboardPage),
      },
      {
        path: 'admin/ventas',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/admin/admin-ventas.page').then(m => m.AdminVentasPage),
      },
      {
        path: 'admin/produccion',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/admin/admin-produccion.page').then(m => m.AdminProduccionPage),
      },
      {
        path: 'admin/financiero',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/admin/admin-financiero.page').then(m => m.AdminFinancieroPage),
      },
      {
        path: 'admin/devoluciones',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/admin/admin-devoluciones.page').then(m => m.AdminDevolucionesPage),
      },

      // ===== Todos =====
      {
        path: 'mas',
        loadComponent: () => import('./features/mas/mas.page').then(m => m.MasPage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
