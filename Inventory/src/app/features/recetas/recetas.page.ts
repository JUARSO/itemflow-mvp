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
        @if (tenant.isAdmin()) {
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
                @if (tenant.isAdmin()) {
                  <div class="card__cost mono">
                    Costo: \${{ costoReceta(recipe.id) | number:'1.0-0' }}
                  </div>
                }
              </header>

              <div class="card__items">
                <div class="items__head">Insumos requeridos por corrida</div>
                @for (it of recipe.items; track it.supplyId) {
                  <div class="item-row">
                    <span class="item-row__name">{{ it.supplyName }}</span>
                    <span class="item-row__qty mono">{{ it.qty | number:'1.0-3' }} {{ it.unit }}</span>
                  </div>
                }
              </div>

              @if (tenant.isAdmin()) {
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
      padding: 4px 10px;
      border: var(--ui-border-w-sm) solid var(--ui-border);
      color: var(--ui-success);
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
    headers: ['producto_sku', 'rinde', 'insumo_sku', 'cantidad'],
    templateRows: [
      ['PROD-BAG-001', '10', 'INS-HARINA-001', '1.5'],
      ['PROD-BAG-001', '10', 'INS-SAL-001', '0.03'],
      ['PROD-BAG-001', '10', 'INS-LEVADURA-001', '0.02'],
      ['PROD-MAR-001', '20', 'INS-HARINA-001', '2.0'],
    ],
    hint: 'Una fila por ingrediente. Agrupamos por producto_sku: cada producto genera UNA receta con todos sus insumos. El producto y todos sus insumos deben existir (busca por SKU). El campo "rinde" debe ser igual en todas las filas del mismo producto.',
    process: (rows) => {
      const errors: { row: number; raw: Record<string, string>; message: string }[] = [];
      // Mapas por SKU para validación rápida
      const products = new Map(this.data.activeProducts().map(p => [p.sku.toLowerCase(), p]));
      const supplies = new Map(this.data.activeSupplies().map(s => [s.sku.toLowerCase(), s]));

      // Agrupar filas por producto_sku
      const grouped = new Map<string, { yieldQty: number | null; items: RecipeItem[]; rowNums: number[] }>();
      rows.forEach((r, i) => {
        const rowNum = i + 2;
        const prodSku = (r['producto_sku'] ?? '').trim();
        const insSku = (r['insumo_sku'] ?? '').trim();
        const rinde = Number(r['rinde']);
        const cantidad = Number(r['cantidad']);
        if (!prodSku) { errors.push({ row: rowNum, raw: r, message: 'producto_sku vacío' }); return; }
        if (!insSku) { errors.push({ row: rowNum, raw: r, message: 'insumo_sku vacío' }); return; }
        if (!isFinite(rinde) || rinde <= 0) { errors.push({ row: rowNum, raw: r, message: 'rinde debe ser > 0' }); return; }
        if (!isFinite(cantidad) || cantidad <= 0) { errors.push({ row: rowNum, raw: r, message: 'cantidad debe ser > 0' }); return; }
        const prod = products.get(prodSku.toLowerCase());
        if (!prod) { errors.push({ row: rowNum, raw: r, message: `Producto con SKU "${prodSku}" no existe` }); return; }
        const sup = supplies.get(insSku.toLowerCase());
        if (!sup) { errors.push({ row: rowNum, raw: r, message: `Insumo con SKU "${insSku}" no existe` }); return; }

        const key = prod.id;
        let group = grouped.get(key);
        if (!group) {
          group = { yieldQty: rinde, items: [], rowNums: [] };
          grouped.set(key, group);
        }
        if (group.yieldQty !== rinde) {
          { errors.push({ row: rowNum, raw: r, message: `Rinde inconsistente para ${prodSku} (esperaba ${group.yieldQty})` }); return; }
        }
        if (group.items.some(it => it.supplyId === sup.id)) {
          { errors.push({ row: rowNum, raw: r, message: `Insumo ${insSku} duplicado en receta de ${prodSku}` }); return; }
        }
        group.items.push({ supplyId: sup.id, supplyName: sup.name, qty: cantidad, unit: sup.unit });
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

  costoReceta(recipeId: string): number {
    const r = this.data.recipes().find(x => x.id === recipeId);
    if (!r) return 0;
    return r.items.reduce((sum, it) => {
      const sup = this.data.supplyById(it.supplyId);
      return sum + (sup?.cost ?? 0) * it.qty;
    }, 0);
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
