import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
  IonButton,
} from '@ionic/angular/standalone';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { ToastService } from '../../shared/components/toast/toast.service';
import { PredictionService, DECISION_TO_STATUS } from '../../core/services/prediction.service';
import { DataService } from '../../core/services/data.service';
import { PredictionEvent, PredictionRequest } from '../../core/models';
import { UrgencyGaugeComponent } from './urgency-gauge.component';
import { ProjectionChartComponent, ProjectionMarker } from './projection-chart.component';

type CatalogItemKind = 'supply' | 'product';
interface CatalogItem {
  kind: CatalogItemKind;
  id: string;
  name: string;
  sku: string;
  unit: string;
}

type AccordionId = 'inventario' | 'politica' | 'demanda' | 'logistica';

/** Métricas de evaluación fijas (provistas por equipo ML). */
const MODEL_METRICS = [
  { horizonte: 't+7d',  mae:  471, rmse: 1702, r2: 0.919, mape:  7.2 },
  { horizonte: 't+14d', mae:  532, rmse: 1823, r2: 0.909, mape: 10.4 },
  { horizonte: 't+30d', mae:  787, rmse: 1992, r2: 0.896, mape: 14.9 },
  { horizonte: 't+60d', mae: 1589, rmse: 2756, r2: 0.839, mape: 31.5 },
];

@Component({
  selector: 'app-predicciones',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe, ReactiveFormsModule, FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton, IonButton,
    PageHeaderComponent, UrgencyGaugeComponent, ProjectionChartComponent,
  ],
  templateUrl: './predicciones.page.html',
  styleUrls: ['./predicciones.page.scss'],
})
export class PrediccionesPage {
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  protected readonly pred = inject(PredictionService);
  private readonly data = inject(DataService);

  protected readonly METRICS = MODEL_METRICS;

  // ---------- Cargar desde catálogo ----------
  selectedItemRef = '';
  readonly loadedItemLabel = signal<string>('');

  readonly supplyItems = computed<CatalogItem[]>(() =>
    this.data.activeSupplies().map(s => ({
      kind: 'supply' as const, id: s.id, name: s.name, sku: s.sku, unit: s.unit,
    }))
  );

  readonly productItems = computed<CatalogItem[]>(() =>
    this.data.activeProducts()
      .filter(p => !p.hasRecipe)
      .map(p => ({
        kind: 'product' as const, id: p.id, name: p.name, sku: p.sku, unit: p.unit,
      }))
  );

  async loadFromCatalog() {
    if (!this.selectedItemRef) return;
    const [kind, id] = this.selectedItemRef.split(':') as [CatalogItemKind, string];
    if (kind === 'supply') {
      this.loadFromSupply(id);
    } else {
      this.loadFromProduct(id);
    }
  }

  /**
   * Lead time dinámico de un insumo, calculado contra el calendario semanal
   * del proveedor que entrega antes desde HOY (orderDays + deliveryDays).
   * Fallback: 0 si no hay proveedores.
   */
  private dynamicSupplyLeadTime(supplyId: string): number {
    const lt = this.data.supplyLeadTime(supplyId, new Date());
    return lt?.leadTimeDays ?? 0;
  }

