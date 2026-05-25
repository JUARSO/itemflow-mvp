import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonModal, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons,
  IonButton, IonIcon,
} from '@ionic/angular/standalone';
import { DataService } from '../../core/services/data.service';
import { ToastService } from '../../shared/components/toast/toast.service';
import { Supplier, SupplierItem } from '../../core/models';

const DAY_LABELS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'] as const;
const WEEK_DAYS = [1, 2, 3, 4, 5, 6, 0]; // lun..dom

/**
 * Modal de creación/edición de proveedor. Usa signals para el estado del
 * borrador así los toggles de días reactivan los computed inmediatamente.
 */
@Component({
  selector: 'app-proveedor-form-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    IonModal, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons,
    IonButton, IonIcon,
  ],
  template: `
    <ion-modal [isOpen]="isOpen" (didDismiss)="closed.emit()">
      <ng-template>
        <ion-header>
          <ion-toolbar>
            <ion-title>{{ editing ? 'Editar proveedor' : 'Nuevo proveedor' }}</ion-title>
            <ion-buttons slot="end">
              <ion-button (click)="closed.emit()">
                <ion-icon name="close-outline"></ion-icon>
              </ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content>
          <form class="form" (ngSubmit)="save()">
            <div class="field">
              <label>Nombre del proveedor</label>
              <input type="text" [value]="name()" (input)="name.set($any($event.target).value)" required />
            </div>
            <div class="row">
              <div class="field">
                <label>Persona de contacto</label>
                <input type="text" [value]="contactPerson()" (input)="contactPerson.set($any($event.target).value)" />
              </div>
              <div class="field">
                <label>Teléfono</label>
                <input type="text" [value]="phone()" (input)="phone.set($any($event.target).value)" />
              </div>
            </div>
            <div class="field">
              <label>Email</label>
              <input type="email" [value]="email()" (input)="email.set($any($event.target).value)" />
            </div>

            <div class="row">
              <div class="field">
                <label>Lead time (días entre pedido y entrega)</label>
                <input type="number" min="0" [value]="leadTimeDays()"
                  (input)="leadTimeDays.set(asNum($any($event.target).value))" />
              </div>
              <div class="field">
                <label>Términos de pago</label>
                <input type="text" placeholder="Contado, 30 días, etc."
                  [value]="paymentTerms()"
                  (input)="paymentTerms.set($any($event.target).value)" />
              </div>
            </div>

            <div class="field">
              <label>Días para pedir</label>
              <div class="days">
                @for (d of weekDays; track d) {
                  <button type="button"
                    class="day"
                    [class.day--on]="orderDays().includes(d)"
                    (click)="toggleOrderDay(d)">{{ dayLabel(d) }}</button>
                }
              </div>
              <small>Vacío = cualquier día</small>
            </div>

            <div class="field">
              <label>Días de entrega</label>
              <div class="days">
                @for (d of weekDays; track d) {
                  <button type="button"
                    class="day"
                    [class.day--on]="deliveryDays().includes(d)"
                    (click)="toggleDeliveryDay(d)">{{ dayLabel(d) }}</button>
                }
              </div>
              <small>Vacío = cualquier día</small>
            </div>

            <div class="field">
              <label>Insumos y productos que entrega</label>
              <input type="search" class="filter-input"
                placeholder="Filtrar por nombre…"
                [value]="itemFilter()"
                (input)="itemFilter.set($any($event.target).value)" />

              <div class="items-block">
                <div class="items-group">
                  <div class="items-group__title">
                    Insumos ({{ selectedSuppliesCount() }} seleccionados)
                  </div>
                  <div class="items-grid">
                    @for (s of filteredSupplies(); track s.id) {
                      <label class="item-chip">
                        <input type="checkbox"
                          [checked]="isItemSelected('supply', s.id)"
                          (change)="toggleItem('supply', s.id)" />
                        <span>{{ s.name }}</span>
                        <small>{{ s.unit }}</small>
                      </label>
                    }
                  </div>
                </div>

                <div class="items-group">
                  <div class="items-group__title">
                    Productos terminados sin receta ({{ selectedProductsCount() }} seleccionados)
                  </div>
                  <div class="items-grid">
                    @for (p of filteredProducts(); track p.id) {
                      <label class="item-chip">
                        <input type="checkbox"
                          [checked]="isItemSelected('product', p.id)"
                          (change)="toggleItem('product', p.id)" />
                        <span>{{ p.name }}</span>
                        <small>{{ p.unit }} · reventa</small>
                      </label>
                    }
                    @if (filteredProducts().length === 0 && !itemFilter()) {
                      <small class="muted-msg">
                        No hay productos sin receta. Los productos con receta se fabrican internamente.
                      </small>
                    }
                  </div>
                </div>
              </div>
            </div>

            <div class="field">
              <label>Notas</label>
              <textarea rows="3" [value]="notes()" (input)="notes.set($any($event.target).value)"></textarea>
            </div>

            <div class="field field--check">
              <label>
                <input type="checkbox"
                  [checked]="active()"
                  (change)="active.set($any($event.target).checked)" />
                Proveedor activo
              </label>
            </div>

            <div class="actions">
              <ion-button fill="outline" (click)="closed.emit()">Cancelar</ion-button>
              <ion-button type="submit" [disabled]="!canSave()">
                {{ editing ? 'Guardar cambios' : 'Crear proveedor' }}
              </ion-button>
            </div>
          </form>
        </ion-content>
      </ng-template>
    </ion-modal>
  `,
  styles: [`
    .form { padding: var(--ui-sp-3); display: flex; flex-direction: column; gap: var(--ui-sp-3); }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--ui-sp-2); }
    @media (max-width: 500px) { .row { grid-template-columns: 1fr; } }
    .field { display: flex; flex-direction: column; gap: 4px; }
    .field label {
      font-size: var(--ui-fs-xs);
      font-weight: var(--ui-fw-black);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--ui-text-muted);
    }
    .field input, .field textarea {
      padding: 8px 10px;
      border: var(--ui-border-w-md) solid var(--ui-border);
      background: var(--ui-surface);
      font-family: var(--ui-font-sans);
      font-size: var(--ui-fs-sm);
    }
    .field small { font-size: 10px; color: var(--ui-text-muted); }
    .field--check label {
      display: flex; align-items: center; gap: 8px;
      font-size: var(--ui-fs-sm); text-transform: none; letter-spacing: 0;
      font-weight: var(--ui-fw-bold); color: var(--ui-text);
    }

    .days { display: flex; gap: 4px; flex-wrap: wrap; }
    .day {
      flex: 1; min-width: 36px;
      padding: 8px 0;
      background: var(--ui-surface-2);
      color: var(--ui-text-muted);
      border: var(--ui-border-w-sm) solid var(--ui-border);
      cursor: pointer;
      font-weight: var(--ui-fw-bold);
      font-family: var(--ui-font-sans);
    }
    .day--on {
      background: var(--ui-success) !important;
      color: #fff !important;
      border-color: var(--ui-success) !important;
    }
    .day:hover:not(.day--on) { background: var(--ui-surface-3); }

    .actions {
      display: flex; gap: var(--ui-sp-2); justify-content: flex-end;
      padding-top: var(--ui-sp-2);
      border-top: var(--ui-border-w-sm) solid var(--ui-border);
    }

    .filter-input {
      padding: 6px 10px;
      border: var(--ui-border-w-sm) solid var(--ui-border);
      background: var(--ui-surface);
      font-family: var(--ui-font-sans);
      font-size: var(--ui-fs-sm);
      margin-bottom: 6px;
    }
    .items-block {
      display: flex; flex-direction: column;
      gap: var(--ui-sp-2);
      max-height: 360px;
      overflow-y: auto;
      padding: var(--ui-sp-2);
      background: var(--ui-surface-2);
      border: var(--ui-border-w-sm) solid var(--ui-border);
    }
    .items-group__title {
      font-size: var(--ui-fs-xs);
      font-weight: var(--ui-fw-black);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--ui-text-muted);
      margin-bottom: 4px;
    }
    .items-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 4px;
    }
    .item-chip {
      display: flex; align-items: center; gap: 6px;
      padding: 6px 8px;
      background: var(--ui-surface);
      border: var(--ui-border-w-sm) solid var(--ui-border);
      cursor: pointer;
      font-size: var(--ui-fs-xs);
      color: var(--ui-text);
    }
    .item-chip:hover { background: var(--ui-surface-3); }
    .item-chip input { margin: 0; }
    .item-chip span { font-weight: var(--ui-fw-bold); flex: 1; }
    .item-chip small { color: var(--ui-text-muted); }
    .item-chip input:checked ~ span { color: var(--ui-success); }
    .muted-msg {
      color: var(--ui-text-muted);
      font-style: italic;
      grid-column: 1 / -1;
      padding: 6px;
    }
  `],
})
export class ProveedorFormModalComponent {
  @Input() isOpen = false;
  @Input() set editing(value: Supplier | null) { this._editing.set(value); this.hydrate(value); }
  get editing() { return this._editing(); }
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  private readonly data = inject(DataService);
  private readonly toast = inject(ToastService);

