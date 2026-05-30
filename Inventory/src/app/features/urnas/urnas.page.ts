import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
  IonButton, IonIcon, IonBadge,
} from '@ionic/angular/standalone';
import { DataService } from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';
import { TenantContextService } from '../../core/services/tenant-context.service';
import { ToastService } from '../../shared/components/toast/toast.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { CustomerOrder } from '../../core/models';

@Component({
  selector: 'app-urnas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe, DatePipe, RouterLink,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
    IonButton, IonIcon, IonBadge,
    PageHeaderComponent, KpiCardComponent, EmptyStateComponent,
  ],
  templateUrl: './urnas.page.html',
  styleUrls: ['./urnas.page.scss'],
})
export class UrnasPage {
  protected readonly data = inject(DataService);
  protected readonly tenant = inject(TenantContextService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly almacen = computed(() => this.data.almacen());
  readonly almacenId = computed(() => this.data.almacenId());

  /** Totales por producto (sumando todos los lotes). */
  readonly stockLines = computed(() =>
    this.data.urnaProductTotals(this.almacenId())
      .map(s => ({ ...s, product: this.data.productById(s.productId) }))
  );

  /** Lotes (tandas) recibidos, recientes primero. */
  readonly lotes = computed(() => this.data.urnaLotesFor(this.almacenId()));

  readonly unidades = computed(() =>
    this.data.urnaProductTotals(this.almacenId()).reduce((s, l) => s + l.quantity, 0)
  );

  /** Solicitudes de reposición del almacén. */
  readonly solicitudes = computed(() => this.data.urnaOrders(this.almacenId()));
  readonly solicitudesPendientes = computed(() =>
    this.solicitudes().filter(o => o.status !== 'cancelled' && !o.deliveredToUrnaAt).length
  );

  /** Pedidos desplegados (para ver su detalle). */
  readonly expanded = signal<Set<string>>(new Set());

  toggle(id: string) {
    this.expanded.update(s => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }
  isExpanded(id: string): boolean { return this.expanded().has(id); }

  /**
   * Detalle por producto de un pedido: cuánto se pidió, cuánto llegó
   * (lo producido/entregado) y cuánto queda hoy en el almacén.
   */
  itemsDetalle(o: CustomerOrder) {
    const almacenId = this.almacenId();
    return o.items.map(it => ({
      name: it.productName,
      pedido: it.qty,
      llego: it.fulfilledQty,
      enAlmacen: this.data.urnaProductQty(almacenId, it.productId),
    }));
  }

  /** Recibe en el almacén lo que producción ya completó (crea un lote FIFO). */
  async recibir(order: CustomerOrder) {
    const user = this.auth.user();
    try {
      this.data.deliverOrderToUrna(order.id, user?.uid ?? 'unknown', user?.displayName ?? 'Usuario');
      await this.toast.show(`Recepción registrada en almacén (${order.code}).`, 'success');
    } catch (e: unknown) {
      await this.toast.show(e instanceof Error ? e.message : 'No se pudo recibir.', 'danger');
    }
  }

  statusLabel(o: CustomerOrder): string {
    if (o.deliveredToUrnaAt) return 'Recibido ✓';
    switch (o.status) {
      case 'pending': return 'Pendiente — sin tomar';
      case 'in_production': return 'Tomado · en fabricación';
      case 'completed': return 'Listo para recibir';
      case 'cancelled': return 'Cancelada';
    }
  }

  statusColor(o: CustomerOrder): string {
    if (o.deliveredToUrnaAt) return 'success';
    switch (o.status) {
      case 'pending': return 'medium';
      case 'in_production': return 'primary';
      case 'completed': return 'transit';
      case 'cancelled': return 'danger';
    }
  }

  /** ¿El pedido ya fue tomado por producción? */
  fueTomado(o: CustomerOrder): boolean {
    return o.status === 'in_production' || o.status === 'completed' || !!o.deliveredToUrnaAt;
  }
}
