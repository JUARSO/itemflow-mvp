import { Injectable } from '@angular/core';
import { Alert } from '../models';
import { MOCK_ALERTS } from '../mocks/dummy-data';
import { EntityStore } from './entity-store';

/**
 * Alertas. NO se persisten (`collection = null`): son DERIVADAS del stock/OCs y
 * se reconstruyen con `regenerateAutoAlerts`. Solo viven en memoria.
 */
@Injectable({ providedIn: 'root' })
export class AlertsStore extends EntityStore<Alert> {
  readonly collection = null;
  constructor() { super([...MOCK_ALERTS]); }
}
