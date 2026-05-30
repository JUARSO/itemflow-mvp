/**
 * Genera e imprime (→ "Guardar como PDF") la ficha técnica de una receta.
 *
 * Abre una ventana nueva con un documento HTML maquetado como la ficha de
 * producción y dispara `print()`. El usuario elige "Guardar como PDF" en el
 * diálogo del navegador. Sin dependencias externas.
 */

export interface FichaSize {
  alto?: string;
  largo?: string;
  ancho?: string;
  diametro?: string;
}

export interface FichaTecnicaData {
  brand: string;
  productName: string;
  sku?: string;
  category?: string;
  unit?: string;
  unitsPerBatch: number;
  storage?: string;
  weightRaw?: number;
  weightBaked?: number;
  weightFinal?: number;
  ingredients: { name: string; qty: number; unit: string }[];
  procedure: string[];
  laminationThickness?: string;
  fermentationTime?: string;
  ovenTempTop?: string;
  ovenTempBottom?: string;
  bakingTime?: string;
  fermentedSize?: FichaSize;
  finishedSize?: FichaSize;
  decoration?: string;
  notes?: string;
  /** Foto del producto (data URL o ruta). */
  imageUrl?: string;
}

function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function dash(v: unknown): string {
  const s = String(v ?? '').trim();
  return s ? esc(s) : '—';
}

function fmtNum(n: number): string {
  return new Intl.NumberFormat('es-CR', { maximumFractionDigits: 3 }).format(n);
}

function ovenLabel(d: FichaTecnicaData): string {
  const parts: string[] = [];
  if (d.ovenTempBottom) parts.push(`${esc(d.ovenTempBottom)} (abajo)`);
  if (d.ovenTempTop) parts.push(`${esc(d.ovenTempTop)} (arriba)`);
  return parts.length ? parts.join(' · ') : '—';
}

function sizeRow(label: string, s?: FichaSize): string {
  return `<tr>
    <th>${esc(label)}</th>
    <td>${dash(s?.alto)}</td>
    <td>${dash(s?.largo)}</td>
    <td>${dash(s?.ancho)}</td>
    <td>${dash(s?.diametro)}</td>
  </tr>`;
}

