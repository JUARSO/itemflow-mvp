import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import {
  IonModal, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons,
  IonButton, IonIcon,
} from '@ionic/angular/standalone';
import { DataService } from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../shared/components/toast/toast.service';
import { ProductionMermaReason } from '../../core/models';

const REASON_OPTIONS: { value: ProductionMermaReason; label: string }[] = [
  { value: 'damaged',      label: 'Dañado / quebrado' },
  { value: 'underbaked',   label: 'Crudo / poco cocido' },
  { value: 'overbaked',    label: 'Quemado / sobrecocido' },
  { value: 'wrong_shape',  label: 'Mal formado / defecto visual' },
  { value: 'contaminated', label: 'Contaminado' },
  { value: 'other',        label: 'Otro (especificar)' },
];

/**
 * Modal para registrar merma durante producción: unidades que fallaron
 * antes de salir a entrega. Descuenta insumos consumidos pero NO toca
 * stock del producto (las unidades nunca entraron a inventario).
 */
@Component({
  selector: 'app-merma-produccion-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, DecimalPipe,
    IonModal, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons,
    IonButton, IonIcon,
  ],
  template: `
    <ion-modal [isOpen]="isOpen" (didDismiss)="closed.emit()">
      <ng-template>
        <ion-header>
          <ion-toolbar>
            <ion-title>Nueva merma de producción</ion-title>
            <ion-buttons slot="end">
              <ion-button (click)="closed.emit()">
                <ion-icon name="close-outline"></ion-icon>
              </ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content>
          <div class="form">
            <div class="hint">
              Registra unidades que se descartaron durante la fabricación.
              Los insumos consumidos se restarán del inventario automáticamente.
              El producto NO se toca (no entró al stock terminado).
            </div>

            <div class="field">
              <label>Producto</label>
              <select [value]="productId()" (change)="productId.set($any($event.target).value)" required>
                <option value="">— Selecciona producto —</option>
                @for (p of productos(); track p.id) {
                  <option [value]="p.id">{{ p.name }}</option>
                }
              </select>
            </div>

            <div class="row">
              <div class="field">
                <label>Cantidad (unidades)</label>
                <input type="number" min="1" step="1"
                  [value]="qty()"
                  (input)="setQty($any($event.target).value)"
                  required />
              </div>
              <div class="field">
                <label>Motivo</label>
                <select [value]="reason()" (change)="reason.set($any($event.target).value)" required>
                  @for (r of reasons; track r.value) {
                    <option [value]="r.value">{{ r.label }}</option>
                  }
                </select>
              </div>
            </div>

            @if (reason() === 'other') {
              <div class="field">
                <label>Detalle del motivo</label>
                <input type="text"
                  placeholder="Describe brevemente"
                  [value]="reasonText()"
                  (input)="reasonText.set($any($event.target).value)" />
              </div>
            }

            <div class="field">
              <label>Nota interna (opcional)</label>
              <textarea rows="2"
                placeholder="Ej: lote del horno 2, segunda tanda…"
                [value]="reviewNote()"
                (input)="reviewNote.set($any($event.target).value)"></textarea>
            </div>

            @if (productId() && qty() > 0) {
              <div class="preview">
                <div class="preview__title">
                  <ion-icon name="cash-outline"></ion-icon>
                  Impacto estimado
                </div>
                <div class="preview__row">
                  <span>Costo perdido</span>
                  <strong class="mono">₡{{ costPerdido() | number:'1.0-0' }}</strong>
                </div>
                @if (hasRecipe()) {
                  <div class="preview__row preview__row--sub">
                    <span class="muted">Se descontarán insumos:</span>
                  </div>
                  @for (s of supplyImpact(); track s.id) {
                    <div class="preview__row preview__row--detail">
                      <span>· {{ s.name }}</span>
                      <span class="mono">{{ s.qty | number:'1.0-3' }} {{ s.unit }}</span>
                    </div>
                  }
                } @else {
                  <div class="preview__row preview__row--sub">
                    <span class="muted">Producto de reventa — solo se registra costo perdido.</span>
                  </div>
                }
              </div>
            }

            <div class="actions">
              <ion-button fill="outline" (click)="closed.emit()">Cancelar</ion-button>
              <ion-button color="danger" [disabled]="!canSave()" (click)="save()">
                Registrar merma
              </ion-button>
            </div>
          </div>
        </ion-content>
      </ng-template>
    </ion-modal>
  `,
  styles: [`
    .form { padding: var(--ui-sp-3); display: flex; flex-direction: column; gap: var(--ui-sp-3); }
    .hint {
      padding: var(--ui-sp-2) var(--ui-sp-3);
      background: var(--ui-warning-tint);
      border-left: 3px solid var(--ui-warning);
      font-size: var(--ui-fs-xs);
      color: var(--ui-text);
    }
    .row { display: grid; grid-template-columns: 1fr 1.4fr; gap: var(--ui-sp-2); }
    @media (max-width: 500px) { .row { grid-template-columns: 1fr; } }
    .field { display: flex; flex-direction: column; gap: 4px; }
    .field label {
      font-size: var(--ui-fs-xs);
      font-weight: var(--ui-fw-black);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--ui-text-muted);
    }
    .field input, .field select, .field textarea {
      padding: 8px 10px;
      border: var(--ui-border-w-md) solid var(--ui-border);
      background: var(--ui-surface);
      font-family: var(--ui-font-sans);
      font-size: var(--ui-fs-sm);
    }
    .preview {
      padding: var(--ui-sp-2) var(--ui-sp-3);
      background: var(--ui-surface-2);
      border-left: 4px solid var(--ui-danger);
      display: flex; flex-direction: column;
      gap: 4px;
    }
    .preview__title {
      display: flex; align-items: center; gap: 6px;
      font-weight: var(--ui-fw-black);
      font-size: var(--ui-fs-sm);
      margin-bottom: 4px;
    }
    .preview__title ion-icon { color: var(--ui-danger); }
    .preview__row {
      display: flex; justify-content: space-between;
      font-size: var(--ui-fs-sm);
    }
    .preview__row--sub { font-size: var(--ui-fs-xs); }
    .preview__row--detail {
      font-size: var(--ui-fs-xs);
      color: var(--ui-text-muted);
      padding-left: var(--ui-sp-2);
    }
    .muted { color: var(--ui-text-muted); font-style: italic; }
    .actions {
      display: flex; gap: var(--ui-sp-2); justify-content: flex-end;
      padding-top: var(--ui-sp-2);
      border-top: var(--ui-border-w-sm) solid var(--ui-border);
    }
  `],
})
export class MermaProduccionModalComponent {
  @Input() isOpen = false;
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  private readonly data = inject(DataService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  protected readonly reasons = REASON_OPTIONS;

  readonly productId = signal('');
  readonly qty = signal(1);
  readonly reason = signal<ProductionMermaReason>('damaged');
  readonly reasonText = signal('');
  readonly reviewNote = signal('');

  readonly productos = computed(() =>
    this.data.activeProducts().slice().sort((a, b) => a.name.localeCompare(b.name))
  );

  readonly selectedProduct = computed(() =>
    this.productId() ? this.data.productById(this.productId()) : undefined
  );
  readonly hasRecipe = computed(() => !!this.selectedProduct()?.hasRecipe);

  readonly costPerdido = computed(() => {
    const id = this.productId();
    if (!id) return 0;
    return this.qty() * this.data.effectiveProductCost(id);
  });

  /** Lista de insumos que se descontarán (resolviendo BOM si tiene receta). */
  readonly supplyImpact = computed(() => {
    const id = this.productId();
    if (!id || !this.hasRecipe()) return [];
    const exploded = this.data.explodeBom(id, this.qty());
    return exploded.supplyNeeds.map(n => {
      const sup = this.data.supplyById(n.supplyId);
      return {
        id: n.supplyId,
        name: n.itemName,
        qty: n.qty,
        unit: sup?.unit ?? 'unidad',
      };
    });
  });

  readonly canSave = computed(() => {
    if (!this.productId() || this.qty() <= 0) return false;
    if (this.reason() === 'other' && !this.reasonText().trim()) return false;
    return true;
  });

  setQty(raw: string) {
    const n = Number(raw);
    this.qty.set(isFinite(n) && n > 0 ? Math.floor(n) : 1);
  }

  async save() {
    if (!this.canSave()) return;
    const u = this.auth.user();
    try {
      this.data.registerProductionMerma({
        productId: this.productId(),
        qty: this.qty(),
        reason: this.reason(),
        reasonText: this.reason() === 'other' ? this.reasonText() : undefined,
        reviewNote: this.reviewNote(),
        userId: u?.uid ?? 'admin',
        userName: u?.displayName ?? 'Admin',
      });
      await this.toast.show(`${this.qty()} unidad(es) registradas como merma de producción.`);
      this.reset();
      this.saved.emit();
    } catch (e: unknown) {
      await this.toast.show(e instanceof Error ? e.message : 'Error al registrar.', 'danger');
    }
  }

  private reset() {
    this.productId.set('');
    this.qty.set(1);
    this.reason.set('damaged');
    this.reasonText.set('');
    this.reviewNote.set('');
  }
}
