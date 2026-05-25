import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
  IonButton, IonSearchbar,
} from '@ionic/angular/standalone';
import { DataService } from '../../core/services/data.service';
import { TenantContextService } from '../../core/services/tenant-context.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { ToastService } from '../../shared/components/toast/toast.service';
import { InsumoFormModalComponent } from './insumo-form-modal.component';
import { BulkImportModalComponent, BulkImportConfig } from '../../shared/components/bulk-import/bulk-import-modal.component';
import { Supply, StockStatus, Unit } from '../../core/models';
import { UNITS } from '../../core/units';

const VALID_UNITS = new Set<string>(UNITS.map(u => u.value));

@Component({
  selector: 'app-insumos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
    IonButton, IonSearchbar,
    PageHeaderComponent, StatusBadgeComponent, ConfirmDialogComponent, InsumoFormModalComponent,
    BulkImportModalComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-menu-button></ion-menu-button></ion-buttons>
        <ion-title>Insumos</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <app-page-header
        title="Insumos"
        subtitle="Materias primas que compras a proveedores. Paso 2 del flujo.">
        @if (tenant.canEditSupplies()) {
          <ion-button fill="outline" (click)="bulkOpen.set(true)">↥ Importar CSV</ion-button>
          <ion-button (click)="abrirNuevo()">+ Nuevo insumo</ion-button>
        }
      </app-page-header>

      <div class="filters">
        <ion-searchbar
          [value]="query()"
          (ionInput)="query.set($any($event.detail.value) ?? '')"
          placeholder="Buscar por nombre, SKU o categoría"
          mode="md">
        </ion-searchbar>
      </div>

      <div class="grid">
        @for (item of visibles(); track item.supply.id) {
          <article class="card">
            <header class="card__head">
              <div>
                <div class="card__cat">{{ item.supply.category ?? 'Sin categoría' }}</div>
                <h3 class="card__title">{{ item.supply.name }}</h3>
                <div class="card__sku mono">{{ item.supply.sku }}</div>
              </div>
              <app-status-badge [status]="item.worstStatus"></app-status-badge>
            </header>

            <div class="card__row">
              @if (tenant.canEditSupplies()) {
                <div class="card__cell">
                  <div class="card__label">Costo unitario</div>
                  <div class="card__value mono">₡{{ item.supply.cost | number:'1.0-0' }}</div>
                </div>
              }
              <div class="card__cell">
                <div class="card__label">P. reorden</div>
                <div class="card__value mono">{{ item.supply.reorderPoint }} {{ item.supply.unit }}</div>
              </div>
              <div class="card__cell">
                <div class="card__label">Mín / Máx</div>
                <div class="card__value mono">{{ item.supply.minStock }} / {{ item.supply.maxStock }}</div>
              </div>
              <div class="card__cell">
                <div class="card__label">Lead time</div>
                <div class="card__value mono">{{ item.supply.leadTime }} días</div>
              </div>
            </div>

            <div class="card__stocks">
              <div class="card__label">Stock actual</div>
              <div class="stock-row">
                <span class="stock-row__qty mono">{{ item.quantity | number:'1.0-3' }} {{ item.supply.unit }}</span>
                <app-status-badge [status]="item.status"></app-status-badge>
              </div>
            </div>

            @if (item.supply.supplier) {
              <div class="card__footer">
                Proveedor: <strong>{{ item.supply.supplier }}</strong>
              </div>
            }

            @if (tenant.canEditSupplies()) {
              <div class="card__actions">
                <ion-button size="small" fill="clear" class="ghost" (click)="abrirEditar(item.supply)">
                  Editar
                </ion-button>
                <ion-button size="small" color="danger" (click)="pedirEliminar(item.supply)">
                  Eliminar
                </ion-button>
              </div>
            }
          </article>
        }
      </div>

      <app-insumo-form-modal
        [isOpen]="modalOpen()"
        [editing]="insumoEdit()"
        (closed)="cerrarModal()"
        (saved)="cerrarModal()">
      </app-insumo-form-modal>

      <app-confirm-dialog
        [isOpen]="confirmOpen()"
        title="Eliminar insumo"
        [message]="confirmMessage()"
        tone="danger"
        confirmLabel="Sí, eliminar"
        (confirmed)="eliminar()"
        (cancelled)="confirmOpen.set(false)">
      </app-confirm-dialog>

      <app-bulk-import-modal
        [isOpen]="bulkOpen()"
        [config]="bulkConfig"
        (closed)="bulkOpen.set(false)">
      </app-bulk-import-modal>
    </ion-content>
  `,
  styles: [`
    .filters { padding: 0 var(--ui-sp-4) var(--ui-sp-4); }
    ion-searchbar { --background: var(--ui-surface); padding: 0; }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: var(--ui-sp-3);
      padding: 0 var(--ui-sp-4) var(--ui-sp-8);
    }
    .card {
      background: var(--ui-surface-2);
      border: var(--ui-border-w-md) solid var(--ui-border);
      box-shadow: var(--ui-shadow-md);
      padding: var(--ui-sp-4);
    }
    .card__head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: var(--ui-sp-3);
      margin-bottom: var(--ui-sp-3);
    }
    .card__cat {
      font-size: var(--ui-fs-xs);
      font-weight: var(--ui-fw-bold);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--ui-text-muted);
    }
    .card__title {
      font-family: var(--ui-font-display);
      font-weight: var(--ui-fw-black);
      font-size: var(--ui-fs-lg);
      line-height: var(--ui-lh-tight);
      margin: 0;
    }
    .card__sku { font-size: var(--ui-fs-xs); color: var(--ui-text-muted); }
    .card__row {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: var(--ui-sp-2);
      margin-bottom: var(--ui-sp-3);
      padding-bottom: var(--ui-sp-3);
      border-bottom: var(--ui-border-w-sm) solid var(--ui-border);
    }
    .card__label {
      font-size: var(--ui-fs-xs);
      color: var(--ui-text-muted);
      font-weight: var(--ui-fw-medium);
    }
    .card__value { font-size: var(--ui-fs-sm); font-weight: var(--ui-fw-bold); }
    .card__stocks { display: grid; gap: 6px; }
    .stock-row {
      display: flex;
      gap: var(--ui-sp-2);
      align-items: center;
      justify-content: space-between;
      padding: 4px 0;
      font-size: var(--ui-fs-sm);
    }
    .stock-row__qty { font-weight: var(--ui-fw-bold); }
    .card__footer {
      margin-top: var(--ui-sp-3);
      padding-top: var(--ui-sp-2);
      border-top: var(--ui-border-w-sm) solid var(--ui-border);
      font-size: var(--ui-fs-xs);
      color: var(--ui-text-muted);
    }
    .card__actions {
      display: flex;
      gap: var(--ui-sp-2);
      justify-content: flex-end;
      margin-top: var(--ui-sp-3);
      padding-top: var(--ui-sp-2);
      border-top: var(--ui-border-w-sm) solid var(--ui-border);
    }
  `],
})
export class InsumosPage {
  protected readonly data = inject(DataService);
  protected readonly tenant = inject(TenantContextService);
  private readonly toast = inject(ToastService);

  readonly query = signal('');
  readonly modalOpen = signal(false);
  readonly insumoEdit = signal<Supply | null>(null);
  readonly confirmOpen = signal(false);
  readonly insumoAEliminar = signal<Supply | null>(null);
  readonly bulkOpen = signal(false);

  readonly bulkConfig: BulkImportConfig<Omit<Supply, 'id'>> = {
    entityLabel: 'insumo',
    entityLabelPlural: 'insumos',
    templateFilename: 'plantilla-insumos.csv',
    headers: [
      'sku', 'nombre', 'descripcion', 'categoria', 'unidad', 'costo',
      'stock_min', 'stock_max', 'punto_reorden', 'lead_time_dias', 'proveedor',
    ],
    templateRows: [
      ['INS-XXX-001', 'Harina especial', 'Harina 000 panadería', 'Cereales', 'kg', '900', '20', '200', '50', '3', 'Molinos del Sur'],
      ['INS-XXX-002', 'Azúcar morena', '', 'Endulzantes', 'kg', '1100', '10', '100', '25', '2', 'IANSA'],
      ['INS-XXX-003', 'Vainilla líquida', 'Esencia natural 250ml', 'Aromas', 'ml', '8500', '500', '5000', '1500', '5', ''],
    ],
    hint: `Columnas obligatorias: sku, nombre, unidad, costo, stock_min, stock_max, punto_reorden, lead_time_dias.
