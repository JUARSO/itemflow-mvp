import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { startWith } from 'rxjs';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { FormModalComponent } from '../../shared/components/form-modal/form-modal.component';
import { FormFieldComponent } from '../../shared/components/form-field/form-field.component';
import { Supply, Unit } from '../../core/models';
import { UNIT_GROUPS, unitsByGroup } from '../../core/units';
import { DataService } from '../../core/services/data.service';
import { ToastService } from '../../shared/components/toast/toast.service';

@Component({
  selector: 'app-insumo-form-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, DecimalPipe, IonButton, IonIcon, FormModalComponent, FormFieldComponent],
  templateUrl: './insumo-form-modal.component.html',
  styleUrls: ['./insumo-form-modal.component.scss'],
})
export class InsumoFormModalComponent {
  private readonly fb = inject(FormBuilder);
  protected readonly data = inject(DataService);
  private readonly toast = inject(ToastService);

  // Para el <select> agrupado de unidades en el template
  protected readonly unitGroups = UNIT_GROUPS;
  protected readonly unitsGrouped = unitsByGroup();

  readonly isOpen = input.required<boolean>();
  readonly editing = input<Supply | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();

  /** Proveedores que entregan este insumo (N..M) con precio opcional por proveedor. */
  readonly selectedEntries = signal<{ supplierId: string; unitCost?: number }[]>([]);

  /** Entradas con precio asignado (filtra los undefined). */
  readonly pricedEntries = computed(() =>
    this.selectedEntries().filter(e => e.unitCost != null && e.unitCost > 0)
  );

  /** Cuántos proveedores tienen precio cargado. */
  readonly pricedCount = computed(() => this.pricedEntries().length);

  /** Promedio aritmético de los precios de proveedores; null si ninguno tiene precio. */
  readonly avgPrice = computed<number | null>(() => {
    const arr = this.pricedEntries();
    if (arr.length === 0) return null;
    const sum = arr.reduce((a, e) => a + (e.unitCost ?? 0), 0);
    return Math.round((sum / arr.length) * 100) / 100;
  });

  isSelected(supplierId: string): boolean {
    return this.selectedEntries().some(e => e.supplierId === supplierId);
  }

  supplierName(id: string): string {
    return this.data.supplierById(id)?.name ?? '—';
  }

