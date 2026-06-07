import { EnvironmentInjector, Injectable, computed, effect, inject, runInInjectionContext, signal } from '@angular/core';
import { Firestore, collection, getDocs } from '@angular/fire/firestore';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { Member, UserRole } from '../models';
import { AuthService } from './auth.service';

/**
 * Gestión de miembros del tenant — IDENTIDAD, contra Firebase real.
 *
 * La lista se lee de `tenants/{tenantId}/members`. Las mutaciones (invitar,
 * cambiar rol, eliminar) pasan por Cloud Functions que solo un admin puede
 * ejecutar (validado por claims), porque crean/editan usuarios de Auth y claims.
 *
 * Crear cuentas de `ventas`/`produccion` SOLO es posible desde aquí: el
 * auto-registro público crea únicamente administradores de una nueva empresa.
 */
@Injectable({ providedIn: 'root' })
export class MembersService {
  private readonly firestore = inject(Firestore);
  private readonly functions = inject(Functions);
  private readonly auth = inject(AuthService);
  private readonly injector = inject(EnvironmentInjector);

  /** Ejecuta una llamada a Firebase dentro del contexto de inyección (AngularFire lo exige). */
  private inCtx<T>(fn: () => T): T { return runInInjectionContext(this.injector, fn); }

  private readonly _members = signal<Member[]>([]);
  private readonly _loading = signal(false);
  readonly members = this._members.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly count = computed(() => this._members().length);

  private readonly callInvite = httpsCallable<
    { email: string; displayName: string; role: UserRole; password: string },
    { uid: string; tenantId: string; role: UserRole }
  >(this.functions, 'inviteMember');
  private readonly callSetRole = httpsCallable<
    { uid: string; role: UserRole; displayName?: string },
    { uid: string; role: UserRole }
  >(this.functions, 'setMemberRole');
  private readonly callRemove = httpsCallable<{ uid: string }, { uid: string }>(this.functions, 'removeMember');

  constructor() {
    // Carga (y recarga) la lista cuando hay sesión lista en un tenant.
    effect(() => {
      const ready = this.auth.authReady();
      const tenantId = this.auth.tenantId();
      if (ready && this.auth.isAuthenticated()) {
        void this.load(tenantId);
      } else {
        this._members.set([]);
      }
    });
  }

  /** Recarga la lista de miembros del tenant indicado desde Firestore. */
  async load(tenantId: string): Promise<void> {
    this._loading.set(true);
    try {
      const snap = await this.inCtx(() => getDocs(collection(this.firestore, `tenants/${tenantId}/members`)));
      this._members.set(snap.docs.map(d => d.data() as Member));
    } finally {
      this._loading.set(false);
    }
  }

  /** Crea la cuenta de un miembro (solo admin). Devuelve el uid del nuevo usuario. */
  async invite(input: { email: string; displayName: string; role: UserRole; password: string }): Promise<string> {
    const res = await this.inCtx(() => this.callInvite(input));
    await this.load(this.auth.tenantId());
    return res.data.uid;
  }

  /** Edita un miembro: su rol y/o su nombre (solo admin). */
  async update(uid: string, changes: { role: UserRole; displayName?: string }): Promise<void> {
    await this.inCtx(() => this.callSetRole({ uid, ...changes }));
    await this.load(this.auth.tenantId());
  }

  /** Elimina un miembro: borra su acceso por completo (solo admin). */
  async remove(uid: string): Promise<void> {
    await this.inCtx(() => this.callRemove({ uid }));
    await this.load(this.auth.tenantId());
  }
}
