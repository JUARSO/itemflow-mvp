import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { IonButton } from '@ionic/angular/standalone';
import { FormModalComponent } from '../../shared/components/form-modal/form-modal.component';
import { FormFieldComponent } from '../../shared/components/form-field/form-field.component';
import { DataService } from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../shared/components/toast/toast.service';
import { UnitShortPipe } from '../../shared/pipes/unit-short.pipe';

@Component({
  selector: 'app-entrada-form-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, DecimalPipe, IonButton, FormModalComponent, FormFieldComponent, UnitShortPipe],
  templateUrl: './entrada-form-modal.component.html',
  styleUrls: ['./entrada-form-modal.component.scss'],
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
