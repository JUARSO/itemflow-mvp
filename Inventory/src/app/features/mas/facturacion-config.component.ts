import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonButton, IonBadge, IonIcon } from '@ionic/angular/standalone';
import { FacturacionService, EmisorFE } from '../../core/services/facturacion.service';
import { ToastService } from '../../shared/components/toast/toast.service';

@Component({
  selector: 'app-facturacion-config',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, IonButton, IonBadge, IonIcon],
  templateUrl: './facturacion-config.component.html',
  styleUrls: ['./facturacion-config.component.scss'],
})
export class FacturacionConfigComponent {
  private readonly fb = inject(FormBuilder);
  private readonly fe = inject(FacturacionService);
  private readonly toast = inject(ToastService);

  readonly configurado = this.fe.configurado;

  /** Certificado .p12: se guardan aparte porque no son inputs de texto normales. */
  readonly certNombre = signal<string | undefined>(undefined);
  private readonly certData = signal<string | undefined>(undefined);

  readonly form = this.fb.group({
    nombre: this.fb.control('', { nonNullable: true, validators: [Validators.required] }),
    tipoIdentificacion: this.fb.control<EmisorFE['tipoIdentificacion']>('02', { nonNullable: true }),
    identificacion: this.fb.control('', { nonNullable: true, validators: [Validators.required] }),
    nombreComercial: this.fb.control('', { nonNullable: true }),
    actividadEconomica: this.fb.control('', { nonNullable: true }),
    sucursal: this.fb.control('001', { nonNullable: true }),
    terminal: this.fb.control('00001', { nonNullable: true }),
    provincia: this.fb.control('', { nonNullable: true }),
    canton: this.fb.control('', { nonNullable: true }),
    distrito: this.fb.control('', { nonNullable: true }),
    barrio: this.fb.control('', { nonNullable: true }),
    otrasSenas: this.fb.control('', { nonNullable: true }),
    codigoPaisTel: this.fb.control('506', { nonNullable: true }),
    telefono: this.fb.control('', { nonNullable: true }),
    correo: this.fb.control('', { nonNullable: true, validators: [Validators.email] }),
    usuarioHacienda: this.fb.control('', { nonNullable: true }),
    passwordHacienda: this.fb.control('', { nonNullable: true }),
    certificadoPin: this.fb.control('', { nonNullable: true }),
  });

  constructor() {
    // Cargar valores guardados al iniciar.
    effect(() => {
      const e = this.fe.emisor();
      this.form.patchValue({
        nombre: e.nombre,
        tipoIdentificacion: e.tipoIdentificacion,
        identificacion: e.identificacion,
        nombreComercial: e.nombreComercial,
        actividadEconomica: e.actividadEconomica,
        sucursal: e.sucursal,
        terminal: e.terminal,
        provincia: e.provincia,
        canton: e.canton,
        distrito: e.distrito,
        barrio: e.barrio,
        otrasSenas: e.otrasSenas,
        codigoPaisTel: e.codigoPaisTel,
        telefono: e.telefono,
        correo: e.correo,
        usuarioHacienda: e.usuarioHacienda,
        passwordHacienda: e.passwordHacienda,
        certificadoPin: e.certificadoPin,
      }, { emitEvent: false });
      this.certNombre.set(e.certificadoNombre);
      this.certData.set(e.certificadoData);
    });
  }

  readonly tiposId = [
    { id: '01', label: 'Física' },
    { id: '02', label: 'Jurídica' },
    { id: '03', label: 'DIMEX' },
    { id: '04', label: 'NITE' },
  ] as const;

  async onCertFile(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 512 * 1024) {
      await this.toast.show('El certificado no debe superar 512 KB.', 'danger');
      input.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      this.certData.set(reader.result as string);
      this.certNombre.set(file.name);
    };
    reader.readAsDataURL(file);
  }

  quitarCert() {
    this.certNombre.set(undefined);
    this.certData.set(undefined);
  }

  async guardar() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      await this.toast.show('Revisa los campos requeridos (nombre, identificación, correo).', 'danger');
      return;
    }
    const v = this.form.getRawValue();
    const value: EmisorFE = {
      ...v,
      certificadoNombre: this.certNombre(),
      certificadoData: this.certData(),
    };
    this.fe.save(value);
    await this.toast.show('Datos de facturación electrónica guardados.', 'success');
  }
}
