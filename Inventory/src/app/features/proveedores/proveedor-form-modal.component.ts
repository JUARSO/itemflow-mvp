import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonModal, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons,
  IonButton, IonIcon,
} from '@ionic/angular/standalone';
import { DataService } from '../../core/services/data.service';
import { ToastService } from '../../shared/components/toast/toast.service';
import { Supplier, SupplierItem } from '../../core/models';
import { UnitShortPipe } from '../../shared/pipes/unit-short.pipe';

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
    UnitShortPipe,
  ],
  templateUrl: './proveedor-form-modal.component.html',
  styleUrls: ['./proveedor-form-modal.component.scss'],
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
