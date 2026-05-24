import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { IonButton } from '@ionic/angular/standalone';
import { FormModalComponent } from '../../shared/components/form-modal/form-modal.component';
import { FormFieldComponent } from '../../shared/components/form-field/form-field.component';
import { DataService } from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../shared/components/toast/toast.service';

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
  imports: [ReactiveFormsModule, DecimalPipe, IonButton, FormModalComponent, FormFieldComponent],
  template: `
    <app-form-modal
      [isOpen]="isOpen()"
      title="Nuevo movimiento manual"
      (dismissed)="closed.emit()">

      <form body [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
        <app-form-field label="Tipo de movimiento" [required]="true">
          <div class="seg">
            <label class="seg__opt" [class.seg__opt--active]="kind() === 'entry'">
              <input type="radio" formControlName="kind" value="entry" (change)="onKindChange('entry')" />
              <span>↑ Entrada</span>
              <small>Devolución, donación, carga</small>
            </label>
            <label class="seg__opt" [class.seg__opt--active]="kind() === 'exit'">
              <input type="radio" formControlName="kind" value="exit" (change)="onKindChange('exit')" />
              <span>↓ Salida (merma)</span>
              <small>Dañado, vencido, pérdida</small>
            </label>
            <label class="seg__opt" [class.seg__opt--active]="kind() === 'adjustment'">
              <input type="radio" formControlName="kind" value="adjustment" (change)="onKindChange('adjustment')" />
              <span>⚙ Ajuste de conteo</span>
              <small>Diferencia conteo físico</small>
            </label>
          </div>
        </app-form-field>

        <app-form-field label="Tipo de item" [required]="true">
          <div class="seg seg--row">
            <label class="seg__opt" [class.seg__opt--active]="itemKind() === 'supply'">
              <input type="radio" formControlName="itemKind" value="supply" (change)="onItemKindChange('supply')" />
              <span>Insumo</span>
            </label>
            <label class="seg__opt" [class.seg__opt--active]="itemKind() === 'product'">
              <input type="radio" formControlName="itemKind" value="product" (change)="onItemKindChange('product')" />
              <span>Producto de reventa</span>
            </label>
          </div>
        </app-form-field>

        <app-form-field [label]="itemKind() === 'supply' ? 'Insumo' : 'Producto'" [required]="true">
          <select formControlName="itemId" (change)="onItemChange()">
            <option value="">— Selecciona —</option>
            @for (it of items(); track it.id) {
              <option [value]="it.id">{{ it.name }} ({{ it.unit }})</option>
            }
          </select>
        </app-form-field>

        @if (kind() !== 'adjustment') {
          <app-form-field label="Cantidad" [required]="true" [hint]="unitHint()">
            <input type="number" formControlName="qty" min="0.001" step="0.001" />
          </app-form-field>
        } @else {
          <app-form-field label="Stock contado físicamente" [required]="true" [hint]="adjustHint()">
            <input type="number" formControlName="newQty" min="0" step="0.001" />
          </app-form-field>
        }

        <app-form-field label="Motivo" [required]="true">
          <select formControlName="reason">
            <option value="">— Selecciona motivo —</option>
            @for (r of reasonOptions(); track r.value) {
              <option [value]="r.value">{{ r.label }}</option>
            }
          </select>
        </app-form-field>

        <app-form-field label="Nota" hint="Opcional — referencia, contexto del movimiento">
          <textarea formControlName="note" rows="2" placeholder="Ej. Devolución factura #1023"></textarea>
        </app-form-field>

        <div class="summary">
          <div>
            <div class="summary__label">Stock actual</div>
            <div class="summary__value mono">
              {{ (currentStock() | number:'1.0-3') ?? '0' }} {{ unitLabel() }}
            </div>
          </div>
          <div class="summary__arrow">→</div>
          <div>
            <div class="summary__label">Nuevo stock</div>
            <div class="summary__value mono" [class.success]="delta() > 0" [class.danger]="delta() < 0">
              {{ projectedStock() | number:'1.0-3' }} {{ unitLabel() }}
            </div>
          </div>
        </div>
      </form>

      <div footer>
        <ion-button fill="clear" class="ghost" (click)="closed.emit()">Cancelar</ion-button>
        <ion-button (click)="onSubmit()" [disabled]="form.invalid">
          Registrar movimiento
        </ion-button>
      </div>
    </app-form-modal>
  `,
  styles: [`
    .seg {
      display: grid;
      grid-template-columns: 1fr;
      gap: var(--ui-sp-2);
    }
    .seg--row {
      grid-template-columns: 1fr 1fr;
    }
    .seg__opt {
      display: flex;
      flex-direction: column;
      padding: var(--ui-sp-3);
      border: var(--ui-border-w-sm) solid var(--ui-border-strong);
      border-radius: var(--ui-radius);
      background: var(--ui-surface);
      cursor: pointer;
      transition: all 120ms ease;
    }
    /* Solo aplica hover gris cuando NO está activo, sino el text blanco se pierde. */
    .seg__opt:not(.seg__opt--active):hover {
      background: var(--ui-surface-3);
      border-color: var(--ui-primary);
    }
    .seg__opt--active {
      border-color: var(--ui-primary);
      background: var(--ui-primary);
      color: var(--ui-primary-contrast);
      box-shadow: var(--ui-shadow-sm);
    }
    /* Cuando está activo, hover preserva el tema y solo oscurece levemente. */
    .seg__opt--active:hover {
      background: var(--ui-primary-shade);
    }
    .seg__opt input[type="radio"] {
      position: absolute;
      opacity: 0;
      pointer-events: none;
    }
    .seg__opt span {
      font-weight: var(--ui-fw-semibold);
      font-size: var(--ui-fs-md);
    }
    .seg__opt small {
      font-size: var(--ui-fs-xs);
      margin-top: 2px;
      opacity: 0.85;
    }

    .summary {
      margin-top: var(--ui-sp-3);
      padding: var(--ui-sp-3) var(--ui-sp-4);
      background: var(--ui-surface-2);
      border: var(--ui-border-w-sm) solid var(--ui-border);
      border-radius: var(--ui-radius);
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      gap: var(--ui-sp-3);
      align-items: center;
    }
    .summary__label {
      font-size: var(--ui-fs-xs);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--ui-text-muted);
      font-weight: var(--ui-fw-medium);
    }
    .summary__value {
      font-size: var(--ui-fs-lg);
      font-weight: var(--ui-fw-bold);
      color: var(--ui-text-strong);
    }
    .summary__value.success { color: var(--ui-success); }
    .summary__value.danger { color: var(--ui-danger); }
    .summary__arrow {
      font-size: 24px;
      color: var(--ui-text-muted);
      text-align: center;
    }
  `],
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
