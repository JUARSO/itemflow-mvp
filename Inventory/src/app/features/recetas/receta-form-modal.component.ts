import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { startWith } from 'rxjs';
import { IonButton } from '@ionic/angular/standalone';
import { FormModalComponent } from '../../shared/components/form-modal/form-modal.component';
import { FormFieldComponent } from '../../shared/components/form-field/form-field.component';
import { Recipe, RecipeSheet, RecipeSize } from '../../core/models';
import { DataService } from '../../core/services/data.service';
import { ToastService } from '../../shared/components/toast/toast.service';

type ItemGroup = ReturnType<RecetaFormModalComponent['buildItemGroup']>;

@Component({
  selector: 'app-receta-form-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, IonButton, FormModalComponent, FormFieldComponent],
  templateUrl: './receta-form-modal.component.html',
  styleUrls: ['./receta-form-modal.component.scss'],
})
export class RecetaFormModalComponent {
  private readonly fb = inject(FormBuilder);
  protected readonly data = inject(DataService);
  private readonly toast = inject(ToastService);

  readonly isOpen = input.required<boolean>();
  readonly editing = input<Recipe | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();

  readonly form = this.fb.group({
    productId: this.fb.control('', { nonNullable: true, validators: [Validators.required] }),
    yieldQty: this.fb.control(1, { nonNullable: true, validators: [Validators.required, Validators.min(1)] }),
    items: this.fb.array<ItemGroup>([]),
    // --- Ficha técnica ---
    storage: this.fb.control('', { nonNullable: true }),
    weightRaw: this.fb.control<number | null>(null),
    weightBaked: this.fb.control<number | null>(null),
    weightFinal: this.fb.control<number | null>(null),
    procedure: this.fb.control('', { nonNullable: true }),
    laminationThickness: this.fb.control('', { nonNullable: true }),
    fermentationTime: this.fb.control('', { nonNullable: true }),
    ovenTempBottom: this.fb.control('', { nonNullable: true }),
    ovenTempTop: this.fb.control('', { nonNullable: true }),
    bakingTime: this.fb.control('', { nonNullable: true }),
    // medidas fermentado
    fAlto: this.fb.control('', { nonNullable: true }),
    fLargo: this.fb.control('', { nonNullable: true }),
    fAncho: this.fb.control('', { nonNullable: true }),
    fDiam: this.fb.control('', { nonNullable: true }),
    // medidas terminado
    tAlto: this.fb.control('', { nonNullable: true }),
    tLargo: this.fb.control('', { nonNullable: true }),
    tAncho: this.fb.control('', { nonNullable: true }),
    tDiam: this.fb.control('', { nonNullable: true }),
    decoration: this.fb.control('', { nonNullable: true }),
    notes: this.fb.control('', { nonNullable: true }),
  });

  private readonly productIdSig = toSignal(
    this.form.controls.productId.valueChanges.pipe(startWith(this.form.controls.productId.value)),
    { initialValue: this.form.controls.productId.value },
  );

  /** Producto seleccionado (para mostrar SKU/categoría read-only en la ficha). */
  readonly selectedProduct = computed(() => {
    const id = this.productIdSig();
    return id ? this.data.productById(id) ?? null : null;
  });

  /** Foto del producto (data URL) — se sube aparte del form reactivo. */
  readonly imageUrl = signal<string | undefined>(undefined);

  get items(): FormArray<ItemGroup> {
    return this.form.get('items') as FormArray<ItemGroup>;
  }

  productosDisponibles = () => {
    const editing = this.editing();
    // Productos que ya tienen receta definida (para evitar duplicados).
    const conRecetaDefinida = new Set(this.data.recipes().map(r => r.productId));
    return this.data.activeProducts().filter(p => {
      // Editando: siempre incluir el producto cuya receta se está editando.
      if (editing && p.id === editing.productId) return true;
      // Cualquier producto activo que aún NO tenga receta. Al guardar, el
      // producto se marca automáticamente como "usa receta".
      return !conRecetaDefinida.has(p.id);
    });
  };

  buildItemGroup(kind: 'supply' | 'product' = 'supply', itemId = '', qty = 1) {
    return this.fb.group({
      kind: this.fb.control<'supply' | 'product'>(kind, { nonNullable: true, validators: [Validators.required] }),
      itemId: this.fb.control(itemId, { nonNullable: true, validators: [Validators.required] }),
      qty: this.fb.control(qty, { nonNullable: true, validators: [Validators.required, Validators.min(0.001)] }),
    });
  }

  addItem(kind: 'supply' | 'product' = 'supply') {
    this.items.push(this.buildItemGroup(kind));
  }

  removeItem(i: number) {
    this.items.removeAt(i);
  }

  /** Devuelve el kind actual de un item (para condicionar el select del template). */
  kindAt(i: number): 'supply' | 'product' {
    return this.items.at(i)?.get('kind')?.value ?? 'supply';
  }

  /** Cuando cambia el kind, limpiar el itemId (no tiene sentido conservar un supplyId si ahora es subproducto). */
  onKindChange(i: number) {
    this.items.at(i)?.get('itemId')?.setValue('');
  }

  /**
   * Productos con receta disponibles como SUBPRODUCTOS de la receta editada.
   * Excluimos el producto cuya receta estamos editando para evitar auto-referencia.
   */
  subproductosDisponibles = () => {
    const currentProductId = this.form.controls.productId.value;
    return this.data.activeProducts().filter(p =>
      p.hasRecipe && p.id !== currentProductId
    );
  };

