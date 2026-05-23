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
  template: `
    <app-form-modal
      [isOpen]="isOpen()"
      [title]="'Importar ' + config().entityLabelPlural + ' (CSV)'"
      (dismissed)="onClose()">

      <div body>
        @if (state() === 'empty') {
          <div class="empty">
            <p class="empty__intro">
              Sube un archivo <strong>.csv</strong> con las columnas esperadas. Si no tienes una plantilla,
              descárgala aquí abajo.
            </p>

            @if (config().hint) {
              <p class="empty__hint">{{ config().hint }}</p>
            }

            <details class="cols">
              <summary>Ver columnas esperadas</summary>
              <ul class="cols__list mono">
                @for (h of config().headers; track h) {
                  <li>{{ h }}</li>
                }
              </ul>
            </details>

            <div class="empty__actions">
              <ion-button fill="outline" (click)="downloadTemplate()">
                ↓ Descargar plantilla
              </ion-button>
              <label class="file-btn">
                <input
                  type="file"
                  accept=".csv,text/csv"
                  (change)="onFile($event)"
                  hidden />
                <span>📂 Elegir archivo CSV…</span>
              </label>
            </div>
          </div>
        } @else {
          <div class="preview">
            <div class="preview__summary">
              <div class="stat stat--ok">
                <div class="stat__value mono">{{ validCount() }}</div>
                <div class="stat__label">Válidos para importar</div>
              </div>
              <div class="stat stat--bad" [class.muted]="errorCount() === 0">
                <div class="stat__value mono">{{ errorCount() }}</div>
                <div class="stat__label">Con errores (se omiten)</div>
              </div>
              <div class="stat">
                <div class="stat__value mono">{{ totalCount() }}</div>
                <div class="stat__label">Total leído</div>
              </div>
            </div>

            @if (errorCount() > 0) {
              <details class="errors" open>
                <summary>Detalles de errores ({{ errorCount() }})</summary>
                <div class="errors__table">
                  <div class="errors__head">
                    <div>Fila</div>
                    <div>Motivo</div>
                    <div>Dato</div>
                  </div>
                  @for (e of errors(); track $index) {
                    <div class="errors__row">
                      <div class="mono">{{ e.row }}</div>
                      <div>{{ e.message }}</div>
                      <div class="mono errors__raw">{{ rawPreview(e.raw) }}</div>
                    </div>
                  }
                </div>
              </details>
            }

            <button type="button" class="reset" (click)="resetToEmpty()">
              ← Subir otro archivo
            </button>
          </div>
        }
      </div>

      <div footer>
        <ion-button fill="clear" class="ghost" (click)="onClose()">
          Cancelar
        </ion-button>
        @if (state() === 'preview') {
          <ion-button
            (click)="confirm()"
            [disabled]="validCount() === 0">
            Importar {{ validCount() }} {{ config().entityLabelPlural }}
          </ion-button>
        }
      </div>
    </app-form-modal>
  `,
  styles: [`
    .empty { display: flex; flex-direction: column; gap: var(--ui-sp-3); }
    .empty__intro { margin: 0; color: var(--ui-text); }
    .empty__hint {
      margin: 0;
      padding: var(--ui-sp-3);
      background: var(--ui-surface-2);
      border-left: 3px solid var(--ui-primary);
      font-size: var(--ui-fs-sm);
      color: var(--ui-text-muted);
    }
    .empty__actions {
      display: flex;
      gap: var(--ui-sp-2);
      flex-wrap: wrap;
      margin-top: var(--ui-sp-2);
    }

    .cols {
      background: var(--ui-surface-2);
      border: var(--ui-border-w-sm) solid var(--ui-border);
      border-radius: var(--ui-radius);
      padding: var(--ui-sp-2) var(--ui-sp-3);
    }
    .cols summary {
      cursor: pointer;
      font-weight: var(--ui-fw-medium);
      font-size: var(--ui-fs-sm);
    }
    .cols__list {
      margin: var(--ui-sp-2) 0 0;
      padding-left: var(--ui-sp-4);
      font-size: var(--ui-fs-sm);
      color: var(--ui-text);
    }

    .file-btn {
      display: inline-flex;
      align-items: center;
      gap: var(--ui-sp-2);
      padding: 10px 16px;
      background: var(--ui-primary);
      color: var(--ui-primary-contrast);
      border: var(--ui-border-w-sm) solid var(--ui-border-strong);
      border-radius: var(--ui-radius);
      box-shadow: var(--ui-shadow-sm);
      font-weight: var(--ui-fw-medium);
      cursor: pointer;
      font-size: var(--ui-fs-md);
      min-height: 44px;
    }
    .file-btn:hover { box-shadow: var(--ui-shadow-md); }

    .preview { display: flex; flex-direction: column; gap: var(--ui-sp-3); }
    .preview__summary {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--ui-sp-3);
    }
    .stat {
      padding: var(--ui-sp-3);
      border: var(--ui-border-w-sm) solid var(--ui-border);
      border-radius: var(--ui-radius);
      text-align: center;
    }
    .stat__value {
      font-size: var(--ui-fs-2xl);
      font-weight: var(--ui-fw-bold);
      color: var(--ui-text-strong);
      line-height: 1;
    }
    .stat__label {
      margin-top: 4px;
      font-size: var(--ui-fs-xs);
      color: var(--ui-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .stat--ok { border-color: var(--ui-success); background: var(--ui-success-tint); }
    .stat--ok .stat__value { color: var(--ui-success); }
    .stat--bad { border-color: var(--ui-danger); background: var(--ui-danger-tint); }
    .stat--bad .stat__value { color: var(--ui-danger); }
    .stat--bad.muted { opacity: 0.5; }

    .errors {
      background: var(--ui-surface-2);
      border: var(--ui-border-w-sm) solid var(--ui-border);
      border-radius: var(--ui-radius);
      padding: var(--ui-sp-2) var(--ui-sp-3);
    }
    .errors summary {
      cursor: pointer;
      font-weight: var(--ui-fw-medium);
      font-size: var(--ui-fs-sm);
      color: var(--ui-danger);
    }
    .errors__table {
      margin-top: var(--ui-sp-2);
      max-height: 240px;
      overflow-y: auto;
    }
    .errors__head, .errors__row {
      display: grid;
      grid-template-columns: 50px 1.6fr 2fr;
      gap: var(--ui-sp-2);
      padding: 6px 0;
      font-size: var(--ui-fs-xs);
      border-bottom: 1px solid var(--ui-border);
    }
    .errors__head {
      font-weight: var(--ui-fw-bold);
      color: var(--ui-text-muted);
      text-transform: uppercase;
    }
    .errors__raw {
      color: var(--ui-text-muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .reset {
      background: none;
      border: none;
      color: var(--ui-primary);
      font-weight: var(--ui-fw-medium);
      cursor: pointer;
      align-self: flex-start;
      padding: 4px 0;
      font-size: var(--ui-fs-sm);
    }
  `],
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
