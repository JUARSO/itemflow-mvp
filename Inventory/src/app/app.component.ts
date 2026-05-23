import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { ThemeService } from './core/services/theme.service';
import { BrandingService } from './core/services/branding.service';

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-app>
      <ion-router-outlet></ion-router-outlet>
    </ion-app>
  `,
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent {
  // Eager-instantiate los servicios para que apliquen tema y marca al boot,
  // antes de que el usuario navegue a cualquier ruta protegida.
  private readonly theme = inject(ThemeService);
  private readonly branding = inject(BrandingService);
}
