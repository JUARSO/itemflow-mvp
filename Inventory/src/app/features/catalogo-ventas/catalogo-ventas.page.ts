import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
} from '@ionic/angular/standalone';
import { DataService } from '../../core/services/data.service';
import { TenantContextService } from '../../core/services/tenant-context.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';

@Component({
  selector: 'app-catalogo-ventas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
    PageHeaderComponent, KpiCardComponent,
  ],
  templateUrl: './catalogo-ventas.page.html',
  styleUrls: ['./catalogo-ventas.page.scss'],
})
export class CatalogoVentasPage {
  protected readonly data = inject(DataService);
  protected readonly tenant = inject(TenantContextService);

  /** Una fila por producto: costo (precio base producción) + precio final consumidor. */
  readonly filas = computed(() =>
    this.data.activeProducts().map(p => {
      const costo = this.data.baseSalePrice(p.id);
      const final = this.data.consumerPrice(p.id);
      const margen = final - costo;
      return {
        id: p.id,
        name: p.name,
        unit: p.unit,
        costo,
        final,
        margen,
        margenPct: costo > 0 ? Math.round((margen / costo) * 100) : 0,
      };
    })
  );

  readonly margenPromedio = computed(() => {
    const f = this.filas();
    if (f.length === 0) return 0;
    return Math.round(f.reduce((s, r) => s + r.margenPct, 0) / f.length);
  });

  setFinal(productId: string, value: number) {
    this.data.setConsumerPrice(productId, value);
  }
}
