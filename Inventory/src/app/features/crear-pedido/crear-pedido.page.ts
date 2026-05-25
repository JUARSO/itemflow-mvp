import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
  IonButton, IonIcon, IonBadge,
} from '@ionic/angular/standalone';
import { DataService } from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../shared/components/toast/toast.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { Product } from '../../core/models';

const DAY_LABELS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'] as const;

interface CartLine { productId: string; qty: number; }

/**
 * Genera un pedido a nombre de un cliente externo desde el lado del admin.
 * A diferencia del portal del cliente:
 *  - Permite seleccionar cualquier producto del catálogo (avisa si no está
 *    en los productos asignados al cliente).
 *  - Permite cualquier fecha de entrega (avisa si cae fuera de la ventana
 *    configurada para el cliente).
 *  - No restringe por orderDays del cliente.
 */
@Component({
  selector: 'app-crear-pedido',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe, RouterLink,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
    IonButton, IonIcon, IonBadge,
    PageHeaderComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-menu-button></ion-menu-button></ion-buttons>
        <ion-title>Crear pedido</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <app-page-header
        title="Crear pedido para cliente"
        subtitle="Genera un pedido a nombre de un cliente externo. Aparecerá en la cola de producción como pendiente.">
        <ion-button fill="outline" routerLink="/clientes">Ver clientes</ion-button>
        <ion-button fill="outline" routerLink="/produccion">Ver pedidos</ion-button>
      </app-page-header>

      <!-- Selector de cliente -->
      <section class="picker">
        <label class="picker__label">Cliente</label>
        <select [value]="selectedCustomerId()"
          (change)="onSelectCustomer($any($event.target).value)"
          class="picker__select">
          <option value="">— Selecciona un cliente —</option>
          @for (c of activeCustomers(); track c.id) {
            <option [value]="c.id">{{ c.name }}</option>
          }
        </select>

        @if (selectedCustomer(); as c) {
          <div class="customer-meta">
            <div class="meta-row">
              <ion-icon name="library-outline"></ion-icon>
              @if (c.allowedProductIds.length === 0) {
                <span>Acceso a todo el catálogo</span>
              } @else {
                <span>{{ c.allowedProductIds.length }} producto(s) asignado(s) —
                  <a routerLink="/clientes" class="link-inline">editar en clientes</a>
                </span>
              }
            </div>
            <div class="meta-row">
              <ion-icon name="calendar-outline"></ion-icon>
              <span>Días de entrega del cliente: <strong>{{ deliveryDaysLabel(c) }}</strong></span>
            </div>
            @if (c.notes) {
              <div class="meta-row meta-row--note">
                <ion-icon name="alert-circle-outline"></ion-icon>
                <span>{{ c.notes }}</span>
              </div>
            }
          </div>
        }
      </section>

      @if (selectedCustomer(); as c) {
        <div class="layout">
          <!-- Catálogo -->
          <section class="catalog">
            <header class="catalog__head">
              <h2 class="section-title">Catálogo</h2>
              <input type="search"
                placeholder="Buscar producto…"
                [value]="search()"
                (input)="search.set($any($event.target).value)"
                class="catalog__search" />
            </header>

            @if (productosFiltrados().length === 0) {
              <p class="empty-msg">Sin productos para mostrar.</p>
            } @else {
              <div class="products">
                @for (p of productosFiltrados(); track p.id) {
                  <button class="product"
                    [class.product--not-assigned]="!isAssigned(p)"
                    (click)="addToCart(p.id)">
                    <div class="product__row">
                      <span class="product__name">{{ p.name }}</span>
                      @if (!isAssigned(p)) {
                        <ion-badge color="warning" title="No está en los productos asignados al cliente">
                          Fuera de catálogo
                        </ion-badge>
                      }
                    </div>
                    <div class="product__row">
                      <span class="product__price mono">₡{{ p.sellPrice | number:'1.0-0' }} / {{ p.unit }}</span>
                      <span class="product__add">+ Agregar</span>
                    </div>
                  </button>
                }
              </div>
            }
          </section>

          <!-- Carrito -->
          <aside class="cart">
            <h2 class="section-title">Pedido para {{ c.name }}</h2>

            @if (cart().length === 0) {
              <p class="empty-msg">Sin productos. Selecciona del catálogo para agregar.</p>
            } @else {
              <div class="cart__list">
                @for (l of cartDetail(); track l.productId) {
                  <div class="cart__line">
                    <div class="cart__line-info">
                      <span class="cart__line-name">{{ l.name }}</span>
                      <span class="cart__line-price mono">₡{{ l.subtotal | number:'1.0-0' }}</span>
                    </div>
                    <div class="cart__line-actions">
                      <button (click)="decQty(l.productId)" title="−">−</button>
                      <input type="number"
                        min="1"
                        [value]="l.qty"
                        (input)="setQty(l.productId, $any($event.target).value)"
                        class="cart__qty mono" />
                      <button (click)="incQty(l.productId)" title="+">+</button>
                      <button class="cart__remove" (click)="removeFromCart(l.productId)" title="Quitar">
                        <ion-icon name="trash-outline"></ion-icon>
                      </button>
                    </div>
                  </div>
                }
              </div>

              <div class="cart__total">
                <span>Total</span>
                <strong class="mono">₡{{ totalCart() | number:'1.0-0' }}</strong>
              </div>
            }

            <div class="field">
              <label>Fecha de entrega</label>
              <input type="date"
                [value]="deliveryDate()"
                [min]="todayIso()"
                (change)="deliveryDate.set($any($event.target).value)"
                class="field__input" />
              @if (deliveryDate() && !isDeliveryDateInWindow()) {
                <div class="warn-inline">
                  <ion-icon name="warning-outline"></ion-icon>
                  Esta fecha cae fuera de los días de entrega configurados para el cliente
                  ({{ deliveryDaysLabel(c) }})
                </div>
              }
            </div>

            <div class="field">
              <label>Notas internas (opcional)</label>
              <textarea rows="2"
                placeholder="Ej: cliente solicitó entrega temprano"
                [value]="notes()"
                (input)="notes.set($any($event.target).value)"
                class="field__input"></textarea>
            </div>

            <ion-button expand="block" color="primary"
              (click)="submit()"
              [disabled]="cart().length === 0 || !deliveryDate()">
              Crear pedido
            </ion-button>
            @if (cart().length > 0) {
              <ion-button expand="block" fill="clear" color="medium" (click)="clearCart()">
                Vaciar carrito
              </ion-button>
            }
          </aside>
        </div>
      } @else {
        <div class="empty">
          <h3>Selecciona un cliente</h3>
          <p>Una vez elegido el cliente, podrás agregar productos del catálogo y generar el pedido.</p>
          @if (activeCustomers().length === 0) {
            <p><strong>No hay clientes activos.</strong>
              <a routerLink="/clientes">Crea uno</a> antes de generar pedidos.</p>
          }
        </div>
      }
    </ion-content>
  `,
  styles: [`
    .picker {
      padding: 0 var(--ui-sp-4) var(--ui-sp-3);
      display: flex;
      flex-direction: column;
      gap: var(--ui-sp-2);
    }
    .picker__label {
      font-size: var(--ui-fs-xs);
      font-weight: var(--ui-fw-black);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--ui-text-muted);
    }
    .picker__select {
      padding: 10px 12px;
      border: var(--ui-border-w-md) solid var(--ui-border);
      background: var(--ui-surface);
      font-family: var(--ui-font-sans);
      font-size: var(--ui-fs-md);
      font-weight: var(--ui-fw-bold);
      max-width: 480px;
    }

    .customer-meta {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: var(--ui-sp-2);
      background: var(--ui-surface-2);
      border-left: 4px solid var(--ui-primary);
      max-width: 720px;
    }
    .meta-row {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      font-size: var(--ui-fs-sm);
      color: var(--ui-text);
    }
    .meta-row ion-icon { font-size: 16px; flex-shrink: 0; margin-top: 2px; color: var(--ui-primary); }
    .meta-row--note {
      font-style: italic;
      color: var(--ui-text-muted);
    }
    .meta-row--note ion-icon { color: var(--ui-warning); }
    .link-inline {
      color: var(--ui-primary);
      font-weight: var(--ui-fw-bold);
      text-decoration: underline;
    }

    .empty {
      margin: var(--ui-sp-4);
      padding: var(--ui-sp-6) var(--ui-sp-4);
      text-align: center;
      background: var(--ui-surface-2);
      border: var(--ui-border-w-md) dashed var(--ui-border);
    }
    .empty h3 { margin: 0 0 var(--ui-sp-2); font-size: var(--ui-fs-lg); }
    .empty p { margin: 0 0 var(--ui-sp-2); color: var(--ui-text-muted); font-size: var(--ui-fs-sm); }
    .empty a { color: var(--ui-primary); font-weight: var(--ui-fw-bold); text-decoration: underline; }

    .layout {
      display: grid;
      grid-template-columns: 1fr 400px;
      gap: var(--ui-sp-3);
      padding: 0 var(--ui-sp-4) var(--ui-sp-8);
    }
    @media (max-width: 1000px) {
      .layout { grid-template-columns: 1fr; }
    }

    .catalog, .cart {
      background: var(--ui-surface);
      border: var(--ui-border-w-md) solid var(--ui-border);
      box-shadow: var(--ui-shadow-md);
      padding: var(--ui-sp-3);
    }

    .catalog__head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--ui-sp-2);
      margin-bottom: var(--ui-sp-2);
      flex-wrap: wrap;
    }
    .catalog__search {
      padding: 8px 10px;
      border: var(--ui-border-w-md) solid var(--ui-border);
      background: var(--ui-surface);
      font-family: var(--ui-font-sans);
      font-size: var(--ui-fs-sm);
      min-width: 200px;
    }

    .section-title {
      font-size: var(--ui-fs-md);
      font-weight: var(--ui-fw-black);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 0;
    }

    .products {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: var(--ui-sp-2);
    }
    .product {
      text-align: left;
      background: var(--ui-surface);
      border: var(--ui-border-w-md) solid var(--ui-border);
      padding: var(--ui-sp-2);
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 4px;
      color: var(--ui-text);
      font-family: var(--ui-font-sans);
    }
    .product:hover { background: var(--ui-surface-2); }
    .product--not-assigned { border-style: dashed; opacity: 0.85; }
    .product__row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 6px;
    }
    .product__name { font-weight: var(--ui-fw-black); font-size: var(--ui-fs-sm); }
    .product__price { font-size: var(--ui-fs-xs); color: var(--ui-text-muted); }
    .product__add {
      color: var(--ui-primary);
      font-weight: var(--ui-fw-bold);
      font-size: var(--ui-fs-xs);
    }

    .empty-msg {
      color: var(--ui-text-muted);
      font-size: var(--ui-fs-sm);
      padding: var(--ui-sp-3);
      text-align: center;
    }

    .cart__list {
      display: flex;
      flex-direction: column;
      gap: var(--ui-sp-2);
      margin-bottom: var(--ui-sp-2);
      margin-top: var(--ui-sp-2);
    }
    .cart__line {
      padding: 8px;
      background: var(--ui-surface-2);
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .cart__line-info {
      display: flex;
      justify-content: space-between;
      font-size: var(--ui-fs-sm);
    }
    .cart__line-name { font-weight: var(--ui-fw-bold); }
    .cart__line-actions {
      display: flex;
      align-items: center;
      gap: 6px;
      justify-content: flex-end;
    }
    .cart__line-actions button {
      width: 28px; height: 28px;
      border: var(--ui-border-w-sm) solid var(--ui-border);
      background: var(--ui-surface);
      cursor: pointer;
      font-weight: var(--ui-fw-black);
    }
    .cart__qty {
      width: 56px;
      padding: 4px;
      border: var(--ui-border-w-sm) solid var(--ui-border);
      text-align: center;
      font-family: var(--ui-font-mono);
    }
    .cart__line-actions button.cart__remove {
      background: var(--ui-danger);
      color: #fff;
      border-color: var(--ui-danger);
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .cart__line-actions button.cart__remove ion-icon {
      font-size: 16px;
      color: #fff;
    }

    .cart__total {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--ui-sp-2) var(--ui-sp-3);
      background: var(--ui-text);
      color: var(--ui-surface);
      font-size: var(--ui-fs-lg);
      font-weight: var(--ui-fw-black);
      margin-bottom: var(--ui-sp-3);
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-bottom: var(--ui-sp-3);
    }
    .field label {
      font-size: var(--ui-fs-xs);
      font-weight: var(--ui-fw-black);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--ui-text-muted);
    }
    .field__input {
      padding: 8px 10px;
      border: var(--ui-border-w-md) solid var(--ui-border);
      background: var(--ui-surface);
      font-family: var(--ui-font-sans);
      font-size: var(--ui-fs-sm);
      width: 100%;
      box-sizing: border-box;
      resize: vertical;
    }

    .warn-inline {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 8px;
      background: var(--ui-warning);
      color: #000;
      font-size: var(--ui-fs-xs);
      font-weight: var(--ui-fw-bold);
    }
    .warn-inline ion-icon { font-size: 14px; }
  `],
})
export class CrearPedidoPage {
  protected readonly data = inject(DataService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly selectedCustomerId = signal('');
  readonly cart = signal<CartLine[]>([]);
  readonly deliveryDate = signal('');
  readonly notes = signal('');
  readonly search = signal('');

  readonly activeCustomers = computed(() => this.data.activeCustomers());

  readonly selectedCustomer = computed(() => {
    const id = this.selectedCustomerId();
    return id ? this.data.customerById(id) ?? null : null;
  });

  readonly productosFiltrados = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.data.products()
      .filter(p => p.active)
      .filter(p => !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  readonly cartDetail = computed(() => {
    return this.cart().map(l => {
      const p = this.data.productById(l.productId);
      return {
        productId: l.productId,
        name: p?.name ?? '?',
        qty: l.qty,
        unitPrice: p?.sellPrice ?? 0,
        subtotal: (p?.sellPrice ?? 0) * l.qty,
      };
    });
  });

  readonly totalCart = computed(() =>
    this.cartDetail().reduce((s, l) => s + l.subtotal, 0)
  );

  /** True si la fecha seleccionada cae dentro de los deliveryDays del cliente. */
  readonly isDeliveryDateInWindow = computed(() => {
    const c = this.selectedCustomer();
    const iso = this.deliveryDate();
    if (!c || !iso) return true;
    if (c.window.deliveryDays.length === 0) return true;
    const d = new Date(iso + 'T00:00:00');
    return c.window.deliveryDays.includes(d.getDay());
  });

  isAssigned(p: Product): boolean {
    const c = this.selectedCustomer();
    if (!c) return true;
    if (c.allowedProductIds.length === 0) return true;
    return c.allowedProductIds.includes(p.id);
  }

  deliveryDaysLabel(c: { window: { deliveryDays: number[] } }): string {
    if (c.window.deliveryDays.length === 0) return 'cualquier día';
    return c.window.deliveryDays.map(d => DAY_LABELS[d]).join(', ');
  }

  todayIso(): string {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  onSelectCustomer(id: string) {
    this.selectedCustomerId.set(id);
    this.cart.set([]);
    this.deliveryDate.set('');
    this.notes.set('');
  }

  addToCart(productId: string) {
    this.cart.update(lines => {
      const found = lines.find(l => l.productId === productId);
      if (found) return lines.map(l => l.productId === productId ? { ...l, qty: l.qty + 1 } : l);
      return [...lines, { productId, qty: 1 }];
    });
  }

  incQty(productId: string) {
    this.cart.update(lines => lines.map(l => l.productId === productId ? { ...l, qty: l.qty + 1 } : l));
  }

  decQty(productId: string) {
    this.cart.update(lines => lines.map(l => l.productId === productId ? { ...l, qty: Math.max(1, l.qty - 1) } : l));
  }

  setQty(productId: string, raw: string) {
    const n = Math.max(1, Math.floor(Number(raw) || 1));
    this.cart.update(lines => lines.map(l => l.productId === productId ? { ...l, qty: n } : l));
  }

  removeFromCart(productId: string) {
    this.cart.update(lines => lines.filter(l => l.productId !== productId));
  }

  clearCart() {
    this.cart.set([]);
  }

  async submit() {
    const c = this.selectedCustomer();
    if (!c) {
      await this.toast.show('Selecciona un cliente.', 'danger');
      return;
    }
    if (this.cart().length === 0) {
      await this.toast.show('Agrega al menos un producto.', 'danger');
      return;
    }
    if (!this.deliveryDate()) {
      await this.toast.show('Selecciona la fecha de entrega.', 'danger');
      return;
    }
    const u = this.auth.user();
    try {
      const items = this.cart().map(l => {
        const p = this.data.productById(l.productId)!;
        return { productId: l.productId, qty: l.qty, unitPrice: p.sellPrice };
      });
      const created = this.data.createOrder({
        purpose: `Pedido para ${c.name} (creado por admin)`,
        items,
        notes: this.notes().trim() || undefined,
        userId: u?.uid ?? 'admin',
        userName: u?.displayName ?? 'Admin',
        customerId: c.id,
        requestedDeliveryDate: new Date(this.deliveryDate() + 'T00:00:00'),
      });
      await this.toast.show(`Pedido ${created.code} creado para ${c.name}.`);
      this.router.navigate(['/produccion']);
    } catch (e: unknown) {
      await this.toast.show(e instanceof Error ? e.message : 'Error al crear el pedido.', 'danger');
    }
  }
}
