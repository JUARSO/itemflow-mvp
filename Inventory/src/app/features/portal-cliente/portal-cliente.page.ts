import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import {
  IonContent, IonButton, IonIcon, IonBadge,
} from '@ionic/angular/standalone';
import { DataService } from '../../core/services/data.service';
import { TenantContextService } from '../../core/services/tenant-context.service';
import { ToastService } from '../../shared/components/toast/toast.service';
import { Customer, CustomerOrder, OrderItem } from '../../core/models';

const DAY_LABELS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'] as const;

interface CartLine { productId: string; qty: number; }

/**
 * Portal externo del cliente. Acceso por URL pública `/c/:token` + PIN.
 *
 * Secciones:
 *  - Crear pedido (catálogo permitido + carrito + fecha de entrega)
 *  - Pedidos por recibir: pedidos producidos que esperan confirmación
 *    del cliente (confirmar todo OK o reportar diferencias por producto)
 *  - Historial: pedidos confirmados, cancelados y en curso. Muestra
 *    cantidades solicitadas vs entregadas vs recibidas y el monto final.
 */
@Component({
  selector: 'app-portal-cliente',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, DatePipe, DecimalPipe,
    IonContent, IonButton, IonIcon, IonBadge,
  ],
  template: `
    <ion-content [fullscreen]="true">
      <div class="portal">
        <header class="portal__header">
          <div class="brand">
            <ion-icon name="cube-outline"></ion-icon>
            <span>{{ company().name }}</span>
          </div>
          @if (authenticated()) {
            <button class="logout" (click)="logout()">Salir</button>
          }
        </header>

        @if (!customer()) {
          <div class="error-box">
            <h2>Acceso no disponible</h2>
            <p>El link que estás usando no es válido o el cliente fue desactivado.</p>
          </div>
        } @else if (!authenticated()) {
          <div class="pin-box">
            <h2>Hola, {{ customer()!.name }}</h2>
            <p>Ingresa tu PIN de acceso para hacer pedidos.</p>
            <input
              type="text"
              inputmode="numeric"
              maxlength="6"
              [value]="pinInput()"
              (input)="pinInput.set($any($event.target).value)"
              class="pin-input mono"
              placeholder="••••••"
              (keyup.enter)="validatePin()" />
            @if (pinError()) {
              <div class="pin-error">PIN incorrecto</div>
            }
            <ion-button expand="block" (click)="validatePin()" [disabled]="pinInput().length < 4">
              Entrar
            </ion-button>
          </div>
        } @else {
          <main class="portal__main">
            <h1 class="portal__title">Hola, {{ customer()!.name }}</h1>

            <!-- ALERTA: pedidos por recibir -->
            @if (porRecibir().length > 0) {
              <section class="receive-section">
                <h2 class="section-title">
                  <ion-icon name="cube-outline"></ion-icon>
                  Pedidos por recibir
                  <ion-badge color="warning">{{ porRecibir().length }}</ion-badge>
                </h2>
                <p class="receive-section__hint">
                  Revisá que todo llegue como esperabas. Confirmá la recepción
                  cuando esté todo bien, o reportá diferencias si recibiste menos
                  o algún producto está dañado.
                </p>

                @for (o of porRecibir(); track o.id) {
                  <article class="receive-card">
                    <header class="receive-card__head">
                      <div>
                        <span class="mono">{{ o.code }}</span>
                        @if (o.requestedDeliveryDate) {
                          <span class="receive-card__date">
                            · Entrega {{ o.requestedDeliveryDate | date:'dd-MM-yyyy' }}
                          </span>
                        }
                      </div>
                      <ion-badge color="success">Listo para recibir</ion-badge>
                    </header>

                    @if (editingId() === o.id) {
                      <!-- Modo edición: input por producto -->
                      <div class="receive-card__editor">
                        <div class="editor-hint">
                          Ajusta la cantidad recibida si llegó menos de lo producido.
                          El monto se recalcula con los precios originales.
                        </div>
                        @for (it of o.items; track it.productId) {
                          <div class="editor-row">
                            <div class="editor-row__name">
                              <strong>{{ it.productName }}</strong>
                              <span class="muted">
                                Pedido: <span class="mono">{{ it.qty }}</span> {{ it.unit }} ·
                                Producido: <span class="mono">{{ it.fulfilledQty }}</span> {{ it.unit }}
                              </span>
                            </div>
                            <div class="editor-row__input">
                              <label>Recibido</label>
                              <input
                                type="number"
                                min="0"
                                [max]="it.fulfilledQty"
                                [value]="draftQty(it.productId, it.fulfilledQty)"
                                (input)="setDraftQty(it.productId, $any($event.target).value, it.fulfilledQty)"
                                class="mono" />
                              <span class="muted">/ {{ it.fulfilledQty }}</span>
                            </div>
                            <div class="editor-row__subtotal mono">
                              ₡{{ subtotalFor(it, draftQty(it.productId, it.fulfilledQty)) | number:'1.0-0' }}
                            </div>
                          </div>
                        }

                        <div class="editor-note">
                          <label>Motivo o nota (opcional)</label>
                          <textarea
                            rows="2"
                            placeholder="Ej: 3 croissants llegaron quebrados"
                            [value]="noteDraft()"
                            (input)="noteDraft.set($any($event.target).value)"></textarea>
                        </div>

                        <div class="editor-totals">
                          <div>
                            <span class="muted">Total original</span>
                            <span class="mono">₡{{ o.totalAmount | number:'1.0-0' }}</span>
                          </div>
                          <div class="editor-totals__final">
                            <span>Total final</span>
                            <strong class="mono">₡{{ draftTotal(o) | number:'1.0-0' }}</strong>
                          </div>
                          @if (draftTotal(o) < o.totalAmount) {
                            <div class="editor-totals__diff">
                              −₡{{ (o.totalAmount - draftTotal(o)) | number:'1.0-0' }} menos
                            </div>
                          }
                        </div>

                        <div class="editor-actions">
                          <button class="btn btn--ghost" (click)="cancelEdit()">Cancelar</button>
                          <button class="btn btn--primary" (click)="submitReception(o)">
                            Confirmar recepción
                          </button>
                        </div>
                      </div>
                    } @else {
                      <!-- Vista compacta -->
                      <div class="receive-card__items">
                        @for (it of o.items; track it.productId) {
                          <div class="receive-card__item">
                            <span>{{ it.productName }}</span>
                            <span class="mono">
                              {{ it.fulfilledQty }} {{ it.unit }}
                            </span>
                          </div>
                        }
                      </div>

                      <div class="receive-card__total mono">
                        Total estimado: <strong>₡{{ o.totalAmount | number:'1.0-0' }}</strong>
                      </div>

                      <div class="receive-card__actions">
                        <button class="btn btn--ghost" (click)="openEdit(o)">
                          Reportar diferencia
                        </button>
                        <button class="btn btn--primary" (click)="confirmAllOk(o)">
                          Confirmar todo recibido
                        </button>
                      </div>
                    }
                  </article>
                }
              </section>
            }

            <!-- Estado de ventana de pedidos -->
            <section class="window-info" [class.window-info--open]="canOrderToday()">
              @if (canOrderToday()) {
                <ion-icon name="checkmark-circle-outline"></ion-icon>
                <div>
                  <strong>Hoy puedes hacer pedidos</strong>
                  <div class="window-info__hint">Día válido para crear pedidos: {{ today() }}</div>
                </div>
              } @else {
                <ion-icon name="warning-outline"></ion-icon>
                <div>
                  <strong>Hoy ({{ today() }}) no es día de pedidos</strong>
                  <div class="window-info__hint">
                    Puedes pedir los días: {{ orderDaysLabel() }}
                  </div>
                </div>
              }
            </section>

            <div class="layout">
              <!-- Catálogo -->
              <section class="catalog">
                <h2 class="section-title">Productos disponibles</h2>
                @if (productos().length === 0) {
                  <p class="empty-msg">No tienes productos asignados.</p>
                }
                <div class="products">
                  @for (p of productos(); track p.id) {
                    <button class="product" (click)="addToCart(p.id)" [disabled]="!canOrderToday()">
                      <div class="product__name">{{ p.name }}</div>
                      <div class="product__price">₡{{ p.sellPrice | number:'1.0-0' }} / {{ p.unit }}</div>
                      <div class="product__add">+ Agregar</div>
                    </button>
                  }
                </div>
              </section>

              <!-- Carrito -->
              <aside class="cart">
                <h2 class="section-title">Tu pedido</h2>

                @if (cart().length === 0) {
                  <p class="empty-msg">Tu carrito está vacío. Toca un producto para agregarlo.</p>
                } @else {
                  <div class="cart__list">
                    @for (l of cartDetail(); track l.productId) {
                      <div class="cart__line">
                        <div class="cart__line-info">
                          <span class="cart__line-name">{{ l.name }}</span>
                          <span class="cart__line-price mono">₡{{ l.subtotal | number:'1.0-0' }}</span>
                        </div>
                        <div class="cart__line-actions">
                          <button (click)="decQty(l.productId)">−</button>
                          <span class="mono">{{ l.qty }}</span>
                          <button (click)="incQty(l.productId)">+</button>
                          <button class="cart__remove" (click)="removeFromCart(l.productId)" title="Quitar">
                            <ion-icon name="trash-outline"></ion-icon>
                          </button>
                        </div>
                      </div>
                    }
                  </div>

                  <div class="cart__total">
                    <span>Total estimado</span>
                    <strong class="mono">₡{{ totalCart() | number:'1.0-0' }}</strong>
                  </div>

                  <div class="delivery">
                    <label class="delivery__label">Fecha de entrega</label>
                    <select [value]="deliveryDate()"
                      (change)="deliveryDate.set($any($event.target).value)"
                      class="delivery__select">
                      <option value="">— Selecciona día de entrega —</option>
                      @for (d of nextDeliveryDates(); track d.iso) {
                        <option [value]="d.iso">{{ d.label }}</option>
                      }
                    </select>
                  </div>

                  <ion-button expand="block" color="primary"
                    (click)="submitOrder()"
                    [disabled]="!canOrderToday() || !deliveryDate()">
                    Enviar pedido
                  </ion-button>
                }
              </aside>
            </div>

            <!-- HISTORIAL DETALLADO -->
            <section class="history-section">
              <div class="history-section__head">
                <h2 class="section-title">Historial de pedidos</h2>
                @if (hasHistoryFilters()) {
                  <button class="link-btn" (click)="clearHistoryFilters()">Limpiar filtros</button>
                }
              </div>

              <div class="history-filters">
                <div class="hf">
                  <label>Desde</label>
                  <input type="date"
                    [value]="histFrom()"
                    (change)="histFrom.set($any($event.target).value)" />
                </div>
                <div class="hf">
                  <label>Hasta</label>
                  <input type="date"
                    [value]="histTo()"
                    (change)="histTo.set($any($event.target).value)" />
                </div>
                <div class="hf">
                  <label>Estado</label>
                  <select [value]="histStatus()"
                    (change)="histStatus.set($any($event.target).value)">
                    <option value="all">Todos</option>
                    <option value="pending">Pendiente</option>
                    <option value="in_production">En producción</option>
                    <option value="received">Recibido</option>
                    <option value="cancelled">Cancelado</option>
                  </select>
                </div>
                <div class="hf hf--summary">
                  <label>Resultados</label>
                  <span class="hf__count mono">{{ historialFiltrado().length }} / {{ historial().length }}</span>
                </div>
              </div>

              @if (historial().length === 0) {
                <p class="empty-msg">Aún no tienes pedidos en tu historial.</p>
              } @else if (historialFiltrado().length === 0) {
                <p class="empty-msg">Ningún pedido coincide con los filtros aplicados.</p>
              } @else {
                <div class="history-list">
                  @for (o of historialFiltrado(); track o.id) {
                    <article class="history-card" [class.history-card--confirmed]="!!o.customerConfirmedAt">
                      <header class="history-card__head">
                        <div>
                          <span class="mono">{{ o.code }}</span>
                          <ion-badge [color]="statusColor(o)">{{ statusLabel(o) }}</ion-badge>
                        </div>
                        <div class="history-card__dates">
                          <span>Creado {{ o.createdAt | date:'dd-MM-yyyy' }}</span>
                          @if (o.customerConfirmedAt) {
                            <span> · Recibido {{ o.customerConfirmedAt | date:'dd-MM-yyyy' }}</span>
                          }
                        </div>
                      </header>

                      <div class="history-table">
                        <div class="history-table__row history-table__row--head">
                          <div>Producto</div>
                          <div class="num">Pedido</div>
                          <div class="num">Producido</div>
                          <div class="num">Recibido</div>
                          <div class="num">Subtotal</div>
                        </div>
                        @for (it of o.items; track it.productId) {
                          <div class="history-table__row">
                            <div>{{ it.productName }}</div>
                            <div class="num mono">{{ it.qty }} {{ it.unit }}</div>
                            <div class="num mono">{{ it.fulfilledQty }} {{ it.unit }}</div>
                            <div class="num mono"
                              [class.diff-down]="hasDiff(it)">
                              @if (o.customerConfirmedAt) {
                                {{ it.receivedQty ?? 0 }} {{ it.unit }}
                              } @else {
                                <span class="muted">—</span>
                              }
                            </div>
                            <div class="num mono">
                              ₡{{ historicalSubtotal(o, it) | number:'1.0-0' }}
                            </div>
                          </div>
                        }
                      </div>

                      <footer class="history-card__foot">
                        <div class="history-totals">
                          <div>
                            <span class="muted">Total original</span>
                            <span class="mono">₡{{ o.totalAmount | number:'1.0-0' }}</span>
                          </div>
                          @if (o.customerConfirmedAt) {
                            <div class="history-totals__final">
                              <span>Total final cobrado</span>
                              <strong class="mono">₡{{ o.finalAmount ?? o.totalAmount | number:'1.0-0' }}</strong>
                            </div>
                            @if ((o.finalAmount ?? o.totalAmount) < o.totalAmount) {
                              <div class="history-totals__diff">
                                Diferencia: −₡{{ (o.totalAmount - (o.finalAmount ?? 0)) | number:'1.0-0' }}
                              </div>
                            }
                          }
                        </div>
                        @if (o.customerNote) {
                          <div class="history-note">
                            <strong>Nota:</strong> {{ o.customerNote }}
                          </div>
                        }
                      </footer>
                    </article>
                  }
                </div>
              }
            </section>
          </main>
        }
      </div>
    </ion-content>
  `,
  styles: [`
    ion-content { --background: var(--ui-surface-2); }

    .portal {
      max-width: 1200px;
      margin: 0 auto;
      padding: var(--ui-sp-3);
      min-height: 100%;
      box-sizing: border-box;
    }

    .portal__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--ui-sp-3) var(--ui-sp-4);
      background: var(--ui-text);
      color: var(--ui-surface);
      margin-bottom: var(--ui-sp-3);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: var(--ui-sp-2);
      font-weight: var(--ui-fw-black);
      font-size: var(--ui-fs-md);
    }
    .brand ion-icon { font-size: 24px; }
    .logout {
      background: transparent;
      color: var(--ui-surface);
      border: var(--ui-border-w-sm) solid currentColor;
      padding: 6px 12px;
      font-size: var(--ui-fs-xs);
      font-weight: var(--ui-fw-bold);
      text-transform: uppercase;
      cursor: pointer;
    }

    .portal__title {
      font-family: var(--ui-font-display);
      font-size: var(--ui-fs-2xl);
      font-weight: var(--ui-fw-black);
      margin: 0 0 var(--ui-sp-3);
    }

    .error-box, .pin-box {
      max-width: 420px;
      margin: var(--ui-sp-6) auto;
      padding: var(--ui-sp-6);
      background: var(--ui-surface);
      border: var(--ui-border-w-md) solid var(--ui-border);
      box-shadow: var(--ui-shadow-md);
      text-align: center;
    }
    .error-box h2, .pin-box h2 {
      font-family: var(--ui-font-display);
      font-weight: var(--ui-fw-black);
      margin: 0 0 var(--ui-sp-3);
    }
    .error-box p, .pin-box p {
      color: var(--ui-text-muted);
      margin: 0 0 var(--ui-sp-4);
    }
    .pin-input {
      width: 100%;
      padding: 16px;
      font-size: 28px;
      letter-spacing: 8px;
      text-align: center;
      border: var(--ui-border-w-md) solid var(--ui-border);
      box-sizing: border-box;
      margin-bottom: var(--ui-sp-3);
      font-family: var(--ui-font-mono);
    }
    .pin-error {
      color: var(--ui-danger);
      font-size: var(--ui-fs-sm);
      font-weight: var(--ui-fw-bold);
      margin-bottom: var(--ui-sp-3);
    }

    /* === Sección "Por recibir" === */
    .receive-section {
      background: var(--ui-surface);
      border: var(--ui-border-w-md) solid var(--ui-warning);
      box-shadow: var(--ui-shadow-md);
      padding: var(--ui-sp-3);
      margin-bottom: var(--ui-sp-3);
    }
    .receive-section__hint {
      color: var(--ui-text-muted);
      font-size: var(--ui-fs-sm);
      margin: 0 0 var(--ui-sp-3);
    }
    .receive-card {
      background: var(--ui-surface-2);
      border: var(--ui-border-w-sm) solid var(--ui-border);
      padding: var(--ui-sp-3);
      margin-bottom: var(--ui-sp-2);
    }
    .receive-card__head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: var(--ui-sp-2);
      flex-wrap: wrap;
      gap: var(--ui-sp-2);
    }
    .receive-card__date { color: var(--ui-text-muted); font-size: var(--ui-fs-sm); }
    .receive-card__items {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-bottom: var(--ui-sp-2);
    }
    .receive-card__item {
      display: flex;
      justify-content: space-between;
      font-size: var(--ui-fs-sm);
      padding: 4px 8px;
      background: var(--ui-surface);
    }
    .receive-card__total {
      font-size: var(--ui-fs-sm);
      color: var(--ui-text-muted);
      margin-bottom: var(--ui-sp-2);
    }
    .receive-card__actions {
      display: flex;
      gap: var(--ui-sp-2);
      justify-content: flex-end;
      flex-wrap: wrap;
    }
    @media (max-width: 500px) {
      .receive-card__actions { flex-direction: column-reverse; }
      .receive-card__actions .btn { width: 100%; }
    }

    /* Botones inline reutilizables */
    .btn {
      padding: 10px 18px;
      font-weight: var(--ui-fw-bold);
      font-size: var(--ui-fs-sm);
      border: var(--ui-border-w-md) solid var(--ui-text);
      cursor: pointer;
      font-family: var(--ui-font-sans);
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .btn--primary {
      background: var(--ui-success);
      color: #fff;
      border-color: var(--ui-success);
    }
    .btn--primary:hover { filter: brightness(1.05); }
    .btn--ghost {
      background: var(--ui-surface);
      color: var(--ui-text);
    }
    .btn--ghost:hover { background: var(--ui-surface-2); }

    /* Editor de recepción */
    .receive-card__editor { display: flex; flex-direction: column; gap: var(--ui-sp-2); }
    .editor-hint {
      font-size: var(--ui-fs-xs);
      color: var(--ui-text-muted);
      padding: 6px 10px;
      background: var(--ui-surface);
      border-left: 3px solid var(--ui-warning);
    }
    .editor-row {
      display: grid;
      grid-template-columns: 1fr auto 100px;
      gap: var(--ui-sp-2);
      align-items: center;
      padding: var(--ui-sp-2);
      background: var(--ui-surface);
      font-size: var(--ui-fs-sm);
    }
    @media (max-width: 600px) {
      .editor-row { grid-template-columns: 1fr; }
      .editor-row__subtotal { text-align: right; }
    }
    .editor-row__name strong { display: block; }
    .editor-row__name .muted {
      font-size: var(--ui-fs-xs);
      color: var(--ui-text-muted);
      display: block;
    }
    .editor-row__input {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: var(--ui-fs-xs);
    }
    .editor-row__input label {
      font-weight: var(--ui-fw-bold);
      color: var(--ui-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .editor-row__input input {
      width: 60px;
      padding: 6px;
      border: var(--ui-border-w-sm) solid var(--ui-border);
      text-align: center;
      font-family: var(--ui-font-mono);
    }
    .editor-row__subtotal { font-weight: var(--ui-fw-bold); }

    .editor-note label {
      display: block;
      font-size: var(--ui-fs-xs);
      font-weight: var(--ui-fw-black);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--ui-text-muted);
      margin-bottom: 4px;
    }
    .editor-note textarea {
      width: 100%;
      padding: 8px;
      border: var(--ui-border-w-sm) solid var(--ui-border);
      font-family: var(--ui-font-sans);
      font-size: var(--ui-fs-sm);
      box-sizing: border-box;
      resize: vertical;
    }

    .editor-totals {
      padding: var(--ui-sp-2);
      background: var(--ui-text);
      color: var(--ui-surface);
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: var(--ui-fs-sm);
    }
    .editor-totals > div {
      display: flex;
      justify-content: space-between;
    }
    .editor-totals .muted { color: rgba(255,255,255,0.7); }
    .editor-totals__final {
      font-size: var(--ui-fs-lg);
      font-weight: var(--ui-fw-black);
      border-top: var(--ui-border-w-sm) solid rgba(255,255,255,0.2);
      padding-top: 4px;
      margin-top: 4px;
    }
    .editor-totals__diff {
      color: var(--ui-warning);
      font-weight: var(--ui-fw-bold);
      text-align: right;
    }

    .editor-actions {
      display: flex;
      gap: var(--ui-sp-2);
      justify-content: flex-end;
      flex-wrap: wrap;
    }

    /* === Window info === */
    .window-info {
      display: flex;
      align-items: center;
      gap: var(--ui-sp-3);
      padding: var(--ui-sp-3);
      margin-bottom: var(--ui-sp-3);
      background: var(--ui-warning);
      color: #000;
      border-left: 4px solid var(--ui-danger);
    }
    .window-info--open {
      background: var(--ui-success);
      color: #fff;
      border-left-color: var(--ui-success);
    }
    .window-info ion-icon { font-size: 28px; flex-shrink: 0; }
    .window-info__hint {
      font-size: var(--ui-fs-sm);
      margin-top: 2px;
      opacity: 0.9;
    }

    .layout {
      display: grid;
      grid-template-columns: 1fr 360px;
      gap: var(--ui-sp-3);
    }
    @media (max-width: 900px) {
      .layout { grid-template-columns: 1fr; }
    }

    .section-title {
      font-size: var(--ui-fs-md);
      font-weight: var(--ui-fw-black);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 0 0 var(--ui-sp-2);
      display: flex;
      align-items: center;
      gap: var(--ui-sp-2);
    }
    .section-title ion-icon { font-size: 20px; }

    .catalog, .cart {
      background: var(--ui-surface);
      border: var(--ui-border-w-md) solid var(--ui-border);
      box-shadow: var(--ui-shadow-md);
      padding: var(--ui-sp-3);
    }

    .products {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: var(--ui-sp-2);
    }
    .product {
      text-align: left;
      background: var(--ui-surface);
      border: var(--ui-border-w-md) solid var(--ui-border);
      padding: var(--ui-sp-3);
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 4px;
      color: var(--ui-text);
      font-family: var(--ui-font-sans);
    }
    .product:hover:not([disabled]) { background: var(--ui-surface-2); }
    .product[disabled] { opacity: 0.5; cursor: not-allowed; }
    .product__name { font-weight: var(--ui-fw-black); font-size: var(--ui-fs-sm); }
    .product__price { color: var(--ui-text-muted); font-size: var(--ui-fs-xs); }
    .product__add {
      margin-top: 4px;
      color: var(--ui-primary);
      font-weight: var(--ui-fw-bold);
      font-size: var(--ui-fs-xs);
    }

    .cart__list {
      display: flex;
      flex-direction: column;
      gap: var(--ui-sp-2);
      margin-bottom: var(--ui-sp-3);
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
    .cart__line-actions button.cart__remove {
      background: var(--ui-danger);
      color: #fff;
      border-color: var(--ui-danger);
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .cart__line-actions button.cart__remove:hover { filter: brightness(1.1); }
    .cart__line-actions button.cart__remove ion-icon {
      font-size: 16px;
      color: #fff;
    }

    .cart__total {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--ui-sp-3);
      background: var(--ui-text);
      color: var(--ui-surface);
      font-size: var(--ui-fs-lg);
      font-weight: var(--ui-fw-black);
      margin-bottom: var(--ui-sp-3);
    }

    .delivery { margin-bottom: var(--ui-sp-3); }
    .delivery__label {
      display: block;
      font-size: var(--ui-fs-xs);
      font-weight: var(--ui-fw-black);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--ui-text-muted);
      margin-bottom: 4px;
    }
    .delivery__select {
      width: 100%;
      padding: 10px;
      border: var(--ui-border-w-md) solid var(--ui-border);
      background: var(--ui-surface);
      font-family: var(--ui-font-sans);
      font-size: var(--ui-fs-sm);
    }

    .empty-msg {
      color: var(--ui-text-muted);
      font-size: var(--ui-fs-sm);
      padding: var(--ui-sp-3);
      text-align: center;
    }

    /* === Historial detallado === */
    .history-section {
      background: var(--ui-surface);
      border: var(--ui-border-w-md) solid var(--ui-border);
      box-shadow: var(--ui-shadow-md);
      padding: var(--ui-sp-3);
      margin-top: var(--ui-sp-3);
    }
    .history-section__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--ui-sp-2);
      margin-bottom: var(--ui-sp-2);
    }
    .history-section__head .section-title { margin: 0; }
    .link-btn {
      background: transparent;
      border: none;
      color: var(--ui-primary);
      font-weight: var(--ui-fw-bold);
      font-size: var(--ui-fs-xs);
      text-decoration: underline;
      cursor: pointer;
      font-family: var(--ui-font-sans);
    }
    .link-btn:hover { color: var(--ui-text); }

    .history-filters {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: var(--ui-sp-2);
      margin-bottom: var(--ui-sp-3);
      padding: var(--ui-sp-2);
      background: var(--ui-surface-2);
    }
    @media (max-width: 700px) { .history-filters { grid-template-columns: 1fr 1fr; } }
    @media (max-width: 400px) { .history-filters { grid-template-columns: 1fr; } }
    .hf {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .hf label {
      font-size: 10px;
      font-weight: var(--ui-fw-black);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--ui-text-muted);
    }
    .hf input,
    .hf select {
      padding: 6px 8px;
      border: var(--ui-border-w-sm) solid var(--ui-border);
      background: var(--ui-surface);
      font-family: var(--ui-font-sans);
      font-size: var(--ui-fs-xs);
      color: var(--ui-text);
    }
    .hf__count {
      padding: 6px 8px;
      background: var(--ui-text);
      color: var(--ui-surface);
      font-weight: var(--ui-fw-black);
      text-align: center;
    }
    .history-list {
      display: flex;
      flex-direction: column;
      gap: var(--ui-sp-2);
    }
    .history-card {
      background: var(--ui-surface-2);
      border: var(--ui-border-w-sm) solid var(--ui-border);
      padding: var(--ui-sp-3);
    }
    .history-card--confirmed { border-left: 4px solid var(--ui-success); }
    .history-card__head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--ui-sp-2);
      margin-bottom: var(--ui-sp-2);
    }
    .history-card__dates {
      font-size: var(--ui-fs-xs);
      color: var(--ui-text-muted);
    }
    .history-table {
      display: grid;
      grid-template-columns: 1fr;
      gap: 0;
      margin-bottom: var(--ui-sp-2);
    }
    .history-table__row {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr 1fr 1fr;
      padding: 6px 8px;
      font-size: var(--ui-fs-xs);
      border-bottom: var(--ui-border-w-sm) solid var(--ui-border);
    }
    @media (max-width: 700px) {
      .history-table__row {
        grid-template-columns: 1fr 1fr;
        gap: 2px;
      }
      .history-table__row > div:first-child {
        grid-column: 1 / -1;
        font-weight: var(--ui-fw-bold);
      }
    }
    .history-table__row--head {
      background: var(--ui-text);
      color: var(--ui-surface);
      font-weight: var(--ui-fw-black);
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .history-table .num { text-align: right; }
    .history-table .diff-down {
      color: var(--ui-danger);
      font-weight: var(--ui-fw-bold);
    }
    .history-table .muted { color: var(--ui-text-muted); }

    .history-card__foot {
      display: flex;
      justify-content: space-between;
      gap: var(--ui-sp-3);
      flex-wrap: wrap;
    }
    .history-totals {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 240px;
    }
    .history-totals > div {
      display: flex;
      justify-content: space-between;
      gap: var(--ui-sp-3);
      font-size: var(--ui-fs-sm);
    }
    .history-totals .muted { color: var(--ui-text-muted); }
    .history-totals__final {
      font-size: var(--ui-fs-md);
      font-weight: var(--ui-fw-black);
      border-top: var(--ui-border-w-sm) solid var(--ui-border);
      padding-top: 4px;
    }
    .history-totals__diff {
      color: var(--ui-danger);
      font-size: var(--ui-fs-xs);
      font-weight: var(--ui-fw-bold);
      text-align: right;
    }
    .history-note {
      font-size: var(--ui-fs-xs);
      color: var(--ui-text-muted);
      padding: 6px 8px;
      background: var(--ui-surface);
      flex: 1;
      min-width: 200px;
    }
  `],
})
export class PortalClientePage {
  private readonly data = inject(DataService);
  private readonly tenant = inject(TenantContextService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);

