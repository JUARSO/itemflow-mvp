import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
  IonIcon, IonBadge, IonSegment, IonSegmentButton, IonLabel, IonButton,
} from '@ionic/angular/standalone';
import { DataService } from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../shared/components/toast/toast.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { MermaProduccionModalComponent } from './merma-produccion-modal.component';
import { ReturnedLot, ProductionMermaReason } from '../../core/models';

type Tab = 'pending' | 'history';

const PROD_REASON_LABELS: Record<ProductionMermaReason, string> = {
  damaged: 'Dañado',
  underbaked: 'Crudo',
  overbaked: 'Quemado',
  wrong_shape: 'Mal formado',
  contaminated: 'Contaminado',
  other: 'Otro',
};

/**
 * Pantalla de Mermas: bandeja de productos devueltos por clientes
 * pendientes de decisión. Por cada lote el admin elige cuántas unidades
 * descartar (merma) y cuántas reintegrar al inventario como utilizables.
 *
 * Flujo:
 *  - El cliente confirma recepción reportando menos unidades → se crea
 *    un `ReturnedLot` en estado `pending` (las unidades NO entran a stock).
 *  - En esta pantalla: input "Merma" + shortcuts (0%, 50%, 100%) +
 *    "Procesar" → se reintegra (qty − merma) al stock, el resto se descarta.
 */
