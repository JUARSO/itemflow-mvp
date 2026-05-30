import { Routes } from '@angular/router';
import {
  authGuard, guestGuard, requireRoles, roleHomeRedirect,
} from './core/guards/auth.guard';

// Combos de roles reutilizables (modelo de 3 roles).
/**
 * VENTAS (admin + ventas): la parte de clientes — clientes, crear pedido,
 * cola de pedidos (recibidos/aceptados/completados) y planificación.
 */
const ventasAccess = requireRoles('admin', 'ventas');
/**
 * PRODUCCIÓN (admin + produccion): de catálogo hacia abajo — catálogo,
 * recetas, inventario, insumos, mermas, ajustes, proveedores, pre-compras,
 * órdenes de compra, análisis y alertas.
 */
const produccionAccess = requireRoles('admin', 'produccion');

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

      // ===== VENTAS: clientes, solicitudes y urnas (admin + ventas) =====
      {
        path: 'clientes',
        canActivate: [ventasAccess],
        loadComponent: () => import('./features/clientes/clientes.page').then(m => m.ClientesPage),
      },
      {
        path: 'crear-pedido',
        canActivate: [ventasAccess],
        loadComponent: () => import('./features/crear-pedido/crear-pedido.page').then(m => m.CrearPedidoPage),
      },
      {
        path: 'pedir-produccion',
        canActivate: [ventasAccess],
        loadComponent: () => import('./features/pedir-produccion/pedir-produccion.page').then(m => m.PedirProduccionPage),
      },
      {
        path: 'punto-venta',
        canActivate: [ventasAccess],
        loadComponent: () => import('./features/punto-venta/punto-venta.page').then(m => m.PuntoVentaPage),
      },
      {
        path: 'catalogo-ventas',
        canActivate: [ventasAccess],
        loadComponent: () => import('./features/catalogo-ventas/catalogo-ventas.page').then(m => m.CatalogoVentasPage),
      },
      {
        path: 'reporte-ventas',
        canActivate: [ventasAccess],
        loadComponent: () => import('./features/reporte-ventas/reporte-ventas.page').then(m => m.ReporteVentasPage),
      },
      {
        path: 'inventario-ventas',
        canActivate: [ventasAccess],
        loadComponent: () => import('./features/inventario-ventas/inventario-ventas.page').then(m => m.InventarioVentasPage),
      },
      {
        path: 'merma-urnas',
        canActivate: [ventasAccess],
        loadComponent: () => import('./features/merma-urnas/merma-urnas.page').then(m => m.MermaUrnasPage),
      },

      // ===== VENTAS EXTERNAS: pedidos de clientes (admin + ventas) =====
      {
        path: 'produccion',
        canActivate: [ventasAccess],
        loadComponent: () => import('./features/produccion/produccion.page').then(m => m.ProduccionPage),
      },
      {
        path: 'despachar-pedidos',
        canActivate: [ventasAccess],
        loadComponent: () => import('./features/despachar-pedidos/despachar-pedidos.page').then(m => m.DespacharPedidosPage),
      },
      {
        path: 'facturar-pedidos',
        canActivate: [ventasAccess],
        loadComponent: () => import('./features/facturar-pedidos/facturar-pedidos.page').then(m => m.FacturarPedidosPage),
      },

      // ===== PRODUCCIÓN: solicitudes de almacén + catálogo hacia abajo + planificación =====
      {
        path: 'pedidos-almacen',
        canActivate: [produccionAccess],
        loadComponent: () => import('./features/pedidos-almacen/pedidos-almacen.page').then(m => m.PedidosAlmacenPage),
      },
      {
        path: 'catalogo',
        canActivate: [produccionAccess],
        loadComponent: () => import('./features/catalogo/catalogo.page').then(m => m.CatalogoPage),
      },
      {
        path: 'recetas',
        canActivate: [produccionAccess],
        loadComponent: () => import('./features/recetas/recetas.page').then(m => m.RecetasPage),
      },
      {
        path: 'inventario',
        canActivate: [produccionAccess],
        loadComponent: () => import('./features/inventario/inventario.page').then(m => m.InventarioPage),
      },
      {
        path: 'insumos',
        canActivate: [produccionAccess],
        loadComponent: () => import('./features/insumos/insumos.page').then(m => m.InsumosPage),
      },
      {
        path: 'ajustes',
        canActivate: [produccionAccess],
        loadComponent: () => import('./features/ajustes/ajustes.page').then(m => m.AjustesPage),
      },
      {
        path: 'mermas',
        canActivate: [produccionAccess],
        loadComponent: () => import('./features/mermas/mermas.page').then(m => m.MermasPage),
      },
      {
        path: 'ordenes-compra',
        canActivate: [produccionAccess],
        loadComponent: () => import('./features/ordenes-compra/ordenes-compra.page').then(m => m.OrdenesCompraPage),
      },
      {
        path: 'pre-compras',
        canActivate: [produccionAccess],
        loadComponent: () => import('./features/pre-compras/pre-compras.page').then(m => m.PreComprasPage),
      },
      {
        path: 'proveedores',
        canActivate: [produccionAccess],
        loadComponent: () => import('./features/proveedores/proveedores.page').then(m => m.ProveedoresPage),
      },
      {
        path: 'alertas',
        canActivate: [produccionAccess],
        loadComponent: () => import('./features/alertas/alertas.page').then(m => m.AlertasPage),
      },
      {
        path: 'planificacion',
        canActivate: [produccionAccess],
        loadComponent: () => import('./features/planificacion/planificacion.page').then(m => m.PlanificacionPage),
      },
      {
        path: 'predicciones',
        canActivate: [produccionAccess],
        loadComponent: () => import('./features/predicciones/predicciones.page').then(m => m.PrediccionesPage),
      },
      {
        path: 'burn-down',
        canActivate: [produccionAccess],
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
