import { Routes } from '@angular/router';
import {
  authGuard, guestGuard, requireRoles, roleHomeRedirect,
} from './core/guards/auth.guard';

// Combos de roles reutilizables
const adminOnly = requireRoles('admin');
const adminOrProduction = requireRoles('admin', 'production');
/** Cola/recetas accesibles por admin/production/operator */
const productionOrOperator = requireRoles('admin', 'production', 'operator');

export const routes: Routes = [
  // ===== Portal externo del cliente (sin shell, sin auth interna) =====
  {
    path: 'c/:token',
    loadComponent: () => import('./features/portal-cliente/portal-cliente.page').then(m => m.PortalClientePage),
  },

  // ===== Auth =====
  {
    path: 'auth/login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login.page').then(m => m.LoginPage),
  },

  // ===== App principal con shell =====
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./features/shell/shell.page').then(m => m.ShellPage),
    children: [
      { path: '', pathMatch: 'full', canActivate: [roleHomeRedirect], children: [] },

      // Clientes (portal management)
      {
        path: 'clientes',
        canActivate: [adminOrProduction],
        loadComponent: () => import('./features/clientes/clientes.page').then(m => m.ClientesPage),
      },

      // Cola de pedidos de clientes
      {
        path: 'produccion',
        canActivate: [productionOrOperator],
        loadComponent: () => import('./features/produccion/produccion.page').then(m => m.ProduccionPage),
      },
      {
        path: 'crear-pedido',
        canActivate: [adminOrProduction],
        loadComponent: () => import('./features/crear-pedido/crear-pedido.page').then(m => m.CrearPedidoPage),
      },
      {
        path: 'planificacion',
        canActivate: [productionOrOperator],
        loadComponent: () => import('./features/planificacion/planificacion.page').then(m => m.PlanificacionPage),
      },
      {
        path: 'historial-pedidos',
        canActivate: [adminOrProduction],
        loadComponent: () => import('./features/historial-pedidos/historial-pedidos.page').then(m => m.HistorialPedidosPage),
      },

      // Inventario y catálogo
      {
        path: 'catalogo',
        canActivate: [adminOrProduction],
        loadComponent: () => import('./features/catalogo/catalogo.page').then(m => m.CatalogoPage),
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
        canActivate: [productionOrOperator],
        loadComponent: () => import('./features/recetas/recetas.page').then(m => m.RecetasPage),
      },
      {
        path: 'ajustes',
        canActivate: [adminOrProduction],
        loadComponent: () => import('./features/ajustes/ajustes.page').then(m => m.AjustesPage),
      },
      {
        path: 'mermas',
        canActivate: [adminOrProduction],
        loadComponent: () => import('./features/mermas/mermas.page').then(m => m.MermasPage),
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

      // Solo admin — paneles administrativos
      {
        path: 'panel-pedidos',
        canActivate: [adminOnly],
        loadComponent: () => import('./features/panel-pedidos/panel-pedidos.page').then(m => m.PanelPedidosPage),
      },
      {
        path: 'panel-inventario',
        canActivate: [adminOnly],
        loadComponent: () => import('./features/panel-inventario/panel-inventario.page').then(m => m.PanelInventarioPage),
      },
      {
        path: 'panel-contable',
        canActivate: [adminOnly],
        loadComponent: () => import('./features/panel-contable/panel-contable.page').then(m => m.PanelContablePage),
      },
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

      // Todos
      {
        path: 'mas',
        loadComponent: () => import('./features/mas/mas.page').then(m => m.MasPage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
