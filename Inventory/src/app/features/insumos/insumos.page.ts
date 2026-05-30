import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
  IonButton, IonSearchbar, IonIcon,
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
    DatePipe, DecimalPipe, RouterLink,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
    IonButton, IonSearchbar, IonIcon,
    PageHeaderComponent, StatusBadgeComponent, ConfirmDialogComponent, InsumoFormModalComponent,
    BulkImportModalComponent,
  ],
  templateUrl: './insumos.page.html',
  styleUrls: ['./insumos.page.scss'],
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
      'stock_min', 'stock_max', 'punto_reorden', 'proveedor',
    ],
    templateRows: [
      ['INS-XXX-001', 'Harina especial', 'Harina 000 panadería', 'Cereales', 'kg', '900', '20', '200', '50', 'Molinos del Sur'],
      ['INS-XXX-002', 'Azúcar morena', '', 'Endulzantes', 'kg', '1100', '10', '100', '25', 'IANSA'],
      ['INS-XXX-003', 'Vainilla líquida', 'Esencia natural 250ml', 'Aromas', 'ml', '8500', '500', '5000', '1500', ''],
    ],
    hint: `Columnas obligatorias: sku, nombre, unidad, costo, stock_min, stock_max, punto_reorden, proveedor.
Opcionales: descripcion, categoria.
Unidades válidas: ${[...VALID_UNITS].join(', ')}.
SKU debe ser único. Debe cumplirse stock_min ≤ punto_reorden ≤ stock_max.
"proveedor" debe coincidir EXACTAMENTE con el nombre de un proveedor ya registrado (todo insumo necesita al menos uno).`,
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
        if (!(min <= rop && rop <= max)) {
          errors.push({ row: rowNum, raw: r, message: `Debe cumplirse stock_min(${min}) ≤ punto_reorden(${rop}) ≤ stock_max(${max})` });
          return;
        }
        const proveedorText = (r['proveedor'] ?? '').trim();
        if (!proveedorText) {
          errors.push({ row: rowNum, raw: r, message: 'Proveedor vacío (obligatorio)' });
          return;
        }
        const matched = suppliersByName.get(proveedorText.toLowerCase());
        if (!matched) {
          errors.push({
            row: rowNum,
            raw: r,
            message: `Proveedor "${proveedorText}" no existe. Crealo primero en Proveedores con nombre exacto.`,
          });
          return;
        }
        seen.add(sku.toLowerCase());
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
          supplier: proveedorText,
          supplierId: matched.id,
          active: true,
        });
      });
      return { valid, errors };
    },
    commit: (valid) => {
      const created = this.data.createSuppliesBulk(valid);
      // Vincular cada insumo creado al proveedor que vino en el CSV.
      created.forEach((s, i) => {
        const supplierId = valid[i].supplierId;
        if (supplierId) {
          this.data.setSuppliersForSupply(s.id, [{ supplierId, unitCost: s.cost }]);
        }
      });
    },
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

  /** Proveedores que entregan un insumo (relación N..M en Supplier.suppliedItems). */
  suppliersOf(supplyId: string) {
    return this.data.suppliersForSupply(supplyId);
  }

  /**
   * Lead time DINÁMICO del insumo: del proveedor que entrega antes desde
   * hoy, calculado contra su calendario semanal. null si el insumo no
   * tiene proveedores.
   */
  leadTimeOf(supplyId: string) {
    return this.data.supplyLeadTime(supplyId);
  }

  leadTimeSupplierName(supplierId: string): string {
    return this.data.supplierById(supplierId)?.name ?? '—';
  }

  /** OCs pending que traen este insumo, con cantidad y fecha esperada. */
  pendingPOs(supplyId: string) {
    return this.data.pendingPOsForSupply(supplyId);
  }

  /** Total de unidades en camino para un insumo (suma de las OCs pendientes). */
  totalIncoming(pos: { qty: number }[]): number {
    return pos.reduce((s, p) => s + p.qty, 0);
  }

  /** true si la fecha esperada ya pasó (OC atrasada). */
  isOverdue(d: Date): boolean {
    const t = new Date(); t.setHours(0, 0, 0, 0);
    return d.getTime() < t.getTime();
  }

  /**
   * Formatea una cantidad (en unidad base) según la presentación del insumo.
   * - Con presentación: "3 sacos" (o "5.5 sacos" si no es entero).
   * - Sin presentación: "75 kg" usando la unidad base.
   * Si `whole = true`, fuerza redondeo a entero (útil para min/max).
   */
  presentationOf(s: Supply, baseQty: number, whole = false): string {
    if (s.presentation && s.presentation.size > 0) {
      const n = baseQty / s.presentation.size;
      const display = whole ? Math.round(n) : Math.round(n * 100) / 100;
      return `${display} ${this.pluralLabel(s.presentation.label, display)}`;
    }
    return `${baseQty} ${s.unit}`;
  }

  /** Texto descriptivo de la presentación: "1 saco = 25 kg". */
  presentationDetail(s: Supply): string {
    if (!s.presentation) return '';
    return `1 ${s.presentation.label} = ${s.presentation.size} ${s.unit}`;
  }

  private pluralLabel(label: string, n: number): string {
    if (n === 1) return label;
    return label.endsWith('s') ? label : label + 's';
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
