import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonButton } from '@ionic/angular/standalone';
import { FormModalComponent } from '../../shared/components/form-modal/form-modal.component';
import { FormFieldComponent } from '../../shared/components/form-field/form-field.component';
import { PosCliente, CustomerFiscal, TipoIdentificacion } from '../../core/models';
import { DataService } from '../../core/services/data.service';
import { UbicacionesService } from '../../core/services/ubicaciones.service';
import { ToastService } from '../../shared/components/toast/toast.service';

@Component({
  selector: 'app-pos-cliente-form-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, IonButton, FormModalComponent, FormFieldComponent],
  templateUrl: './pos-cliente-form-modal.component.html',
  styleUrls: ['./pos-cliente-form-modal.component.scss'],
})
export class PosClienteFormModalComponent {
  private readonly fb = inject(FormBuilder);
  private readonly data = inject(DataService);
  protected readonly ubic = inject(UbicacionesService);
  private readonly toast = inject(ToastService);

  readonly isOpen = input.required<boolean>();
  readonly editing = input<PosCliente | null>(null);
  readonly closed = output<void>();
  readonly saved = output<PosCliente>();

  protected readonly tiposId = [
    { id: '01', label: 'Física' },
    { id: '02', label: 'Jurídica' },
    { id: '03', label: 'DIMEX' },
    { id: '04', label: 'NITE' },
  ] as const;

  readonly form = this.fb.group({
    nombre: this.fb.control('', { nonNullable: true, validators: [Validators.required, Validators.minLength(2)] }),
    email: this.fb.control('', { nonNullable: true, validators: [Validators.email] }),
    telefono: this.fb.control('', { nonNullable: true }),
    feTipo: this.fb.control<TipoIdentificacion>('02', { nonNullable: true }),
    feIdentificacion: this.fb.control('', { nonNullable: true, validators: [Validators.required] }),
    feNombre: this.fb.control('', { nonNullable: true }),
    feBarrio: this.fb.control('', { nonNullable: true }),
    feOtrasSenas: this.fb.control('', { nonNullable: true }),
  });

  // Cascada de ubicación (códigos de Hacienda).
  private readonly _provincia = signal('');
  private readonly _canton = signal('');
  private readonly _distrito = signal('');
  readonly provinciaSel = this._provincia.asReadonly();
  readonly cantonSel = this._canton.asReadonly();
  readonly distritoSel = this._distrito.asReadonly();
  readonly provinciaOpts = computed(() => { this.ubic.ready(); return this.ubic.provincias(); });
  readonly cantonOpts = computed(() => { this.ubic.ready(); return this.ubic.cantones(this._provincia()); });
  readonly distritoOpts = computed(() => { this.ubic.ready(); return this.ubic.distritos(this._provincia(), this._canton()); });

  onProvincia(c: string) { this._provincia.set(c); this._canton.set(''); this._distrito.set(''); }
  onCanton(c: string) { this._canton.set(c); this._distrito.set(''); }
  onDistrito(c: string) { this._distrito.set(c); }

  constructor() {
    effect(() => {
      if (this.isOpen()) void this.ubic.ensureLoaded();
      const c = this.editing();
      if (c) {
        const f = c.fiscal;
        this._provincia.set(f.provincia ?? '');
        this._canton.set(f.canton ?? '');
        this._distrito.set(f.distrito ?? '');
        this.form.reset({
          nombre: c.nombre,
          email: c.email ?? '',
          telefono: c.telefono ?? '',
          feTipo: f.tipoIdentificacion,
          feIdentificacion: f.identificacion,
          feNombre: f.nombre ?? '',
          feBarrio: f.barrio ?? '',
          feOtrasSenas: f.otrasSenas ?? '',
        });
      } else if (this.isOpen()) {
        this._provincia.set(''); this._canton.set(''); this._distrito.set('');
        this.form.reset({
          nombre: '', email: '', telefono: '',
          feTipo: '02', feIdentificacion: '', feNombre: '', feBarrio: '', feOtrasSenas: '',
        });
      }
    });
  }

  async onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      await this.toast.show('Completa el nombre y la identificación del cliente.', 'danger');
      return;
    }
    const v = this.form.getRawValue();
    const fiscal: CustomerFiscal = {
      tipoIdentificacion: v.feTipo,
      identificacion: v.feIdentificacion.trim(),
      nombre: v.feNombre.trim() || undefined,
      provincia: this._provincia() || undefined,
      canton: this._canton() || undefined,
      distrito: this._distrito() || undefined,
      barrio: v.feBarrio.trim() || undefined,
      otrasSenas: v.feOtrasSenas.trim() || undefined,
    };
    try {
      const c = this.editing();
      let result: PosCliente;
      if (c) {
        result = { ...c, nombre: v.nombre, email: v.email || undefined, telefono: v.telefono || undefined, fiscal };
        this.data.updatePosCliente(result);
        await this.toast.show(`Cliente "${v.nombre}" actualizado.`);
      } else {
        result = this.data.createPosCliente({
          nombre: v.nombre,
          email: v.email || undefined,
          telefono: v.telefono || undefined,
          fiscal,
          active: true,
        });
        await this.toast.show(`Cliente "${result.nombre}" creado.`);
      }
      this.saved.emit(result);
    } catch (e: unknown) {
      await this.toast.show(e instanceof Error ? e.message : 'Error al guardar.', 'danger');
    }
  }
}