@Component({
  selector: 'app-mermas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, DecimalPipe,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
    IonIcon, IonBadge, IonSegment, IonSegmentButton, IonLabel, IonButton,
    PageHeaderComponent, KpiCardComponent, MermaProduccionModalComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-menu-button></ion-menu-button></ion-buttons>
        <ion-title>Mermas</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <app-page-header
        title="Mermas y devoluciones"
        subtitle="Devoluciones de clientes (decide cuánto descartar) y mermas de producción (productos que fallaron al fabricarse).">
        <ion-button color="danger" (click)="prodModalOpen.set(true)">
          <ion-icon name="add-outline" slot="start"></ion-icon>
          Merma de producción
        </ion-button>
      </app-page-header>

      <div class="kpis">
        <app-kpi-card label="Pendientes" [value]="pendientes().length" tone="warning"
          [hint]="pendingUnits() + ' unid. · ₡' + (pendingCostLabel())"></app-kpi-card>
        <app-kpi-card label="Merma (30d)" [value]="merma30dCostLabel()" tone="danger"
          [hint]="merma30d() + ' unid. descartadas'"></app-kpi-card>
        <app-kpi-card label="Reintegradas (30d)" [value]="reuse30dCostLabel()" tone="success"
          [hint]="reuse30d() + ' unid. al inventario'"></app-kpi-card>
        <app-kpi-card label="% merma promedio (30d)" [value]="avgMermaPctLabel()" tone="primary"
          hint="sobre devoluciones procesadas"></app-kpi-card>
      </div>

      <div class="tabs">
        <ion-segment [value]="tab()" (ionChange)="tab.set($any($event.detail.value))">
          <ion-segment-button value="pending">
            <ion-label>Pendientes ({{ pendientes().length }})</ion-label>
          </ion-segment-button>
          <ion-segment-button value="history">
            <ion-label>Histórico ({{ historico().length }})</ion-label>
          </ion-segment-button>
        </ion-segment>
      </div>

      @if (tab() === 'pending') {
        @if (pendientes().length === 0) {
          <div class="empty">
            <h3>Sin lotes pendientes</h3>
            <p>Cuando un cliente reporte que recibió menos unidades de lo entregado,
              esas devoluciones aparecerán aquí para que decidas qué hacer con ellas.</p>
          </div>
        } @else {
          <div class="cards">
            @for (lot of pendientes(); track lot.id) {
              <article class="card">
                <header class="card__head">
                  <div>
                    <div class="card__product">{{ lot.productName }}</div>
                    <div class="card__source mono">{{ lot.sourceOrderCode }}</div>
                  </div>
                  <ion-badge color="warning">{{ lot.qty }} {{ unidLabel(lot.qty) }}</ion-badge>
                </header>

                <div class="card__meta">
                  @if (lot.customerName) {
                    <div><ion-icon name="person-outline"></ion-icon> {{ lot.customerName }}</div>
                  }
                  <div><ion-icon name="time-outline"></ion-icon>
                    Devuelto {{ lot.createdAt | date:'dd-MM-yyyy HH:mm' }}
                  </div>
                </div>

                @if (lot.customerNote) {
                  <div class="card__note">
                    <strong>Nota del cliente:</strong> {{ lot.customerNote }}
                  </div>
                }

                <!-- Editor de merma -->
                <div class="editor">
                  <!-- Costo de producción base -->
                  <div class="cost-banner">
                    <ion-icon name="cash-outline"></ion-icon>
                    <div>
                      <div class="cost-banner__label">Costo de producción del lote</div>
                      <div class="cost-banner__value mono">
                        ₡{{ lotCost(lot) | number:'1.0-0' }}
                        <span class="cost-banner__unit">
                          ({{ unitCost(lot.productId) | number:'1.0-2' }} / unidad)
                        </span>
                      </div>
                    </div>
                  </div>

                  <!-- Único input: porcentaje de merma (0..100) -->
                  <div class="editor__row">
                    <label>Porcentaje de merma</label>
                    <div class="editor__input-group">
                      <input type="number"
                        min="0"
                        max="100"
                        step="1"
                        [value]="mermaPct(lot)"
                        (input)="setMermaPctRaw(lot.id, $any($event.target).value, lot.qty)"
                        class="editor__input mono editor__input--pct" />
                      <span class="editor__suffix">%</span>
                    </div>
                  </div>

                  <div class="summary">
                    <div class="summary__row">
                      <span class="summary__label">Costo perdido (merma)</span>
                      <strong class="summary__value summary__value--danger mono">
                        ₡{{ mermaCost(lot) | number:'1.0-0' }}
                      </strong>
                    </div>
                    <div class="summary__row">
                      <span class="summary__label">Costo recuperado</span>
                      <strong class="summary__value summary__value--ok mono">
                        ₡{{ usableCost(lot) | number:'1.0-0' }}
                      </strong>
                    </div>
                  </div>

                  <div class="editor__note-field">
                    <label>Nota interna (opcional)</label>
                    <textarea rows="2"
                      placeholder="Ej: estado del producto, decisión tomada…"
                      [value]="reviewNote(lot.id)"
                      (input)="setReviewNote(lot.id, $any($event.target).value)"
                      class="editor__input"></textarea>
                  </div>

                  <button class="btn btn--primary" (click)="process(lot)">
                    <ion-icon name="checkmark-circle-outline"></ion-icon>
                    Procesar lote
                  </button>
                </div>
              </article>
            }
          </div>
        }
      } @else {
        @if (historico().length === 0) {
          <div class="empty">
            <h3>Sin lotes procesados</h3>
            <p>Los lotes que ya hayas revisado aparecerán aquí con el resumen de tu decisión.</p>
          </div>
        } @else {
          <div class="hist-list">
            @for (lot of historico(); track lot.id) {
              <article class="hist-card"
                [class.hist-card--full-merma]="lot.mermaQty === lot.qty"
                [class.hist-card--reused]="lot.mermaQty === 0">
                <div class="hist-card__main">
                  <div>
                    <div class="hist-card__product">
                      {{ lot.productName }}
                      @if (lot.kind === 'production') {
                        <ion-badge color="danger" class="kind-badge">Producción</ion-badge>
                      } @else {
                        <ion-badge color="medium" class="kind-badge">Cliente</ion-badge>
                      }
                    </div>
                    <div class="hist-card__source">
                      @if (lot.kind === 'production') {
                        <span>{{ prodReasonLabel(lot) }}</span>
                      } @else {
                        <span class="mono">{{ lot.sourceOrderCode }}</span>
                        @if (lot.customerName) { · {{ lot.customerName }} }
                      }
                    </div>
                  </div>
                  <div class="hist-card__breakdown">
                    <div class="hist-card__chunk hist-card__chunk--total">
                      <span class="muted">{{ lot.kind === 'production' ? 'Fabricado' : 'Devuelto' }}</span>
                      <span class="mono">{{ lot.qty }} {{ unidLabel(lot.qty) }}</span>
                      <span class="mono sub">₡{{ lotCost(lot) | number:'1.0-0' }}</span>
                    </div>
                    @if (lot.mermaQty > 0) {
                      <div class="hist-card__chunk hist-card__chunk--merma">
                        <span class="muted">Merma ({{ pctOf(lot.mermaQty, lot.qty) }}%)</span>
                        <span class="mono">−{{ lot.mermaQty }} {{ unidLabel(lot.mermaQty) }}</span>
                        <span class="mono sub">−₡{{ mermaCost(lot) | number:'1.0-0' }}</span>
                      </div>
                    }
                    @if (usableQty(lot) > 0) {
                      <div class="hist-card__chunk hist-card__chunk--ok">
                        <span class="muted">Reintegrado ({{ 100 - pctOf(lot.mermaQty, lot.qty) }}%)</span>
                        <span class="mono">+{{ usableQty(lot) }} {{ unidLabel(usableQty(lot)) }}</span>
                        <span class="mono sub">+₡{{ usableCost(lot) | number:'1.0-0' }}</span>
                      </div>
                    }
                  </div>
                </div>
                <div class="hist-card__foot">
                  <span class="muted">
                    Procesado {{ lot.reviewedAt | date:'dd-MM-yyyy HH:mm' }}
                    @if (lot.reviewedBy) { · por {{ lot.reviewedBy }} }
                  </span>
                  @if (lot.customerNote) {
                    <div class="hist-card__note">
                      <strong>Cliente:</strong> {{ lot.customerNote }}
                    </div>
                  }
                  @if (lot.reviewNote) {
                    <div class="hist-card__note">
                      <strong>Interno:</strong> {{ lot.reviewNote }}
                    </div>
                  }
                </div>
              </article>
            }
          </div>
        }
      }

      <app-merma-produccion-modal
        [isOpen]="prodModalOpen()"
        (closed)="prodModalOpen.set(false)"
        (saved)="onProdMermaSaved()">
      </app-merma-produccion-modal>
    </ion-content>
  `,
  styles: [`
    .kpis {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: var(--ui-sp-3);
      padding: 0 var(--ui-sp-4) var(--ui-sp-3);
    }
    @media (max-width: 900px) { .kpis { grid-template-columns: 1fr 1fr; } }
    @media (max-width: 480px) { .kpis { grid-template-columns: 1fr; } }

    .tabs { padding: 0 var(--ui-sp-4) var(--ui-sp-3); }

    .empty {
      margin: var(--ui-sp-4);
      padding: var(--ui-sp-6) var(--ui-sp-4);
      text-align: center;
      background: var(--ui-surface-2);
      border: var(--ui-border-w-md) dashed var(--ui-border);
    }
    .empty h3 { margin: 0 0 var(--ui-sp-2); font-size: var(--ui-fs-lg); }
    .empty p { margin: 0; color: var(--ui-text-muted); font-size: var(--ui-fs-sm); }

    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
      gap: var(--ui-sp-3);
      padding: 0 var(--ui-sp-4) var(--ui-sp-8);
    }
    .card {
      background: var(--ui-surface);
      border: var(--ui-border-w-md) solid var(--ui-border);
      border-left: 6px solid var(--ui-warning);
      box-shadow: var(--ui-shadow-md);
      padding: var(--ui-sp-3);
      display: flex;
      flex-direction: column;
      gap: var(--ui-sp-2);
    }
    .card__head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: var(--ui-sp-2);
    }
    .card__product {
      font-weight: var(--ui-fw-black);
      font-size: var(--ui-fs-md);
    }
    .card__source {
      font-size: var(--ui-fs-xs);
      color: var(--ui-text-muted);
      margin-top: 2px;
    }
    .card__meta {
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-size: var(--ui-fs-xs);
      color: var(--ui-text-muted);
    }
    .card__meta ion-icon { vertical-align: middle; font-size: 13px; margin-right: 4px; }
    .card__note {
      font-size: var(--ui-fs-xs);
      color: var(--ui-text);
      padding: 6px 8px;
      background: var(--ui-surface-2);
      font-style: italic;
    }

    .editor {
      display: flex;
      flex-direction: column;
      gap: var(--ui-sp-2);
      padding-top: var(--ui-sp-2);
      border-top: var(--ui-border-w-sm) solid var(--ui-border);
    }
    .cost-banner {
      display: flex;
      gap: var(--ui-sp-2);
      align-items: center;
      padding: var(--ui-sp-2);
      background: var(--ui-surface-2);
      border-left: 4px solid var(--ui-primary);
    }
    .cost-banner ion-icon { font-size: 24px; color: var(--ui-primary); flex-shrink: 0; }
    .cost-banner__label {
      font-size: 10px;
      font-weight: var(--ui-fw-black);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--ui-text-muted);
    }
    .cost-banner__value {
      font-size: var(--ui-fs-lg);
      font-weight: var(--ui-fw-black);
      color: var(--ui-text);
    }
    .cost-banner__unit {
      font-size: var(--ui-fs-xs);
      color: var(--ui-text-muted);
      font-weight: var(--ui-fw-bold);
      margin-left: 4px;
    }

    .editor__row { display: flex; flex-direction: column; gap: 4px; }
    .editor label {
      font-size: var(--ui-fs-xs);
      font-weight: var(--ui-fw-black);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--ui-text-muted);
    }
    .editor__input-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .editor__input {
      padding: 8px 10px;
      border: var(--ui-border-w-md) solid var(--ui-border);
      background: var(--ui-surface);
      font-family: var(--ui-font-sans);
      font-size: var(--ui-fs-sm);
      box-sizing: border-box;
      width: 100%;
      resize: vertical;
    }
    .editor__input[type="number"] { width: 100px; font-family: var(--ui-font-mono); text-align: center; }
    .editor__input--pct {
      font-size: var(--ui-fs-lg);
      font-weight: var(--ui-fw-black);
      padding: 12px;
      width: 120px;
    }
    .editor__suffix {
      color: var(--ui-text-muted);
      font-size: var(--ui-fs-sm);
      font-family: var(--ui-font-mono);
    }
    .editor__note-field {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .summary {
      padding: var(--ui-sp-2);
      background: var(--ui-text);
      color: var(--ui-surface);
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .summary__row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: var(--ui-fs-sm);
      gap: var(--ui-sp-2);
    }
    .summary__label { color: rgba(255,255,255,0.8); }
    .summary__value { font-size: var(--ui-fs-lg); }
    .summary__value--danger { color: var(--ui-warning); }
    .summary__value--ok { color: #8eff8e; }

    .btn {
      padding: 12px;
      border: none;
      background: var(--ui-success);
      color: #fff;
      font-weight: var(--ui-fw-black);
      font-size: var(--ui-fs-sm);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      font-family: var(--ui-font-sans);
    }
    .btn:hover { filter: brightness(1.05); }
    .btn ion-icon { font-size: 18px; }

    /* === Histórico === */
    .hist-list {
      display: flex;
      flex-direction: column;
      gap: var(--ui-sp-2);
      padding: 0 var(--ui-sp-4) var(--ui-sp-8);
    }
    .hist-card {
      background: var(--ui-surface);
      border: var(--ui-border-w-md) solid var(--ui-border);
      border-left: 4px solid var(--ui-success);
      box-shadow: var(--ui-shadow-sm);
      padding: var(--ui-sp-3);
      display: flex;
      flex-direction: column;
      gap: var(--ui-sp-2);
    }
    .hist-card--full-merma { border-left-color: var(--ui-danger); }
    .hist-card--reused { border-left-color: var(--ui-success); }
    .hist-card__main {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--ui-sp-3);
      flex-wrap: wrap;
    }
    .hist-card__product {
      font-weight: var(--ui-fw-black);
      font-size: var(--ui-fs-md);
      display: flex; align-items: center; gap: 6px;
      flex-wrap: wrap;
    }
    .kind-badge { font-size: 9px; letter-spacing: 0.5px; }
    .hist-card__source {
      font-size: var(--ui-fs-xs);
      color: var(--ui-text-muted);
    }
    .hist-card__breakdown {
      display: flex;
      gap: var(--ui-sp-3);
      flex-wrap: wrap;
    }
    .hist-card__chunk {
      display: flex;
      flex-direction: column;
      gap: 2px;
      text-align: right;
      font-size: var(--ui-fs-sm);
    }
    .hist-card__chunk .muted {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--ui-text-muted);
    }
    .hist-card__chunk--total .mono { color: var(--ui-text); font-weight: var(--ui-fw-bold); }
    .hist-card__chunk--merma .mono { color: var(--ui-danger); font-weight: var(--ui-fw-black); }
    .hist-card__chunk--ok    .mono { color: var(--ui-success); font-weight: var(--ui-fw-black); }
    .hist-card__chunk .sub {
      font-size: 10px;
      font-weight: var(--ui-fw-bold);
      opacity: 0.85;
    }

    .hist-card__foot {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: var(--ui-fs-xs);
      color: var(--ui-text-muted);
      padding-top: var(--ui-sp-2);
      border-top: var(--ui-border-w-sm) dashed var(--ui-border);
    }
    .hist-card__note {
      color: var(--ui-text);
      padding: 4px 6px;
      background: var(--ui-surface-2);
      font-style: italic;
    }
  `],
})
export class MermasPage {
  protected readonly data = inject(DataService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly tab = signal<Tab>('pending');
  readonly prodModalOpen = signal(false);

  /** Borrador local de merma por lote: lotId → cantidad. */
  readonly mermaDrafts = signal<Record<string, number>>({});
  /** Borrador local de notas por lote: lotId → texto. */
  readonly noteDrafts = signal<Record<string, string>>({});

  readonly pendientes = computed(() => this.data.pendingReturnedLots());
  readonly historico = computed(() => this.data.processedReturnedLots());

  readonly pendingUnits = computed(() =>
    this.pendientes().reduce((s, l) => s + l.qty, 0)
  );

  readonly pendingCost = computed(() =>
    this.pendientes().reduce((s, l) => s + this.lotCost(l), 0)
  );

  readonly merma30d = computed(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return this.historico()
      .filter(l => (l.reviewedAt?.getTime() ?? 0) >= cutoff)
      .reduce((s, l) => s + l.mermaQty, 0);
  });

  readonly merma30dCost = computed(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return this.historico()
      .filter(l => (l.reviewedAt?.getTime() ?? 0) >= cutoff)
      .reduce((s, l) => s + this.mermaCost(l), 0);
  });

  readonly reuse30d = computed(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return this.historico()
      .filter(l => (l.reviewedAt?.getTime() ?? 0) >= cutoff)
      .reduce((s, l) => s + (l.qty - l.mermaQty), 0);
  });

  readonly reuse30dCost = computed(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return this.historico()
      .filter(l => (l.reviewedAt?.getTime() ?? 0) >= cutoff)
      .reduce((s, l) => s + this.usableCost(l), 0);
  });

  readonly avgMermaPctLabel = computed(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const lots = this.historico().filter(l => (l.reviewedAt?.getTime() ?? 0) >= cutoff);
    if (lots.length === 0) return '0%';
    const totalQty = lots.reduce((s, l) => s + l.qty, 0);
    const totalMerma = lots.reduce((s, l) => s + l.mermaQty, 0);
    if (totalQty === 0) return '0%';
    return `${Math.round((totalMerma / totalQty) * 100)}%`;
  });

  readonly pendingCostLabel = computed(() => this.formatCRC(this.pendingCost()));
  readonly merma30dCostLabel = computed(() => this.formatCRC(this.merma30dCost()));
  readonly reuse30dCostLabel = computed(() => this.formatCRC(this.reuse30dCost()));

  mermaQty(lotId: string): number {
    return this.mermaDrafts()[lotId] ?? 0;
  }

  /** Porcentaje actual del borrador (0..100). */
  mermaPct(lot: ReturnedLot): number {
    if (lot.status === 'reviewed') {
      return this.pctOf(lot.mermaQty, lot.qty);
    }
    return this.pctOf(this.mermaQty(lot.id), lot.qty);
  }

  pctOf(part: number, total: number): number {
    if (total <= 0) return 0;
    return Math.round((part / total) * 100);
  }

  /**
   * Al guardar una merma de producción cerramos el modal y saltamos al
   * tab "Histórico" — la merma de producción se crea ya en `reviewed`
   * (todo es pérdida), así que vive ahí, no en "Pendientes".
   */
  onProdMermaSaved() {
    this.prodModalOpen.set(false);
    this.tab.set('history');
  }

  /** Pluraliza la palabra "unidad" según la cantidad. */
  unidLabel(qty: number): string {
    return qty === 1 ? 'unidad' : 'unidades';
  }

  prodReasonLabel(lot: ReturnedLot): string {
    if (lot.kind !== 'production' || !lot.productionReason) return '';
    const base = PROD_REASON_LABELS[lot.productionReason];
    return lot.productionReason === 'other' && lot.productionReasonText
      ? `${base}: ${lot.productionReasonText}`
      : base;
  }

  reviewNote(lotId: string): string {
    return this.noteDrafts()[lotId] ?? '';
  }

  usableQty(lot: ReturnedLot): number {
    if (lot.status === 'reviewed') return lot.qty - lot.mermaQty;
    return Math.max(0, lot.qty - this.mermaQty(lot.id));
  }

  /** Costo de producción por unidad para el producto del lote. */
  unitCost(productId: string): number {
    return this.data.effectiveProductCost(productId);
  }

  /** Costo total del lote (qty original × costo unitario). */
  lotCost(lot: ReturnedLot): number {
    return lot.qty * this.unitCost(lot.productId);
  }

  /** Costo de las unidades marcadas como merma. */
  mermaCost(lot: ReturnedLot): number {
    const q = lot.status === 'reviewed' ? lot.mermaQty : this.mermaQty(lot.id);
    return q * this.unitCost(lot.productId);
  }

  /** Costo de las unidades a reintegrar. */
  usableCost(lot: ReturnedLot): number {
    return this.usableQty(lot) * this.unitCost(lot.productId);
  }

  /**
   * Input de porcentaje (0..100). Es el único control de entrada.
   * El porcentaje no puede pasar de 100 ni ser negativo — fuera de ese rango
   * se acota silenciosamente.
   */
  setMermaPctRaw(lotId: string, raw: string, max: number) {
    const n = Number(raw);
    const pct = Math.max(0, Math.min(isFinite(n) ? n : 0, 100));
    const qty = Math.round((pct / 100) * max);
    this.mermaDrafts.update(d => ({ ...d, [lotId]: qty }));
  }

  setReviewNote(lotId: string, raw: string) {
    this.noteDrafts.update(d => ({ ...d, [lotId]: raw }));
  }

  private formatCRC(v: number): string {
    if (v >= 1_000_000) return '₡' + (v / 1_000_000).toFixed(1) + 'M';
    if (v >= 10_000) return '₡' + (v / 1000).toFixed(1) + 'K';
    return '₡' + new Intl.NumberFormat('es-CR', { maximumFractionDigits: 0 }).format(v);
  }

  async process(lot: ReturnedLot) {
    const u = this.auth.user();
    const merma = this.mermaQty(lot.id);
    const note = this.reviewNote(lot.id);
    try {
      this.data.processReturnedLot(
        lot.id,
        merma,
        note,
        u?.uid ?? 'admin',
        u?.displayName ?? 'Admin',
      );
      const usable = lot.qty - merma;
      const msg = merma === 0
        ? `${lot.qty} ${lot.unit} reintegradas al inventario.`
        : merma === lot.qty
          ? `${lot.qty} ${lot.unit} descartadas como merma.`
          : `${usable} ${lot.unit} al inventario, ${merma} a merma.`;
      await this.toast.show(msg);
      // Limpiar borradores del lote procesado
      this.mermaDrafts.update(d => { const x = { ...d }; delete x[lot.id]; return x; });
      this.noteDrafts.update(d => { const x = { ...d }; delete x[lot.id]; return x; });
    } catch (e: unknown) {
      await this.toast.show(e instanceof Error ? e.message : 'Error al procesar.', 'danger');
    }
  }
}
