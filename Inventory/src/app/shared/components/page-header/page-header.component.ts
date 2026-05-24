import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-page-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ph">
      <div class="ph__main">
        <h1 class="ph__title">{{ title() }}</h1>
        @if (subtitle()) {
          <p class="ph__sub">{{ subtitle() }}</p>
        }
      </div>
      <div class="ph__actions">
        <ng-content></ng-content>
      </div>
    </div>
  `,
  styles: [`
    .ph {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: var(--ui-sp-4);
      padding: var(--ui-sp-4) var(--ui-sp-4) var(--ui-sp-3);
      flex-wrap: wrap;
    }
    .ph__main { min-width: 0; }
    .ph__title {
      font-family: var(--ui-font-display);
      font-weight: var(--ui-fw-black);
      font-size: var(--ui-fs-2xl);
      line-height: var(--ui-lh-tight);
      margin: 0;
      color: var(--ui-text);
    }
    .ph__sub {
      margin: 4px 0 0;
      font-size: var(--ui-fs-md);
      color: var(--ui-text-muted);
    }
    .ph__actions {
      display: flex;
      gap: var(--ui-sp-2);
      flex-shrink: 0;
      flex-wrap: wrap;
    }
    @media (max-width: 768px) {
      .ph {
        padding: var(--ui-sp-3);
        gap: var(--ui-sp-2);
      }
      .ph__title { font-size: var(--ui-fs-xl); }
      .ph__sub { font-size: var(--ui-fs-sm); }
      .ph__actions {
        width: 100%;
      }
      /* Botones del header ocupan ancho razonable y crecen si hace falta */
      .ph__actions ::ng-deep ion-button {
        flex: 1 1 auto;
        min-width: 140px;
      }
    }
  `],
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string | undefined>(undefined);
}
