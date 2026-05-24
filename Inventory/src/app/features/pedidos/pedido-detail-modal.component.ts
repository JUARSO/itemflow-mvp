import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { FormModalComponent } from '../../shared/components/form-modal/form-modal.component';
import { CustomerOrder, OrderShortfall, OrderStatus } from '../../core/models';
import { DataService } from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';
import { TenantContextService } from '../../core/services/tenant-context.service';
import { ToastService } from '../../shared/components/toast/toast.service';

type ActionMode = 'sales' | 'production';

/**
 * Modal que muestra el detalle completo de un pedido y las acciones
 * disponibles según el rol/área:
 *  - mode="sales": solo lectura + cancelar (si aún no entregado)
 *  - mode="production": acciones del ciclo (iniciar, listo, entregar, cancelar)
 */
@Component({
  selector: 'app-pedido-detail-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe, IonButton, IonIcon, FormModalComponent],
  template: `
    @if (order(); as o) {
      <app-form-modal
        [isOpen]="isOpen()"
        [title]="'Orden ' + o.code"
        (dismissed)="closed.emit()">

        <div body>
          @if (mode() === 'sales' && o.status === 'in_production') {
            <div class="flow-banner">
              <ion-icon name="hammer-outline" class="flow-banner__icon"></ion-icon>
              <span>
                Esta orden está siendo procesada por <strong>Producción</strong>.
                Al completarse, los productos se sumarán al stock disponible.
              </span>
            </div>
          }
          @if (mode() === 'production' && o.status === 'pending') {
            <div class="flow-banner flow-banner--in">
              <ion-icon name="arrow-down-circle-outline" class="flow-banner__icon"></ion-icon>
              <span>
                Nueva orden recibida desde <strong>Ventas</strong>.
                Al iniciar producción se reservarán los insumos disponibles.
              </span>
            </div>
          }
          <div class="meta">
            @if (o.purpose) {
              <div class="meta__row">
                <span class="meta__label">Motivo</span>
                <span class="meta__value">{{ o.purpose }}</span>
              </div>
            }
            <div class="meta__row">
              <span class="meta__label">Creado</span>
              <span class="meta__value mono">{{ o.createdAt | date:'dd-MM-yyyy HH:mm' }} · {{ o.createdBy }}</span>
            </div>
            <div class="meta__row">
              <span class="meta__label">Estado</span>
              <span class="status" [attr.data-status]="o.status">{{ statusLabel(o.status) }}</span>
            </div>
            @if (o.notes) {
              <div class="meta__row meta__row--block">
                <span class="meta__label">Notas</span>
                <span class="meta__notes">{{ o.notes }}</span>
              </div>
            }
          </div>

          <h3 class="section-title">Items</h3>
          <div class="items-table">
            <div class="items-table__head">
              <div>Producto</div>
              <div class="num">Pedido</div>
              <div class="num">Cumplido</div>
              <div class="num">P. Unit.</div>
              <div class="num">Total</div>
            </div>
            @for (it of o.items; track it.productId) {
              <div class="items-table__row">
                <div>{{ it.productName }}</div>
                <div class="num mono">{{ it.qty }} {{ it.unit }}</div>
                <div class="num mono" [class.warn]="it.fulfilledQty < it.qty">
                  {{ it.fulfilledQty }} {{ it.unit }}
                  @if (it.fulfilledQty < it.qty && o.status !== 'pending' && o.status !== 'cancelled') {
                    <span class="parcial">parcial</span>
                  }
                </div>
                <div class="num mono">₡{{ it.unitPrice | number:'1.0-0' }}</div>
                <div class="num mono"><strong>₡{{ it.qty * it.unitPrice | number:'1.0-0' }}</strong></div>
              </div>
            }
            <div class="items-table__total">
              <div>Total pedido</div>
              <div class="num mono">₡{{ o.totalAmount | number:'1.0-0' }}</div>
            </div>
          </div>

          @if (analysis(); as a) {
            @if (a.shortfalls.length > 0) {
              <h3 class="section-title section-title--warn">
                <ion-icon name="warning-outline"></ion-icon> Insumos faltantes
              </h3>
              <div class="hint">
                @if (o.status === 'pending') {
                  Si inicias producción ahora, solo se podrá fabricar parcialmente con el stock disponible.
                } @else {
                  Estos faltantes fueron detectados al iniciar producción.
                }
              </div>
              <div class="shortfalls">
                <div class="shortfalls__head">
                  <div>Insumo</div>
                  <div class="num">Requerido</div>
                  <div class="num">Disponible</div>
                  <div class="num">Falta</div>
                </div>
                @for (sf of a.shortfalls; track $index) {
                  <div class="shortfalls__row">
                    <div>{{ sf.itemName }} <small>({{ sf.kind === 'supply' ? 'insumo' : 'producto' }})</small></div>
                    <div class="num mono">{{ sf.required | number:'1.0-3' }} {{ sf.unit }}</div>
                    <div class="num mono">{{ sf.available | number:'1.0-3' }} {{ sf.unit }}</div>
                    <div class="num mono short">{{ sf.short | number:'1.0-3' }} {{ sf.unit }}</div>
                  </div>
                }
              </div>
            }
          }

          @if (o.reservations.length > 0 && o.status === 'in_production') {
            <h3 class="section-title">Insumos reservados</h3>
            <div class="reservas">
              @for (r of o.reservations; track $index) {
                <div class="reservas__row">
                  <span>{{ r.itemName }}</span>
                  <span class="mono">{{ r.qty | number:'1.0-3' }} {{ r.unit }}</span>
                </div>
              }
            </div>
          }

          @if (o.productionStartedAt || o.completedAt || o.cancelledAt) {
            <h3 class="section-title">Trazabilidad</h3>
            <div class="trace">
              <div class="trace__row">
                <span>Creada</span>
                <span class="mono">{{ o.createdAt | date:'dd-MM HH:mm' }}</span>
              </div>
              @if (o.productionStartedAt) {
                <div class="trace__row">
                  <span>Producción iniciada</span>
                  <span class="mono">{{ o.productionStartedAt | date:'dd-MM HH:mm' }}</span>
                </div>
              }
              @if (o.completedAt) {
                <div class="trace__row">
                  <span>Completada (stock actualizado)</span>
                  <span class="mono">{{ o.completedAt | date:'dd-MM HH:mm' }}</span>
                </div>
              }
              @if (o.cancelledAt) {
                <div class="trace__row">
                  <span>Cancelada</span>
                  <span class="mono">{{ o.cancelledAt | date:'dd-MM HH:mm' }}</span>
                </div>
              }
            </div>
          }
        </div>

        <div footer>
          <ion-button fill="clear" class="ghost" (click)="closed.emit()">Cerrar</ion-button>

          @if (mode() === 'production') {
            @if (o.status === 'pending') {
              @if (tenant.canCancelOrder()) {
                <ion-button color="danger" fill="outline" (click)="onCancel(o)">Cancelar</ion-button>
              }
              @if (tenant.canOperateProduction()) {
                <ion-button color="primary" (click)="onStart(o)">Iniciar producción</ion-button>
              }
            } @else if (o.status === 'in_production') {
              @if (tenant.canCancelOrder()) {
                <ion-button color="danger" fill="outline" (click)="onCancel(o)">Cancelar</ion-button>
              }
              @if (tenant.canOperateProduction()) {
                <ion-button color="success" (click)="onComplete(o)">Marcar completada</ion-button>
              }
            }
          } @else if (mode() === 'sales' && tenant.canCancelOrderFromSales()) {
            @if (o.status === 'pending' || o.status === 'in_production') {
              <ion-button color="danger" fill="outline" (click)="onCancel(o)">Cancelar orden</ion-button>
            }
          }
        </div>
      </app-form-modal>
    }
  `,
  styles: [`
    .flow-banner {
      display: flex;
      align-items: center;
      gap: var(--ui-sp-2);
      padding: var(--ui-sp-3);
      background: var(--ui-transit);
      color: #fff;
      border: var(--ui-border-w-md) solid var(--ui-border);
      margin-bottom: var(--ui-sp-3);
      font-size: var(--ui-fs-sm);
    }
    .flow-banner--in {
      background: var(--ui-primary);
      color: var(--ui-primary-contrast);
    }
    .flow-banner__icon {
      font-size: 24px;
      flex-shrink: 0;
      color: inherit;
    }
    .section-title--warn ion-icon { vertical-align: middle; font-size: 16px; }

    .meta {
      display: grid;
      gap: var(--ui-sp-2);
      padding: var(--ui-sp-3);
      background: var(--ui-surface-2);
      border: var(--ui-border-w-md) solid var(--ui-border);
      margin-bottom: var(--ui-sp-4);
    }
    .meta__row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--ui-sp-3);
      font-size: var(--ui-fs-sm);
    }
    .meta__row--block { flex-direction: column; align-items: flex-start; }
    .meta__label {
      font-size: var(--ui-fs-xs);
      font-weight: var(--ui-fw-black);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--ui-text-muted);
    }
    .meta__value { font-weight: var(--ui-fw-bold); }
    .meta__notes {
      font-size: var(--ui-fs-sm);
      color: var(--ui-text);
      background: var(--ui-surface);
      padding: var(--ui-sp-2);
      width: 100%;
      box-sizing: border-box;
      border: var(--ui-border-w-sm) solid var(--ui-border);
    }

    .status {
      padding: 4px 10px;
      font-size: var(--ui-fs-xs);
      font-weight: var(--ui-fw-black);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border: var(--ui-border-w-md) solid var(--ui-border);
      background: var(--ui-surface);
      color: var(--ui-text);
    }
    .status[data-status="pending"]       { background: var(--ui-warning); color: #000; }
    .status[data-status="in_production"] { background: var(--ui-transit); color: #fff; }
    .status[data-status="completed"]     { background: var(--ui-success); color: #fff; }
    .status[data-status="cancelled"]     { background: var(--ui-danger); color: #fff; }

    .section-title {
      font-size: var(--ui-fs-sm);
      font-weight: var(--ui-fw-black);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: var(--ui-sp-4) 0 var(--ui-sp-2);
      color: var(--ui-text);
    }
    .section-title--warn { color: var(--ui-danger); }

    .items-table, .shortfalls, .reservas, .trace {
      border: var(--ui-border-w-md) solid var(--ui-border);
      background: var(--ui-surface);
    }
    .items-table__head, .items-table__row, .items-table__total {
      display: grid;
      grid-template-columns: 2fr 80px 90px 90px 100px;
      gap: var(--ui-sp-2);
      padding: var(--ui-sp-2) var(--ui-sp-3);
      align-items: center;
      font-size: var(--ui-fs-sm);
    }
    .items-table__head {
      background: var(--ui-text);
      color: var(--ui-surface);
      font-size: var(--ui-fs-xs);
      font-weight: var(--ui-fw-black);
      text-transform: uppercase;
    }
    .items-table__row { border-top: var(--ui-border-w-sm) solid var(--ui-border); }
    .items-table__total {
      grid-template-columns: 1fr 100px;
      background: var(--ui-surface-2);
      border-top: var(--ui-border-w-md) solid var(--ui-border);
      font-weight: var(--ui-fw-black);
      font-size: var(--ui-fs-md);
    }
    .num { text-align: right; }
    .warn { color: var(--ui-warning); font-weight: var(--ui-fw-black); }
    .parcial {
      display: inline-block;
      font-size: 9px;
      background: var(--ui-warning);
      color: #000;
      padding: 1px 4px;
      margin-left: 4px;
      font-weight: var(--ui-fw-black);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .hint {
      padding: var(--ui-sp-2) var(--ui-sp-3);
      background: var(--ui-warning);
      color: #000;
      font-size: var(--ui-fs-xs);
      font-weight: var(--ui-fw-bold);
      border: var(--ui-border-w-md) solid var(--ui-border);
      border-bottom: none;
    }
    .shortfalls__head, .shortfalls__row {
      display: grid;
      grid-template-columns: 2fr 90px 90px 90px;
      gap: var(--ui-sp-2);
      padding: var(--ui-sp-2) var(--ui-sp-3);
      font-size: var(--ui-fs-sm);
    }
    .shortfalls__head {
      background: var(--ui-text);
      color: var(--ui-surface);
      font-size: var(--ui-fs-xs);
      font-weight: var(--ui-fw-black);
      text-transform: uppercase;
    }
    .shortfalls__row { border-top: var(--ui-border-w-sm) solid var(--ui-border); }
    .short { color: var(--ui-danger); font-weight: var(--ui-fw-black); }

    .reservas__row, .trace__row {
      display: flex;
      justify-content: space-between;
      padding: var(--ui-sp-2) var(--ui-sp-3);
      font-size: var(--ui-fs-sm);
      border-top: var(--ui-border-w-sm) solid var(--ui-border);
    }
    .reservas__row:first-child, .trace__row:first-child { border-top: none; }

    @media (max-width: 600px) {
      .items-table__head { display: none; }
      .items-table__row {
        grid-template-columns: 1fr 1fr;
        gap: 4px var(--ui-sp-2);
      }
      .items-table__row > div { font-size: var(--ui-fs-sm); }
      .num { text-align: left; }
      .shortfalls__head { display: none; }
      .shortfalls__row { grid-template-columns: 1fr 1fr; }
    }
  `],
})
export class PedidoDetailModalComponent {
  protected readonly data = inject(DataService);
  protected readonly tenant = inject(TenantContextService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly isOpen = input.required<boolean>();
  readonly order = input<CustomerOrder | null>(null);
  readonly mode = input<ActionMode>('production');
  readonly closed = output<void>();
  readonly mutated = output<void>();

  /** Preview de análisis si el pedido aún está pendiente. */
  readonly analysis = computed(() => {
    const o = this.order();
    if (!o) return null;
    if (o.status === 'pending') {
      return this.data.analyzeOrder(o.items);
    }
    return { shortfalls: o.shortfalls, itemAnalysis: [] };
  });

  statusLabel(s: OrderStatus): string {
    return {
      pending: 'Pendiente',
      in_production: 'En producción',
      completed: 'Completada',
      cancelled: 'Cancelada',
    }[s];
  }

  async onStart(o: CustomerOrder) {
    try {
      const u = this.auth.user();
      const updated = this.data.startProduction(o.id, u?.uid ?? 'unknown', u?.displayName ?? 'Usuario');
      const totalReq = updated.items.reduce((s, it) => s + it.qty, 0);
      const totalDone = updated.items.reduce((s, it) => s + it.fulfilledQty, 0);
      if (totalDone === 0) {
        await this.toast.show('No hay insumos suficientes para fabricar nada de la orden.', 'danger');
      } else if (totalDone < totalReq) {
        await this.toast.show(`Producción iniciada (parcial: ${totalDone}/${totalReq}).`, 'warning');
      } else {
        await this.toast.show('Producción iniciada — insumos descontados.');
      }
      this.mutated.emit();
    } catch (e: unknown) {
      await this.toast.show(e instanceof Error ? e.message : 'Error.', 'danger');
    }
  }

  async onComplete(o: CustomerOrder) {
    try {
      const u = this.auth.user();
      this.data.completeOrder(o.id, u?.uid ?? 'unknown', u?.displayName ?? 'Usuario');
      await this.toast.show('Orden completada — stock de producto terminado actualizado.');
      this.mutated.emit();
    } catch (e: unknown) {
      await this.toast.show(e instanceof Error ? e.message : 'Error.', 'danger');
    }
  }

  async onCancel(o: CustomerOrder) {
    const ok = confirm(`¿Cancelar orden ${o.code}? Si había insumos reservados, se devolverán al inventario.`);
    if (!ok) return;
    try {
      const u = this.auth.user();
      this.data.cancelOrder(o.id, u?.uid ?? 'unknown', u?.displayName ?? 'Usuario');
      await this.toast.show('Orden cancelada.');
      this.mutated.emit();
    } catch (e: unknown) {
      await this.toast.show(e instanceof Error ? e.message : 'Error.', 'danger');
    }
  }
}
