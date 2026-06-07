import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
  IonButton, IonIcon, IonBadge,
} from '@ionic/angular/standalone';
import { DataService } from '../../core/services/data.service';
import { ToastService } from '../../shared/components/toast/toast.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { ProveedorFormModalComponent } from './proveedor-form-modal.component';
import { SearchBarComponent } from '../../shared/components/search-bar/search-bar.component';
import { Supplier } from '../../core/models';

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] as const;

/**
 * Gestión de proveedores: CRUD con datos de contacto, lead time y ventanas
 * semanales. Incluye un indicador "Hoy se puede pedir" derivado de los
 * orderDays del proveedor.
 */
@Component({
  selector: 'app-proveedores',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
    IonButton, IonIcon, IonBadge,
    PageHeaderComponent, KpiCardComponent, ProveedorFormModalComponent,
    SearchBarComponent,
  ],
  templateUrl: './proveedores.page.html',
  styleUrls: ['./proveedores.page.scss'],
})
export class ProveedoresPage {
  protected readonly data = inject(DataService);
  private readonly toast = inject(ToastService);

  readonly modalOpen = signal(false);
  readonly editing = signal<Supplier | null>(null);

  readonly query = signal('');
  readonly suppliersFiltrados = computed(() => {
    const q = this.query().trim().toLowerCase();
    const list = this.data.suppliers();
    if (!q) return list;
    return list.filter(x =>
      x.name.toLowerCase().includes(q) ||
      (x.contactPerson ?? '').toLowerCase().includes(q) ||
      (x.email ?? '').toLowerCase().includes(q) ||
      (x.phone ?? '').toLowerCase().includes(q)
    );
  });

  protected readonly weekDays = [1, 2, 3, 4, 5, 6, 0];

  readonly canOrderTodayCount = computed(() =>
    this.data.activeSuppliers().filter(s => this.data.canOrderToSupplierToday(s.id)).length
  );

  readonly todayLabel = computed(() => `Hoy: ${DAY_LABELS[new Date().getDay()]}`);

  dayLabel(d: number): string { return DAY_LABELS[d]; }

  /**
   * Lead time dinámico del proveedor evaluado HOY (próxima ventana de pedido
   * → próxima entrega según calendario semanal). null si no se pudo calcular.
   */
  dynLt(supplierId: string) {
    return this.data.supplierLeadTime(supplierId);
  }

  itemName(kind: 'supply' | 'product', itemId: string): string {
    if (kind === 'supply') return this.data.supplyById(itemId)?.name ?? '—';
    return this.data.productById(itemId)?.name ?? '—';
  }

  abrirNuevo() { this.editing.set(null); this.modalOpen.set(true); }
  abrirEditar(s: Supplier) { this.editing.set(s); this.modalOpen.set(true); }
  cerrarModal() { this.modalOpen.set(false); this.editing.set(null); }

  async eliminar(s: Supplier) {
    if (!confirm(`¿Eliminar el proveedor "${s.name}"?`)) return;
    try {
      await this.data.deleteSupplier(s.id);
      await this.toast.show(`Proveedor "${s.name}" eliminado.`);
    } catch (e: unknown) {
      await this.toast.show(e instanceof Error ? e.message : 'No se pudo eliminar el proveedor.', 'danger');
    }
  }
}
