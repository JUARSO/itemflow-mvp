import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import {
  IonModal, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons,
  IonButton, IonIcon,
} from '@ionic/angular/standalone';
import { DataService } from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../shared/components/toast/toast.service';
import { ProductionMermaReason } from '../../core/models';
import { UnitShortPipe } from '../../shared/pipes/unit-short.pipe';

const REASON_OPTIONS: { value: ProductionMermaReason; label: string }[] = [
  { value: 'damaged',      label: 'Dañado / quebrado' },
  { value: 'underbaked',   label: 'Crudo / poco cocido' },
  { value: 'overbaked',    label: 'Quemado / sobrecocido' },
  { value: 'wrong_shape',  label: 'Mal formado / defecto visual' },
  { value: 'contaminated', label: 'Contaminado' },
  { value: 'other',        label: 'Otro (especificar)' },
];

/**
 * Modal para registrar merma durante producción: unidades que fallaron
 * antes de salir a entrega. Descuenta insumos consumidos pero NO toca
 * stock del producto (las unidades nunca entraron a inventario).
 */
@Component({
  selector: 'app-merma-produccion-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, DecimalPipe,
    IonModal, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons,
    IonButton, IonIcon,
    UnitShortPipe,
  ],
  templateUrl: './merma-produccion-modal.component.html',
  styleUrls: ['./merma-produccion-modal.component.scss'],
})
export class MermaProduccionModalComponent {
  @Input() isOpen = false;
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  private readonly data = inject(DataService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  protected readonly reasons = REASON_OPTIONS;

  readonly productId = signal('');
  readonly qty = signal(1);
  readonly reason = signal<ProductionMermaReason>('damaged');
  readonly reasonText = signal('');
  readonly reviewNote = signal('');

  readonly productos = computed(() =>
    this.data.activeProducts().slice().sort((a, b) => a.name.localeCompare(b.name))
  );

  readonly selectedProduct = computed(() =>
    this.productId() ? this.data.productById(this.productId()) : undefined
  );
  readonly hasRecipe = computed(() => !!this.selectedProduct()?.hasRecipe);

  readonly costPerdido = computed(() => {
    const id = this.productId();
    if (!id) return 0;
    return this.qty() * this.data.effectiveProductCost(id);
  });

  /** Lista de insumos que se descontarán (resolviendo BOM si tiene receta). */
  readonly supplyImpact = computed(() => {
    const id = this.productId();
    if (!id || !this.hasRecipe()) return [];
    const exploded = this.data.explodeBom(id, this.qty());
    return exploded.supplyNeeds.map(n => {
      const sup = this.data.supplyById(n.supplyId);
      return {
        id: n.supplyId,
        name: n.itemName,
        qty: n.qty,
        unit: sup?.unit ?? 'unidad',
      };
    });
  });

  readonly canSave = computed(() => {
    if (!this.productId() || this.qty() <= 0) return false;
    if (this.reason() === 'other' && !this.reasonText().trim()) return false;
    return true;
  });

  setQty(raw: string) {
    const n = Number(raw);
    this.qty.set(isFinite(n) && n > 0 ? Math.floor(n) : 1);
  }

  async save() {
    if (!this.canSave()) return;
    const u = this.auth.user();
    try {
      this.data.registerProductionMerma({
        productId: this.productId(),
        qty: this.qty(),
        reason: this.reason(),
        reasonText: this.reason() === 'other' ? this.reasonText() : undefined,
        reviewNote: this.reviewNote(),
        userId: u?.uid ?? 'admin',
        userName: u?.displayName ?? 'Admin',
      });
      await this.toast.show(`${this.qty()} unidad(es) registradas como merma de producción.`);
      this.reset();
      this.saved.emit();
    } catch (e: unknown) {
      await this.toast.show(e instanceof Error ? e.message : 'Error al registrar.', 'danger');
    }
  }

  private reset() {
    this.productId.set('');
    this.qty.set(1);
    this.reason.set('damaged');
    this.reasonText.set('');
    this.reviewNote.set('');
  }
}
