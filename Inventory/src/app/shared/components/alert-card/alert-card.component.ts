import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import { IonButton } from '@ionic/angular/standalone';
import { Alert } from '../../../core/models';

@Component({
  selector: 'app-alert-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, DatePipe, IonButton],
  templateUrl: './alert-card.component.html',
  styleUrls: ['./alert-card.component.scss'],
})
export class AlertCardComponent {
  readonly alert = input.required<Alert>();
  /** Si false, oculta los botones (modo solo lectura — ej. admin). */
  readonly actionsEnabled = input<boolean>(true);
  readonly onAcknowledge = output<Alert>();
  readonly onResolve = output<Alert>();
  readonly onReorder = output<Alert>();

  readonly typeLabel = computed(() => {
    switch (this.alert().type) {
      case 'restock': return 'Reabastecimiento';
      case 'stockout_risk': return 'Riesgo de Quiebre';
      case 'order_now': return 'Ordena Hoy';
      case 'excess': return 'Exceso';
      case 'delivery_today': return 'Llega Hoy';
      case 'delivery_overdue': return 'Entrega Vencida';
      case 'partial_reception': return 'Recepción Parcial';
      case 'order_day': return 'Día de Pedido';
    }
  });

  /** "Generar OC" solo aplica a alertas accionables por compra, no a las de
   * seguimiento de entregas ya emitidas. */
  readonly canReorder = computed(() => {
    const t = this.alert().type;
    return t === 'restock' || t === 'stockout_risk' || t === 'order_now' || t === 'order_day';
  });

  readonly priorityLabel = computed(() => {
    switch (this.alert().priority) {
      case 'high': return 'Alta';
      case 'medium': return 'Media';
      case 'low': return 'Baja';
    }
  });
}