  private loadFromSupply(id: string) {
    const supply = this.data.supplyById(id);
    if (!supply) return;
    const stock = this.data.supplyStockFor(id);
    const lt = this.data.historicalLeadTime('supply', id);

    this.form.patchValue({
      actual_stock: stock?.quantity ?? 0,
      dias_desde_ultimo_restock: this.data.daysSinceLastRestock('supply', id),
      stock_min: supply.minStock,
      stock_max: supply.maxStock,
      reorder_point_manual: supply.reorderPoint,
      rolling_mean_7d:  +this.data.rollingMean('supply', id, 7).toFixed(2),
      rolling_mean_14d: +this.data.rollingMean('supply', id, 14).toFixed(2),
      rolling_mean_30d: +this.data.rollingMean('supply', id, 30).toFixed(2),
      rolling_std_7d:   +this.data.rollingStd('supply', id, 7).toFixed(2),
      // Lead time: si hay OCs recibidas, usar promedio histórico real.
      // Sino, calcular el LT DINÁMICO contra el calendario semanal del
      // proveedor más rápido — refleja la próxima entrega real desde hoy,
      // no un número fijo.
      lt_avg: lt.count >= 1 ? +lt.avg.toFixed(2) : this.dynamicSupplyLeadTime(supply.id),
      lt_std: lt.count >= 2 ? +lt.std.toFixed(2) : Math.max(0.5, +(this.dynamicSupplyLeadTime(supply.id) * 0.3).toFixed(1)),
    });
    const ltNote = lt.count > 0
      ? ` · LT real promedio: ${lt.avg.toFixed(1)}d (n=${lt.count})`
      : '';
    this.loadedItemLabel.set(`${supply.name} (${supply.sku})${ltNote}`);
    this.toast.show(`Datos de "${supply.name}" cargados.`, 'success');
  }

  private loadFromProduct(id: string) {
    const product = this.data.productById(id);
    if (!product) return;
    const stock = this.data.productStockFor(id);
    const lt = this.data.historicalLeadTime('product', id);

    // Productos de reventa no siempre tienen min/max nativo; derivamos defaults.
    const reorderPoint = product.reorderPoint ?? 0;
    const minStock = product.minStock ?? Math.floor(reorderPoint / 3);
    const maxStock = Math.max(reorderPoint * 3, minStock + 10);

    this.form.patchValue({
      actual_stock: stock?.quantity ?? 0,
      dias_desde_ultimo_restock: this.data.daysSinceLastRestock('product', id),
      stock_min: minStock,
      stock_max: maxStock,
      reorder_point_manual: reorderPoint || Math.floor((minStock + maxStock) / 2),
      rolling_mean_7d:  +this.data.rollingMean('product', id, 7).toFixed(2),
      rolling_mean_14d: +this.data.rollingMean('product', id, 14).toFixed(2),
      rolling_mean_30d: +this.data.rollingMean('product', id, 30).toFixed(2),
      rolling_std_7d:   +this.data.rollingStd('product', id, 7).toFixed(2),
      lt_avg: lt.count >= 1 ? +lt.avg.toFixed(2) : product.leadTime,
      lt_std: lt.count >= 2 ? +lt.std.toFixed(2) : Math.max(0.5, +(product.leadTime * 0.3).toFixed(1)),
    });
    const ltNote = lt.count > 0
      ? ` · LT real promedio: ${lt.avg.toFixed(1)}d (n=${lt.count})`
      : '';
    this.loadedItemLabel.set(`${product.name} (${product.sku})${ltNote}`);
    this.toast.show(`Datos de "${product.name}" cargados.`, 'success');
  }

  private readonly openSet = signal<Set<AccordionId>>(new Set(['inventario', 'politica', 'demanda']));
  isOpen(id: AccordionId): boolean { return this.openSet().has(id); }
  onToggle(id: AccordionId, ev: Event) {
    const open = (ev.target as HTMLDetailsElement).open;
    this.openSet.update(s => {
      const next = new Set(s);
      if (open) next.add(id); else next.delete(id);
      return next;
    });
  }

