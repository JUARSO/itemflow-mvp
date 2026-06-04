import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton, IonIcon, IonButton,
} from '@ionic/angular/standalone';
import { DataService } from '../../core/services/data.service';
import { TenantContextService } from '../../core/services/tenant-context.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { SearchBarComponent } from '../../shared/components/search-bar/search-bar.component';
import { CabysModalComponent, CabysTarget } from './cabys-modal.component';

@Component({
  selector: 'app-catalogo-ventas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton, IonIcon, IonButton,
    PageHeaderComponent, KpiCardComponent, SearchBarComponent, CabysModalComponent,
  ],
  templateUrl: './catalogo-ventas.page.html',
  styleUrls: ['./catalogo-ventas.page.scss'],
})
export class CatalogoVentasPage {
  protected readonly data = inject(DataService);
  protected readonly tenant = inject(TenantContextService);

  /** Una fila por producto: costo real (receta/compra, lo maneja producción) + precio final de venta. */
  readonly filas = computed(() =>
    this.data.activeProducts().map(p => {
      const costo = this.data.effectiveProductCost(p.id);
      const final = this.data.consumerPrice(p.id);
      const margen = final - costo;
      const iva = p.cabysIva;
      return {
        id: p.id,
        name: p.name,
        unit: p.unit,
        costo,
        final,
        margen,
        margenPct: costo > 0 ? Math.round((margen / costo) * 100) : 0,
        cabysCode: p.cabysCode,
        cabysDesc: p.cabysDesc,
        cabysIva: iva,
        // Precio final con IVA = precio de venta × (1 + tasa). null si aún no hay CABYS.
        finalConIva: iva != null ? Math.round(final * (1 + iva)) : null,
      };
    })
  );

  /** Productos sin código CABYS asignado (los marcados con asterisco). */
  readonly sinCabys = computed(() => this.filas().filter(r => !r.cabysCode).length);

  // ----- Modal de configuración CABYS -----
  readonly cabysTarget = signal<CabysTarget | null>(null);

  openCabys(r: { id: string; name: string; cabysCode?: string; cabysDesc?: string; cabysIva?: number }) {
    this.cabysTarget.set({ id: r.id, name: r.name, cabysCode: r.cabysCode, cabysDesc: r.cabysDesc, cabysIva: r.cabysIva });
  }

  onCabysSaved(payload: { code: string; desc: string; iva: number } | null) {
    const t = this.cabysTarget();
    if (t) this.data.setProductCabys(t.id, payload?.code ?? null, payload?.desc ?? null, payload?.iva ?? null);
    this.cabysTarget.set(null);
  }

  readonly query = signal('');
  readonly filasFiltradas = computed(() => {
    const q = this.query().trim().toLowerCase();
    const list = this.filas();
    if (!q) return list;
    return list.filter(x => (x.name ?? '').toLowerCase().includes(q));
  });

  readonly margenPromedio = computed(() => {
    const f = this.filas();
    if (f.length === 0) return 0;
    return Math.round(f.reduce((s, r) => s + r.margenPct, 0) / f.length);
  });

  setFinal(productId: string, value: number) {
    this.data.setConsumerPrice(productId, value);
  }
}
