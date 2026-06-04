import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { FormModalComponent } from '../../shared/components/form-modal/form-modal.component';
import { FormFieldComponent } from '../../shared/components/form-field/form-field.component';
import { DataService } from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../shared/components/toast/toast.service';
import { UnitShortPipe } from '../../shared/pipes/unit-short.pipe';

type MovKind = 'entry' | 'exit' | 'adjustment';
type ItemKind = 'supply' | 'product';

interface ReasonOption { value: string; label: string; }

const REASONS_BY_KIND: Record<MovKind, ReasonOption[]> = {
  entry: [
    { value: 'return_from_customer', label: 'Devolución de cliente' },
    { value: 'donation', label: 'Donación recibida' },
    { value: 'manual', label: 'Carga manual / inicial' },
  ],
  exit: [
    { value: 'damaged', label: 'Producto dañado' },
    { value: 'expired', label: 'Vencido' },
    { value: 'lost', label: 'Pérdida' },
    { value: 'manual', label: 'Otra salida (manual)' },
  ],
  adjustment: [
    { value: 'count_correction', label: 'Corrección por conteo físico' },
  ],
};

@Component({
  selector: 'app-ajuste-form-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, DecimalPipe, IonButton, IonIcon, FormModalComponent, FormFieldComponent, UnitShortPipe],
  templateUrl: './ajuste-form-modal.component.html',
  styleUrls: ['./ajuste-form-modal.component.scss'],
})
export class AjusteFormModalComponent {
  private readonly fb = inject(FormBuilder);
  protected readonly data = inject(DataService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly isOpen = input.required<boolean>();
  readonly closed = output<void>();
  readonly saved = output<void>();

  readonly form = this.fb.group({
    kind: this.fb.control<MovKind>('entry', { nonNullable: true, validators: [Validators.required] }),
    itemKind: this.fb.control<ItemKind>('supply', { nonNullable: true, validators: [Validators.required] }),
    itemId: this.fb.control('', { nonNullable: true, validators: [Validators.required] }),
    qty: this.fb.control<number | null>(null),
    newQty: this.fb.control<number | null>(null),
    reason: this.fb.control('', { nonNullable: true, validators: [Validators.required] }),
    note: this.fb.control(''),
  });

  // Signals sincronizadas con controles para reactividad del template.
  private readonly _kind = signal<MovKind>('entry');
  private readonly _itemKind = signal<ItemKind>('supply');
  private readonly _itemId = signal<string>('');
  private readonly _qty = signal<number | null>(null);
  private readonly _newQty = signal<number | null>(null);

  readonly kind = this._kind.asReadonly();
  readonly itemKind = this._itemKind.asReadonly();

  readonly items = computed(() => {
    if (this._itemKind() === 'supply') {
      return this.data.activeSupplies().map(s => ({ id: s.id, name: s.name, unit: s.unit }));
    }
    return this.data.activeProducts()
      .filter(p => !p.hasRecipe)
      .map(p => ({ id: p.id, name: p.name, unit: p.unit }));
  });

  readonly reasonOptions = computed(() => REASONS_BY_KIND[this._kind()]);

  readonly selectedItem = computed(() => {
    const id = this._itemId();
    if (!id) return null;
    return this.items().find(i => i.id === id) ?? null;
  });

  readonly unitLabel = computed(() => this.selectedItem()?.unit ?? '');
  readonly unitHint = computed(() => {
    const u = this.unitLabel();
    return u ? `Unidad: ${u}` : 'Selecciona un item primero';
  });
  readonly adjustHint = computed(() => {
    const cur = this.currentStock();
    return cur != null ? `Stock teórico actual: ${cur} ${this.unitLabel()}` : 'Selecciona un item primero';
  });

  readonly currentStock = computed(() => {
    const id = this._itemId();
    if (!id) return 0;
    if (this._itemKind() === 'supply') {
      return this.data.supplyStockFor(id)?.quantity ?? 0;
    }
    return this.data.productStockFor(id)?.quantity ?? 0;
  });

  readonly projectedStock = computed(() => {
    const cur = this.currentStock();
    if (this._kind() === 'adjustment') return this._newQty() ?? cur;
    const q = this._qty() ?? 0;
    return this._kind() === 'entry' ? cur + q : cur - q;
  });

  readonly delta = computed(() => this.projectedStock() - this.currentStock());

  constructor() {
    effect(() => {
      if (this.isOpen()) {
        this.form.reset({
          kind: 'entry', itemKind: 'supply', itemId: '',
          qty: null, newQty: null, reason: '', note: '',
        });
        this._kind.set('entry');
        this._itemKind.set('supply');
        this._itemId.set('');
        this._qty.set(null);
        this._newQty.set(null);
      }
    });
    // Mantener signals en sync con controles (para qty/newQty que cambian al escribir)
    this.form.controls.qty.valueChanges.subscribe(v => this._qty.set(v));
    this.form.controls.newQty.valueChanges.subscribe(v => this._newQty.set(v));
  }

  onKindChange(k: MovKind) {
    this._kind.set(k);
    this.form.patchValue({ reason: '' });
  }

  onItemKindChange(k: ItemKind) {
    this._itemKind.set(k);
    this.form.patchValue({ itemId: '' });
    this._itemId.set('');
  }

  onItemChange() {
    this._itemId.set(this.form.controls.itemId.value);
  }

  async onSubmit() {
    const v = this.form.getRawValue();
    if (v.kind !== 'adjustment') {
      if (!v.qty || v.qty <= 0) {
        await this.toast.show('La cantidad debe ser mayor a 0.', 'danger');
        return;
      }
    } else {
      if (v.newQty == null || v.newQty < 0) {
        await this.toast.show('El stock contado debe ser un número ≥ 0.', 'danger');
        return;
      }
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      await this.toast.show('Completa todos los campos requeridos.', 'danger');
      return;
    }

    try {
      const user = this.auth.user();
      this.data.recordStockMovement({
        kind: v.kind,
        itemKind: v.itemKind,
        itemId: v.itemId,
        qty: v.qty ?? undefined,
        newQty: v.newQty ?? undefined,
        reason: v.reason,
        note: v.note?.trim() || undefined,
        userId: user?.uid ?? 'unknown',
        userName: user?.displayName ?? 'Usuario',
      });
      const item = this.selectedItem();
      const kindLabel = v.kind === 'entry' ? 'Entrada' : v.kind === 'exit' ? 'Salida' : 'Ajuste';
      await this.toast.show(`${kindLabel} de ${item?.name ?? 'item'} registrada.`, 'success');
      this.saved.emit();
    } catch (e: unknown) {
      await this.toast.show(e instanceof Error ? e.message : 'Error al registrar el movimiento.', 'danger');
    }
  }
}
