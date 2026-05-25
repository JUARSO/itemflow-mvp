import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
  IonButton, IonIcon, IonBadge,
} from '@ionic/angular/standalone';
import { DataService } from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../shared/components/toast/toast.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
interface ReceiptLine {
  /** Llave compuesta "kind:itemId" para el <select>. Vacío si aún no eligió. */
  itemKey: string;
  qty: number;
  unitCost: number;
}

interface ItemOption {
  key: string;            // "supply:s-harina" o "product:p-cafe"
  kind: 'supply' | 'product';
  itemId: string;
  name: string;
  unit: string;
  unitCost: number;
  fromSupplier: boolean;  // true si el item está en suppliedItems del proveedor seleccionado
}

/**
 * Registro de ingresos de inventario. Pensado para usarse cuando el
 * proveedor entrega mercadería: se elige al proveedor, se cargan las
 * líneas con cantidades y costos, y al confirmar se suma todo al stock y
 * se registran las entradas de kardex en una sola operación.
 *
 * Soporta query param `?supplier=<id>` para pre-seleccionar el proveedor.
 */
@Component({
  selector: 'app-ingresos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, DecimalPipe, RouterLink,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
    IonButton, IonIcon, IonBadge,
    PageHeaderComponent, KpiCardComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-menu-button></ion-menu-button></ion-buttons>
        <ion-title>Registrar ingreso</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <app-page-header
        title="Registrar ingreso de inventario"
        subtitle="Carga la mercadería recibida del proveedor: se suma al stock y queda registrada en el kardex.">
        <ion-button fill="outline" routerLink="/proveedores">Ver proveedores</ion-button>
        <ion-button fill="outline" routerLink="/ordenes-compra">Órdenes de compra</ion-button>
      </app-page-header>

      <div class="kpis">
        <app-kpi-card label="Ingresos hoy"
          [value]="receiptsTodayCount()" tone="success"
          [hint]="fmtCRC(receiptsTodayValue()) + ' en valor'"></app-kpi-card>
        <app-kpi-card label="Ingresos (7 días)"
          [value]="receipts7dCount()" tone="primary"
          [hint]="fmtCRC(receipts7dValue()) + ' en valor'"></app-kpi-card>
        <app-kpi-card label="Insumos bajos / críticos"
          [value]="lowSuppliesCount()" tone="danger"
          hint="requieren reposición"></app-kpi-card>
      </div>

      <div class="layout">
        <!-- Formulario -->
        <section class="form-block">
          <h2 class="block__title">Datos del ingreso</h2>

          <div class="grid-2">
            <div class="field">
              <label>Proveedor</label>
              <select [value]="supplierId()"
                (change)="onSelectSupplier($any($event.target).value)">
                <option value="">— Sin proveedor / interno —</option>
                @for (s of data.activeSuppliers(); track s.id) {
                  <option [value]="s.id">{{ s.name }}</option>
                }
              </select>
            </div>
            <div class="field">
              <label>Fecha de recepción</label>
              <input type="date" [value]="receivedIso()"
                (change)="receivedIso.set($any($event.target).value)" />
            </div>
          </div>

          <div class="grid-2">
            <div class="field">
              <label>Referencia (factura, remisión)</label>
              <input type="text" placeholder="Ej: FAC-2025-00123"
                [value]="reference()"
                (input)="reference.set($any($event.target).value)" />
            </div>
            <div class="field">
              <label>Motivo</label>
              <select [value]="reason()"
                (change)="reason.set($any($event.target).value)">
                <option value="purchase">Compra</option>
                <option value="donation">Donación</option>
                <option value="manual">Carga manual / inicial</option>
              </select>
            </div>
          </div>

          <div class="field">
            <label>Notas internas (opcional)</label>
            <textarea rows="2"
              placeholder="Ej: orden parcial, recibido por…"
              [value]="notes()"
              (input)="notes.set($any($event.target).value)"></textarea>
          </div>

          <!-- Líneas -->
          <div class="lines">
            <div class="lines__head">
              <h3 class="lines__title">Líneas del ingreso ({{ lines().length }})</h3>
              <ion-button size="small" (click)="addLine()">+ Agregar insumo</ion-button>
            </div>

            @if (lines().length === 0) {
              <p class="empty">Sin líneas. Agrega al menos un insumo recibido.</p>
            } @else {
              @for (l of lines(); track $index; let i = $index) {
                <div class="line">
                  <div class="line__col line__col--supply">
                    <label>Insumo / producto</label>
                    <select [value]="l.itemKey"
                      (change)="updateLine(i, { itemKey: $any($event.target).value })">
                      <option value="">— Selecciona —</option>
                      @if (hasSupplierItems()) {
                        <optgroup [label]="'Asignados a ' + supplierName()">
                          @for (opt of supplierOptions(); track opt.key) {
                            <option [value]="opt.key">
                              {{ opt.name }} ({{ opt.unit }})
                              {{ opt.kind === 'product' ? '· reventa' : '' }}
                            </option>
                          }
                        </optgroup>
                        <optgroup label="Otros (sin asignar a este proveedor)">
                          @for (opt of nonSupplierOptions(); track opt.key) {
                            <option [value]="opt.key">
                              {{ opt.name }} ({{ opt.unit }})
                              {{ opt.kind === 'product' ? '· reventa' : '' }}
                            </option>
                          }
                        </optgroup>
                      } @else {
                        @for (opt of allItemOptions(); track opt.key) {
                          <option [value]="opt.key">
                            {{ opt.name }} ({{ opt.unit }})
                            {{ opt.kind === 'product' ? '· reventa' : '' }}
                          </option>
                        }
                      }
                    </select>
                  </div>
                  <div class="line__col">
                    <label>Cantidad</label>
                    <input type="number" min="0" step="any"
                      [value]="l.qty"
                      (input)="updateLine(i, { qty: asNum($any($event.target).value) })" />
                  </div>
                  <div class="line__col">
                    <label>Costo unit.</label>
                    <input type="number" min="0" step="any"
                      [value]="l.unitCost"
                      (input)="updateLine(i, { unitCost: asNum($any($event.target).value) })" />
                  </div>
                  <div class="line__col line__col--sub">
                    <label>Subtotal</label>
                    <div class="line__sub mono">₡{{ (l.qty * l.unitCost) | number:'1.0-0' }}</div>
                  </div>
                  <button class="line__remove" type="button" (click)="removeLine(i)" title="Quitar">
                    <ion-icon name="trash-outline"></ion-icon>
                  </button>
                </div>
              }
            }
          </div>

          <div class="totals">
            <div class="totals__row">
              <span>Total ingresado</span>
              <strong class="mono">₡{{ totalValue() | number:'1.0-0' }}</strong>
            </div>
            <div class="totals__row totals__row--sub">
              <span class="muted">{{ totalLines() }} línea(s) · {{ totalUnits() | number:'1.0-2' }} unid.</span>
            </div>
          </div>

          <div class="actions">
            <ion-button fill="outline" (click)="reset()">Limpiar</ion-button>
            <ion-button color="primary" (click)="confirmar()" [disabled]="!canSubmit()">
              <ion-icon name="checkmark-circle-outline" slot="start"></ion-icon>
              Confirmar ingreso
            </ion-button>
          </div>
        </section>

        <!-- Ingresos recientes -->
        <aside class="recent">
          <h2 class="block__title">Ingresos recientes</h2>
          @if (recentReceipts().length === 0) {
            <p class="empty">No hay ingresos recientes.</p>
          } @else {
            <div class="recent__list">
              @for (k of recentReceipts(); track k.id) {
                <div class="recent__row">
                  <div class="recent__head">
                    <span class="mono">+{{ k.qty | number:'1.0-2' }}</span>
                    <ion-badge color="success">{{ reasonLabel(k.reason) }}</ion-badge>
                  </div>
                  <div class="recent__name">{{ k.itemName }}</div>
                  <div class="recent__meta">
                    {{ k.at | date:'dd-MM HH:mm' }} · {{ k.userName }}
                    @if (k.cost) {
                      · <span class="mono">₡{{ (k.qty * k.cost) | number:'1.0-0' }}</span>
                    }
                  </div>
                  @if (k.note) {
                    <div class="recent__note">{{ k.note }}</div>
                  }
                </div>
              }
            </div>
          }
        </aside>
      </div>
    </ion-content>
  `,
  styles: [`
    .kpis {
      display: grid; grid-template-columns: repeat(3, 1fr);
      gap: var(--ui-sp-3); padding: 0 var(--ui-sp-4) var(--ui-sp-3);
    }
    @media (max-width: 700px) { .kpis { grid-template-columns: 1fr; } }

    .layout {
      display: grid; grid-template-columns: 1fr 360px;
      gap: var(--ui-sp-3); padding: 0 var(--ui-sp-4) var(--ui-sp-8);
    }
    @media (max-width: 1000px) { .layout { grid-template-columns: 1fr; } }

    .form-block, .recent {
      background: var(--ui-surface);
      border: var(--ui-border-w-md) solid var(--ui-border);
      box-shadow: var(--ui-shadow-md);
      padding: var(--ui-sp-3);
    }
    .block__title {
      margin: 0 0 var(--ui-sp-2);
      font-family: var(--ui-font-display);
      font-weight: var(--ui-fw-black);
      font-size: var(--ui-fs-lg);
    }

    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: var(--ui-sp-2); margin-bottom: var(--ui-sp-2); }
    @media (max-width: 500px) { .grid-2 { grid-template-columns: 1fr; } }

    .field { display: flex; flex-direction: column; gap: 4px; margin-bottom: var(--ui-sp-2); }
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

    .lines {
      margin: var(--ui-sp-3) 0 var(--ui-sp-2);
      padding: var(--ui-sp-2);
      background: var(--ui-surface-2);
    }
    .lines__head {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: var(--ui-sp-2);
    }
    .lines__title {
      margin: 0; font-size: var(--ui-fs-md); font-weight: var(--ui-fw-black);
    }
    .empty { color: var(--ui-text-muted); font-size: var(--ui-fs-sm); padding: var(--ui-sp-3); text-align: center; }

    .line {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr 1fr auto;
      gap: 6px;
      align-items: flex-end;
      padding: 6px;
      background: var(--ui-surface);
      margin-bottom: 4px;
    }
    @media (max-width: 700px) {
      .line { grid-template-columns: 1fr 1fr; }
      .line__col--supply { grid-column: 1 / -1; }
    }
    .line__col { display: flex; flex-direction: column; gap: 2px; }
    .line__col label {
      font-size: 10px;
      text-transform: uppercase;
      color: var(--ui-text-muted);
      font-weight: var(--ui-fw-black);
    }
    .line__col input, .line__col select {
      padding: 6px;
      border: var(--ui-border-w-sm) solid var(--ui-border);
      font-family: var(--ui-font-sans);
      font-size: var(--ui-fs-sm);
    }
    .line__col--sub { text-align: right; }
    .line__sub {
      padding: 6px 0;
      font-weight: var(--ui-fw-black);
      font-size: var(--ui-fs-sm);
    }
    .line__remove {
      width: 32px; height: 32px;
      background: var(--ui-danger);
      color: #fff;
      border: var(--ui-border-w-sm) solid var(--ui-danger);
      cursor: pointer;
      display: inline-flex; align-items: center; justify-content: center;
      align-self: flex-end;
    }
    .line__remove ion-icon { font-size: 16px; color: #fff; }

    .totals {
      padding: var(--ui-sp-2);
      background: var(--ui-text);
      color: var(--ui-surface);
    }
    .totals__row {
      display: flex; justify-content: space-between; align-items: center;
      font-size: var(--ui-fs-lg);
      font-weight: var(--ui-fw-black);
    }
    .totals__row--sub { font-size: var(--ui-fs-xs); font-weight: var(--ui-fw-bold); }
    .totals__row .muted { color: rgba(255,255,255,0.7); }

    .actions {
      display: flex; justify-content: flex-end;
      gap: var(--ui-sp-2);
      margin-top: var(--ui-sp-3);
    }

    .recent__list { display: flex; flex-direction: column; gap: 6px; }
    .recent__row {
      padding: 8px;
      background: var(--ui-surface-2);
      display: flex; flex-direction: column; gap: 2px;
    }
    .recent__head {
      display: flex; justify-content: space-between; align-items: center;
      font-size: var(--ui-fs-sm); font-weight: var(--ui-fw-black);
      color: var(--ui-success);
    }
    .recent__name { font-size: var(--ui-fs-sm); font-weight: var(--ui-fw-bold); }
    .recent__meta { font-size: var(--ui-fs-xs); color: var(--ui-text-muted); }
    .recent__note {
      font-size: 10px; color: var(--ui-text);
      padding: 4px 6px;
      background: var(--ui-surface);
      font-style: italic;
      margin-top: 4px;
    }
  `],
})
export class IngresosPage implements OnInit {
  protected readonly data = inject(DataService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);

  readonly supplierId = signal('');
  readonly receivedIso = signal(this.todayIso());
  readonly reference = signal('');
  readonly reason = signal<'purchase' | 'donation' | 'manual'>('purchase');
  readonly notes = signal('');
  readonly lines = signal<ReceiptLine[]>([]);

  /** Catálogo completo (insumos + productos reventa) en formato unificado. */
  readonly allItemOptions = computed<ItemOption[]>(() => {
    const sup = this.data.activeSupplies().map(s => ({
      key: `supply:${s.id}`,
      kind: 'supply' as const,
      itemId: s.id,
      name: s.name,
      unit: s.unit,
      unitCost: s.cost,
      fromSupplier: false,
    }));
    const prod = this.data.activeProducts()
      .filter(p => !p.hasRecipe)
      .map(p => ({
        key: `product:${p.id}`,
        kind: 'product' as const,
        itemId: p.id,
        name: p.name,
        unit: p.unit,
        unitCost: p.buyPrice,
        fromSupplier: false,
      }));
    return [...sup, ...prod].sort((a, b) => a.name.localeCompare(b.name));
  });

  readonly currentSupplier = computed(() =>
    this.supplierId() ? this.data.supplierById(this.supplierId()) : undefined
  );

  readonly supplierName = computed(() => this.currentSupplier()?.name ?? '');

  readonly hasSupplierItems = computed(() =>
    (this.currentSupplier()?.suppliedItems?.length ?? 0) > 0
  );

  /** Items declarados por el proveedor (van primero en el dropdown). */
  readonly supplierOptions = computed<ItemOption[]>(() => {
    const s = this.currentSupplier();
    if (!s) return [];
    const keys = new Set(s.suppliedItems.map(i => `${i.kind}:${i.itemId}`));
    return this.allItemOptions()
      .filter(o => keys.has(o.key))
      .map(o => ({ ...o, fromSupplier: true }));
  });

  /** Items NO declarados por el proveedor (segundo grupo del dropdown). */
  readonly nonSupplierOptions = computed<ItemOption[]>(() => {
    const s = this.currentSupplier();
    if (!s) return this.allItemOptions();
    const keys = new Set(s.suppliedItems.map(i => `${i.kind}:${i.itemId}`));
    return this.allItemOptions().filter(o => !keys.has(o.key));
  });

  readonly canSubmit = computed(() =>
    this.lines().length > 0 &&
    this.lines().every(l => l.itemKey && l.qty > 0)
  );

  readonly totalValue = computed(() =>
    this.lines().reduce((s, l) => s + l.qty * l.unitCost, 0)
  );
  readonly totalLines = computed(() => this.lines().filter(l => l.itemKey).length);
  readonly totalUnits = computed(() => this.lines().reduce((s, l) => s + l.qty, 0));

  /** Ingreso = kardex `in` con reason purchase/donation/manual. */
  private readonly receiptReasons = new Set(['purchase', 'donation', 'manual']);
  private isReceipt(k: { type: string; reason: string }) {
    return k.type === 'in' && this.receiptReasons.has(k.reason);
  }

  readonly recentReceipts = computed(() =>
    [...this.data.kardex()]
      .filter(k => this.isReceipt(k))
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice(0, 15)
  );

  readonly receiptsTodayCount = computed(() => {
    const cutoff = new Date(); cutoff.setHours(0, 0, 0, 0);
    return this.data.kardex().filter(k =>
      this.isReceipt(k) && k.at.getTime() >= cutoff.getTime()
    ).length;
  });
  readonly receiptsTodayValue = computed(() => {
    const cutoff = new Date(); cutoff.setHours(0, 0, 0, 0);
    return this.data.kardex().filter(k =>
      this.isReceipt(k) && k.at.getTime() >= cutoff.getTime()
    ).reduce((s, k) => s + k.qty * (k.cost ?? 0), 0);
  });
  readonly receipts7dCount = computed(() => {
    const cutoff = Date.now() - 7 * 86_400_000;
    return this.data.kardex().filter(k =>
      this.isReceipt(k) && k.at.getTime() >= cutoff
    ).length;
  });
  readonly receipts7dValue = computed(() => {
    const cutoff = Date.now() - 7 * 86_400_000;
    return this.data.kardex().filter(k =>
      this.isReceipt(k) && k.at.getTime() >= cutoff
    ).reduce((s, k) => s + k.qty * (k.cost ?? 0), 0);
  });
  readonly lowSuppliesCount = computed(() =>
    this.data.supplyStock().filter(s =>
      s.status === 'low' || s.status === 'critical' || s.status === 'out'
    ).length
  );

  ngOnInit() {
    const preSupplier = this.route.snapshot.queryParamMap.get('supplier');
    if (preSupplier) this.supplierId.set(preSupplier);
  }

  onSelectSupplier(id: string) { this.supplierId.set(id); }

  addLine() {
    this.lines.update(arr => [...arr, { itemKey: '', qty: 0, unitCost: 0 }]);
  }
  removeLine(i: number) {
    this.lines.update(arr => arr.filter((_, idx) => idx !== i));
  }
  updateLine(i: number, patch: Partial<ReceiptLine>) {
    this.lines.update(arr => arr.map((l, idx) => {
      if (idx !== i) return l;
      const updated = { ...l, ...patch };
      // Si cambió el item y no se setó costo, sugerir el del catálogo
      if (patch.itemKey && (!l.unitCost || l.unitCost === 0)) {
        const opt = this.allItemOptions().find(o => o.key === patch.itemKey);
        if (opt) updated.unitCost = opt.unitCost;
      }
      return updated;
    }));
  }

  asNum(raw: string): number {
    const n = Number(raw);
    return isFinite(n) && n >= 0 ? n : 0;
  }

  reset() {
    this.supplierId.set('');
    this.receivedIso.set(this.todayIso());
    this.reference.set('');
    this.reason.set('purchase');
    this.notes.set('');
    this.lines.set([]);
  }

  async confirmar() {
    if (!this.canSubmit()) return;
    const u = this.auth.user();
    const supplier = this.supplierId() ? this.data.supplierById(this.supplierId()) : undefined;
    try {
      const result = this.data.registerInventoryReceipt({
        supplierId: this.supplierId() || undefined,
        supplierName: supplier?.name,
        reference: this.reference().trim() || undefined,
        receivedAt: new Date(this.receivedIso() + 'T00:00:00'),
        reason: this.reason(),
        notes: this.notes().trim() || undefined,
        items: this.lines()
          .filter(l => l.itemKey && l.qty > 0)
          .map(l => {
            const [kind, itemId] = l.itemKey.split(':') as ['supply' | 'product', string];
            return { kind, itemId, qty: l.qty, unitCost: l.unitCost };
          }),
        userId: u?.uid ?? 'admin',
        userName: u?.displayName ?? 'Admin',
      });
      await this.toast.show(`${result.kardexIds.length} ingreso(s) registrado(s).`);
      this.reset();
    } catch (e: unknown) {
      await this.toast.show(e instanceof Error ? e.message : 'Error al registrar.', 'danger');
    }
  }

  reasonLabel(r: string): string {
    return ({
      purchase: 'Compra',
      donation: 'Donación',
      manual: 'Manual',
    } as Record<string, string>)[r] ?? r;
  }

  fmtCRC(v: number): string {
    if (Math.abs(v) >= 1_000_000) return '₡' + (v / 1_000_000).toFixed(1) + 'M';
    if (Math.abs(v) >= 10_000) return '₡' + (v / 1000).toFixed(1) + 'K';
    return '₡' + new Intl.NumberFormat('es-CR', { maximumFractionDigits: 0 }).format(v);
  }

  private todayIso(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
