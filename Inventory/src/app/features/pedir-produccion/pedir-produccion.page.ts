import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
  IonButton, IonIcon,
} from '@ionic/angular/standalone';
import { DataService } from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';
import { TenantContextService } from '../../core/services/tenant-context.service';
import { ToastService } from '../../shared/components/toast/toast.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';

const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

interface PlanItem { productId: string; qty: number; }

@Component({
  selector: 'app-pedir-produccion',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
    IonButton, IonIcon,
    PageHeaderComponent, EmptyStateComponent,
  ],
  templateUrl: './pedir-produccion.page.html',
  styleUrls: ['./pedir-produccion.page.scss'],
})
export class PedirProduccionPage {
  protected readonly data = inject(DataService);
  protected readonly tenant = inject(TenantContextService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly desde = signal<string>(this.iso(new Date()));
  readonly hasta = signal<string>(this.iso(this.addDays(new Date(), 6)));

  /** Plan por día: { 'yyyy-MM-dd': [{productId, qty}] }. */
  readonly plan = signal<Record<string, PlanItem[]>>({});
  /** Borradores del selector "agregar" por día. */
  readonly draftProduct = signal<Record<string, string>>({});
  readonly draftQty = signal<Record<string, number>>({});

  readonly productos = computed(() => this.data.activeProducts());

  /** Lista de días (Date) dentro del rango elegido. */
  readonly dias = computed(() => {
    const from = this.parse(this.desde());
    const to = this.parse(this.hasta());
    if (!from || !to || to.getTime() < from.getTime()) return [];
    const out: Date[] = [];
    const d = new Date(from);
    while (d.getTime() <= to.getTime() && out.length < 60) {
      out.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return out;
  });

  readonly diasConItems = computed(() =>
    Object.values(this.plan()).filter(items => items.some(i => i.qty > 0)).length
  );
  readonly totalUnidades = computed(() =>
    Object.values(this.plan()).flat().reduce((s, i) => s + (i.qty > 0 ? i.qty : 0), 0)
  );

  /** Para enviar, TODAS las tarjetas del rango deben tener al menos un producto. */
  readonly todasListas = computed(() =>
    this.dias().length > 0 && this.dias().every(d => this.itemsOf(d).some(i => i.qty > 0))
  );
  readonly diasFaltantes = computed(() =>
    this.dias().filter(d => !this.itemsOf(d).some(i => i.qty > 0)).length
  );

  // ----- Copiar / pegar una tarjeta en otro día -----
  readonly clipboard = signal<PlanItem[] | null>(null);
  readonly clipboardLabel = signal<string>('');
  readonly hasClipboard = computed(() => this.clipboard() !== null);

  hasItems(d: Date): boolean { return this.itemsOf(d).some(i => i.qty > 0); }

  copiar(d: Date) {
    const items = this.itemsOf(d).filter(i => i.qty > 0);
    if (items.length === 0) {
      this.toast.show('Esta tarjeta no tiene productos para copiar.', 'warning');
      return;
    }
    this.clipboard.set(items.map(i => ({ ...i })));
    this.clipboardLabel.set(`${this.weekdayLabel(d)} ${this.dateLabel(d)}`);
    this.toast.show(`Copiado ${this.weekdayLabel(d)} (${items.length} producto/s).`, 'success');
  }

  pegar(d: Date) {
    const clip = this.clipboard();
    if (!clip) return;
    const key = this.dayKey(d);
    this.plan.update(p => ({ ...p, [key]: clip.map(i => ({ ...i })) }));
    this.toast.show(`Pegado en ${this.weekdayLabel(d)}.`, 'success');
    // Tras pegar se limpia el portapapeles: vuelve al formato normal.
    this.cancelarCopia();
  }

  cancelarCopia() { this.clipboard.set(null); this.clipboardLabel.set(''); }

  /** Edita la cantidad de un producto ya agregado a un día. qty<=0 lo quita. */
  editarQty(d: Date, productId: string, qty: number) {
    const q = Math.floor(qty || 0);
    const key = this.dayKey(d);
    this.plan.update(p => {
      const items = p[key] ?? [];
      if (q <= 0) return { ...p, [key]: items.filter(i => i.productId !== productId) };
      return { ...p, [key]: items.map(i => i.productId === productId ? { ...i, qty: q } : i) };
    });
  }

  dayKey(d: Date): string { return this.iso(d); }
  weekdayLabel(d: Date): string { return WEEKDAYS[d.getDay()]; }
  dateLabel(d: Date): string { return `${this.pad(d.getDate())}-${this.pad(d.getMonth() + 1)}`; }

  itemsOf(d: Date): PlanItem[] { return this.plan()[this.dayKey(d)] ?? []; }
  productName(id: string): string { return this.data.productById(id)?.name ?? id; }

  setDraftProduct(key: string, productId: string) {
    this.draftProduct.update(m => ({ ...m, [key]: productId }));
  }
  setDraftQty(key: string, qty: number) {
    this.draftQty.update(m => ({ ...m, [key]: Math.max(1, Math.floor(qty || 1)) }));
  }

  agregar(d: Date) {
    const key = this.dayKey(d);
    const productId = this.draftProduct()[key];
    const qty = this.draftQty()[key] || 1;
    if (!productId) { this.toast.show('Elige un producto.', 'danger'); return; }
    this.plan.update(p => {
      const items = [...(p[key] ?? [])];
      const existing = items.find(i => i.productId === productId);
      if (existing) existing.qty += qty;
      else items.push({ productId, qty });
      return { ...p, [key]: items };
    });
    // Resetear borrador del día.
    this.draftProduct.update(m => ({ ...m, [key]: '' }));
    this.draftQty.update(m => ({ ...m, [key]: 1 }));
  }

  quitar(d: Date, productId: string) {
    const key = this.dayKey(d);
    this.plan.update(p => ({ ...p, [key]: (p[key] ?? []).filter(i => i.productId !== productId) }));
  }

  limpiar() {
    this.plan.set({});
    this.draftProduct.set({});
    this.draftQty.set({});
    this.cancelarCopia();
  }

  async enviar() {
    const almacenId = this.data.almacenId();
    if (!almacenId) { await this.toast.show('No hay almacén configurado.', 'danger'); return; }
    if (!this.todasListas()) {
      await this.toast.show(
        `Todas las tarjetas deben tener al menos un producto. Faltan ${this.diasFaltantes()} día(s).`,
        'danger',
      );
      return;
    }
    const plan = this.plan();
    const dayKeys = this.dias().map(d => this.dayKey(d)).filter(k => (plan[k] ?? []).some(i => i.qty > 0));
    const user = this.auth.user();
    const ctx = { userId: user?.uid ?? 'unknown', userName: user?.displayName ?? 'Usuario' };
    let creadas = 0;
    try {
      for (const key of dayKeys) {
        const items = (plan[key] ?? []).filter(i => i.qty > 0);
        this.data.requestUrnaReplenishment({
          urnaId: almacenId, items,
          requestedDeliveryDate: this.parse(key)!,
          ...ctx,
        });
        creadas++;
      }
      await this.toast.show(`${creadas} pedido(s) a producción creados.`, 'success');
      this.limpiar();
    } catch (e: unknown) {
      await this.toast.show(e instanceof Error ? e.message : 'No se pudieron crear los pedidos.', 'danger');
    }
  }

  // ----- utils de fecha -----
  private pad(n: number): string { return String(n).padStart(2, '0'); }
  private iso(d: Date): string {
    return `${d.getFullYear()}-${this.pad(d.getMonth() + 1)}-${this.pad(d.getDate())}`;
  }
  private addDays(d: Date, n: number): Date { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
  private parse(v: string): Date | null {
    if (!v) return null;
    const [y, m, d] = v.split('-').map(Number);
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  }
}
