import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
  IonButton, IonIcon, IonBadge,
} from '@ionic/angular/standalone';
import { DataService } from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../shared/components/toast/toast.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { ClienteFormModalComponent } from './cliente-form-modal.component';
import { RecurringOrderFormModalComponent } from './recurring-order-form-modal.component';
import { Customer, CustomerOrder, RecurringOrder } from '../../core/models';

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] as const;

@Component({
  selector: 'app-clientes',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, DecimalPipe,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
    IonButton, IonIcon, IonBadge,
    PageHeaderComponent, KpiCardComponent, ClienteFormModalComponent,
    RecurringOrderFormModalComponent,
  ],
  templateUrl: './clientes.page.html',
  styleUrls: ['./clientes.page.scss'],
})
export class ClientesPage {
  protected readonly data = inject(DataService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly modalOpen = signal(false);
  readonly editing = signal<Customer | null>(null);
  /** ID del cliente cuyo catálogo permitido está expandido (uno a la vez). */
  readonly expanded = signal<string | null>(null);

  // ----- Pedido recurrente -----
  readonly recurringOpen = signal(false);
  readonly recurringCustomer = signal<Customer | null>(null);

  // ----- Pedidos del cliente: pendientes + último -----

  /** Pedidos en proceso del cliente (no despachados ni cancelados), recientes primero. */
  pendientesDe(c: Customer): CustomerOrder[] {
    return this.data.orders()
      .filter(o => o.customerId === c.id && !o.dispatchedAt && o.status !== 'cancelled')
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /** Último pedido realizado por el cliente (por fecha de creación). */
  ultimoPedidoDe(c: Customer): CustomerOrder | null {
    const list = this.data.orders()
      .filter(o => o.customerId === c.id)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return list[0] ?? null;
  }

  estadoLabel(o: CustomerOrder): string {
    if (o.dispatchedAt) return 'Despachado';
    if (o.deliveredToUrnaAt) return 'Recibido';
    switch (o.status) {
      case 'pending': return o.acceptedBySalesAt ? 'En producción' : 'Recibido';
      case 'in_production': return 'En producción';
      case 'completed': return 'Listo para despachar';
      case 'cancelled': return 'Cancelado';
    }
  }

  estadoColor(o: CustomerOrder): string {
    if (o.dispatchedAt) return 'success';
    switch (o.status) {
      case 'pending': return o.acceptedBySalesAt ? 'primary' : 'warning';
      case 'in_production': return 'primary';
      case 'completed': return 'transit';
      case 'cancelled': return 'danger';
    }
  }

  // ----- Pedidos recurrentes -----

  recurrentesDe(c: Customer): RecurringOrder[] {
    return this.data.recurringOrdersFor(c.id);
  }

  productName(productId: string): string {
    return this.data.productById(productId)?.name ?? productId;
  }

  recurrenteDias(ro: RecurringOrder): string {
    return ro.weekdays.map(d => DAY_LABELS[d]).join(' · ');
  }

  abrirRecurrente(c: Customer) {
    this.recurringCustomer.set(c);
    this.recurringOpen.set(true);
  }
  cerrarRecurrente() {
    this.recurringOpen.set(false);
    this.recurringCustomer.set(null);
  }

  async generarRecurrente(ro: RecurringOrder) {
    const u = this.auth.user();
    try {
      const order = this.data.generateRecurringOrder(ro.id, u?.uid ?? 'unknown', u?.displayName ?? 'Usuario');
      await this.toast.show(`Pedido ${order.code} generado desde la plantilla.`, 'success');
    } catch (e: unknown) {
      await this.toast.show(e instanceof Error ? e.message : 'No se pudo generar.', 'danger');
    }
  }

  async eliminarRecurrente(ro: RecurringOrder) {
    if (!confirm('¿Eliminar este pedido recurrente?')) return;
    this.data.deleteRecurringOrder(ro.id);
    await this.toast.show('Pedido recurrente eliminado.');
  }

  protected readonly weekDays = [1, 2, 3, 4, 5, 6, 0]; // lun→dom

  readonly pedidosDesdeClientes = computed(() =>
    this.data.orders().filter(o => !!o.customerId).length
  );

  dayLabel(d: number): string {
    return DAY_LABELS[d];
  }

  /**
   * Productos que el cliente puede pedir. Si `allowedProductIds` está vacío,
   * tiene acceso a todo el catálogo activo; sino, solo a los ids permitidos.
   */
  allowedProductsOf(c: Customer) {
    const all = this.data.activeProducts();
    if (c.allowedProductIds.length === 0) return all;
    const set = new Set(c.allowedProductIds);
    return all.filter(p => set.has(p.id));
  }

  toggleProducts(customerId: string) {
    this.expanded.update(cur => cur === customerId ? null : customerId);
  }

  /**
   * URL absoluta del portal del cliente.
   * Usa `document.baseURI` que ya respeta el `<base href>` configurado:
   *  - local: http://localhost:4200/c/{token}
   *  - GitHub Pages: https://juarso.github.io/itemflow-mvp/c/{token}
   * Las rutas SPA funcionan porque el workflow copia index.html → 404.html.
   */
  portalUrl(c: Customer): string {
    if (typeof document === 'undefined') return `/c/${c.publicToken}`;
    const base = document.baseURI.replace(/\/$/, '');
    return `${base}/c/${c.publicToken}`;
  }

  abrirNuevo() {
    this.editing.set(null);
    this.modalOpen.set(true);
  }

  abrirEditar(c: Customer) {
    this.editing.set(c);
    this.modalOpen.set(true);
  }

  cerrarModal() {
    this.modalOpen.set(false);
    this.editing.set(null);
  }

  async copyLink(c: Customer) {
    const url = this.portalUrl(c);
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        await this.toast.show('Link copiado al portapapeles.');
      }
    } catch {
      await this.toast.show('No se pudo copiar el link.', 'danger');
    }
  }

  async regenerarPin(c: Customer) {
    if (!confirm(`¿Generar un nuevo PIN para ${c.name}? El PIN anterior dejará de funcionar.`)) return;
    const newPin = this.data.regenerateCustomerPin(c.id);
    if (newPin) await this.toast.show(`Nuevo PIN: ${newPin}`);
  }

  async eliminar(c: Customer) {
    if (!confirm(`¿Eliminar el cliente "${c.name}"? El link y el PIN dejarán de funcionar.`)) return;
    this.data.deleteCustomer(c.id);
    await this.toast.show(`Cliente "${c.name}" eliminado.`);
  }
}
