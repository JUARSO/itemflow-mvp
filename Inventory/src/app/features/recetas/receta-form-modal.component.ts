import { ChangeDetectionStrategy, Component, effect, inject, input, output } from '@angular/core';
import { FormArray, FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonButton } from '@ionic/angular/standalone';
import { FormModalComponent } from '../../shared/components/form-modal/form-modal.component';
import { FormFieldComponent } from '../../shared/components/form-field/form-field.component';
import { Recipe } from '../../core/models';
import { DataService } from '../../core/services/data.service';
import { ToastService } from '../../shared/components/toast/toast.service';

type ItemGroup = ReturnType<RecetaFormModalComponent['buildItemGroup']>;

@Component({
  selector: 'app-receta-form-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, IonButton, FormModalComponent, FormFieldComponent],
  template: `
    <app-form-modal
      [isOpen]="isOpen()"
      [title]="editing() ? 'Editar receta' : 'Nueva receta'"
      (dismissed)="closed.emit()">

      <form body [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
        <div class="row">
          <app-form-field label="Producto" [required]="true" hint="Solo productos sin receta aparecen aquí">
            <select formControlName="productId">
              <option value="">— Selecciona —</option>
              @for (p of productosDisponibles(); track p.id) {
                <option [value]="p.id">{{ p.name }}</option>
              }
            </select>
          </app-form-field>
          <app-form-field label="Rinde (cantidad)" [required]="true" hint="Unidades de producto que produce una corrida">
            <input type="number" formControlName="yieldQty" min="1" />
          </app-form-field>
        </div>

        <div class="items">
          <div class="items__head">
            <h3>Insumos requeridos</h3>
            <ion-button size="small" fill="clear" class="ghost" (click)="addItem()">+ Agregar insumo</ion-button>
          </div>

          @if (items.controls.length === 0) {
            <div class="items__empty">
              Agrega al menos un insumo para definir la receta.
            </div>
          }

          <div formArrayName="items" class="items__list">
            @for (ctrl of items.controls; track $index) {
              <div [formGroupName]="$index" class="item">
                <select formControlName="supplyId" class="item__supply">
                  <option value="">— Insumo —</option>
                  @for (s of data.activeSupplies(); track s.id) {
                    <option [value]="s.id">{{ s.name }} ({{ s.unit }})</option>
                  }
                </select>
                <input
                  type="number"
                  formControlName="qty"
                  placeholder="Cantidad"
                  min="0"
                  step="0.001"
                  class="item__qty mono" />
                <button type="button" class="item__remove" (click)="removeItem($index)" aria-label="Eliminar">×</button>
              </div>
            }
          </div>
        </div>
      </form>

      <div footer>
        <ion-button fill="clear" class="ghost" (click)="closed.emit()">Cancelar</ion-button>
        <ion-button (click)="onSubmit()" [disabled]="form.invalid || items.length === 0">
          {{ editing() ? 'Guardar cambios' : 'Crear receta' }}
        </ion-button>
      </div>
    </app-form-modal>
  `,
  styles: [`
    .row { display: grid; grid-template-columns: 2fr 1fr; gap: var(--ui-sp-3); }
    @media (max-width: 480px) { .row { grid-template-columns: 1fr; } }

    .items {
      border: var(--ui-border-w-md) solid var(--ui-border);
      background: var(--ui-surface-2);
      padding: var(--ui-sp-3);
      margin-top: var(--ui-sp-3);
    }
    .items__head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: var(--ui-sp-2);
    }
    .items__head h3 {
      font-size: var(--ui-fs-md);
      font-weight: var(--ui-fw-black);
      margin: 0;
    }
    .items__empty {
      padding: var(--ui-sp-4);
      text-align: center;
      color: var(--ui-text-muted);
      font-size: var(--ui-fs-sm);
    }
    .items__list { display: grid; gap: var(--ui-sp-2); }
    .item {
      display: grid;
      grid-template-columns: 1fr 100px 36px;
      gap: var(--ui-sp-2);
      align-items: center;
    }
    .item__supply, .item__qty {
      padding: 8px 10px;
      border: var(--ui-border-w-md) solid var(--ui-border);
      background: var(--ui-surface);
      font-family: var(--ui-font-sans);
      font-size: var(--ui-fs-sm);
      color: var(--ui-text);
      min-height: 40px;
    }
    .item__qty { font-family: var(--ui-font-mono); text-align: right; }
    .item__remove {
      width: 36px;
      height: 36px;
      background: var(--ui-danger);
      color: #fff;
      border: var(--ui-border-w-md) solid var(--ui-border);
      font-size: 20px;
      font-weight: var(--ui-fw-black);
      cursor: pointer;
      box-shadow: var(--ui-shadow-sm);
    }
    .item__remove:active { box-shadow: none; transform: translate(2px, 2px); }
  `],
})
export class RecetaFormModalComponent {
  private readonly fb = inject(FormBuilder);
  protected readonly data = inject(DataService);
  private readonly toast = inject(ToastService);

  readonly isOpen = input.required<boolean>();
  readonly editing = input<Recipe | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();

  readonly form = this.fb.group({
    productId: this.fb.control('', { nonNullable: true, validators: [Validators.required] }),
    yieldQty: this.fb.control(1, { nonNullable: true, validators: [Validators.required, Validators.min(1)] }),
    items: this.fb.array<ItemGroup>([]),
  });

  get items(): FormArray<ItemGroup> {
    return this.form.get('items') as FormArray<ItemGroup>;
  }

  productosDisponibles = () => {
    const editing = this.editing();
    // si editando, incluir el producto actual; sino solo productos sin receta
    return this.data.activeProducts().filter(p =>
      p.id === editing?.productId || !p.hasRecipe
    );
  };

  buildItemGroup(supplyId = '', qty = 1) {
    return this.fb.group({
      supplyId: this.fb.control(supplyId, { nonNullable: true, validators: [Validators.required] }),
      qty: this.fb.control(qty, { nonNullable: true, validators: [Validators.required, Validators.min(0.001)] }),
    });
  }

  addItem() {
    this.items.push(this.buildItemGroup());
  }

  removeItem(i: number) {
    this.items.removeAt(i);
  }

  constructor() {
    effect(() => {
      const r = this.editing();
      this.items.clear();
      if (r) {
        this.form.patchValue({ productId: r.productId, yieldQty: r.yieldQty });
        r.items.forEach(it => this.items.push(this.buildItemGroup(it.supplyId, it.qty)));
      } else if (this.isOpen()) {
        this.form.reset({ productId: '', yieldQty: 1, items: [] });
        this.addItem();
      }
    });
  }

  async onSubmit() {
    if (this.form.invalid || this.items.length === 0) {
      this.form.markAllAsTouched();
      await this.toast.show('Completa el producto, rendimiento y al menos un insumo.', 'danger');
      return;
    }
    const v = this.form.getRawValue();
    const product = this.data.productById(v.productId);
    if (!product) {
      await this.toast.show('Producto no encontrado.', 'danger');
      return;
    }
    const recipe: Recipe = {
      id: product.id,
      productId: product.id,
      productName: product.name,
      yieldQty: Number(v.yieldQty),
      items: v.items.map(it => {
        const sup = this.data.supplyById(it.supplyId);
        return {
          supplyId: it.supplyId,
          supplyName: sup?.name ?? '',
          qty: Number(it.qty),
          unit: sup?.unit ?? '',
        };
      }),
    };
    this.data.saveRecipe(recipe);
    await this.toast.show(`Receta de "${product.name}" guardada.`);
    this.saved.emit();
  }
}
