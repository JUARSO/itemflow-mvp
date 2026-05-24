import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
  IonButton, IonSegment, IonSegmentButton, IonLabel,
} from '@ionic/angular/standalone';
import { DataService } from '../../core/services/data.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { VentaFormModalComponent } from './venta-form-modal.component';
import { BulkImportModalComponent, BulkImportConfig } from '../../shared/components/bulk-import/bulk-import-modal.component';
import { SaleRecord } from '../../core/models';

type Range = '7d' | '30d' | 'todo';

@Component({
  selector: 'app-ventas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, DecimalPipe,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
    IonButton, IonSegment, IonSegmentButton, IonLabel,
    PageHeaderComponent, KpiCardComponent, VentaFormModalComponent,
    BulkImportModalComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-menu-button></ion-menu-button></ion-buttons>
        <ion-title>Ventas</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <app-page-header
        title="Ventas"
        subtitle="Histórico de ventas. Alimenta la predicción de demanda.">
        <ion-button fill="outline" (click)="bulkOpen.set(true)">↥ Importar CSV histórico</ion-button>
        <ion-button (click)="modalOpen.set(true)">+ Registrar venta</ion-button>
      </app-page-header>

      <div class="kpis">
        <app-kpi-card label="Ventas" [value]="visibles().length" tone="primary"></app-kpi-card>
        <app-kpi-card label="Total" [value]="'$' + (totalIngresos() | number:'1.0-0')" tone="success"></app-kpi-card>
        <app-kpi-card label="Unidades" [value]="totalUnidades()" tone="transit"></app-kpi-card>
      </div>

      <div class="tabs">
        <ion-segment [value]="range()" (ionChange)="range.set($any($event.detail.value))">
          <ion-segment-button value="7d"><ion-label>7 días</ion-label></ion-segment-button>
          <ion-segment-button value="30d"><ion-label>30 días</ion-label></ion-segment-button>
          <ion-segment-button value="todo"><ion-label>Todo</ion-label></ion-segment-button>
        </ion-segment>
      </div>

      <div class="table">
        <div class="table__head">
          <div>Fecha</div>
          <div>Producto</div>
          <div class="num">Cantidad</div>
          <div class="num">P. Unit.</div>
          <div class="num">Total</div>
        </div>
        @for (s of visibles(); track s.id) {
          <div class="table__row">
            <div class="mono">{{ s.date | date:'dd-MM HH:mm' }}</div>
            <div>{{ s.productName }}</div>
            <div class="num mono">{{ s.qty | number:'1.0-0' }}</div>
            <div class="num mono">\${{ s.unitPrice | number:'1.0-0' }}</div>
            <div class="num mono"><strong>\${{ s.total | number:'1.0-0' }}</strong></div>
          </div>
        }
      </div>

      <app-venta-form-modal
        [isOpen]="modalOpen()"
        (closed)="modalOpen.set(false)"
        (saved)="modalOpen.set(false)">
      </app-venta-form-modal>

      <app-bulk-import-modal
        [isOpen]="bulkOpen()"
        [config]="bulkConfig"
        (closed)="bulkOpen.set(false)">
      </app-bulk-import-modal>
    </ion-content>
  `,
  styles: [`
    .kpis {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--ui-sp-3);
      padding: 0 var(--ui-sp-4) var(--ui-sp-4);
    }
    @media (max-width: 900px) { .kpis { grid-template-columns: 1fr 1fr; } }
    @media (max-width: 480px) { .kpis { grid-template-columns: 1fr; } }

    .tabs { padding: 0 var(--ui-sp-4) var(--ui-sp-3); }

    .table {
      margin: 0 var(--ui-sp-4) var(--ui-sp-8);
      border: var(--ui-border-w-md) solid var(--ui-border);
      box-shadow: var(--ui-shadow-md);
      background: var(--ui-surface);
    }
    .table__head, .table__row {
      display: grid;
      grid-template-columns: 130px 1.5fr 90px 100px 120px;
      gap: var(--ui-sp-3);
      padding: var(--ui-sp-3) var(--ui-sp-4);
      align-items: center;
    }
    .table__head {
      background: var(--ui-text);
      color: var(--ui-surface);
      font-size: var(--ui-fs-xs);
      font-weight: var(--ui-fw-black);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .table__row { border-top: var(--ui-border-w-sm) solid var(--ui-border); font-size: var(--ui-fs-sm); }
    .table__row:hover { background: var(--ui-surface-3); }
    .num { text-align: right; }

    @media (max-width: 768px) {
      .table__head { display: none; }
      .table__row {
        grid-template-columns: 1fr 1fr;
        gap: 4px var(--ui-sp-2);
        padding: var(--ui-sp-3) var(--ui-sp-4);
        border-bottom: var(--ui-border-w-sm) solid var(--ui-border);
      }
      .num { text-align: left; font-size: var(--ui-fs-sm); }
    }
    @media (max-width: 380px) {
      .table__row { grid-template-columns: 1fr; }
    }
  `],
})
export class VentasPage {
  protected readonly data = inject(DataService);
  readonly range = signal<Range>('7d');
  readonly modalOpen = signal(false);
  readonly bulkOpen = signal(false);

  readonly bulkConfig: BulkImportConfig<SaleRecord> = {
    entityLabel: 'venta',
    entityLabelPlural: 'ventas',
    templateFilename: 'plantilla-ventas.csv',
    headers: ['fecha', 'producto_sku', 'cantidad', 'precio_unitario'],
    templateRows: [
      ['2026-05-15', 'PROD-BAG-001', '12', '1200'],
      ['2026-05-15', 'PROD-MAR-001', '40', '350'],
      ['2026-05-16', 'PROD-BAG-001', '8', '1200'],
    ],
    hint: 'Importa ventas históricas (NO afecta stock actual). Fecha en formato YYYY-MM-DD o ISO. El producto debe existir (busca por SKU).',
    process: (rows) => {
      const errors: { row: number; raw: Record<string, string>; message: string }[] = [];
      const valid: SaleRecord[] = [];
      const products = new Map(this.data.activeProducts().map(p => [p.sku.toLowerCase(), p]));
      const base = Date.now();
      rows.forEach((r, i) => {
        const rowNum = i + 2;
        const fechaStr = (r['fecha'] ?? '').trim();
        const prodSku = (r['producto_sku'] ?? '').trim();
        const qty = Number(r['cantidad']);
        const unitPrice = Number(r['precio_unitario']);
        if (!fechaStr) { errors.push({ row: rowNum, raw: r, message: 'Fecha vacía' }); return; }
        const date = new Date(fechaStr);
        if (isNaN(date.getTime())) { errors.push({ row: rowNum, raw: r, message: 'Fecha inválida (usa YYYY-MM-DD)' }); return; }
        if (!prodSku) { errors.push({ row: rowNum, raw: r, message: 'producto_sku vacío' }); return; }
        const prod = products.get(prodSku.toLowerCase());
        if (!prod) { errors.push({ row: rowNum, raw: r, message: `Producto con SKU "${prodSku}" no existe` }); return; }
        if (!isFinite(qty) || qty <= 0) { errors.push({ row: rowNum, raw: r, message: 'cantidad debe ser > 0' }); return; }
        if (!isFinite(unitPrice) || unitPrice < 0) { errors.push({ row: rowNum, raw: r, message: 'precio_unitario inválido' }); return; }
        valid.push({
          id: `sale-bulk-${base}-${i}`,
          productId: prod.id,
          productName: prod.name,
          qty,
          unitPrice,
          total: qty * unitPrice,
          dayOfWeek: date.getDay(),
          month: date.getMonth() + 1,
          date,
          isOutlier: false,
        });
      });
      return { valid, errors };
    },
    commit: (valid) => this.data.createSalesBulk(valid),
  };

  readonly visibles = computed(() => {
    const all = [...this.data.sales()].sort((a, b) => b.date.getTime() - a.date.getTime());
    const r = this.range();
    if (r === 'todo') return all;
    const days = r === '7d' ? 7 : 30;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return all.filter(s => s.date.getTime() >= cutoff);
  });

  readonly totalIngresos = computed(() => this.visibles().reduce((s, x) => s + x.total, 0));
  readonly totalUnidades = computed(() => this.visibles().reduce((s, x) => s + x.qty, 0));
}
