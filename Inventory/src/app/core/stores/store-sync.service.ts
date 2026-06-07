import { EnvironmentInjector, Injectable, effect, inject, runInInjectionContext, signal, untracked } from '@angular/core';
import { Firestore, collection, deleteDoc, doc, getDoc, getDocs, setDoc, Timestamp } from '@angular/fire/firestore';
import { AuthService } from '../services/auth.service';
import { EntityStore } from './entity-store';

/** Doc tipo Record/objeto (no colección array) sincronizado como un solo documento. */
interface DocSync {
  path: string;                       // ruta relativa al tenant, p. ej. 'consumer_prices/_all'
  read: (value: unknown) => void;     // aplica el doc leído al signal
  value: () => object;                // arma el objeto a persistir
}

/**
 * Sincronización Firestore CENTRALIZADA para todos los stores por entidad.
 *
 * - Carga: al iniciar sesión, lee cada colección a su signal y fija un baseline.
 * - Persistencia: un `effect` reactivo escribe altas/cambios (setDoc) y bajas
 *   (deleteDoc, salvo append-only) por diff de huella JSON contra el baseline.
 *
 * Los stores se registran solos en su constructor; los docs tipo Record se
 * registran con {@link registerDoc} (precios al consumidor, plan semanal, …).
 */
@Injectable({ providedIn: 'root' })
export class StoreSync {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);
  private readonly injector = inject(EnvironmentInjector);

  private readonly stores: EntityStore<{ id: string }>[] = [];
  private readonly docs: DocSync[] = [];

  /** false hasta terminar la carga inicial del tenant (frena escrituras espurias). */
  private readonly _ready = signal(false);
  readonly ready = this._ready.asReadonly();
  /** Tenant cuyos baselines están cargados; solo se persiste a este. */
  private loadedTenant: string | null = null;

  private readonly baselines = new Map<string, Map<string, string>>();
  private readonly docBaselines = new Map<string, string>();

  register(store: EntityStore<{ id: string }>): void { this.stores.push(store); }
  registerDoc(d: DocSync): void { this.docs.push(d); }

  constructor() {
    // 1) Carga al haber sesión lista; limpia si se cierra sesión.
    effect(() => {
      const ready = this.auth.authReady();
      const authed = this.auth.isAuthenticated();
      const tenantId = this.auth.tenantId();
      if (ready && authed) {
        void this.loadAll(tenantId);
      } else {
        this._ready.set(false);
        this.loadedTenant = null;
      }
    });

    // 2) Persistencia reactiva por diff.
    effect(() => {
      if (!this._ready()) return;
      if (!this.auth.isAuthenticated()) return;
      if (this.auth.tenantId() !== this.loadedTenant) return;
      for (const s of this.stores) {
        if (!s.collection) continue;
        const items = s.items();                       // rastrea el signal
        untracked(() => this.persistStore(s, items));
      }
      for (const d of this.docs) {
        const value = d.value();                       // rastrea los signals que use
        untracked(() => this.persistDoc(d, value));
      }
    });
  }

  /** Ejecuta una llamada a Firebase dentro del contexto de inyección (AngularFire lo exige). */
  private inCtx<R>(fn: () => R): R { return runInInjectionContext(this.injector, fn); }

  /** Carga todas las colecciones + docs del tenant y fija los baselines. */
  async loadAll(tenantId: string): Promise<void> {
    this._ready.set(false);
    this.loadedTenant = null;
    await Promise.all(this.stores.filter(s => s.collection).map(async s => {
      const snap = await this.inCtx(() => getDocs(collection(this.firestore, `tenants/${tenantId}/${s.collection}`)));
      const base = new Map<string, string>();
      const items = snap.docs.map(docSnap => {
        const item = { ...(this.deserialize(docSnap.data()) as object), id: docSnap.id } as { id: string };
        base.set(docSnap.id, JSON.stringify(this.strip(item, s.derivedFields)));
        return item;
      });
      s.items.set(items);
      this.baselines.set(s.collection!, base);
    }));
    await Promise.all(this.docs.map(async d => {
      const data = (await this.inCtx(() => getDoc(doc(this.firestore, `tenants/${tenantId}/${d.path}`)))).data();
      if (data) d.read(this.deserialize(data));
      this.docBaselines.set(d.path, JSON.stringify(d.value()));
    }));
    this.loadedTenant = tenantId;
    this._ready.set(true);
  }

  private persistStore(s: EntityStore<{ id: string }>, items: Array<{ id: string }>): void {
    const tid = this.auth.tenantId();
    const name = s.collection!;
    const base = this.baselines.get(name) ?? new Map<string, string>();
    const seen = new Set<string>();
    for (const item of items) {
      if (!item?.id) continue;
      seen.add(item.id);
      const fp = JSON.stringify(this.strip(item, s.derivedFields));   // ignora campos derivados
      if (base.get(item.id) === fp) continue;
      base.set(item.id, fp);
      const { id, ...rest } = this.strip(item, s.derivedFields);
      void this.inCtx(() => setDoc(doc(this.firestore, `tenants/${tid}/${name}/${id}`), this.serialize(rest) as object))
        .catch(err => console.error(`sync ${name}/${id}`, err));
    }
    if (!s.appendOnly) {
      for (const id of [...base.keys()]) {
        if (seen.has(id)) continue;
        base.delete(id);
        void this.inCtx(() => deleteDoc(doc(this.firestore, `tenants/${tid}/${name}/${id}`)))
          .catch(err => console.error(`delete ${name}/${id}`, err));
      }
    }
    this.baselines.set(name, base);
  }

  private persistDoc(d: DocSync, value: object): void {
    const fp = JSON.stringify(value);
    if (this.docBaselines.get(d.path) === fp) return;
    this.docBaselines.set(d.path, fp);
    void this.inCtx(() => setDoc(doc(this.firestore, `tenants/${this.auth.tenantId()}/${d.path}`), this.serialize(value) as object))
      .catch(err => console.error(`sync ${d.path}`, err));
  }

  /** Copia superficial sin las claves indicadas (campos derivados que no se persisten). */
  private strip(obj: { id: string }, fields: readonly string[]): { id: string } {
    if (!fields.length) return obj;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) if (!fields.includes(k)) out[k] = v;
    return out as { id: string };
  }

  /** Date → Timestamp y descarta `undefined` (Firestore los rechaza), recursivo. */
  private serialize(v: unknown): unknown {
    if (v === undefined || v === null) return v ?? null;
    if (v instanceof Date) return Timestamp.fromDate(v);
    if (Array.isArray(v)) return v.map(x => this.serialize(x));
    if (typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v)) {
        if (val === undefined) continue;
        out[k] = this.serialize(val);
      }
      return out;
    }
    return v;
  }

  /** Timestamp → Date, recursivo (inverso de serialize). */
  private deserialize(v: unknown): unknown {
    if (v instanceof Timestamp) return v.toDate();
    if (Array.isArray(v)) return v.map(x => this.deserialize(x));
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v)) out[k] = this.deserialize(val);
      return out;
    }
    return v;
  }
}
