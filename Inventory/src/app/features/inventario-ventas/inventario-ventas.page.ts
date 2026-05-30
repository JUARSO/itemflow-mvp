import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
  IonButton, IonIcon, IonSearchbar,
} from '@ionic/angular/standalone';
import { DataService } from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';
import { TenantContextService } from '../../core/services/tenant-context.service';
import { ToastService } from '../../shared/components/toast/toast.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { CustomerOrder } from '../../core/models';

@Component({
  selector: 'app-inventario-ventas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe, DatePipe, RouterLink,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
    IonButton, IonIcon, IonSearchbar,
    PageHeaderComponent, KpiCardComponent, StatusBadgeComponent, EmptyStateComponent,
  ],
  templateUrl: './inventario-ventas.page.html',
  styleUrls: ['./inventario-ventas.page.scss'],
})
export class InventarioVentasPage {
  protected readonly data = inject(DataService);
  protected readonly tenant = inject(TenantContextService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly query = signal('');

  /** Recepciones por validar: pedidos de reposición completados, aún sin recibir. */
  readonly recepciones = computed(() =>
    this.data.almacenRequests().filter(o => o.status === 'completed' && !o.deliveredToUrnaAt)
  );

  /** Productos del catálogo (gestionados por Producción) con su stock en el almacén. */
  readonly visibles = computed(() => {
    const q = this.query().toLowerCase();
    const almacenId = this.data.almacenId();
    return this.data.activeProducts()
      .filter(p => !q || p.name.toLowerCase().includes(q) || (p.category ?? '').toLowerCase().includes(q))
      .map(product => ({
        product,
        qty: this.data.urnaProductQty(almacenId, product.id),
        status: this.data.almacenProductStatus(product.id),
        incoming: this.data.almacenIncomingForProduct(product.id),
      }))
      .sort((a, b) => a.product.name.localeCompare(b.product.name));
  });

  readonly totalProductos = computed(() => this.visibles().length);
  readonly unidadesEnAlmacen = computed(() => this.visibles().reduce((s, v) => s + v.qty, 0));
  readonly agotados = computed(() => this.visibles().filter(v => v.status === 'out').length);

  /** Productos con el detalle de "en camino" desplegado. */
  readonly incomingOpen = signal<Set<string>>(new Set());

  toggleIncoming(productId: string) {
    this.incomingOpen.update(s => {
      const n = new Set(s);
      n.has(productId) ? n.delete(productId) : n.add(productId);
      return n;
    });
  }
  isIncomingOpen(productId: string): boolean { return this.incomingOpen().has(productId); }

  /** Detalle de lo que viene en camino para un producto (cantidad, estado, fecha). */
  incomingDetail(productId: string) {
    return this.data.almacenIncomingDetail(productId);
  }

  /** Líneas que llegaron en un pedido (producto + lo producido). */
  itemsRecibidos(o: CustomerOrder) {
    return o.items
      .filter(it => it.fulfilledQty > 0)
      .map(it => ({ name: it.productName, qty: it.fulfilledQty }));
  }

  async validar(order: CustomerOrder) {
    const user = this.auth.user();
    try {
      this.data.deliverOrderToUrna(order.id, user?.uid ?? 'unknown', user?.displayName ?? 'Usuario');
      await this.toast.show(`Recepción validada (${order.code}). Stock sumado al almacén.`, 'success');
    } catch (e: unknown) {
      await this.toast.show(e instanceof Error ? e.message : 'No se pudo validar la recepción.', 'danger');
    }
  }
}
