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
  templateUrl: './oc-form-modal.component.html',
  styleUrls: ['./oc-form-modal.component.scss'],
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
