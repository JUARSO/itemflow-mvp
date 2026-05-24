import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
  IonButton, IonSegment, IonSegmentButton, IonLabel,
} from '@ionic/angular/standalone';
import { DataService } from '../../core/services/data.service';
import { TenantContextService } from '../../core/services/tenant-context.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { DevolucionFormModalComponent } from './devolucion-form-modal.component';
import { ReadOnlyBannerComponent } from '../../shared/components/readonly-banner/readonly-banner.component';
import { ReturnReason } from '../../core/models';

type Range = '7d' | '30d' | 'todo';
type ReasonFilter = 'all' | ReturnReason;

const REASON_LABELS: Record<ReturnReason, string> = {
  defective: 'Defectuoso',
  expired: 'Vencido',
  leftover: 'Sobra fin de día',
  damaged: 'Daño',
  other: 'Otro',
};

@Component({
  selector: 'app-devoluciones',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, DecimalPipe,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
    IonButton, IonSegment, IonSegmentButton, IonLabel,
    PageHeaderComponent, KpiCardComponent,
    DevolucionFormModalComponent, ReadOnlyBannerComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-menu-button></ion-menu-button></ion-buttons>
        <ion-title>Devoluciones</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <app-page-header
        title="Devoluciones a producción"
        subtitle="Registra producto terminado que sale del stock de ventas (defectuoso, sobra, dañado o vencido).">
        @if (tenant.canRegisterReturn()) {
          <ion-button color="danger" (click)="modalOpen.set(true)">+ Nueva devolución</ion-button>
        }
      </app-page-header>

      <app-readonly-banner></app-readonly-banner>

      <div class="kpis">
        <app-kpi-card label="Devoluciones (rango)" [value]="visibles().length" tone="warning"></app-kpi-card>
        <app-kpi-card label="Unidades devueltas" [value]="totalUnidades()" tone="excess"></app-kpi-card>
        <app-kpi-card label="Pérdida estimada" [value]="'₡' + (totalPerdida() | number:'1.0-0')" tone="danger"
          hint="costo de fabricación de lo devuelto"></app-kpi-card>
        <app-kpi-card label="Motivo más frecuente" [value]="topReason()" tone="primary"></app-kpi-card>
      </div>

      <div class="filters">
        <div class="filter-block">
          <span class="filter-label">Período</span>
          <ion-segment [value]="range()" (ionChange)="range.set($any($event.detail.value))">
            <ion-segment-button value="7d"><ion-label>7 días</ion-label></ion-segment-button>
            <ion-segment-button value="30d"><ion-label>30 días</ion-label></ion-segment-button>
            <ion-segment-button value="todo"><ion-label>Todo</ion-label></ion-segment-button>
          </ion-segment>
        </div>

        <div class="filter-block">
          <span class="filter-label">Motivo</span>
          <div class="chips">
            <button class="chip" [class.chip--active]="reason() === 'all'"
              (click)="reason.set('all')">Todos</button>
            <button class="chip" [class.chip--active]="reason() === 'defective'"
              (click)="reason.set('defective')">Defectuoso</button>
            <button class="chip" [class.chip--active]="reason() === 'expired'"
              (click)="reason.set('expired')">Vencido</button>
            <button class="chip" [class.chip--active]="reason() === 'leftover'"
              (click)="reason.set('leftover')">Sobra</button>
            <button class="chip" [class.chip--active]="reason() === 'damaged'"
              (click)="reason.set('damaged')">Daño</button>
          </div>
        </div>
      </div>

      @if (visibles().length === 0) {
        <div class="empty">
          <h3>No hay devoluciones en este rango</h3>
          <p>Registra una devolución cuando un producto deba salir del stock de ventas hacia producción.</p>
        </div>
      }

      <div class="table">
        <div class="table__head">
          <div>Fecha</div>
          <div>Producto</div>
          <div>Motivo</div>
          <div class="num">Cantidad</div>
          <div class="num">Pérdida</div>
          <div>Registrado por</div>
        </div>
        @for (r of visibles(); track r.id) {
          <div class="table__row">
            <div class="mono">{{ r.createdAt | date:'dd-MM HH:mm' }}</div>
            <div>
              <div class="prod-name">{{ r.productName }}</div>
              @if (r.notes) {
                <div class="prod-note">{{ r.notes }}</div>
              }
            </div>
            <div>
              <span class="reason" [attr.data-reason]="r.reason">{{ reasonLabel(r.reason) }}</span>
            </div>
            <div class="num mono">{{ r.qty }} {{ r.unit }}</div>
            <div class="num mono"><strong class="loss">₡{{ r.totalLoss | number:'1.0-0' }}</strong></div>
            <div class="user">{{ r.createdBy }}</div>
          </div>
        }
      </div>

      <app-devolucion-form-modal
        [isOpen]="modalOpen()"
        (closed)="modalOpen.set(false)"
        (saved)="modalOpen.set(false)">
      </app-devolucion-form-modal>
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

    .filters {
      padding: 0 var(--ui-sp-4) var(--ui-sp-3);
      display: flex;
      flex-direction: column;
      gap: var(--ui-sp-3);
    }
    .filter-block {
      display: flex;
      align-items: center;
      gap: var(--ui-sp-3);
      flex-wrap: wrap;
    }
    .filter-label {
      font-size: var(--ui-fs-xs);
      font-weight: var(--ui-fw-black);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--ui-text-muted);
    }
    .chips {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .chip {
      background: var(--ui-surface);
      border: var(--ui-border-w-sm) solid var(--ui-border);
      padding: 6px 10px;
      font-size: var(--ui-fs-xs);
      font-weight: var(--ui-fw-bold);
      cursor: pointer;
      color: var(--ui-text);
    }
    .chip:hover { background: var(--ui-surface-2); }
    .chip--active {
      background: var(--ui-text);
      color: var(--ui-surface);
      border-color: var(--ui-text);
    }

    .empty {
      margin: var(--ui-sp-4);
      padding: var(--ui-sp-6) var(--ui-sp-4);
      text-align: center;
      background: var(--ui-surface-2);
      border: var(--ui-border-w-md) dashed var(--ui-border);
    }
    .empty h3 { margin: 0 0 var(--ui-sp-2); font-size: var(--ui-fs-lg); }
    .empty p { margin: 0; color: var(--ui-text-muted); font-size: var(--ui-fs-sm); }

    .table {
      margin: 0 var(--ui-sp-4) var(--ui-sp-8);
      border: var(--ui-border-w-md) solid var(--ui-border);
      box-shadow: var(--ui-shadow-md);
      background: var(--ui-surface);
    }
    .table__head, .table__row {
      display: grid;
      grid-template-columns: 130px 2fr 130px 110px 110px 130px;
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

    .prod-name { font-weight: var(--ui-fw-bold); }
    .prod-note {
      font-size: var(--ui-fs-xs);
      color: var(--ui-text-muted);
      margin-top: 2px;
    }
    .user { color: var(--ui-text-muted); font-size: var(--ui-fs-xs); }
    .loss { color: var(--ui-danger); }

    .reason {
      display: inline-block;
      padding: 3px 8px;
      font-size: 10px;
      font-weight: var(--ui-fw-black);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border: var(--ui-border-w-sm) solid var(--ui-border);
      background: var(--ui-surface);
    }
    .reason[data-reason="defective"] { background: var(--ui-danger); color: #fff; }
    .reason[data-reason="expired"]   { background: var(--ui-warning); color: #000; }
    .reason[data-reason="leftover"]  { background: var(--ui-transit); color: #fff; }
    .reason[data-reason="damaged"]   { background: var(--ui-excess); color: #fff; }
    .reason[data-reason="other"]     { background: var(--ui-surface-3); color: var(--ui-text); }

    @media (max-width: 900px) {
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
export class DevolucionesPage {
  protected readonly data = inject(DataService);
  protected readonly tenant = inject(TenantContextService);

  readonly range = signal<Range>('7d');
  readonly reason = signal<ReasonFilter>('all');
  readonly modalOpen = signal(false);

  readonly visibles = computed(() => {
    let list = [...this.data.returns()];
    const r = this.range();
    if (r !== 'todo') {
      const days = r === '7d' ? 7 : 30;
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      list = list.filter(x => x.createdAt.getTime() >= cutoff);
    }
    const rf = this.reason();
    if (rf !== 'all') {
      list = list.filter(x => x.reason === rf);
    }
    return list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  });

  readonly totalUnidades = computed(() =>
    this.visibles().reduce((s, r) => s + r.qty, 0)
  );

  readonly totalPerdida = computed(() =>
    this.visibles().reduce((s, r) => s + r.totalLoss, 0)
  );

  readonly topReason = computed(() => {
    const counts = new Map<ReturnReason, number>();
    for (const r of this.visibles()) {
      counts.set(r.reason, (counts.get(r.reason) ?? 0) + r.qty);
    }
    if (counts.size === 0) return '—';
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    return REASON_LABELS[top[0]];
  });

  reasonLabel(r: ReturnReason): string {
    return REASON_LABELS[r];
  }
}
