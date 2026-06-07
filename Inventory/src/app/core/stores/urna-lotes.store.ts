import { Injectable } from '@angular/core';
import { UrnaLote } from '../models';
import { MOCK_URNA_LOTES } from '../mocks/dummy-data';
import { EntityStore } from './entity-store';

/** Lotes dentro de las urnas. */
@Injectable({ providedIn: 'root' })
export class UrnaLotesStore extends EntityStore<UrnaLote> {
  readonly collection = 'urna_lotes';
  constructor() { super([...MOCK_URNA_LOTES]); }
}
