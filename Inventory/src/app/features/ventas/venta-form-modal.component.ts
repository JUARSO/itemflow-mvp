import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { IonButton } from '@ionic/angular/standalone';
import { FormModalComponent } from '../../shared/components/form-modal/form-modal.component';
import { FormFieldComponent } from '../../shared/components/form-field/form-field.component';
import { DataService } from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../shared/components/toast/toast.service';

@Component({
  selector: 'app-venta-form-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, DecimalPipe, IonButton, FormModalComponent, FormFieldComponent],
  template: `
    <app-form-modal
      [isOpen]="isOpen()"
      title="Registrar venta"
      (dismissed)="closed.emit()">

      <form body [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
        <app-form-field label="Producto" [required]="true">
          <select formControlName="productId" (change)="onProductChange()">
            <option value="">— Selecciona producto —</option>
            @for (p of data.activeProducts(); track p.id) {
              <option [value]="p.id">{{ p.name }}</option>
            }
          </select>
        </app-form-field>

        <div class="row">
          <app-form-field label="Cantidad" [required]="true">
            <input type="number" formControlName="qty" min="1" step="1" />
          </app-form-field>
          <app-form-field label="Precio unitario" [required]="true">
            <input type="number" formControlName="unitPrice" min="0" step="0.01" />
          </app-form-field>
        </div>

        <div class="total-box">
          <div>
            <div class="total-box__label">Total venta</div>
            <div class="total-box__value mono">\${{ total() | number:'1.0-0' }}</div>
          </div>
          @if (productInfo(); as info) {
            <div class="total-box__hint">
              {{ info.hasRecipe ? 'Descontará insumos vía receta' : 'Descontará stock del producto' }}
            </div>
          }
        </div>
      </form>

      <div footer>
        <ion-button fill="clear" class="ghost" (click)="closed.emit()">Cancelar</ion-button>
        <ion-button (click)="onSubmit()" [disabled]="form.invalid">
          Registrar venta
        </ion-button>
      </div>
    </app-form-modal>
  `,
  styles: [`
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--ui-sp-3); }
    @media (max-width: 480px) { .row { grid-template-columns: 1fr; } }
    .total-box {
      margin-top: var(--ui-sp-3);
      padding: var(--ui-sp-3) var(--ui-sp-4);
      background: var(--ui-success-tint);
      border: var(--ui-border-w-md) solid var(--ui-border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--ui-sp-3);
    }
    .total-box__label {
      font-size: var(--ui-fs-xs);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: var(--ui-fw-bold);
      color: var(--ui-text-muted);
    }
    .total-box__value {
      font-size: var(--ui-fs-xl);
      font-weight: var(--ui-fw-black);
      color: var(--ui-text);
    }
    .total-box__hint {
      font-size: var(--ui-fs-xs);
      color: var(--ui-text-muted);
      text-align: right;
      max-width: 200px;
    }
  `],
})
export class VentaFormModalComponent {
  private readonly fb = inject(FormBuilder);
  protected readonly data = inject(DataService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly isOpen = input.required<boolean>();
  readonly closed = output<void>();
  readonly saved = output<void>();

  readonly form = this.fb.group({
    productId: this.fb.control('', { nonNullable: true, validators: [Validators.required] }),
    qty: this.fb.control(1, { nonNullable: true, validators: [Validators.required, Validators.min(1)] }),
    unitPrice: this.fb.control(0, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
  });

  readonly total = computed(() => {
    const v = this.form.getRawValue();
    return (Number(v.qty) || 0) * (Number(v.unitPrice) || 0);
  });

  readonly productInfo = computed(() => {
    const id = this.form.getRawValue().productId;
    if (!id) return null;
    return this.data.productById(id);
  });

  constructor() {
    effect(() => {
      if (this.isOpen()) {
        this.form.reset({ productId: '', qty: 1, unitPrice: 0 });
      }
    });
  }

  onProductChange() {
    const id = this.form.getRawValue().productId;
    const p = this.data.productById(id);
    if (p) this.form.patchValue({ unitPrice: p.sellPrice });
  }

  async onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      await this.toast.show('Revisa los campos requeridos.', 'danger');
      return;
    }
    try {
      const v = this.form.getRawValue();
      const user = this.auth.user();
      this.data.registerSale({
        productId: v.productId,
        qty: Number(v.qty),
        unitPrice: Number(v.unitPrice),
        userId: user?.uid ?? 'unknown',
        userName: user?.displayName ?? 'Usuario',
      });
      await this.toast.show('Venta registrada. Stock e insumos actualizados.');
      this.saved.emit();
    } catch (e: unknown) {
      await this.toast.show(e instanceof Error ? e.message : 'Error al registrar venta.', 'danger');
    }
  }
}
