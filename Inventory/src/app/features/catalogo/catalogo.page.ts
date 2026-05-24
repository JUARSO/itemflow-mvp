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
import { Product } from '../../core/models';

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
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-menu-button></ion-menu-button></ion-buttons>
        <ion-title>Catálogo</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <app-page-header
        title="Catálogo"
        subtitle="Productos terminados que vende tu negocio. Paso 1 del flujo.">
        @if (tenant.isAdmin()) {
          <ion-button fill="outline" (click)="bulkOpen.set(true)">↥ Importar CSV</ion-button>
          <ion-button (click)="abrirNuevo()">+ Nuevo producto</ion-button>
        }
      </app-page-header>

      <div class="filters">
        <ion-searchbar
          [value]="query()"
          (ionInput)="query.set($any($event.detail.value) ?? '')"
          placeholder="Buscar por nombre o SKU"
          mode="md">
        </ion-searchbar>
      </div>

      @if (visibles().length === 0 && data.activeProducts().length === 0) {
        <app-empty-state
          icon="📋"
          title="No hay productos en el catálogo"
          body="Empieza agregando los productos que vendes. Sin catálogo no puedes registrar ventas ni recetas."
          ctaLabel="Agregar primer producto"
          (ctaClick)="abrirNuevo()">
        </app-empty-state>
      } @else {
        <div class="grid">
          @for (p of visibles(); track p.id) {
            <article class="card" [class.archived]="!p.active">
              <header class="card__head">
                <div class="card__cat">{{ p.category ?? 'Sin categoría' }}</div>
                @if (p.hasRecipe) {
                  <ion-badge color="primary">Con receta</ion-badge>
                } @else {
                  <ion-badge color="medium">Reventa</ion-badge>
                }
              </header>
              <h3 class="card__title">{{ p.name }}</h3>
              <div class="card__sku mono">{{ p.sku }}</div>
              <div class="card__row">
                <div class="card__cell">
                  <div class="card__label">Precio venta</div>
                  <div class="card__value mono">\${{ p.sellPrice | number:'1.0-0' }}</div>
                </div>
                @if (tenant.isAdmin()) {
                  <div class="card__cell">
                    <div class="card__label">
                      Costo
                      @if (p.hasRecipe) { <span class="card__tag">receta</span> }
                    </div>
                    <div class="card__value mono">\${{ effectiveCost(p) | number:'1.0-0' }}</div>
                  </div>
                  <div class="card__cell">
                    <div class="card__label">Margen</div>
                    <div class="card__value mono">{{ margen(p.sellPrice, effectiveCost(p)) }}%</div>
                  </div>
                }
              </div>
              @if (tenant.isAdmin()) {
                <div class="card__actions">
                  <ion-button size="small" fill="clear" class="ghost" (click)="abrirEditar(p)">
                    Editar
                  </ion-button>
                  <ion-button size="small" color="danger" (click)="pedirEliminar(p)">
                    Eliminar
                  </ion-button>
                </div>
              }
            </article>
          }
        </div>
      }

      <app-producto-form-modal
        [isOpen]="modalOpen()"
        [editing]="productoEdit()"
        (closed)="cerrarModal()"
        (saved)="cerrarModal()">
      </app-producto-form-modal>

      <app-confirm-dialog
        [isOpen]="confirmOpen()"
        title="Eliminar producto"
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
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: var(--ui-sp-3);
      padding: 0 var(--ui-sp-4) var(--ui-sp-8);
    }
    .card {
      background: var(--ui-surface-2);
      border: var(--ui-border-w-md) solid var(--ui-border);
      box-shadow: var(--ui-shadow-md);
      padding: var(--ui-sp-4);
      display: flex;
      flex-direction: column;
      gap: var(--ui-sp-2);
    }
    .card.archived { opacity: 0.5; }
    .card__head { display: flex; justify-content: space-between; align-items: center; }
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
      margin-top: var(--ui-sp-2);
      padding-top: var(--ui-sp-2);
      border-top: var(--ui-border-w-sm) solid var(--ui-border);
    }
    .card__cell { min-width: 0; }
    .card__label {
      font-size: var(--ui-fs-xs);
      color: var(--ui-text-muted);
      font-weight: var(--ui-fw-medium);
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .card__tag {
      font-size: 9px;
      font-weight: var(--ui-fw-bold);
      padding: 1px 6px;
      background: var(--ui-warning-tint);
      color: var(--ui-warning);
      border-radius: var(--ui-radius-pill);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .card__value { font-size: var(--ui-fs-md); font-weight: var(--ui-fw-bold); }
    .card__actions {
      display: flex;
      gap: var(--ui-sp-2);
      justify-content: flex-end;
      margin-top: var(--ui-sp-2);
      padding-top: var(--ui-sp-2);
      border-top: var(--ui-border-w-sm) solid var(--ui-border);
    }
  `],
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
    headers: ['sku', 'nombre', 'categoria', 'unidad', 'precio_compra', 'precio_venta', 'lead_time_dias', 'usa_receta', 'punto_reorden', 'stock_min'],
    templateRows: [
      ['PROD-XXX-001', 'Pan Especial', 'Panes', 'unidad', '300', '900', '1', 'true', '', ''],
      ['PROD-XXX-002', 'Bebida 500ml', 'Bebidas', 'unidad', '500', '1200', '7', 'false', '20', '5'],
    ],
    hint: 'punto_reorden y stock_min son OPCIONALES y solo aplican a productos de reventa (usa_receta=false). Disparan alertas automáticas de restock cuando el stock baja.',
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
        const sell = Number(r['precio_venta']);
        const lead = Number(r['lead_time_dias']);
        const usa = (r['usa_receta'] ?? '').trim().toLowerCase();
        if (!sku) { errors.push({ row: rowNum, raw: r, message: 'SKU vacío' }); return; }
        if (!nombre) { errors.push({ row: rowNum, raw: r, message: 'Nombre vacío' }); return; }
        if (!unidad) { errors.push({ row: rowNum, raw: r, message: 'Unidad vacía' }); return; }
        if (existing.has(sku.toLowerCase())) { errors.push({ row: rowNum, raw: r, message: 'SKU ya existe en catálogo' }); return; }
        if (seen.has(sku.toLowerCase())) { errors.push({ row: rowNum, raw: r, message: 'SKU duplicado en el archivo' }); return; }
        if (!isFinite(buy) || buy < 0) { errors.push({ row: rowNum, raw: r, message: 'Precio compra inválido' }); return; }
        if (!isFinite(sell) || sell < 0) { errors.push({ row: rowNum, raw: r, message: 'Precio venta inválido' }); return; }
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
          category: (r['categoria'] ?? '').trim() || undefined,
          unit: unidad,
          buyPrice: buy,
          sellPrice: sell,
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

  margen(sell: number, buy: number): string {
    if (sell === 0) return '0';
    return (((sell - buy) / sell) * 100).toFixed(0);
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
