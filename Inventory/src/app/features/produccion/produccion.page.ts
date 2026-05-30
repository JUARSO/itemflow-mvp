import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
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
import { CustomerOrder } from '../../core/models';

@Component({
  selector: 'app-produccion',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
    IonButton, IonIcon,
    PageHeaderComponent, KpiCardComponent, EmptyStateComponent,
  ],
  templateUrl: './produccion.page.html',
  styleUrls: ['./produccion.page.scss'],
})
export class ProduccionPage {
  protected readonly data = inject(DataService);
  protected readonly tenant = inject(TenantContextService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  /** Pedidos de cliente recibidos, esperando corroboración de Ventas. */
  readonly recibidos = computed(() => this.data.pedidosRecibidos());

  readonly totalUnidades = computed(() =>
    this.recibidos().reduce((s, o) => s + o.items.reduce((q, it) => q + it.qty, 0), 0)
  );

  clienteNombre(o: CustomerOrder): string {
    return o.customerId ? (this.data.customerById(o.customerId)?.name ?? 'Cliente') : '—';
  }

  private ctx() {
    const u = this.auth.user();
    return { userId: u?.uid ?? 'unknown', userName: u?.displayName ?? 'Usuario' };
  }

  async aceptar(o: CustomerOrder) {
    try {
      this.data.corroborateOrder(o.id);
      await this.toast.show(`Pedido ${o.code} corroborado y enviado a producción.`, 'success');
    } catch (e: unknown) {
      await this.toast.show(e instanceof Error ? e.message : 'No se pudo corroborar.', 'danger');
    }
  }

  async cancelar(o: CustomerOrder) {
    try {
      this.data.cancelOrder(o.id, this.ctx().userId, this.ctx().userName);
      await this.toast.show(`Pedido ${o.code} cancelado.`, 'warning');
    } catch (e: unknown) {
      await this.toast.show(e instanceof Error ? e.message : 'No se pudo cancelar.', 'danger');
    }
  }
}
