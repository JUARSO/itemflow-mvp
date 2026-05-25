import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
  IonButton, IonIcon, IonBadge,
} from '@ionic/angular/standalone';
import { DataService } from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../shared/components/toast/toast.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { ClienteFormModalComponent } from './cliente-form-modal.component';
import { Customer, CustomerOrder, OrderItem } from '../../core/models';

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] as const;

@Component({
  selector: 'app-clientes',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, DecimalPipe,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
    IonButton, IonIcon, IonBadge,
    PageHeaderComponent, KpiCardComponent, ClienteFormModalComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-menu-button></ion-menu-button></ion-buttons>
        <ion-title>Clientes</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <app-page-header
        title="Clientes"
        subtitle="Gestiona los clientes con acceso al portal externo. Cada cliente recibe un link único y un PIN.">
        <ion-button (click)="abrirNuevo()">+ Nuevo cliente</ion-button>
      </app-page-header>

      <div class="kpis">
        <app-kpi-card label="Clientes activos" [value]="data.activeCustomers().length" tone="success"></app-kpi-card>
        <app-kpi-card label="Total clientes" [value]="data.customers().length" tone="primary"></app-kpi-card>
        <app-kpi-card label="Pedidos de clientes" [value]="pedidosDesdeClientes()" tone="transit"
          hint="órdenes generadas desde portal"></app-kpi-card>
      </div>

      @if (data.customers().length === 0) {
        <div class="empty">
          <h3>No hay clientes registrados</h3>
          <p>Crea un cliente para generar su link de portal y PIN de acceso.</p>
          <ion-button (click)="abrirNuevo()">+ Crear primer cliente</ion-button>
        </div>
      }

      <div class="cards">
        @for (c of data.customers(); track c.id) {
          <article class="card" [class.card--inactive]="!c.active">
            <header class="card__head">
              <div>
                <h3 class="card__name">{{ c.name }}</h3>
                @if (c.contactPerson) {
                  <div class="card__contact">{{ c.contactPerson }}</div>
                }
              </div>
              <ion-badge [color]="c.active ? 'success' : 'medium'">
                {{ c.active ? 'Activo' : 'Inactivo' }}
              </ion-badge>
            </header>

            @if (c.email || c.phone) {
              <div class="card__info">
                @if (c.email) { <span><ion-icon name="mail-open-outline"></ion-icon> {{ c.email }}</span> }
                @if (c.phone) { <span class="mono">{{ c.phone }}</span> }
              </div>
            }

            <!-- Acceso del portal -->
            <div class="access">
              <div class="access__row">
                <span class="access__label">
                  <ion-icon name="link-outline"></ion-icon> Link del portal
                </span>
                <button class="access__btn" (click)="copyLink(c)" title="Copiar link">
                  <ion-icon name="copy-outline"></ion-icon>
                </button>
              </div>
              <code class="access__url">{{ portalUrl(c) }}</code>

              <div class="access__row">
                <span class="access__label">PIN de acceso</span>
                <button class="access__btn" (click)="regenerarPin(c)" title="Regenerar PIN">
                  <ion-icon name="refresh-outline"></ion-icon>
                </button>
              </div>
              <code class="access__pin mono">{{ c.accessPin }}</code>
            </div>

            <!-- Ventanas -->
            <div class="windows">
              <div class="window">
                <div class="window__label">Días para pedir</div>
                <div class="window__days">
                  @for (d of weekDays; track d) {
                    <span class="dot" [class.dot--on]="c.window.orderDays.includes(d)">{{ dayLabel(d) }}</span>
                  }
                </div>
              </div>
              <div class="window">
                <div class="window__label">Días de entrega</div>
                <div class="window__days">
                  @for (d of weekDays; track d) {
                    <span class="dot" [class.dot--on]="c.window.deliveryDays.includes(d)">{{ dayLabel(d) }}</span>
                  }
                </div>
              </div>
            </div>

            <div class="card__products">
              <ion-icon name="library-outline"></ion-icon>
              @if (c.allowedProductIds.length === 0) {
                Acceso a todo el catálogo
              } @else {
                {{ c.allowedProductIds.length }} producto(s) permitido(s)
              }
            </div>

            @if (c.notes) {
              <p class="card__notes">{{ c.notes }}</p>
            }

            <!-- Historial de pedidos (expandible) -->
            <button class="history-toggle" (click)="toggleHistory(c.id)">
              <ion-icon [name]="expanded() === c.id ? 'chevron-up-outline' : 'chevron-down-outline'"></ion-icon>
              <span>Historial de pedidos ({{ pedidosDelCliente(c.id).length }})</span>
              @if (pedidosPendientesAceptar(c.id) > 0) {
                <ion-badge color="warning">{{ pedidosPendientesAceptar(c.id) }} por aceptar</ion-badge>
              }
            </button>
            @if (expanded() === c.id) {
              @if (pedidosDelCliente(c.id).length === 0) {
                <div class="history-empty">Este cliente aún no ha hecho pedidos.</div>
              } @else {
                <div class="history">
                  @for (o of pedidosDelCliente(c.id); track o.id) {
                    <div class="history__row"
                      [attr.data-status]="o.status"
                      [class.history__row--confirmed]="!!o.customerConfirmedAt">
                      <div class="history__head">
                        <span class="mono">{{ o.code }}</span>
                        <span class="status" [attr.data-status]="effectiveStatus(o)">{{ statusLabelOf(o) }}</span>
                      </div>
                      <div class="history__items">
                        {{ o.items.length }} producto(s) · {{ totalUnits(o) }} und solicitadas
                      </div>

                      <!-- Detalle por producto si hay confirmación o producción parcial -->
                      @if (o.customerConfirmedAt || hasFulfillment(o)) {
                        <table class="hist-table">
                          <thead>
                            <tr>
                              <th>Producto</th>
                              <th class="num">Pedido</th>
                              <th class="num">Producido</th>
                              <th class="num">Recibido</th>
                              <th class="num">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody>
                            @for (it of o.items; track it.productId) {
                              <tr>
                                <td>{{ it.productName }}</td>
                                <td class="num mono">{{ it.qty }}</td>
                                <td class="num mono">{{ it.fulfilledQty }}</td>
                                <td class="num mono"
                                  [class.diff-down]="hasReceptionDiff(it)">
                                  @if (o.customerConfirmedAt) {
                                    {{ it.receivedQty ?? 0 }}
                                  } @else {
                                    —
                                  }
                                </td>
                                <td class="num mono">
                                  ₡{{ adminSubtotal(o, it) | number:'1.0-0' }}
                                </td>
                              </tr>
                            }
                          </tbody>
                        </table>
                      }

                      <div class="history__totals">
                        <span class="muted">Total original:
                          <span class="mono">₡{{ o.totalAmount | number:'1.0-0' }}</span>
                        </span>
                        @if (o.customerConfirmedAt) {
                          <span class="final">
                            Final: <strong class="mono">₡{{ (o.finalAmount ?? o.totalAmount) | number:'1.0-0' }}</strong>
                          </span>
                          @if ((o.finalAmount ?? o.totalAmount) < o.totalAmount) {
                            <ion-badge color="danger">
                              −₡{{ (o.totalAmount - (o.finalAmount ?? 0)) | number:'1.0-0' }}
                            </ion-badge>
                          }
                        }
                      </div>

                      @if (o.customerNote) {
                        <div class="history__note">
                          <strong>Nota cliente:</strong> {{ o.customerNote }}
                        </div>
                      }

                      <div class="history__meta">
                        <ion-icon name="calendar-outline"></ion-icon>
                        Creado {{ o.createdAt | date:'dd-MM HH:mm' }}
                        @if (o.requestedDeliveryDate) {
                          · entrega {{ o.requestedDeliveryDate | date:'dd-MM' }}
                        }
                        @if (o.customerConfirmedAt) {
                          · recibido {{ o.customerConfirmedAt | date:'dd-MM HH:mm' }}
                        }
                      </div>
                      @if (o.status === 'pending') {
                        <div class="history__actions">
                          <ion-button size="small" color="success" (click)="aceptarPedido(o.id)">
                            Aceptar e iniciar producción
                          </ion-button>
                          <ion-button size="small" color="danger" fill="clear" (click)="rechazarPedido(o.id)">
                            Rechazar
                          </ion-button>
                        </div>
                      }
                    </div>
                  }
                </div>
              }
            }

            <footer class="card__foot">
              <span class="card__since">Desde {{ c.createdAt | date:'dd-MM-yyyy' }}</span>
              <div class="card__actions">
                <ion-button size="small" fill="clear" class="ghost" (click)="abrirEditar(c)">
                  <ion-icon name="create-outline" slot="start"></ion-icon>
                  Editar
                </ion-button>
                <ion-button size="small" color="danger" fill="clear" (click)="eliminar(c)">
                  <ion-icon name="trash-outline" slot="start"></ion-icon>
                  Eliminar
                </ion-button>
              </div>
            </footer>
          </article>
        }
      </div>

      <app-cliente-form-modal
        [isOpen]="modalOpen()"
        [editing]="editing()"
        (closed)="cerrarModal()"
        (saved)="cerrarModal()">
      </app-cliente-form-modal>
    </ion-content>
  `,
  styles: [`
    .kpis {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--ui-sp-3);
      padding: 0 var(--ui-sp-4) var(--ui-sp-4);
    }
    @media (max-width: 700px) { .kpis { grid-template-columns: 1fr; } }

    .empty {
      margin: var(--ui-sp-4);
      padding: var(--ui-sp-6) var(--ui-sp-4);
      text-align: center;
      background: var(--ui-surface-2);
      border: var(--ui-border-w-md) dashed var(--ui-border);
    }
    .empty h3 { margin: 0 0 var(--ui-sp-2); font-size: var(--ui-fs-lg); }
    .empty p { margin: 0 0 var(--ui-sp-3); color: var(--ui-text-muted); font-size: var(--ui-fs-sm); }

    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: var(--ui-sp-3);
      padding: 0 var(--ui-sp-4) var(--ui-sp-8);
    }
    .card {
      background: var(--ui-surface);
      border: var(--ui-border-w-md) solid var(--ui-border);
      box-shadow: var(--ui-shadow-md);
      padding: var(--ui-sp-3);
      display: flex;
      flex-direction: column;
      gap: var(--ui-sp-3);
    }
    .card--inactive { opacity: 0.5; }
    .card__head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: var(--ui-sp-2);
    }
    .card__name {
      margin: 0;
      font-size: var(--ui-fs-lg);
      font-weight: var(--ui-fw-black);
    }
    .card__contact {
      font-size: var(--ui-fs-sm);
      color: var(--ui-text-muted);
      margin-top: 2px;
    }
    .card__info {
      display: flex;
      gap: var(--ui-sp-3);
      font-size: var(--ui-fs-xs);
      color: var(--ui-text-muted);
      flex-wrap: wrap;
    }
    .card__info ion-icon { vertical-align: middle; font-size: 14px; }

    .access {
      background: var(--ui-surface-2);
      padding: var(--ui-sp-2) var(--ui-sp-3);
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .access__row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 4px;
    }
    .access__row:first-child { margin-top: 0; }
    .access__label {
      font-size: var(--ui-fs-xs);
      text-transform: uppercase;
      font-weight: var(--ui-fw-black);
      color: var(--ui-text-muted);
      letter-spacing: 0.5px;
    }
    .access__url {
      font-family: var(--ui-font-mono);
      font-size: var(--ui-fs-xs);
      color: var(--ui-primary);
      word-break: break-all;
      display: block;
      padding: 4px 0;
    }
    .access__pin {
      font-size: var(--ui-fs-lg);
      font-weight: var(--ui-fw-black);
      letter-spacing: 2px;
      color: var(--ui-text);
    }
    .access__btn {
      width: 28px;
      height: 28px;
      border: var(--ui-border-w-sm) solid var(--ui-border);
      background: var(--ui-surface);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--ui-text);
    }
    .access__btn:hover { background: var(--ui-primary); color: var(--ui-primary-contrast); border-color: var(--ui-primary); }
    .access__btn ion-icon { font-size: 16px; }
    .access__label ion-icon { vertical-align: middle; font-size: 12px; margin-right: 2px; }

    .windows {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--ui-sp-2);
    }
    .window__label {
      font-size: var(--ui-fs-xs);
      font-weight: var(--ui-fw-black);
      text-transform: uppercase;
      color: var(--ui-text-muted);
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .window__days {
      display: flex;
      gap: 2px;
      flex-wrap: wrap;
    }
    .dot {
      flex: 1;
      min-width: 28px;
      text-align: center;
      padding: 4px 0;
      font-size: 10px;
      font-weight: var(--ui-fw-bold);
      background: var(--ui-surface-2);
      color: var(--ui-text-muted);
      border: var(--ui-border-w-sm) solid var(--ui-border);
    }
    .dot--on {
      background: var(--ui-success);
      color: #fff;
      border-color: var(--ui-success);
    }

    .card__products {
      font-size: var(--ui-fs-sm);
      color: var(--ui-text-muted);
      padding: 6px 0;
      border-top: var(--ui-border-w-sm) solid var(--ui-border);
    }
    .card__products ion-icon { vertical-align: middle; font-size: 14px; margin-right: 4px; }
    .card__notes {
      margin: 0;
      padding: 8px;
      background: var(--ui-surface-2);
      font-size: var(--ui-fs-xs);
      color: var(--ui-text);
      font-style: italic;
    }
    .card__foot {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: var(--ui-sp-2);
      border-top: var(--ui-border-w-sm) solid var(--ui-border);
    }
    .card__since {
      font-size: var(--ui-fs-xs);
      color: var(--ui-text-muted);
    }
    .card__actions { display: flex; gap: 4px; }

    /* Historial expandible */
    .history-toggle {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 10px;
      background: var(--ui-surface-2);
      border: var(--ui-border-w-sm) solid var(--ui-border);
      cursor: pointer;
      font-size: var(--ui-fs-sm);
      font-weight: var(--ui-fw-bold);
      color: var(--ui-text);
      text-align: left;
      width: 100%;
    }
    .history-toggle:hover { background: var(--ui-surface-3); }
    .history-toggle ion-icon { font-size: 16px; }
    .history-toggle ion-badge { margin-left: auto; }
    .history-empty {
      padding: var(--ui-sp-3);
      text-align: center;
      color: var(--ui-text-muted);
      font-size: var(--ui-fs-xs);
      background: var(--ui-surface-2);
      border: var(--ui-border-w-sm) solid var(--ui-border);
      border-top: none;
    }
    .history {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 8px;
      background: var(--ui-surface-2);
      border: var(--ui-border-w-sm) solid var(--ui-border);
      border-top: none;
    }
    .history__row {
      padding: 8px;
      background: var(--ui-surface);
      border-left: 4px solid var(--ui-text-muted);
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .history__row[data-status="pending"]       { border-left-color: var(--ui-warning); }
    .history__row[data-status="in_production"] { border-left-color: var(--ui-transit); }
    .history__row[data-status="completed"]     { border-left-color: var(--ui-success); }
    .history__row[data-status="cancelled"]     { border-left-color: var(--ui-danger); }

    .history__head {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .history__items {
      font-size: var(--ui-fs-xs);
      color: var(--ui-text);
    }
    .history__meta {
      font-size: 11px;
      color: var(--ui-text-muted);
    }
    .history__meta ion-icon { vertical-align: middle; font-size: 12px; }
    .history__actions {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
      margin-top: 6px;
    }
    .status {
      padding: 2px 8px;
      font-size: 10px;
      font-weight: var(--ui-fw-black);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border: var(--ui-border-w-sm) solid var(--ui-border);
      background: var(--ui-surface);
    }
    .status[data-status="pending"]       { background: var(--ui-warning); color: #000; }
    .status[data-status="in_production"] { background: var(--ui-transit); color: #fff; }
    .status[data-status="completed"]     { background: var(--ui-success); color: #fff; }
    .status[data-status="cancelled"]     { background: var(--ui-danger); color: #fff; }
    .status[data-status="awaiting"]      { background: var(--ui-warning); color: #000; }
    .status[data-status="received"]      { background: var(--ui-success); color: #fff; }

    .history__row--confirmed {
      border-left-color: var(--ui-success) !important;
    }

    .hist-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 4px;
      font-size: 11px;
    }
    .hist-table th,
    .hist-table td {
      padding: 4px 6px;
      border-bottom: var(--ui-border-w-sm) solid var(--ui-border);
      text-align: left;
    }
    .hist-table thead th {
      background: var(--ui-text);
      color: var(--ui-surface);
      font-weight: var(--ui-fw-black);
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .hist-table .num { text-align: right; }
    .hist-table .diff-down {
      color: var(--ui-danger);
      font-weight: var(--ui-fw-bold);
    }

    .history__totals {
      display: flex;
      gap: var(--ui-sp-2);
      align-items: center;
      font-size: var(--ui-fs-xs);
      flex-wrap: wrap;
      padding-top: 4px;
      border-top: var(--ui-border-w-sm) dashed var(--ui-border);
    }
    .history__totals .muted { color: var(--ui-text-muted); }
    .history__totals .final {
      font-weight: var(--ui-fw-bold);
      color: var(--ui-text);
    }
    .history__note {
      font-size: 11px;
      color: var(--ui-text);
      padding: 4px 6px;
      background: var(--ui-surface-2);
      font-style: italic;
    }
  `],
})
export class ClientesPage {
  protected readonly data = inject(DataService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly modalOpen = signal(false);
  readonly editing = signal<Customer | null>(null);
  /** ID del cliente cuyo historial está expandido (uno a la vez). */
  readonly expanded = signal<string | null>(null);

  protected readonly weekDays = [1, 2, 3, 4, 5, 6, 0]; // lun→dom

  readonly pedidosDesdeClientes = computed(() =>
    this.data.orders().filter(o => !!o.customerId).length
  );

  dayLabel(d: number): string {
    return DAY_LABELS[d];
  }

  /** Pedidos del cliente ordenados por fecha (más reciente primero). */
  pedidosDelCliente(customerId: string) {
    return this.data.orders()
      .filter(o => o.customerId === customerId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /** Cantidad de pedidos del cliente en estado 'pending' (esperando aceptación). */
  pedidosPendientesAceptar(customerId: string): number {
    return this.data.orders()
      .filter(o => o.customerId === customerId && o.status === 'pending')
      .length;
  }

  totalUnits(o: { items: { qty: number }[] }): number {
    return o.items.reduce((s, it) => s + it.qty, 0);
  }

  statusLabel(s: string): string {
    return {
      pending: 'Por aceptar',
      in_production: 'En producción',
      completed: 'Completado',
      cancelled: 'Cancelado',
    }[s] ?? s;
  }

  /** Label refinado por orden: distingue "Producido (por recibir)" de "Recibido". */
  statusLabelOf(o: CustomerOrder): string {
    if (o.customerConfirmedAt) return 'Recibido';
    if (o.status === 'completed') return 'Por recibir';
    return this.statusLabel(o.status);
  }

  /** Status efectivo para data-attr de estilos. */
  effectiveStatus(o: CustomerOrder): string {
    if (o.customerConfirmedAt) return 'received';
    if (o.status === 'completed') return 'awaiting';
    return o.status;
  }

  /** True si la orden tiene algún item con fulfilledQty > 0 (mostrar tabla detalle). */
  hasFulfillment(o: CustomerOrder): boolean {
    return o.items.some(it => it.fulfilledQty > 0);
  }

  /** Recibido menor que producido (cliente reportó diferencia). */
  hasReceptionDiff(it: OrderItem): boolean {
    return it.receivedQty !== undefined && it.receivedQty < it.fulfilledQty;
  }

  /**
   * Subtotal mostrado al admin: si el cliente ya confirmó, usa receivedQty.
   * Si no, usa qty solicitada (lo que el cliente esperaba cobrar/recibir).
   */
  adminSubtotal(o: CustomerOrder, it: OrderItem): number {
    const qty = o.customerConfirmedAt ? (it.receivedQty ?? 0) : it.qty;
    return qty * it.unitPrice;
  }

  toggleHistory(customerId: string) {
    this.expanded.update(cur => cur === customerId ? null : customerId);
  }

  async aceptarPedido(orderId: string) {
    const u = this.auth.user();
    try {
      const updated = this.data.startProduction(orderId, u?.uid ?? 'admin', u?.displayName ?? 'Admin');
      const totalReq = updated.items.reduce((s, it) => s + it.qty, 0);
      const totalDone = updated.items.reduce((s, it) => s + it.fulfilledQty, 0);
      if (totalDone === 0) {
        await this.toast.show('Sin insumos suficientes: el pedido quedó en producción sin reservas.', 'warning');
      } else if (totalDone < totalReq) {
        await this.toast.show(`Pedido aceptado (parcial: ${totalDone}/${totalReq}).`, 'warning');
      } else {
        await this.toast.show('Pedido aceptado y producción iniciada.');
      }
    } catch (e: unknown) {
      await this.toast.show(e instanceof Error ? e.message : 'Error al aceptar.', 'danger');
    }
  }

  async rechazarPedido(orderId: string) {
    if (!confirm('¿Rechazar este pedido? Se notificará al cliente como cancelado.')) return;
    const u = this.auth.user();
    try {
      this.data.cancelOrder(orderId, u?.uid ?? 'admin', u?.displayName ?? 'Admin', 'Rechazado por producción');
      await this.toast.show('Pedido rechazado.');
    } catch (e: unknown) {
      await this.toast.show(e instanceof Error ? e.message : 'Error al rechazar.', 'danger');
    }
  }

  /**
   * URL absoluta del portal del cliente.
   * Usa `document.baseURI` que ya respeta el `<base href>` configurado:
   *  - local: http://localhost:4200/c/{token}
   *  - GitHub Pages: https://juarso.github.io/itemflow-mvp/c/{token}
   * Las rutas SPA funcionan porque el workflow copia index.html → 404.html.
   */
  portalUrl(c: Customer): string {
    if (typeof document === 'undefined') return `/c/${c.publicToken}`;
    const base = document.baseURI.replace(/\/$/, '');
    return `${base}/c/${c.publicToken}`;
  }

  abrirNuevo() {
    this.editing.set(null);
    this.modalOpen.set(true);
  }

  abrirEditar(c: Customer) {
    this.editing.set(c);
    this.modalOpen.set(true);
  }

  cerrarModal() {
    this.modalOpen.set(false);
    this.editing.set(null);
  }

  async copyLink(c: Customer) {
    const url = this.portalUrl(c);
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        await this.toast.show('Link copiado al portapapeles.');
      }
    } catch {
      await this.toast.show('No se pudo copiar el link.', 'danger');
    }
  }

  async regenerarPin(c: Customer) {
    if (!confirm(`¿Generar un nuevo PIN para ${c.name}? El PIN anterior dejará de funcionar.`)) return;
    const newPin = this.data.regenerateCustomerPin(c.id);
    if (newPin) await this.toast.show(`Nuevo PIN: ${newPin}`);
  }

  async eliminar(c: Customer) {
    if (!confirm(`¿Eliminar el cliente "${c.name}"? El link y el PIN dejarán de funcionar.`)) return;
    this.data.deleteCustomer(c.id);
    await this.toast.show(`Cliente "${c.name}" eliminado.`);
  }
}
