import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { IonSearchbar } from '@ionic/angular/standalone';

/**
 * Buscador reutilizable para pantallas de listado de alto tráfico.
 * Binding bidireccional con un signal de query:
 *   <app-search-bar [(query)]="query" placeholder="Buscar por nombre…" />
 * Luego se filtra la colección con un computed que lee `query()`.
 */
@Component({
  selector: 'app-search-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonSearchbar],
  templateUrl: './search-bar.component.html',
  styleUrls: ['./search-bar.component.scss'],
})
export class SearchBarComponent {
  /** Texto de búsqueda (two-way). */
  readonly query = model<string>('');
  readonly placeholder = input<string>('Buscar…');

  onInput(ev: Event): void {
    const value = (ev as CustomEvent).detail?.value ?? '';
    this.query.set(value);
  }
}
