import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import {
  IonContent, IonButton, IonIcon, IonBadge,
} from '@ionic/angular/standalone';
import { DataService } from '../../core/services/data.service';
import { TenantContextService } from '../../core/services/tenant-context.service';
import { ToastService } from '../../shared/components/toast/toast.service';
import { Customer, CustomerOrder, OrderItem } from '../../core/models';

const DAY_LABELS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'] as const;

interface CartLine { productId: string; qty: number; }

/**
 * Portal externo del cliente. Acceso por URL pública `/c/:token` + PIN.
 *
 * Secciones:
 *  - Crear pedido (catálogo permitido + carrito + fecha de entrega)
 *  - Pedidos por recibir: pedidos producidos que esperan confirmación
 *    del cliente (confirmar todo OK o reportar diferencias por producto)
 *  - Historial: pedidos confirmados, cancelados y en curso. Muestra
 *    cantidades solicitadas vs entregadas vs recibidas y el monto final.
 */
@Component({
  selector: 'app-portal-cliente',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, DatePipe, DecimalPipe,
    IonContent, IonButton, IonIcon, IonBadge,
  ],
  templateUrl: './portal-cliente.page.html',
  styleUrls: ['./portal-cliente.page.scss'],
})
export class PortalClientePage {
  private readonly data = inject(DataService);
  private readonly tenant = inject(TenantContextService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);

  protected readonly company = computed(() => this.tenant.company());

  readonly pinInput = signal('');
  readonly authenticated = signal(false);
  readonly pinError = signal(false);
  readonly cart = signal<CartLine[]>([]);
  readonly deliveryDate = signal('');

  /** Pedido en edición de recepción (orderId) y borrador de cantidades. */
  readonly editingId = signal<string | null>(null);
  readonly receiptDraft = signal<Record<string, number>>({});
  readonly noteDraft = signal('');

  /** Filtros del historial. */
  readonly histFrom = signal('');
  readonly histTo = signal('');
  readonly histStatus = signal<'all' | 'pending' | 'in_production' | 'received' | 'cancelled'>('all');

  readonly customer = computed<Customer | null>(() => {
    const token = this.route.snapshot.paramMap.get('token') ?? '';
    return this.data.customerByToken(token) ?? null;
  });

  readonly productos = computed(() => {
    const c = this.customer();
    if (!c) return [];
    return this.data.customerProducts(c.id);
  });

  /** Precio del producto para el cliente actual (custom o global). */
  precioProducto(productId: string): number {
    return this.data.priceForCustomer(this.customer(), productId);
  }

  readonly canOrderToday = computed(() => {
    const c = this.customer();
    if (!c) return false;
    return this.data.canCustomerOrderToday(c.id);
  });

  readonly today = computed(() => DAY_LABELS[new Date().getDay()]);

  readonly orderDaysLabel = computed(() => {
    const c = this.customer();
    if (!c) return '';
    return c.window.orderDays.map(d => DAY_LABELS[d]).join(', ');
  });

