import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonButton } from '@ionic/angular/standalone';
import { FormModalComponent } from '../../shared/components/form-modal/form-modal.component';
import { FormFieldComponent } from '../../shared/components/form-field/form-field.component';
import { Customer, CustomerFiscal, TipoIdentificacion } from '../../core/models';
import { DataService } from '../../core/services/data.service';
import { TenantContextService } from '../../core/services/tenant-context.service';
import { UbicacionesService } from '../../core/services/ubicaciones.service';
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
  protected readonly tenant = inject(TenantContextService);
  protected readonly ubic = inject(UbicacionesService);
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
    // Datos fiscales (factura electrónica)
    feTipo: this.fb.control<TipoIdentificacion>('02', { nonNullable: true }),
    feIdentificacion: this.fb.control('', { nonNullable: true }),
    feNombre: this.fb.control('', { nonNullable: true }),
    feProvincia: this.fb.control('', { nonNullable: true }),
    feCanton: this.fb.control('', { nonNullable: true }),
    feDistrito: this.fb.control('', { nonNullable: true }),
    feBarrio: this.fb.control('', { nonNullable: true }),
    feOtrasSenas: this.fb.control('', { nonNullable: true }),
  });

  protected readonly tiposId = [
    { id: '01', label: 'Física' },
    { id: '02', label: 'Jurídica' },
    { id: '03', label: 'DIMEX' },
    { id: '04', label: 'NITE' },
  ] as const;

  // Selección en cascada de ubicación (guardamos códigos de Hacienda).
  private readonly _provincia = signal('');
  private readonly _canton = signal('');
  private readonly _distrito = signal('');
  readonly provinciaSel = this._provincia.asReadonly();
  readonly cantonSel = this._canton.asReadonly();
  readonly distritoSel = this._distrito.asReadonly();

  readonly provinciaOpts = computed(() => { this.ubic.ready(); return this.ubic.provincias(); });
  readonly cantonOpts = computed(() => { this.ubic.ready(); return this.ubic.cantones(this._provincia()); });
  readonly distritoOpts = computed(() => { this.ubic.ready(); return this.ubic.distritos(this._provincia(), this._canton()); });

  onProvincia(codigo: string) {
    this._provincia.set(codigo);
    this._canton.set('');
    this._distrito.set('');
    this.form.patchValue({ feProvincia: codigo, feCanton: '', feDistrito: '' });
  }
  onCanton(codigo: string) {
    this._canton.set(codigo);
    this._distrito.set('');
    this.form.patchValue({ feCanton: codigo, feDistrito: '' });
  }
  onDistrito(codigo: string) {
    this._distrito.set(codigo);
    this.form.patchValue({ feDistrito: codigo });
  }

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
      if (this.isOpen()) void this.ubic.ensureLoaded();
      const c = this.editing();
      if (c) {
        const f = c.fiscal;
        this._provincia.set(f?.provincia ?? '');
        this._canton.set(f?.canton ?? '');
        this._distrito.set(f?.distrito ?? '');
        this.form.patchValue({
          name: c.name,
          contactPerson: c.contactPerson ?? '',
          email: c.email ?? '',
          phone: c.phone ?? '',
          notes: c.notes ?? '',
          active: c.active,
          feTipo: f?.tipoIdentificacion ?? '02',
          feIdentificacion: f?.identificacion ?? '',
          feNombre: f?.nombre ?? '',
          feProvincia: f?.provincia ?? '',
          feCanton: f?.canton ?? '',
          feDistrito: f?.distrito ?? '',
          feBarrio: f?.barrio ?? '',
          feOtrasSenas: f?.otrasSenas ?? '',
        });
        this._allowed.set([...c.allowedProductIds]);
        this._prices.set({ ...(c.productPrices ?? {}) });
        this._orderDays.set([...c.window.orderDays]);
        this._deliveryDays.set([...c.window.deliveryDays]);
      } else if (this.isOpen()) {
        this.form.reset({
          name: '', contactPerson: '', email: '', phone: '', notes: '', active: true,
          feTipo: '02', feIdentificacion: '', feNombre: '',
          feProvincia: '', feCanton: '', feDistrito: '', feBarrio: '', feOtrasSenas: '',
        });
        this._provincia.set('');
        this._canton.set('');
        this._distrito.set('');
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

  /** Construye los datos fiscales. undefined si no se ingresó la identificación. */
  private buildFiscal(): CustomerFiscal | undefined {
    const v = this.form.getRawValue();
    const id = v.feIdentificacion.trim();
    if (!id) return undefined;
    return {
      tipoIdentificacion: v.feTipo,
      identificacion: id,
      nombre: v.feNombre.trim() || undefined,
      provincia: v.feProvincia.trim() || undefined,
      canton: v.feCanton.trim() || undefined,
      distrito: v.feDistrito.trim() || undefined,
      barrio: v.feBarrio.trim() || undefined,
      otrasSenas: v.feOtrasSenas.trim() || undefined,
    };
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
          fiscal: this.buildFiscal(),
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
          fiscal: this.buildFiscal(),
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
