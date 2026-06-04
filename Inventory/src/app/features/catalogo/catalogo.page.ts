import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
  IonButton, IonSearchbar, IonBadge,
} from '@ionic/angular/standalone';
import { DataService } from '../../core/services/data.service';
import { TenantContextService } from '../../core/services/tenant-context.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { ToastService } from '../../shared/components/toast/toast.service';
import { ProductoFormModalComponent } from './producto-form-modal.component';
import { BulkImportModalComponent, BulkImportConfig } from '../../shared/components/bulk-import/bulk-import-modal.component';
import { Product, Unit } from '../../core/models';
import { UNITS } from '../../core/units';

const VALID_UNITS = new Set<string>(UNITS.map(u => u.value));

@Component({
  selector: 'app-catalogo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
    IonButton, IonSearchbar, IonBadge,
    PageHeaderComponent, EmptyStateComponent, ConfirmDialogComponent, ProductoFormModalComponent,
    BulkImportModalComponent,
  ],
  templateUrl: './catalogo.page.html',
  styleUrls: ['./catalogo.page.scss'],
})
export class CatalogoPage {
  protected readonly data = inject(DataService);
  protected readonly tenant = inject(TenantContextService);
  private readonly toast = inject(ToastService);

  readonly query = signal('');
  readonly modalOpen = signal(false);
  readonly productoEdit = signal<Product | null>(null);
  readonly confirmOpen = signal(false);
  readonly productoAEliminar = signal<Product | null>(null);
  readonly bulkOpen = signal(false);

