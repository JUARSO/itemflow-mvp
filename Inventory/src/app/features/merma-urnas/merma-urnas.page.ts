import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
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
import { FormFieldComponent } from '../../shared/components/form-field/form-field.component';
import { ProductionMermaReason, ReturnedLot } from '../../core/models';

const MERMA_REASONS: { value: ProductionMermaReason; label: string }[] = [
  { value: 'damaged', label: 'Dañado' },
  { value: 'contaminated', label: 'Contaminado' },
  { value: 'overbaked', label: 'Quemado / pasado' },
  { value: 'other', label: 'Otro / vencido' },
];

@Component({
  selector: 'app-merma-urnas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
    IonButton, IonIcon, IonBadge,
    PageHeaderComponent, KpiCardComponent, EmptyStateComponent, FormFieldComponent,
  ],
  templateUrl: './merma-urnas.page.html',
  styleUrls: ['./merma-urnas.page.scss'],
})
export class MermaUrnasPage {
  protected readonly data = inject(DataService);
  protected readonly tenant = inject(TenantContextService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly mermaReasons = MERMA_REASONS;

  readonly urnaId = computed(() => this.data.almacenId());
  readonly urna = computed(() => this.data.almacen());

  // ----- Formulario de registro -----
  readonly productId = signal<string>('');
  readonly qty = signal<number>(1);
  readonly reason = signal<ProductionMermaReason>('damaged');
  readonly note = signal<string>('');

  /** Productos con stock disponible en la urna (los únicos que se pueden mermar). */
  readonly disponibles = computed(() => this.data.urnaProductTotals(this.urnaId()));

  readonly maxQty = computed(() => this.data.urnaProductQty(this.urnaId(), this.productId()));

  /**
   * Historial de mermas de Ventas: las de la urna/almacén + las de ENTREGA
   * (registradas al facturar un pedido). Más recientes primero.
   */
  readonly historial = computed(() =>
    this.data.returnedLots()
      .filter(l => (l.kind === 'urna' && l.urnaId === this.urnaId()) || l.kind === 'delivery')
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  );

  readonly totalMerma = computed(() => this.historial().reduce((s, l) => s + l.mermaQty, 0));

  reasonLabel(r?: ProductionMermaReason): string {
    return this.mermaReasons.find(x => x.value === r)?.label ?? '—';
  }

  /** Texto descriptivo del origen de una merma del historial. */
  origenLabel(l: ReturnedLot): string {
    if (l.kind === 'delivery') {
      const cliente = l.customerName ? ` · ${l.customerName}` : '';
      return `Entrega · pedido ${l.sourceOrderCode ?? ''}${cliente}`.trim();
    }
    return this.reasonLabel(l.productionReason);
  }

  async registrar() {
    const urnaId = this.urnaId();
    const productId = this.productId();
    if (!productId) {
      await this.toast.show('Selecciona un producto.', 'danger');
      return;
    }
    const user = this.auth.user();
    try {
      this.data.registerUrnaMerma({
        urnaId,
        productId,
        qty: Math.floor(this.qty()),
        reason: this.reason(),
        reasonText: this.note() || undefined,
        userId: user?.uid ?? 'unknown',
        userName: user?.displayName ?? 'Usuario',
      });
      const name = this.data.productById(productId)?.name ?? 'producto';
      await this.toast.show(`Merma registrada: ${Math.floor(this.qty())} × ${name}.`, 'warning');
      this.productId.set('');
      this.qty.set(1);
      this.note.set('');
    } catch (e: unknown) {
      await this.toast.show(e instanceof Error ? e.message : 'No se pudo registrar la merma.', 'danger');
    }
  }
}
