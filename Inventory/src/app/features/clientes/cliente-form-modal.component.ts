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
  template: `
    <app-form-modal
      [isOpen]="isOpen()"
      [title]="editing() ? 'Editar cliente' : 'Nuevo cliente'"
      (dismissed)="closed.emit()">

      <form body [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
        <app-form-field label="Nombre del cliente" [required]="true">
          <input type="text" formControlName="name" placeholder="Ej: Cafetería La Esquina" />
        </app-form-field>

        <div class="row">
          <app-form-field label="Persona de contacto">
            <input type="text" formControlName="contactPerson" />
          </app-form-field>
          <app-form-field label="Teléfono">
            <input type="text" formControlName="phone" />
          </app-form-field>
        </div>

        <app-form-field label="Email">
          <input type="email" formControlName="email" />
        </app-form-field>

        <!-- Productos permitidos -->
        <h3 class="section-title">Productos que puede pedir</h3>
        <p class="hint">
          Si no marcas ninguno, el cliente verá todo el catálogo.
        </p>
        <div class="products">
          @for (p of data.activeProducts(); track p.id) {
            <label class="product-row">
              <input type="checkbox"
                [checked]="allowedSet().has(p.id)"
                (change)="toggleProduct(p.id)" />
              <span class="product-row__name">{{ p.name }}</span>
              <span class="product-row__sku mono">{{ p.sku }}</span>
            </label>
          }
        </div>

        <!-- Ventana de pedido -->
        <h3 class="section-title">Días en que puede crear pedidos</h3>
        <div class="days">
          @for (d of dayIndices; track d) {
            <button type="button" class="day"
              [class.day--on]="orderSet().has(d)"
              (click)="toggleOrderDay(d)">
              {{ dayLabel(d) }}
            </button>
          }
        </div>

        <h3 class="section-title">Días de entrega</h3>
        <div class="days">
          @for (d of dayIndices; track d) {
            <button type="button" class="day"
              [class.day--on]="deliverySet().has(d)"
              (click)="toggleDeliveryDay(d)">
              {{ dayLabel(d) }}
            </button>
          }
        </div>

        <app-form-field label="Notas (opcional)">
          <textarea formControlName="notes" rows="2"
            placeholder="Horario de entrega, instrucciones especiales, etc."></textarea>
        </app-form-field>

        <label class="active-row">
          <input type="checkbox" formControlName="active" />
          <span>Cliente activo</span>
        </label>
      </form>

      <div footer>
        <ion-button fill="clear" class="ghost" (click)="closed.emit()">Cancelar</ion-button>
        <ion-button (click)="onSubmit()" [disabled]="form.invalid">
          {{ editing() ? 'Guardar cambios' : 'Crear cliente' }}
        </ion-button>
      </div>
    </app-form-modal>
  `,
  styles: [`
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--ui-sp-3); }
    @media (max-width: 480px) { .row { grid-template-columns: 1fr; } }

    .section-title {
      font-size: var(--ui-fs-sm);
      font-weight: var(--ui-fw-black);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: var(--ui-sp-4) 0 var(--ui-sp-2);
      color: var(--ui-text);
    }
    .hint {
      font-size: var(--ui-fs-xs);
      color: var(--ui-text-muted);
      margin: 0 0 var(--ui-sp-2);
    }

    .products {
      max-height: 240px;
      overflow-y: auto;
      border: var(--ui-border-w-md) solid var(--ui-border);
      background: var(--ui-surface);
    }
    .product-row {
      display: grid;
      grid-template-columns: 24px 1fr auto;
      gap: var(--ui-sp-2);
      align-items: center;
      padding: 8px var(--ui-sp-3);
      cursor: pointer;
      font-size: var(--ui-fs-sm);
      border-bottom: var(--ui-border-w-sm) solid var(--ui-border);
    }
    .product-row:last-child { border-bottom: none; }
    .product-row:hover { background: var(--ui-surface-2); }
    .product-row__name { font-weight: var(--ui-fw-bold); }
    .product-row__sku {
      font-size: var(--ui-fs-xs);
      color: var(--ui-text-muted);
    }

    .days {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .day {
      flex: 1;
      min-width: 50px;
      padding: 10px 12px;
      background: var(--ui-surface);
      border: var(--ui-border-w-md) solid var(--ui-border);
      font-weight: var(--ui-fw-bold);
      color: var(--ui-text-muted);
      cursor: pointer;
      font-size: var(--ui-fs-sm);
      transition: all 120ms ease-out;
      user-select: none;
      font-family: var(--ui-font-sans);
    }
    .day:hover {
      background: var(--ui-surface-3);
      border-color: var(--ui-primary);
      color: var(--ui-text);
    }
    .day:active { transform: scale(0.97); }
    .day--on {
      background: var(--ui-primary) !important;
      color: var(--ui-primary-contrast) !important;
      border-color: var(--ui-primary) !important;
      box-shadow: var(--ui-shadow-sm);
    }
    .day--on:hover {
      background: var(--ui-primary) !important;
      filter: brightness(1.1);
    }

    .active-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: var(--ui-sp-3);
      font-size: var(--ui-fs-sm);
      cursor: pointer;
    }
  `],
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
        this._orderDays.set([...c.window.orderDays]);
        this._deliveryDays.set([...c.window.deliveryDays]);
      } else if (this.isOpen()) {
        this.form.reset({ name: '', contactPerson: '', email: '', phone: '', notes: '', active: true });
        this._allowed.set([]);
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
