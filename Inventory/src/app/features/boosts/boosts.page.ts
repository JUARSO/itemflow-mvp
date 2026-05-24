import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
  IonButton, IonSearchbar, IonSegment, IonSegmentButton, IonLabel,
} from '@ionic/angular/standalone';
import { DataService } from '../../core/services/data.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { ToastService } from '../../shared/components/toast/toast.service';
import { BoostFormModalComponent } from './boost-form-modal.component';
import { DemandBoost } from '../../core/models';

type FilterStatus = 'todos' | 'activos' | 'expirados' | 'cancelados';

/**
 * Pantalla principal para gestionar Demand Boosts.
 *
 * Los boosts SIEMPRE son de productos finales. Si el producto tiene receta,
 * el boost propaga automáticamente la demanda a sus insumos (vía
 * effectiveDailyDemand). Si es producto de reventa, afecta el stock propio.
 */
@Component({
  selector: 'app-boosts',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, DecimalPipe,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
    IonButton, IonSearchbar, IonSegment, IonSegmentButton, IonLabel,
    PageHeaderComponent, EmptyStateComponent, ConfirmDialogComponent,
    BoostFormModalComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-menu-button></ion-menu-button></ion-buttons>
        <ion-title>Boosts de demanda</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <app-page-header
        title="Boosts de demanda"
        subtitle="Registra eventos, promos o contratos que aumentan temporalmente la demanda de un producto final. El sistema propaga el efecto a los insumos vía receta.">
        <ion-button (click)="modalOpen.set(true)">+ Nuevo boost</ion-button>
      </app-page-header>

      <!-- Resumen rápido -->
      <section class="kpi-row">
        <div class="kpi" data-status="alerta">
          <div class="kpi__label">Activos</div>
          <div class="kpi__value mono">{{ kpis().activos }}</div>
        </div>
        <div class="kpi">
          <div class="kpi__label">Productos afectados</div>
          <div class="kpi__value mono">{{ kpis().productosUnicos }}</div>
        </div>
        <div class="kpi">
          <div class="kpi__label">Insumos en cascada</div>
          <div class="kpi__value mono">{{ kpis().insumosAfectados }}</div>
        </div>
        <div class="kpi">
          <div class="kpi__label">Total histórico</div>
          <div class="kpi__value mono">{{ kpis().total }}</div>
        </div>
      </section>

      <!-- Filtros -->
      <div class="filters">
        <ion-searchbar
          [value]="query()"
          (ionInput)="query.set($any($event.detail.value) ?? '')"
          placeholder="Buscar por producto o motivo"
          mode="md">
        </ion-searchbar>

        <ion-segment
          [value]="statusFilter()"
          (ionChange)="statusFilter.set($any($event.detail.value))"
          scrollable>
          <ion-segment-button value="todos"><ion-label>Todos</ion-label></ion-segment-button>
          <ion-segment-button value="activos"><ion-label>Activos</ion-label></ion-segment-button>
          <ion-segment-button value="expirados"><ion-label>Expirados</ion-label></ion-segment-button>
          <ion-segment-button value="cancelados"><ion-label>Cancelados</ion-label></ion-segment-button>
        </ion-segment>
      </div>

      <!-- Listado -->
      @if (filteredBoosts().length === 0) {
        <app-empty-state
          icon="⚡"
          title="Sin boosts registrados"
          body="Cuando sepas que un producto va a venderse más que su historial (evento, promo, contrato), regístralo aquí para que las alertas y predicciones lo respeten."
          ctaLabel="Registrar primer boost"
          (ctaClick)="modalOpen.set(true)">
        </app-empty-state>
      } @else {
        <div class="boost-grid">
          @for (b of filteredBoosts(); track b.id) {
            <article class="boost" [attr.data-status]="statusOf(b)">
              <header class="boost__head">
                <div class="boost__mode" [attr.data-mode]="b.mode">
                  {{ modeLabel(b.mode) }} {{ b.value }}{{ valueSuffix(b.mode) }}
                </div>
                <div class="boost__badge" [attr.data-status]="statusOf(b)">
                  {{ statusLabel(statusOf(b)) }}
                </div>
              </header>

              <div class="boost__product">
                <span class="boost__product-icon">{{ hasRecipe(b) ? '🍞' : '📦' }}</span>
                <div>
                  <div class="boost__product-name">{{ b.itemName }}</div>
                  <div class="boost__product-kind">
                    @if (hasRecipe(b)) {
                      Con receta · propaga a {{ recipeItemsCount(b) }} insumos
                    } @else {
                      Reventa · afecta stock propio del producto
                    }
                  </div>
                </div>
              </div>

              <div class="boost__meta">
                <div class="boost__meta-item">
                  <span class="boost__meta-label">Período</span>
                  <span class="mono">{{ b.startDate | date:'dd-MM' }} → {{ b.endDate | date:'dd-MM' }}</span>
                </div>
                <div class="boost__meta-item">
                  <span class="boost__meta-label">Motivo</span>
                  <span>{{ reasonLabel(b.reason) }}</span>
                </div>
                <div class="boost__meta-item">
                  <span class="boost__meta-label">Demanda base/efectiva</span>
                  <span class="mono">{{ effectivePreview(b).base | number:'1.0-2' }} → {{ effectivePreview(b).effective | number:'1.0-2' }} u/día</span>
                </div>
              </div>

              @if (b.description) {
                <div class="boost__description">{{ b.description }}</div>
              }

              <footer class="boost__foot">
                <span class="boost__created mono">
                  creado {{ b.createdAt | date:'dd-MM HH:mm' }} · {{ b.createdBy }}
                </span>
                @if (statusOf(b) === 'active') {
                  <button type="button" class="boost__cancel" (click)="askCancel(b)">
                    Cancelar boost
                  </button>
                }
              </footer>
            </article>
          }
        </div>
      }

      <!-- Modales -->
      <app-boost-form-modal
        [isOpen]="modalOpen()"
        [preselectedItem]="null"
        (closed)="modalOpen.set(false)"
        (saved)="modalOpen.set(false)">
      </app-boost-form-modal>

      <app-confirm-dialog
        [isOpen]="confirmOpen()"
        title="Cancelar boost"
        [message]="cancelMessage()"
        tone="danger"
        confirmLabel="Sí, cancelar"
        (confirmed)="doCancel()"
        (cancelled)="confirmOpen.set(false)">
      </app-confirm-dialog>
    </ion-content>
  `,
  styles: [`
    .kpi-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: var(--ui-sp-3);
      padding: 0 var(--ui-sp-4) var(--ui-sp-3);
    }
    @media (max-width: 900px) { .kpi-row { grid-template-columns: 1fr 1fr; } }
    @media (max-width: 480px) { .kpi-row { grid-template-columns: 1fr; } }
    .kpi {
      padding: var(--ui-sp-3);
      background: var(--ui-surface);
      border: var(--ui-border-w-sm) solid var(--ui-border);
      border-left: 4px solid var(--ui-border-strong);
      border-radius: var(--ui-radius);
    }
    .kpi[data-status="alerta"] { border-left-color: var(--ui-warning); }
    .kpi__label {
      font-size: var(--ui-fs-xs);
      color: var(--ui-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .kpi__value {
      font-size: var(--ui-fs-2xl);
      font-weight: var(--ui-fw-bold);
      color: var(--ui-text-strong);
      line-height: 1;
    }

    .filters {
      padding: 0 var(--ui-sp-4) var(--ui-sp-4);
      display: flex;
      flex-direction: column;
      gap: var(--ui-sp-3);
    }
    ion-searchbar { --background: var(--ui-surface); padding: 0; }

    .boost-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: var(--ui-sp-3);
      padding: 0 var(--ui-sp-4) var(--ui-sp-8);
    }
    @media (max-width: 480px) {
      .boost-grid {
        grid-template-columns: 1fr;
        padding: 0 var(--ui-sp-3) var(--ui-sp-8);
        gap: var(--ui-sp-2);
      }
    }
    .boost {
      background: var(--ui-surface);
      border: var(--ui-border-w-sm) solid var(--ui-border);
      border-radius: var(--ui-radius);
      box-shadow: var(--ui-shadow-sm);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .boost[data-status="active"]    { border-left: 4px solid var(--ui-warning); }
    .boost[data-status="expired"]   { border-left: 4px solid var(--ui-text-muted); opacity: 0.7; }
    .boost[data-status="cancelled"] { border-left: 4px solid var(--ui-danger);  opacity: 0.6; }

    .boost__head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--ui-sp-2) var(--ui-sp-3);
      background: var(--ui-surface-2);
      border-bottom: var(--ui-border-w-sm) solid var(--ui-border);
    }
    .boost__mode {
      font-family: var(--ui-font-mono);
      font-size: var(--ui-fs-sm);
      font-weight: var(--ui-fw-bold);
      color: var(--ui-text-strong);
    }
    .boost__mode[data-mode="multiplier"]  { color: var(--ui-danger); }
    .boost__mode[data-mode="absoluteAdd"] { color: var(--ui-warning); }
    .boost__mode[data-mode="eventTotal"]  { color: var(--ui-secondary); }
    .boost__badge {
      padding: 2px 10px;
      border-radius: var(--ui-radius-pill);
      font-size: var(--ui-fs-xs);
      font-weight: var(--ui-fw-bold);
      text-transform: uppercase;
    }
    .boost__badge[data-status="active"]    { background: var(--ui-warning-tint); color: var(--ui-warning); }
    .boost__badge[data-status="expired"]   { background: var(--ui-surface-3); color: var(--ui-text-muted); }
    .boost__badge[data-status="cancelled"] { background: var(--ui-danger-tint); color: var(--ui-danger); }

    .boost__product {
      display: flex;
      gap: var(--ui-sp-3);
      align-items: center;
      padding: var(--ui-sp-3);
    }
    .boost__product-icon { font-size: 28px; }
    .boost__product-name {
      font-size: var(--ui-fs-md);
      font-weight: var(--ui-fw-semibold);
      color: var(--ui-text-strong);
    }
    .boost__product-kind {
      font-size: var(--ui-fs-xs);
      color: var(--ui-text-muted);
      margin-top: 2px;
    }

    .boost__meta {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 0 var(--ui-sp-3) var(--ui-sp-3);
      border-top: var(--ui-border-w-sm) dashed var(--ui-border);
      padding-top: var(--ui-sp-3);
    }
    .boost__meta-item {
      display: flex;
      justify-content: space-between;
      font-size: var(--ui-fs-sm);
    }
    .boost__meta-label {
      color: var(--ui-text-muted);
      font-size: var(--ui-fs-xs);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: var(--ui-fw-medium);
    }

    .boost__description {
      padding: var(--ui-sp-2) var(--ui-sp-3);
      font-size: var(--ui-fs-xs);
      color: var(--ui-text-muted);
      font-style: italic;
      border-top: var(--ui-border-w-sm) dashed var(--ui-border);
    }

    .boost__foot {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--ui-sp-2) var(--ui-sp-3);
      border-top: var(--ui-border-w-sm) solid var(--ui-border);
      background: var(--ui-surface-2);
      margin-top: auto;
    }
    .boost__created {
      font-size: 10px;
      color: var(--ui-text-muted);
    }
    .boost__cancel {
      background: none;
      border: none;
      color: var(--ui-danger);
      font-size: var(--ui-fs-xs);
      font-weight: var(--ui-fw-bold);
      cursor: pointer;
      padding: 4px 8px;
      border-radius: var(--ui-radius-sm);
    }
    .boost__cancel:hover {
      background: var(--ui-danger-tint);
    }
  `],
})
export class BoostsPage {
  protected readonly data = inject(DataService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly modalOpen = signal(false);
  readonly confirmOpen = signal(false);
  readonly query = signal('');
  readonly statusFilter = signal<FilterStatus>('todos');
  private readonly boostToCancel = signal<DemandBoost | null>(null);

  readonly cancelMessage = computed(() => {
    const b = this.boostToCancel();
    if (!b) return '';
    return `Cancelar el boost para "${b.itemName}". Las alertas y proyecciones de stock volverán a calcularse sin este boost.`;
  });

  readonly filteredBoosts = computed(() => {
    const q = this.query().toLowerCase();
    const filter = this.statusFilter();
    return this.data.boosts()
      .filter(b => {
        if (filter === 'todos') return true;
        const s = this.statusOf(b);
        if (filter === 'activos') return s === 'active';
        if (filter === 'expirados') return s === 'expired';
        if (filter === 'cancelados') return s === 'cancelled';
        return true;
      })
      .filter(b => !q ||
        b.itemName.toLowerCase().includes(q) ||
        this.reasonLabel(b.reason).toLowerCase().includes(q) ||
        (b.description ?? '').toLowerCase().includes(q))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  });

  readonly kpis = computed(() => {
    const all = this.data.boosts();
    const activos = this.data.activeBoosts();
    const productosUnicos = new Set(activos.map(b => b.itemId)).size;

    // Insumos en cascada: sumar insumos únicos afectados por boosts activos de productos con receta
    const insumos = new Set<string>();
    for (const b of activos) {
      const p = this.data.productById(b.itemId);
      if (!p || !p.hasRecipe) continue;
      const r = this.data.recipeFor(p.id);
      if (!r) continue;
      r.items.forEach(it => { if (it.supplyId) insumos.add(it.supplyId); });
    }

    return {
      activos: activos.length,
      productosUnicos,
      insumosAfectados: insumos.size,
      total: all.length,
    };
  });

  statusOf(b: DemandBoost): 'active' | 'expired' | 'cancelled' {
    if (b.status === 'cancelled') return 'cancelled';
    if (b.endDate.getTime() < Date.now()) return 'expired';
    return 'active';
  }

  statusLabel(s: 'active' | 'expired' | 'cancelled'): string {
    return s === 'active' ? 'Activo' : s === 'expired' ? 'Expirado' : 'Cancelado';
  }

  modeLabel(m: 'multiplier' | 'absoluteAdd' | 'eventTotal'): string {
    return m === 'multiplier' ? '×' : m === 'absoluteAdd' ? '+' : 'Σ';
  }

  valueSuffix(m: 'multiplier' | 'absoluteAdd' | 'eventTotal'): string {
    return m === 'multiplier' ? '' : m === 'absoluteAdd' ? ' u/día' : ' u total';
  }

  reasonLabel(r: string): string {
    const map: Record<string, string> = {
      promo: 'Promoción',
      evento: 'Evento puntual',
      contrato: 'Contrato / cliente nuevo',
      feriado: 'Feriado / temporada',
      campaña: 'Campaña marketing',
      otro: 'Otro',
    };
    return map[r] ?? r;
  }

  hasRecipe(b: DemandBoost): boolean {
    const p = this.data.productById(b.itemId);
    return !!p && p.hasRecipe;
  }

  recipeItemsCount(b: DemandBoost): number {
    const r = this.data.recipeFor(b.itemId);
    return r?.items.length ?? 0;
  }

  /** Demanda base vs efectiva del producto (no de insumos). */
  effectivePreview(b: DemandBoost): { base: number; effective: number } {
    const base = this.data.rollingMean('product', b.itemId, 7);
    let effective = base;
    switch (b.mode) {
      case 'multiplier':  effective = base * b.value; break;
      case 'absoluteAdd': effective = base + b.value; break;
      case 'eventTotal': {
        const days = Math.max(1, Math.round((b.endDate.getTime() - b.startDate.getTime()) / 86_400_000) + 1);
        effective = base + (b.value / days);
        break;
      }
    }
    return { base, effective };
  }

  askCancel(b: DemandBoost) {
    this.boostToCancel.set(b);
    this.confirmOpen.set(true);
  }

  async doCancel() {
    const b = this.boostToCancel();
    if (!b) return;
    this.data.cancelBoost(b.id);
    this.confirmOpen.set(false);
    this.boostToCancel.set(null);
    await this.toast.show('Boost cancelado.', 'success');
  }
}
