import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../models';

/**
 * Todos los guards esperan a `whenReady()`: con Firebase Auth el estado inicial
 * llega de forma asíncrona (onAuthStateChanged). Sin esta espera, al recargar la
 * página el guard correría con la sesión aún sin resolver y mandaría al login.
 */

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.whenReady();
  if (auth.isAuthenticated()) return true;
  return router.createUrlTree(['/auth/login']);
};

export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.whenReady();
  if (!auth.isAuthenticated()) return true;
  // Si ya está logueado, redirigir a la ruta por defecto de su rol
  return router.parseUrl(auth.defaultRoute());
};

export const adminGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.whenReady();
  if (auth.isAdmin()) return true;
  return router.parseUrl(auth.defaultRoute());
};

/**
 * Factory para crear guards que requieren uno de los roles especificados.
 * Si el usuario no tiene rol permitido, lo redirige a su ruta por defecto.
 *
 * Uso en rutas:
 *   canActivate: [authGuard, requireRoles('admin', 'ventas')]
 */
export const requireRoles = (...roles: UserRole[]): CanActivateFn => async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.whenReady();
  if (auth.hasAnyRole(roles)) return true;
  return router.parseUrl(auth.defaultRoute());
};

/** Redirige a la home según rol (usar en la ruta raíz). */
export const roleHomeRedirect: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.whenReady();
  return router.parseUrl(auth.defaultRoute());
};
