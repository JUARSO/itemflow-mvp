import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { TenantContextService } from '../../../core/services/tenant-context.service';

/**
 * Banner discreto que se muestra cuando el usuario actual está en modo lectura
 * (rol admin). Útil para colocar al inicio de pantallas operativas donde el
 * admin no puede ejecutar acciones.
 */
@Component({
  selector: 'app-readonly-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonIcon],
  template: `
    @if (tenant.isReadOnly()) {
      <div class="banner">
        <ion-icon name="alert-circle-outline"></ion-icon>
        <span>
          <strong>Modo administrador.</strong>
          Puedes visualizar toda la información pero las acciones operativas
          están reservadas para los encargados de Ventas y Producción.
        </span>
      </div>
    }
  `,
  styles: [`
    .banner {
      margin: 0 var(--ui-sp-4) var(--ui-sp-3);
      padding: 10px var(--ui-sp-3);
      background: var(--ui-surface-2);
      border-left: 4px solid var(--ui-primary);
      font-size: var(--ui-fs-sm);
      color: var(--ui-text);
      display: flex;
      align-items: center;
      gap: var(--ui-sp-2);
    }
    .banner ion-icon {
      font-size: 18px;
      color: var(--ui-primary);
      flex-shrink: 0;
    }
  `],
})
export class ReadOnlyBannerComponent {
  protected readonly tenant = inject(TenantContextService);
}
