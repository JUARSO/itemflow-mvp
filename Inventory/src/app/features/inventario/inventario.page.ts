import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
  IonSearchbar, IonSegment, IonSegmentButton, IonLabel, IonButton, IonIcon,
} from '@ionic/angular/standalone';
import { DataService } from '../../core/services/data.service';
import { TenantContextService } from '../../core/services/tenant-context.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { EntradaFormModalComponent } from './entrada-form-modal.component';
import { StockStatus } from '../../core/models';
import { UnitShortPipe } from '../../shared/pipes/unit-short.pipe';

type StatusFilter = 'todos' | StockStatus;

@Component({
  selector: 'app-inventario',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe, RouterLink,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
    IonSearchbar, IonSegment, IonSegmentButton, IonLabel, IonButton, IonIcon,
    PageHeaderComponent, KpiCardComponent, StatusBadgeComponent,
    EntradaFormModalComponent,
    UnitShortPipe,
  ],
  templateUrl: './inventario.page.html',
  styleUrls: ['./inventario.page.scss'],
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
          unit: sup?.unit ?? 'unidad',
          reorderPoint: sup?.reorderPoint ?? 0,
          quantity: stock.quantity,
          status: stock.status,
          presentation: sup?.presentation,
        };
      })
      .filter(row =>
        !q || row.name.toLowerCase().includes(q) || row.sku.toLowerCase().includes(q)
      )
      .sort((a, b) => statusWeight(a.status) - statusWeight(b.status));
  });

  /**
   * Formatea una cantidad en presentación si está definida; sino en unidad
   * base. Ej: "3 sacos" o "75 kg".
   */
  fmtStock(row: { quantity: number; unit: string; presentation?: { size: number; label: string } }, qty: number = row.quantity): string {
    if (row.presentation && row.presentation.size > 0) {
      const n = qty / row.presentation.size;
      const display = Math.round(n * 100) / 100;
      const label = display === 1 ? row.presentation.label
        : (row.presentation.label.endsWith('s') ? row.presentation.label : row.presentation.label + 's');
      return `${display} ${label}`;
    }
    return `${qty} ${row.unit}`;
  }

  /** Si hay presentación, muestra el equivalente en unidad base entre paréntesis. */
  fmtStockEquivalent(row: { quantity: number; unit: string; presentation?: { size: number; label: string } }, qty: number = row.quantity): string | null {
    if (!row.presentation) return null;
    return `${qty} ${row.unit}`;
  }

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
          productId: stock.productId,
          name: p?.name ?? '—',
          sku: p?.sku ?? '',
          unit: p?.unit ?? 'unidad',
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

  /**
   * Suma de unidades devueltas por clientes en los últimos 30 días para
   * un producto. Usa el kardex con reason 'return_from_customer'.
   */
  private readonly recentReturnsByProduct = computed(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const map = new Map<string, number>();
    for (const e of this.data.kardex()) {
      if (e.reason !== 'return_from_customer') continue;
      if (!e.productId) continue;
      if (e.at.getTime() < cutoff) continue;
      map.set(e.productId, (map.get(e.productId) ?? 0) + e.qty);
    }
    return map;
  });

  returnsForProduct(productId: string): number {
    return this.recentReturnsByProduct().get(productId) ?? 0;
  }

  /** Suma de unidades en lotes de merma pendientes para un producto. */
  private readonly pendingMermaByProduct = computed(() => {
    const map = new Map<string, number>();
    for (const lot of this.data.pendingReturnedLots()) {
      map.set(lot.productId, (map.get(lot.productId) ?? 0) + lot.qty);
    }
    return map;
  });

  pendingMermaForProduct(productId: string): number {
    return this.pendingMermaByProduct().get(productId) ?? 0;
  }
}

function statusWeight(s: StockStatus): number {
  return s === 'out' ? 0 : s === 'critical' ? 1 : s === 'low' ? 2 : 3;
}