  readonly form = this.fb.group({
    sku: this.fb.control('', { nonNullable: true, validators: [Validators.required] }),
    name: this.fb.control('', { nonNullable: true, validators: [Validators.required] }),
    category: this.fb.control(''),
    unit: this.fb.control<Unit>('kg', { nonNullable: true, validators: [Validators.required] }),
    /**
     * Stocks ingresados en PRESENTACIONES si hay presentación; en unidad base
     * si no. Al guardar se multiplica por presentationSize para almacenar en
     * unidad base internamente.
     */
    minStock: this.fb.control(0, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
    maxStock: this.fb.control(0, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
    reorderPoint: this.fb.control(0, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
    description: this.fb.control(''),
    /** Presentación: si tamaño y etiqueta están seteados, el insumo se maneja en presentaciones. */
    presentationSize: this.fb.control<number | null>(null),
    presentationLabel: this.fb.control(''),
  });

  // === Signals reactivos vía toSignal ===
  // Convertimos los valueChanges de cada FormControl a signals para que los
  // computed reactivos disparen change detection al cambiar el form.
  private readonly sizeSig = toSignal(
    this.form.controls.presentationSize.valueChanges.pipe(
      startWith(this.form.controls.presentationSize.value),
    ),
    { initialValue: this.form.controls.presentationSize.value },
  );
  private readonly labelSig = toSignal(
    this.form.controls.presentationLabel.valueChanges.pipe(
      startWith(this.form.controls.presentationLabel.value),
    ),
    { initialValue: this.form.controls.presentationLabel.value },
  );
  private readonly unitSig = toSignal(
    this.form.controls.unit.valueChanges.pipe(
      startWith(this.form.controls.unit.value),
    ),
    { initialValue: this.form.controls.unit.value },
  );
  private readonly minStockSig = toSignal(
    this.form.controls.minStock.valueChanges.pipe(
      startWith(this.form.controls.minStock.value),
    ),
    { initialValue: this.form.controls.minStock.value },
  );
  private readonly maxStockSig = toSignal(
    this.form.controls.maxStock.valueChanges.pipe(
      startWith(this.form.controls.maxStock.value),
    ),
    { initialValue: this.form.controls.maxStock.value },
  );
  private readonly reorderPointSig = toSignal(
    this.form.controls.reorderPoint.valueChanges.pipe(
      startWith(this.form.controls.reorderPoint.value),
    ),
    { initialValue: this.form.controls.reorderPoint.value },
  );

  /** Datos de la presentación si el form los tiene completos, sino null. */
  readonly presentation = computed<{ size: number; label: string } | null>(() => {
    const size = Number(this.sizeSig());
    const label = (this.labelSig() ?? '').trim();
    if (!isFinite(size) || size <= 0 || !label) return null;
    return { size, label };
  });

  /** Alias para que el template siga llamando presentationPreview(). */
  presentationPreview(): { size: number; label: string } | null {
    return this.presentation();
  }

  /** Unidad base del form (reactiva). */
  readonly currentUnit = computed(() => this.unitSig());

  /** Label dinámico de stock: cambia entre "(unidades base)" y "(presentaciones)". */
  readonly minStockLabel = computed(() => this.buildStockLabel('Stock mínimo'));
  readonly maxStockLabel = computed(() => this.buildStockLabel('Stock máximo'));
  readonly reorderPointLabel = computed(() => this.buildStockLabel('Punto de reorden'));

  /** Step del input: 1 para presentaciones (entero), 0.001 para unidad base. */
  readonly stockStepValue = computed<string>(() => this.presentation() ? '1' : '0.001');

  /** Equivalentes en unidad base, reactivos a cualquier cambio. */
  readonly minStockEq = computed(() => this.calcEquivalent(this.minStockSig()));
  readonly maxStockEq = computed(() => this.calcEquivalent(this.maxStockSig()));
  readonly reorderPointEq = computed(() => this.calcEquivalent(this.reorderPointSig()));

  /**
   * Reglas:
   *  - reorderPoint ≥ minStock (el punto de reorden no puede ser menor al mínimo)
   *  - maxStock ≥ reorderPoint (el máximo debe poder cubrir el reorden)
   * Devuelve `null` si todo OK, o un mensaje de error específico.
   */
  readonly stocksError = computed<string | null>(() => {
    const min = Number(this.minStockSig() ?? 0);
    const rop = Number(this.reorderPointSig() ?? 0);
    const max = Number(this.maxStockSig() ?? 0);
    if (rop < min) {
      return `El punto de reorden (${rop}) no puede ser menor al stock mínimo (${min}).`;
    }
    if (max < rop) {
      return `El stock máximo (${max}) no puede ser menor al punto de reorden (${rop}).`;
    }
    if (max <= 0) {
      return 'El stock máximo debe ser mayor a cero.';
    }
    return null;
  });

  private buildStockLabel(base: string): string {
    const p = this.presentation();
    return p ? `${base} (${this.pluralLabel(p.label)})` : `${base} (${this.currentUnit()})`;
  }

  private calcEquivalent(value: number | null): string | null {
    const p = this.presentation();
    if (!p) return null;
    const v = Number(value);
    if (!isFinite(v) || v <= 0) return null;
    const total = Math.round(v * p.size * 100) / 100;
    return `${total} ${this.currentUnit()}`;
  }

  private pluralLabel(label: string): string {
    const l = label.trim();
    if (!l) return '';
    return l.endsWith('s') ? l : l + 's';
  }

  /** Costo del insumo previo (cuando se está editando). */
  private readonly existingCost = signal(0);

  /**
   * Costo unitario efectivo que se mostrará en el campo (read-only):
   * promedio de precios de proveedores si los hay; sino, costo previo del
   * insumo (si se está editando); sino, 0.
   */
  readonly effectiveCost = computed(() => {
    const avg = this.avgPrice();
    if (avg != null) return avg;
    return this.existingCost();
  });

  readonly costHint = computed(() => {
    if (this.avgPrice() != null) {
      return `Promedio automático de ${this.pricedCount()} proveedor(es) con precio asignado.`;
    }
    if (this.selectedEntries().length > 0) {
      return 'Ningún proveedor seleccionado tiene precio asignado — define al menos uno arriba.';
    }
    return 'Selecciona proveedores arriba y asigna precios para calcular el costo automáticamente.';
  });

  constructor() {
    effect(() => {
      const s = this.editing();
      if (s) {
        const psize = s.presentation?.size ?? 1;
        const inPresentations = (v: number) =>
          s.presentation ? Math.round((v / psize) * 1000) / 1000 : v;
        this.form.reset({
          sku: s.sku, name: s.name, category: s.category ?? '',
          unit: s.unit,
          minStock: inPresentations(s.minStock),
          maxStock: inPresentations(s.maxStock),
          reorderPoint: inPresentations(s.reorderPoint),
          description: s.description ?? '',
          presentationSize: s.presentation?.size ?? null,
          presentationLabel: s.presentation?.label ?? '',
        });
        this.existingCost.set(s.cost);
        // Cargar proveedores que ya tienen este insumo vinculado (con su precio).
        const entries = this.data.suppliersForSupply(s.id).map(sp => {
          const item = sp.suppliedItems.find(i => i.kind === 'supply' && i.itemId === s.id);
          return { supplierId: sp.id, unitCost: item?.unitCost };
        });
        this.selectedEntries.set(entries);
      } else if (this.isOpen()) {
        this.form.reset({
          sku: '', name: '', category: '',
          unit: 'kg', minStock: 0, maxStock: 0,
          reorderPoint: 0, description: '',
          presentationSize: null, presentationLabel: '',
        });
        this.existingCost.set(0);
        this.selectedEntries.set([]);
      }
    });
  }

  toggleSupplier(id: string) {
    this.selectedEntries.update(arr =>
      arr.some(e => e.supplierId === id)
        ? arr.filter(e => e.supplierId !== id)
        : [...arr, { supplierId: id, unitCost: undefined }]
    );
  }

  /** Actualiza el precio de un proveedor seleccionado. Valor vacío = undefined (usa el costo global). */
  setPrice(supplierId: string, raw: string) {
    const trimmed = (raw ?? '').trim();
    const cost = trimmed === '' ? undefined : Number(trimmed);
    const safe = cost !== undefined && (isNaN(cost) || cost < 0) ? undefined : cost;
    this.selectedEntries.update(arr =>
      arr.map(e => e.supplierId === supplierId ? { ...e, unitCost: safe } : e)
    );
  }

  async onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      await this.toast.show('Revisa los campos requeridos.', 'danger');
      return;
    }
    if (this.selectedEntries().length === 0) {
      await this.toast.show('Tenés que asignar al menos un proveedor al insumo.', 'danger');
      return;
    }
    const v = this.form.getRawValue();
    const presentation = this.presentationPreview();
    const factor = presentation?.size ?? 1; // multiplica los inputs a unidad base
    // El cost no se ingresa manualmente: viene del promedio de precios de
    // proveedores. Si no hay precios, se conserva el cost previo (o 0 si es nuevo).
    const base = {
      sku: v.sku.trim(),
      name: v.name.trim(),
      category: v.category?.trim() || undefined,
      unit: v.unit,
      cost: this.effectiveCost(),
      minStock: Number(v.minStock) * factor,
      maxStock: Number(v.maxStock) * factor,
      reorderPoint: Number(v.reorderPoint) * factor,
      description: v.description?.trim() || undefined,
      presentation: presentation ?? undefined,
      active: true,
    };
    const editing = this.editing();
    let supplyId: string;
    if (editing) {
      this.data.updateSupply({ ...editing, ...base });
      supplyId = editing.id;
      await this.toast.show(`Insumo "${base.name}" actualizado.`);
    } else {
      const created = this.data.createSupply(base);
      supplyId = created.id;
      await this.toast.show(`Insumo "${base.name}" creado.`);
    }
    // Sincronizar relación N..M con proveedores (con precios opcionales)
    this.data.setSuppliersForSupply(supplyId, this.selectedEntries());
    this.saved.emit();
  }
}