  readonly nextDeliveryDates = computed(() => {
    const c = this.customer();
    if (!c) return [];
    const allowed = new Set(c.window.deliveryDays);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dates: { iso: string; label: string }[] = [];
    for (let i = 1; i <= 30 && dates.length < 10; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      if (allowed.size === 0 || allowed.has(d.getDay())) {
        const iso = d.toISOString().slice(0, 10);
        const label = `${DAY_LABELS[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
        dates.push({ iso, label });
      }
    }
    return dates;
  });

  readonly cartDetail = computed(() => {
    const c = this.customer();
    return this.cart().map(l => {
      const p = this.data.productById(l.productId);
      const price = this.data.priceForCustomer(c, l.productId);
      return {
        productId: l.productId,
        name: p?.name ?? '?',
        qty: l.qty,
        unitPrice: price,
        subtotal: price * l.qty,
      };
    });
  });

  readonly totalCart = computed(() => this.cartDetail().reduce((s, l) => s + l.subtotal, 0));

  /** Todos los pedidos del cliente, más recientes primero. */
  readonly misPedidos = computed(() => {
    const c = this.customer();
    if (!c) return [];
    return this.data.orders()
      .filter(o => o.customerId === c.id)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  });

  /** Pedidos producidos y esperando confirmación del cliente. */
  readonly porRecibir = computed(() =>
    this.misPedidos().filter(o => o.status === 'completed' && !o.customerConfirmedAt)
  );

  /** Historial: todos los pedidos menos los que están "por recibir". */
  readonly historial = computed(() =>
    this.misPedidos().filter(o => !(o.status === 'completed' && !o.customerConfirmedAt))
  );

  /** Historial filtrado por rango de fechas y estado. */
  readonly historialFiltrado = computed(() => {
    const from = this.parseDateStart(this.histFrom());
    const to = this.parseDateEnd(this.histTo());
    const st = this.histStatus();

    return this.historial().filter(o => {
      const ref = o.createdAt.getTime();
      if (from !== null && ref < from) return false;
      if (to !== null && ref > to) return false;
      if (st !== 'all') {
        if (st === 'received') {
          if (!o.customerConfirmedAt) return false;
        } else {
          // pending / in_production / cancelled: comparar status directo,
          // pero excluir los ya recibidos (que pueden ser completed).
          if (o.customerConfirmedAt) return false;
          if (o.status !== st) return false;
        }
      }
      return true;
    });
  });

  readonly hasHistoryFilters = computed(() =>
    !!this.histFrom() || !!this.histTo() || this.histStatus() !== 'all'
  );

  clearHistoryFilters() {
    this.histFrom.set('');
    this.histTo.set('');
    this.histStatus.set('all');
  }

  private parseDateStart(s: string): number | null {
    if (!s) return null;
    const d = new Date(s + 'T00:00:00');
    return isNaN(d.getTime()) ? null : d.getTime();
  }

  private parseDateEnd(s: string): number | null {
    if (!s) return null;
    const d = new Date(s + 'T23:59:59.999');
    return isNaN(d.getTime()) ? null : d.getTime();
  }

  async validatePin() {
    const c = this.customer();
    if (!c) return;
    if (this.data.validateCustomerPin(c.id, this.pinInput())) {
      this.authenticated.set(true);
      this.pinError.set(false);
    } else {
      this.pinError.set(true);
    }
  }

  logout() {
    this.authenticated.set(false);
    this.pinInput.set('');
    this.cart.set([]);
    this.cancelEdit();
  }

  addToCart(productId: string) {
    if (!this.canOrderToday()) return;
    this.cart.update(lines => {
      const found = lines.find(l => l.productId === productId);
      if (found) return lines.map(l => l.productId === productId ? { ...l, qty: l.qty + 1 } : l);
      return [...lines, { productId, qty: 1 }];
    });
  }

  incQty(productId: string) {
    this.cart.update(lines => lines.map(l => l.productId === productId ? { ...l, qty: l.qty + 1 } : l));
  }
  decQty(productId: string) {
    this.cart.update(lines => lines.map(l => l.productId === productId ? { ...l, qty: Math.max(1, l.qty - 1) } : l));
  }
  removeFromCart(productId: string) {
    this.cart.update(lines => lines.filter(l => l.productId !== productId));
  }

  async submitOrder() {
    const c = this.customer();
    if (!c) return;
    if (!this.canOrderToday()) {
      await this.toast.show('Hoy no es día de pedidos según tu configuración.', 'danger');
      return;
    }
    if (!this.deliveryDate()) {
      await this.toast.show('Selecciona una fecha de entrega.', 'danger');
      return;
    }
    const lines = this.cart();
    if (lines.length === 0) {
      await this.toast.show('Tu carrito está vacío.', 'danger');
      return;
    }
    try {
      const items = lines.map(l => ({
        productId: l.productId,
        qty: l.qty,
        unitPrice: this.data.priceForCustomer(c, l.productId),
      }));
      const created = this.data.createOrder({
        purpose: `Pedido portal — ${c.name}`,
        items,
        userId: c.id,
        userName: c.name,
        customerId: c.id,
        requestedDeliveryDate: new Date(this.deliveryDate()),
      });
      await this.toast.show(`Pedido ${created.code} enviado correctamente.`);
      this.cart.set([]);
      this.deliveryDate.set('');
    } catch (e: unknown) {
      await this.toast.show(e instanceof Error ? e.message : 'Error al enviar el pedido.', 'danger');
    }
  }

  // ===== Recepción =====

  openEdit(o: CustomerOrder) {
    const draft: Record<string, number> = {};
    for (const it of o.items) draft[it.productId] = it.fulfilledQty;
    this.receiptDraft.set(draft);
    this.noteDraft.set('');
    this.editingId.set(o.id);
  }

  cancelEdit() {
    this.editingId.set(null);
    this.receiptDraft.set({});
    this.noteDraft.set('');
  }

  draftQty(productId: string, fallback: number): number {
    const v = this.receiptDraft()[productId];
    return v === undefined ? fallback : v;
  }

  setDraftQty(productId: string, raw: string, max: number) {
    const n = Number(raw);
    const clamped = Math.max(0, Math.min(isFinite(n) ? n : 0, max));
    this.receiptDraft.update(d => ({ ...d, [productId]: clamped }));
  }

  subtotalFor(it: OrderItem, received: number): number {
    return received * it.unitPrice;
  }

  draftTotal(o: CustomerOrder): number {
    return o.items.reduce((sum, it) => {
      const r = this.draftQty(it.productId, it.fulfilledQty);
      return sum + r * it.unitPrice;
    }, 0);
  }

  async confirmAllOk(o: CustomerOrder) {
    const c = this.customer();
    if (!c) return;
    const receipt = o.items.map(it => ({ productId: it.productId, receivedQty: it.fulfilledQty }));
    try {
      this.data.confirmOrderReception(o.id, receipt, undefined, c.id, c.name);
      await this.toast.show(`Pedido ${o.code} marcado como recibido.`);
    } catch (e: unknown) {
      await this.toast.show(e instanceof Error ? e.message : 'No se pudo confirmar el pedido.', 'danger');
    }
  }

  async submitReception(o: CustomerOrder) {
    const c = this.customer();
    if (!c) return;
    const receipt = o.items.map(it => ({
      productId: it.productId,
      receivedQty: this.draftQty(it.productId, it.fulfilledQty),
    }));
    try {
      this.data.confirmOrderReception(o.id, receipt, this.noteDraft(), c.id, c.name);
      await this.toast.show(`Pedido ${o.code} confirmado con ajustes.`);
      this.cancelEdit();
    } catch (e: unknown) {
      await this.toast.show(e instanceof Error ? e.message : 'No se pudo confirmar el pedido.', 'danger');
    }
  }

  // ===== Helpers historial =====

  hasDiff(it: OrderItem): boolean {
    return it.receivedQty !== undefined && it.receivedQty < it.fulfilledQty;
  }

  /**
   * Subtotal a mostrar en el historial: si ya hay receivedQty (confirmado),
   * usa esa cantidad; si no, usa qty original (lo solicitado).
   */
  historicalSubtotal(o: CustomerOrder, it: OrderItem): number {
    const qty = o.customerConfirmedAt ? (it.receivedQty ?? 0) : it.qty;
    return qty * it.unitPrice;
  }

  statusLabel(o: CustomerOrder): string {
    if (o.customerConfirmedAt) return 'Recibido';
    return {
      pending: 'Pendiente',
      in_production: 'En producción',
      completed: 'Producido',
      cancelled: 'Cancelado',
    }[o.status] ?? o.status;
  }

  statusColor(o: CustomerOrder): string {
    if (o.customerConfirmedAt) return 'success';
    return {
      pending: 'warning',
      in_production: 'primary',
      completed: 'tertiary',
      cancelled: 'medium',
    }[o.status] ?? 'medium';
  }
}
