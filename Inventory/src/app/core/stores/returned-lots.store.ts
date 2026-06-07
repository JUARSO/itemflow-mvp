import { Injectable } from '@angular/core';
import { ReturnedLot } from '../models';
import { MOCK_RETURNED_LOTS } from '../mocks/dummy-data';
import { EntityStore } from './entity-store';

/** Lotes devueltos / mermas en revisión. */
@Injectable({ providedIn: 'root' })
export class ReturnedLotsStore extends EntityStore<ReturnedLot> {
  readonly collection = 'returned_lots';
  constructor() { super([...MOCK_RETURNED_LOTS]); }
}
