import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
  IonButton, IonSegment, IonSegmentButton, IonLabel, IonBadge, IonIcon,
} from '@ionic/angular/standalone';
import { DataService } from '../../core/services/data.service';
import { TenantContextService } from '../../core/services/tenant-context.service';
import { AuthService } from '../../core/services/auth.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { ToastService } from '../../shared/components/toast/toast.service';
import { SearchBarComponent } from '../../shared/components/search-bar/search-bar.component';
import { OcFormModalComponent } from './oc-form-modal.component';
import { NotificarProveedorModalComponent } from './notificar-proveedor-modal.component';
import { PurchaseOrder, POStatus } from '../../core/models';

type Filter = 'todas' | POStatus;
type ConfirmAction = 'receive' | 'cancel' | 'delete';

@Component({
  selector: 'app-ordenes-compra',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, DecimalPipe,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
    IonButton, IonSegment, IonSegmentButton, IonLabel, IonBadge, IonIcon,
    PageHeaderComponent, KpiCardComponent, EmptyStateComponent, ConfirmDialogComponent,
    OcFormModalComponent, NotificarProveedorModalComponent, SearchBarComponent,
  ],
  templateUrl: './ordenes-compra.page.html',
  styleUrls: ['./ordenes-compra.page.scss'],
})
export class OrdenesCompraPage {
  protected readonly data = inject(DataService);
  protected readonly tenant = inject(TenantContextService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly filter = signal<Filter>('todas');
  readonly query = signal('');
  /** Rango de fechas (formato 'yyyy-MM-dd' de los inputs nativos), sobre createdAt. */
  readonly dateFrom = signal('');
  readonly dateTo = signal('');
  readonly modalOpen = signal(false);
  readonly confirmOpen = signal(false);
  readonly poAccion = signal<PurchaseOrder | null>(null);
  readonly accion = signal<ConfirmAction>('receive');

  readonly notifOpen = signal(false);
  readonly poNotif = signal<PurchaseOrder | null>(null);

  readonly visibles = computed(() => {
    const f = this.filter();
    const q = this.query().trim().toLowerCase();
    const from = this.parseFrom(this.dateFrom());
    const to = this.parseTo(this.dateTo());
    let all = [...this.data.purchaseOrders()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    if (f !== 'todas') all = all.filter(po => po.status === f);
    if (from !== null) all = all.filter(po => po.createdAt.getTime() >= from);
    if (to !== null) all = all.filter(po => po.createdAt.getTime() <= to);
    if (q) all = all.filter(po =>
      (po.code ?? '').toLowerCase().includes(q) ||
      (po.supplier ?? '').toLowerCase().includes(q) ||
      this.statusLabel(po.status).toLowerCase().includes(q)
    );
    return all;
  });

  statusLabel(s: POStatus): string {
    switch (s) {
      case 'pending': return 'Pendiente';
      case 'received': return 'Recibida';
      case 'cancelled': return 'Cancelada';
      default: return s;
    }
  }

  /** 'yyyy-MM-dd' → inicio del día local (ms). null si vacío. */
  private parseFrom(v: string): number | null {
    if (!v) return null;
    const [y, m, d] = v.split('-').map(Number);
    return new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
  }

  /** 'yyyy-MM-dd' → fin del día local (ms), inclusivo. null si vacío. */
  private parseTo(v: string): number | null {
    if (!v) return null;
    const [y, m, d] = v.split('-').map(Number);
    return new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
  }

  limpiarFechas() {
    this.dateFrom.set('');
    this.dateTo.set('');
  }

  readonly recibidas = computed(() => this.data.purchaseOrders().filter(po => po.status === 'received'));
  readonly canceladas = computed(() => this.data.purchaseOrders().filter(po => po.status === 'cancelled'));

  readonly confirmTitle = computed(() => {
    switch (this.accion()) {
      case 'receive': return 'Marcar OC como recibida';
      case 'cancel': return 'Cancelar orden de compra';
      case 'delete': return 'Eliminar OC';
    }
  });

  readonly confirmMessage = computed(() => {
    const po = this.poAccion();
    if (!po) return '';
    switch (this.accion()) {
      case 'receive': return `Confirmar recepción de ${po.code}. Se generarán entradas de kardex automáticamente para cada insumo de la OC.`;
      case 'cancel': return `La OC ${po.code} pasará a estado "Cancelada" y no se generará stock. Esta acción es reversible solo recreando la OC.`;
      case 'delete': return `Eliminar permanentemente la OC ${po.code}. Las entradas de kardex ya generadas (si la OC fue recibida) se mantienen.`;
    }
  });

  readonly confirmTone = computed<'danger' | 'warning' | 'info'>(() =>
    this.accion() === 'receive' ? 'info' : 'danger'
  );

  readonly confirmCta = computed(() => {
    switch (this.accion()) {
      case 'receive': return 'Sí, marcar recibida';
      case 'cancel': return 'Sí, cancelar';
      case 'delete': return 'Sí, eliminar';
    }
  });

  isOverdue(d: Date): boolean { return d.getTime() < Date.now(); }

  /** Estado de entrega de una OC pendiente según su fecha esperada. */
  entregaEstado(d: Date): { label: string; color: string } {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const dd = new Date(d); dd.setHours(0, 0, 0, 0);
    const dias = Math.round((dd.getTime() - hoy.getTime()) / 86_400_000);
    if (dias < 0) return { label: `Atrasada ${-dias}d`, color: 'danger' };
    if (dias === 0) return { label: 'Llega hoy', color: 'warning' };
    if (dias === 1) return { label: 'Llega mañana', color: 'transit' };
    return { label: `En ${dias} días`, color: 'transit' };
  }

  pedirAccion(po: PurchaseOrder, accion: ConfirmAction) {
    this.poAccion.set(po);
    this.accion.set(accion);
    this.confirmOpen.set(true);
  }

  notificar(po: PurchaseOrder) {
    this.poNotif.set(po);
    this.notifOpen.set(true);
  }

  async ejecutarAccion() {
    const po = this.poAccion();
    if (!po) return;
    const user = this.auth.user();
    const userName = user?.displayName ?? 'Usuario';
    const userId = user?.uid ?? 'unknown';

    switch (this.accion()) {
      case 'receive':
        this.data.updatePurchaseOrderStatus(po.id, 'received', userName, userId);
        await this.toast.show(`OC ${po.code} marcada como recibida. Kardex actualizado.`);
        break;
      case 'cancel':
        this.data.updatePurchaseOrderStatus(po.id, 'cancelled', userName, userId);
        await this.toast.show(`OC ${po.code} cancelada.`, 'warning');
        break;
      case 'delete':
        this.data.deletePurchaseOrder(po.id);
        await this.toast.show(`OC ${po.code} eliminada.`, 'success');
        break;
    }
    this.confirmOpen.set(false);
    this.poAccion.set(null);
  }
}
