import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output } from '@angular/core';
import { PurchaseOrderItem } from '../../core/models';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { IonButton } from '@ionic/angular/standalone';
import { FormModalComponent } from '../../shared/components/form-modal/form-modal.component';
import { FormFieldComponent } from '../../shared/components/form-field/form-field.component';
import { DataService } from '../../core/services/data.service';
import { ToastService } from '../../shared/components/toast/toast.service';

type LineGroup = ReturnType<OcFormModalComponent['buildLineGroup']>;

@Component({
  selector: 'app-oc-form-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, DecimalPipe, IonButton, FormModalComponent, FormFieldComponent],
  template: `
    <app-form-modal
      [isOpen]="isOpen()"
      title="Nueva orden de compra"
      (dismissed)="closed.emit()">

      <form body [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
        <div class="row">
          <app-form-field label="Proveedor" [required]="true">
            <input type="text" formControlName="supplier" placeholder="Ej. Molinos del Sur" />
          </app-form-field>
          <app-form-field label="Fecha esperada de entrega">
            <input type="date" formControlName="expectedDate" />
          </app-form-field>
        </div>

        <div class="items">
          <div class="items__head">
            <h3>Insumos a comprar</h3>
            <ion-button size="small" fill="clear" class="ghost" (click)="addLine()">+ Agregar línea</ion-button>
          </div>

          @if (lines.controls.length === 0) {
            <div class="items__empty">Agrega al menos una línea con insumo y cantidad.</div>
          }

          <div formArrayName="items" class="lines">
            @for (ctrl of lines.controls; track $index) {
              <div [formGroupName]="$index" class="line">
                <select formControlName="itemRef" class="line__supply">
                  <option value="">— Selecciona insumo o producto —</option>
                  <optgroup label="Insumos">
                    @for (s of data.activeSupplies(); track s.id) {
                      <option [value]="'sup:' + s.id">{{ s.name }} ({{ s.unit }})</option>
                    }
                  </optgroup>
                  <optgroup label="Productos de reventa">
                    @for (p of reventaProducts(); track p.id) {
                      <option [value]="'prod:' + p.id">{{ p.name }} ({{ p.unit }})</option>
                    }
                  </optgroup>
                </select>
                <input type="number" formControlName="qty" placeholder="Cant." min="0.001" step="0.001" class="line__qty mono" />
                <input type="number" formControlName="unitCost" placeholder="C/U" min="0" step="0.01" class="line__cost mono" />
                <button type="button" class="line__remove" (click)="removeLine($index)" aria-label="Eliminar">×</button>
              </div>
            }
          </div>

          <div class="total">
            <span>Total OC</span>
            <strong class="mono">₡{{ total() | number:'1.0-0' }}</strong>
          </div>
        </div>
      </form>

      <div footer>
        <ion-button fill="clear" class="ghost" (click)="closed.emit()">Cancelar</ion-button>
        <ion-button (click)="onSubmit()" [disabled]="form.invalid || lines.length === 0">
          Crear OC
        </ion-button>
      </div>
    </app-form-modal>
  `,
  styles: [`
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--ui-sp-3); }
    @media (max-width: 480px) { .row { grid-template-columns: 1fr; } }

    .items {
      border: var(--ui-border-w-md) solid var(--ui-border);
      background: var(--ui-surface-2);
      padding: var(--ui-sp-3);
      margin-top: var(--ui-sp-3);
    }
    .items__head {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: var(--ui-sp-2);
    }
    .items__head h3 { font-size: var(--ui-fs-md); font-weight: var(--ui-fw-black); margin: 0; }
    .items__empty {
      padding: var(--ui-sp-4);
      text-align: center;
      color: var(--ui-text-muted);
      font-size: var(--ui-fs-sm);
    }
    .lines { display: grid; gap: var(--ui-sp-2); }
    .line {
      display: grid;
      grid-template-columns: 1fr 90px 100px 36px;
      gap: var(--ui-sp-2);
      align-items: center;
    }
    .line__supply, .line__qty, .line__cost {
      padding: 8px 10px;
      border: var(--ui-border-w-md) solid var(--ui-border);
      background: var(--ui-surface);
      font-family: var(--ui-font-sans);
      font-size: var(--ui-fs-sm);
      color: var(--ui-text);
      min-height: 40px;
    }
    .line__qty, .line__cost { font-family: var(--ui-font-mono); text-align: right; }
    .line__remove {
      width: 36px; height: 36px;
      background: var(--ui-danger);
      color: #fff;
      border: var(--ui-border-w-md) solid var(--ui-border);
      font-size: 20px;
      font-weight: var(--ui-fw-black);
      cursor: pointer;
      box-shadow: var(--ui-shadow-sm);
    }
    .line__remove:active { box-shadow: none; transform: translate(2px, 2px); }
    .total {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: var(--ui-sp-3);
      margin-top: var(--ui-sp-3);
      border-top: var(--ui-border-w-md) solid var(--ui-border);
      font-size: var(--ui-fs-lg);
      font-weight: var(--ui-fw-black);
    }
  `],
})
export class OcFormModalComponent {
  private readonly fb = inject(FormBuilder);
  protected readonly data = inject(DataService);
  private readonly toast = inject(ToastService);

