import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
  IonButton,
} from '@ionic/angular/standalone';
import { DataService } from '../../core/services/data.service';
import { TenantContextService } from '../../core/services/tenant-context.service';
import { BrandingService } from '../../core/services/branding.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { ToastService } from '../../shared/components/toast/toast.service';
import { RecetaFormModalComponent } from './receta-form-modal.component';
import { BulkImportModalComponent, BulkImportConfig } from '../../shared/components/bulk-import/bulk-import-modal.component';
import { Recipe, RecipeItem } from '../../core/models';
import { printFichaTecnica } from '../../shared/utils/ficha-tecnica';

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
  templateUrl: './recetas.page.html',
  styleUrls: ['./recetas.page.scss'],
})
export class RecetasPage {
  protected readonly data = inject(DataService);
  protected readonly tenant = inject(TenantContextService);
  private readonly branding = inject(BrandingService);
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
    headers: ['producto_sku', 'rinde', 'tipo', 'componente_sku', 'cantidad', 'notas'],
    templateRows: [
      ['PROD-BAG-001', '10', 'insumo', 'INS-HARINA-001', '1.5', 'Reposar 30min antes de hornear'],
      ['PROD-BAG-001', '10', 'insumo', 'INS-SAL-001', '0.03', ''],
      ['PROD-BAG-001', '10', 'insumo', 'INS-LEVADURA-001', '0.02', ''],
      ['PROD-SANDWICH-001', '1', 'subproducto', 'PROD-BAG-001', '1', 'Cortar baguette en diagonal'],
      ['PROD-SANDWICH-001', '1', 'insumo', 'INS-QUESO-001', '0.05', ''],
    ],
    hint: `Una fila por componente — la receta se agrupa por "producto_sku".
Columnas: producto_sku, rinde, tipo, componente_sku, cantidad (obligatorias) + notas (opcional, se toma de la primera fila de cada producto).
tipo: "insumo" o "subproducto" (default: insumo). El componente_sku se busca como insumo o como producto según el tipo.
El producto destino y los componentes deben existir previamente. No se permite auto-referencia (un producto no puede ser su propio subproducto).
"rinde" debe ser consistente entre todas las filas del mismo producto.`,
    process: (rows) => {
      const errors: { row: number; raw: Record<string, string>; message: string }[] = [];
      const products = new Map(this.data.activeProducts().map(p => [p.sku.toLowerCase(), p]));
      const supplies = new Map(this.data.activeSupplies().map(s => [s.sku.toLowerCase(), s]));

      // Agrupar filas por producto_sku
      const grouped = new Map<string, { yieldQty: number | null; items: RecipeItem[]; rowNums: number[]; notes?: string }>();
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

        const notas = (r['notas'] ?? '').trim();
        const key = prod.id;
        let group = grouped.get(key);
        if (!group) {
          group = { yieldQty: rinde, items: [], rowNums: [], notes: notas || undefined };
          grouped.set(key, group);
        }
        if (group.yieldQty !== rinde) {
          errors.push({ row: rowNum, raw: r, message: `Rinde inconsistente para ${prodSku} (esperaba ${group.yieldQty})` });
          return;
        }
        // Si la primera fila no traía notas y esta sí, las adoptamos.
        if (!group.notes && notas) group.notes = notas;
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
          notes: g.notes,
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

  /** Abre la ficha técnica en una ventana e invoca imprimir → Guardar como PDF. */
  descargarFicha(recipe: Recipe) {
    const product = this.data.productById(recipe.productId);
    const s = recipe.sheet;
    printFichaTecnica({
      brand: this.branding.branding().displayName,
      productName: recipe.productName,
      sku: product?.sku,
      category: product?.category,
      unit: product?.unit,
      unitsPerBatch: recipe.yieldQty,
      storage: s?.storage,
      weightRaw: s?.weightRaw,
      weightBaked: s?.weightBaked,
      weightFinal: s?.weightFinal,
      ingredients: recipe.items.map(it => ({ name: it.itemName, qty: it.qty, unit: it.unit })),
      procedure: s?.procedure ?? [],
      laminationThickness: s?.laminationThickness,
      fermentationTime: s?.fermentationTime,
      ovenTempTop: s?.ovenTempTop,
      ovenTempBottom: s?.ovenTempBottom,
      bakingTime: s?.bakingTime,
      fermentedSize: s?.fermentedSize,
      finishedSize: s?.finishedSize,
      decoration: s?.decoration,
      notes: recipe.notes,
      imageUrl: recipe.imageUrl,
    });
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
