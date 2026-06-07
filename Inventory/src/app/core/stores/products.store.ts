import { Injectable, computed } from '@angular/core';
import { Product } from '../models';
import { MOCK_PRODUCTS } from '../mocks/dummy-data';
import { EntityStore } from './entity-store';

/** Catálogo de productos terminados. */
@Injectable({ providedIn: 'root' })
export class ProductsStore extends EntityStore<Product> {
  readonly collection = 'products';
  readonly active = computed(() => this.items().filter(p => p.active));
  constructor() { super([...MOCK_PRODUCTS]); }
}
