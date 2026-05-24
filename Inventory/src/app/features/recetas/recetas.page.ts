import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
  IonButton,
} from '@ionic/angular/standalone';
import { DataService } from '../../core/services/data.service';
import { TenantContextService } from '../../core/services/tenant-context.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { ToastService } from '../../shared/components/toast/toast.service';
import { RecetaFormModalComponent } from './receta-form-modal.component';
import { BulkImportModalComponent, BulkImportConfig } from '../../shared/components/bulk-import/bulk-import-modal.component';
import { Recipe, RecipeItem } from '../../core/models';

@Component({
  selector: 'app-recetas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
    IonButton,
    PageHeaderComponent, EmptyStateComponent, ConfirmDialogComponent, RecetaFormModalComponent,
    BulkImportModalComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-menu-button></ion-menu-button></ion-buttons>
        <ion-title>Recetas</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <app-page-header
        title="Recetas"
        subtitle="Cuántos insumos consume cada producto. Paso 3 del flujo.">
        @if (tenant.canEditRecipes()) {
          <ion-button fill="outline" (click)="bulkOpen.set(true)">↥ Importar CSV</ion-button>
          <ion-button (click)="abrirNuevo()">+ Nueva receta</ion-button>
        }
      </app-page-header>

      @if (data.recipes().length === 0) {
        <app-empty-state
          icon="📖"
          title="No hay recetas configuradas"
          body="Define cuántos insumos consume cada producto terminado. Al vender, la receta descuenta los insumos automáticamente."
          ctaLabel="Crear primera receta"
          (ctaClick)="abrirNuevo()">
        </app-empty-state>
      } @else {
        <div class="grid">
          @for (recipe of data.recipes(); track recipe.id) {
            <article class="card">
              <header class="card__head">
                <div>
                  <h3 class="card__title">{{ recipe.productName }}</h3>
                  <div class="card__yield">Rinde <strong class="mono">{{ recipe.yieldQty }}</strong> unidades</div>
                </div>
                @if (tenant.canEditRecipes()) {
                  <div class="card__cost mono">
                    <div>
                      Total corrida: <strong>₡{{ costoReceta(recipe.id) | number:'1.0-0' }}</strong>
                    </div>
                    <div class="card__cost-unit">
                      Por unidad: ₡{{ costoPorUnidad(recipe.productId) | number:'1.0-0' }}
                    </div>
                  </div>
                }
              </header>

              <div class="card__items">
                <div class="items__head">Insumos requeridos por corrida</div>
                @for (it of recipe.items; track $index) {
                  <div class="item-row">
                    <span class="item-row__name">{{ it.itemName }}</span>
                    <span class="item-row__qty mono">{{ it.qty | number:'1.0-3' }} {{ it.unit }}</span>
                  </div>
                }
              </div>

              @if (recipe.notes) {
                <div class="card__notes">
                  <div class="card__notes-label">Observaciones</div>
                  <p class="card__notes-text">{{ recipe.notes }}</p>
                </div>
              }

              @if (tenant.canEditRecipes()) {
                <div class="card__actions">
                  <ion-button size="small" fill="clear" class="ghost" (click)="abrirEditar(recipe)">
                    Editar
                  </ion-button>
                  <ion-button size="small" color="danger" (click)="pedirEliminar(recipe)">
                    Eliminar
                  </ion-button>
                </div>
              }
            </article>
          }
        </div>
      }

      <app-receta-form-modal
        [isOpen]="modalOpen()"
        [editing]="recetaEdit()"
        (closed)="cerrarModal()"
        (saved)="cerrarModal()">
      </app-receta-form-modal>

      <app-confirm-dialog
        [isOpen]="confirmOpen()"
        title="Eliminar receta"
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
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
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
      padding-bottom: var(--ui-sp-3);
      border-bottom: var(--ui-border-w-sm) solid var(--ui-border);
    }
    .card__title {
      font-family: var(--ui-font-display);
      font-weight: var(--ui-fw-black);
      font-size: var(--ui-fs-lg);
      margin: 0;
    }
    .card__yield { font-size: var(--ui-fs-sm); color: var(--ui-text-muted); margin-top: 4px; }
    .card__cost {
      font-size: var(--ui-fs-sm);
      font-weight: var(--ui-fw-bold);
      background: var(--ui-success-tint);
      padding: 6px 10px;
      border: var(--ui-border-w-sm) solid var(--ui-border);
      color: var(--ui-success);
      text-align: right;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .card__cost-unit {
      font-weight: var(--ui-fw-medium);
      font-size: var(--ui-fs-xs);
      color: var(--ui-text);
    }
    .items__head {
      font-size: var(--ui-fs-xs);
      font-weight: var(--ui-fw-bold);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--ui-text-muted);
      margin-bottom: var(--ui-sp-2);
    }
    .item-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      border-bottom: 1px dashed var(--ui-border);
      font-size: var(--ui-fs-sm);
    }
    .item-row:last-child { border-bottom: none; }
    .item-row__qty { font-weight: var(--ui-fw-bold); }

    .card__notes {
      margin-top: var(--ui-sp-3);
      padding: var(--ui-sp-2) var(--ui-sp-3);
      background: var(--ui-surface-2);
      border-left: 3px solid var(--ui-primary);
    }
    .card__notes-label {
      font-size: var(--ui-fs-xs);
      font-weight: var(--ui-fw-black);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--ui-text-muted);
      margin-bottom: 4px;
    }
    .card__notes-text {
      margin: 0;
      font-size: var(--ui-fs-sm);
      color: var(--ui-text);
      white-space: pre-wrap;
      line-height: 1.4;
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
export class RecetasPage {
  protected readonly data = inject(DataService);
  protected readonly tenant = inject(TenantContextService);
  private readonly toast = inject(ToastService);

  readonly modalOpen = signal(false);
  readonly recetaEdit = signal<Recipe | null>(null);
  readonly confirmOpen = signal(false);
  readonly recetaAEliminar = signal<Recipe | null>(null);
  readonly bulkOpen = signal(false);

  readonly bulkConfig: BulkImportConfig<Recipe> = {
    entityLabel: 'receta',
    entityLabelPlural: 'recetas',
    templateFilename: 'plantilla-recetas.csv',
    headers: ['producto_sku', 'rinde', 'tipo', 'componente_sku', 'cantidad'],
    templateRows: [
      ['PROD-BAG-001', '10', 'insumo', 'INS-HARINA-001', '1.5'],
      ['PROD-BAG-001', '10', 'insumo', 'INS-SAL-001', '0.03'],
      ['PROD-BAG-001', '10', 'insumo', 'INS-LEVADURA-001', '0.02'],
      ['PROD-SANDWICH-001', '1', 'subproducto', 'PROD-BAG-001', '1'],
      ['PROD-SANDWICH-001', '1', 'insumo', 'INS-QUESO-001', '0.05'],
    ],
    hint: 'Una fila por componente. Columna "tipo" acepta "insumo" o "subproducto" (default: insumo si está vacío). componente_sku busca el SKU según el tipo. El producto destino y los componentes deben existir.',
    process: (rows) => {
      const errors: { row: number; raw: Record<string, string>; message: string }[] = [];
      const products = new Map(this.data.activeProducts().map(p => [p.sku.toLowerCase(), p]));
      const supplies = new Map(this.data.activeSupplies().map(s => [s.sku.toLowerCase(), s]));

      // Agrupar filas por producto_sku
      const grouped = new Map<string, { yieldQty: number | null; items: RecipeItem[]; rowNums: number[] }>();
      rows.forEach((r, i) => {
        const rowNum = i + 2;
        const prodSku = (r['producto_sku'] ?? '').trim();
        // Backward-compat: si no hay componente_sku, leer del campo viejo insumo_sku.
        const compSku = (r['componente_sku'] ?? r['insumo_sku'] ?? '').trim();
        const tipo = (r['tipo'] ?? 'insumo').trim().toLowerCase();
        const rinde = Number(r['rinde']);
        const cantidad = Number(r['cantidad']);
        if (!prodSku) { errors.push({ row: rowNum, raw: r, message: 'producto_sku vacío' }); return; }
        if (!compSku) { errors.push({ row: rowNum, raw: r, message: 'componente_sku vacío' }); return; }
        if (!['insumo', 'subproducto'].includes(tipo)) {
          errors.push({ row: rowNum, raw: r, message: `tipo debe ser "insumo" o "subproducto" (recibido: "${tipo}")` });
          return;
        }
        if (!isFinite(rinde) || rinde <= 0) { errors.push({ row: rowNum, raw: r, message: 'rinde debe ser > 0' }); return; }
        if (!isFinite(cantidad) || cantidad <= 0) { errors.push({ row: rowNum, raw: r, message: 'cantidad debe ser > 0' }); return; }
        const prod = products.get(prodSku.toLowerCase());
        if (!prod) { errors.push({ row: rowNum, raw: r, message: `Producto con SKU "${prodSku}" no existe` }); return; }

        let recipeItem: RecipeItem;
        if (tipo === 'insumo') {
          const sup = supplies.get(compSku.toLowerCase());
          if (!sup) { errors.push({ row: rowNum, raw: r, message: `Insumo con SKU "${compSku}" no existe` }); return; }
          recipeItem = { supplyId: sup.id, itemName: sup.name, qty: cantidad, unit: sup.unit };
        } else {
          // subproducto: el SKU del componente debe ser un producto (no necesariamente con receta)
          const subProd = products.get(compSku.toLowerCase());
          if (!subProd) { errors.push({ row: rowNum, raw: r, message: `Producto subproducto con SKU "${compSku}" no existe` }); return; }
          if (subProd.id === prod.id) { errors.push({ row: rowNum, raw: r, message: `Auto-referencia: ${prodSku} no puede ser subproducto de sí mismo` }); return; }
          recipeItem = { productId: subProd.id, itemName: subProd.name, qty: cantidad, unit: subProd.unit };
        }

        const key = prod.id;
        let group = grouped.get(key);
        if (!group) {
          group = { yieldQty: rinde, items: [], rowNums: [] };
          grouped.set(key, group);
        }
        if (group.yieldQty !== rinde) {
          errors.push({ row: rowNum, raw: r, message: `Rinde inconsistente para ${prodSku} (esperaba ${group.yieldQty})` });
          return;
        }
        const duplicateId = recipeItem.supplyId ?? recipeItem.productId;
        const exists = group.items.some(it => (it.supplyId ?? it.productId) === duplicateId);
        if (exists) {
          errors.push({ row: rowNum, raw: r, message: `Componente ${compSku} duplicado en receta de ${prodSku}` });
          return;
        }
        group.items.push(recipeItem);
        group.rowNums.push(rowNum);
      });

      // Construir entidades Recipe a partir de grupos válidos
      const valid: Recipe[] = [];
      const productsArr = this.data.activeProducts();
      grouped.forEach((g, productId) => {
        const prod = productsArr.find(p => p.id === productId)!;
        if (g.yieldQty == null || g.items.length === 0) return;
        valid.push({
          id: productId,
          productId,
          productName: prod.name,
          yieldQty: g.yieldQty,
          items: g.items,
        });
      });
      return { valid, errors };
    },
    commit: (valid) => this.data.saveRecipesBulk(valid),
  };

  readonly confirmMessage = computed(() => {
    const r = this.recetaAEliminar();
    if (!r) return '';
    return `Eliminar la receta de "${r.productName}". El producto seguirá existiendo pero ya no descontará insumos al venderse.`;
  });

  /** Costo total de hacer una corrida completa de la receta (sin dividir por yield). */
  costoReceta(recipeId: string): number {
    const r = this.data.recipes().find(x => x.id === recipeId);
    if (!r) return 0;
    return r.items.reduce((sum, it) => {
      // Insumo: usar costo directo del supply
      if (it.supplyId) {
        const sup = this.data.supplyById(it.supplyId);
        return sum + (sup?.cost ?? 0) * it.qty;
      }
      // Subproducto: usar effectiveProductCost (recursivo si tiene receta)
      if (it.productId) {
        return sum + this.data.effectiveProductCost(it.productId) * it.qty;
      }
      return sum;
    }, 0);
  }

  /** Costo por cada unidad producida (delega al helper del service). */
  costoPorUnidad(productId: string): number {
    return this.data.computeRecipeCost(productId) ?? 0;
  }

  abrirNuevo() {
    this.recetaEdit.set(null);
    this.modalOpen.set(true);
  }
  abrirEditar(r: Recipe) {
    this.recetaEdit.set(r);
    this.modalOpen.set(true);
  }
  cerrarModal() {
    this.modalOpen.set(false);
    this.recetaEdit.set(null);
  }
  pedirEliminar(r: Recipe) {
    this.recetaAEliminar.set(r);
    this.confirmOpen.set(true);
  }
  async eliminar() {
    const r = this.recetaAEliminar();
    if (!r) return;
    this.data.deleteRecipe(r.productId);
    this.confirmOpen.set(false);
    this.recetaAEliminar.set(null);
    await this.toast.show(`Receta de "${r.productName}" eliminada.`, 'success');
  }
}
