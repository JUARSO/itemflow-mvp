import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonButton } from '@ionic/angular/standalone';
import { FormModalComponent } from '../../shared/components/form-modal/form-modal.component';
import { FormFieldComponent } from '../../shared/components/form-field/form-field.component';
import { Product } from '../../core/models';
import { DataService } from '../../core/services/data.service';
import { ToastService } from '../../shared/components/toast/toast.service';

@Component({
  selector: 'app-producto-form-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, IonButton, FormModalComponent, FormFieldComponent],
  template: `
    <app-form-modal
      [isOpen]="isOpen()"
      [title]="editing() ? 'Editar producto' : 'Nuevo producto'"
      (dismissed)="closed.emit()">

      <form body [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
        <div class="row">
          <app-form-field label="SKU" [required]="true" hint="Código único, ej. PROD-BAG-001">
            <input type="text" formControlName="sku" class="mono" />
          </app-form-field>
          <app-form-field label="Unidad" [required]="true">
            <select formControlName="unit">
              <option value="unidad">unidad</option>
              <option value="kg">kg</option>
              <option value="g">g</option>
              <option value="L">L</option>
              <option value="ml">ml</option>
            </select>
          </app-form-field>
        </div>

        <app-form-field label="Nombre" [required]="true">
          <input type="text" formControlName="name" />
        </app-form-field>

        <div class="row">
          <app-form-field label="Categoría">
            <input type="text" formControlName="category" placeholder="Ej. Panes" />
          </app-form-field>
          <app-form-field label="Lead time (días)" [required]="true">
            <input type="number" formControlName="leadTime" min="0" />
          </app-form-field>
        </div>

        <div class="row">
          <app-form-field label="Precio compra (costo)" [required]="true">
            <input type="number" formControlName="buyPrice" min="0" />
          </app-form-field>
          <app-form-field label="Precio venta" [required]="true">
            <input type="number" formControlName="sellPrice" min="0" />
          </app-form-field>
        </div>

        <app-form-field label="¿Usa receta?" hint="Marca si vender este producto debe descontar insumos (no su propio stock)">
          <label class="check">
            <input type="checkbox" formControlName="hasRecipe" (change)="onHasRecipeChange()" />
            <span>Sí, descontar insumos al vender</span>
          </label>
        </app-form-field>

        @if (!isReventa()) {
          <div class="info-box">
            ℹ️ Producto con receta. El stock se controla mediante los insumos definidos en la receta.
          </div>
        } @else {
          <div class="row">
            <app-form-field label="Punto de reorden" hint="Stock bajo este nivel dispara alerta de restock (opcional)">
              <input type="number" formControlName="reorderPoint" min="0" step="0.001" />
            </app-form-field>
            <app-form-field label="Stock mínimo" hint="Stock crítico, por debajo aplica alerta alta (opcional)">
              <input type="number" formControlName="minStock" min="0" step="0.001" />
            </app-form-field>
          </div>
        }

        <app-form-field label="Descripción">
          <textarea formControlName="description" rows="2"></textarea>
        </app-form-field>
      </form>

      <div footer>
        <ion-button fill="clear" class="ghost" (click)="closed.emit()">Cancelar</ion-button>
        <ion-button (click)="onSubmit()" [disabled]="form.invalid">
          {{ editing() ? 'Guardar cambios' : 'Crear producto' }}
        </ion-button>
      </div>
    </app-form-modal>
  `,
  styles: [`
    .row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--ui-sp-3);
    }
    @media (max-width: 480px) { .row { grid-template-columns: 1fr; } }
    .check {
      display: flex;
      align-items: center;
      gap: var(--ui-sp-2);
      cursor: pointer;
      padding: var(--ui-sp-2) 0;
    }
    .check input[type="checkbox"] { width: 20px; height: 20px; cursor: pointer; }
    .info-box {
      padding: var(--ui-sp-3);
      background: var(--ui-surface-2);
      border-left: 3px solid var(--ui-primary);
      font-size: var(--ui-fs-sm);
      color: var(--ui-text-muted);
      margin-bottom: var(--ui-sp-3);
    }
  `],
})
export class ProductoFormModalComponent {
  private readonly fb = inject(FormBuilder);
  private readonly data = inject(DataService);
  private readonly toast = inject(ToastService);

  readonly isOpen = input.required<boolean>();
  readonly editing = input<Product | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();

  readonly form = this.fb.group({
    sku: this.fb.control('', { nonNullable: true, validators: [Validators.required] }),
    name: this.fb.control('', { nonNullable: true, validators: [Validators.required] }),
    category: this.fb.control(''),
    unit: this.fb.control('unidad', { nonNullable: true, validators: [Validators.required] }),
    buyPrice: this.fb.control(0, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
    sellPrice: this.fb.control(0, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
    leadTime: this.fb.control(1, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
    hasRecipe: this.fb.control(false, { nonNullable: true }),
    reorderPoint: this.fb.control<number | null>(null),
    minStock: this.fb.control<number | null>(null),
    description: this.fb.control(''),
  });

  // Signal sincronizada con el control hasRecipe para condicionar el template.
  private readonly _hasRecipeSignal = signal(false);
  readonly isReventa = computed(() => !this._hasRecipeSignal());

  onHasRecipeChange() {
    this._hasRecipeSignal.set(this.form.controls.hasRecipe.value);
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
          sellPrice: p.sellPrice,
          leadTime: p.leadTime,
          hasRecipe: p.hasRecipe,
          reorderPoint: p.reorderPoint ?? null,
          minStock: p.minStock ?? null,
          description: p.description ?? '',
        });
        this._hasRecipeSignal.set(p.hasRecipe);
      } else if (this.isOpen()) {
        this.form.reset({
          sku: '',
          name: '',
          category: '',
          unit: 'unidad',
          buyPrice: 0,
          sellPrice: 0,
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
      buyPrice: Number(v.buyPrice),
      sellPrice: Number(v.sellPrice),
      leadTime: Number(v.leadTime),
      hasRecipe: v.hasRecipe,
      reorderPoint: rop,
      minStock: ms,
      description: v.description?.trim() || undefined,
      active: true,
    };
    const editing = this.editing();
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
