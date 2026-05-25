import { Injectable, signal, computed } from '@angular/core';
import { Member, UserRole } from '../models';
import { MOCK_MEMBERS } from '../mocks/dummy-data';

const STORAGE_KEY = 'itemflow_session_v1';

/** Landing route por defecto para cada rol. */
const DEFAULT_ROUTE: Record<UserRole, string> = {
  admin: '/produccion',
  production: '/produccion',
  operator: '/produccion',
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _user = signal<Member | null>(null);

  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);
  readonly role = computed<UserRole | null>(() => this._user()?.role ?? null);

  readonly isAdmin = computed(() => this.role() === 'admin');
  readonly isProduction = computed(() => this.role() === 'production');
  readonly isOperator = computed(() => this.role() === 'operator');

  constructor() {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Member;
        // Migración: roles legacy 'sales' u 'operator-legacy' caen a 'production'
        if ((parsed.role as string) === 'sales') {
          parsed.role = 'production';
        }
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
