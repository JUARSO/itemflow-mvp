import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonButton } from '@ionic/angular/standalone';
import { FormModalComponent } from '../../shared/components/form-modal/form-modal.component';
import { FormFieldComponent } from '../../shared/components/form-field/form-field.component';
import { Customer } from '../../core/models';
import { DataService } from '../../core/services/data.service';
import { ToastService } from '../../shared/components/toast/toast.service';

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] as const;

@Component({
  selector: 'app-cliente-form-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, FormsModule, IonButton, FormModalComponent, FormFieldComponent],
  templateUrl: './cliente-form-modal.component.html',
  styleUrls: ['./cliente-form-modal.component.scss'],
})
export class ClienteFormModalComponent {
  private readonly fb = inject(FormBuilder);
  protected readonly data = inject(DataService);
  private readonly toast = inject(ToastService);

  readonly isOpen = input.required<boolean>();
  readonly editing = input<Customer | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly dayIndices = [1, 2, 3, 4, 5, 6, 0]; // lun→dom

  readonly form = this.fb.group({
    name: this.fb.control('', { nonNullable: true, validators: [Validators.required, Validators.minLength(2)] }),
    contactPerson: this.fb.control('', { nonNullable: true }),
    email: this.fb.control('', { nonNullable: true }),
    phone: this.fb.control('', { nonNullable: true }),
    notes: this.fb.control('', { nonNullable: true }),
    active: this.fb.control(true, { nonNullable: true }),
  });

  // Selecciones como signals directos (los FormControl.value NO triggean computeds).
  private readonly _allowed = signal<string[]>([]);
  private readonly _orderDays = signal<number[]>([]);
  private readonly _deliveryDays = signal<number[]>([]);
  /** Precios personalizados por producto (productId → precio). Vacío = global. */
  private readonly _prices = signal<Record<string, number>>({});

  readonly allowedSet = computed(() => new Set(this._allowed()));
  readonly orderSet = computed(() => new Set(this._orderDays()));
  readonly deliverySet = computed(() => new Set(this._deliveryDays()));

  constructor() {
    effect(() => {
      const c = this.editing();
      if (c) {
        this.form.patchValue({
          name: c.name,
          contactPerson: c.contactPerson ?? '',
          email: c.email ?? '',
          phone: c.phone ?? '',
          notes: c.notes ?? '',
          active: c.active,
        });
        this._allowed.set([...c.allowedProductIds]);
        this._prices.set({ ...(c.productPrices ?? {}) });
        this._orderDays.set([...c.window.orderDays]);
        this._deliveryDays.set([...c.window.deliveryDays]);
      } else if (this.isOpen()) {
        this.form.reset({ name: '', contactPerson: '', email: '', phone: '', notes: '', active: true });
        this._allowed.set([]);
        this._prices.set({});
        this._orderDays.set([1, 2, 3, 4, 5]);   // lun-vie por defecto
        this._deliveryDays.set([2, 3, 4, 5, 6]); // mar-sáb
      }
    });
  }

  dayLabel(d: number): string {
    return DAY_LABELS[d];
  }

  toggleProduct(id: string) {
    this._allowed.update(cur => cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]);
  }

  /** Valor del input de precio: el custom si existe, sino vacío (placeholder = global). */
  priceOf(id: string): number | string {
    const v = this._prices()[id];
    return v != null ? v : '';
  }

  /** Setea/limpia el precio custom de un producto. Vacío → usa el global. */
  setPrice(id: string, raw: string) {
    const trimmed = (raw ?? '').trim();
    this._prices.update(map => {
      const next = { ...map };
      if (trimmed === '') {
        delete next[id];
      } else {
        const n = Number(trimmed);
        if (!isNaN(n) && n >= 0) next[id] = n;
      }
      return next;
    });
  }

  /** Mapa de precios custom limitado a productos permitidos. undefined si vacío. */
  private buildProductPrices(): Record<string, number> | undefined {
    const allowed = new Set(this._allowed());
    const entries = Object.entries(this._prices())
      .filter(([pid, val]) => allowed.has(pid) && val != null && val >= 0);
    return entries.length > 0 ? Object.fromEntries(entries) : undefined;
  }
  toggleOrderDay(d: number) {
    this._orderDays.update(cur => cur.includes(d) ? cur.filter(x => x !== d) : [...cur, d]);
  }
  toggleDeliveryDay(d: number) {
    this._deliveryDays.update(cur => cur.includes(d) ? cur.filter(x => x !== d) : [...cur, d]);
  }

  async onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      await this.toast.show('Completa el nombre del cliente.', 'danger');
      return;
    }
    const v = this.form.getRawValue();
    const c = this.editing();
    try {
      if (c) {
        this.data.updateCustomer({
          ...c,
          name: v.name,
          contactPerson: v.contactPerson || undefined,
          email: v.email || undefined,
          phone: v.phone || undefined,
          notes: v.notes || undefined,
          active: v.active,
          allowedProductIds: [...this._allowed()],
          productPrices: this.buildProductPrices(),
          window: {
            orderDays: [...this._orderDays()].sort(),
            deliveryDays: [...this._deliveryDays()].sort(),
          },
        });
        await this.toast.show(`Cliente "${v.name}" actualizado.`);
      } else {
        const created = this.data.createCustomer({
          name: v.name,
          contactPerson: v.contactPerson || undefined,
          email: v.email || undefined,
          phone: v.phone || undefined,
          notes: v.notes || undefined,
          active: v.active,
          allowedProductIds: [...this._allowed()],
          productPrices: this.buildProductPrices(),
          window: {
            orderDays: [...this._orderDays()].sort(),
            deliveryDays: [...this._deliveryDays()].sort(),
          },
        });
        await this.toast.show(`Cliente "${created.name}" creado.`);
      }
      this.saved.emit();
    } catch (e: unknown) {
      await this.toast.show(e instanceof Error ? e.message : 'Error al guardar.', 'danger');
    }
  }
}
