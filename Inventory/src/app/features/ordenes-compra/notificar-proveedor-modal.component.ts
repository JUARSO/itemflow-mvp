import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonModal, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons,
  IonButton, IonIcon,
} from '@ionic/angular/standalone';
import { DataService } from '../../core/services/data.service';
import { TenantContextService } from '../../core/services/tenant-context.service';
import { ToastService } from '../../shared/components/toast/toast.service';
import { PurchaseOrder, Supplier } from '../../core/models';

/**
 * Modal para enviarle al proveedor el detalle de una OC.
 * Construye un mensaje editable con el listado de items + cantidades +
 * fecha esperada, y ofrece 3 canales:
 *  - Email: abre el cliente con `mailto:`
 *  - WhatsApp: abre wa.me con el texto codificado
 *  - Copiar: copia al portapapeles
 *
 * No envía nada por backend — usa los handlers nativos del navegador / SO.
 */
@Component({
  selector: 'app-notificar-proveedor-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    IonModal, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons,
    IonButton, IonIcon,
  ],
  templateUrl: './notificar-proveedor-modal.component.html',
  styleUrls: ['./notificar-proveedor-modal.component.scss'],
})
export class NotificarProveedorModalComponent {
  @Input() isOpen = false;
  @Input() set po(value: PurchaseOrder | null) {
    this._po.set(value);
    if (value) this.hydrateDraft(value);
  }
  @Output() closed = new EventEmitter<void>();

  private readonly data = inject(DataService);
  private readonly tenant = inject(TenantContextService);
  private readonly toast = inject(ToastService);

  protected readonly _po = signal<PurchaseOrder | null>(null);

  readonly subject = signal('');
  readonly body = signal('');

  /** Busca el proveedor estructurado por nombre (match case-insensitive). */
  readonly supplier = computed<Supplier | undefined>(() => {
    const p = this._po();
    if (!p) return undefined;
    const target = p.supplier.trim().toLowerCase();
    return this.data.suppliers().find(s => s.name.trim().toLowerCase() === target);
  });

  readonly mailtoUrl = computed(() => {
    const email = this.supplier()?.email;
    if (!email) return '#';
    const params = new URLSearchParams({
      subject: this.subject(),
      body: this.body(),
    }).toString().replace(/\+/g, '%20');
    return `mailto:${email}?${params}`;
  });

  readonly waUrl = computed(() => {
    const phone = this.supplier()?.phone;
    if (!phone) return '#';
    const cleaned = phone.replace(/[^\d]/g, '');
    const text = `*${this.subject()}*\n\n${this.body()}`;
    return `https://wa.me/${cleaned}?text=${encodeURIComponent(text)}`;
  });

  private hydrateDraft(po: PurchaseOrder) {
    const companyName = this.tenant.company().name;
    this.subject.set(`Pedido ${po.code} — ${companyName}`);
    this.body.set(this.buildDefaultBody(po, companyName));
  }

  private buildDefaultBody(po: PurchaseOrder, companyName: string): string {
    const lines = po.items
      .map(it => `  · ${it.itemName}: ${it.qty} unid. (₡${this.fmt(it.unitCost)} c/u)`)
      .join('\n');
    const expectedLine = po.expectedDate
      ? `Fecha esperada de entrega: ${this.fmtDate(po.expectedDate)}\n\n`
      : '';
    const supplierName = this.supplier()?.contactPerson ?? po.supplier;
    return [
      `Hola ${supplierName},`,
      ``,
      `Necesitamos hacer el siguiente pedido (OC ${po.code}):`,
      ``,
      lines,
      ``,
      `Total estimado: ₡${this.fmt(po.totalCost)}`,
      ``,
      expectedLine + `Por favor confirmá la disponibilidad y la fecha de entrega.`,
      ``,
      `Gracias,`,
      `${companyName}`,
    ].join('\n');
  }

  private fmt(v: number): string {
    return new Intl.NumberFormat('es-CR', { maximumFractionDigits: 0 }).format(v);
  }
  private fmtDate(d: Date): string {
    return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
  }

  async onSend(channel: 'email' | 'wa', event: MouseEvent) {
    const ok = channel === 'email' ? !!this.supplier()?.email : !!this.supplier()?.phone;
    if (!ok) {
      event.preventDefault();
      await this.toast.show(
        channel === 'email' ? 'No hay email registrado para este proveedor.'
                            : 'No hay teléfono registrado para este proveedor.',
        'danger'
      );
      return;
    }
    await this.toast.show(channel === 'email' ? 'Abriendo cliente de email…' : 'Abriendo WhatsApp…');
  }

  async copyToClipboard() {
    const text = `${this.subject()}\n\n${this.body()}`;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        await this.toast.show('Mensaje copiado al portapapeles.');
      } else {
        await this.toast.show('Copiado no disponible en este navegador.', 'danger');
      }
    } catch {
      await this.toast.show('No se pudo copiar.', 'danger');
    }
  }
}
