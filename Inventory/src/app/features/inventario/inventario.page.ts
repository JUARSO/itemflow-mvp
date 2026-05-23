import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
  IonSearchbar, IonSegment, IonSegmentButton, IonLabel, IonButton,
} from '@ionic/angular/standalone';
import { DataService } from '../../core/services/data.service';
import { TenantContextService } from '../../core/services/tenant-context.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { EntradaFormModalComponent } from './entrada-form-modal.component';
import { StockStatus } from '../../core/models';

type StatusFilter = 'todos' | StockStatus;

@Component({
  selector: 'app-inventario',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe, RouterLink,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
    IonSearchbar, IonSegment, IonSegmentButton, IonLabel, IonButton,
    PageHeaderComponent, KpiCardComponent, StatusBadgeComponent,
    EntradaFormModalComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-menu-button></ion-menu-button></ion-buttons>
        <ion-title>Inventario</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <app-page-header
        title="Inventario"
        subtitle="Stock actual, alertas y acciones recomendadas">
        <ion-button (click)="entradaModalOpen.set(true)">+ Registrar entrada</ion-button>
      </app-page-header>

      <div class="kpis">
        <app-kpi-card
          label="Total Productos"
          [value]="data.totalProducts()"
          tone="primary"
          hint="SKUs activos en catálogo">
        </app-kpi-card>
        <app-kpi-card
          label="Requieren Compra"
          [value]="data.itemsNeedingPurchase()"
          tone="warning"
          hint="Bajo o crítico">
        </app-kpi-card>
        <app-kpi-card
          label="Unidades a Comprar"
          [value]="(data.unitsToBuy() | number:'1.0-0') ?? '0'"
          tone="danger"
          hint="Hasta cubrir máximo">
        </app-kpi-card>
        <app-kpi-card
          label="En Tránsito"
          [value]="data.inTransitOrders() + ' OCs'"
          tone="transit"
          [hint]="data.inTransitUnits() + ' unidades'">
        </app-kpi-card>
      </div>

      <div class="filters">
        <ion-searchbar
          [value]="query()"
          (ionInput)="query.set($any($event.detail.value) ?? '')"
          placeholder="Buscar por nombre o SKU"
          mode="md">
        </ion-searchbar>

        <div class="filters__row">
          <ion-segment
            [value]="statusFilter()"
            (ionChange)="statusFilter.set($any($event.detail.value))"
            scrollable>
            <ion-segment-button value="todos"><ion-label>Todos</ion-label></ion-segment-button>
            <ion-segment-button value="critical"><ion-label>Críticos</ion-label></ion-segment-button>
            <ion-segment-button value="low"><ion-label>Bajos</ion-label></ion-segment-button>
            <ion-segment-button value="out"><ion-label>Agotados</ion-label></ion-segment-button>
            <ion-segment-button value="available"><ion-label>Disponibles</ion-label></ion-segment-button>
          </ion-segment>
        </div>
      </div>

      <section class="block">
        <h2 class="block__title">Insumos ({{ filteredSupplies().length }})</h2>
        <div class="table">
          <div class="table__head">
            <div>Insumo</div>
            <div class="num">Stock</div>
            <div class="num">P. Reorden</div>
            <div>Estado</div>
          </div>
          @if (filteredSupplies().length === 0) {
            <div class="table__empty">Sin resultados con los filtros actuales.</div>
          }
          @for (row of filteredSupplies(); track row.id) {
            <div class="table__row">
              <div class="cell--main">
                <div class="cell__name">{{ row.name }}</div>
                <div class="cell__sub mono">{{ row.sku }}</div>
              </div>
              <div class="num mono">{{ row.quantity | number:'1.0-3' }} {{ row.unit }}</div>
              <div class="num mono">{{ row.reorderPoint | number:'1.0-3' }} {{ row.unit }}</div>
              <div><app-status-badge [status]="row.status"></app-status-badge></div>
            </div>
          }
        </div>
      </section>

      <section class="block">
        <h2 class="block__title">Productos sin receta ({{ filteredProducts().length }})</h2>
        <div class="table table--products">
          <div class="table__head">
            <div>Producto</div>
            <div class="num">Stock</div>
            <div class="num">P. Reorden</div>
            <div>Estado</div>
          </div>
          @if (filteredProducts().length === 0) {
            <div class="table__empty">Sin productos sin receta. Los productos con receta consumen insumos al venderse.</div>
          }
          @for (row of filteredProducts(); track row.id) {
            <div class="table__row">
              <div class="cell--main">
                <div class="cell__name">{{ row.name }}</div>
                <div class="cell__sub mono">{{ row.sku }}</div>
              </div>
              <div class="num mono">{{ row.quantity | number:'1.0-0' }} {{ row.unit }}</div>
              <div class="num mono">
                @if (row.reorderPoint != null) {
                  {{ row.reorderPoint | number:'1.0-0' }} {{ row.unit }}
                } @else {
                  <span class="muted">—</span>
                }
              </div>
              <div><app-status-badge [status]="row.status"></app-status-badge></div>
            </div>
          }
        </div>
      </section>

      <div class="cta-block">
        <a routerLink="/alertas" class="cta-block__link">
          Ver todas las alertas activas →
        </a>
      </div>

      <app-entrada-form-modal
        [isOpen]="entradaModalOpen()"
        (closed)="entradaModalOpen.set(false)"
        (saved)="entradaModalOpen.set(false)">
      </app-entrada-form-modal>
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

    .filters {
      padding: 0 var(--ui-sp-4);
      margin-bottom: var(--ui-sp-4);
    }
    .filters__row {
      display: flex;
      gap: var(--ui-sp-3);
      align-items: center;
      margin-top: var(--ui-sp-3);
      flex-wrap: wrap;
    }
    .filters__row ion-segment { flex: 1; min-width: 260px; }
    ion-searchbar {
      --background: var(--ui-surface);
      padding: 0;
    }

    .block {
      margin: 0 var(--ui-sp-4) var(--ui-sp-6);
    }
    .block__title {
      font-family: var(--ui-font-display);
      font-weight: var(--ui-fw-black);
      font-size: var(--ui-fs-lg);
      margin: var(--ui-sp-4) 0 var(--ui-sp-3);
    }

    .table {
      border: var(--ui-border-w-md) solid var(--ui-border);
      box-shadow: var(--ui-shadow-md);
      background: var(--ui-surface);
    }
    .table__head, .table__row {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr 130px;
      gap: var(--ui-sp-3);
      padding: var(--ui-sp-3) var(--ui-sp-4);
      align-items: center;
    }
    .table--products .table__head,
    .table--products .table__row {
      grid-template-columns: 2fr 1fr 1fr 130px;
    }
    .table__head {
      background: var(--ui-text);
      color: var(--ui-surface);
      font-size: var(--ui-fs-xs);
      font-weight: var(--ui-fw-black);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .table__row {
      border-top: var(--ui-border-w-sm) solid var(--ui-border);
    }
    .table__row:hover { background: var(--ui-surface-3); }
    .table__empty {
      padding: var(--ui-sp-6);
      text-align: center;
      color: var(--ui-text-muted);
      border-top: var(--ui-border-w-sm) solid var(--ui-border);
    }
    .cell--main { min-width: 0; }
    .cell__name { font-weight: var(--ui-fw-bold); color: var(--ui-text); }
    .cell__sub { font-size: var(--ui-fs-xs); color: var(--ui-text-muted); }
    .num { text-align: right; }

    @media (max-width: 768px) {
      .table__head { display: none; }
      .table__row {
        grid-template-columns: 1fr 1fr;
        gap: var(--ui-sp-2);
      }
      .cell--main { grid-column: 1 / -1; }
      .num { text-align: left; }
    }

    .cta-block {
      padding: var(--ui-sp-4);
      text-align: center;
    }
    .cta-block__link {
      color: var(--ui-primary);
      font-weight: var(--ui-fw-bold);
      text-decoration: none;
      border-bottom: 2px solid var(--ui-primary);
      padding-bottom: 2px;
    }
  `],
})
export class InventarioPage {
  protected readonly data = inject(DataService);
  protected readonly tenant = inject(TenantContextService);

  readonly query = signal('');
  readonly statusFilter = signal<StatusFilter>('todos');
  readonly entradaModalOpen = signal(false);

  readonly filteredSupplies = computed(() => {
    const q = this.query().toLowerCase();
    const status = this.statusFilter();
    const supplies = this.data.supplies();
    return this.data.supplyStock()
      .filter(stock => status === 'todos' || stock.status === status)
      .map(stock => {
        const sup = supplies.find(s => s.id === stock.supplyId);
        return {
          id: stock.id,
          name: sup?.name ?? '—',
          sku: sup?.sku ?? '',
          unit: sup?.unit ?? '',
          reorderPoint: sup?.reorderPoint ?? 0,
          quantity: stock.quantity,
          status: stock.status,
        };
      })
      .filter(row =>
        !q || row.name.toLowerCase().includes(q) || row.sku.toLowerCase().includes(q)
      )
      .sort((a, b) => statusWeight(a.status) - statusWeight(b.status));
  });

  readonly filteredProducts = computed(() => {
    const q = this.query().toLowerCase();
    const status = this.statusFilter();
    const products = this.data.products();
    return this.data.productStock()
      .filter(stock => status === 'todos' || stock.status === status)
      .map(stock => {
        const p = products.find(x => x.id === stock.productId);
        return {
          id: stock.id,
          name: p?.name ?? '—',
          sku: p?.sku ?? '',
          unit: p?.unit ?? '',
          reorderPoint: p?.reorderPoint,
          quantity: stock.quantity,
          status: stock.status,
        };
      })
      .filter(row =>
        !q || row.name.toLowerCase().includes(q) || row.sku.toLowerCase().includes(q)
      )
      .sort((a, b) => statusWeight(a.status) - statusWeight(b.status));
  });
}

function statusWeight(s: StockStatus): number {
  return s === 'out' ? 0 : s === 'critical' ? 1 : s === 'low' ? 2 : 3;
}
