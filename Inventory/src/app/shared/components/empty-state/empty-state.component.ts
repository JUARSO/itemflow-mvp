import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IonButton } from '@ionic/angular/standalone';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonButton],
  template: `
    <div class="empty">
      <div class="empty__icon">{{ icon() }}</div>
      <h2 class="empty__title">{{ title() }}</h2>
      <p class="empty__body">{{ body() }}</p>
      @if (ctaLabel()) {
        <ion-button (click)="ctaClick.emit()">{{ ctaLabel() }}</ion-button>
      }
    </div>
  `,
  styles: [`
    .empty {
      text-align: center;
      padding: var(--ui-sp-8) var(--ui-sp-4);
      max-width: 420px;
      margin: 0 auto;
    }
    .empty__icon {
      font-size: 64px;
      line-height: 1;
      margin-bottom: var(--ui-sp-4);
    }
    .empty__title {
      font-family: var(--ui-font-display);
      font-weight: var(--ui-fw-black);
      font-size: var(--ui-fs-xl);
      color: var(--ui-text);
      margin: 0 0 var(--ui-sp-3) 0;
    }
    .empty__body {
      font-size: var(--ui-fs-md);
      color: var(--ui-text-muted);
      margin: 0 0 var(--ui-sp-6) 0;
    }
  `],
})
export class EmptyStateComponent {
  readonly icon = input<string>('📦');
  readonly title = input.required<string>();
  readonly body = input.required<string>();
  readonly ctaLabel = input<string | undefined>(undefined);
  readonly ctaClick = output<void>();
}
