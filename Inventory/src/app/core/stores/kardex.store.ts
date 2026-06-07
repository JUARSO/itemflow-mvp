import { Injectable } from '@angular/core';
import { KardexEntry } from '../models';
import { MOCK_KARDEX } from '../mocks/dummy-data';
import { EntityStore } from './entity-store';

/** Kardex (movimientos de inventario). APPEND-ONLY: nunca se borra/edita. */
@Injectable({ providedIn: 'root' })
export class KardexStore extends EntityStore<KardexEntry> {
  readonly collection = 'kardex';
  override readonly appendOnly = true;
  constructor() { super([...MOCK_KARDEX]); }
}
