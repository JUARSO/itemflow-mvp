import { Injectable } from '@angular/core';
import { PosCliente } from '../models';
import { EntityStore } from './entity-store';

/** Clientes del punto de venta (POS). */
@Injectable({ providedIn: 'root' })
export class PosClientesStore extends EntityStore<PosCliente> {
  readonly collection = 'pos_clientes';
  constructor() { super([]); }
}
