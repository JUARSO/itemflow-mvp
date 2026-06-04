import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
  IonButton, IonIcon,
} from '@ionic/angular/standalone';
import { DataService } from '../../core/services/data.service';
import { PaymentMethod, ComprobanteTipo, PosCliente } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { TenantContextService } from '../../core/services/tenant-context.service';
import { ToastService } from '../../shared/components/toast/toast.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { SearchBarComponent } from '../../shared/components/search-bar/search-bar.component';
import { PosClienteFormModalComponent } from '../clientes-pos/pos-cliente-form-modal.component';

@Component({
  selector: 'app-punto-venta',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
    IonButton, IonIcon,
    PageHeaderComponent, EmptyStateComponent, SearchBarComponent, PosClienteFormModalComponent,
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

  /** Unidades vendidas HOY por producto en este almacén (para control de ventas). */
  readonly vendidoHoy = computed<Record<string, number>>(() => {
    const inicioDia = new Date(); inicioDia.setHours(0, 0, 0, 0);
    const desde = inicioDia.getTime();
    const aid = this.almacenId();
    const map: Record<string, number> = {};
    for (const s of this.data.posSales()) {
      if (s.almacenId !== aid || s.at.getTime() < desde) continue;
      for (const l of s.lines) map[l.productId] = (map[l.productId] ?? 0) + l.qty;
    }
    return map;
  });

  /** Stock disponible en el almacén + estado de venta del día por producto. */
  readonly stock = computed(() => {
    const vendidos = this.vendidoHoy();
    return this.data.urnaProductTotals(this.almacenId()).map(s => {
      const vendidoHoy = vendidos[s.productId] ?? 0;
      return {
        ...s,
        product: this.data.productById(s.productId),
        price: this.data.consumerPriceConIva(s.productId),
        enCarrito: this.cart()[s.productId] || 0,
        vendidoHoy,
        vendido: vendidoHoy > 0,
      };
    });
  });

  /** Resumen de control: cuántos productos se vendieron hoy y cuántos no. */
  readonly resumenVenta = computed(() => {
    const list = this.stock();
    const vendidos = list.filter(x => x.vendido).length;
    return { total: list.length, vendidos, sinVender: list.length - vendidos };
  });

  readonly query = signal('');
  /** Filtro de control de venta del día. */
  readonly ventaFiltro = signal<'todos' | 'sin' | 'vendidos'>('todos');

  readonly stockFiltrado = computed(() => {
    const q = this.query().trim().toLowerCase();
    const f = this.ventaFiltro();
    let list = this.stock();
    if (f === 'sin') list = list.filter(x => !x.vendido);
    else if (f === 'vendidos') list = list.filter(x => x.vendido);
    if (q) list = list.filter(x => (x.productName ?? '').toLowerCase().includes(q));
    return list;
  });

  readonly cartLines = computed(() => {
    const c = this.cart();
    return Object.keys(c).filter(id => c[id] > 0).map(productId => {
      const p = this.data.productById(productId);
      const qty = c[productId];
      const unitPrice = this.data.consumerPriceConIva(productId);
      return { productId, name: p?.name ?? productId, qty, unitPrice, lineTotal: qty * unitPrice };
    });
  });

  readonly total = computed(() => this.cartLines().reduce((s, l) => s + l.lineTotal, 0));
  readonly cartCount = computed(() => this.cartLines().reduce((s, l) => s + l.qty, 0));

  /** Métodos de pago disponibles en el punto de venta. */
  readonly paymentMethods = [
    { id: 'efectivo' as PaymentMethod, label: 'Efectivo', icon: 'cash-outline' },
    { id: 'tarjeta' as PaymentMethod, label: 'Tarjeta', icon: 'card-outline' },
    { id: 'sinpe' as PaymentMethod, label: 'SINPE', icon: 'phone-portrait-outline' },
    { id: 'transferencia' as PaymentMethod, label: 'Transferencia', icon: 'swap-horizontal-outline' },
  ];
  readonly paymentMethod = signal<PaymentMethod>('efectivo');

  // ----- Comprobante electrónico -----
  readonly comprobante = signal<ComprobanteTipo>('tiquete');
  readonly customerId = signal<string>('');
  readonly clienteModalOpen = signal(false);

  /** Clientes del POS (receptores) válidos para factura electrónica. */
  readonly clientesFE = computed(() =>
    this.data.posClientes().filter(c => c.active)
  );

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

  /** Cambia el tipo de comprobante; al pasar a tiquete limpia el cliente. */
  setComprobante(tipo: ComprobanteTipo) {
    this.comprobante.set(tipo);
    if (tipo === 'tiquete') this.customerId.set('');
  }

  /** Tras crear un cliente desde el POS, lo selecciona automáticamente para la factura. */
  onClienteCreado(cliente: PosCliente) {
    this.clienteModalOpen.set(false);
    this.customerId.set(cliente.id);
  }

  async cobrar() {
    const lines = this.cartLines().map(l => ({ productId: l.productId, qty: l.qty }));
    if (lines.length === 0) { await this.toast.show('El carrito está vacío.', 'danger'); return; }
    if (this.comprobante() === 'factura' && !this.customerId()) {
      await this.toast.show('Selecciona el cliente para la factura electrónica.', 'danger');
      return;
    }
    const user = this.auth.user();
    try {
      const sale = this.data.registerPosSale({
        almacenId: this.almacenId(),
        lines,
        paymentMethod: this.paymentMethod(),
        comprobante: this.comprobante(),
        customerId: this.customerId() || undefined,
        userId: user?.uid ?? 'unknown',
        userName: user?.displayName ?? 'Usuario',
      });
      const metodo = this.paymentMethods.find(m => m.id === sale.paymentMethod)?.label ?? sale.paymentMethod;
      const tipo = sale.comprobante === 'factura' ? 'Factura' : 'Tiquete';
      await this.toast.show(`${tipo} ${sale.code} registrada (${metodo}) — ₡${sale.total.toLocaleString('es-CR')}.`, 'success');
      this.vaciar();
      this.paymentMethod.set('efectivo');
      this.setComprobante('tiquete');
    } catch (e: unknown) {
      await this.toast.show(e instanceof Error ? e.message : 'No se pudo registrar la venta.', 'danger');
    }
  }
}
