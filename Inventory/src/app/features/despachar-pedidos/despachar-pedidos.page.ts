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
import { CustomerOrder } from '../../core/models';

@Component({
  selector: 'app-despachar-pedidos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
    IonButton, IonIcon,
    PageHeaderComponent, KpiCardComponent, EmptyStateComponent,
    SearchBarComponent,
  ],
  templateUrl: './despachar-pedidos.page.html',
  styleUrls: ['./despachar-pedidos.page.scss'],
})
export class DespacharPedidosPage {
  protected readonly data = inject(DataService);
  protected readonly tenant = inject(TenantContextService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly query = signal('');

  /** Pedidos de cliente ya producidos, esperando despacho. */
  readonly pedidos = computed(() => this.data.pedidosPorDespachar());

  readonly pedidosFiltrados = computed(() => {
    const q = this.query().trim().toLowerCase();
    const list = this.pedidos();
    if (!q) return list;
    return list.filter(o => (o.code ?? '').toLowerCase().includes(q) || (this.data.customerById(o.customerId ?? '')?.name ?? '').toLowerCase().includes(q));
  });

  readonly totalUnidades = computed(() =>
    this.pedidos().reduce((s, o) => s + o.items.reduce((q, it) => q + it.fulfilledQty, 0), 0)
  );

  clienteNombre(o: CustomerOrder): string {
    return o.customerId ? (this.data.customerById(o.customerId ?? '')?.name ?? 'Cliente') : '—';
  }

  /** Líneas listas para despachar (lo producido). */
  itemsListos(o: CustomerOrder) {
    return o.items
      .filter(it => it.fulfilledQty > 0)
      .map(it => ({ name: it.productName, qty: it.fulfilledQty, pedido: it.qty }));
  }

  async despachar(o: CustomerOrder) {
    const u = this.auth.user();
    try {
      this.data.dispatchOrder(o.id, u?.uid ?? 'unknown', u?.displayName ?? 'Usuario');
      await this.toast.show(`Pedido ${o.code} despachado a ${this.clienteNombre(o)}.`, 'success');
    } catch (e: unknown) {
      await this.toast.show(e instanceof Error ? e.message : 'No se pudo despachar.', 'danger');
    }
  }
}
