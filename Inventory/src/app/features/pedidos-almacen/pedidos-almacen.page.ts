import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
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
  selector: 'app-pedidos-almacen',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
    IonButton, IonIcon, IonBadge,
    PageHeaderComponent, KpiCardComponent, EmptyStateComponent,
  ],
  templateUrl: './pedidos-almacen.page.html',
  styleUrls: ['./pedidos-almacen.page.scss'],
})
export class PedidosAlmacenPage {
  protected readonly data = inject(DataService);
  protected readonly tenant = inject(TenantContextService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  /** Cola unificada: pedidos de almacén + pedidos de cliente corroborados. */
  readonly requests = computed(() => this.data.produccionQueue());

  readonly porProducir = computed(() => this.requests().filter(o => o.status === 'pending').length);
  readonly enProduccion = computed(() => this.requests().filter(o => o.status === 'in_production').length);
  readonly listas = computed(() =>
    this.requests().filter(o => o.status === 'completed').length
  );

  /** Etiqueta de destino del pedido: almacén o cliente. */
  destino(o: CustomerOrder): string {
    if (o.urnaId) return `Almacén · ${o.urnaName ?? ''}`.trim();
    if (o.customerId) return `Cliente · ${this.data.customerById(o.customerId)?.name ?? ''}`.trim();
    return o.purpose ?? 'Interno';
  }

  esCliente(o: CustomerOrder): boolean { return !!o.customerId; }

  private ctx() {
    const u = this.auth.user();
    return { userId: u?.uid ?? 'unknown', userName: u?.displayName ?? 'Usuario' };
  }

  async iniciar(o: CustomerOrder) {
    try {
      const r = this.data.startProduction(o.id, this.ctx().userId, this.ctx().userName);
      const faltantes = r.shortfalls.length;
      await this.toast.show(
        faltantes > 0
          ? `Producción iniciada para ${o.code} (con ${faltantes} faltante/s de insumo).`
          : `Producción iniciada para ${o.code}.`,
        faltantes > 0 ? 'warning' : 'success',
      );
    } catch (e: unknown) {
      await this.toast.show(e instanceof Error ? e.message : 'No se pudo iniciar.', 'danger');
    }
  }

  async completar(o: CustomerOrder) {
    try {
      this.data.completeOrder(o.id, this.ctx().userId, this.ctx().userName);
      const quien = o.urnaId ? 'Ventas debe validar la recepción' : 'Ventas debe despachar el pedido';
      await this.toast.show(`${o.code} marcado como listo. ${quien}.`, 'success');
    } catch (e: unknown) {
      await this.toast.show(e instanceof Error ? e.message : 'No se pudo completar.', 'danger');
    }
  }

  statusLabel(o: CustomerOrder): string {
    switch (o.status) {
      case 'pending': return 'Por producir';
      case 'in_production': return 'En producción';
      case 'completed': return o.urnaId ? 'Listo (esperando recepción)' : 'Listo (esperando despacho)';
      default: return o.status;
    }
  }

  statusColor(o: CustomerOrder): string {
    switch (o.status) {
      case 'pending': return 'warning';
      case 'in_production': return 'primary';
      case 'completed': return 'transit';
      default: return 'medium';
    }
  }
}
