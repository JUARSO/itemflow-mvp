import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
  IonButton, IonSearchbar, IonSegment, IonSegmentButton, IonLabel,
} from '@ionic/angular/standalone';
import { DataService } from '../../core/services/data.service';
import { TenantContextService } from '../../core/services/tenant-context.service';
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
  templateUrl: './ajustes.page.html',
  styleUrls: ['./ajustes.page.scss'],
})
export class AjustesPage {
  protected readonly data = inject(DataService);
  protected readonly tenant = inject(TenantContextService);

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