  protected readonly company = computed(() => this.tenant.company());

  readonly pinInput = signal('');
  readonly authenticated = signal(false);
  readonly pinError = signal(false);
  readonly cart = signal<CartLine[]>([]);
  readonly deliveryDate = signal('');

  /** Pedido en edición de recepción (orderId) y borrador de cantidades. */
  readonly editingId = signal<string | null>(null);
  readonly receiptDraft = signal<Record<string, number>>({});
  readonly noteDraft = signal('');

  /** Filtros del historial. */
  readonly histFrom = signal('');
  readonly histTo = signal('');
  readonly histStatus = signal<'all' | 'pending' | 'in_production' | 'received' | 'cancelled'>('all');

  readonly customer = computed<Customer | null>(() => {
    const token = this.route.snapshot.paramMap.get('token') ?? '';
    return this.data.customerByToken(token) ?? null;
  });

  readonly productos = computed(() => {
    const c = this.customer();
    if (!c) return [];
    return this.data.customerProducts(c.id);
  });

  readonly canOrderToday = computed(() => {
    const c = this.customer();
    if (!c) return false;
    return this.data.canCustomerOrderToday(c.id);
  });

  readonly today = computed(() => DAY_LABELS[new Date().getDay()]);

  readonly orderDaysLabel = computed(() => {
    const c = this.customer();
    if (!c) return '';
    return c.window.orderDays.map(d => DAY_LABELS[d]).join(', ');
  });

