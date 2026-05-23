/**
 * Parser CSV mínimo con soporte para:
 *  - Campos entre comillas dobles (con comas/saltos de línea internos)
 *  - Comillas dobles escapadas como ""
 *  - Separadores , o ;  (autodetectado por primera línea)
 *  - Saltos \r\n y \n
 *  - BOM UTF-8 al inicio
 */
export function parseCsv(text: string): string[][] {
  let src = text.replace(/^﻿/, '');
  if (!src.trim()) return [];

  const firstLine = src.split(/\r?\n/, 1)[0];
  const delim = (firstLine.split(';').length > firstLine.split(',').length) ? ';' : ',';

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += c;
      }
    } else {
      if (c === '"') { inQuotes = true; }
      else if (c === delim) { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && src[i + 1] === '\n') i++;
        row.push(field); field = '';
        if (row.some(v => v !== '')) rows.push(row);
        row = [];
      } else {
        field += c;
      }
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    if (row.some(v => v !== '')) rows.push(row);
  }
  return rows;
}

/**
 * Convierte filas (con header) a objetos. Hace trim a cada celda y a cada header.
 */
export function rowsToObjects(rows: string[][]): Record<string, string>[] {
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => h.trim());
  return rows.slice(1).map(r => {
    const o: Record<string, string> = {};
    headers.forEach((h, i) => { o[h] = (r[i] ?? '').trim(); });
    return o;
  });
}

/** Genera string CSV a partir de headers + filas (cada fila es array de valores). */
export function buildCsv(headers: string[], rows: string[][]): string {
  const escape = (v: string) => {
    if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
    return v;
  };
  const lines = [headers.map(escape).join(',')];
  for (const r of rows) lines.push(r.map(v => escape(v ?? '')).join(','));
  return lines.join('\n');
}

/** Dispara descarga de un archivo de texto en el navegador. */
export function downloadText(filename: string, content: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Lee un File como texto UTF-8. */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Error leyendo archivo'));
    reader.readAsText(file, 'UTF-8');
  });
}