function buildHtml(d: FichaTecnicaData): string {
  const today = new Date().toLocaleDateString('es-CR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const ingredientsRows = d.ingredients.length
    ? d.ingredients.map(it => `<tr>
        <td>${esc(it.name)}</td>
        <td class="num">${fmtNum(it.qty)} ${esc(it.unit)}</td>
      </tr>`).join('')
    : `<tr><td colspan="2" class="muted">Sin ingredientes.</td></tr>`;

  const procedureItems = d.procedure.length
    ? `<ol>${d.procedure.map(p => `<li>${esc(p)}</li>`).join('')}</ol>`
    : `<p class="muted">Sin procedimiento registrado.</p>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Ficha Técnica — ${esc(d.productName)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: 'Inter', -apple-system, 'Segoe UI', Roboto, sans-serif;
    color: #16202E; margin: 0; padding: 28px 32px; font-size: 12px; line-height: 1.45;
  }
  .head { display: flex; justify-content: space-between; align-items: flex-start;
    border-bottom: 3px solid #16284B; padding-bottom: 10px; margin-bottom: 16px; }
  .head h1 { font-size: 20px; margin: 0; color: #16284B; letter-spacing: 0.04em; }
  .head .brand { font-size: 11px; color: #5A6473; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; }
  .head .meta { text-align: right; font-size: 10px; color: #5A6473; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #16284B;
    margin: 18px 0 6px; border-bottom: 1px solid #C8A24B; padding-bottom: 3px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
  th, td { border: 1px solid #C2CAD6; padding: 5px 8px; text-align: left; vertical-align: top; }
  th { background: #F4F6FA; font-weight: 700; white-space: nowrap; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  .muted { color: #5A6473; font-style: italic; }
  .kv { width: 100%; }
  .kv th { width: 38%; }
  .two-col { display: flex; gap: 16px; }
  .two-col > div { flex: 1; }
  ol { margin: 4px 0; padding-left: 20px; }
  ol li { margin-bottom: 3px; }
  .specs td:first-child, .specs th:first-child { width: 26%; }
  .hero { text-align: center; margin: 4px 0 12px; }
  .hero img { max-height: 180px; max-width: 100%; border: 1px solid #C2CAD6; border-radius: 4px; }
  .footer { margin-top: 20px; font-size: 9px; color: #9AA2B0; text-align: center;
    border-top: 1px solid #DCE2EB; padding-top: 8px; }
  @media print { body { padding: 0; } @page { margin: 14mm; } }
</style>
</head>
<body>
  <div class="head">
    <div>
      <div class="brand">${esc(d.brand)}</div>
      <h1>Ficha Técnica</h1>
    </div>
    <div class="meta">Generado: ${esc(today)}</div>
  </div>

  ${d.imageUrl ? `<div class="hero"><img src="${esc(d.imageUrl)}" alt="${esc(d.productName)}" /></div>` : ''}

  <h2>Producto</h2>
  <div class="two-col">
    <div>
      <table class="kv">
        <tr><th>Nombre del producto</th><td>${esc(d.productName)}</td></tr>
        <tr><th>SKU</th><td>${dash(d.sku)}</td></tr>
        <tr><th>Categoría</th><td>${dash(d.category)}</td></tr>
        <tr><th>Unidades por lote</th><td>${esc(d.unitsPerBatch)} ${esc(d.unit ?? 'und')}</td></tr>
        <tr><th>Almacenamiento</th><td>${dash(d.storage)}</td></tr>
      </table>
    </div>
    <div>
      <table class="kv">
        <tr><th>Peso por unidad (crudo)</th><td>${d.weightRaw != null ? esc(d.weightRaw) + ' g' : '—'}</td></tr>
        <tr><th>Peso por unidad (horneado)</th><td>${d.weightBaked != null ? esc(d.weightBaked) + ' g' : '—'}</td></tr>
        <tr><th>Peso por unidad (final)</th><td>${d.weightFinal != null ? esc(d.weightFinal) + ' g' : '—'}</td></tr>
      </table>
    </div>
  </div>

  <h2>Receta</h2>
  <table>
    <thead><tr><th>Ingrediente</th><th class="num">Cantidad</th></tr></thead>
    <tbody>${ingredientsRows}</tbody>
  </table>

  <h2>Procedimiento</h2>
  ${procedureItems}

  <h2>Laminado y horneo</h2>
  <table class="specs">
    <tr><th>Gruesor del laminado</th><td>${dash(d.laminationThickness)}</td>
        <th>Temperatura de horneo</th><td>${ovenLabel(d)}</td></tr>
    <tr><th>Tiempo de fermentación</th><td>${dash(d.fermentationTime)}</td>
        <th>Tiempo de horneo</th><td>${dash(d.bakingTime)}</td></tr>
  </table>

  <h2>Medidas</h2>
  <table>
    <thead><tr><th></th><th>Alto</th><th>Largo</th><th>Ancho</th><th>Diámetro</th></tr></thead>
    <tbody>
      ${sizeRow('Producto fermentado', d.fermentedSize)}
      ${sizeRow('Producto terminado', d.finishedSize)}
    </tbody>
  </table>

  <h2>Tipo de remate / decoración</h2>
  <p>${dash(d.decoration)}</p>

  ${d.notes ? `<h2>Observaciones</h2><p>${esc(d.notes)}</p>` : ''}

  <div class="footer">${esc(d.brand)} · Ficha técnica de producción · ${esc(d.productName)}</div>
</body>
</html>`;
}

/** Abre la ficha en una ventana e invoca el diálogo de impresión (→ Guardar como PDF). */
export function printFichaTecnica(data: FichaTecnicaData): void {
  const html = buildHtml(data);
  const w = window.open('', '_blank', 'width=820,height=1000');
  if (!w) {
    // Popup bloqueado: fallback a un blob navegable.
    const blob = new Blob([html], { type: 'text/html' });
    window.open(URL.createObjectURL(blob), '_blank');
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  let printed = false;
  const doPrint = () => {
    if (printed) return;
    printed = true;
    try { w.focus(); w.print(); } catch { /* ignore */ }
  };
  w.onload = doPrint;
  // Fallback si onload no dispara (algunos navegadores con document.write).
  setTimeout(doPrint, 500);
}
