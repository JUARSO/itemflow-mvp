import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { IonButton } from '@ionic/angular/standalone';
import { Alert } from '../../../core/models';

@Component({
  selector: 'app-alert-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, IonButton],
  template: `
    <div class="alert" [attr.data-type]="alert().type" [attr.data-priority]="alert().priority">
      <div class="alert__stripe"></div>
      <div class="alert__body">
        <div class="alert__header">
          <div class="alert__type">{{ typeLabel() }}</div>
          <div class="alert__priority">{{ priorityLabel() }}</div>
        </div>
        <div class="alert__title">{{ alert().itemName }}</div>
        <p class="alert__message">{{ alert().message }}</p>
        @if (alert().projectedDaysUntilStockout !== undefined && alert().projectedDaysUntilStockout !== null) {
          <div class="alert__meta mono">
            ⚠ Quiebre proyectado en {{ alert().projectedDaysUntilStockout }} días
          </div>
        }
        @if (alert().excessValue) {
          <div class="alert__meta mono">
            💰 Capital congelado: {{ alert().excessValue | number:'1.0-0' }} CLP
          </div>
        }

        @if (alert().status === 'active') {
          <div class="alert__actions">
            <ion-button size="small" (click)="onReorder.emit(alert())">
              Generar OC
            </ion-button>
            <ion-button size="small" fill="clear" class="ghost" (click)="onAcknowledge.emit(alert())">
              Marcar revisada
            </ion-button>
            <ion-button size="small" fill="clear" class="ghost" (click)="onResolve.emit(alert())">
              Resolver
            </ion-button>
          </div>
        } @else if (alert().status === 'acknowledged') {
          <div class="alert__meta">
            Revisada por {{ alert().acknowledgedBy }}
          </div>
          <div class="alert__actions">
            <ion-button size="small" (click)="onResolve.emit(alert())">Resolver</ion-button>
          </div>
        } @else {
          <div class="alert__meta">
            Resuelta por {{ alert().resolvedBy }}
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .alert {
      display: flex;
      background: var(--ui-surface-2);
      border: var(--ui-border-w-md) solid var(--ui-border);
      box-shadow: var(--ui-shadow-sm);
      margin-bottom: var(--ui-sp-3);
    }
    .alert[data-priority="high"]   { box-shadow: var(--ui-shadow-lg); }
    .alert[data-priority="medium"] { box-shadow: var(--ui-shadow-md); }
    .alert[data-priority="low"]    { box-shadow: var(--ui-shadow-sm); }

    .alert__stripe {
      width: 12px;
      flex-shrink: 0;
    }
    .alert[data-type="restock"]        .alert__stripe { background: var(--ui-warning); }
    .alert[data-type="stockout_risk"]  .alert__stripe { background: var(--ui-danger); }
    .alert[data-type="excess"]         .alert__stripe { background: var(--ui-excess); }

    .alert__body {
      padding: var(--ui-sp-3) var(--ui-sp-4);
      flex: 1;
      min-width: 0;
    }
    .alert__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--ui-sp-2);
      margin-bottom: var(--ui-sp-1);
    }
    .alert__type {
      display: inline-block;
      padding: 2px 8px;
      font-size: var(--ui-fs-xs);
      font-weight: var(--ui-fw-black);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border: var(--ui-border-w-sm) solid var(--ui-border);
    }
    .alert[data-type="restock"]       .alert__type { background: var(--ui-warning-tint); color: var(--ui-warning); }
    .alert[data-type="stockout_risk"] .alert__type { background: var(--ui-danger-tint); color: var(--ui-danger); }
    .alert[data-type="excess"]        .alert__type { background: var(--ui-excess-tint); color: var(--ui-excess); }
    .alert__priority {
      font-size: var(--ui-fs-xs);
      color: var(--ui-text-muted);
      font-weight: var(--ui-fw-bold);
      text-transform: uppercase;
    }
    .alert__title {
      font-family: var(--ui-font-display);
      font-weight: var(--ui-fw-black);
      font-size: var(--ui-fs-lg);
      line-height: var(--ui-lh-tight);
      margin: 0;
      color: var(--ui-text);
    }
    .alert__sub {
      font-size: var(--ui-fs-sm);
      color: var(--ui-text-muted);
      margin-bottom: var(--ui-sp-2);
    }
    .alert__message {
      font-size: var(--ui-fs-md);
      color: var(--ui-text);
      margin: 0 0 var(--ui-sp-2) 0;
    }
    .alert__meta {
      font-size: var(--ui-fs-sm);
      color: var(--ui-text);
      padding: 6px 0;
    }
    .alert__actions {
      display: flex;
      gap: var(--ui-sp-2);
      flex-wrap: wrap;
      margin-top: var(--ui-sp-3);
    }
  `],
})
export class AlertCardComponent {
  readonly alert = input.required<Alert>();
  readonly onAcknowledge = output<Alert>();
  readonly onResolve = output<Alert>();
  readonly onReorder = output<Alert>();

  readonly typeLabel = computed(() => {
    switch (this.alert().type) {
      case 'restock': return 'Reabastecimiento';
      case 'stockout_risk': return 'Riesgo de Quiebre';
      case 'excess': return 'Exceso';
    }
  });

  readonly priorityLabel = computed(() => {
    switch (this.alert().priority) {
      case 'high': return 'Alta';
      case 'medium': return 'Media';
      case 'low': return 'Baja';
    }
  });
}
