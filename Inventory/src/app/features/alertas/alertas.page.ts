import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
  IonSegment, IonSegmentButton, IonLabel,
} from '@ionic/angular/standalone';
import { DataService } from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';
import { TenantContextService } from '../../core/services/tenant-context.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { AlertCardComponent } from '../../shared/components/alert-card/alert-card.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { Alert, AlertType } from '../../core/models';

type Tab = 'activas' | 'restock' | 'riesgo' | 'pedidos' | 'excess' | 'resueltas';

/** Tipos de alerta agrupados por pestaña. */
const TAB_TYPES: Record<Exclude<Tab, 'activas' | 'resueltas'>, AlertType[]> = {
  restock: ['restock'],
  riesgo: ['stockout_risk', 'order_now'],
  pedidos: ['delivery_today', 'delivery_overdue', 'partial_reception', 'order_day'],
  excess: ['excess'],
};

@Component({
  selector: 'app-alertas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
    IonSegment, IonSegmentButton, IonLabel,
    PageHeaderComponent, KpiCardComponent, AlertCardComponent, EmptyStateComponent,
  ],
  templateUrl: './alertas.page.html',
  styleUrls: ['./alertas.page.scss'],
})
export class AlertasPage {
  protected readonly data = inject(DataService);
  protected readonly tenant = inject(TenantContextService);
  private readonly auth = inject(AuthService);

  readonly tab = signal<Tab>('activas');

  readonly activas = computed(() => this.data.alerts().filter(a => a.status !== 'resolved'));
  readonly resueltas = computed(() => this.data.alerts().filter(a => a.status === 'resolved'));

  readonly visibles = computed(() => {
    const t = this.tab();
    const all = this.data.alerts();
    if (t === 'activas') return all.filter(a => a.status === 'active' || a.status === 'acknowledged')
                                   .sort((a, b) => priorityRank(a) - priorityRank(b));
    if (t === 'resueltas') return all.filter(a => a.status === 'resolved');
    const types = TAB_TYPES[t];
    return all.filter(a => types.includes(a.type) && a.status !== 'resolved')
              .sort((a, b) => priorityRank(a) - priorityRank(b));
  });

  countByTab(tab: Exclude<Tab, 'activas' | 'resueltas'>): number {
    const types = TAB_TYPES[tab];
    return this.data.alerts().filter(a => types.includes(a.type) && a.status !== 'resolved').length;
  }

  ack(a: Alert) {
    const name = this.auth.user()?.displayName ?? 'Usuario';
    this.data.acknowledgeAlert(a.id, name);
  }

  resolve(a: Alert) {
    const name = this.auth.user()?.displayName ?? 'Usuario';
    this.data.resolveAlert(a.id, name);
  }

  reorder(_a: Alert) {
    // demo: solo console; en una versión completa abriría el flujo de OC
    alert('Flujo de generar OC — demo. Se navegaría a /ordenes-compra/nueva con el insumo prellenado.');
  }
}

function priorityRank(a: Alert): number {
  return a.priority === 'high' ? 0 : a.priority === 'medium' ? 1 : 2;
}
