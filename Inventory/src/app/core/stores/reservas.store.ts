import { Injectable } from '@angular/core';
import { ReservaItem } from '../models';
import { EntityStore } from './entity-store';

/** Reservas de stock para pedidos en proceso. */
@Injectable({ providedIn: 'root' })
export class ReservasStore extends EntityStore<ReservaItem> {
  readonly collection = 'reservas';
  constructor() { super([]); }
}
