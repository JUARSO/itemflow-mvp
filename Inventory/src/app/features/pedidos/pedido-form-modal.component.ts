import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { FormModalComponent } from '../../shared/components/form-modal/form-modal.component';
import { FormFieldComponent } from '../../shared/components/form-field/form-field.component';
import { DataService } from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../shared/components/toast/toast.service';

type ItemGroup = ReturnType<PedidoFormModalComponent['buildItemGroup']>;

@Component({
  selector: 'app-pedido-form-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, DecimalPipe, IonButton, IonIcon, FormModalComponent, FormFieldComponent],
  template: `
    <app-form-modal
      [isOpen]="isOpen()"
      title="Nueva orden de producción"
      (dismissed)="closed.emit()">

      <form body [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
        <div class="row">
          <app-form-field label="Motivo / Destino" hint="Opcional: ej. 'Reposición vitrina', 'Lote tarde'">
            <input type="text" formControlName="purpose" placeholder="Para qué es este lote" />
          </app-form-field>
        </div>

        <app-form-field label="Notas (opcional)" hint="Observaciones para producción">
          <textarea formControlName="notes" rows="2" placeholder="Ej: Priorizar baguettes"></textarea>
        </app-form-field>

        <div class="items">
          <div class="items__head">
            <h3>Productos del pedido</h3>
            <ion-button size="small" fill="clear" class="ghost" (click)="addItem()">+ Producto</ion-button>
          </div>

          @if (items.controls.length === 0) {
            <div class="items__empty">Agrega al menos un producto.</div>
          }

          <div formArrayName="items" class="items__list">
            @for (ctrl of items.controls; track $index) {
              <div [formGroupName]="$index" class="item">
                <select formControlName="productId" class="item__product" (change)="onProductChange($index)">
                  <option value="">— Producto —</option>
                  @for (p of data.activeProducts(); track p.id) {
                    <option [value]="p.id">{{ p.name }}</option>
                  }
                </select>
                <input type="number" formControlName="qty" placeholder="Cant." min="1" step="1" class="item__qty mono" />
                <input type="number" formControlName="unitPrice" placeholder="P.Unit." min="0" step="1" class="item__price mono" />
                <button type="button" class="item__remove" (click)="removeItem($index)" aria-label="Eliminar">×</button>
              </div>
            }
          </div>
        </div>

        <div class="total-box">
          <span class="total-box__label">Total pedido</span>
          <span class="total-box__value mono">₡{{ total() | number:'1.0-0' }}</span>
        </div>

        @if (analysisPreview(); as preview) {
          @if (preview.shortfalls.length > 0) {
            <div class="warning">
              <strong><ion-icon name="warning-outline"></ion-icon> Stock insuficiente:</strong> al iniciar producción solo se podrá cumplir parcialmente.
              Faltan {{ preview.shortfalls.length }} insumo(s)/producto(s).
            </div>
          }
        }
      </form>

      <div footer>
        <ion-button fill="clear" class="ghost" (click)="closed.emit()">Cancelar</ion-button>
        <ion-button (click)="onSubmit()" [disabled]="form.invalid || items.length === 0">
          Crear orden
        </ion-button>
      </div>
    </app-form-modal>
  `,
  styles: [`
    .row { display: grid; grid-template-columns: 1fr; gap: var(--ui-sp-3); }

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
      grid-template-columns: 1fr 80px 100px 36px;
      gap: var(--ui-sp-2);
      align-items: center;
    }
    @media (max-width: 480px) {
      .item { grid-template-columns: 1fr 1fr; }
      .item__remove { grid-column: 2 / 3; justify-self: end; }
    }
    .item__product, .item__qty, .item__price {
      padding: 8px 10px;
      border: var(--ui-border-w-md) solid var(--ui-border);
      background: var(--ui-surface);
      font-family: var(--ui-font-sans);
      font-size: var(--ui-fs-sm);
      color: var(--ui-text);
      min-height: 40px;
    }
    .item__qty, .item__price { font-family: var(--ui-font-mono); text-align: right; }
    .item__remove {
      width: 36px; height: 36px;
      background: var(--ui-danger); color: #fff;
      border: var(--ui-border-w-md) solid var(--ui-border);
      font-size: 20px; font-weight: var(--ui-fw-black);
      cursor: pointer;
      box-shadow: var(--ui-shadow-sm);
    }
    .item__remove:active { box-shadow: none; transform: translate(2px, 2px); }

    .total-box {
      margin-top: var(--ui-sp-3);
      padding: var(--ui-sp-3) var(--ui-sp-4);
      background: var(--ui-success);
      color: var(--ui-primary-contrast);
      border: var(--ui-border-w-md) solid var(--ui-border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .total-box__label {
      font-size: var(--ui-fs-xs);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: var(--ui-fw-bold);
    }
    .total-box__value {
      font-size: var(--ui-fs-xl);
      font-weight: var(--ui-fw-black);
    }

    .warning {
      margin-top: var(--ui-sp-3);
      padding: var(--ui-sp-2) var(--ui-sp-3);
      background: var(--ui-warning);
      color: #000;
      border: var(--ui-border-w-md) solid var(--ui-border);
      font-size: var(--ui-fs-sm);
    }
    .warning ion-icon { vertical-align: middle; font-size: 16px; }
  `],
})
export class PedidoFormModalComponent {
  private readonly fb = inject(FormBuilder);
  protected readonly data = inject(DataService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly isOpen = input.required<boolean>();
  readonly closed = output<void>();
  readonly saved = output<void>();

  // Trigger reactivo para que el preview se recalcule cuando cambian los items
  private readonly formVersion = signal(0);

  readonly form = this.fb.group({
    purpose: this.fb.control('', { nonNullable: true }),
    notes: this.fb.control('', { nonNullable: true }),
    items: this.fb.array<ItemGroup>([]),
  });

  constructor() {
    this.form.valueChanges.subscribe(() => this.formVersion.update(v => v + 1));
    effect(() => {
      if (this.isOpen()) {
        this.items.clear();
        this.form.reset({ purpose: '', notes: '', items: [] });
        this.addItem();
      }
    });
  }

  get items(): FormArray<ItemGroup> {
    return this.form.get('items') as FormArray<ItemGroup>;
  }

  buildItemGroup() {
    return this.fb.group({
      productId: this.fb.control('', { nonNullable: true, validators: [Validators.required] }),
      qty: this.fb.control(1, { nonNullable: true, validators: [Validators.required, Validators.min(1)] }),
      unitPrice: this.fb.control(0, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
    });
  }

  addItem() {
    this.items.push(this.buildItemGroup());
  }

  removeItem(i: number) {
    this.items.removeAt(i);
  }

  onProductChange(i: number) {
    const ctrl = this.items.at(i);
    const id = ctrl?.get('productId')?.value;
    if (!id) return;
    const p = this.data.productById(id);
    if (p) ctrl?.patchValue({ unitPrice: p.sellPrice });
  }

  readonly total = computed(() => {
    this.formVersion();
    const v = this.form.getRawValue();
    return v.items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0), 0);
  });

