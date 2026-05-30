import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { IonButton } from '@ionic/angular/standalone';
import { DataService } from '../../core/services/data.service';
import { ToastService } from '../../shared/components/toast/toast.service';
import { FormModalComponent } from '../../shared/components/form-modal/form-modal.component';
import { FormFieldComponent } from '../../shared/components/form-field/form-field.component';
import { Customer } from '../../core/models';

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] as const;

@Component({
  selector: 'app-recurring-order-form-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, IonButton, FormModalComponent, FormFieldComponent],
  templateUrl: './recurring-order-form-modal.component.html',
  styleUrls: ['./recurring-order-form-modal.component.scss'],
})
export class RecurringOrderFormModalComponent {
  private readonly data = inject(DataService);
  private readonly toast = inject(ToastService);

  readonly isOpen = input.required<boolean>();
  readonly customer = input<Customer | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();

  readonly weekDays = [1, 2, 3, 4, 5, 6, 0];
  readonly label = signal('');
  readonly selectedDays = signal<Set<number>>(new Set());
  readonly qtys = signal<Record<string, number>>({});

  /** Productos que el cliente puede pedir. */
  readonly productos = computed(() => {
    const c = this.customer();
    const all = this.data.activeProducts();
    if (!c || c.allowedProductIds.length === 0) return all;
    const set = new Set(c.allowedProductIds);
    return all.filter(p => set.has(p.id));
  });

  readonly totalLineas = computed(() => Object.values(this.qtys()).filter(q => q > 0).length);

  dayLabel(d: number): string { return DAY_LABELS[d]; }
  isDayOn(d: number): boolean { return this.selectedDays().has(d); }
  toggleDay(d: number) {
    this.selectedDays.update(s => {
      const n = new Set(s);
      n.has(d) ? n.delete(d) : n.add(d);
      return n;
    });
  }

  precioDe(productId: string): number {
    return this.data.priceForCustomer(this.customer(), productId);
  }

  setQty(productId: string, qty: number) {
    this.qtys.update(m => ({ ...m, [productId]: Math.max(0, Math.floor(qty || 0)) }));
  }

  private reset() {
    this.label.set('');
    this.selectedDays.set(new Set());
    this.qtys.set({});
  }

  cerrar() { this.reset(); this.closed.emit(); }

  async guardar() {
    const c = this.customer();
    if (!c) return;
    const map = this.qtys();
    const items = Object.keys(map)
      .map(productId => ({ productId, qty: map[productId] }))
      .filter(it => it.qty > 0);
    try {
      this.data.createRecurringOrder({
        customerId: c.id,
        label: this.label(),
        weekdays: [...this.selectedDays()],
        items,
      });
      await this.toast.show(`Pedido recurrente creado para ${c.name}.`, 'success');
      this.reset();
      this.saved.emit();
    } catch (e: unknown) {
      await this.toast.show(e instanceof Error ? e.message : 'No se pudo crear.', 'danger');
    }
  }
}
