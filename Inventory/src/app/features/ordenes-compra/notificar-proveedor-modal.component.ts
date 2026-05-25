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
  template: `
    <ion-modal [isOpen]="isOpen" (didDismiss)="closed.emit()">
      <ng-template>
        <ion-header>
          <ion-toolbar>
            <ion-title>Notificar al proveedor</ion-title>
            <ion-buttons slot="end">
              <ion-button (click)="closed.emit()">
                <ion-icon name="close-outline"></ion-icon>
              </ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>

        <ion-content>
          @if (_po(); as po) {
            <div class="container">
              <!-- Resumen del destinatario -->
              <section class="recipient">
                <div class="recipient__title">
                  <ion-icon name="person-outline"></ion-icon>
                  <strong>{{ po.supplier }}</strong>
                </div>
                @if (supplier(); as s) {
                  <div class="recipient__row">
                    <span class="label">Contacto:</span>
                    <span>{{ s.contactPerson || '—' }}</span>
                  </div>
                  <div class="recipient__row">
                    <span class="label">Email:</span>
                    @if (s.email) {
                      <a [href]="'mailto:' + s.email" class="mono">{{ s.email }}</a>
                    } @else {
                      <span class="muted">no registrado</span>
                    }
                  </div>
                  <div class="recipient__row">
                    <span class="label">Teléfono:</span>
                    @if (s.phone) {
                      <span class="mono">{{ s.phone }}</span>
                    } @else {
                      <span class="muted">no registrado</span>
                    }
                  </div>
                } @else {
                  <div class="warn">
                    <ion-icon name="warning-outline"></ion-icon>
                    No se encontró el proveedor "{{ po.supplier }}" en la base.
                    Podés copiar el mensaje y enviarlo manualmente.
                    <a routerLink="/proveedores" class="link">Crear proveedor</a>
                  </div>
                }
              </section>

              <!-- Asunto -->
              <div class="field">
                <label>Asunto</label>
                <input type="text"
                  [value]="subject()"
                  (input)="subject.set($any($event.target).value)" />
              </div>

              <!-- Cuerpo editable -->
              <div class="field">
                <label>Mensaje</label>
                <textarea rows="14"
                  [value]="body()"
                  (input)="body.set($any($event.target).value)"></textarea>
              </div>

              <!-- Canales -->
              <div class="channels">
                <a class="channel channel--email"
                  [href]="mailtoUrl()"
                  [class.channel--disabled]="!supplier()?.email"
                  (click)="onSend('email', $event)">
                  <ion-icon name="mail-open-outline"></ion-icon>
                  <div>
                    <strong>Enviar por email</strong>
                    <small>
                      @if (supplier()?.email) {
                        {{ supplier()?.email }}
                      } @else {
                        sin email registrado
                      }
                    </small>
                  </div>
                </a>

                <a class="channel channel--wa"
                  [href]="waUrl()"
                  target="_blank"
                  rel="noopener"
                  [class.channel--disabled]="!supplier()?.phone"
                  (click)="onSend('wa', $event)">
                  <ion-icon name="chatbox-ellipses-outline"></ion-icon>
                  <div>
                    <strong>Enviar por WhatsApp</strong>
                    <small>
                      @if (supplier()?.phone) {
                        {{ supplier()?.phone }}
                      } @else {
                        sin teléfono registrado
                      }
                    </small>
                  </div>
                </a>

                <button class="channel channel--copy" type="button" (click)="copyToClipboard()">
                  <ion-icon name="copy-outline"></ion-icon>
                  <div>
                    <strong>Copiar mensaje</strong>
                    <small>pegalo donde necesites</small>
                  </div>
                </button>
              </div>
            </div>
          }
        </ion-content>
      </ng-template>
    </ion-modal>
  `,
  styles: [`
    .container {
      padding: var(--ui-sp-3);
      display: flex; flex-direction: column;
      gap: var(--ui-sp-3);
      max-width: 760px;
      margin: 0 auto;
    }

    .recipient {
      padding: var(--ui-sp-3);
      background: var(--ui-surface-2);
      border-left: 4px solid var(--ui-primary);
      display: flex; flex-direction: column;
      gap: 4px;
    }
    .recipient__title {
      display: flex; align-items: center; gap: 6px;
      font-size: var(--ui-fs-md);
      margin-bottom: 4px;
    }
    .recipient__title ion-icon { font-size: 18px; color: var(--ui-primary); }
    .recipient__row {
      display: flex; gap: var(--ui-sp-2);
      font-size: var(--ui-fs-sm);
    }
    .label {
      min-width: 80px;
      font-weight: var(--ui-fw-bold);
      color: var(--ui-text-muted);
      text-transform: uppercase;
      font-size: var(--ui-fs-xs);
      letter-spacing: 0.5px;
      align-self: center;
    }
    .muted { color: var(--ui-text-muted); font-style: italic; }
    .warn {
      display: flex; align-items: center; gap: 6px;
      padding: 6px 8px;
      background: var(--ui-warning);
      color: #000;
      font-size: var(--ui-fs-xs);
      font-weight: var(--ui-fw-bold);
      margin-top: 4px;
    }
    .warn ion-icon { font-size: 14px; }
    .link {
      color: var(--ui-primary);
      text-decoration: underline;
      margin-left: 4px;
    }

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
      width: 100%; box-sizing: border-box;
      resize: vertical;
    }
    .field textarea {
      font-family: var(--ui-font-mono);
      line-height: 1.5;
      white-space: pre-wrap;
    }

    .channels {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: var(--ui-sp-2);
    }
    @media (max-width: 600px) { .channels { grid-template-columns: 1fr; } }

    .channel {
      display: flex; align-items: center; gap: 8px;
      padding: 12px;
      text-decoration: none;
      border: var(--ui-border-w-md) solid var(--ui-border);
      background: var(--ui-surface);
      color: var(--ui-text);
      font-family: var(--ui-font-sans);
      cursor: pointer;
      text-align: left;
    }
    .channel:hover { background: var(--ui-surface-2); }
    .channel ion-icon { font-size: 22px; flex-shrink: 0; }
    .channel strong { display: block; font-size: var(--ui-fs-sm); }
    .channel small { color: var(--ui-text-muted); font-size: var(--ui-fs-xs); }
    .channel--email ion-icon { color: var(--ui-primary); }
    .channel--wa ion-icon { color: #25D366; }
    .channel--copy ion-icon { color: var(--ui-text-muted); }
    .channel--disabled {
      opacity: 0.4;
      pointer-events: none;
      cursor: not-allowed;
    }
  `],
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