  private readonly _editing = signal<Supplier | null>(null);

  protected readonly weekDays = WEEK_DAYS;

  readonly name = signal('');
  readonly contactPerson = signal('');
  readonly phone = signal('');
  readonly email = signal('');
  readonly leadTimeDays = signal(1);
  readonly paymentTerms = signal('');
  readonly orderDays = signal<number[]>([]);
  readonly deliveryDays = signal<number[]>([]);
  readonly notes = signal('');
  readonly active = signal(true);

  /** Items que entrega: array de {kind, itemId}. */
  readonly suppliedItems = signal<SupplierItem[]>([]);
  readonly itemFilter = signal('');

  readonly selectedSuppliesCount = computed(() =>
    this.suppliedItems().filter(i => i.kind === 'supply').length
  );
  readonly selectedProductsCount = computed(() =>
    this.suppliedItems().filter(i => i.kind === 'product').length
  );

  readonly filteredSupplies = computed(() => {
    const q = this.itemFilter().trim().toLowerCase();
    return this.data.activeSupplies()
      .filter(s => !q || s.name.toLowerCase().includes(q) || s.sku.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  readonly filteredProducts = computed(() => {
    const q = this.itemFilter().trim().toLowerCase();
    return this.data.activeProducts()
      .filter(p => !p.hasRecipe)
      .filter(p => !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  readonly canSave = computed(() => this.name().trim().length > 0 && this.leadTimeDays() >= 0);

  isItemSelected(kind: 'supply' | 'product', itemId: string): boolean {
    return this.suppliedItems().some(i => i.kind === kind && i.itemId === itemId);
  }

  toggleItem(kind: 'supply' | 'product', itemId: string) {
    this.suppliedItems.update(arr =>
      this.isItemSelected(kind, itemId)
        ? arr.filter(i => !(i.kind === kind && i.itemId === itemId))
        : [...arr, { kind, itemId }]
    );
  }

  constructor() {
    effect(() => {
      // Si cambia editing, re-hidratamos. Manejado en setter también.
      const e = this._editing();
      if (!e) {
        this.reset();
      }
    });
  }

  dayLabel(d: number): string { return DAY_LABELS[d]; }
  asNum(raw: string): number { const n = Number(raw); return isFinite(n) ? Math.max(0, Math.floor(n)) : 0; }

  toggleOrderDay(d: number) {
    this.orderDays.update(arr => arr.includes(d) ? arr.filter(x => x !== d) : [...arr, d].sort());
  }
  toggleDeliveryDay(d: number) {
    this.deliveryDays.update(arr => arr.includes(d) ? arr.filter(x => x !== d) : [...arr, d].sort());
  }

  private hydrate(s: Supplier | null) {
    if (!s) { this.reset(); return; }
    this.name.set(s.name);
    this.contactPerson.set(s.contactPerson ?? '');
    this.phone.set(s.phone ?? '');
    this.email.set(s.email ?? '');
    this.leadTimeDays.set(s.leadTimeDays);
    this.paymentTerms.set(s.paymentTerms ?? '');
    this.orderDays.set([...s.orderDays]);
    this.deliveryDays.set([...s.deliveryDays]);
    this.suppliedItems.set([...(s.suppliedItems ?? [])]);
    this.notes.set(s.notes ?? '');
    this.active.set(s.active);
    this.itemFilter.set('');
  }

  private reset() {
    this.name.set(''); this.contactPerson.set(''); this.phone.set(''); this.email.set('');
    this.leadTimeDays.set(1); this.paymentTerms.set('');
    this.orderDays.set([]); this.deliveryDays.set([]);
    this.suppliedItems.set([]); this.itemFilter.set('');
    this.notes.set(''); this.active.set(true);
  }

  async save() {
    if (!this.canSave()) return;
    const payload = {
      name: this.name().trim(),
      contactPerson: this.contactPerson().trim() || undefined,
      phone: this.phone().trim() || undefined,
      email: this.email().trim() || undefined,
      leadTimeDays: this.leadTimeDays(),
      paymentTerms: this.paymentTerms().trim() || undefined,
      orderDays: this.orderDays(),
      deliveryDays: this.deliveryDays(),
      suppliedItems: this.suppliedItems(),
      notes: this.notes().trim() || undefined,
      active: this.active(),
    };
    try {
      if (this._editing()) {
        this.data.updateSupplier(this._editing()!.id, payload);
        await this.toast.show('Proveedor actualizado.');
      } else {
        const s = this.data.createSupplier(payload);
        await this.toast.show(`Proveedor "${s.name}" creado.`);
      }
      this.saved.emit();
    } catch (e: unknown) {
      await this.toast.show(e instanceof Error ? e.message : 'Error al guardar.', 'danger');
    }
  }
}
