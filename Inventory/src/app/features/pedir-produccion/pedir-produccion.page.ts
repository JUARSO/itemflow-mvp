import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
  IonButton, IonIcon,
} from '@ionic/angular/standalone';
import { DataService } from '../../core/services/data.service';
import { TenantContextService } from '../../core/services/tenant-context.service';
import { ToastService } from '../../shared/components/toast/toast.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { WeeklyPlanItem } from '../../core/models';

const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/** Tarjeta de un día de la ventana rodante (fecha concreta + día de la semana). */
interface DayCard { date: Date; weekday: number; }

@Component({
  selector: 'app-pedir-produccion',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
    IonButton, IonIcon,
    PageHeaderComponent,
  ],
  templateUrl: './pedir-produccion.page.html',
  styleUrls: ['./pedir-produccion.page.scss'],
})
export class PedirProduccionPage {
  protected readonly data = inject(DataService);
  protected readonly tenant = inject(TenantContextService);
  private readonly toast = inject(ToastService);

  readonly productos = computed(() => this.data.activeProducts());

  /** Ventana rodante: 7 días desde HOY (hoy → +6), dando la vuelta a la semana. */
  readonly dias = computed<DayCard[]>(() => {
    const base = new Date(); base.setHours(0, 0, 0, 0);
    const out: DayCard[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(base); d.setDate(base.getDate() + i);
      out.push({ date: d, weekday: d.getDay() });
    }
    return out;
  });

  // Borrador del "agregar" por día de la semana.
  readonly draftProduct = signal<Record<number, string>>({});
  readonly draftQty = signal<Record<number, number>>({});

  // ---------- Lectura del plan (config semanal recurrente) ----------
  itemsOf(weekday: number): WeeklyPlanItem[] { return this.data.weeklyPlanFor(weekday); }
  hasItems(weekday: number): boolean { return this.itemsOf(weekday).length > 0; }
  totalDia(weekday: number): number { return this.itemsOf(weekday).reduce((s, i) => s + i.qty, 0); }

  // ---------- Edición (escribe directo a la config; aplica todas las semanas) ----------
  agregar(weekday: number) {
    const productId = this.draftProduct()[weekday];
    const qty = this.draftQty()[weekday] || 1;
    if (!productId) { this.toast.show('Elige un producto.', 'danger'); return; }
    const items = this.itemsOf(weekday).map(i => ({ ...i }));
    const existing = items.find(i => i.productId === productId);
    if (existing) existing.qty += qty;
    else items.push({ productId, qty });
    this.data.setWeeklyProductionDay(weekday, items);
    this.draftProduct.update(m => ({ ...m, [weekday]: '' }));
    this.draftQty.update(m => ({ ...m, [weekday]: 1 }));
  }

  editarQty(weekday: number, productId: string, qty: number) {
    const q = Math.floor(qty || 0);
    let items = this.itemsOf(weekday).map(i => ({ ...i }));
    if (q <= 0) items = items.filter(i => i.productId !== productId);
    else items = items.map(i => i.productId === productId ? { ...i, qty: q } : i);
    this.data.setWeeklyProductionDay(weekday, items);
  }

  quitar(weekday: number, productId: string) {
    this.data.setWeeklyProductionDay(weekday, this.itemsOf(weekday).filter(i => i.productId !== productId));
  }

  // ---------- Helpers ----------
  weekdayLabel(weekday: number): string { return WEEKDAYS[weekday]; }
  dateLabel(d: Date): string { return `${this.pad(d.getDate())}-${this.pad(d.getMonth() + 1)}`; }
  esHoy(d: Date): boolean {
    const t = new Date(); t.setHours(0, 0, 0, 0);
    return d.getTime() === t.getTime();
  }
  productName(id: string): string { return this.data.productById(id)?.name ?? id; }
  setDraftProduct(weekday: number, productId: string) { this.draftProduct.update(m => ({ ...m, [weekday]: productId })); }
  setDraftQty(weekday: number, qty: number) { this.draftQty.update(m => ({ ...m, [weekday]: Math.max(1, Math.floor(qty || 1)) })); }

  private pad(n: number): string { return String(n).padStart(2, '0'); }
}
