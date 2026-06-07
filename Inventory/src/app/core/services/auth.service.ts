import { EnvironmentInjector, Injectable, computed, inject, runInInjectionContext, signal } from '@angular/core';
import {
  Auth, User,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged,
  sendPasswordResetEmail,
} from '@angular/fire/auth';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { Member, Tenant, PlanId, UserRole } from '../models';
import { DEFAULT_TENANT_ID } from '../mocks/dummy-data';

/** Landing route por defecto para cada rol. */
const DEFAULT_ROUTE: Record<UserRole, string> = {
  admin: '/inventario',
  produccion: '/inventario',
  ventas: '/punto-venta',
};

export interface RegisterInput {
  orgName: string;
  adminName: string;
  adminEmail: string;
  password: string;
  planId: PlanId;
}

/**
 * Identidad real con Firebase Auth + custom claims.
 *
 * El `tenantId` y el `role` salen de los CLAIMS del token (los fija una Cloud
 * Function al registrarse/invitar) — nunca del cliente. El doc del tenant y el
 * de `members/{uid}` se leen de Firestore para hidratar el `Member`/`Tenant`.
 *
 * Mantiene la API síncrona basada en signals que consume el resto de la app
 * (user/role/tenantId/isAdmin/…), pero ahora alimentada por `onAuthStateChanged`.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = inject(Auth);
  private readonly firestore = inject(Firestore);
  private readonly functions = inject(Functions);
  private readonly injector = inject(EnvironmentInjector);

  /** Ejecuta una llamada a Firebase dentro del contexto de inyección (AngularFire lo exige). */
  private inCtx<T>(fn: () => T): T { return runInInjectionContext(this.injector, fn); }

  private readonly _user = signal<Member | null>(null);
  private readonly _tenant = signal<Tenant | null>(null);
  private readonly _ready = signal(false);

  /** Suprime el listener durante el alta de empresa (los claims aún no existen). */
  private registering = false;
  private readyResolvers: Array<() => void> = [];

  /** Callable creada en contexto de inyección (evita el warning de AngularFire). */
  private readonly callRegisterTenant = httpsCallable<
    { orgName: string; adminName: string; planId: PlanId },
    { tenantId: string; role: UserRole }
  >(this.functions, 'registerTenant');

  readonly user = this._user.asReadonly();
  /** Tenant actual hidratado desde Firestore (null si no hay sesión). */
  readonly currentTenant = this._tenant.asReadonly();
  /** true cuando ya se resolvió el primer estado de auth (evita parpadeos/redirects prematuros). */
  readonly authReady = this._ready.asReadonly();

  readonly isAuthenticated = computed(() => this._user() !== null);
  readonly role = computed<UserRole | null>(() => this._user()?.role ?? null);

  /** Tenant del usuario actual (clave de aislamiento). Default al demo si no hay sesión. */
  readonly tenantId = computed(() => this._user()?.tenantId ?? DEFAULT_TENANT_ID);

  readonly isAdmin = computed(() => this.role() === 'admin');
  readonly isProduccion = computed(() => this.role() === 'produccion');
  readonly isVentas = computed(() => this.role() === 'ventas');

  constructor() {
    onAuthStateChanged(this.auth, async (fbUser) => {
      if (this.registering) return; // el flujo de registro hidrata al final
      await this.hydrate(fbUser);
      this.markReady();
    });
  }

  /** Promesa que resuelve cuando el estado inicial de auth está listo (para guards). */
  whenReady(): Promise<void> {
    if (this._ready()) return Promise.resolve();
    return new Promise<void>(resolve => this.readyResolvers.push(resolve));
  }

  async login(email: string, password: string): Promise<Member> {
    try {
      const cred = await this.inCtx(() => signInWithEmailAndPassword(this.auth, email.trim(), password));
      const member = await this.hydrate(cred.user);
      this.markReady();
      if (!member) throw new Error('Tu cuenta no está asociada a ninguna empresa.');
      return member;
    } catch (e) {
      throw new Error(this.friendlyAuthError(e));
    }
  }

  /**
   * Auto-registro de una empresa: crea el usuario de Auth, llama a la Cloud
   * Function `registerTenant` (que crea el tenant + admin y fija los claims) y
   * refresca el token para recibirlos. Deja la sesión iniciada como ese admin.
   *
   * Robustez:
   *  - Si el correo ya existe por un intento previo a medias, inicia sesión y
   *    completa el registro (la función rechaza si ya tenía empresa).
   *  - Si la función falla tras crear el usuario en ESTE intento, borra ese
   *    usuario (rollback) para no dejar cuentas huérfanas y permitir reintentar.
   */
  async register(input: RegisterInput): Promise<Member> {
    const email = input.adminEmail.trim();
    this.registering = true;
    let createdNew = false;
    try {
      let cred;
      try {
        cred = await this.inCtx(() => createUserWithEmailAndPassword(this.auth, email, input.password));
        createdNew = true;
      } catch (e) {
        if ((e as { code?: string })?.code === 'auth/email-already-in-use') {
          // Posible registro a medias: inicia sesión para completarlo.
          cred = await this.inCtx(() => signInWithEmailAndPassword(this.auth, email, input.password));
        } else {
          throw e;
        }
      }

      try {
        await this.inCtx(() => this.callRegisterTenant({ orgName: input.orgName, adminName: input.adminName, planId: input.planId }));
      } catch (e) {
        // Rollback solo si el usuario lo creamos en este intento.
        if (createdNew) { try { await this.inCtx(() => cred.user.delete()); } catch { /* ignore */ } }
        throw e;
      }

      // Refresco forzado: trae los custom claims recién puestos por la función.
      await this.inCtx(() => cred.user.getIdToken(true));
      const member = await this.hydrate(cred.user);
      if (!member) throw new Error('No se pudo completar el registro de la empresa.');
      return member;
    } catch (e) {
      throw new Error(this.friendlyAuthError(e));
    } finally {
      this.registering = false;
      this.markReady();
    }
  }

  /**
   * Envía el correo de restablecimiento de contraseña. Firebase manda un enlace
   * al correo; el cambio ocurre en la página alojada de Firebase.
   */
  async resetPassword(email: string): Promise<void> {
    try {
      await this.inCtx(() => sendPasswordResetEmail(this.auth, email.trim()));
    } catch (e) {
      // Privacidad: no revelar si el correo existe o no. Solo propagamos errores "duros".
      const code = (e as { code?: string })?.code ?? '';
      if (code === 'auth/user-not-found') return;
      throw new Error(this.friendlyAuthError(e));
    }
  }

  async logout(): Promise<void> {
    await this.inCtx(() => signOut(this.auth));
    this._user.set(null);
    this._tenant.set(null);
  }

  /**
   * Cambia el rol del usuario actual SOLO en el cliente (dev/testing de UI). No
   * altera los claims reales: las firestore.rules siguen aplicando el rol real
   * del token, así que esto no escala privilegios.
   */
  switchRole(role: UserRole): void {
    const u = this._user();
    if (u) this._user.set({ ...u, role });
  }

  hasAnyRole(roles: UserRole[]): boolean {
    const r = this.role();
    return r !== null && roles.includes(r);
  }

  defaultRoute(): string {
    const r = this.role();
    return r ? DEFAULT_ROUTE[r] : '/auth/login';
  }

  // ===== internos =====

  /** Lee claims + docs de Firestore y puebla los signals. Devuelve el Member o null. */
  private async hydrate(fbUser: User | null): Promise<Member | null> {
    if (!fbUser) {
      this._user.set(null);
      this._tenant.set(null);
      return null;
    }
    const token = await this.inCtx(() => fbUser.getIdTokenResult());
    const tenantId = token.claims['tenantId'] as string | undefined;
    const role = token.claims['role'] as UserRole | undefined;
    if (!tenantId) {
      // Usuario autenticado pero sin tenant (p. ej. registro a medias). Sin sesión válida.
      this._user.set(null);
      this._tenant.set(null);
      return null;
    }

    const [memberSnap, tenantSnap] = await this.inCtx(() => Promise.all([
      getDoc(doc(this.firestore, `tenants/${tenantId}/members/${fbUser.uid}`)),
      getDoc(doc(this.firestore, `tenants/${tenantId}`)),
    ]));
    const m = memberSnap.data() as Partial<Member> | undefined;

    const member: Member = {
      uid: fbUser.uid,
      email: m?.email ?? fbUser.email ?? '',
      displayName: m?.displayName ?? fbUser.displayName ?? (fbUser.email?.split('@')[0] ?? 'Usuario'),
      role: role ?? m?.role ?? 'admin',
      active: m?.active ?? true,
      tenantId,
    };
    this._user.set(member);
    this._tenant.set(tenantSnap.exists() ? (tenantSnap.data() as Tenant) : null);
    return member;
  }

  private markReady(): void {
    if (!this._ready()) this._ready.set(true);
    if (this.readyResolvers.length) {
      this.readyResolvers.forEach(r => r());
      this.readyResolvers = [];
    }
  }

  /** Traduce códigos de error de Firebase Auth a mensajes en español. */
  private friendlyAuthError(e: unknown): string {
    const code = (e as { code?: string })?.code ?? '';
    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Correo o contraseña incorrectos.';
      case 'auth/invalid-email':
        return 'El correo no es válido.';
      case 'auth/email-already-in-use':
        return 'Ya existe una cuenta con ese correo.';
      case 'auth/weak-password':
        return 'La contraseña debe tener al menos 6 caracteres.';
      case 'auth/too-many-requests':
        return 'Demasiados intentos. Espera un momento e inténtalo de nuevo.';
      case 'auth/network-request-failed':
        return 'Sin conexión con el servidor. Revisa tu red.';
      case 'functions/already-exists':
        return 'Esta cuenta ya pertenece a una empresa.';
      default:
        return e instanceof Error && e.message ? e.message : 'Ocurrió un error de autenticación.';
    }
  }
}
