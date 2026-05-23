import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
  IonSegment, IonSegmentButton, IonLabel, IonSearchbar,
} from '@ionic/angular/standalone';
import { DataService } from '../../core/services/data.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { KardexRowComponent } from '../../shared/components/kardex-row/kardex-row.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { KardexType } from '../../core/models';

type TypeFilter = 'todos' | KardexType;

@Component({
  selector: 'app-kardex',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
    IonSegment, IonSegmentButton, IonLabel, IonSearchbar,
    PageHeaderComponent, KardexRowComponent, EmptyStateComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-menu-button></ion-menu-button></ion-buttons>
        <ion-title>Kardex</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <app-page-header
        title="Kardex"
        subtitle="Historial de movimientos de stock — append-only para auditoría.">
      </app-page-header>

      <div class="filters">
        <ion-searchbar
          [value]="query()"
          (ionInput)="query.set($any($event.detail.value) ?? '')"
          placeholder="Buscar por insumo o producto"
          mode="md">
        </ion-searchbar>

        <ion-segment
          [value]="typeFilter()"
          (ionChange)="typeFilter.set($any($event.detail.value))"
          scrollable>
          <ion-segment-button value="todos"><ion-label>Todos</ion-label></ion-segment-button>
          <ion-segment-button value="in"><ion-label>Entradas</ion-label></ion-segment-button>
          <ion-segment-button value="out"><ion-label>Salidas</ion-label></ion-segment-button>
          <ion-segment-button value="adjustment"><ion-label>Ajustes</ion-label></ion-segment-button>
        </ion-segment>
      </div>

      @if (visibles().length === 0) {
        <app-empty-state
          icon="📋"
          title="Sin movimientos en el periodo"
          body="Las entradas, salidas y ajustes aparecerán aquí cuando se registren.">
        </app-empty-state>
      } @else {
        <div class="table">
          <div class="table__head">
            <div>Fecha</div>
            <div>Tipo</div>
            <div class="num">Cantidad</div>
            <div class="num">Saldo</div>
            <div>Usuario</div>
            <div>Razón</div>
          </div>
          @for (e of visibles(); track e.id) {
            <div class="item-wrapper">
              <div class="item-title">
                <span>{{ e.itemName }}</span>
              </div>
              <app-kardex-row [entry]="e"></app-kardex-row>
            </div>
          }
        </div>
      }
    </ion-content>
  `,
  styles: [`
    .filters {
      padding: 0 var(--ui-sp-4) var(--ui-sp-4);
      display: flex;
      flex-direction: column;
      gap: var(--ui-sp-3);
    }
    ion-searchbar { --background: var(--ui-surface); padding: 0; }

    .table {
      margin: 0 var(--ui-sp-4) var(--ui-sp-8);
      border: var(--ui-border-w-md) solid var(--ui-border);
      box-shadow: var(--ui-shadow-md);
      background: var(--ui-surface);
    }
    .table__head {
      display: grid;
      grid-template-columns: 110px 110px 90px 90px 1fr 1fr;
      gap: var(--ui-sp-3);
      padding: var(--ui-sp-3) var(--ui-sp-4);
      background: var(--ui-text);
      color: var(--ui-surface);
      font-size: var(--ui-fs-xs);
      font-weight: var(--ui-fw-black);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    @media (max-width: 768px) {
      .table__head { display: none; }
    }
    .item-wrapper { border-top: var(--ui-border-w-sm) solid var(--ui-border); }
    .item-title {
      padding: var(--ui-sp-2) var(--ui-sp-4);
      background: var(--ui-surface-2);
      font-size: var(--ui-fs-sm);
      font-weight: var(--ui-fw-bold);
      display: flex;
      justify-content: space-between;
      gap: var(--ui-sp-2);
    }
    .item-title__wh {
      color: var(--ui-text-muted);
      font-weight: var(--ui-fw-medium);
    }
  `],
})
export class KardexPage {
  protected readonly data = inject(DataService);

  readonly query = signal('');
  readonly typeFilter = signal<TypeFilter>('todos');

  readonly visibles = computed(() => {
    const q = this.query().toLowerCase();
    const t = this.typeFilter();
    return this.data.recentKardex(200)
      .filter(e => t === 'todos' || e.type === t)
      .filter(e =>
        !q ||
        e.itemName.toLowerCase().includes(q) ||
        e.userName.toLowerCase().includes(q)
      );
  });
}
