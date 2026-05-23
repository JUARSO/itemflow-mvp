import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
  IonButton, IonSearchbar, IonSegment, IonSegmentButton, IonLabel,
} from '@ionic/angular/standalone';
import { DataService } from '../../core/services/data.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { AjusteFormModalComponent } from './ajuste-form-modal.component';

type FilterKind = 'todos' | 'entrada' | 'salida' | 'ajuste';

/**
 * Etiquetas legibles para reason codes. Si el reason no está aquí se muestra crudo.
 */
const REASON_LABELS: Record<string, string> = {
  return_from_customer: 'Devolución de cliente',
  donation: 'Donación recibida',
  manual: 'Manual / inicial',
  damaged: 'Producto dañado',
  expired: 'Vencido',
  lost: 'Pérdida',
  count_correction: 'Corrección de conteo',
};

@Component({
  selector: 'app-ajustes',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, DecimalPipe,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
    IonButton, IonSearchbar, IonSegment, IonSegmentButton, IonLabel,
    PageHeaderComponent, EmptyStateComponent, KpiCardComponent,
    AjusteFormModalComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-menu-button></ion-menu-button></ion-buttons>
        <ion-title>Ajustes</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <app-page-header
        title="Ajustes"
        subtitle="Movimientos manuales fuera del flujo de venta y compra: devoluciones, mermas, donaciones y correcciones de conteo.">
        <ion-button (click)="modalOpen.set(true)">+ Nuevo movimiento</ion-button>
      </app-page-header>

      <div class="kpis">
        <app-kpi-card label="Entradas (30d)" [value]="kpiEntradas()" tone="success" hint="Devoluciones, donaciones, carga manual"></app-kpi-card>
        <app-kpi-card label="Salidas / mermas (30d)" [value]="kpiSalidas()" tone="danger" hint="Dañado, vencido, perdido"></app-kpi-card>
        <app-kpi-card label="Ajustes de conteo (30d)" [value]="kpiAjustes()" tone="warning" hint="Diferencias por conteo físico"></app-kpi-card>
      </div>

      <div class="filters">
        <ion-searchbar
          [value]="query()"
          (ionInput)="query.set($any($event.detail.value) ?? '')"
          placeholder="Buscar por item o usuario"
          mode="md">
        </ion-searchbar>

        <ion-segment
          [value]="kindFilter()"
          (ionChange)="kindFilter.set($any($event.detail.value))"
          scrollable>
          <ion-segment-button value="todos"><ion-label>Todos</ion-label></ion-segment-button>
          <ion-segment-button value="entrada"><ion-label>Entradas</ion-label></ion-segment-button>
          <ion-segment-button value="salida"><ion-label>Salidas</ion-label></ion-segment-button>
          <ion-segment-button value="ajuste"><ion-label>Ajustes</ion-label></ion-segment-button>
        </ion-segment>
      </div>

      @if (visibles().length === 0) {
        <app-empty-state
          icon="⚙️"
          title="Sin movimientos manuales"
          body="Registra entradas no-compra (devoluciones, donaciones), salidas no-venta (mermas) o ajustes de conteo físico."
          ctaLabel="Registrar primer movimiento"
          (ctaClick)="modalOpen.set(true)">
        </app-empty-state>
      } @else {
        <div class="table">
          <div class="table__head">
            <div>Fecha</div>
            <div>Item</div>
            <div>Tipo</div>
            <div class="num">Cantidad</div>
            <div class="num">Saldo</div>
            <div>Motivo</div>
            <div>Usuario</div>
          </div>
          @for (e of visibles(); track e.id) {
            <div class="table__row" [attr.data-type]="e.type">
              <div class="mono">{{ e.at | date:'dd-MM HH:mm' }}</div>
              <div class="cell__name">{{ e.itemName }}</div>
              <div class="badge">
                <span class="badge__icon">{{ iconFor(e.type) }}</span>
                <span>{{ typeLabel(e.type) }}</span>
              </div>
              <div class="num mono">{{ signFor(e.type) }}{{ e.qty | number:'1.0-3' }}</div>
              <div class="num mono">{{ e.balance | number:'1.0-3' }}</div>
              <div class="cell__reason">
                {{ reasonLabel(e.reason) }}
                @if (e.note) {
                  <div class="cell__note">{{ e.note }}</div>
                }
              </div>
              <div class="cell__user">{{ e.userName }}</div>
            </div>
          }
        </div>
      }

      <app-ajuste-form-modal
        [isOpen]="modalOpen()"
        (closed)="modalOpen.set(false)"
        (saved)="modalOpen.set(false)">
      </app-ajuste-form-modal>
    </ion-content>
  `,
  styles: [`
    .kpis {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--ui-sp-3);
      padding: 0 var(--ui-sp-4) var(--ui-sp-4);
    }
    @media (max-width: 900px) { .kpis { grid-template-columns: 1fr; } }

    .filters {
      padding: 0 var(--ui-sp-4) var(--ui-sp-4);
      display: flex;
      flex-direction: column;
      gap: var(--ui-sp-3);
    }
    ion-searchbar { --background: var(--ui-surface); padding: 0; }

    .table {
      margin: 0 var(--ui-sp-4) var(--ui-sp-8);
      border: var(--ui-border-w-sm) solid var(--ui-border);
      box-shadow: var(--ui-shadow-md);
      background: var(--ui-surface);
      border-radius: var(--ui-radius);
      overflow: hidden;
    }
    .table__head, .table__row {
      display: grid;
      grid-template-columns: 110px 1.5fr 130px 100px 100px 1.4fr 1fr;
      gap: var(--ui-sp-3);
      padding: var(--ui-sp-3) var(--ui-sp-4);
      align-items: center;
    }
    .table__head {
      background: var(--ui-text-strong);
      color: #fff;
      font-size: var(--ui-fs-xs);
      font-weight: var(--ui-fw-bold);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .table__row {
      border-top: var(--ui-border-w-sm) solid var(--ui-border);
      font-size: var(--ui-fs-sm);
    }
    .table__row:hover { background: var(--ui-surface-3); }
    .num { text-align: right; }
    .cell__name { font-weight: var(--ui-fw-semibold); color: var(--ui-text-strong); }
    .cell__reason { color: var(--ui-text); }
    .cell__note {
      font-size: var(--ui-fs-xs);
      color: var(--ui-text-muted);
      margin-top: 2px;
      font-style: italic;
    }
    .cell__user { color: var(--ui-text-muted); font-size: var(--ui-fs-xs); }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: var(--ui-radius-pill);
      font-size: var(--ui-fs-xs);
      font-weight: var(--ui-fw-medium);
    }
    .table__row[data-type="in"] .badge {
      background: var(--ui-success-tint);
      color: var(--ui-success);
    }
    .table__row[data-type="out"] .badge {
      background: var(--ui-danger-tint);
      color: var(--ui-danger);
    }
    .table__row[data-type="adjustment"] .badge {
      background: var(--ui-warning-tint);
      color: var(--ui-warning);
    }

    @media (max-width: 900px) {
      .table__head { display: none; }
      .table__row {
        grid-template-columns: 1fr 1fr;
        gap: var(--ui-sp-2);
      }
      .cell__name { grid-column: 1 / -1; }
    }
  `],
})
export class AjustesPage {
  protected readonly data = inject(DataService);

  readonly modalOpen = signal(false);
  readonly query = signal('');
  readonly kindFilter = signal<FilterKind>('todos');

  /**
   * Movimientos del kardex que NO son sale ni purchase recibida vía OC.
   * Es decir: entradas manuales (donation, return, manual), mermas y ajustes.
   */
  readonly visibles = computed(() => {
    const q = this.query().toLowerCase();
    const f = this.kindFilter();
    return this.data.recentKardex(500)
      .filter(e => {
        // Excluir ventas (out con reason 'sale') y compras vía OC (in con reason 'purchase')
        if (e.reason === 'sale') return false;
        if (e.reason === 'purchase') return false;
        return true;
      })
      .filter(e => {
        if (f === 'todos') return true;
        if (f === 'entrada') return e.type === 'in';
        if (f === 'salida') return e.type === 'out';
        if (f === 'ajuste') return e.type === 'adjustment';
        return true;
      })
      .filter(e => !q ||
        e.itemName.toLowerCase().includes(q) ||
        e.userName.toLowerCase().includes(q));
  });

  readonly kpiEntradas = computed(() => this.countLast30(e => e.type === 'in' && e.reason !== 'purchase'));
  readonly kpiSalidas = computed(() => this.countLast30(e => e.type === 'out' && e.reason !== 'sale'));
  readonly kpiAjustes = computed(() => this.countLast30(e => e.type === 'adjustment'));

  private countLast30(predicate: (e: { type: string; reason: string; at: Date }) => boolean): number {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return this.data.kardex().filter(e => e.at.getTime() >= cutoff && predicate(e)).length;
  }

  typeLabel(t: string): string {
    return t === 'in' ? 'Entrada' : t === 'out' ? 'Salida' : 'Ajuste';
  }
  iconFor(t: string): string {
    return t === 'in' ? '↑' : t === 'out' ? '↓' : '⚙';
  }
  signFor(t: string): string {
    return t === 'in' ? '+' : t === 'out' ? '-' : '±';
  }
  reasonLabel(r: string): string {
    return REASON_LABELS[r] ?? r;
  }
}
