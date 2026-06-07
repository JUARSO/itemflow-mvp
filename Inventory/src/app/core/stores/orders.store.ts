import { Injectable } from '@angular/core';
import { CustomerOrder } from '../models';
import { MOCK_ORDERS } from '../mocks/dummy-data';
import { EntityStore } from './entity-store';

/** Pedidos de clientes (órdenes de fabricación / reposición). */
@Injectable({ providedIn: 'root' })
export class OrdersStore extends EntityStore<CustomerOrder> {
  readonly collection = 'orders';
  constructor() { super([...MOCK_ORDERS]); }
}
