import { Injectable, computed } from '@angular/core';
import { Supplier } from '../models';
import { MOCK_SUPPLIERS } from '../mocks/dummy-data';
import { EntityStore } from './entity-store';

/**
 * Proveedores. Dueño del estado + CRUD. La persistencia en Firestore la refleja
 * {@link StoreSync} por diff (no hace falta escribir setDoc aquí).
 */
@Injectable({ providedIn: 'root' })
export class SuppliersStore extends EntityStore<Supplier> {
  readonly collection = 'suppliers';
  readonly active = computed(() => this.items().filter(s => s.active));

  constructor() { super([...MOCK_SUPPLIERS]); }

  /** Crear: genera id + createdAt y lo agrega al inicio de la lista. */
  create(input: Omit<Supplier, 'id' | 'createdAt'>): Supplier {
    const s: Supplier = { ...input, id: `sup-${Date.now()}`, createdAt: new Date() };
    this.items.update(list => [s, ...list]);
    return s;
  }

  /** Editar: aplica cambios parciales. */
  update(id: string, patch: Partial<Omit<Supplier, 'id' | 'createdAt'>>): void {
    this.patch(id, patch);
  }

  /** Eliminar. */
  delete(id: string): void { this.remove(id); }
}
