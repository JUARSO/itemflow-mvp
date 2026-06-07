import { Injectable } from '@angular/core';
import { PosSale } from '../models';
import { EntityStore } from './entity-store';

/** Ventas de punto de venta (POS). */
@Injectable({ providedIn: 'root' })
export class PosSalesStore extends EntityStore<PosSale> {
  readonly collection = 'pos_sales';
  constructor() { super([]); }
}
