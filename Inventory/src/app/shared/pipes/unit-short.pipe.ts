import { Pipe, PipeTransform } from '@angular/core';
import { Unit, unitShort } from '../../core/units';

/**
 * Muestra la abreviatura concisa de una unidad. Uso:
 *   {{ qty | number }} {{ item.unit | unitShort }}   →  "12 u", "50 kg"
 */
@Pipe({ name: 'unitShort', standalone: true })
export class UnitShortPipe implements PipeTransform {
  transform(u: Unit | string | null | undefined): string {
    return unitShort(u);
  }
}
