import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
  IonButton, IonIcon,
} from '@ionic/angular/standalone';
import { DataService } from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';
import { TenantContextService } from '../../core/services/tenant-context.service';
import { ToastService } from '../../shared/components/toast/toast.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-punto-venta',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
    IonButton, IonIcon,
    PageHeaderComponent, EmptyStateComponent,
  ],
  templateUrl: './punto-venta.page.html',
  styleUrls: ['./punto-venta.page.scss'],
})
export class PuntoVentaPage {
  protected readonly data = inject(DataService);
  protected readonly tenant = inject(TenantContextService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly almacenId = computed(() => this.data.almacenId());

  /** Carrito: { productId: qty }. */
  readonly cart = signal<Record<string, number>>({});

  /** Stock disponible en el almacén (totales por producto, en tiempo real). */
  readonly stock = computed(() =>
    this.data.urnaProductTotals(this.almacenId()).map(s => ({
      ...s,
      product: this.data.productById(s.productId),
      price: this.data.consumerPrice(s.productId),
      enCarrito: this.cart()[s.productId] || 0,
    }))
  );

  readonly cartLines = computed(() => {
    const c = this.cart();
    return Object.keys(c).filter(id => c[id] > 0).map(productId => {
      const p = this.data.productById(productId);
      const qty = c[productId];
      const unitPrice = this.data.consumerPrice(productId);
      return { productId, name: p?.name ?? productId, qty, unitPrice, lineTotal: qty * unitPrice };
    });
  });

  readonly total = computed(() => this.cartLines().reduce((s, l) => s + l.lineTotal, 0));
  readonly cartCount = computed(() => this.cartLines().reduce((s, l) => s + l.qty, 0));

  /** Stock total de un producto (independiente del carrito). */
  stockDe(productId: string): number { return this.data.urnaProductQty(this.almacenId(), productId); }

  agregar(productId: string) {
    const cur = this.cart()[productId] || 0;
    if (cur >= this.stockDe(productId)) {
      this.toast.show('No hay más stock de este producto.', 'warning');
      return;
    }
    this.cart.update(c => ({ ...c, [productId]: cur + 1 }));
  }

  setQty(productId: string, qty: number) {
    const max = this.stockDe(productId);
    const q = Math.max(0, Math.min(Math.floor(qty || 0), max));
    this.cart.update(c => ({ ...c, [productId]: q }));
  }

  quitar(productId: string) {
    this.cart.update(c => { const n = { ...c }; delete n[productId]; return n; });
  }

  vaciar() { this.cart.set({}); }

  async cobrar() {
    const lines = this.cartLines().map(l => ({ productId: l.productId, qty: l.qty }));
    if (lines.length === 0) { await this.toast.show('El carrito está vacío.', 'danger'); return; }
    const user = this.auth.user();
    try {
      const sale = this.data.registerPosSale({
        almacenId: this.almacenId(),
        lines,
        userId: user?.uid ?? 'unknown',
        userName: user?.displayName ?? 'Usuario',
      });
      await this.toast.show(`Venta ${sale.code} registrada — ₡${sale.total.toLocaleString('es-CR')}.`, 'success');
      this.vaciar();
    } catch (e: unknown) {
      await this.toast.show(e instanceof Error ? e.message : 'No se pudo registrar la venta.', 'danger');
    }
  }
}
