import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
  IonButton, IonIcon,
} from '@ionic/angular/standalone';
import { DataService } from '../../core/services/data.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-reporte-ventas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe, DatePipe,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
    IonButton, IonIcon,
    PageHeaderComponent, KpiCardComponent, EmptyStateComponent,
  ],
  templateUrl: './reporte-ventas.page.html',
  styleUrls: ['./reporte-ventas.page.scss'],
})
export class ReporteVentasPage {
  protected readonly data = inject(DataService);

  /** Rango de fechas (yyyy-MM-dd). Por defecto: hoy. */
  readonly desde = signal<string>(this.iso(new Date()));
  readonly hasta = signal<string>(this.iso(new Date()));

  /** Ventas POS dentro del rango, recientes primero. */
  readonly ventas = computed(() => {
    const from = this.parseFrom(this.desde());
    const to = this.parseTo(this.hasta());
    return this.data.posSales()
      .filter(s => {
        const t = s.at.getTime();
        return (from === null || t >= from) && (to === null || t <= to);
      })
      .sort((a, b) => b.at.getTime() - a.at.getTime());
  });

  readonly totalVendido = computed(() => this.ventas().reduce((s, v) => s + v.total, 0));
  readonly numTickets = computed(() => this.ventas().length);
  readonly numUnidades = computed(() =>
    this.ventas().reduce((s, v) => s + v.lines.reduce((q, l) => q + l.qty, 0), 0)
  );

  hoy() {
    const t = this.iso(new Date());
    this.desde.set(t);
    this.hasta.set(t);
  }

  // ----- utils de fecha -----
  private pad(n: number): string { return String(n).padStart(2, '0'); }
  private iso(d: Date): string {
    return `${d.getFullYear()}-${this.pad(d.getMonth() + 1)}-${this.pad(d.getDate())}`;
  }
  private parseFrom(v: string): number | null {
    if (!v) return null;
    const [y, m, d] = v.split('-').map(Number);
    return new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
  }
  private parseTo(v: string): number | null {
    if (!v) return null;
    const [y, m, d] = v.split('-').map(Number);
    return new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
  }
}
