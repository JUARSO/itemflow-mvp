import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
  IonButton, IonIcon, IonBadge, IonSegment, IonSegmentButton, IonLabel,
} from '@ionic/angular/standalone';
import { DataService } from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';
import { TenantContextService } from '../../core/services/tenant-context.service';
import { ToastService } from '../../shared/components/toast/toast.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { CustomerOrder, OrderItem } from '../../core/models';

type Tab = 'facturar' | 'historial';

@Component({
  selector: 'app-facturar-pedidos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe, DatePipe,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
    IonButton, IonIcon, IonBadge, IonSegment, IonSegmentButton, IonLabel,
    PageHeaderComponent, KpiCardComponent, EmptyStateComponent,
  ],
  templateUrl: './facturar-pedidos.page.html',
  styleUrls: ['./facturar-pedidos.page.scss'],
})
export class FacturarPedidosPage {
  protected readonly data = inject(DataService);
  protected readonly tenant = inject(TenantContextService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly tab = signal<Tab>('facturar');

  readonly porFacturar = computed(() => this.data.pedidosPorFacturar());
  readonly historial = computed(() => this.data.pedidosFacturados());

  /** Cantidad entregada editada por (orderId:productId). */
  readonly entregado = signal<Record<string, number>>({});

  clienteNombre(o: CustomerOrder): string {
    return o.customerId ? (this.data.customerById(o.customerId)?.name ?? 'Cliente') : '—';
  }

  private key(orderId: string, productId: string): string { return `${orderId}:${productId}`; }

  /** Lo entregado de un item (default = lo despachado = fulfilledQty). */
  entregadoDe(o: CustomerOrder, it: OrderItem): number {
    const v = this.entregado()[this.key(o.id, it.productId)];
    return v === undefined ? it.fulfilledQty : Math.min(v, it.fulfilledQty);
  }
  setEntregado(o: CustomerOrder, it: OrderItem, qty: number) {
    const v = Math.max(0, Math.min(Math.floor(qty || 0), it.fulfilledQty));
    this.entregado.update(m => ({ ...m, [this.key(o.id, it.productId)]: v }));
  }
  mermaDe(o: CustomerOrder, it: OrderItem): number {
    return it.fulfilledQty - this.entregadoDe(o, it);
  }

  totalFacturar(o: CustomerOrder): number {
    return o.items.reduce((s, it) => s + this.entregadoDe(o, it) * it.unitPrice, 0);
  }
  totalMerma(o: CustomerOrder): number {
    return o.items.reduce((s, it) => s + this.mermaDe(o, it), 0);
  }

  /** Items facturados (historial): entregado vs faltante. */
  itemsFacturados(o: CustomerOrder) {
    return o.items.map(it => ({
      name: it.productName,
      recibido: it.receivedQty ?? it.fulfilledQty,
      merma: it.fulfilledQty - (it.receivedQty ?? it.fulfilledQty),
      total: (it.receivedQty ?? it.fulfilledQty) * it.unitPrice,
    }));
  }

  async facturar(o: CustomerOrder) {
    const u = this.auth.user();
    const lines = o.items.map(it => ({ productId: it.productId, deliveredQty: this.entregadoDe(o, it) }));
    try {
      const r = this.data.invoiceOrder(o.id, lines, u?.uid ?? 'unknown', u?.displayName ?? 'Usuario');
      const merma = this.totalMerma(o);
      await this.toast.show(
        merma > 0
          ? `Pedido ${o.code} facturado — ₡${(r.finalAmount ?? 0).toLocaleString('es-CR')} (${merma} u a merma).`
          : `Pedido ${o.code} facturado — ₡${(r.finalAmount ?? 0).toLocaleString('es-CR')}.`,
        'success',
      );
    } catch (e: unknown) {
      await this.toast.show(e instanceof Error ? e.message : 'No se pudo facturar.', 'danger');
    }
  }
}
