import { Injectable } from '@angular/core';
import { SaleRecord } from '../models';
import { MOCK_SALES } from '../mocks/dummy-data';
import { EntityStore } from './entity-store';

/** Ventas históricas (features para ML). */
@Injectable({ providedIn: 'root' })
export class SalesStore extends EntityStore<SaleRecord> {
  readonly collection = 'sale_records';
  constructor() { super([...MOCK_SALES]); }
}
