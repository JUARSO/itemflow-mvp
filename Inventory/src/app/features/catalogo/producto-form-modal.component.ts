import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { FormModalComponent } from '../../shared/components/form-modal/form-modal.component';
import { FormFieldComponent } from '../../shared/components/form-field/form-field.component';
import { Product, Unit } from '../../core/models';
import { UNIT_GROUPS, unitsByGroup } from '../../core/units';
import { DataService } from '../../core/services/data.service';
import { ToastService } from '../../shared/components/toast/toast.service';

@Component({
  selector: 'app-producto-form-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, ReactiveFormsModule, IonButton, IonIcon, FormModalComponent, FormFieldComponent],
  templateUrl: './producto-form-modal.component.html',
  styleUrls: ['./producto-form-modal.component.scss'],
})
export class ProductoFormModalComponent {
  private readonly fb = inject(FormBuilder);
  private readonly data = inject(DataService);
  private readonly toast = inject(ToastService);

  // Para el <select> agrupado de unidades en el template
  protected readonly unitGroups = UNIT_GROUPS;
  protected readonly unitsGrouped = unitsByGroup();

  readonly isOpen = input.required<boolean>();
  readonly editing = input<Product | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();

  readonly form = this.fb.group({
    sku: this.fb.control('', { nonNullable: true, validators: [Validators.required] }),
    name: this.fb.control('', { nonNullable: true, validators: [Validators.required] }),
    category: this.fb.control(''),
    unit: this.fb.control<Unit>('unidad', { nonNullable: true, validators: [Validators.required] }),
    buyPrice: this.fb.control(0, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
    otherCost: this.fb.control(0, { nonNullable: true, validators: [Validators.min(0)] }),
    leadTime: this.fb.control(1, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
    hasRecipe: this.fb.control(false, { nonNullable: true }),
    reorderPoint: this.fb.control<number | null>(null),
    minStock: this.fb.control<number | null>(null),
    description: this.fb.control(''),
  });

  // Signal sincronizada con el control hasRecipe para condicionar el template.
  private readonly _hasRecipeSignal = signal(false);
  readonly isReventa = computed(() => !this._hasRecipeSignal());

  /**
   * Costo calculado desde la receta del producto editado. null si está creando
   * un producto nuevo (sin id todavía) o si no tiene receta aún.
   */
  readonly recipeCost = computed<number | null>(() => {
    if (this.isReventa()) return null;
    const editing = this.editing();
    if (!editing) return null; // creando nuevo, no hay receta todavía
    return this.data.computeRecipeCost(editing.id);
  });

  readonly recipeCostHint = computed<string | null>(() => {
    if (this.isReventa()) return null;
    const editing = this.editing();
    if (!editing) {
      return 'Crea el producto, luego define la receta en /recetas — el costo se calcula automáticamente.';
    }
    const cost = this.recipeCost();
    if (cost == null) {
      return 'Aún no hay receta para este producto. Defínela en /recetas para calcular el costo.';
    }
    const recipe = this.data.recipeFor(editing.id);
    const items = recipe?.items.length ?? 0;
    return `Σ de ${items} insumo${items === 1 ? '' : 's'} ÷ rinde ${recipe?.yieldQty} = costo unitario`;
  });

  /** Costo total mostrado en el form: materiales (compra/receta) + otros. */
  costoTotal(): number {
    const mat = Number(this.form.controls.buyPrice.value) || 0;
    const otros = Number(this.form.controls.otherCost.value) || 0;
    return mat + otros;
  }

  onHasRecipeChange() {
    const newVal = this.form.controls.hasRecipe.value;
    this._hasRecipeSignal.set(newVal);
    this.syncRecipeCostToForm();
  }

  /** Si está marcado hasRecipe, sobrescribe buyPrice del form con el costo calculado. */
  private syncRecipeCostToForm() {
    if (this.isReventa()) return;
    const cost = this.recipeCost();
    if (cost != null) {
      this.form.controls.buyPrice.setValue(cost);
    }
  }

  constructor() {
    effect(() => {
      const p = this.editing();
      if (p) {
        this.form.reset({
          sku: p.sku,
          name: p.name,
          category: p.category ?? '',
          unit: p.unit,
          buyPrice: p.buyPrice,
          otherCost: p.otherCost ?? 0,
          leadTime: p.leadTime,
          hasRecipe: p.hasRecipe,
          reorderPoint: p.reorderPoint ?? null,
          minStock: p.minStock ?? null,
          description: p.description ?? '',
        });
        this._hasRecipeSignal.set(p.hasRecipe);
        // Si tiene receta, sobrescribir el buyPrice con el costo calculado.
        this.syncRecipeCostToForm();
      } else if (this.isOpen()) {
        this.form.reset({
          sku: '',
          name: '',
          category: '',
          unit: 'unidad',
          buyPrice: 0,
          otherCost: 0,
          leadTime: 1,
          hasRecipe: false,
          reorderPoint: null,
          minStock: null,
          description: '',
        });
        this._hasRecipeSignal.set(false);
      }
    });
  }

  async onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      await this.toast.show('Revisa los campos requeridos.', 'danger');
      return;
    }
    const v = this.form.getRawValue();
    const isReventa = !v.hasRecipe;
    // Si tiene receta, el costo siempre viene del cálculo desde insumos.
    // Esto evita guardar un buyPrice stale si la receta cambió mientras tanto.
    const editing = this.editing();
    const computedCost = !isReventa && editing
      ? this.data.computeRecipeCost(editing.id)
      : null;
    const finalBuyPrice = computedCost ?? Number(v.buyPrice);
    const rop = isReventa && v.reorderPoint != null && v.reorderPoint !== ('' as unknown as number)
      ? Number(v.reorderPoint) : undefined;
    const ms = isReventa && v.minStock != null && v.minStock !== ('' as unknown as number)
      ? Number(v.minStock) : undefined;
    if (rop != null && ms != null && ms > rop) {
      await this.toast.show('Stock mínimo no puede ser mayor al punto de reorden.', 'danger');
      return;
    }
    const base = {
      sku: v.sku.trim(),
      name: v.name.trim(),
      category: v.category?.trim() || undefined,
      unit: v.unit,
      buyPrice: finalBuyPrice,
      otherCost: Number(v.otherCost) || 0,
      // El precio de venta se maneja en Ventas (catálogo de ventas). Acá solo se preserva
      // la semilla existente al editar; los nuevos productos arrancan sin precio (0).
      sellPrice: editing?.sellPrice ?? 0,
      leadTime: Number(v.leadTime),
      hasRecipe: v.hasRecipe,
      reorderPoint: rop,
      minStock: ms,
      description: v.description?.trim() || undefined,
      active: true,
    };
    if (editing) {
      this.data.updateProduct({ ...editing, ...base });
      await this.toast.show(`Producto "${base.name}" actualizado.`);
    } else {
      this.data.createProduct(base);
      await this.toast.show(`Producto "${base.name}" creado.`);
    }
    this.saved.emit();
  }
}
