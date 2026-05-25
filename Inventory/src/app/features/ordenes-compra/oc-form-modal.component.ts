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
            <select formControlName="supplierId" (change)="onSupplierChange()">
              <option value="">— Selecciona proveedor —</option>
              @for (s of data.activeSuppliers(); track s.id) {
                <option [value]="s.id">{{ s.name }}</option>
              }
              <option value="__other__">Otro (escribir nombre)</option>
            </select>
          </app-form-field>
          <app-form-field label="Fecha esperada de entrega">
            <input type="date" formControlName="expectedDate" />
          </app-form-field>
        </div>

        @if (form.controls.supplierId.value === '__other__') {
          <app-form-field label="Nombre del proveedor (manual)" [required]="true">
            <input type="text" formControlName="supplierName" placeholder="Ej. Molinos del Sur" />
          </app-form-field>
        } @else if (selectedSupplier(); as s) {
          <div class="supplier-meta">
            <span>
              <strong>Lead time:</strong> {{ s.leadTimeDays }} día(s)
              · <strong>Pago:</strong> {{ s.paymentTerms || '—' }}
            </span>
            @if (s.suppliedItems.length > 0) {
              <small>{{ s.suppliedItems.length }} item(s) registrados → aparecen primero abajo.</small>
            } @else {
              <small class="warn">
                Este proveedor no tiene insumos vinculados.
                Podés editarlo en Proveedores para verlos prioritarios.
              </small>
            }
          </div>
        }

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
                  @if (supplierItemRefs().length > 0) {
                    <optgroup [label]="'Asignados a ' + (selectedSupplier()?.name ?? '')">
                      @for (s of supplierSupplies(); track s.id) {
                        <option [value]="'sup:' + s.id">{{ s.name }} ({{ s.unit }})</option>
                      }
                      @for (p of supplierProducts(); track p.id) {
                        <option [value]="'prod:' + p.id">{{ p.name }} ({{ p.unit }}) · reventa</option>
                      }
                    </optgroup>
                  }
                  <optgroup [label]="supplierItemRefs().length > 0 ? 'Otros insumos' : 'Insumos'">
                    @for (s of nonSupplierSupplies(); track s.id) {
                      <option [value]="'sup:' + s.id">{{ s.name }} ({{ s.unit }})</option>
                    }
                  </optgroup>
                  <optgroup [label]="supplierItemRefs().length > 0 ? 'Otros productos de reventa' : 'Productos de reventa'">
                    @for (p of nonSupplierProducts(); track p.id) {
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

    .supplier-meta {
      margin-top: var(--ui-sp-2);
      padding: var(--ui-sp-2) var(--ui-sp-3);
      background: var(--ui-surface-2);
      border-left: 4px solid var(--ui-primary);
      display: flex; flex-direction: column;
      gap: 2px;
      font-size: var(--ui-fs-sm);
    }
    .supplier-meta small { font-size: var(--ui-fs-xs); color: var(--ui-text-muted); }
    .supplier-meta small.warn { color: var(--ui-danger); font-weight: var(--ui-fw-bold); }

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
    /** Id del proveedor registrado, o '__other__' para nombre manual. */
    supplierId: this.fb.control('', { nonNullable: true, validators: [Validators.required] }),
    /** Solo usado si supplierId === '__other__'. */
    supplierName: this.fb.control('', { nonNullable: true }),
    expectedDate: this.fb.control(''),
    items: this.fb.array<LineGroup>([]),
  });

  /** Proveedor estructurado seleccionado (null si '' o '__other__'). */
  readonly selectedSupplier = computed(() => {
    const id = this.form.controls.supplierId.value;
    if (!id || id === '__other__') return null;
    return this.data.supplierById(id) ?? null;
  });

  /** Set de "kind:itemId" que entrega el proveedor seleccionado. */
  readonly supplierItemRefs = computed(() => {
    const s = this.selectedSupplier();
    if (!s) return [] as string[];
    return s.suppliedItems.map(i => `${i.kind}:${i.itemId}`);
  });

  readonly supplierSupplies = computed(() => {
    const refs = new Set(this.supplierItemRefs());
    return this.data.activeSupplies().filter(s => refs.has(`supply:${s.id}`));
  });
  readonly supplierProducts = computed(() => {
    const refs = new Set(this.supplierItemRefs());
    return this.reventaProducts().filter(p => refs.has(`product:${p.id}`));
  });
  readonly nonSupplierSupplies = computed(() => {
    const refs = new Set(this.supplierItemRefs());
    return this.data.activeSupplies().filter(s => !refs.has(`supply:${s.id}`));
  });
  readonly nonSupplierProducts = computed(() => {
    const refs = new Set(this.supplierItemRefs());
    return this.reventaProducts().filter(p => !refs.has(`product:${p.id}`));
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

  /** Al elegir un proveedor registrado: precarga expectedDate con today + leadTime. */
  onSupplierChange() {
    const s = this.selectedSupplier();
    if (!s) return;
    if (!this.form.controls.expectedDate.value) {
      const d = new Date();
      d.setDate(d.getDate() + s.leadTimeDays);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      this.form.controls.expectedDate.setValue(iso);
    }
  }

  constructor() {
    effect(() => {
      if (this.isOpen()) {
        this.lines.clear();
        this.form.reset({ supplierId: '', supplierName: '', expectedDate: '', items: [] });
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

    // Resolver nombre del proveedor (registrado o manual)
    let supplierName = '';
    if (v.supplierId === '__other__') {
      supplierName = v.supplierName.trim();
      if (!supplierName) {
        await this.toast.show('Escribí el nombre del proveedor.', 'danger');
        return;
      }
    } else {
      const s = this.data.supplierById(v.supplierId);
      if (!s) {
        await this.toast.show('Proveedor no encontrado.', 'danger');
        return;
      }
      supplierName = s.name;
    }

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
      supplier: supplierName,
      status: 'pending',
      items,
      totalCost,
      expectedDate: v.expectedDate ? new Date(v.expectedDate) : undefined,
    });
    await this.toast.show(`OC para ${supplierName} creada.`);
    this.saved.emit();
  }
}
