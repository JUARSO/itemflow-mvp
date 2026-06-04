import { Injectable, computed, inject, signal } from '@angular/core';
import { Member, PlanId, UserRole } from '../models';
import { DEFAULT_TENANT_ID } from '../mocks/dummy-data';
import { TenantService } from './tenant.service';

const STORAGE_KEY = 'atlas_session_v1';

/** Landing route por defecto para cada rol. */
const DEFAULT_ROUTE: Record<UserRole, string> = {
  admin: '/inventario',
  produccion: '/inventario',
  ventas: '/punto-venta',
};

/** Migración de roles legacy (4 roles) → modelo actual (3 roles). */
const LEGACY_ROLE_MAP: Record<string, UserRole> = {
  admin: 'admin',
  produccion: 'produccion',
  ventas: 'ventas',
  inventory: 'produccion',
  production: 'ventas',
  operator: 'ventas',
  sales: 'ventas',
};

export interface RegisterInput {
  orgName: string;
  adminName: string;
  adminEmail: string;
  password: string;
  planId: PlanId;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly tenants = inject(TenantService);
  private readonly _user = signal<Member | null>(null);

  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);
  readonly role = computed<UserRole | null>(() => this._user()?.role ?? null);

  /** Tenant del usuario actual (clave de aislamiento). Default al demo si no hay sesión. */
  readonly tenantId = computed(() => this._user()?.tenantId ?? DEFAULT_TENANT_ID);

  readonly isAdmin = computed(() => this.role() === 'admin');
  readonly isProduccion = computed(() => this.role() === 'produccion');
  readonly isVentas = computed(() => this.role() === 'ventas');

  constructor() {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Member;
        parsed.role = LEGACY_ROLE_MAP[parsed.role as string] ?? 'admin';
        // Compatibilidad: sesiones previas sin tenantId quedan en el tenant demo.
        if (!parsed.tenantId) parsed.tenantId = DEFAULT_TENANT_ID;
        this._user.set(parsed);
      } catch { /* ignore */ }
    }
  }

  /**
   * Login demo: si el correo existe en el directorio de tenants se usa su rol
   * y su tenant; si no, se crea una sesión temporal admin en el tenant demo
   * (mantiene el comportamiento actual de pruebas).
   */
  async login(email: string, _password: string): Promise<Member> {
    await new Promise(r => setTimeout(r, 400));
    const existing = this.tenants.findUserByEmail(email);
    const user: Member = existing ?? {
      uid: `u-${Date.now()}`,
      email,
      displayName: email.split('@')[0],
      role: 'admin',
      active: true,
      tenantId: DEFAULT_TENANT_ID,
    };
    this.setSession(user);
    return user;
  }

  /**
   * Auto-registro de una empresa: crea el tenant + su administrador y deja la
   * sesión iniciada como ese admin. Sin intervención manual.
   */
  async register(input: RegisterInput): Promise<Member> {
    await new Promise(r => setTimeout(r, 400));
    const { admin } = this.tenants.registerTenant({
      orgName: input.orgName,
      adminName: input.adminName,
      adminEmail: input.adminEmail,
      planId: input.planId,
    });
    this.setSession(admin);
    return admin;
  }

  logout(): void {
    this._user.set(null);
    if (typeof window !== 'undefined') localStorage.removeItem(STORAGE_KEY);
  }

  /** Cambia el rol del usuario actual (solo demo / testing). */
  switchRole(role: UserRole): void {
    const u = this._user();
    if (!u) return;
    this.setSession({ ...u, role });
  }

  hasAnyRole(roles: UserRole[]): boolean {
    const r = this.role();
    return r !== null && roles.includes(r);
  }

  defaultRoute(): string {
    const r = this.role();
    return r ? DEFAULT_ROUTE[r] : '/auth/login';
  }

  private setSession(user: Member): void {
    this._user.set(user);
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  }
}
