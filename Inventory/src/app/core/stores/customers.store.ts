import { Injectable, computed } from '@angular/core';
import { Customer } from '../models';
import { MOCK_CUSTOMERS } from '../mocks/dummy-data';
import { EntityStore } from './entity-store';

/** Clientes externos. */
@Injectable({ providedIn: 'root' })
export class CustomersStore extends EntityStore<Customer> {
  readonly collection = 'customers';
  readonly active = computed(() => this.items().filter(c => c.active));
  constructor() { super([...MOCK_CUSTOMERS]); }
}