  readonly isOpen = input.required<boolean>();
  readonly closed = output<void>();
  readonly saved = output<void>();

  readonly form = this.fb.group({
    supplier: this.fb.control('', { nonNullable: true, validators: [Validators.required] }),
    expectedDate: this.fb.control(''),
    items: this.fb.array<LineGroup>([]),
  });

  get lines(): FormArray<LineGroup> {
    return this.form.get('items') as FormArray<LineGroup>;
  }

  readonly total = computed(() => {
    const v = this.form.getRawValue();
    return v.items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unitCost) || 0), 0);
  });

  /** Productos sin receta disponibles para compra. */
  readonly reventaProducts = computed(() =>
    this.data.activeProducts().filter(p => !p.hasRecipe)
  );

  buildLineGroup(itemRef = '', qty = 1, unitCost = 0) {
    return this.fb.group({
      itemRef: this.fb.control(itemRef, { nonNullable: true, validators: [Validators.required] }),
      qty: this.fb.control(qty, { nonNullable: true, validators: [Validators.required, Validators.min(0.001)] }),
      unitCost: this.fb.control(unitCost, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
    });
  }

  addLine() { this.lines.push(this.buildLineGroup()); }
  removeLine(i: number) { this.lines.removeAt(i); }

  constructor() {
    effect(() => {
      if (this.isOpen()) {
        this.lines.clear();
        this.form.reset({ supplier: '', expectedDate: '', items: [] });
        this.addLine();
      }
    });
  }

  async onSubmit() {
    if (this.form.invalid || this.lines.length === 0) {
      this.form.markAllAsTouched();
      await this.toast.show('Completa todos los campos requeridos.', 'danger');
      return;
    }
    const v = this.form.getRawValue();
    const items: PurchaseOrderItem[] = [];
    for (const it of v.items) {
      const ref = (it.itemRef ?? '').toString();
      const [kind, id] = ref.split(':');
      if (kind === 'sup' && id) {
        const sup = this.data.supplyById(id);
        if (!sup) continue;
        items.push({ supplyId: id, itemName: sup.name, qty: Number(it.qty), unitCost: Number(it.unitCost) });
      } else if (kind === 'prod' && id) {
        const prod = this.data.productById(id);
        if (!prod) continue;
        items.push({ productId: id, itemName: prod.name, qty: Number(it.qty), unitCost: Number(it.unitCost) });
      }
    }
    if (items.length === 0) {
      await this.toast.show('No hay líneas válidas para crear la OC.', 'danger');
      return;
    }
    const totalCost = items.reduce((s, it) => s + it.qty * it.unitCost, 0);
    this.data.createPurchaseOrder({
      supplier: v.supplier.trim(),
      status: 'pending',
      items,
      totalCost,
      expectedDate: v.expectedDate ? new Date(v.expectedDate) : undefined,
    });
    await this.toast.show(`OC para ${v.supplier} creada.`);
    this.saved.emit();
  }
}