  /**
   * Form arranca completamente vacío (null en todos los controles). El usuario
   * debe cargar un item del catálogo o completar manualmente antes de analizar.
   * Esto evita análisis con datos default ficticios.
   */
  readonly form = this.fb.group({
    actual_stock:              this.fb.control<number | null>(null, [Validators.required, Validators.min(0)]),
    dias_desde_ultimo_restock: this.fb.control<number | null>(null, [Validators.required, Validators.min(0)]),
    rolling_mean_7d:           this.fb.control<number | null>(null, [Validators.required, Validators.min(0)]),
    rolling_mean_14d:          this.fb.control<number | null>(null, [Validators.required, Validators.min(0)]),
    rolling_mean_30d:          this.fb.control<number | null>(null, [Validators.required, Validators.min(0)]),
    rolling_std_7d:            this.fb.control<number | null>(null, [Validators.required, Validators.min(0)]),
    lt_avg:                    this.fb.control<number | null>(null, [Validators.required, Validators.min(1)]),
    lt_std:                    this.fb.control<number | null>(null, [Validators.required, Validators.min(0)]),
    stock_min:                 this.fb.control<number | null>(null, [Validators.required, Validators.min(0)]),
    stock_max:                 this.fb.control<number | null>(null, [Validators.required, Validators.min(0)]),
    reorder_point_manual:      this.fb.control<number | null>(null, [Validators.required, Validators.min(0)]),
  });

  private readonly formValueSig = signal<typeof this.form.value | null>(null);
  constructor() {
    this.form.valueChanges.subscribe(v => this.formValueSig.set(v));
    this.formValueSig.set(this.form.getRawValue());

    effect(() => {
      const r = this.pred.state().result;
      if (r) this.sliderDay.set(7);
    });
  }

  /** Mínimo teórico (rolling_mean_7d × lt_avg). null cuando falta info. */
  readonly theoreticalMin = computed<number | null>(() => {
    const v = this.formValueSig();
    if (!v) return null;
    if (v.rolling_mean_7d == null || v.lt_avg == null) return null;
    return v.rolling_mean_7d * v.lt_avg;
  });

  readonly canSubmit = computed(() => {
    const v = this.formValueSig();
    if (!v || this.form.invalid) return false;
    if ((v.stock_max ?? 0) <= (v.stock_min ?? 0)) return false;
    const rop = v.reorder_point_manual ?? 0;
    if (rop < (v.stock_min ?? 0) || rop > (v.stock_max ?? 0)) return false;
    return true;
  });

  showError(name: keyof typeof this.form.controls): boolean {
    const ctrl = this.form.get(name as string);
    return !!ctrl && ctrl.invalid && (ctrl.dirty || ctrl.touched);
  }

  errorFor(name: keyof typeof this.form.controls): string {
    const v = this.formValueSig();
    if (!v) return 'Requerido';
    const ctrl = this.form.get(name as string);
    if (ctrl?.errors?.['required']) return 'Requerido';
    if (ctrl?.errors?.['min']) return `Mínimo: ${ctrl.errors['min'].min}`;
    if (name === 'stock_max' && (v.stock_max ?? 0) <= (v.stock_min ?? 0)) return 'Debe ser mayor a stock_min';
    if (name === 'reorder_point_manual') {
      const rop = v.reorder_point_manual ?? 0;
      if (rop < (v.stock_min ?? 0)) return 'No puede ser menor a stock_min';
      if (rop > (v.stock_max ?? 0)) return 'No puede ser mayor a stock_max';
    }
    return '';
  }

  async onSubmit() {
    if (!this.canSubmit()) {
      this.form.markAllAsTouched();
      return;
    }
    try {
      // dia_semana_num y mes_num los inyectamos desde la fecha actual: el contrato
      // del backend los exige pero el usuario no debe configurarlos manualmente.
      // canSubmit() ya validó que ningún campo es null, así que el cast es seguro.
      const now = new Date();
      const v = this.form.getRawValue();
      const payload: PredictionRequest = {
        actual_stock:              v.actual_stock!,
        dias_desde_ultimo_restock: v.dias_desde_ultimo_restock!,
        rolling_mean_7d:           v.rolling_mean_7d!,
        rolling_mean_14d:          v.rolling_mean_14d!,
        rolling_mean_30d:          v.rolling_mean_30d!,
        rolling_std_7d:            v.rolling_std_7d!,
        lt_avg:                    v.lt_avg!,
        lt_std:                    v.lt_std!,
        stock_min:                 v.stock_min!,
        stock_max:                 v.stock_max!,
        reorder_point_manual:      v.reorder_point_manual!,
        dia_semana_num: ((now.getDay() + 6) % 7) + 1, // JS dom=0..sáb=6 → lun=1..dom=7
        mes_num: now.getMonth() + 1,
      };
      // Si el usuario cargó el formulario desde el catálogo, pasamos el
      // contexto del item para que el simulador local respete los boosts activos.
      const ref = this.selectedItemRef;
      const itemContext = ref
        ? (() => {
            const [k, id] = ref.split(':') as ['supply' | 'product', string];
            return { kind: k, id };
          })()
        : undefined;
      await this.pred.predict(payload, itemContext);
    } catch (e: unknown) {
      await this.toast.show(
        e instanceof Error ? e.message : 'Error al ejecutar la predicción.',
        'danger'
      );
    }
  }

