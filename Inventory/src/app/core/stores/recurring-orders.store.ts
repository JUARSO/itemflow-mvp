import { Injectable } from '@angular/core';
import { RecurringOrder } from '../models';
import { EntityStore } from './entity-store';

/** Pedidos recurrentes (suscripciones de reposición). */
@Injectable({ providedIn: 'root' })
export class RecurringOrdersStore extends EntityStore<RecurringOrder> {
  readonly collection = 'recurring_orders';
  constructor() { super([]); }
}
