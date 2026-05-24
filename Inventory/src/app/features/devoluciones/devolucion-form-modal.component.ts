import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { FormModalComponent } from '../../shared/components/form-modal/form-modal.component';
import { FormFieldComponent } from '../../shared/components/form-field/form-field.component';
import { ReturnReason } from '../../core/models';
import { DataService } from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../shared/components/toast/toast.service';

const REASON_LABELS: Record<ReturnReason, string> = {
  defective: 'Defectuoso (mal hecho, quemado, mal cocido)',
  expired: 'Vencido / mal estado',
  leftover: 'Sobra de fin de día',
  damaged: 'Daño por manipulación',
  other: 'Otro',
};

@Component({
  selector: 'app-devolucion-form-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, DecimalPipe, IonButton, IonIcon, FormModalComponent, FormFieldComponent],
  template: `
    <app-form-modal
      [isOpen]="isOpen()"
      title="Devolver a producción"
      (dismissed)="closed.emit()">

      <form body [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
        <app-form-field label="Producto" [required]="true" hint="Todos los productos del catálogo">
          <select formControlName="productId">
            <option value="">— Selecciona producto —</option>
            @for (p of productosCatalogo(); track p.id) {
              <option [value]="p.id" [disabled]="stockOf(p.id) === 0">
                {{ p.name }} — {{ stockOf(p.id) }} {{ p.unit }} disponibles
              </option>
            }
          </select>
        </app-form-field>

        @if (selectedProduct(); as p) {
          <div class="stock-box">
            <div>
              <div class="stock-box__label">Stock disponible</div>
              <div class="stock-box__value mono">{{ stockOf(p.id) }} {{ p.unit }}</div>
            </div>
            <div class="stock-box__hint">Costo unitario actual: ₡{{ cost() | number:'1.0-0' }}</div>
          </div>
        }

        <app-form-field label="Cantidad a devolver" [required]="true">
          <input type="number" formControlName="qty" min="1" step="1" />
        </app-form-field>

        <app-form-field label="Motivo" [required]="true">
          <select formControlName="reason">
            <option value="defective">{{ reasonLabel('defective') }}</option>
            <option value="expired">{{ reasonLabel('expired') }}</option>
            <option value="leftover">{{ reasonLabel('leftover') }}</option>
            <option value="damaged">{{ reasonLabel('damaged') }}</option>
            <option value="other">{{ reasonLabel('other') }}</option>
          </select>
        </app-form-field>

        <app-form-field label="Notas (opcional)" hint="Describe el contexto de la devolución">
          <textarea formControlName="notes" rows="2" placeholder="Ej: hornada de la tarde, demasiado oscuras"></textarea>
        </app-form-field>

        @if (selectedProduct() && form.controls.qty.value > 0) {
          <div class="loss-box">
            <div>
              <div class="loss-box__label">Pérdida estimada</div>
              <div class="loss-box__value mono">₡{{ totalLoss() | number:'1.0-0' }}</div>
            </div>
            <div class="loss-box__hint">
              {{ form.controls.qty.value }} × ₡{{ cost() | number:'1.0-0' }}
            </div>
          </div>

          @if (form.controls.qty.value > stockOf(selectedProduct()!.id)) {
            <div class="warning">
              <ion-icon name="warning-outline"></ion-icon> Cantidad mayor al stock disponible ({{ stockOf(selectedProduct()!.id) }} {{ selectedProduct()!.unit }}).
            </div>
          }
        }
      </form>

      <div footer>
        <ion-button fill="clear" class="ghost" (click)="closed.emit()">Cancelar</ion-button>
        <ion-button color="danger" (click)="onSubmit()" [disabled]="!canSubmit()">
          Registrar devolución
        </ion-button>
      </div>
    </app-form-modal>
  `,
  styles: [`
    .stock-box, .loss-box {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--ui-sp-3);
      padding: var(--ui-sp-3) var(--ui-sp-4);
      border: var(--ui-border-w-md) solid var(--ui-border);
      margin-bottom: var(--ui-sp-3);
    }
    .stock-box { background: var(--ui-surface-2); }
    .loss-box {
      background: var(--ui-danger);
      color: #fff;
      margin-top: var(--ui-sp-3);
    }
    .stock-box__label, .loss-box__label {
      font-size: var(--ui-fs-xs);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: var(--ui-fw-bold);
      opacity: 0.9;
    }
    .stock-box__value, .loss-box__value {
      font-size: var(--ui-fs-xl);
      font-weight: var(--ui-fw-black);
    }
    .stock-box__hint, .loss-box__hint {
      font-size: var(--ui-fs-xs);
      opacity: 0.85;
      text-align: right;
      max-width: 180px;
    }

    .warning {
      margin-top: var(--ui-sp-2);
      padding: var(--ui-sp-2) var(--ui-sp-3);
      background: var(--ui-warning);
      color: #000;
      font-size: var(--ui-fs-sm);
      border: var(--ui-border-w-md) solid var(--ui-border);
    }
    .warning ion-icon { vertical-align: middle; font-size: 16px; }
  `],
})
export class DevolucionFormModalComponent {
  private readonly fb = inject(FormBuilder);
  protected readonly data = inject(DataService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly isOpen = input.required<boolean>();
  readonly closed = output<void>();
  readonly saved = output<void>();

  // Trigger reactivo: incrementamos en cada valueChanges para que los computed
  // que dependen del form se vuelvan a evaluar (los FormGroups no son signals).
  private readonly formVersion = signal(0);

  readonly form = this.fb.group({
    productId: this.fb.control('', { nonNullable: true, validators: [Validators.required] }),
    qty: this.fb.control(1, { nonNullable: true, validators: [Validators.required, Validators.min(1)] }),
    reason: this.fb.control<ReturnReason>('defective', { nonNullable: true, validators: [Validators.required] }),
    notes: this.fb.control('', { nonNullable: true }),
  });

  /** Todos los productos activos del catálogo. Los sin stock aparecen pero quedan disabled. */
  readonly productosCatalogo = computed(() =>
    [...this.data.activeProducts()].sort((a, b) => a.name.localeCompare(b.name))
  );

  readonly selectedProduct = computed(() => {
    this.formVersion();
    const id = this.form.controls.productId.value;
    return id ? this.data.productById(id) ?? null : null;
  });

  readonly cost = computed(() => {
    const p = this.selectedProduct();
    return p ? this.data.effectiveProductCost(p.id) : 0;
  });

  readonly totalLoss = computed(() => {
    this.formVersion();
    const qty = Number(this.form.controls.qty.value) || 0;
    return this.cost() * qty;
  });

  readonly canSubmit = computed(() => {
    this.formVersion();
    if (this.form.invalid) return false;
    const p = this.selectedProduct();
    if (!p) return false;
    const qty = Number(this.form.controls.qty.value);
    return qty > 0 && qty <= this.stockOf(p.id);
  });

  constructor() {
    this.form.valueChanges.subscribe(() => this.formVersion.update(v => v + 1));
    effect(() => {
      if (this.isOpen()) {
        this.form.reset({ productId: '', qty: 1, reason: 'defective', notes: '' });
      }
    });
  }

  stockOf(productId: string): number {
    return this.data.productStockFor(productId)?.quantity ?? 0;
  }

  reasonLabel(r: ReturnReason): string {
    return REASON_LABELS[r];
  }

  async onSubmit() {
    if (!this.canSubmit()) {
      this.form.markAllAsTouched();
      await this.toast.show('Revisa producto, cantidad y motivo.', 'danger');
      return;
    }
    try {
      const v = this.form.getRawValue();
      const user = this.auth.user();
      this.data.registerReturn({
        productId: v.productId,
        qty: Number(v.qty),
        reason: v.reason,
        notes: v.notes?.trim() || undefined,
        userId: user?.uid ?? 'unknown',
        userName: user?.displayName ?? 'Usuario',
      });
      await this.toast.show('Devolución registrada. Stock actualizado.');
      this.saved.emit();
    } catch (e: unknown) {
      await this.toast.show(e instanceof Error ? e.message : 'Error al registrar devolución.', 'danger');
    }
  }
}
