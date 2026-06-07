import { RecipeTemplateId } from './models';

/**
 * Catálogo de PLANTILLAS de receta. Cada plantilla define el tipo de ficha
 * técnica: qué secciones se muestran y con qué enfoque (panadería, repostería,
 * bebida o general). El layout concreto lo arma `ficha-tecnica.ts` y el modal
 * de receta muestra/oculta campos según `templateSections`.
 */
export interface RecipeTemplate {
  id: RecipeTemplateId;
  label: string;
  description: string;
  /** Color de acento de la ficha técnica impresa. */
  accent: string;
}

export const RECIPE_TEMPLATES: readonly RecipeTemplate[] = [
  { id: 'panaderia', label: 'Panadería', description: 'Fermentación, laminado y horneo', accent: '#16284B' },
  { id: 'reposteria', label: 'Pastelería', description: 'Batido, horneo y decoración', accent: '#8E2D5B' },
  { id: 'bebida', label: 'Bebida', description: 'Preparación y temperatura de servicio', accent: '#5A3A1E' },
  { id: 'general', label: 'General', description: 'Ingredientes y procedimiento', accent: '#3A4A5E' },
];

export const DEFAULT_RECIPE_TEMPLATE: RecipeTemplateId = 'panaderia';

export function recipeTemplate(id: string | undefined): RecipeTemplate {
  return RECIPE_TEMPLATES.find(t => t.id === id) ?? RECIPE_TEMPLATES[0];
}

/** Qué campos/secciones de ficha técnica aplican a cada plantilla. */
export interface TemplateSections {
  weights: boolean;
  lamination: boolean;
  fermentation: boolean;
  beating: boolean;
  oven: boolean;
  sizes: boolean;
  decoration: boolean;
}

export function templateSections(id: string | undefined): TemplateSections {
  switch (id) {
    // Pastelería: batido + horneo + decoración (sin laminado ni fermentación).
    case 'reposteria': return { weights: true, lamination: false, fermentation: false, beating: true, oven: true, sizes: true, decoration: true };
    case 'bebida':     return { weights: false, lamination: false, fermentation: false, beating: false, oven: false, sizes: false, decoration: true };
    case 'general':    return { weights: false, lamination: false, fermentation: false, beating: false, oven: false, sizes: false, decoration: false };
    case 'panaderia':
    default:           return { weights: true, lamination: true, fermentation: true, beating: false, oven: true, sizes: true, decoration: true };
  }
}
