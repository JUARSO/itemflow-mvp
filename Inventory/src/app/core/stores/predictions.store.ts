import { Injectable } from '@angular/core';
import { DemandPrediction } from '../models';
import { MOCK_PREDICTIONS } from '../mocks/dummy-data';
import { EntityStore } from './entity-store';

/** Predicciones de demanda (ML). */
@Injectable({ providedIn: 'root' })
export class PredictionsStore extends EntityStore<DemandPrediction> {
  readonly collection = 'predictions';
  constructor() { super([...MOCK_PREDICTIONS]); }
}
