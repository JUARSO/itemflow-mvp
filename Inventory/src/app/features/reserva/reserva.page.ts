import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
  IonButton, IonIcon,
} from '@ionic/angular/standalone';
import { DataService } from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';
import { TenantContextService } from '../../core/services/tenant-context.service';
import { ToastService } from '../../shared/components/toast/toast.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { SearchBarComponent } from '../../shared/components/search-bar/search-bar.component';
import { ReservaItem } from '../../core/models';

@Component({
  selector: 'app-reserva',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
    IonButton, IonIcon,
    PageHeaderComponent, KpiCardComponent, EmptyStateComponent, SearchBarComponent,
  ],
  templateUrl: './reserva.page.html',
  styleUrls: ['./reserva.page.scss'],
})
export class ReservaPage {
  protected readonly data = inject(DataService);
  protected readonly tenant = inject(TenantContextService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly productos = computed(() => this.data.activeProducts());
  readonly reservas = computed(() => this.data.reservas());

  readonly query = signal('');
  readonly reservasFiltradas = computed(() => {
    const q = this.query().trim().toLowerCase();
    const list = this.reservas();
    if (!q) return list;
    return list.filter(x => x.productName.toLowerCase().includes(q));
  });

  readonly totalUnidades = computed(() => this.reservas().reduce((s, r) => s + r.qty, 0));

  // Formulario de "agregar"
  readonly nuevoProducto = signal<string>('');
  readonly nuevaCantidad = signal<number>(1);
  readonly nuevaNota = signal<string>('');

  private ctx() {
    return { userName: this.auth.user()?.displayName ?? 'Usuario' };
  }

  async agregar() {
    const productId = this.nuevoProducto();
    if (!productId) { await this.toast.show('Elige un producto.', 'danger'); return; }
    try {
      this.data.addReserva({
        productId,
        qty: this.nuevaCantidad(),
        note: this.nuevaNota(),
        userName: this.ctx().userName,
      });
      await this.toast.show('Producto agregado a reserva.', 'success');
      this.nuevoProducto.set('');
      this.nuevaCantidad.set(1);
      this.nuevaNota.set('');
    } catch (e: unknown) {
      await this.toast.show(e instanceof Error ? e.message : 'No se pudo agregar.', 'danger');
    }
  }

  editarQty(r: ReservaItem, qty: number) {
    const q = Math.floor(qty || 0);
    if (q <= 0) { this.data.removeReserva(r.id); return; }
    this.data.updateReserva(r.id, { qty: q });
  }

  editarNota(r: ReservaItem, note: string) {
    this.data.updateReserva(r.id, { note });
  }

  async eliminar(r: ReservaItem) {
    this.data.removeReserva(r.id);
    await this.toast.show(`"${r.productName}" quitado de reserva.`, 'warning');
  }
}
