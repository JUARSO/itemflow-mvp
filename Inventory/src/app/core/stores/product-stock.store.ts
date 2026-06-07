import { Injectable } from '@angular/core';
import { StockItem } from '../models';
import { MOCK_PRODUCT_STOCK } from '../mocks/dummy-data';
import { EntityStore } from './entity-store';

/** Stock de productos terminados por bodega. */
@Injectable({ providedIn: 'root' })
export class ProductStockStore extends EntityStore<StockItem> {
  readonly collection = 'product_stock';
  /** `status` se deriva del stock actual; no se persiste. */
  override readonly derivedFields = ['status'];
  constructor() { super([...MOCK_PRODUCT_STOCK]); }
}
