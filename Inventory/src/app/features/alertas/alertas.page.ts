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
import { Alert } from '../../core/models';

type Tab = 'activas' | 'restock' | 'stockout_risk' | 'excess' | 'resueltas';

@Component({
  selector: 'app-alertas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
    IonSegment, IonSegmentButton, IonLabel,
    PageHeaderComponent, KpiCardComponent, AlertCardComponent, EmptyStateComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-menu-button></ion-menu-button></ion-buttons>
        <ion-title>Alertas</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <app-page-header
        title="Alertas"
        subtitle="Reabastecimiento, riesgo de quiebre y exceso de stock">
      </app-page-header>

      <div class="kpis">
        <app-kpi-card label="Prioridad Alta"  [value]="data.alertsHighPriority()"  tone="danger"></app-kpi-card>
        <app-kpi-card label="Prioridad Media" [value]="data.alertsMediumPriority()" tone="warning"></app-kpi-card>
        <app-kpi-card label="Prioridad Baja"  [value]="data.alertsLowPriority()"   tone="success"></app-kpi-card>
        <app-kpi-card label="Total Activas"   [value]="data.activeAlerts().length" tone="primary"></app-kpi-card>
      </div>

      <div class="tabs">
        <ion-segment
          [value]="tab()"
          (ionChange)="tab.set($any($event.detail.value))"
          scrollable>
          <ion-segment-button value="activas">
            <ion-label>Activas ({{ activas().length }})</ion-label>
          </ion-segment-button>
          <ion-segment-button value="restock">
            <ion-label>Reabastecer ({{ countByType('restock') }})</ion-label>
          </ion-segment-button>
          <ion-segment-button value="stockout_risk">
            <ion-label>Riesgo Quiebre ({{ countByType('stockout_risk') }})</ion-label>
          </ion-segment-button>
          <ion-segment-button value="excess">
            <ion-label>Exceso ({{ countByType('excess') }})</ion-label>
          </ion-segment-button>
          <ion-segment-button value="resueltas">
            <ion-label>Resueltas ({{ resueltas().length }})</ion-label>
          </ion-segment-button>
        </ion-segment>
      </div>

      <div class="list">
        @if (visibles().length === 0) {
          <app-empty-state
            icon="🔔"
            title="Sin alertas en esta categoría"
            body="Cuando tu stock baje del punto de reorden o tu modelo proyecte un quiebre, las alertas aparecerán aquí.">
          </app-empty-state>
        }
        @for (a of visibles(); track a.id) {
          <app-alert-card
            [alert]="a"
            [actionsEnabled]="tenant.canManageAlerts()"
            (onAcknowledge)="ack($event)"
            (onResolve)="resolve($event)"
            (onReorder)="reorder($event)">
          </app-alert-card>
        }
      </div>
    </ion-content>
  `,
  styles: [`
    .kpis {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: var(--ui-sp-3);
      padding: 0 var(--ui-sp-4) var(--ui-sp-4);
    }
    @media (max-width: 1100px) { .kpis { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 480px)  { .kpis { grid-template-columns: 1fr; } }

    .tabs { padding: 0 var(--ui-sp-4) var(--ui-sp-4); }

    .list { padding: 0 var(--ui-sp-4) var(--ui-sp-8); }
  `],
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
    return all.filter(a => a.type === t && a.status !== 'resolved')
              .sort((a, b) => priorityRank(a) - priorityRank(b));
  });

  countByType(type: string): number {
    return this.data.alerts().filter(a => a.type === type && a.status !== 'resolved').length;
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
