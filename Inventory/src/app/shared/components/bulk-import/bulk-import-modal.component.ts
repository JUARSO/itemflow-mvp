import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { IonButton } from '@ionic/angular/standalone';
import { FormModalComponent } from '../form-modal/form-modal.component';
import { ToastService } from '../toast/toast.service';
import { parseCsv, rowsToObjects, buildCsv, downloadText, readFileAsText } from '../../utils/csv';

/**
 * Resultado de procesar las filas crudas del CSV.
 * `valid` contiene entidades listas para crear.
 * `errors` describe filas inválidas con el motivo específico.
 */
export interface BulkImportProcessResult<TValid> {
  valid: TValid[];
  errors: { row: number; raw: Record<string, string>; message: string }[];
}

/**
 * Configuración del importador. Pasada al modal vía input.
 *  - `headers`: orden y nombre exacto de columnas esperadas (también se usa para la plantilla).
 *  - `templateRows`: 2-3 filas de ejemplo para incluir en la plantilla descargable.
 *  - `process`: parseo + validación específica de la entidad.
 *  - `commit`: persiste las filas válidas (llama métodos del DataService).
 */
export interface BulkImportConfig<TValid> {
  entityLabel: string;
  entityLabelPlural: string;
  templateFilename: string;
  headers: string[];
  templateRows: string[][];
  hint?: string;
  process: (rawRows: Record<string, string>[]) => BulkImportProcessResult<TValid>;
  commit: (valid: TValid[]) => void;
}

type State = 'empty' | 'preview';

@Component({
  selector: 'app-bulk-import-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonButton, FormModalComponent],
  templateUrl: './bulk-import-modal.component.html',
  styleUrls: ['./bulk-import-modal.component.scss'],
})
export class BulkImportModalComponent {
  private readonly toast = inject(ToastService);

  readonly isOpen = input.required<boolean>();
  // `any` por contravarianza: BulkImportConfig<T> aparece como callback param.
  // Tipado fuerte se preserva en cada call-site con su propio T.
  readonly config = input.required<BulkImportConfig<any>>();
  readonly closed = output<void>();
  readonly imported = output<number>();

  readonly state = signal<State>('empty');
  readonly validRows = signal<unknown[]>([]);
  readonly errors = signal<{ row: number; raw: Record<string, string>; message: string }[]>([]);
  readonly totalCount = signal(0);

  readonly validCount = () => this.validRows().length;
  readonly errorCount = () => this.errors().length;

  constructor() {
    effect(() => {
      if (this.isOpen()) this.resetToEmpty();
    });
  }

  resetToEmpty() {
    this.state.set('empty');
    this.validRows.set([]);
    this.errors.set([]);
    this.totalCount.set(0);
  }

  downloadTemplate() {
    const cfg = this.config();
    const content = buildCsv(cfg.headers, cfg.templateRows);
    downloadText(cfg.templateFilename, content);
  }

  async onFile(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const text = await readFileAsText(file);
      const rows = parseCsv(text);
      const objects = rowsToObjects(rows);
      if (objects.length === 0) {
        await this.toast.show('El archivo no contiene filas de datos.', 'danger');
        return;
      }
      const result = this.config().process(objects);
      this.totalCount.set(objects.length);
      this.validRows.set(result.valid);
      this.errors.set(result.errors);
      this.state.set('preview');
    } catch (e: unknown) {
      await this.toast.show(e instanceof Error ? e.message : 'Error procesando el CSV.', 'danger');
    }
  }

  rawPreview(raw: Record<string, string>): string {
    const parts: string[] = [];
    for (const k of Object.keys(raw)) {
      if (raw[k]) parts.push(`${k}=${raw[k]}`);
      if (parts.length >= 3) break;
    }
    return parts.join(' · ');
  }

  async confirm() {
    const valid = this.validRows();
    if (valid.length === 0) return;
    try {
      this.config().commit(valid);
      this.imported.emit(valid.length);
      await this.toast.show(`${valid.length} ${this.config().entityLabelPlural} importados.`, 'success');
      this.onClose();
    } catch (e: unknown) {
      await this.toast.show(e instanceof Error ? e.message : 'Error al importar.', 'danger');
    }
  }

  onClose() {
    this.resetToEmpty();
    this.closed.emit();
  }
}
