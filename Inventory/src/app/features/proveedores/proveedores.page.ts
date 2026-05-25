import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
  IonButton, IonIcon, IonBadge,
} from '@ionic/angular/standalone';
import { DataService } from '../../core/services/data.service';
import { ToastService } from '../../shared/components/toast/toast.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { ProveedorFormModalComponent } from './proveedor-form-modal.component';
import { Supplier } from '../../core/models';

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] as const;

/**
 * Gestión de proveedores: CRUD con datos de contacto, lead time y ventanas
 * semanales. Incluye un indicador "Hoy se puede pedir" derivado de los
 * orderDays del proveedor.
 */
@Component({
  selector: 'app-proveedores',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, RouterLink,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
    IonButton, IonIcon, IonBadge,
    PageHeaderComponent, KpiCardComponent, ProveedorFormModalComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-menu-button></ion-menu-button></ion-buttons>
        <ion-title>Proveedores</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <app-page-header
        title="Gestión de proveedores"
        subtitle="Datos de contacto, lead time y ventanas de pedido/entrega para planificar reposiciones.">
        <ion-button (click)="abrirNuevo()">+ Nuevo proveedor</ion-button>
      </app-page-header>

      <div class="kpis">
        <app-kpi-card label="Proveedores activos"
          [value]="data.activeSuppliers().length" tone="success"></app-kpi-card>
        <app-kpi-card label="Total registrados"
          [value]="data.suppliers().length" tone="primary"></app-kpi-card>
        <app-kpi-card label="Pueden recibir pedidos hoy"
          [value]="canOrderTodayCount()" tone="warning"
          [hint]="todayLabel()"></app-kpi-card>
      </div>

      @if (data.suppliers().length === 0) {
        <div class="empty">
          <h3>No hay proveedores registrados</h3>
          <p>Crea el primer proveedor para enlazar tus insumos y planificar reposiciones.</p>
          <ion-button (click)="abrirNuevo()">+ Crear proveedor</ion-button>
        </div>
      }

      <div class="cards">
        @for (s of data.suppliers(); track s.id) {
          <article class="card" [class.card--inactive]="!s.active">
            <header class="card__head">
              <div>
                <h3 class="card__name">{{ s.name }}</h3>
                @if (s.contactPerson) {
                  <div class="card__contact">{{ s.contactPerson }}</div>
                }
              </div>
              <ion-badge [color]="s.active ? 'success' : 'medium'">
                {{ s.active ? 'Activo' : 'Inactivo' }}
              </ion-badge>
            </header>

            @if (s.email || s.phone) {
              <div class="card__info">
                @if (s.email) { <span><ion-icon name="mail-open-outline"></ion-icon> {{ s.email }}</span> }
                @if (s.phone) { <span class="mono">{{ s.phone }}</span> }
              </div>
            }

            <div class="meta-row">
              <div class="meta">
                <div class="meta__label">Lead time</div>
                <div class="meta__value mono">{{ s.leadTimeDays }} día(s)</div>
              </div>
              <div class="meta">
                <div class="meta__label">Pago</div>
                <div class="meta__value">{{ s.paymentTerms || '—' }}</div>
              </div>
              <div class="meta">
                <div class="meta__label">Estado hoy</div>
                <div class="meta__value">
                  @if (data.canOrderToSupplierToday(s.id)) {
                    <span class="pill pill--ok">Hoy podés pedir</span>
                  } @else {
                    <span class="pill pill--off">No es día de pedido</span>
                  }
                </div>
              </div>
            </div>

            <div class="windows">
              <div class="window">
                <div class="window__label">Días para pedir</div>
                <div class="window__days">
                  @for (d of weekDays; track d) {
                    <span class="dot" [class.dot--on]="s.orderDays.includes(d)">{{ dayLabel(d) }}</span>
                  }
                </div>
              </div>
              <div class="window">
                <div class="window__label">Días de entrega</div>
                <div class="window__days">
                  @for (d of weekDays; track d) {
                    <span class="dot" [class.dot--on]="s.deliveryDays.includes(d)">{{ dayLabel(d) }}</span>
                  }
                </div>
              </div>
            </div>

            <div class="supplies-block">
              <div class="supplies-block__head">
                <ion-icon name="leaf-outline"></ion-icon>
                <strong>{{ s.suppliedItems.length }} item(s) registrado(s)</strong>
              </div>
              @if (s.suppliedItems.length === 0) {
                <small class="supplies-block__empty">
                  Sin insumos asignados. Edita el proveedor para vincular qué entrega.
                </small>
              } @else {
                <div class="supplies-list">
                  @for (it of s.suppliedItems; track it.kind + it.itemId) {
                    <span class="supply-tag" [attr.data-kind]="it.kind">
                      {{ itemName(it.kind, it.itemId) }}
                    </span>
                  }
                </div>
              }
            </div>

            @if (s.notes) {
              <p class="card__notes">{{ s.notes }}</p>
            }

            <footer class="card__foot">
              <span class="card__since">Desde {{ s.createdAt | date:'dd-MM-yyyy' }}</span>
              <div class="card__actions">
                <ion-button size="small" fill="outline" routerLink="/ingresos"
                  [queryParams]="{ supplier: s.id }">
                  <ion-icon name="arrow-down-circle-outline" slot="start"></ion-icon>
                  Registrar ingreso
                </ion-button>
                <ion-button size="small" fill="clear" (click)="abrirEditar(s)">
                  <ion-icon name="create-outline" slot="start"></ion-icon>
                  Editar
                </ion-button>
                <ion-button size="small" color="danger" fill="clear" (click)="eliminar(s)">
                  <ion-icon name="trash-outline" slot="start"></ion-icon>
                  Eliminar
                </ion-button>
              </div>
            </footer>
          </article>
        }
      </div>

      <app-proveedor-form-modal
        [isOpen]="modalOpen()"
        [editing]="editing()"
        (closed)="cerrarModal()"
        (saved)="cerrarModal()">
      </app-proveedor-form-modal>
    </ion-content>
  `,
  styles: [`
    .kpis {
      display: grid; grid-template-columns: repeat(3, 1fr);
      gap: var(--ui-sp-3); padding: 0 var(--ui-sp-4) var(--ui-sp-4);
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
      display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
      gap: var(--ui-sp-3); padding: 0 var(--ui-sp-4) var(--ui-sp-8);
    }
    .card {
      background: var(--ui-surface);
      border: var(--ui-border-w-md) solid var(--ui-border);
      box-shadow: var(--ui-shadow-md);
      padding: var(--ui-sp-3);
      display: flex; flex-direction: column; gap: var(--ui-sp-3);
    }
    .card--inactive { opacity: 0.5; }
    .card__head {
      display: flex; justify-content: space-between;
      align-items: flex-start; gap: var(--ui-sp-2);
    }
    .card__name { margin: 0; font-size: var(--ui-fs-lg); font-weight: var(--ui-fw-black); }
    .card__contact { font-size: var(--ui-fs-sm); color: var(--ui-text-muted); margin-top: 2px; }
    .card__info {
      display: flex; gap: var(--ui-sp-3); font-size: var(--ui-fs-xs);
      color: var(--ui-text-muted); flex-wrap: wrap;
    }
    .card__info ion-icon { vertical-align: middle; font-size: 14px; }

    .meta-row {
      display: grid; grid-template-columns: repeat(3, 1fr);
      gap: var(--ui-sp-2);
    }
    @media (max-width: 600px) { .meta-row { grid-template-columns: 1fr 1fr; } }
    .meta {
      padding: 6px 8px;
      background: var(--ui-surface-2);
      display: flex; flex-direction: column; gap: 2px;
    }
    .meta__label {
      font-size: 10px; text-transform: uppercase;
      letter-spacing: 0.5px; color: var(--ui-text-muted);
      font-weight: var(--ui-fw-black);
    }
    .meta__value { font-size: var(--ui-fs-sm); font-weight: var(--ui-fw-bold); }

    .pill {
      display: inline-block; padding: 2px 6px;
      font-size: 10px; font-weight: var(--ui-fw-black);
      text-transform: uppercase; letter-spacing: 0.5px;
    }
    .pill--ok { background: var(--ui-success); color: #fff; }
    .pill--off { background: var(--ui-surface-3); color: var(--ui-text-muted); }

    .windows {
      display: grid; grid-template-columns: 1fr 1fr;
      gap: var(--ui-sp-2);
    }
    .window__label {
      font-size: var(--ui-fs-xs); font-weight: var(--ui-fw-black);
      text-transform: uppercase; color: var(--ui-text-muted);
      letter-spacing: 0.5px; margin-bottom: 4px;
    }
    .window__days { display: flex; gap: 2px; flex-wrap: wrap; }
    .dot {
      flex: 1; min-width: 28px; text-align: center;
      padding: 4px 0; font-size: 10px; font-weight: var(--ui-fw-bold);
      background: var(--ui-surface-2); color: var(--ui-text-muted);
      border: var(--ui-border-w-sm) solid var(--ui-border);
    }
    .dot--on {
      background: var(--ui-success); color: #fff;
      border-color: var(--ui-success);
    }

    .card__notes {
      margin: 0; padding: 8px;
      background: var(--ui-surface-2);
      font-size: var(--ui-fs-xs);
      color: var(--ui-text);
      font-style: italic;
    }

    .supplies-block { display: flex; flex-direction: column; gap: 6px; }
    .supplies-block__head {
      display: flex; align-items: center; gap: 6px;
      font-size: var(--ui-fs-xs);
      color: var(--ui-text);
    }
    .supplies-block__head ion-icon { font-size: 14px; color: var(--ui-primary); }
    .supplies-block__empty {
      font-size: var(--ui-fs-xs);
      color: var(--ui-text-muted);
      font-style: italic;
    }
    .supplies-list { display: flex; flex-wrap: wrap; gap: 4px; }
    .supply-tag {
      padding: 3px 8px;
      font-size: 10px;
      font-weight: var(--ui-fw-bold);
      background: var(--ui-surface-2);
      border: var(--ui-border-w-sm) solid var(--ui-border);
      color: var(--ui-text);
    }
    .supply-tag[data-kind="product"] {
      background: var(--ui-warning);
      color: #000;
      border-color: var(--ui-text);
    }
    .card__foot {
      display: flex; justify-content: space-between;
      align-items: center; flex-wrap: wrap; gap: 6px;
      padding-top: var(--ui-sp-2);
      border-top: var(--ui-border-w-sm) solid var(--ui-border);
    }
    .card__since { font-size: var(--ui-fs-xs); color: var(--ui-text-muted); }
    .card__actions { display: flex; gap: 4px; flex-wrap: wrap; }
  `],
})
export class ProveedoresPage {
  protected readonly data = inject(DataService);
  private readonly toast = inject(ToastService);

  readonly modalOpen = signal(false);
  readonly editing = signal<Supplier | null>(null);

  protected readonly weekDays = [1, 2, 3, 4, 5, 6, 0];

  readonly canOrderTodayCount = computed(() =>
    this.data.activeSuppliers().filter(s => this.data.canOrderToSupplierToday(s.id)).length
  );

  readonly todayLabel = computed(() => `Hoy: ${DAY_LABELS[new Date().getDay()]}`);

  dayLabel(d: number): string { return DAY_LABELS[d]; }

  itemName(kind: 'supply' | 'product', itemId: string): string {
    if (kind === 'supply') return this.data.supplyById(itemId)?.name ?? '—';
    return this.data.productById(itemId)?.name ?? '—';
  }

  abrirNuevo() { this.editing.set(null); this.modalOpen.set(true); }
  abrirEditar(s: Supplier) { this.editing.set(s); this.modalOpen.set(true); }
  cerrarModal() { this.modalOpen.set(false); this.editing.set(null); }

  async eliminar(s: Supplier) {
    if (!confirm(`¿Eliminar el proveedor "${s.name}"?`)) return;
    this.data.deleteSupplier(s.id);
    await this.toast.show(`Proveedor "${s.name}" eliminado.`);
  }
}
