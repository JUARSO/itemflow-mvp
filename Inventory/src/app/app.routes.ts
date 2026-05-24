import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';

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
      { path: '', redirectTo: 'inventario', pathMatch: 'full' },
      {
        path: 'inventario',
        loadComponent: () => import('./features/inventario/inventario.page').then(m => m.InventarioPage),
      },
      {
        path: 'alertas',
        loadComponent: () => import('./features/alertas/alertas.page').then(m => m.AlertasPage),
      },
      {
        path: 'kardex',
        loadComponent: () => import('./features/kardex/kardex.page').then(m => m.KardexPage),
      },
      {
        path: 'catalogo',
        loadComponent: () => import('./features/catalogo/catalogo.page').then(m => m.CatalogoPage),
      },
      {
        path: 'insumos',
        loadComponent: () => import('./features/insumos/insumos.page').then(m => m.InsumosPage),
      },
      {
        path: 'recetas',
        loadComponent: () => import('./features/recetas/recetas.page').then(m => m.RecetasPage),
      },
      {
        path: 'ventas',
        loadComponent: () => import('./features/ventas/ventas.page').then(m => m.VentasPage),
      },
      {
        path: 'ajustes',
        loadComponent: () => import('./features/ajustes/ajustes.page').then(m => m.AjustesPage),
      },
      {
        path: 'ordenes-compra',
        loadComponent: () => import('./features/ordenes-compra/ordenes-compra.page').then(m => m.OrdenesCompraPage),
      },
      {
        path: 'predicciones',
        loadComponent: () => import('./features/predicciones/predicciones.page').then(m => m.PrediccionesPage),
      },
      {
        path: 'burn-down',
        loadComponent: () => import('./features/burn-down/burn-down.page').then(m => m.BurnDownPage),
      },
      {
        path: 'mas',
        loadComponent: () => import('./features/mas/mas.page').then(m => m.MasPage),
      },
    ],
  },
  { path: '**', redirectTo: 'inventario' },
];