Opcionales: descripcion, categoria, proveedor.
Unidades válidas: ${[...VALID_UNITS].join(', ')}.
SKU debe ser único. Debe cumplirse stock_min ≤ punto_reorden ≤ stock_max.
"proveedor" se intenta vincular por nombre exacto con los proveedores registrados; si no existe se guarda como texto libre.`,
    process: (rows) => {
      const existing = new Set(this.data.supplies().map(s => s.sku.toLowerCase()));
      const seen = new Set<string>();
      const suppliersByName = new Map(this.data.suppliers().map(s => [s.name.toLowerCase(), s]));
      const valid: Omit<Supply, 'id'>[] = [];
      const errors: { row: number; raw: Record<string, string>; message: string }[] = [];
      rows.forEach((r, i) => {
        const rowNum = i + 2;
        const sku = (r['sku'] ?? '').trim();
        const nombre = (r['nombre'] ?? '').trim();
        const unidad = (r['unidad'] ?? '').trim();
        const costo = Number(r['costo']);
        const min = Number(r['stock_min']);
        const max = Number(r['stock_max']);
        const rop = Number(r['punto_reorden']);
        const lead = Number(r['lead_time_dias']);
        if (!sku) { errors.push({ row: rowNum, raw: r, message: 'SKU vacío' }); return; }
        if (!nombre) { errors.push({ row: rowNum, raw: r, message: 'Nombre vacío' }); return; }
        if (!unidad) { errors.push({ row: rowNum, raw: r, message: 'Unidad vacía' }); return; }
        if (!VALID_UNITS.has(unidad)) {
          errors.push({ row: rowNum, raw: r, message: `Unidad "${unidad}" no válida. Usa: ${[...VALID_UNITS].join(', ')}` });
          return;
        }
        if (existing.has(sku.toLowerCase())) { errors.push({ row: rowNum, raw: r, message: 'SKU ya existe' }); return; }
        if (seen.has(sku.toLowerCase())) { errors.push({ row: rowNum, raw: r, message: 'SKU duplicado en el archivo' }); return; }
        if (!isFinite(costo) || costo < 0) { errors.push({ row: rowNum, raw: r, message: 'Costo inválido (debe ser número ≥ 0)' }); return; }
        if (!isFinite(min) || min < 0) { errors.push({ row: rowNum, raw: r, message: 'stock_min inválido (debe ser número ≥ 0)' }); return; }
        if (!isFinite(max) || max <= 0) { errors.push({ row: rowNum, raw: r, message: 'stock_max inválido (debe ser número > 0)' }); return; }
        if (!isFinite(rop) || rop < 0) { errors.push({ row: rowNum, raw: r, message: 'punto_reorden inválido (debe ser número ≥ 0)' }); return; }
        if (!isFinite(lead) || lead < 0) { errors.push({ row: rowNum, raw: r, message: 'lead_time_dias inválido (debe ser número ≥ 0)' }); return; }
        if (!(min <= rop && rop <= max)) {
          errors.push({ row: rowNum, raw: r, message: `Debe cumplirse stock_min(${min}) ≤ punto_reorden(${rop}) ≤ stock_max(${max})` });
          return;
        }
        seen.add(sku.toLowerCase());
        const proveedorText = (r['proveedor'] ?? '').trim();
        const matched = proveedorText ? suppliersByName.get(proveedorText.toLowerCase()) : undefined;
        valid.push({
          sku,
          name: nombre,
          description: (r['descripcion'] ?? '').trim() || undefined,
          category: (r['categoria'] ?? '').trim() || undefined,
          unit: unidad as Unit,
          cost: costo,
          minStock: min,
          maxStock: max,
          reorderPoint: rop,
          leadTime: lead,
          supplier: proveedorText || undefined,
          supplierId: matched?.id,
          active: true,
        });
      });
      return { valid, errors };
    },
    commit: (valid) => this.data.createSuppliesBulk(valid),
  };

  readonly visibles = computed(() => {
    const q = this.query().toLowerCase();
    return this.data.activeSupplies()
      .filter(s => !q || s.name.toLowerCase().includes(q) || s.sku.toLowerCase().includes(q) || (s.category ?? '').toLowerCase().includes(q))
      .map(supply => {
        const stock = this.data.supplyStockFor(supply.id);
        return {
          supply,
          quantity: stock?.quantity ?? 0,
          status: stock?.status ?? ('out' as StockStatus),
          worstStatus: stock?.status ?? ('out' as StockStatus),
        };
      });
  });

  readonly confirmMessage = computed(() => {
    const s = this.insumoAEliminar();
    if (!s) return '';
    return `Vas a archivar "${s.name}". El stock asociado se eliminará. El historial del kardex se mantiene para auditoría.`;
  });

  abrirNuevo() {
    this.insumoEdit.set(null);
    this.modalOpen.set(true);
  }
  abrirEditar(s: Supply) {
    this.insumoEdit.set(s);
    this.modalOpen.set(true);
  }
  cerrarModal() {
    this.modalOpen.set(false);
    this.insumoEdit.set(null);
  }
  pedirEliminar(s: Supply) {
    this.insumoAEliminar.set(s);
    this.confirmOpen.set(true);
  }
  async eliminar() {
    const s = this.insumoAEliminar();
    if (!s) return;
    this.data.deleteSupply(s.id);
    this.confirmOpen.set(false);
    this.insumoAEliminar.set(null);
    await this.toast.show(`Insumo "${s.name}" eliminado.`, 'success');
  }
}