  readonly nextDeliveryDates = computed(() => {
    const c = this.customer();
    if (!c) return [];
    const allowed = new Set(c.window.deliveryDays);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dates: { iso: string; label: string }[] = [];
    for (let i = 1; i <= 30 && dates.length < 10; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      if (allowed.size === 0 || allowed.has(d.getDay())) {
        const iso = d.toISOString().slice(0, 10);
        const label = `${DAY_LABELS[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
        dates.push({ iso, label });
      }
    }
    return dates;
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

  readonly totalCart = computed(() => this.cartDetail().reduce((s, l) => s + l.subtotal, 0));

  /** Todos los pedidos del cliente, más recientes primero. */
  readonly misPedidos = computed(() => {
    const c = this.customer();
    if (!c) return [];
    return this.data.orders()
      .filter(o => o.customerId === c.id)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  });

  /** Pedidos producidos y esperando confirmación del cliente. */
  readonly porRecibir = computed(() =>
    this.misPedidos().filter(o => o.status === 'completed' && !o.customerConfirmedAt)
  );

  /** Historial: todos los pedidos menos los que están "por recibir". */
  readonly historial = computed(() =>
    this.misPedidos().filter(o => !(o.status === 'completed' && !o.customerConfirmedAt))
  );

  /** Historial filtrado por rango de fechas y estado. */
  readonly historialFiltrado = computed(() => {
    const from = this.parseDateStart(this.histFrom());
    const to = this.parseDateEnd(this.histTo());
    const st = this.histStatus();

    return this.historial().filter(o => {
      const ref = o.createdAt.getTime();
      if (from !== null && ref < from) return false;
      if (to !== null && ref > to) return false;
      if (st !== 'all') {
        if (st === 'received') {
          if (!o.customerConfirmedAt) return false;
        } else {
          // pending / in_production / cancelled: comparar status directo,
          // pero excluir los ya recibidos (que pueden ser completed).
          if (o.customerConfirmedAt) return false;
          if (o.status !== st) return false;
        }
      }
      return true;
    });
  });

  readonly hasHistoryFilters = computed(() =>
    !!this.histFrom() || !!this.histTo() || this.histStatus() !== 'all'
  );

  clearHistoryFilters() {
    this.histFrom.set('');
    this.histTo.set('');
    this.histStatus.set('all');
  }

  private parseDateStart(s: string): number | null {
    if (!s) return null;
    const d = new Date(s + 'T00:00:00');
    return isNaN(d.getTime()) ? null : d.getTime();
  }

  private parseDateEnd(s: string): number | null {
    if (!s) return null;
    const d = new Date(s + 'T23:59:59.999');
    return isNaN(d.getTime()) ? null : d.getTime();
  }

  async validatePin() {
    const c = this.customer();
    if (!c) return;
    if (this.data.validateCustomerPin(c.id, this.pinInput())) {
      this.authenticated.set(true);
      this.pinError.set(false);
    } else {
      this.pinError.set(true);
    }
  }

  logout() {
    this.authenticated.set(false);
    this.pinInput.set('');
    this.cart.set([]);
    this.cancelEdit();
  }

  addToCart(productId: string) {
    if (!this.canOrderToday()) return;
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
  removeFromCart(productId: string) {
    this.cart.update(lines => lines.filter(l => l.productId !== productId));
  }

  async submitOrder() {
    const c = this.customer();
    if (!c) return;
    if (!this.canOrderToday()) {
      await this.toast.show('Hoy no es día de pedidos según tu configuración.', 'danger');
      return;
    }
    if (!this.deliveryDate()) {
      await this.toast.show('Selecciona una fecha de entrega.', 'danger');
      return;
    }
    const lines = this.cart();
    if (lines.length === 0) {
      await this.toast.show('Tu carrito está vacío.', 'danger');
      return;
    }
    try {
      const items = lines.map(l => {
        const p = this.data.productById(l.productId)!;
        return { productId: l.productId, qty: l.qty, unitPrice: p.sellPrice };
      });
      const created = this.data.createOrder({
        purpose: `Pedido portal — ${c.name}`,
        items,
        userId: c.id,
        userName: c.name,
        customerId: c.id,
        requestedDeliveryDate: new Date(this.deliveryDate()),
      });
      await this.toast.show(`Pedido ${created.code} enviado correctamente.`);
      this.cart.set([]);
      this.deliveryDate.set('');
    } catch (e: unknown) {
      await this.toast.show(e instanceof Error ? e.message : 'Error al enviar el pedido.', 'danger');
    }
  }

  // ===== Recepción =====

  openEdit(o: CustomerOrder) {
    const draft: Record<string, number> = {};
    for (const it of o.items) draft[it.productId] = it.fulfilledQty;
    this.receiptDraft.set(draft);
    this.noteDraft.set('');
    this.editingId.set(o.id);
  }

  cancelEdit() {
    this.editingId.set(null);
    this.receiptDraft.set({});
    this.noteDraft.set('');
  }

  draftQty(productId: string, fallback: number): number {
    const v = this.receiptDraft()[productId];
    return v === undefined ? fallback : v;
  }

  setDraftQty(productId: string, raw: string, max: number) {
    const n = Number(raw);
    const clamped = Math.max(0, Math.min(isFinite(n) ? n : 0, max));
    this.receiptDraft.update(d => ({ ...d, [productId]: clamped }));
  }

  subtotalFor(it: OrderItem, received: number): number {
    return received * it.unitPrice;
  }

  draftTotal(o: CustomerOrder): number {
    return o.items.reduce((sum, it) => {
      const r = this.draftQty(it.productId, it.fulfilledQty);
      return sum + r * it.unitPrice;
    }, 0);
  }

  async confirmAllOk(o: CustomerOrder) {
    const c = this.customer();
    if (!c) return;
    const receipt = o.items.map(it => ({ productId: it.productId, receivedQty: it.fulfilledQty }));
    try {
      this.data.confirmOrderReception(o.id, receipt, undefined, c.id, c.name);
      await this.toast.show(`Pedido ${o.code} marcado como recibido.`);
    } catch (e: unknown) {
      await this.toast.show(e instanceof Error ? e.message : 'No se pudo confirmar el pedido.', 'danger');
    }
  }

  async submitReception(o: CustomerOrder) {
    const c = this.customer();
    if (!c) return;
    const receipt = o.items.map(it => ({
      productId: it.productId,
      receivedQty: this.draftQty(it.productId, it.fulfilledQty),
    }));
    try {
      this.data.confirmOrderReception(o.id, receipt, this.noteDraft(), c.id, c.name);
      await this.toast.show(`Pedido ${o.code} confirmado con ajustes.`);
      this.cancelEdit();
    } catch (e: unknown) {
      await this.toast.show(e instanceof Error ? e.message : 'No se pudo confirmar el pedido.', 'danger');
    }
  }

  // ===== Helpers historial =====

  hasDiff(it: OrderItem): boolean {
    return it.receivedQty !== undefined && it.receivedQty < it.fulfilledQty;
  }

  /**
   * Subtotal a mostrar en el historial: si ya hay receivedQty (confirmado),
   * usa esa cantidad; si no, usa qty original (lo solicitado).
   */
  historicalSubtotal(o: CustomerOrder, it: OrderItem): number {
    const qty = o.customerConfirmedAt ? (it.receivedQty ?? 0) : it.qty;
    return qty * it.unitPrice;
  }

  statusLabel(o: CustomerOrder): string {
    if (o.customerConfirmedAt) return 'Recibido';
    return {
      pending: 'Pendiente',
      in_production: 'En producción',
      completed: 'Producido',
      cancelled: 'Cancelado',
    }[o.status] ?? o.status;
  }

  statusColor(o: CustomerOrder): string {
    if (o.customerConfirmedAt) return 'success';
    return {
      pending: 'warning',
      in_production: 'primary',
      completed: 'tertiary',
      cancelled: 'medium',
    }[o.status] ?? 'medium';
  }
}