  // -------- Sección 1 ----------
  readonly decisionMeta = computed(() => {
    const r = this.pred.state().result;
    if (!r) return { status: 'optimo' as const, title: '', icon: '' };
    return DECISION_TO_STATUS[r.orden.decision];
  });

  chipStatus(kind: 'cobertura' | 'ratio', value: number): 'optimo' | 'alerta' | 'critico' {
    if (kind === 'cobertura') {
      if (value < 3) return 'critico';
      if (value < 7) return 'alerta';
      return 'optimo';
    }
    if (value < 0.8) return 'critico';
    if (value < 1.2) return 'alerta';
    return 'optimo';
  }

  // -------- Sección 2 ----------
  readonly markersForChart = computed<ProjectionMarker[]>(() => {
    const r = this.pred.state().result;
    if (!r) return [];
    return [
      { day: 7,  value: r.stock_proyeccion.t7,  label: 't+7' },
      { day: 14, value: r.stock_proyeccion.t14, label: 't+14' },
      { day: 30, value: r.stock_proyeccion.t30, label: 't+30' },
      { day: 60, value: r.stock_proyeccion.t60, label: 't+60' },
    ];
  });

  readonly recommendedRop = computed(() => {
    const r = this.pred.state().result;
    return r ? Math.round(r.derivados.reorder_point + r.derivados.safety_stock) : 0;
  });

  // -------- Sección 3 ----------
  readonly sliderDay = signal<number>(7);

  readonly sliderStock = computed(() => {
    const r = this.pred.state().result;
    if (!r) return 0;
    return r.simulacion.trayectoria[Math.min(this.sliderDay(), r.simulacion.trayectoria.length - 1)];
  });

  readonly sliderStatus = computed<'optimo' | 'alerta' | 'critico'>(() => {
    const r = this.pred.state().result;
    const req = this.pred.state().request;
    if (!r || !req) return 'optimo';
    const v = this.sliderStock();
    if (v < req.stock_min) return 'critico';
    if (v < r.derivados.reorder_point) return 'alerta';
    return 'optimo';
  });

  readonly sliderStatusLabel = computed(() => {
    const s = this.sliderStatus();
    return s === 'critico' ? 'Crítico' : s === 'alerta' ? 'Alerta' : 'Óptimo';
  });

  readonly sliderStatusIcon = computed(() => {
    const s = this.sliderStatus();
    return s === 'critico' ? '🚨' : s === 'alerta' ? '⚠️' : '✓';
  });

  readonly sliderStatusExplain = computed(() => {
    const s = this.sliderStatus();
    return s === 'critico' ? 'Stock por debajo del mínimo. Riesgo de quiebre.'
         : s === 'alerta'  ? 'Stock entre mínimo y punto de reorden. Conviene ordenar pronto.'
         : 'Stock por encima del punto de reorden. Operación normal.';
  });

  readonly eventsUntilSlider = computed<PredictionEvent[]>(() => {
    const r = this.pred.state().result;
    if (!r) return [];
    return r.simulacion.eventos.filter(e => e.trigger <= this.sliderDay());
  });
}