  /** Vista previa del impacto en stock — usa el analizador del DataService. */
  readonly analysisPreview = computed(() => {
    this.formVersion();
    const v = this.form.getRawValue();
    const orderItems = v.items
      .filter(it => it.productId && Number(it.qty) > 0)
      .map(it => {
        const p = this.data.productById(it.productId);
        return {
          productId: it.productId,
          productName: p?.name ?? '',
          unit: p?.unit ?? 'unidad',
          qty: Number(it.qty),
          unitPrice: Number(it.unitPrice),
          fulfilledQty: 0,
        };
      });
    if (orderItems.length === 0) return null;
    return this.data.analyzeOrder(orderItems);
  });

  async onSubmit() {
    if (this.form.invalid || this.items.length === 0) {
      this.form.markAllAsTouched();
      await this.toast.show('Agrega al menos un producto con cantidad válida.', 'danger');
      return;
    }
    try {
      const v = this.form.getRawValue();
      const user = this.auth.user();
      this.data.createOrder({
        purpose: v.purpose?.trim() || undefined,
        items: v.items.map(it => ({
          productId: it.productId,
          qty: Number(it.qty),
          unitPrice: Number(it.unitPrice),
        })),
        notes: v.notes?.trim() || undefined,
        userId: user?.uid ?? 'unknown',
        userName: user?.displayName ?? 'Usuario',
      });
      await this.toast.show('Orden de producción creada.');
      this.saved.emit();
    } catch (e: unknown) {
      await this.toast.show(e instanceof Error ? e.message : 'Error al crear orden.', 'danger');
    }
  }
}
