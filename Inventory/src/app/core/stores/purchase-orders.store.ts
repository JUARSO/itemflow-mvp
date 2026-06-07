import { Injectable } from '@angular/core';
import { PurchaseOrder } from '../models';
import { MOCK_PURCHASE_ORDERS } from '../mocks/dummy-data';
import { EntityStore } from './entity-store';

/** Órdenes de compra. */
@Injectable({ providedIn: 'root' })
export class PurchaseOrdersStore extends EntityStore<PurchaseOrder> {
  readonly collection = 'purchase_orders';
  constructor() { super([...MOCK_PURCHASE_ORDERS]); }
}
