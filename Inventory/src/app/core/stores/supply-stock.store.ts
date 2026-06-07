import { Injectable } from '@angular/core';
import { SupplyStockItem } from '../models';
import { MOCK_SUPPLY_STOCK } from '../mocks/dummy-data';
import { EntityStore } from './entity-store';

/** Stock de insumos por bodega. */
@Injectable({ providedIn: 'root' })
export class SupplyStockStore extends EntityStore<SupplyStockItem> {
  readonly collection = 'supply_stock';
  /** `status` se deriva del stock actual; no se persiste. */
  override readonly derivedFields = ['status'];
  constructor() { super([...MOCK_SUPPLY_STOCK]); }
}
