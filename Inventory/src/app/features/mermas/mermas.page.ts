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
  templateUrl: './mermas.page.html',
  styleUrls: ['./mermas.page.scss'],
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
   * Input de cantidad en unidades (0..max). Único control de entrada
   * para el editor de merma. Se acota silenciosamente al rango válido.
   */
  setMermaQty(lotId: string, raw: string, max: number) {
    const n = Number(raw);
    const qty = Math.max(0, Math.min(isFinite(n) ? Math.floor(n) : 0, max));
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
