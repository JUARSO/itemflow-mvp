import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
  IonButton, IonBadge, IonIcon,
} from '@ionic/angular/standalone';
import { DataService } from '../../core/services/data.service';
import { TenantContextService } from '../../core/services/tenant-context.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { ToastService } from '../../shared/components/toast/toast.service';
import { Supply, SuggestedPrePurchase } from '../../core/models';

@Component({
  selector: 'app-pre-compras',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, DecimalPipe, RouterLink,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
    IonButton, IonBadge, IonIcon,
    PageHeaderComponent, KpiCardComponent, ConfirmDialogComponent,
  ],
  templateUrl: './pre-compras.page.html',
  styleUrls: ['./pre-compras.page.scss'],
})
export class PreComprasPage {
  protected readonly data = inject(DataService);
  protected readonly tenant = inject(TenantContextService);
  private readonly toast = inject(ToastService);

  /** Marca de tiempo del último recálculo. Cambiar este signal recomputa todo. */
  readonly updatedAt = signal(new Date());

  readonly updatedLabel = computed(() => {
    const d = this.updatedAt();
    return d.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  });
  readonly updatedHint = computed(() => {
    const d = this.updatedAt();
    return d.toLocaleDateString('es-CR', { weekday: 'short', day: '2-digit', month: 'short' });
  });

  readonly suggestions = computed<SuggestedPrePurchase[]>(() => {
    this.updatedAt(); // dependencia: cambiar tick fuerza recálculo
    return this.data.suggestedPrePurchases(new Date());
  });

  readonly totalItems = computed(() =>
    this.suggestions().reduce((s, p) => s + p.items.length, 0)
  );

  readonly totalCost = computed(() =>
    this.suggestions().reduce((s, p) => s + p.totalCost, 0)
  );

  // Confirm dialog
  readonly confirmOpen = signal(false);
  readonly confirmTarget = signal<SuggestedPrePurchase | null>(null);
  readonly confirmTitle = signal('');
  readonly confirmMessage = signal('');

  // Estado del formulario inline "agregar insumo" por tarjeta.
  // `addingFor` es el supplierId del proveedor cuyo form está abierto (o '' si ninguno).
  readonly addingFor = signal<string>('');
  readonly addSupplyId = signal<string>('');
  readonly addQty = signal<number>(1);

  recalc() {
    this.updatedAt.set(new Date());
    this.toast.show('Pre-compras recalculadas.', 'success');
  }

  /** Helper para el template — JS Math.isFinite no está disponible en Angular templates por nombre. */
  isFinite(n: number): boolean {
    return Number.isFinite(n);
  }

  pedirAprobar(pre: SuggestedPrePurchase) {
    this.confirmTarget.set(pre);
    this.confirmTitle.set(`Aprobar pre-compra para ${pre.supplierName}`);
    this.confirmMessage.set(
      `Se generará una OC con ${pre.items.length} insumo(s) por ` +
      `₡${pre.totalCost.toLocaleString('es-CR')}. Entrega esperada: ` +
      `${pre.nextDeliveryDate.toLocaleDateString('es-CR', { weekday: 'long', day: '2-digit', month: '2-digit' })}.`
    );
    this.confirmOpen.set(true);
  }

  async ejecutar() {
    const pre = this.confirmTarget();
    this.confirmOpen.set(false);
    if (!pre) return;
    try {
      const po = this.data.approvePrePurchaseForSupplier(pre.supplierId);
      await this.toast.show(`OC ${po.code} generada para ${pre.supplierName}.`, 'success');
      // Forzar recálculo: los insumos recién pedidos desaparecen de la sugerencia.
      this.updatedAt.set(new Date());
    } catch (e: any) {
      await this.toast.show(e?.message ?? 'Error al aprobar', 'danger');
    }
    this.confirmTarget.set(null);
  }

  // ----- Edición manual: agregar / quitar insumos -----

  /**
   * Insumos del proveedor que aún no están en la pre-compra (ni auto ni
   * manuales). Sólo se permite agregar items que el proveedor entrega.
   */
  supplierAvailableSupplies(pre: SuggestedPrePurchase): Supply[] {
    const sup = this.data.supplierById(pre.supplierId);
    if (!sup) return [];
    const inCart = new Set(pre.items.map(it => it.supplyId));
    const linkedIds = sup.suppliedItems
      .filter(i => i.kind === 'supply')
      .map(i => i.itemId);
    return this.data.activeSupplies()
      .filter(s => linkedIds.includes(s.id) && !inCart.has(s.id));
  }

  abrirAgregar(supplierId: string) {
    this.addingFor.set(supplierId);
    this.addSupplyId.set('');
    this.addQty.set(1);
  }

  cancelarAgregar() {
    this.addingFor.set('');
    this.addSupplyId.set('');
  }

  async confirmarAgregar(supplierId: string) {
    const supplyId = this.addSupplyId();
    const qty = this.addQty();
    if (!supplyId || qty <= 0) return;
    try {
      this.data.addManualPrePurchaseItem(supplierId, supplyId, qty);
      this.cancelarAgregar();
      this.updatedAt.set(new Date());
      await this.toast.show('Insumo agregado al carrito.', 'success');
    } catch (e: any) {
      await this.toast.show(e?.message ?? 'Error al agregar', 'danger');
    }
  }

  async quitarManual(supplierId: string, supplyId: string) {
    this.data.removeManualPrePurchaseItem(supplierId, supplyId);
    this.updatedAt.set(new Date());
    await this.toast.show('Insumo quitado del carrito.');
  }
}
