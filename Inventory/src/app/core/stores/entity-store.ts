import { WritableSignal, inject, signal } from '@angular/core';
import { StoreSync } from './store-sync.service';

/**
 * Base de un "store" por entidad: dueño del signal de una colección y de las
 * operaciones genéricas sobre él. La persistencia en Firestore la centraliza
 * {@link StoreSync} (cada store se auto-registra al construirse).
 *
 * Cada entidad extiende esta clase, fija su `collection` (nombre de la
 * subcolección bajo `tenants/{tid}/...`, o `null` si no se persiste) y agrega
 * sus `computed`/CRUD específicos. `DataService` compone todos los stores.
 */
export abstract class EntityStore<T extends { id: string }> {
  /** Subcolección en Firestore. `null` = no se persiste (p. ej. alertas derivadas). */
  abstract readonly collection: string | null;
  /** Append-only: solo se crean documentos, nunca se borran (kardex). */
  readonly appendOnly: boolean = false;

  /**
   * Campos DERIVADOS que NO se guardan en Firestore (se recalculan en memoria a
   * partir del estado actual). Tampoco cuentan para el diff de persistencia, así
   * que recalcularlos no dispara escrituras. Ej.: el `status` de stock.
   */
  readonly derivedFields: readonly string[] = [];

  /** Estado vivo de la entidad. */
  readonly items: WritableSignal<T[]>;

  protected constructor(seed: T[]) {
    this.items = signal<T[]>(seed);
    inject(StoreSync).register(this as unknown as EntityStore<{ id: string }>);
  }

  // ----- Mutaciones genéricas (la persistencia la refleja StoreSync) -----
  set(items: T[]): void { this.items.set(items); }

  upsert(item: T): void {
    this.items.update(list => {
      const i = list.findIndex(x => x.id === item.id);
      return i < 0 ? [item, ...list] : list.map(x => (x.id === item.id ? item : x));
    });
  }

  patch(id: string, patch: Partial<T>): void {
    this.items.update(list => list.map(x => (x.id === id ? { ...x, ...patch } : x)));
  }

  remove(id: string): void {
    this.items.update(list => list.filter(x => x.id !== id));
  }

  byId(id: string): T | undefined {
    return this.items().find(x => x.id === id);
  }
}
