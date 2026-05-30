import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
  IonButton,
} from '@ionic/angular/standalone';
import { DataService } from '../../core/services/data.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { ProjectionChartComponent, ProjectionMarker } from '../predicciones/projection-chart.component';

type CatalogItemKind = 'supply' | 'product';
interface CatalogItem { kind: CatalogItemKind; id: string; name: string; sku: string; unit: string; }

/**
 * Análisis de burn-down: para el item seleccionado proyecta cuánto stock queda
 * día a día y señala el día sugerido para ordenar.
 *
 * Reutiliza `simulateBurnDown` del DataService y el ProjectionChartComponent
 * de la pantalla de Predicciones.
 */
@Component({
  selector: 'app-burn-down',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, DecimalPipe, FormsModule, RouterLink,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton, IonButton,
    PageHeaderComponent, ProjectionChartComponent,
  ],
  templateUrl: './burn-down.page.html',
  styleUrls: ['./burn-down.page.scss'],
})
export class BurnDownPage {
  protected readonly data = inject(DataService);
  private readonly router = inject(Router);

  selectedRef = '';
  horizon = 60;

  private readonly _selection = signal<{ kind: CatalogItemKind; id: string } | null>(null);

  readonly supplyItems = computed<CatalogItem[]>(() =>
    this.data.activeSupplies().map(s => ({
      kind: 'supply' as const, id: s.id, name: s.name, sku: s.sku, unit: s.unit,
    }))
  );

  readonly productItems = computed<CatalogItem[]>(() =>
    this.data.activeProducts()
      .filter(p => !p.hasRecipe)
      .map(p => ({
        kind: 'product' as const, id: p.id, name: p.name, sku: p.sku, unit: p.unit,
      }))
  );

  readonly selectedItem = computed<CatalogItem | null>(() => {
    const sel = this._selection();
    if (!sel) return null;
    const pool = sel.kind === 'supply' ? this.supplyItems() : this.productItems();
    return pool.find(i => i.id === sel.id) ?? null;
  });

  readonly sim = computed(() => {
    const sel = this._selection();
    if (!sel) return null;
    return this.data.simulateBurnDown(sel.kind, sel.id, this.horizon);
  });

  readonly unitLabel = computed(() => this.selectedItem()?.unit ?? '');

  readonly coverageStatus = computed<'optimo' | 'alerta' | 'critico'>(() => {
    const s = this.sim();
    if (!s) return 'optimo';
    const days = s.daysOfCoverage;
    if (days < 7) return 'critico';
    if (days < 14) return 'alerta';
    return 'optimo';
  });

  readonly orderUrgencyStatus = computed<'optimo' | 'alerta' | 'critico' | 'informativo'>(() => {
    const s = this.sim();
    if (!s || s.dayToOrder === null) return 'optimo';
    if (s.dayToOrder <= 3) return 'critico';
    if (s.dayToOrder <= 7) return 'alerta';
    return 'informativo';
  });

  readonly chartMarkers = computed<ProjectionMarker[]>(() => {
    const s = this.sim();
    if (!s) return [];
    const markers: ProjectionMarker[] = [];
    if (s.dayToOrder !== null && s.dayToOrder <= this.horizon) {
      markers.push({
        day: s.dayToOrder,
        value: s.trayectoria[s.dayToOrder] ?? 0,
        label: '📅 Ordenar',
      });
    }
    if (s.dayCrossesReorder !== null && s.dayCrossesReorder <= this.horizon) {
      markers.push({
        day: s.dayCrossesReorder,
        value: s.reorderPoint,
        label: 'ROP',
      });
    }
    if (s.dayHitsZero !== null && s.dayHitsZero <= this.horizon) {
      markers.push({
        day: s.dayHitsZero,
        value: 0,
        label: '🚨 Stock 0',
      });
    }
    return markers;
  });

  onSelect() {
    if (!this.selectedRef) {
      this._selection.set(null);
      return;
    }
    const [kind, id] = this.selectedRef.split(':') as [CatalogItemKind, string];
    this._selection.set({ kind, id });
  }

  dateOf(dayOffset: number): string {
    const d = new Date();
    d.setDate(d.getDate() + dayOffset);
    return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', weekday: 'short' });
  }

  goToCreatePO() {
    // Navega a OC. (En una iteración futura podríamos pasar item+qty pre-cargados.)
    this.router.navigateByUrl('/ordenes-compra');
  }

  readonly avgDemandWithBoost = computed<number>(() => {
    const s = this.sim();
    if (!s) return 0;
    const arr = s.demandPerDay;
    if (arr.length === 0) return s.baselineDailyDemand;
    return arr.reduce((acc, x) => acc + x, 0) / arr.length;
  });


}
