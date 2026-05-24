import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
  IonButton, IonSegment, IonSegmentButton, IonLabel, IonBadge,
} from '@ionic/angular/standalone';
import { DataService } from '../../core/services/data.service';
import { TenantContextService } from '../../core/services/tenant-context.service';
import { AuthService } from '../../core/services/auth.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { ToastService } from '../../shared/components/toast/toast.service';
import { OcFormModalComponent } from './oc-form-modal.component';
import { PurchaseOrder, POStatus } from '../../core/models';

type Filter = 'todas' | POStatus;
type ConfirmAction = 'receive' | 'cancel' | 'delete';

@Component({
  selector: 'app-ordenes-compra',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, DecimalPipe,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
    IonButton, IonSegment, IonSegmentButton, IonLabel, IonBadge,
    PageHeaderComponent, KpiCardComponent, ConfirmDialogComponent, OcFormModalComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-menu-button></ion-menu-button></ion-buttons>
        <ion-title>Órdenes de Compra</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <app-page-header
        title="Órdenes de Compra"
        subtitle="Cuando una OC se recibe, genera entradas de kardex automáticamente.">
        @if (tenant.canManagePurchaseOrders()) {
          <ion-button (click)="modalOpen.set(true)">+ Nueva OC</ion-button>
        }
      </app-page-header>

      <div class="kpis">
        <app-kpi-card label="Pendientes" [value]="data.inTransitOrders()" tone="transit"
          [hint]="data.inTransitUnits() + ' unidades en tránsito'"></app-kpi-card>
        <app-kpi-card label="Recibidas" [value]="recibidas().length" tone="success"></app-kpi-card>
        <app-kpi-card label="Canceladas" [value]="canceladas().length" tone="danger"></app-kpi-card>
        <app-kpi-card label="Total OCs" [value]="data.purchaseOrders().length" tone="primary"></app-kpi-card>
      </div>

      <div class="tabs">
        <ion-segment [value]="filter()" (ionChange)="filter.set($any($event.detail.value))">
          <ion-segment-button value="todas"><ion-label>Todas</ion-label></ion-segment-button>
          <ion-segment-button value="pending"><ion-label>Pendientes</ion-label></ion-segment-button>
          <ion-segment-button value="received"><ion-label>Recibidas</ion-label></ion-segment-button>
          <ion-segment-button value="cancelled"><ion-label>Canceladas</ion-label></ion-segment-button>
        </ion-segment>
      </div>

      <div class="list">
        @for (po of visibles(); track po.id) {
          <article class="po">
            <header class="po__head" [attr.data-status]="po.status">
              <div>
                <div class="po__code mono">{{ po.code }}</div>
                <h3 class="po__supplier">{{ po.supplier }}</h3>
                <div class="po__meta">
                  Creada {{ po.createdAt | date:'dd-MM-yyyy' }}
                </div>
              </div>
              <div class="po__status">
                @switch (po.status) {
                  @case ('pending')   { <ion-badge color="transit">Pendiente</ion-badge> }
                  @case ('received')  { <ion-badge color="success">Recibida</ion-badge> }
                  @case ('cancelled') { <ion-badge color="danger">Cancelada</ion-badge> }
                }
              </div>
            </header>
            <div class="po__items">
              @for (it of po.items; track it.supplyId) {
                <div class="po-item">
                  <span class="po-item__name">
                    {{ it.itemName }}
                    @if (it.productId) {
                      <span class="po-item__kind">producto</span>
                    }
                  </span>
                  <span class="po-item__qty mono">{{ it.qty }} × ₡{{ it.unitCost | number:'1.0-0' }}</span>
                  <span class="po-item__total mono">₡{{ it.qty * it.unitCost | number:'1.0-0' }}</span>
                </div>
              }
            </div>
            <footer class="po__footer">
              <div class="po__total">
                <span class="muted">Total OC</span>
                <span class="mono"><strong>₡{{ po.totalCost | number:'1.0-0' }}</strong></span>
              </div>
              @if (po.status === 'pending' && po.expectedDate) {
                <div class="po__expected">
                  Esperada: <strong class="mono">{{ po.expectedDate | date:'dd-MM-yyyy' }}</strong>
                  @if (isOverdue(po.expectedDate)) {
                    <ion-badge color="danger">Atrasada</ion-badge>
                  }
                </div>
              }
              @if (tenant.canManagePurchaseOrders()) {
                <div class="po__actions">
                  @if (po.status === 'pending') {
                    <ion-button size="small" (click)="pedirAccion(po, 'receive')">Marcar recibida</ion-button>
                    <ion-button size="small" fill="clear" class="ghost" (click)="pedirAccion(po, 'cancel')">Cancelar</ion-button>
                  }
                  <ion-button size="small" color="danger" (click)="pedirAccion(po, 'delete')">Eliminar</ion-button>
                </div>
              }
            </footer>
          </article>
        }
      </div>

      <app-oc-form-modal
        [isOpen]="modalOpen()"
        (closed)="modalOpen.set(false)"
        (saved)="modalOpen.set(false)">
      </app-oc-form-modal>

      <app-confirm-dialog
        [isOpen]="confirmOpen()"
        [title]="confirmTitle()"
        [message]="confirmMessage()"
        [tone]="confirmTone()"
        [confirmLabel]="confirmCta()"
        (confirmed)="ejecutarAccion()"
        (cancelled)="confirmOpen.set(false)">
      </app-confirm-dialog>
    </ion-content>
  `,
  styles: [`
    .kpis {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: var(--ui-sp-3);
      padding: 0 var(--ui-sp-4) var(--ui-sp-4);
    }
    @media (max-width: 1100px) { .kpis { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 480px)  { .kpis { grid-template-columns: 1fr; } }

    .tabs { padding: 0 var(--ui-sp-4) var(--ui-sp-3); }

    .list {
      padding: 0 var(--ui-sp-4) var(--ui-sp-8);
      display: grid;
      gap: var(--ui-sp-3);
    }
    .po {
      background: var(--ui-surface);
      border: var(--ui-border-w-md) solid var(--ui-border);
      box-shadow: var(--ui-shadow-md);
    }
    .po__head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: var(--ui-sp-4);
      border-bottom: var(--ui-border-w-sm) solid var(--ui-border);
      gap: var(--ui-sp-3);
    }
    .po__head[data-status="pending"]   { background: var(--ui-transit-tint); }
    .po__head[data-status="received"]  { background: var(--ui-success-tint); }
    .po__head[data-status="cancelled"] { background: var(--ui-danger-tint); }
    .po__code { font-size: var(--ui-fs-xs); font-weight: var(--ui-fw-bold); color: var(--ui-text-muted); }
    .po__supplier {
      font-family: var(--ui-font-display);
      font-weight: var(--ui-fw-black);
      font-size: var(--ui-fs-lg);
      margin: 4px 0;
    }
    .po__meta { font-size: var(--ui-fs-sm); color: var(--ui-text-muted); }

    .po__items { padding: 0 var(--ui-sp-4); }
    .po-item {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr;
      gap: var(--ui-sp-3);
      padding: var(--ui-sp-3) 0;
      border-bottom: 1px dashed var(--ui-border);
      font-size: var(--ui-fs-sm);
      align-items: center;
    }
    .po-item:last-child { border-bottom: none; }
    .po-item__qty { color: var(--ui-text-muted); text-align: right; }
    .po-item__kind {
      display: inline-block;
      margin-left: var(--ui-sp-2);
      padding: 1px 6px;
      font-size: var(--ui-fs-xs);
      font-weight: var(--ui-fw-medium);
      color: var(--ui-secondary);
      background: var(--ui-excess-tint);
      border-radius: var(--ui-radius-pill);
    }
    .po-item__total { text-align: right; font-weight: var(--ui-fw-bold); }

    .po__footer {
      padding: var(--ui-sp-3) var(--ui-sp-4);
      border-top: var(--ui-border-w-sm) solid var(--ui-border);
      background: var(--ui-surface-2);
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--ui-sp-3);
      flex-wrap: wrap;
    }
    .po__total { display: flex; gap: var(--ui-sp-2); align-items: center; font-size: var(--ui-fs-md); }
    .po__expected { font-size: var(--ui-fs-sm); display: flex; gap: 6px; align-items: center; }
    .po__actions { display: flex; gap: var(--ui-sp-2); flex-wrap: wrap; }
    .muted { color: var(--ui-text-muted); }

    @media (max-width: 768px) {
      .po-item { grid-template-columns: 1fr 1fr; gap: 4px var(--ui-sp-2); padding: var(--ui-sp-2) 0; }
      .po-item__name { grid-column: 1 / -1; }
      .po-item__qty { text-align: left; }
      .po__actions ion-button { flex: 1 1 auto; min-width: 110px; }
    }
  `],
})
export class OrdenesCompraPage {
  protected readonly data = inject(DataService);
  protected readonly tenant = inject(TenantContextService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly filter = signal<Filter>('todas');
  readonly modalOpen = signal(false);
  readonly confirmOpen = signal(false);
  readonly poAccion = signal<PurchaseOrder | null>(null);
  readonly accion = signal<ConfirmAction>('receive');

  readonly visibles = computed(() => {
    const f = this.filter();
    const all = [...this.data.purchaseOrders()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return f === 'todas' ? all : all.filter(po => po.status === f);
  });

  readonly recibidas = computed(() => this.data.purchaseOrders().filter(po => po.status === 'received'));
  readonly canceladas = computed(() => this.data.purchaseOrders().filter(po => po.status === 'cancelled'));

  readonly confirmTitle = computed(() => {
    switch (this.accion()) {
      case 'receive': return 'Marcar OC como recibida';
      case 'cancel': return 'Cancelar orden de compra';
      case 'delete': return 'Eliminar OC';
    }
  });

  readonly confirmMessage = computed(() => {
    const po = this.poAccion();
    if (!po) return '';
    switch (this.accion()) {
      case 'receive': return `Confirmar recepción de ${po.code}. Se generarán entradas de kardex automáticamente para cada insumo de la OC.`;
      case 'cancel': return `La OC ${po.code} pasará a estado "Cancelada" y no se generará stock. Esta acción es reversible solo recreando la OC.`;
      case 'delete': return `Eliminar permanentemente la OC ${po.code}. Las entradas de kardex ya generadas (si la OC fue recibida) se mantienen.`;
    }
  });

  readonly confirmTone = computed<'danger' | 'warning' | 'info'>(() =>
    this.accion() === 'receive' ? 'info' : 'danger'
  );

  readonly confirmCta = computed(() => {
    switch (this.accion()) {
      case 'receive': return 'Sí, marcar recibida';
      case 'cancel': return 'Sí, cancelar';
      case 'delete': return 'Sí, eliminar';
    }
  });

  isOverdue(d: Date): boolean { return d.getTime() < Date.now(); }

  pedirAccion(po: PurchaseOrder, accion: ConfirmAction) {
    this.poAccion.set(po);
    this.accion.set(accion);
    this.confirmOpen.set(true);
  }

  async ejecutarAccion() {
    const po = this.poAccion();
    if (!po) return;
    const user = this.auth.user();
    const userName = user?.displayName ?? 'Usuario';
    const userId = user?.uid ?? 'unknown';

    switch (this.accion()) {
      case 'receive':
        this.data.updatePurchaseOrderStatus(po.id, 'received', userName, userId);
        await this.toast.show(`OC ${po.code} marcada como recibida. Kardex actualizado.`);
        break;
      case 'cancel':
        this.data.updatePurchaseOrderStatus(po.id, 'cancelled', userName, userId);
        await this.toast.show(`OC ${po.code} cancelada.`, 'warning');
        break;
      case 'delete':
        this.data.deletePurchaseOrder(po.id);
        await this.toast.show(`OC ${po.code} eliminada.`, 'success');
        break;
    }
    this.confirmOpen.set(false);
    this.poAccion.set(null);
  }
}
