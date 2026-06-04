import { Injectable, computed, signal } from '@angular/core';
import { Member, PlanId, Subscription, Tenant } from '../models';
import { DEFAULT_TENANT_ID, MOCK_COMPANY, MOCK_MEMBERS } from '../mocks/dummy-data';

/** Definición de un plan de suscripción ofrecido por el SaaS. */
export interface Plan {
  id: PlanId;
  name: string;
  priceMonthly: number;   // en la moneda base (CRC)
  /** Límite de usuarios; null = ilimitado. */
  maxUsers: number | null;
  description: string;
}

/** Catálogo de planes. En Fase 3 esto vendrá del proveedor de billing. */
export const PLAN_CATALOG: Plan[] = [
  { id: 'free', name: 'Free', priceMonthly: 0, maxUsers: 2, description: 'Para probar: 1 bodega y hasta 2 usuarios.' },
  { id: 'pro', name: 'Pro', priceMonthly: 15000, maxUsers: 10, description: 'Para pymes en crecimiento: hasta 10 usuarios.' },
  { id: 'business', name: 'Business', priceMonthly: 39000, maxUsers: null, description: 'Operación completa: usuarios ilimitados.' },
];

const TENANTS_KEY = 'atlas_tenants_v1';
const USERS_KEY = 'atlas_users_v1';
const TRIAL_DAYS = 14;

interface RegisterInput {
  orgName: string;
  adminName: string;
  adminEmail: string;
  planId: PlanId;
}

/**
 * Registro multi-tenant del SaaS (cliente / Fase 1).
 *
 * Responsable de la IDENTIDAD: qué organizaciones existen, qué usuarios pueden
 * entrar y a qué tenant pertenecen. Persiste en localStorage como almacén MVP.
 *
 * SEGURIDAD: esto NO sustituye al backend. En producción (Fase 2) el directorio
 * de tenants/usuarios y el aislamiento se enforcan en Firestore + Auth + reglas
 * de seguridad. Aquí es la capa de orquestación del cliente.
 */
@Injectable({ providedIn: 'root' })
export class TenantService {
  private readonly _tenants = signal<Tenant[]>(this.readTenants());
  /** Directorio de usuarios habilitados para entrar (email → Member con tenantId). */
  private readonly _users = signal<Member[]>(this.readUsers());

  readonly tenants = this._tenants.asReadonly();
  readonly plans = PLAN_CATALOG;

  byId(id: string): Tenant | undefined {
    return this._tenants().find(t => t.id === id);
  }
  bySlug(slug: string): Tenant | undefined {
    const s = slug.trim().toLowerCase();
    return this._tenants().find(t => t.slug === s);
  }
  findUserByEmail(email: string): Member | undefined {
    const e = email.trim().toLowerCase();
    return this._users().find(u => u.email.toLowerCase() === e);
  }

  planById(id: PlanId): Plan {
    return PLAN_CATALOG.find(p => p.id === id) ?? PLAN_CATALOG[0];
  }

  /** ¿La suscripción permite usar la app? (activa o en prueba vigente). */
  isUsable(t: Tenant | undefined): boolean {
    if (!t || !t.active) return false;
    const s = t.subscription;
    if (s.status === 'active') return true;
    if (s.status === 'trialing') {
      return !s.trialEndsAt || new Date(s.trialEndsAt).getTime() > Date.now();
    }
    return false;
  }

  /**
   * Auto-registro de una empresa: crea el tenant (con prueba) y su usuario
   * administrador automáticamente. Devuelve ambos para iniciar sesión.
   * Lanza si el correo o el slug ya existen.
   */
  registerTenant(input: RegisterInput, now: Date = new Date()): { tenant: Tenant; admin: Member } {
    const email = input.adminEmail.trim().toLowerCase();
    if (!input.orgName.trim()) throw new Error('El nombre de la empresa es obligatorio.');
    if (!email) throw new Error('El correo del administrador es obligatorio.');
    if (this.findUserByEmail(email)) throw new Error('Ya existe una cuenta con ese correo.');

    const slug = this.uniqueSlug(input.orgName);
    const trialEndsAt = new Date(now.getTime() + TRIAL_DAYS * 86400_000).toISOString();
    const subscription: Subscription = { planId: input.planId, status: 'trialing', trialEndsAt };

    const tenant: Tenant = {
      id: `tenant-${now.getTime()}`,
      slug,
      name: input.orgName.trim(),
      adminEmail: email,
      currency: 'CRC',
      timezone: 'America/Costa_Rica',
      subscription,
      active: true,
      createdAt: now.toISOString(),
    };
    const admin: Member = {
      uid: `u-${now.getTime()}`,
      email,
      displayName: input.adminName.trim() || email.split('@')[0],
      role: 'admin',          // creación automática del administrador
      active: true,
      tenantId: tenant.id,
    };

    this._tenants.update(list => [...list, tenant]);
    this._users.update(list => [...list, admin]);
    this.persist();
    return { tenant, admin };
  }

  /** Cambia el plan de un tenant (placeholder hasta integrar billing en Fase 3). */
  setPlan(tenantId: string, planId: PlanId): void {
    this._tenants.update(list => list.map(t =>
      t.id === tenantId ? { ...t, subscription: { ...t.subscription, planId } } : t));
    this.persist();
  }

  /** Registra/actualiza un usuario en el directorio (p. ej. al invitar miembros). */
  upsertUser(member: Member): void {
    this._users.update(list => {
      const i = list.findIndex(u => u.uid === member.uid);
      if (i === -1) return [...list, member];
      const next = [...list]; next[i] = member; return next;
    });
    this.persist();
  }

  // ----- internos -----

  private uniqueSlug(name: string): string {
    const base = name.trim().toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '') // quita acentos
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'org';
    let slug = base;
    let n = 2;
    while (this.bySlug(slug)) slug = `${base}-${n++}`;
    return slug;
  }

  private readTenants(): Tenant[] {
    const seed = [MOCK_COMPANY];
    if (typeof localStorage === 'undefined') return seed;
    try {
      const raw = localStorage.getItem(TENANTS_KEY);
      if (!raw) return seed;
      const stored = JSON.parse(raw) as Tenant[];
      // Garantiza que el tenant demo siempre exista.
      return stored.some(t => t.id === DEFAULT_TENANT_ID) ? stored : [MOCK_COMPANY, ...stored];
    } catch {
      return seed;
    }
  }

  private readUsers(): Member[] {
    const seed = [...MOCK_MEMBERS];
    if (typeof localStorage === 'undefined') return seed;
    try {
      const raw = localStorage.getItem(USERS_KEY);
      if (!raw) return seed;
      const stored = JSON.parse(raw) as Member[];
      const merged = [...stored];
      for (const m of MOCK_MEMBERS) if (!merged.some(u => u.uid === m.uid)) merged.push(m);
      return merged;
    } catch {
      return seed;
    }
  }

  private persist(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(TENANTS_KEY, JSON.stringify(this._tenants()));
      localStorage.setItem(USERS_KEY, JSON.stringify(this._users()));
    } catch { /* cuota / modo privado: se mantiene en memoria */ }
  }
}
