import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { FormModalComponent } from '../../shared/components/form-modal/form-modal.component';
import { CustomerOrder, OrderShortfall, OrderStatus } from '../../core/models';
import { DataService } from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';
import { TenantContextService } from '../../core/services/tenant-context.service';
import { ToastService } from '../../shared/components/toast/toast.service';

/**
 * Modal que muestra el detalle completo de una orden de fabricación y las
 * acciones disponibles (iniciar, completar, cancelar) según el rol.
 */
@Component({
  selector: 'app-pedido-detail-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe, IonButton, IonIcon, FormModalComponent],
  templateUrl: './pedido-detail-modal.component.html',
  styleUrls: ['./pedido-detail-modal.component.scss'],
})
export class PedidoDetailModalComponent {
  protected readonly data = inject(DataService);
  protected readonly tenant = inject(TenantContextService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly isOpen = input.required<boolean>();
  readonly order = input<CustomerOrder | null>(null);
  readonly closed = output<void>();
  readonly mutated = output<void>();

  /** Preview de análisis si el pedido aún está pendiente. */
  readonly analysis = computed(() => {
    const o = this.order();
    if (!o) return null;
    if (o.status === 'pending') {
      return this.data.analyzeOrder(o.items);
    }
    return { shortfalls: o.shortfalls, itemAnalysis: [] };
  });

  customerName(o: CustomerOrder): string | null {
    if (!o.customerId) return null;
    return this.data.customerById(o.customerId)?.name ?? null;
  }

  statusLabel(s: OrderStatus): string {
    return {
      pending: 'Pendiente',
      in_production: 'En producción',
      completed: 'Completada',
      cancelled: 'Cancelada',
    }[s];
  }

  async onStart(o: CustomerOrder) {
    try {
      const u = this.auth.user();
      const updated = this.data.startProduction(o.id, u?.uid ?? 'unknown', u?.displayName ?? 'Usuario');
      const totalReq = updated.items.reduce((s, it) => s + it.qty, 0);
      const totalDone = updated.items.reduce((s, it) => s + it.fulfilledQty, 0);
      if (totalDone === 0) {
        await this.toast.show('No hay insumos suficientes para fabricar nada de la orden.', 'danger');
      } else if (totalDone < totalReq) {
        await this.toast.show(`Producción iniciada (parcial: ${totalDone}/${totalReq}).`, 'warning');
      } else {
        await this.toast.show('Producción iniciada — insumos descontados.');
      }
      this.mutated.emit();
    } catch (e: unknown) {
      await this.toast.show(e instanceof Error ? e.message : 'Error.', 'danger');
    }
  }

  async onComplete(o: CustomerOrder) {
    try {
      const u = this.auth.user();
      this.data.completeOrder(o.id, u?.uid ?? 'unknown', u?.displayName ?? 'Usuario');
      await this.toast.show('Orden completada — stock de producto terminado actualizado.');
      this.mutated.emit();
    } catch (e: unknown) {
      await this.toast.show(e instanceof Error ? e.message : 'Error.', 'danger');
    }
  }

  async onCancel(o: CustomerOrder) {
    const ok = confirm(`¿Cancelar orden ${o.code}? Si había insumos reservados, se devolverán al inventario.`);
    if (!ok) return;
    try {
      const u = this.auth.user();
      this.data.cancelOrder(o.id, u?.uid ?? 'unknown', u?.displayName ?? 'Usuario');
      await this.toast.show('Orden cancelada.');
      this.mutated.emit();
    } catch (e: unknown) {
      await this.toast.show(e instanceof Error ? e.message : 'Error.', 'danger');
    }
  }
}
