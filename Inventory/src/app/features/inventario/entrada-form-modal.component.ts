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
  selector: 'app-entrada-form-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, DecimalPipe, IonButton, FormModalComponent, FormFieldComponent],
  template: `
    <app-form-modal
      [isOpen]="isOpen()"
      title="Registrar entrada"
      (dismissed)="closed.emit()">

      <form body [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
        <app-form-field label="Insumo" [required]="true">
          <select formControlName="supplyId" (change)="onSupplyChange()">
            <option value="">— Selecciona insumo —</option>
            @for (s of data.activeSupplies(); track s.id) {
              <option [value]="s.id">{{ s.name }} ({{ s.unit }})</option>
            }
          </select>
        </app-form-field>

        <div class="row">
          <app-form-field label="Cantidad" [required]="true" [hint]="unitHint()">
            <input type="number" formControlName="qty" min="0.001" step="0.001" />
          </app-form-field>
          <app-form-field label="Costo unitario" [required]="true" hint="Costo de compra de esta partida">
            <input type="number" formControlName="cost" min="0" step="0.01" />
          </app-form-field>
        </div>

        <app-form-field label="Motivo" [required]="true">
          <select formControlName="reason">
            <option value="purchase">Compra a proveedor</option>
            <option value="return_from_customer">Devolución de cliente</option>
            <option value="manual">Carga manual / inicial</option>
          </select>
        </app-form-field>

        <app-form-field label="Nota" hint="Opcional — referencia, número de OC, comentario">
          <textarea formControlName="note" rows="2" placeholder="Ej. OC #145 recibida"></textarea>
        </app-form-field>

        <div class="summary">
          <div>
            <div class="summary__label">Stock actual</div>
            <div class="summary__value mono">
              {{ (currentStock() | number:'1.0-3') ?? '0' }} {{ unitLabel() }}
            </div>
          </div>
          <div class="summary__arrow">→</div>
          <div>
            <div class="summary__label">Nuevo stock</div>
            <div class="summary__value mono success">
              {{ newStock() | number:'1.0-3' }} {{ unitLabel() }}
            </div>
          </div>
          <div class="summary__total">
            <div class="summary__label">Valor entrada</div>
            <div class="summary__value mono">\${{ totalCost() | number:'1.0-0' }}</div>
          </div>
        </div>
      </form>

      <div footer>
        <ion-button fill="clear" class="ghost" (click)="closed.emit()">Cancelar</ion-button>
        <ion-button (click)="onSubmit()" [disabled]="form.invalid">
          Registrar entrada
        </ion-button>
      </div>
    </app-form-modal>
  `,
  styles: [`
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--ui-sp-3); }
    @media (max-width: 480px) { .row { grid-template-columns: 1fr; } }

    .summary {
      margin-top: var(--ui-sp-3);
      padding: var(--ui-sp-3) var(--ui-sp-4);
      background: var(--ui-surface-2);
      border: var(--ui-border-w-sm) solid var(--ui-border);
      border-radius: var(--ui-radius);
      display: grid;
      grid-template-columns: 1fr auto 1fr 1fr;
      gap: var(--ui-sp-3);
      align-items: center;
    }
    @media (max-width: 600px) {
      .summary { grid-template-columns: 1fr 1fr; }
      .summary__arrow { display: none; }
    }
    .summary__label {
      font-size: var(--ui-fs-xs);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--ui-text-muted);
      font-weight: var(--ui-fw-medium);
    }
    .summary__value {
      font-size: var(--ui-fs-lg);
      font-weight: var(--ui-fw-bold);
      color: var(--ui-text-strong);
    }
    .summary__value.success { color: var(--ui-success); }
    .summary__arrow {
      font-size: 24px;
      color: var(--ui-text-muted);
      text-align: center;
    }
    .summary__total {
      border-left: var(--ui-border-w-sm) solid var(--ui-border);
      padding-left: var(--ui-sp-3);
    }
  `],
})
export class EntradaFormModalComponent {
  private readonly fb = inject(FormBuilder);
  protected readonly data = inject(DataService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly isOpen = input.required<boolean>();
  readonly closed = output<void>();
  readonly saved = output<void>();

  readonly form = this.fb.group({
    supplyId: this.fb.control('', { nonNullable: true, validators: [Validators.required] }),
    qty: this.fb.control(0, { nonNullable: true, validators: [Validators.required, Validators.min(0.001)] }),
    cost: this.fb.control(0, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
    reason: this.fb.control('purchase', { nonNullable: true, validators: [Validators.required] }),
    note: this.fb.control(''),
  });

  readonly selectedSupply = computed(() => {
    const id = this.form.getRawValue().supplyId;
    return id ? this.data.supplyById(id) : undefined;
  });

  readonly currentStock = computed(() => {
    const id = this.form.getRawValue().supplyId;
    if (!id) return 0;
    return this.data.supplyStockFor(id)?.quantity ?? 0;
  });

  readonly newStock = computed(() => {
    return this.currentStock() + (Number(this.form.getRawValue().qty) || 0);
  });

  readonly totalCost = computed(() => {
    const v = this.form.getRawValue();
    return (Number(v.qty) || 0) * (Number(v.cost) || 0);
  });

  readonly unitLabel = computed(() => this.selectedSupply()?.unit ?? '');
  readonly unitHint = computed(() => {
    const u = this.unitLabel();
    return u ? `Unidad: ${u}` : 'Selecciona un insumo primero';
  });

  constructor() {
    effect(() => {
      if (this.isOpen()) {
        this.form.reset({ supplyId: '', qty: 0, cost: 0, reason: 'purchase', note: '' });
      }
    });
  }

  onSupplyChange() {
    const supply = this.selectedSupply();
    if (supply) this.form.patchValue({ cost: supply.cost });
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
      this.data.receiveSupply({
        supplyId: v.supplyId,
        qty: Number(v.qty),
        cost: Number(v.cost),
        reason: v.reason,
        note: v.note?.trim() || undefined,
        userId: user?.uid ?? 'unknown',
        userName: user?.displayName ?? 'Usuario',
      });
      const supply = this.selectedSupply();
      await this.toast.show(`Entrada de ${v.qty} ${supply?.unit ?? ''} de ${supply?.name} registrada.`, 'success');
      this.saved.emit();
    } catch (e: unknown) {
      await this.toast.show(e instanceof Error ? e.message : 'Error al registrar la entrada.', 'danger');
    }
  }
}
