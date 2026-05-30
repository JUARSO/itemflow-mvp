import { Injectable, signal, computed } from '@angular/core';
import { Member, UserRole } from '../models';
import { MOCK_MEMBERS } from '../mocks/dummy-data';

const STORAGE_KEY = 'itemflow_session_v1';

/** Landing route por defecto para cada rol. */
const DEFAULT_ROUTE: Record<UserRole, string> = {
  admin: '/inventario',
  // produccion NO tiene acceso a /produccion (ahora es de Ventas); su landing
  // debe ser una ruta de su dominio (catálogo hacia abajo) para no entrar en
  // un bucle de redirección.
  produccion: '/inventario',
  ventas: '/punto-venta',
};

/**
 * Migración de roles legacy (sesiones persistidas con el modelo de 4 roles) al
 * modelo actual de 3 roles:
 *  - inventory → produccion   (encargado de inventario = catálogo hacia abajo)
 *  - production / operator / sales → ventas  (manejo de pedidos de clientes)
 */
const LEGACY_ROLE_MAP: Record<string, UserRole> = {
  admin: 'admin',
  produccion: 'produccion',
  ventas: 'ventas',
  inventory: 'produccion',
  production: 'ventas',
  operator: 'ventas',
  sales: 'ventas',
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _user = signal<Member | null>(null);

  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);
  readonly role = computed<UserRole | null>(() => this._user()?.role ?? null);

  readonly isAdmin = computed(() => this.role() === 'admin');
  /** Producción: de catálogo hacia abajo (catálogo, inventario, compras, análisis, alertas). */
  readonly isProduccion = computed(() => this.role() === 'produccion');
  /** Ventas: la parte de clientes (clientes, pedidos, planificación). */
  readonly isVentas = computed(() => this.role() === 'ventas');

  constructor() {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Member;
        // Migración de roles legacy (modelo de 4 roles) al modelo de 3 roles.
        parsed.role = LEGACY_ROLE_MAP[parsed.role as string] ?? 'admin';
        this._user.set(parsed);
      } catch { /* ignore */ }
    }
  }

  /**
   * Login demo: cualquier email + cualquier contraseña (≥4 chars) entran.
   * Si el email existe en MOCK_MEMBERS se usa su rol asignado;
   * sino se crea un usuario temporal con rol admin (fallback).
   */
  async login(email: string, _password: string): Promise<Member> {
    await new Promise(r => setTimeout(r, 400));
    const existing = MOCK_MEMBERS.find(m => m.email.toLowerCase() === email.toLowerCase());
    const user: Member = existing ?? {
      uid: `u-${Date.now()}`,
      email,
      displayName: email.split('@')[0],
      role: 'admin',
      active: true,
    };
    this._user.set(user);
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    return user;
  }

  logout(): void {
    this._user.set(null);
    if (typeof window !== 'undefined') localStorage.removeItem(STORAGE_KEY);
  }

  /** Cambia el rol del usuario actual (solo para demo / testing). */
  switchRole(role: UserRole): void {
    const u = this._user();
    if (!u) return;
    const updated = { ...u, role };
    this._user.set(updated);
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }

  /** ¿El usuario actual tiene alguno de estos roles? */
  hasAnyRole(roles: UserRole[]): boolean {
    const r = this.role();
    return r !== null && roles.includes(r);
  }

  /** Ruta inicial sugerida según rol actual. */
  defaultRoute(): string {
    const r = this.role();
    return r ? DEFAULT_ROUTE[r] : '/auth/login';
  }
}
