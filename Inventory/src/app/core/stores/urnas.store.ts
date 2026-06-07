import { Injectable, computed } from '@angular/core';
import { Urna } from '../models';
import { MOCK_URNAS } from '../mocks/dummy-data';
import { EntityStore } from './entity-store';

/** Urnas / vitrinas (ubicaciones de stock de Ventas). */
@Injectable({ providedIn: 'root' })
export class UrnasStore extends EntityStore<Urna> {
  readonly collection = 'urnas';
  readonly active = computed(() => this.items().filter(u => u.active));
  constructor() { super([...MOCK_URNAS]); }
}
