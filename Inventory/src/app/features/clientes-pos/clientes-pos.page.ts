import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
  IonButton, IonIcon, IonBadge,
} from '@ionic/angular/standalone';
import { DataService } from '../../core/services/data.service';
import { UbicacionesService } from '../../core/services/ubicaciones.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { SearchBarComponent } from '../../shared/components/search-bar/search-bar.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { PosClienteFormModalComponent } from './pos-cliente-form-modal.component';
import { PosCliente } from '../../core/models';

@Component({
  selector: 'app-clientes-pos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
    IonButton, IonIcon, IonBadge,
    PageHeaderComponent, EmptyStateComponent, SearchBarComponent, ConfirmDialogComponent,
    PosClienteFormModalComponent,
  ],
  templateUrl: './clientes-pos.page.html',
  styleUrls: ['./clientes-pos.page.scss'],
})
export class ClientesPosPage {
  protected readonly data = inject(DataService);
  private readonly ubic = inject(UbicacionesService);

  readonly modalOpen = signal(false);
  readonly editing = signal<PosCliente | null>(null);
  readonly confirmOpen = signal(false);
  readonly aEliminar = signal<PosCliente | null>(null);

  readonly query = signal('');
  readonly visibles = computed(() => {
    const q = this.query().trim().toLowerCase();
    const list = this.data.posClientes().filter(c => c.active);
    if (!q) return list;
    return list.filter(c =>
      c.nombre.toLowerCase().includes(q) ||
      c.fiscal.identificacion.toLowerCase().includes(q) ||
      (c.email ?? '').toLowerCase().includes(q));
  });

  tipoIdLabel(t: string): string {
    return ({ '01': 'Física', '02': 'Jurídica', '03': 'DIMEX', '04': 'NITE' } as Record<string, string>)[t] ?? t;
  }

  /** Texto de ubicación legible (provincia / cantón / distrito) si el catálogo está cargado. */
  ubicacionDe(c: PosCliente): string {
    const f = c.fiscal;
    if (!f.provincia) return '';
    const prov = this.ubic.provincias().find(p => p.codigo === f.provincia);
    const cant = prov?.cantones.find(x => x.codigo === f.canton);
    const dist = cant?.distritos.find(x => x.codigo === f.distrito);
    return [prov?.nombre, cant?.nombre, dist?.nombre].filter(Boolean).join(' · ');
  }

  abrirNuevo() { this.editing.set(null); this.modalOpen.set(true); void this.ubic.ensureLoaded(); }
  abrirEditar(c: PosCliente) { this.editing.set(c); this.modalOpen.set(true); void this.ubic.ensureLoaded(); }
  cerrarModal() { this.modalOpen.set(false); this.editing.set(null); }

  pedirEliminar(c: PosCliente) { this.aEliminar.set(c); this.confirmOpen.set(true); }
  eliminar() {
    const c = this.aEliminar();
    if (c) this.data.deletePosCliente(c.id);
    this.confirmOpen.set(false);
    this.aEliminar.set(null);
  }
}
