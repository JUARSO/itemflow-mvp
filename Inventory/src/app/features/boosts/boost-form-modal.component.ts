import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { IonButton } from '@ionic/angular/standalone';
import { FormModalComponent } from '../../shared/components/form-modal/form-modal.component';
import { FormFieldComponent } from '../../shared/components/form-field/form-field.component';
import { DataService } from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../shared/components/toast/toast.service';
import { BoostMode, BoostReason } from '../../core/models';

type ItemKind = 'supply' | 'product';

interface ReasonOption { value: BoostReason; label: string; }
const REASON_OPTIONS: ReasonOption[] = [
  { value: 'promo',    label: 'Promoción' },
  { value: 'evento',   label: 'Evento puntual' },
  { value: 'contrato', label: 'Contrato / cliente nuevo' },
  { value: 'feriado',  label: 'Feriado / temporada' },
  { value: 'campaña',  label: 'Campaña de marketing' },
  { value: 'otro',     label: 'Otro' },
];

@Component({
  selector: 'app-boost-form-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, DecimalPipe, IonButton, FormModalComponent, FormFieldComponent],
  template: `
    <app-form-modal
      [isOpen]="isOpen()"
      title="Registrar boost de demanda"
      (dismissed)="closed.emit()">

      <form body [formGroup]="form" novalidate>
        <app-form-field label="Item" [required]="true">
          <select formControlName="itemRef" (change)="onItemChange()">
            <option value="">— Selecciona producto —</option>
            <optgroup label="Productos con receta (boost se propaga a insumos)">
              @for (it of recipeProductsList(); track it.id) {
                <option [value]="'product:' + it.id">{{ it.name }} ({{ it.unit }})</option>
              }
            </optgroup>
            <optgroup label="Productos de reventa (boost afecta stock propio)">
              @for (it of reventaProductsList(); track it.id) {
                <option [value]="'product:' + it.id">{{ it.name }} ({{ it.unit }})</option>
              }
            </optgroup>
          </select>
        </app-form-field>

        @if (recipeImpact(); as impact) {
          @if (impact.length > 0) {
            <div class="cascade-info">
              <div class="cascade-info__title">⚡ Impacto en insumos (vía receta)</div>
              <p class="cascade-info__desc">
                Este producto consume {{ impact.length }} insumo{{ impact.length === 1 ? '' : 's' }}.
                Al activar el boost, también aumentará el consumo proyectado de:
              </p>
              <ul class="cascade-info__list">
                @for (i of impact; track i.itemKey) {
                  <li class="mono">
                    {{ i.itemName }}
                    @if (i.kind === 'subproducto') { <small>(subproducto)</small> }
                    · {{ i.qtyPerProduct | number:'1.0-3' }} {{ i.unit }} por unidad
                  </li>
                }
              </ul>
            </div>
          }
        }

        <app-form-field label="Período del boost" [required]="true" [hint]="rangeLabel()">
          <div class="date-range">
            <div class="date-range__inputs">
              <label class="date-range__field">
                <span class="date-range__cap">Desde</span>
                <input type="date" formControlName="startDate" class="date-range__input" />
              </label>
              <span class="date-range__arrow" aria-hidden="true">→</span>
              <label class="date-range__field">
                <span class="date-range__cap">Hasta</span>
                <input type="date" formControlName="endDate" class="date-range__input" />
              </label>
            </div>
            <div class="date-range__presets">
              <span class="date-range__presets-label">Rápido:</span>
              <button type="button" class="chip-btn" (click)="applyPreset(0)">Hoy</button>
              <button type="button" class="chip-btn" (click)="applyPreset(7)">+7 días</button>
              <button type="button" class="chip-btn" (click)="applyPreset(14)">+14 días</button>
              <button type="button" class="chip-btn" (click)="applyPreset(30)">+30 días</button>
              <button type="button" class="chip-btn" (click)="applyPresetMonth()">Este mes</button>
            </div>
          </div>
        </app-form-field>

        <app-form-field label="Tipo de boost" [required]="true">
          <div class="seg">
            <label class="seg__opt" [class.seg__opt--active]="mode() === 'multiplier'">
              <input type="radio" formControlName="mode" value="multiplier" (change)="onModeChange('multiplier')" />
              <span>× Multiplicador</span>
              <small>Demanda = histórico × N</small>
            </label>
            <label class="seg__opt" [class.seg__opt--active]="mode() === 'absoluteAdd'">
              <input type="radio" formControlName="mode" value="absoluteAdd" (change)="onModeChange('absoluteAdd')" />
              <span>+ Extra diario</span>
              <small>Demanda = histórico + X u/día</small>
            </label>
            <label class="seg__opt" [class.seg__opt--active]="mode() === 'eventTotal'">
              <input type="radio" formControlName="mode" value="eventTotal" (change)="onModeChange('eventTotal')" />
              <span>Σ Total evento</span>
              <small>Se venderán Y u en TODO el período</small>
            </label>
          </div>
        </app-form-field>

        <app-form-field [label]="valueLabel()" [required]="true" [hint]="valueHint()">
          <input type="number" formControlName="value" min="0.001" step="0.01" />
        </app-form-field>

        <app-form-field label="Motivo" [required]="true">
          <select formControlName="reason">
            @for (r of REASON_OPTIONS; track r.value) {
              <option [value]="r.value">{{ r.label }}</option>
            }
          </select>
        </app-form-field>

        <app-form-field label="Descripción" hint="Opcional — contexto adicional del boost">
          <textarea formControlName="description" rows="2" placeholder="Ej. Evento corporativo Hotel X · 3 días"></textarea>
        </app-form-field>

        <!-- Preview en vivo del impacto -->
        @if (previewItem(); as p) {
          <div class="preview">
            <div class="preview__title">Impacto proyectado</div>
            <div class="preview__row">
              <span>Demanda base (rolling 7d):</span>
              <strong class="mono">{{ p.baselineDemand | number:'1.0-2' }} {{ p.unit }}/día</strong>
            </div>
            @if (previewEffective() != null) {
              <div class="preview__row">
                <span>Demanda con este boost:</span>
                <strong class="mono preview__strong">{{ previewEffective() | number:'1.0-2' }} {{ p.unit }}/día</strong>
              </div>
              <div class="preview__row">
                <span>Stock actual:</span>
                <strong class="mono">{{ p.stock | number:'1.0-2' }} {{ p.unit }}</strong>
              </div>
              <div class="preview__row">
                <span>Días de cobertura:</span>
                <strong class="mono">{{ p.baselineCoverage | number:'1.0-1' }}d → {{ previewCoverage() | number:'1.0-1' }}d</strong>
              </div>
            }
          </div>
        }
      </form>

      <div footer>
        <ion-button fill="clear" class="ghost" (click)="closed.emit()">Cancelar</ion-button>
        <ion-button (click)="onSubmit()" [disabled]="form.invalid">
          Crear boost
        </ion-button>
      </div>
    </app-form-modal>
  `,
  styles: [`
    .row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: var(--ui-sp-3); }
    @media (max-width: 480px) { .row-2 { grid-template-columns: 1fr; } }

    /* ----- Date range ----- */
    .date-range {
      display: flex;
      flex-direction: column;
      gap: var(--ui-sp-2);
    }
    .date-range__inputs {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      gap: var(--ui-sp-2);
      align-items: center;
      padding: var(--ui-sp-2);
      background: var(--ui-surface-2);
      border: var(--ui-border-w-sm) solid var(--ui-border);
      border-radius: var(--ui-radius);
    }
    .date-range__field {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .date-range__cap {
      font-size: 10px;
      font-weight: var(--ui-fw-bold);
      color: var(--ui-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.6px;
      padding-left: 4px;
    }
    .date-range__input {
      padding: 8px 10px;
      border: var(--ui-border-w-sm) solid var(--ui-border-strong);
      border-radius: var(--ui-radius-sm);
      background: var(--ui-surface);
      font-family: var(--ui-font-sans);
      font-size: var(--ui-fs-sm);
      color: var(--ui-text-strong);
      min-height: 36px;
      cursor: pointer;
    }
    .date-range__input::-webkit-calendar-picker-indicator {
      cursor: pointer;
      filter: opacity(0.7);
      transition: filter 120ms ease;
    }
    .date-range__input:hover::-webkit-calendar-picker-indicator {
      filter: opacity(1);
    }
    .date-range__input:focus {
      outline: none;
      border-color: var(--ui-primary);
      box-shadow: 0 0 0 3px rgba(63, 120, 114, 0.18);
    }
    .date-range__arrow {
      font-size: 20px;
      color: var(--ui-text-muted);
      align-self: end;
      padding-bottom: 8px;
    }
    .date-range__presets {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
    }
    .date-range__presets-label {
      font-size: var(--ui-fs-xs);
      color: var(--ui-text-muted);
      font-weight: var(--ui-fw-medium);
      margin-right: 2px;
    }
    .chip-btn {
      padding: 4px 10px;
      background: var(--ui-surface);
      border: var(--ui-border-w-sm) solid var(--ui-border-strong);
      border-radius: var(--ui-radius-pill);
      color: var(--ui-text);
      font-family: var(--ui-font-sans);
      font-size: var(--ui-fs-xs);
      font-weight: var(--ui-fw-medium);
      cursor: pointer;
      transition: all 120ms ease;
    }
    .chip-btn:hover {
      background: var(--ui-primary);
      color: var(--ui-primary-contrast);
      border-color: var(--ui-primary);
    }
    .chip-btn:active {
      transform: scale(0.96);
    }

    .seg { display: grid; grid-template-columns: 1fr; gap: var(--ui-sp-2); }
    .seg__opt {
      display: flex; flex-direction: column;
      padding: var(--ui-sp-3);
      border: var(--ui-border-w-sm) solid var(--ui-border-strong);
      border-radius: var(--ui-radius);
      background: var(--ui-surface);
      cursor: pointer;
      transition: all 120ms ease;
    }
    /* Solo aplica hover gris cuando NO está activo, sino el text blanco se pierde. */
    .seg__opt:not(.seg__opt--active):hover {
      background: var(--ui-surface-3);
      border-color: var(--ui-primary);
    }
    .seg__opt--active {
      border-color: var(--ui-primary);
      background: var(--ui-primary);
      color: var(--ui-primary-contrast);
      box-shadow: var(--ui-shadow-sm);
    }
    /* Cuando está activo, hover preserva el tema y solo oscurece levemente. */
    .seg__opt--active:hover {
      background: var(--ui-primary-shade);
    }
    .seg__opt input[type="radio"] { position: absolute; opacity: 0; pointer-events: none; }
    .seg__opt span { font-weight: var(--ui-fw-semibold); font-size: var(--ui-fs-md); }
    .seg__opt small { font-size: var(--ui-fs-xs); margin-top: 2px; opacity: 0.85; }

    .preview {
      margin-top: var(--ui-sp-3);
      padding: var(--ui-sp-3);
      background: var(--ui-warning-tint);
      border: var(--ui-border-w-sm) solid var(--ui-warning);
      border-radius: var(--ui-radius);
    }
    .preview__title {
      font-size: var(--ui-fs-xs);
      font-weight: var(--ui-fw-bold);
      color: var(--ui-warning);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: var(--ui-sp-2);
    }
    .preview__row {
      display: flex; justify-content: space-between; align-items: center;
      padding: 4px 0;
      font-size: var(--ui-fs-sm);
      color: var(--ui-text-strong);
    }
    .preview__strong { color: var(--ui-warning); font-size: var(--ui-fs-md); }

    /* ----- Cascade info (impacto en insumos por receta) ----- */
    .cascade-info {
      margin-bottom: var(--ui-sp-3);
      padding: var(--ui-sp-3);
      background: var(--ui-excess-tint);
      border: var(--ui-border-w-sm) solid var(--ui-secondary);
      border-radius: var(--ui-radius);
    }
    .cascade-info__title {
      font-size: var(--ui-fs-xs);
      font-weight: var(--ui-fw-bold);
      color: var(--ui-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .cascade-info__desc {
      font-size: var(--ui-fs-sm);
      color: var(--ui-text);
      margin: 0 0 var(--ui-sp-2);
    }
    .cascade-info__list {
      margin: 0;
      padding-left: var(--ui-sp-4);
      font-size: var(--ui-fs-xs);
      color: var(--ui-text-muted);
      line-height: 1.6;
    }
    .cascade-info__list li {
      list-style: '• ';
    }
  `],
})
export class BoostFormModalComponent {
  private readonly fb = inject(FormBuilder);
  private readonly data = inject(DataService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly isOpen = input.required<boolean>();
  /** Opcional: preselecciona un item al abrir el modal. */
  readonly preselectedItem = input<{ kind: ItemKind; id: string } | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly REASON_OPTIONS = REASON_OPTIONS;

  readonly form = this.fb.group({
    itemRef:     this.fb.control('', { nonNullable: true, validators: [Validators.required] }),
    startDate:   this.fb.control(this.today(), { nonNullable: true, validators: [Validators.required] }),
    endDate:     this.fb.control(this.todayPlus(7), { nonNullable: true, validators: [Validators.required] }),
    mode:        this.fb.control<BoostMode>('multiplier', { nonNullable: true, validators: [Validators.required] }),
    value:       this.fb.control<number | null>(null, [Validators.required, Validators.min(0.001)]),
    reason:      this.fb.control<BoostReason>('promo', { nonNullable: true, validators: [Validators.required] }),
    description: this.fb.control(''),
  });

  // Signals sincronizadas con controles para template reactivo
  private readonly _mode = signal<BoostMode>('multiplier');
  private readonly _itemRef = signal<string>('');
  private readonly _value = signal<number | null>(null);
  private readonly _startDate = signal<string>(this.today());
  private readonly _endDate = signal<string>(this.todayPlus(7));

  readonly mode = this._mode.asReadonly();

  readonly recipeProductsList = computed(() =>
    this.data.activeProducts().filter(p => p.hasRecipe).map(p => ({ id: p.id, name: p.name, unit: p.unit }))
  );
  readonly reventaProductsList = computed(() =>
    this.data.activeProducts().filter(p => !p.hasRecipe).map(p => ({ id: p.id, name: p.name, unit: p.unit }))
  );

  /** Si el producto seleccionado tiene receta, lista items afectados (insumos o subproductos) con la cantidad por unidad. */
  readonly recipeImpact = computed<{ itemKey: string; itemName: string; qtyPerProduct: number; unit: string; kind: 'insumo' | 'subproducto' }[] | null>(() => {
    const ref = this._itemRef();
    if (!ref) return null;
    const [, id] = ref.split(':');
    const product = this.data.productById(id);
    if (!product || !product.hasRecipe) return [];
    const recipe = this.data.recipeFor(product.id);
    if (!recipe || recipe.yieldQty <= 0) return [];
    return recipe.items.map(it => ({
      itemKey: (it.supplyId ?? it.productId) as string,
      itemName: it.itemName,
      qtyPerProduct: it.qty / recipe.yieldQty,
      unit: it.unit,
      kind: (it.supplyId ? 'insumo' : 'subproducto') as 'insumo' | 'subproducto',
    }));
  });

  readonly valueLabel = computed(() => {
    switch (this._mode()) {
      case 'multiplier':  return 'Multiplicador (N)';
      case 'absoluteAdd': return 'Extra diario (u/día)';
      case 'eventTotal':  return 'Total del período (u)';
    }
  });

  readonly valueHint = computed(() => {
    switch (this._mode()) {
      case 'multiplier':  return 'Ej. 5 → demanda se quintuplica durante el período';
      case 'absoluteAdd': return 'Ej. 50 → 50 unidades extra cada día sobre la demanda normal';
      case 'eventTotal':  return 'Ej. 500 → 500 unidades totales repartidas en todo el período';
    }
  });

  /** Datos del producto seleccionado para el preview. */
  readonly previewItem = computed(() => {
    const ref = this._itemRef();
    if (!ref) return null;
    const [, id] = ref.split(':');
    const p = this.data.productById(id);
    if (!p) return null;
    const stk = this.data.productStockFor(id);
    const baselineDemand = this.data.rollingMean('product', id, 7);
    return {
      kind: 'product' as const, id, name: p.name, unit: p.unit,
      hasRecipe: p.hasRecipe,
      baselineDemand,
      stock: stk?.quantity ?? 0,
      baselineCoverage: baselineDemand > 0 ? (stk?.quantity ?? 0) / baselineDemand : 0,
    };
  });

  /** Demanda efectiva con el boost simulado en memoria (no persistente). */
  readonly previewEffective = computed<number | null>(() => {
    const p = this.previewItem();
    const v = this._value();
    if (!p || v == null || v <= 0) return null;
    switch (this._mode()) {
      case 'multiplier':  return p.baselineDemand * v;
      case 'absoluteAdd': return p.baselineDemand + v;
      case 'eventTotal': {
        const days = Math.max(1, this.rangeDays());
        return p.baselineDemand + (v / days);
      }
    }
  });

  readonly previewCoverage = computed<number>(() => {
    const eff = this.previewEffective();
    const p = this.previewItem();
    if (!eff || eff <= 0 || !p) return 0;
    return p.stock / eff;
  });

  constructor() {
    // Resetear form al abrir
    effect(() => {
      if (this.isOpen()) {
        const pre = this.preselectedItem();
        const itemRef = pre ? `${pre.kind}:${pre.id}` : '';
        this.form.reset({
          itemRef,
          startDate: this.today(),
          endDate: this.todayPlus(7),
          mode: 'multiplier',
          value: null,
          reason: 'promo',
          description: '',
        });
        this._mode.set('multiplier');
        this._itemRef.set(itemRef);
        this._value.set(null);
        this._startDate.set(this.today());
        this._endDate.set(this.todayPlus(7));
      }
    });
    // Sync signals con cambios de inputs
    this.form.controls.value.valueChanges.subscribe(v => this._value.set(v));
    this.form.controls.startDate.valueChanges.subscribe(v => this._startDate.set(v));
    this.form.controls.endDate.valueChanges.subscribe(v => this._endDate.set(v));
  }

  onItemChange() {
    this._itemRef.set(this.form.controls.itemRef.value);
  }
  onModeChange(m: BoostMode) {
    this._mode.set(m);
  }

  /** Preset rápido: rango desde hoy hasta hoy + N días. */
  applyPreset(days: number) {
    const start = this.today();
    const end = days === 0 ? start : this.todayPlus(days);
    this.form.patchValue({ startDate: start, endDate: end });
    this._startDate.set(start);
    this._endDate.set(end);
  }

  /** Preset: rango cubre todo el mes actual (hoy hasta fin de mes). */
  applyPresetMonth() {
    const today = new Date();
    const start = today.toISOString().split('T')[0];
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const end = lastDay.toISOString().split('T')[0];
    this.form.patchValue({ startDate: start, endDate: end });
    this._startDate.set(start);
    this._endDate.set(end);
  }

  /** Etiqueta legible del rango actual: "8 días · 16 may → 23 may". */
  readonly rangeLabel = computed(() => {
    const days = this.rangeDays();
    const s = new Date(this._startDate());
    const e = new Date(this._endDate());
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return 'Selecciona fechas';
    const fmt = (d: Date) => d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
    return `${days} día${days === 1 ? '' : 's'} · ${fmt(s)} → ${fmt(e)}`;
  });

  private today(): string {
    const d = new Date();
    return d.toISOString().split('T')[0];
  }
  private todayPlus(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  }
  private rangeDays(): number {
    const s = new Date(this._startDate());
    const e = new Date(this._endDate());
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return 1;
    return Math.max(1, Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1);
  }

  async onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      await this.toast.show('Completa los campos requeridos.', 'danger');
      return;
    }
    const v = this.form.getRawValue();
    const [kind, id] = v.itemRef.split(':') as [ItemKind, string];
    const item = kind === 'supply' ? this.data.supplyById(id) : this.data.productById(id);
    if (!item) {
      await this.toast.show('Item no encontrado.', 'danger');
      return;
    }
    const start = new Date(v.startDate);
    const end = new Date(v.endDate);
    if (end.getTime() < start.getTime()) {
      await this.toast.show('La fecha "hasta" debe ser igual o posterior a "desde".', 'danger');
      return;
    }
    const user = this.auth.user();
    try {
      this.data.createBoost({
        itemKind: kind,
        itemId: id,
        itemName: item.name,
        startDate: start,
        endDate: end,
        mode: v.mode,
        value: Number(v.value),
        reason: v.reason,
        description: v.description?.trim() || undefined,
        createdBy: user?.displayName ?? 'Usuario',
      });
      await this.toast.show(`Boost para "${item.name}" registrado.`, 'success');
      this.saved.emit();
    } catch (e: unknown) {
      await this.toast.show(e instanceof Error ? e.message : 'Error al crear boost.', 'danger');
    }
  }
}
