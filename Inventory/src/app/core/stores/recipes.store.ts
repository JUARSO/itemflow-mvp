import { Injectable } from '@angular/core';
import { Recipe } from '../models';
import { MOCK_RECIPES } from '../mocks/dummy-data';
import { EntityStore } from './entity-store';

/** Recetas (BOM). El id del documento coincide con el productId. */
@Injectable({ providedIn: 'root' })
export class RecipesStore extends EntityStore<Recipe> {
  readonly collection = 'recipes';
  constructor() { super([...MOCK_RECIPES]); }
}
