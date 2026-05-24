import { ChangeDetectionStrategy, Component, effect, inject, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonButton } from '@ionic/angular/standalone';
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
  imports: [ReactiveFormsModule, IonButton, FormModalComponent, FormFieldComponent],
  template: `
    <app-form-modal
      [isOpen]="isOpen()"
      [title]="editing() ? 'Editar insumo' : 'Nuevo insumo'"
      (dismissed)="closed.emit()">

      <form body [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
        <div class="row">
          <app-form-field label="SKU" [required]="true">
            <input type="text" formControlName="sku" class="mono" />
          </app-form-field>
          <app-form-field label="Unidad" [required]="true">
            <select formControlName="unit">
              @for (g of unitGroups; track g) {
                <optgroup [label]="g">
                  @for (u of unitsGrouped[g]; track u.value) {
                    <option [value]="u.value">{{ u.label }}</option>
                  }
                </optgroup>
              }
            </select>
          </app-form-field>
        </div>

        <app-form-field label="Nombre" [required]="true">
          <input type="text" formControlName="name" />
        </app-form-field>

        <div class="row">
          <app-form-field label="Categoría">
            <input type="text" formControlName="category" placeholder="Ej. Cereales" />
          </app-form-field>
          <app-form-field label="Proveedor">
            <input type="text" formControlName="supplier" />
          </app-form-field>
        </div>

        <app-form-field label="Costo unitario" [required]="true" hint="Costo de compra promedio">
          <input type="number" formControlName="cost" min="0" step="0.01" />
        </app-form-field>

        <div class="row">
          <app-form-field label="Stock mínimo" [required]="true" hint="Bajo esto = crítico">
            <input type="number" formControlName="minStock" min="0" step="0.001" />
          </app-form-field>
          <app-form-field label="Stock máximo" [required]="true" hint="Sobre esto = exceso">
            <input type="number" formControlName="maxStock" min="0" step="0.001" />
          </app-form-field>
        </div>

        <div class="row">
          <app-form-field label="Punto de reorden" [required]="true">
            <input type="number" formControlName="reorderPoint" min="0" step="0.001" />
          </app-form-field>
          <app-form-field label="Lead time (días)" [required]="true">
            <input type="number" formControlName="leadTime" min="0" />
          </app-form-field>
        </div>

        <app-form-field label="Descripción">
          <textarea formControlName="description" rows="2"></textarea>
        </app-form-field>
      </form>

      <div footer>
        <ion-button fill="clear" class="ghost" (click)="closed.emit()">Cancelar</ion-button>
        <ion-button (click)="onSubmit()" [disabled]="form.invalid">
          {{ editing() ? 'Guardar cambios' : 'Crear insumo' }}
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
  `],
})
export class InsumoFormModalComponent {
  private readonly fb = inject(FormBuilder);
  private readonly data = inject(DataService);
  private readonly toast = inject(ToastService);

  // Para el <select> agrupado de unidades en el template
  protected readonly unitGroups = UNIT_GROUPS;
  protected readonly unitsGrouped = unitsByGroup();

  readonly isOpen = input.required<boolean>();
  readonly editing = input<Supply | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();

  readonly form = this.fb.group({
    sku: this.fb.control('', { nonNullable: true, validators: [Validators.required] }),
    name: this.fb.control('', { nonNullable: true, validators: [Validators.required] }),
    category: this.fb.control(''),
    supplier: this.fb.control(''),
    unit: this.fb.control<Unit>('kg', { nonNullable: true, validators: [Validators.required] }),
    cost: this.fb.control(0, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
    minStock: this.fb.control(0, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
    maxStock: this.fb.control(0, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
    reorderPoint: this.fb.control(0, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
    leadTime: this.fb.control(1, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
    description: this.fb.control(''),
  });

  constructor() {
    effect(() => {
      const s = this.editing();
      if (s) {
        this.form.reset({
          sku: s.sku, name: s.name, category: s.category ?? '', supplier: s.supplier ?? '',
          unit: s.unit, cost: s.cost, minStock: s.minStock, maxStock: s.maxStock,
          reorderPoint: s.reorderPoint, leadTime: s.leadTime, description: s.description ?? '',
        });
      } else if (this.isOpen()) {
        this.form.reset({
          sku: '', name: '', category: '', supplier: '',
          unit: 'kg', cost: 0, minStock: 0, maxStock: 0,
          reorderPoint: 0, leadTime: 1, description: '',
        });
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
    const base = {
      sku: v.sku.trim(),
      name: v.name.trim(),
      category: v.category?.trim() || undefined,
      supplier: v.supplier?.trim() || undefined,
      unit: v.unit,
      cost: Number(v.cost),
      minStock: Number(v.minStock),
      maxStock: Number(v.maxStock),
      reorderPoint: Number(v.reorderPoint),
      leadTime: Number(v.leadTime),
      description: v.description?.trim() || undefined,
      active: true,
    };
    const editing = this.editing();
    if (editing) {
      this.data.updateSupply({ ...editing, ...base });
      await this.toast.show(`Insumo "${base.name}" actualizado.`);
    } else {
      this.data.createSupply(base);
      await this.toast.show(`Insumo "${base.name}" creado.`);
    }
    this.saved.emit();
  }
}
