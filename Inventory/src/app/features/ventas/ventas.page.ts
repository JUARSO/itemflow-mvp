import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
  IonButton, IonSegment, IonSegmentButton, IonLabel, IonIcon,
} from '@ionic/angular/standalone';
import { DataService } from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';
import { TenantContextService } from '../../core/services/tenant-context.service';
import { ToastService } from '../../shared/components/toast/toast.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { BulkImportModalComponent, BulkImportConfig } from '../../shared/components/bulk-import/bulk-import-modal.component';
import { ReadOnlyBannerComponent } from '../../shared/components/readonly-banner/readonly-banner.component';
import { Product, SaleRecord } from '../../core/models';

type Tab = 'vender' | 'historico';
type Range = '7d' | '30d' | 'todo';

interface CartLine {
  productId: string;
  productName: string;
  unit: string;
  qty: number;
  unitPrice: number;
  maxStock: number;
}

@Component({
  selector: 'app-ventas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, DecimalPipe, RouterLink,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
    IonButton, IonSegment, IonSegmentButton, IonLabel, IonIcon,
    PageHeaderComponent, KpiCardComponent, BulkImportModalComponent, ReadOnlyBannerComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-menu-button></ion-menu-button></ion-buttons>
        <ion-title>Ventas</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <app-page-header
        title="Ventas"
        subtitle="Arma una venta con varios productos. El stock viene de las órdenes que producción ya completó.">
        <ion-button fill="outline" routerLink="/pedidos">→ Órdenes a producción</ion-button>
        <ion-button fill="outline" (click)="bulkOpen.set(true)">↥ Importar histórico CSV</ion-button>
      </app-page-header>

      <div class="kpis">
        <app-kpi-card label="SKUs disponibles" [value]="productosConStock().length" tone="success"
          hint="con stock > 0"></app-kpi-card>
        <app-kpi-card label="Unidades en tienda" [value]="totalUnidadesStock()" tone="primary"></app-kpi-card>
        <app-kpi-card label="Ventas hoy" [value]="ventasHoy()" tone="transit"></app-kpi-card>
        <app-kpi-card label="Ingresos hoy" [value]="'₡' + (ingresosHoy() | number:'1.0-0')" tone="warning"></app-kpi-card>
      </div>

      <div class="tabs">
        <ion-segment [value]="tab()" (ionChange)="tab.set($any($event.detail.value))">
          <ion-segment-button value="vender"><ion-label>Vender</ion-label></ion-segment-button>
          <ion-segment-button value="historico"><ion-label>Histórico</ion-label></ion-segment-button>
        </ion-segment>
      </div>

      <app-readonly-banner></app-readonly-banner>

      @if (tab() === 'vender') {
        <div class="layout">
          <!-- Panel de productos -->
          <div class="products-panel">
            @if (productos().length === 0) {
              <div class="empty">
                <h3>No hay productos para vender</h3>
                <p>Crea una orden de producción y complétala para tener stock.</p>
                <ion-button routerLink="/pedidos">Ir a órdenes</ion-button>
              </div>
            }

            <div class="products">
              @for (p of productos(); track p.id) {
                <button class="product"
                  (click)="addToCart(p)"
                  [attr.data-out]="stockOf(p.id) - cartQtyOf(p.id) <= 0"
                  [disabled]="!tenant.canSell() || stockOf(p.id) - cartQtyOf(p.id) <= 0">
                  <div class="product__head">
                    <div class="product__name">{{ p.name }}</div>
                    <div class="product__stock mono" [class.zero]="stockOf(p.id) - cartQtyOf(p.id) <= 0">
                      {{ stockOf(p.id) - cartQtyOf(p.id) }}
                      @if (cartQtyOf(p.id) > 0) { <span class="badge">+{{ cartQtyOf(p.id) }}</span> }
                    </div>
                  </div>
                  <div class="product__foot">
                    <span class="product__price mono">₡{{ p.sellPrice | number:'1.0-0' }}</span>
                    <span class="product__cta">
                      @if (stockOf(p.id) - cartQtyOf(p.id) > 0) { + Agregar } @else { Agotado }
                    </span>
                  </div>
                </button>
              }
            </div>
          </div>

          <!-- Panel carrito (solo si puede vender) -->
          @if (tenant.canSell()) {
          <aside class="cart" [class.cart--has-items]="cart().length > 0">
            <div class="cart__head">
              <h3>Carrito ({{ cart().length }})</h3>
              @if (cart().length > 0) {
                <button type="button" class="cart__clear" (click)="clearCart()">Vaciar</button>
              }
            </div>

            @if (cart().length === 0) {
              <div class="cart__empty">
                <p>Toca un producto para agregarlo.</p>
                <p class="cart__hint">Puedes agregar varios productos y vender todos en una transacción.</p>
              </div>
            }

            <div class="cart__list">
              @for (line of cart(); track line.productId) {
                <div class="line">
                  <div class="line__head">
                    <span class="line__name">{{ line.productName }}</span>
                    <button type="button" class="line__remove"
                      (click)="removeLine(line.productId)" aria-label="Quitar">×</button>
                  </div>
                  <div class="line__row">
                    <div class="line__qty-wrap">
                      <button type="button" class="qty-btn"
                        (click)="decQty(line.productId)" [disabled]="line.qty <= 1">−</button>
                      <input type="number" class="line__qty mono"
                        [value]="line.qty" min="1" [max]="line.maxStock"
                        (input)="updateQty(line.productId, $any($event.target).valueAsNumber)" />
                      <button type="button" class="qty-btn"
                        (click)="incQty(line.productId)" [disabled]="line.qty >= line.maxStock">+</button>
                    </div>
                    <span class="line__unit">{{ line.unit }}</span>
                  </div>
                  <div class="line__row">
                    <span class="line__label">Precio c/u</span>
                    <input type="number" class="line__price mono"
                      [value]="line.unitPrice" min="0"
                      (input)="updatePrice(line.productId, $any($event.target).valueAsNumber)" />
                  </div>
                  <div class="line__subtotal">
                    <span>Subtotal</span>
                    <strong class="mono">₡{{ line.qty * line.unitPrice | number:'1.0-0' }}</strong>
                  </div>
                  @if (line.qty > line.maxStock) {
                    <div class="line__warn"><ion-icon name="warning-outline"></ion-icon> Solo hay {{ line.maxStock }} disponibles</div>
                  }
                </div>
              }
            </div>

            @if (cart().length > 0) {
              <div class="cart__totals">
                <div class="totals-row">
                  <span>Items</span>
                  <span class="mono">{{ cart().length }}</span>
                </div>
                <div class="totals-row">
                  <span>Unidades</span>
                  <span class="mono">{{ totalUnidadesCarrito() }}</span>
                </div>
                <div class="totals-row totals-row--big">
                  <span>Total</span>
                  <span class="mono">₡{{ totalCarrito() | number:'1.0-0' }}</span>
                </div>
              </div>

              <div class="cart__actions">
                <ion-button expand="block" color="success"
                  (click)="confirmSale()" [disabled]="!canSell()">
                  Confirmar venta · ₡{{ totalCarrito() | number:'1.0-0' }}
                </ion-button>
              </div>
            }
          </aside>
          }
        </div>
      } @else {
        <div class="hist-range">
          <ion-segment [value]="range()" (ionChange)="range.set($any($event.detail.value))">
            <ion-segment-button value="7d"><ion-label>7 días</ion-label></ion-segment-button>
            <ion-segment-button value="30d"><ion-label>30 días</ion-label></ion-segment-button>
            <ion-segment-button value="todo"><ion-label>Todo</ion-label></ion-segment-button>
          </ion-segment>
        </div>

        <div class="hist-kpis">
          <span><strong>{{ visibles().length }}</strong> ventas · </span>
          <span><strong>{{ totalUnidadesVisibles() }}</strong> unidades · </span>
          <span><strong>₡{{ totalIngresosVisibles() | number:'1.0-0' }}</strong> ingresos</span>
        </div>

        <div class="table">
          <div class="table__head">
            <div>Fecha</div>
            <div>Producto</div>
            <div class="num">Cantidad</div>
            <div class="num">P. Unit.</div>
            <div class="num">Total</div>
          </div>
          @for (s of visibles(); track s.id) {
            <div class="table__row">
              <div class="mono">{{ s.date | date:'dd-MM HH:mm' }}</div>
              <div>{{ s.productName }}</div>
              <div class="num mono">{{ s.qty | number:'1.0-0' }}</div>
              <div class="num mono">₡{{ s.unitPrice | number:'1.0-0' }}</div>
              <div class="num mono"><strong>₡{{ s.total | number:'1.0-0' }}</strong></div>
            </div>
          }
        </div>
      }

      <app-bulk-import-modal
        [isOpen]="bulkOpen()"
        [config]="bulkConfig"
        (closed)="bulkOpen.set(false)">
      </app-bulk-import-modal>
    </ion-content>
  `,
  styles: [`
    .kpis {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: var(--ui-sp-3);
      padding: 0 var(--ui-sp-4) var(--ui-sp-4);
    }
    @media (max-width: 900px) { .kpis { grid-template-columns: 1fr 1fr; } }
    @media (max-width: 480px) { .kpis { grid-template-columns: 1fr; } }

    .tabs { padding: 0 var(--ui-sp-4) var(--ui-sp-3); }

    /* Layout principal: productos + carrito */
    .layout {
      display: grid;
      grid-template-columns: 1fr 360px;
      gap: var(--ui-sp-4);
      padding: 0 var(--ui-sp-4) var(--ui-sp-8);
      align-items: start;
    }
    @media (max-width: 900px) {
      .layout { grid-template-columns: 1fr; }
    }
    .readonly-banner {
      margin: 0 var(--ui-sp-4) var(--ui-sp-3);
      padding: var(--ui-sp-2) var(--ui-sp-3);
      background: var(--ui-surface-2);
      border-left: 4px solid var(--ui-warning);
      font-size: var(--ui-fs-sm);
      color: var(--ui-text);
      display: flex;
      align-items: center;
      gap: var(--ui-sp-2);
    }
    .readonly-banner ion-icon { font-size: 18px; color: var(--ui-warning); }

    .empty {
      padding: var(--ui-sp-6) var(--ui-sp-4);
      text-align: center;
      background: var(--ui-surface-2);
      border: var(--ui-border-w-md) dashed var(--ui-border);
      margin-bottom: var(--ui-sp-3);
    }
    .empty h3 { margin: 0 0 var(--ui-sp-2); font-size: var(--ui-fs-lg); }
    .empty p { margin: 0 0 var(--ui-sp-3); color: var(--ui-text-muted); font-size: var(--ui-fs-sm); }

    .products {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: var(--ui-sp-3);
    }
    .product {
      text-align: left;
      background: var(--ui-surface);
      border: var(--ui-border-w-md) solid var(--ui-border);
      box-shadow: var(--ui-shadow-md);
      padding: var(--ui-sp-3);
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: var(--ui-sp-2);
      font-family: var(--ui-font-sans);
      color: var(--ui-text);
      min-height: 110px;
    }
    .product:hover:not([disabled]) { background: var(--ui-surface-2); }
    .product:active:not([disabled]) { box-shadow: none; transform: translate(2px, 2px); }
    .product[disabled] {
      opacity: 0.45;
      cursor: not-allowed;
      background: var(--ui-surface-2);
    }
    .product__head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: var(--ui-sp-2);
    }
    .product__name {
      font-weight: var(--ui-fw-black);
      font-size: var(--ui-fs-sm);
      line-height: 1.2;
    }
    .product__stock {
      font-size: var(--ui-fs-lg);
      font-weight: var(--ui-fw-black);
      color: var(--ui-success);
      line-height: 1;
    }
    .product__stock.zero { color: var(--ui-danger); }
    .badge {
      display: inline-block;
      font-size: 9px;
      background: var(--ui-primary);
      color: var(--ui-primary-contrast);
      padding: 2px 4px;
      margin-left: 4px;
      font-weight: var(--ui-fw-black);
      letter-spacing: 0.5px;
    }
    .product__foot {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: var(--ui-sp-2);
      border-top: var(--ui-border-w-sm) solid var(--ui-border);
      font-size: var(--ui-fs-xs);
    }
    .product__price {
      font-weight: var(--ui-fw-bold);
      font-size: var(--ui-fs-sm);
    }
    .product__cta {
      font-weight: var(--ui-fw-black);
      color: var(--ui-primary);
    }

    /* Carrito */
    .cart {
      position: sticky;
      top: var(--ui-sp-3);
      background: var(--ui-surface);
      border: var(--ui-border-w-md) solid var(--ui-border);
      box-shadow: var(--ui-shadow-md);
      display: flex;
      flex-direction: column;
      max-height: calc(100vh - 120px);
    }
    @media (max-width: 900px) {
      .cart {
        position: static;
        max-height: none;
        margin-top: var(--ui-sp-3);
      }
    }
    .cart__head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--ui-sp-3);
      background: var(--ui-primary);
      color: var(--ui-primary-contrast);
      border-bottom: var(--ui-border-w-md) solid var(--ui-border);
    }
    .cart__head h3 {
      margin: 0;
      font-family: var(--ui-font-display);
      font-weight: var(--ui-fw-black);
      font-size: var(--ui-fs-md);
    }
    .cart__clear {
      background: transparent;
      color: var(--ui-primary-contrast);
      border: var(--ui-border-w-sm) solid currentColor;
      padding: 4px 10px;
      font-size: var(--ui-fs-xs);
      font-weight: var(--ui-fw-bold);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      cursor: pointer;
    }
    .cart__empty {
      padding: var(--ui-sp-4);
      text-align: center;
      color: var(--ui-text-muted);
      font-size: var(--ui-fs-sm);
    }
    .cart__empty p { margin: 0 0 var(--ui-sp-2); }
    .cart__hint { font-size: var(--ui-fs-xs); }

    .cart__list {
      flex: 1;
      overflow-y: auto;
      padding: var(--ui-sp-2);
      display: flex;
      flex-direction: column;
      gap: var(--ui-sp-2);
    }
    .line {
      padding: var(--ui-sp-2);
      border: var(--ui-border-w-sm) solid var(--ui-border);
      background: var(--ui-surface-2);
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .line__head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--ui-sp-2);
    }
    .line__name {
      font-weight: var(--ui-fw-bold);
      font-size: var(--ui-fs-sm);
    }
    .line__remove {
      width: 24px;
      height: 24px;
      background: var(--ui-danger);
      color: #fff;
      border: var(--ui-border-w-sm) solid var(--ui-border);
      font-size: 16px;
      font-weight: var(--ui-fw-black);
      cursor: pointer;
      line-height: 1;
    }
    .line__row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--ui-sp-2);
      font-size: var(--ui-fs-xs);
    }
    .line__qty-wrap {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .qty-btn {
      width: 28px; height: 28px;
      background: var(--ui-surface);
      border: var(--ui-border-w-sm) solid var(--ui-border);
      font-weight: var(--ui-fw-black);
      cursor: pointer;
      font-size: var(--ui-fs-md);
      line-height: 1;
    }
    .qty-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .line__qty {
      width: 56px;
      padding: 4px 6px;
      text-align: center;
      border: var(--ui-border-w-sm) solid var(--ui-border);
      background: var(--ui-surface);
      font-family: var(--ui-font-mono);
      font-size: var(--ui-fs-sm);
      font-weight: var(--ui-fw-bold);
    }
    .line__unit {
      font-size: var(--ui-fs-xs);
      color: var(--ui-text-muted);
    }
    .line__label {
      font-size: var(--ui-fs-xs);
      color: var(--ui-text-muted);
    }
    .line__price {
      width: 90px;
      padding: 4px 6px;
      text-align: right;
      border: var(--ui-border-w-sm) solid var(--ui-border);
      background: var(--ui-surface);
      font-family: var(--ui-font-mono);
      font-size: var(--ui-fs-sm);
    }
    .line__subtotal {
      display: flex;
      justify-content: space-between;
      font-size: var(--ui-fs-sm);
      padding-top: 4px;
      border-top: var(--ui-border-w-sm) solid var(--ui-border);
    }
    .line__warn {
      font-size: var(--ui-fs-xs);
      color: var(--ui-danger);
      font-weight: var(--ui-fw-bold);
    }
    .line__warn ion-icon { vertical-align: middle; font-size: 13px; }

    .cart__totals {
      padding: var(--ui-sp-3);
      background: var(--ui-surface-2);
      border-top: var(--ui-border-w-md) solid var(--ui-border);
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      font-size: var(--ui-fs-sm);
      padding: 2px 0;
    }
    .totals-row--big {
      font-size: var(--ui-fs-lg);
      font-weight: var(--ui-fw-black);
      margin-top: 4px;
      padding-top: 6px;
      border-top: var(--ui-border-w-sm) solid var(--ui-border);
    }
    .cart__actions {
      padding: var(--ui-sp-3);
      border-top: var(--ui-border-w-md) solid var(--ui-border);
    }

    /* Histórico */
    .hist-range { padding: 0 var(--ui-sp-4) var(--ui-sp-3); }
    .hist-kpis {
      padding: 0 var(--ui-sp-4) var(--ui-sp-3);
      font-size: var(--ui-fs-sm);
      color: var(--ui-text-muted);
    }

    .table {
      margin: 0 var(--ui-sp-4) var(--ui-sp-8);
      border: var(--ui-border-w-md) solid var(--ui-border);
      box-shadow: var(--ui-shadow-md);
      background: var(--ui-surface);
    }
    .table__head, .table__row {
      display: grid;
      grid-template-columns: 130px 1.5fr 90px 100px 120px;
      gap: var(--ui-sp-3);
      padding: var(--ui-sp-3) var(--ui-sp-4);
      align-items: center;
    }
    .table__head {
      background: var(--ui-text);
      color: var(--ui-surface);
      font-size: var(--ui-fs-xs);
      font-weight: var(--ui-fw-black);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .table__row { border-top: var(--ui-border-w-sm) solid var(--ui-border); font-size: var(--ui-fs-sm); }
    .table__row:hover { background: var(--ui-surface-3); }
    .num { text-align: right; }

    @media (max-width: 768px) {
      .table__head { display: none; }
      .table__row {
        grid-template-columns: 1fr 1fr;
        gap: 4px var(--ui-sp-2);
        padding: var(--ui-sp-3) var(--ui-sp-4);
        border-bottom: var(--ui-border-w-sm) solid var(--ui-border);
      }
      .num { text-align: left; font-size: var(--ui-fs-sm); }
    }
  `],
})
export class VentasPage {
  protected readonly data = inject(DataService);
  protected readonly tenant = inject(TenantContextService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly tab = signal<Tab>('vender');
  readonly range = signal<Range>('7d');
  readonly bulkOpen = signal(false);
  readonly cart = signal<CartLine[]>([]);

  readonly bulkConfig: BulkImportConfig<SaleRecord> = {
    entityLabel: 'venta',
    entityLabelPlural: 'ventas',
    templateFilename: 'plantilla-ventas.csv',
    headers: ['fecha', 'producto_sku', 'cantidad', 'precio_unitario'],
    templateRows: [
      ['2026-05-15', 'PROD-BAG-001', '12', '1200'],
      ['2026-05-15', 'PROD-MAR-001', '40', '350'],
      ['2026-05-16', 'PROD-BAG-001', '8', '1200'],
    ],
    hint: 'Importa ventas históricas (NO afecta stock actual). Fecha en formato YYYY-MM-DD o ISO. El producto debe existir (busca por SKU).',
    process: (rows) => {
      const errors: { row: number; raw: Record<string, string>; message: string }[] = [];
      const valid: SaleRecord[] = [];
      const products = new Map(this.data.activeProducts().map(p => [p.sku.toLowerCase(), p]));
      const base = Date.now();
      rows.forEach((r, i) => {
        const rowNum = i + 2;
        const fechaStr = (r['fecha'] ?? '').trim();
        const prodSku = (r['producto_sku'] ?? '').trim();
        const qty = Number(r['cantidad']);
        const unitPrice = Number(r['precio_unitario']);
        if (!fechaStr) { errors.push({ row: rowNum, raw: r, message: 'Fecha vacía' }); return; }
        const date = new Date(fechaStr);
        if (isNaN(date.getTime())) { errors.push({ row: rowNum, raw: r, message: 'Fecha inválida (usa YYYY-MM-DD)' }); return; }
        if (!prodSku) { errors.push({ row: rowNum, raw: r, message: 'producto_sku vacío' }); return; }
        const prod = products.get(prodSku.toLowerCase());
        if (!prod) { errors.push({ row: rowNum, raw: r, message: `Producto con SKU "${prodSku}" no existe` }); return; }
        if (!isFinite(qty) || qty <= 0) { errors.push({ row: rowNum, raw: r, message: 'cantidad debe ser > 0' }); return; }
        if (!isFinite(unitPrice) || unitPrice < 0) { errors.push({ row: rowNum, raw: r, message: 'precio_unitario inválido' }); return; }
        valid.push({
          id: `sale-bulk-${base}-${i}`,
          productId: prod.id,
          productName: prod.name,
          qty,
          unitPrice,
          total: qty * unitPrice,
          dayOfWeek: date.getDay(),
          month: date.getMonth() + 1,
          date,
          isOutlier: false,
        });
      });
      return { valid, errors };
    },
    commit: (valid) => this.data.createSalesBulk(valid),
  };

  readonly productos = computed(() =>
    [...this.data.activeProducts()].sort((a, b) => a.name.localeCompare(b.name))
  );

  readonly productosConStock = computed(() =>
    this.productos().filter(p => this.stockOf(p.id) > 0)
  );

  readonly totalUnidadesStock = computed(() =>
    this.productosConStock().reduce((s, p) => s + this.stockOf(p.id), 0)
  );

  readonly ventasDeHoy = computed(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return this.data.sales().filter(v => v.date.getTime() >= cutoff);
  });

  readonly ventasHoy = computed(() => this.ventasDeHoy().length);
  readonly ingresosHoy = computed(() => this.ventasDeHoy().reduce((s, v) => s + v.total, 0));

  readonly visibles = computed(() => {
    const all = [...this.data.sales()].sort((a, b) => b.date.getTime() - a.date.getTime());
    const r = this.range();
    if (r === 'todo') return all;
    const days = r === '7d' ? 7 : 30;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return all.filter(s => s.date.getTime() >= cutoff);
  });

  readonly totalIngresosVisibles = computed(() => this.visibles().reduce((s, x) => s + x.total, 0));
  readonly totalUnidadesVisibles = computed(() => this.visibles().reduce((s, x) => s + x.qty, 0));

  readonly totalCarrito = computed(() =>
    this.cart().reduce((s, l) => s + l.qty * l.unitPrice, 0)
  );
  readonly totalUnidadesCarrito = computed(() =>
    this.cart().reduce((s, l) => s + l.qty, 0)
  );

  readonly canSell = computed(() => {
    const c = this.cart();
    if (c.length === 0) return false;
    return c.every(l => l.qty > 0 && l.qty <= l.maxStock && l.unitPrice >= 0);
  });

  stockOf(productId: string): number {
    return this.data.productStockFor(productId)?.quantity ?? 0;
  }

  cartQtyOf(productId: string): number {
    return this.cart().find(l => l.productId === productId)?.qty ?? 0;
  }

  addToCart(p: Product) {
    const available = this.stockOf(p.id) - this.cartQtyOf(p.id);
    if (available <= 0) return;
    this.cart.update(lines => {
      const existing = lines.find(l => l.productId === p.id);
      if (existing) {
        return lines.map(l => l.productId === p.id ? { ...l, qty: l.qty + 1 } : l);
      }
      return [...lines, {
        productId: p.id,
        productName: p.name,
        unit: p.unit,
        qty: 1,
        unitPrice: p.sellPrice,
        maxStock: this.stockOf(p.id),
      }];
    });
  }

  removeLine(productId: string) {
    this.cart.update(lines => lines.filter(l => l.productId !== productId));
  }

  incQty(productId: string) {
    this.cart.update(lines => lines.map(l => {
      if (l.productId !== productId) return l;
      if (l.qty >= l.maxStock) return l;
      return { ...l, qty: l.qty + 1 };
    }));
  }

  decQty(productId: string) {
    this.cart.update(lines => lines.map(l => {
      if (l.productId !== productId) return l;
      if (l.qty <= 1) return l;
      return { ...l, qty: l.qty - 1 };
    }));
  }

  updateQty(productId: string, raw: number) {
    const n = Math.max(1, Math.floor(Number(raw) || 1));
    this.cart.update(lines => lines.map(l => l.productId === productId ? { ...l, qty: n } : l));
  }

  updatePrice(productId: string, raw: number) {
    const n = Math.max(0, Number(raw) || 0);
    this.cart.update(lines => lines.map(l => l.productId === productId ? { ...l, unitPrice: n } : l));
  }

  clearCart() {
    this.cart.set([]);
  }

  async confirmSale() {
    if (!this.canSell()) {
      await this.toast.show('Revisa cantidades y stock antes de confirmar.', 'danger');
      return;
    }
    try {
      const user = this.auth.user();
      const items = this.cart().map(l => ({
        productId: l.productId,
        qty: l.qty,
        unitPrice: l.unitPrice,
      }));
      const created = this.data.registerSalesBatch({
        items,
        userId: user?.uid ?? 'unknown',
        userName: user?.displayName ?? 'Usuario',
      });
      const total = created.reduce((s, x) => s + x.total, 0);
      await this.toast.show(`Venta registrada: ${created.length} ítem(s) · ₡${total.toLocaleString('es-CR')}.`);
      this.cart.set([]);
    } catch (e: unknown) {
      await this.toast.show(e instanceof Error ? e.message : 'Error al registrar venta.', 'danger');
    }
  }
}
