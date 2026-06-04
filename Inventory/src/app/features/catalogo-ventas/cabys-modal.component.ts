import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { FormModalComponent } from '../../shared/components/form-modal/form-modal.component';
import { SearchBarComponent } from '../../shared/components/search-bar/search-bar.component';
import { CabysService, CabysEntry } from '../../core/services/cabys.service';

/** Producto mínimo que recibe el modal para asignarle CABYS. */
export interface CabysTarget {
  id: string;
  name: string;
  cabysCode?: string;
  cabysDesc?: string;
  cabysIva?: number;
}

@Component({
  selector: 'app-cabys-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, IonButton, IonIcon, FormModalComponent, SearchBarComponent],
  templateUrl: './cabys-modal.component.html',
  styleUrls: ['./cabys-modal.component.scss'],
})
export class CabysModalComponent {
  private readonly cabys = inject(CabysService);

  readonly isOpen = input.required<boolean>();
  readonly product = input<CabysTarget | null>(null);
  readonly closed = output<void>();
  /** Emite el código elegido (con su tasa de IVA), o null si se quita la asignación. */
  readonly saved = output<{ code: string; desc: string; iva: number } | null>();

  readonly loading = this.cabys.loading;
  readonly error = this.cabys.error;

  readonly query = signal('');
  readonly selected = signal<CabysEntry | null>(null);

  /** Resultados reactivos: dependen del query y de que el catálogo esté listo. */
  readonly results = computed<CabysEntry[]>(() => {
    this.cabys.ready(); // dependencia: recomputar cuando termine de cargar
    return this.cabys.search(this.query(), 50);
  });

  constructor() {
    effect(() => {
      if (this.isOpen()) {
        const p = this.product();
        // Precarga el código actual como seleccionado.
        this.selected.set(p?.cabysCode
          ? { codigo: p.cabysCode, descripcion: p.cabysDesc ?? '', busqueda: '', tasa_iva: p.cabysIva ?? 0 }
          : null);
        this.query.set('');
        void this.cabys.ensureLoaded();
      }
    });
  }

  pick(e: CabysEntry) {
    this.selected.set(e);
  }

  guardar() {
    const s = this.selected();
    if (!s) return;
    this.saved.emit({ code: s.codigo, desc: s.descripcion, iva: s.tasa_iva });
  }

  quitar() {
    this.saved.emit(null);
  }
}
