import { Injectable, computed } from '@angular/core';
import { Supply } from '../models';
import { MOCK_SUPPLIES } from '../mocks/dummy-data';
import { EntityStore } from './entity-store';

/** Insumos / materias primas. */
@Injectable({ providedIn: 'root' })
export class SuppliesStore extends EntityStore<Supply> {
  readonly collection = 'supplies';
  readonly active = computed(() => this.items().filter(s => s.active));
  constructor() { super([...MOCK_SUPPLIES]); }
}
