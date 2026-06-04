/**
 * Catálogo central de unidades de medida soportadas en la app.
 *
 * El tipo `Unit` es una unión literal estricta — TS bloqueará cualquier
 * string fuera de este set en los modelos que lo usen.
 *
 * Los formularios (catálogo, insumos) reusan `UNITS` para renderizar el
 * <select>, así nunca hay desfase entre lo que el usuario puede elegir y
 * lo que el modelo acepta.
 */
export type Unit =
  // Peso
  | 'kg' | 'g' | 'lb' | 'oz'
  // Volumen
  | 'L' | 'ml' | 'gal'
  // Conteo / empaque
  | 'unidad' | 'docena' | 'par' | 'paquete' | 'caja' | 'bolsa' | 'saco'
  // Longitud
  | 'm' | 'cm';

export type UnitGroup = 'Peso' | 'Volumen' | 'Conteo' | 'Longitud';

export interface UnitDef {
  value: Unit;
  label: string;
  group: UnitGroup;
}

export const UNITS: readonly UnitDef[] = [
  // Peso
  { value: 'kg',      label: 'kg — kilogramo',  group: 'Peso' },
  { value: 'g',       label: 'g — gramo',       group: 'Peso' },
  { value: 'lb',      label: 'lb — libra',      group: 'Peso' },
  { value: 'oz',      label: 'oz — onza',       group: 'Peso' },
  // Volumen
  { value: 'L',       label: 'L — litro',       group: 'Volumen' },
  { value: 'ml',      label: 'ml — mililitro',  group: 'Volumen' },
  { value: 'gal',     label: 'gal — galón',     group: 'Volumen' },
  // Conteo / empaque
  { value: 'unidad',  label: 'unidad',          group: 'Conteo' },
  { value: 'docena',  label: 'docena',          group: 'Conteo' },
  { value: 'par',     label: 'par',             group: 'Conteo' },
  { value: 'paquete', label: 'paquete',         group: 'Conteo' },
  { value: 'caja',    label: 'caja',            group: 'Conteo' },
  { value: 'bolsa',   label: 'bolsa',           group: 'Conteo' },
  { value: 'saco',    label: 'saco',            group: 'Conteo' },
  // Longitud
  { value: 'm',       label: 'm — metro',       group: 'Longitud' },
  { value: 'cm',      label: 'cm — centímetro', group: 'Longitud' },
] as const;

/**
 * Abreviatura CONCISA de cada unidad, para mostrar junto a cantidades en TODA
 * la app (ej. "12 u", "50 kg", "3 saco"). Fuente única de verdad.
 */
const UNIT_SHORT: Record<Unit, string> = {
  kg: 'kg', g: 'g', lb: 'lb', oz: 'oz',
  L: 'L', ml: 'ml', gal: 'gal',
  unidad: 'u', docena: 'dz', par: 'par', paquete: 'paq', caja: 'caja', bolsa: 'bolsa', saco: 'saco',
  m: 'm', cm: 'cm',
};

/** Devuelve la abreviatura concisa de una unidad (ej. 'unidad' → 'u'). */
export function unitShort(u: Unit | string | null | undefined): string {
  if (!u) return '';
  return UNIT_SHORT[u as Unit] ?? String(u);
}

/** Orden de grupos para renderizar `<optgroup>` consistentemente. */
export const UNIT_GROUPS: readonly UnitGroup[] = ['Peso', 'Volumen', 'Conteo', 'Longitud'];

/** Helper para agrupar opciones del select. */
export function unitsByGroup(): Record<UnitGroup, UnitDef[]> {
  return UNIT_GROUPS.reduce((acc, g) => {
    acc[g] = UNITS.filter(u => u.group === g);
    return acc;
  }, {} as Record<UnitGroup, UnitDef[]>);
}
