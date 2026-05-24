import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../models';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated()) return true;
  return router.createUrlTree(['/auth/login']);
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) return true;
  // Si ya está logueado, redirigir a la ruta por defecto de su rol
  return router.parseUrl(auth.defaultRoute());
};

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAdmin()) return true;
  return router.parseUrl(auth.defaultRoute());
};

/**
 * Factory para crear guards que requieren uno de los roles especificados.
 * Si el usuario no tiene rol permitido, lo redirige a su ruta por defecto.
 *
 * Uso en rutas:
 *   canActivate: [authGuard, requireRoles('admin', 'sales')]
 */
export const requireRoles = (...roles: UserRole[]): CanActivateFn => () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.hasAnyRole(roles)) return true;
  return router.parseUrl(auth.defaultRoute());
};

/** Redirige a la home según rol (usar en la ruta raíz). */
export const roleHomeRedirect: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return router.parseUrl(auth.defaultRoute());
};