  readonly bulkConfig: BulkImportConfig<Omit<Product, 'id'>> = {
    entityLabel: 'producto',
    entityLabelPlural: 'productos',
    templateFilename: 'plantilla-productos.csv',
    headers: [
      'sku', 'nombre', 'descripcion', 'categoria', 'unidad',
      'precio_compra', 'otros', 'lead_time_dias', 'usa_receta',
      'punto_reorden', 'stock_min',
    ],
    templateRows: [
      ['PROD-XXX-001', 'Pan Especial', 'Pan artesanal con masa madre', 'Panes', 'unidad', '300', '50', '1', 'true', '', ''],
      ['PROD-XXX-002', 'Bebida 500ml', '', 'Bebidas', 'unidad', '500', '0', '7', 'false', '20', '5'],
    ],
    hint: `Columnas obligatorias: sku, nombre, unidad, precio_compra, lead_time_dias, usa_receta.
Opcionales: descripcion, categoria, otros, punto_reorden, stock_min.
otros: mano de obra y otros costos (se suma al costo). Default 0.
El precio de venta se configura en Ventas (catálogo de ventas), no en este archivo.
Unidades válidas: ${[...VALID_UNITS].join(', ')}.
usa_receta: true/false/1/0/sí/no — productos fabricados (true) consumen insumos según receta;
productos de reventa (false) admiten punto_reorden y stock_min para alertas automáticas.
Debe cumplirse stock_min ≤ punto_reorden. SKU único.`,
    process: (rows) => {
      const existing = new Set(this.data.products().map(p => p.sku.toLowerCase()));
      const seen = new Set<string>();
      const valid: Omit<Product, 'id'>[] = [];
      const errors: { row: number; raw: Record<string, string>; message: string }[] = [];
      rows.forEach((r, i) => {
        const rowNum = i + 2;
        const sku = (r['sku'] ?? '').trim();
        const nombre = (r['nombre'] ?? '').trim();
        const unidad = (r['unidad'] ?? '').trim();
        const buy = Number(r['precio_compra']);
        const otrosRaw = (r['otros'] ?? '').trim();
        const otros = otrosRaw === '' ? 0 : Number(otrosRaw);
        const lead = Number(r['lead_time_dias']);
        const usa = (r['usa_receta'] ?? '').trim().toLowerCase();
        if (!sku) { errors.push({ row: rowNum, raw: r, message: 'SKU vacío' }); return; }
        if (!nombre) { errors.push({ row: rowNum, raw: r, message: 'Nombre vacío' }); return; }
        if (!unidad) { errors.push({ row: rowNum, raw: r, message: 'Unidad vacía' }); return; }
        if (!VALID_UNITS.has(unidad)) {
          errors.push({ row: rowNum, raw: r, message: `Unidad "${unidad}" no válida. Usa: ${[...VALID_UNITS].join(', ')}` });
          return;
        }
        if (existing.has(sku.toLowerCase())) { errors.push({ row: rowNum, raw: r, message: 'SKU ya existe en catálogo' }); return; }
        if (seen.has(sku.toLowerCase())) { errors.push({ row: rowNum, raw: r, message: 'SKU duplicado en el archivo' }); return; }
        if (!isFinite(buy) || buy < 0) { errors.push({ row: rowNum, raw: r, message: 'Precio compra inválido' }); return; }
        if (!isFinite(otros) || otros < 0) { errors.push({ row: rowNum, raw: r, message: 'Otros (costo) inválido' }); return; }
        if (!isFinite(lead) || lead < 0) { errors.push({ row: rowNum, raw: r, message: 'Lead time inválido' }); return; }
        if (usa && !['true', 'false', '1', '0', 'sí', 'si', 'no'].includes(usa)) {
          { errors.push({ row: rowNum, raw: r, message: 'usa_receta debe ser true/false' }); return; }
        }
        const hasRecipe = ['true', '1', 'sí', 'si'].includes(usa);
        let rop: number | undefined;
        let ms: number | undefined;
        if (!hasRecipe) {
          const ropRaw = (r['punto_reorden'] ?? '').trim();
          const msRaw = (r['stock_min'] ?? '').trim();
          if (ropRaw) {
            const n = Number(ropRaw);
            if (!isFinite(n) || n < 0) { errors.push({ row: rowNum, raw: r, message: 'punto_reorden inválido' }); return; }
            rop = n;
          }
          if (msRaw) {
            const n = Number(msRaw);
            if (!isFinite(n) || n < 0) { errors.push({ row: rowNum, raw: r, message: 'stock_min inválido' }); return; }
            ms = n;
          }
          if (rop != null && ms != null && ms > rop) {
            errors.push({ row: rowNum, raw: r, message: 'stock_min no puede ser mayor a punto_reorden' });
            return;
          }
        }
        seen.add(sku.toLowerCase());
        valid.push({
          sku,
          name: nombre,
          description: (r['descripcion'] ?? '').trim() || undefined,
          category: (r['categoria'] ?? '').trim() || undefined,
          unit: unidad as Unit,
          buyPrice: buy,
          otherCost: otros,
          sellPrice: 0, // El precio de venta se fija en Ventas (catálogo de ventas).
          leadTime: lead,
          active: true,
          hasRecipe,
          reorderPoint: rop,
          minStock: ms,
        });
      });
      return { valid, errors };
    },
    commit: (valid) => this.data.createProductsBulk(valid),
  };

  readonly visibles = computed(() => {
    const q = this.query().toLowerCase();
    return this.data.activeProducts()
      .filter(p => !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
  });

  readonly confirmMessage = computed(() => {
    const p = this.productoAEliminar();
    if (!p) return '';
    return `Vas a archivar "${p.name}". Su receta y stock asociado también se eliminarán. Esta acción no se puede deshacer.`;
  });

  /**
   * Costo efectivo del producto. Si tiene receta, lo calcula desde insumos
   * (reactivo: refleja cambios de costo de insumo sin guardar el producto).
   * Si es reventa, devuelve buyPrice almacenado.
   */
  effectiveCost(p: Product): number {
    return this.data.effectiveProductCost(p.id);
  }

  abrirNuevo() {
    this.productoEdit.set(null);
    this.modalOpen.set(true);
  }

  abrirEditar(p: Product) {
    this.productoEdit.set(p);
    this.modalOpen.set(true);
  }

  cerrarModal() {
    this.modalOpen.set(false);
    this.productoEdit.set(null);
  }

  pedirEliminar(p: Product) {
    this.productoAEliminar.set(p);
    this.confirmOpen.set(true);
  }

  async eliminar() {
    const p = this.productoAEliminar();
    if (!p) return;
    this.data.deleteProduct(p.id);
    this.confirmOpen.set(false);
    this.productoAEliminar.set(null);
    await this.toast.show(`Producto "${p.name}" eliminado.`, 'success');
  }
}
