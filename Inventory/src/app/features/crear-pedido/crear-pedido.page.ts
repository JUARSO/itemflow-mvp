import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
  IonButton, IonIcon, IonBadge,
} from '@ionic/angular/standalone';
import { DataService } from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../shared/components/toast/toast.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { Product } from '../../core/models';
import { UnitShortPipe } from '../../shared/pipes/unit-short.pipe';

const DAY_LABELS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'] as const;

interface CartLine { productId: string; qty: number; }

/**
 * Genera un pedido a nombre de un cliente externo desde el lado del admin.
 * A diferencia del portal del cliente:
 *  - Permite seleccionar cualquier producto del catálogo (avisa si no está
 *    en los productos asignados al cliente).
 *  - Permite cualquier fecha de entrega (avisa si cae fuera de la ventana
 *    configurada para el cliente).
 *  - No restringe por orderDays del cliente.
 */
@Component({
  selector: 'app-crear-pedido',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe, RouterLink,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
    IonButton, IonIcon, IonBadge,
    PageHeaderComponent, UnitShortPipe,
  ],
  templateUrl: './crear-pedido.page.html',
  styleUrls: ['./crear-pedido.page.scss'],
})
export class CrearPedidoPage {
  protected readonly data = inject(DataService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly selectedCustomerId = signal('');
  readonly cart = signal<CartLine[]>([]);
  readonly deliveryDate = signal('');
  readonly notes = signal('');
  readonly search = signal('');

  readonly activeCustomers = computed(() => this.data.activeCustomers());

  readonly selectedCustomer = computed(() => {
    const id = this.selectedCustomerId();
    return id ? this.data.customerById(id) ?? null : null;
  });

  readonly productosFiltrados = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.data.products()
      .filter(p => p.active)
      .filter(p => !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  readonly cartDetail = computed(() => {
    const c = this.selectedCustomer();
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

  readonly totalCart = computed(() =>
    this.cartDetail().reduce((s, l) => s + l.subtotal, 0)
  );

  /** True si la fecha seleccionada cae dentro de los deliveryDays del cliente. */
  readonly isDeliveryDateInWindow = computed(() => {
    const c = this.selectedCustomer();
    const iso = this.deliveryDate();
    if (!c || !iso) return true;
    if (c.window.deliveryDays.length === 0) return true;
    const d = new Date(iso + 'T00:00:00');
    return c.window.deliveryDays.includes(d.getDay());
  });

  isAssigned(p: Product): boolean {
    const c = this.selectedCustomer();
    if (!c) return true;
    if (c.allowedProductIds.length === 0) return true;
    return c.allowedProductIds.includes(p.id);
  }

  deliveryDaysLabel(c: { window: { deliveryDays: number[] } }): string {
    if (c.window.deliveryDays.length === 0) return 'cualquier día';
    return c.window.deliveryDays.map(d => DAY_LABELS[d]).join(', ');
  }

  todayIso(): string {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  onSelectCustomer(id: string) {
    this.selectedCustomerId.set(id);
    this.cart.set([]);
    this.deliveryDate.set('');
    this.notes.set('');
  }

  addToCart(productId: string) {
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

  setQty(productId: string, raw: string) {
    const n = Math.max(1, Math.floor(Number(raw) || 1));
    this.cart.update(lines => lines.map(l => l.productId === productId ? { ...l, qty: n } : l));
  }

  removeFromCart(productId: string) {
    this.cart.update(lines => lines.filter(l => l.productId !== productId));
  }

  clearCart() {
    this.cart.set([]);
  }

  async submit() {
    const c = this.selectedCustomer();
    if (!c) {
      await this.toast.show('Selecciona un cliente.', 'danger');
      return;
    }
    if (this.cart().length === 0) {
      await this.toast.show('Agrega al menos un producto.', 'danger');
      return;
    }
    if (!this.deliveryDate()) {
      await this.toast.show('Selecciona la fecha de entrega.', 'danger');
      return;
    }
    const u = this.auth.user();
    try {
      const items = this.cart().map(l => ({
        productId: l.productId,
        qty: l.qty,
        unitPrice: this.data.priceForCustomer(c, l.productId),
      }));
      const created = this.data.createOrder({
        purpose: `Pedido para ${c.name} (creado por admin)`,
        items,
        notes: this.notes().trim() || undefined,
        userId: u?.uid ?? 'admin',
        userName: u?.displayName ?? 'Admin',
        customerId: c.id,
        requestedDeliveryDate: new Date(this.deliveryDate() + 'T00:00:00'),
      });
      await this.toast.show(`Pedido ${created.code} creado para ${c.name}.`);
      this.router.navigate(['/produccion']);
    } catch (e: unknown) {
      await this.toast.show(e instanceof Error ? e.message : 'Error al crear el pedido.', 'danger');
    }
  }
}