  constructor() {
    effect(() => {
      const r = this.editing();
      this.items.clear();
      if (r) {
        this.imageUrl.set(r.imageUrl);
        const s = r.sheet;
        this.form.patchValue({
          productId: r.productId,
          yieldQty: r.yieldQty,
          notes: r.notes ?? '',
          storage: s?.storage ?? '',
          weightRaw: s?.weightRaw ?? null,
          weightBaked: s?.weightBaked ?? null,
          weightFinal: s?.weightFinal ?? null,
          procedure: (s?.procedure ?? []).join('\n'),
          laminationThickness: s?.laminationThickness ?? '',
          fermentationTime: s?.fermentationTime ?? '',
          ovenTempBottom: s?.ovenTempBottom ?? '',
          ovenTempTop: s?.ovenTempTop ?? '',
          bakingTime: s?.bakingTime ?? '',
          fAlto: s?.fermentedSize?.alto ?? '', fLargo: s?.fermentedSize?.largo ?? '',
          fAncho: s?.fermentedSize?.ancho ?? '', fDiam: s?.fermentedSize?.diametro ?? '',
          tAlto: s?.finishedSize?.alto ?? '', tLargo: s?.finishedSize?.largo ?? '',
          tAncho: s?.finishedSize?.ancho ?? '', tDiam: s?.finishedSize?.diametro ?? '',
          decoration: s?.decoration ?? '',
        });
        r.items.forEach(it => {
          const kind: 'supply' | 'product' = it.supplyId ? 'supply' : 'product';
          const itemId = it.supplyId ?? it.productId ?? '';
          this.items.push(this.buildItemGroup(kind, itemId, it.qty));
        });
      } else if (this.isOpen()) {
        this.form.reset();
        this.imageUrl.set(undefined);
        this.addItem('supply');
      }
    });
  }

  /** Lee la imagen subida, la redimensiona y la guarda como data URL. */
  async onImageSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      await this.toast.show('El archivo debe ser una imagen.', 'danger');
      return;
    }
    try {
      const dataUrl = await this.resizeImage(file, 700);
      this.imageUrl.set(dataUrl);
    } catch {
      await this.toast.show('No se pudo procesar la imagen.', 'danger');
    } finally {
      input.value = ''; // permite volver a subir el mismo archivo
    }
  }

  removeImage() {
    this.imageUrl.set(undefined);
  }

  /** Redimensiona la imagen (lado mayor = max) y devuelve un data URL JPEG. */
  private resizeImage(file: File, max: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('imagen inválida'));
        img.onload = () => {
          const scale = Math.min(1, max / Math.max(img.width, img.height));
          const w = Math.round(img.width * scale);
          const h = Math.round(img.height * scale);
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error('sin canvas'));
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.src = String(reader.result ?? '');
      };
      reader.readAsDataURL(file);
    });
  }

  /** Construye el RecipeSheet a partir del form; devuelve undefined si está vacío. */
  private buildSheet(v: ReturnType<typeof this.form.getRawValue>): RecipeSheet | undefined {
    const num = (x: number | null) => (x != null && x >= 0 ? x : undefined);
    const txt = (x: string) => (x?.trim() ? x.trim() : undefined);
    const procedure = (v.procedure ?? '')
      .split('\n').map(l => l.trim()).filter(Boolean);
    const size = (alto: string, largo: string, ancho: string, diam: string): RecipeSize | undefined => {
      const s: RecipeSize = {
        alto: txt(alto), largo: txt(largo), ancho: txt(ancho), diametro: txt(diam),
      };
      return (s.alto || s.largo || s.ancho || s.diametro) ? s : undefined;
    };
    const sheet: RecipeSheet = {
      storage: txt(v.storage),
      weightRaw: num(v.weightRaw),
      weightBaked: num(v.weightBaked),
      weightFinal: num(v.weightFinal),
      procedure: procedure.length > 0 ? procedure : undefined,
      laminationThickness: txt(v.laminationThickness),
      fermentationTime: txt(v.fermentationTime),
      ovenTempBottom: txt(v.ovenTempBottom),
      ovenTempTop: txt(v.ovenTempTop),
      bakingTime: txt(v.bakingTime),
      fermentedSize: size(v.fAlto, v.fLargo, v.fAncho, v.fDiam),
      finishedSize: size(v.tAlto, v.tLargo, v.tAncho, v.tDiam),
      decoration: txt(v.decoration),
    };
    const hasAny = Object.values(sheet).some(x => x !== undefined);
    return hasAny ? sheet : undefined;
  }

  async onSubmit() {
    if (this.form.invalid || this.items.length === 0) {
      this.form.markAllAsTouched();
      await this.toast.show('Completa el producto, rendimiento y al menos un componente.', 'danger');
      return;
    }
    const v = this.form.getRawValue();
    const product = this.data.productById(v.productId);
    if (!product) {
      await this.toast.show('Producto no encontrado.', 'danger');
      return;
    }
    const recipe: Recipe = {
      id: product.id,
      productId: product.id,
      productName: product.name,
      yieldQty: Number(v.yieldQty),
      notes: v.notes?.trim() || undefined,
      items: v.items.map(it => {
        if (it.kind === 'supply') {
          const sup = this.data.supplyById(it.itemId);
          return {
            supplyId: it.itemId,
            itemName: sup?.name ?? '',
            qty: Number(it.qty),
            unit: sup?.unit ?? 'unidad',
          };
        }
        const subProd = this.data.productById(it.itemId);
        return {
          productId: it.itemId,
          itemName: subProd?.name ?? '',
          qty: Number(it.qty),
          unit: subProd?.unit ?? 'unidad',
        };
      }),
      sheet: this.buildSheet(v),
      imageUrl: this.imageUrl(),
    };
    this.data.saveRecipe(recipe);
    await this.toast.show(`Receta de "${product.name}" guardada.`);
    this.saved.emit();
  }
}
