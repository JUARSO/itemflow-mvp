---
name: paper
description: Sistema de diseño alternativo "Paper Design" para ItemFlow — minimalismo print-inspired, superficies blancas con textura sutil de papel, sombras suaves, radius pequeño 6px, bordes finos 1px, tipografía Roboto/Montserrat/PT Mono, paleta semántica ItemFlow preservada (success/warning/danger/excess/transit). Activar cuando el usuario pida explícitamente diseño "paper", "minimal" o "print-inspired", o cuando se quiera contrastar/migrar desde el sistema neobrutalism actual. Co-existe con la skill `ui-design` (neobrutalism) — solo una debe estar reflejada en el código del proyecto a la vez.
license: MIT
metadata:
  author: typeui.sh + ItemFlow-adapted
---

<!-- TYPEUI_SH_MANAGED_START -->

# Paper Design × ItemFlow — Sistema de Diseño (Web + Móvil)

Lenguaje visual **paper / print-inspired** — superficies blancas tipo hoja de papel, sombras suaves sutilísimas, bordes finos `1px`, radius pequeño `6px`, tipografía limpia (Roboto/Montserrat), alto contraste sin ser agresivo. Combinado con la **paleta semántica de ItemFlow** para estados de stock. Un solo sistema para mobile (Capacitor iOS/Android), tablet y web/desktop. UI en **español**.

---

## 1. Contexto y objetivos

**Intención visual (una frase):** Tarjetas blancas tipo papel con sombra muy sutil y borde fino, sobre fondo gris off-white o crema clarísimo, con tipografía sans-serif limpia y acentos negro/violeta + colores semánticos ItemFlow — sensación de documento impreso editable, no de app brutal.

**Por qué paper design para ItemFlow:**
- Sensación **profesional y refinada** apropiada para PYMES que vienen de Excel.
- Lectura tranquila de números (cantidades, precios) sin ruido visual.
- Alto contraste en texto sin gritos: negro `#111` sobre blanco `#FFF`.
- Fácil de imprimir reportes (los layouts ya parecen impresos).

**Anti-objetivos:**
- Sin bordes negros gruesos (eso era neobrutalism).
- Sin sombras duras desplazadas `4px 4px 0 0`.
- Sin gradientes, glassmorphism ni neumorphism.
- Sin colores brillantes saturados como brand — el brand es **negro**.

---

## 2. Tokens de diseño y fundamentos

Todos los tokens en `src/theme/variables.scss` como CSS custom properties. **Nunca hardcodear valores en componentes.** Tokens = única fuente de verdad para web y móvil.

### 2.1 Tokens de color (Paper × ItemFlow)

```scss
:root {
  /* Marca */
  --ui-primary:    #111111;   /* casi-negro — brand, CTA principal, texto enfático */
  --ui-primary-contrast: #FFFFFF;
  --ui-secondary:  #8B5CF6;   /* violeta — links, acentos suaves */

  /* Estados semánticos ItemFlow (idénticos a paleta de inventory-domain) */
  --ui-success:    #16A34A;   /* verde — available, sincronizado */
  --ui-warning:    #D97706;   /* ámbar — low, restock */
  --ui-danger:     #DC2626;   /* rojo — critical, out, stockout_risk */
  --ui-excess:     #7C3AED;   /* violeta intenso — excess, capital congelado */
  --ui-transit:    #0D9488;   /* teal — en tránsito */

  /* Superficies — paper-like, blanco puro con gris muy claro */
  --ui-surface:    #FAFAF7;   /* off-white tipo papel reciclado clarísimo (fondo de pantalla) */
  --ui-surface-2:  #FFFFFF;   /* blanco puro — cards, paneles elevados */
  --ui-surface-3:  #F3F4F6;   /* gris muy claro — hovers, headers de tabla */

  /* Texto */
  --ui-text:        #111827;  /* casi-negro frío */
  --ui-text-strong: #000000;  /* negro puro para H1 */
  --ui-text-muted:  #6B7280;  /* gris medio para metadatos */

  /* Bordes finos (no son protagonistas) */
  --ui-border:        #E5E7EB; /* gris claro estándar */
  --ui-border-strong: #D1D5DB; /* un poco más visible para hover/focus */
  --ui-border-w-sm: 1px;
  --ui-border-w-md: 1px;       /* en paper, casi todos los bordes son 1px */
  --ui-border-w-lg: 2px;       /* solo para resaltar (cards activas, focus visible) */

  /* Sombras suaves — capas de profundidad sutilísima */
  --ui-shadow-sm: 0 1px 2px rgba(17, 24, 39, 0.04);
  --ui-shadow-md: 0 1px 3px rgba(17, 24, 39, 0.06), 0 1px 2px rgba(17, 24, 39, 0.04);
  --ui-shadow-lg: 0 4px 12px rgba(17, 24, 39, 0.08), 0 2px 4px rgba(17, 24, 39, 0.05);
  --ui-shadow-xl: 0 12px 32px rgba(17, 24, 39, 0.12), 0 4px 8px rgba(17, 24, 39, 0.06);

  /* Radius — paper acepta radius pequeño, no esquinas duras agresivas */
  --ui-radius:    6px;
  --ui-radius-sm: 4px;
  --ui-radius-lg: 8px;

  /* Textura sutil de papel (opcional, vía background-image SVG noise) */
  --ui-paper-texture: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.025 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}
```

**Regla de contraste (WCAG 2.2 AA):** todo par texto/fondo ≥ **4.5:1** (normal) o **≥ 3:1** (≥18px o ≥14px bold).
- ✅ `#111827` sobre `#FFFFFF` → 17.4:1 (excelente)
- ✅ Texto blanco sobre `#111111` → 19:1
- ✅ `#6B7280` sobre `#FFFFFF` → 4.8:1 (apenas pasa — solo para metadatos)
- ❌ Texto blanco sobre `#D97706` ámbar → usar texto oscuro
- ❌ Texto blanco sobre `#16A34A` → usar texto oscuro o tinte más oscuro

**Mapa semántico ItemFlow → token (idéntico a neobrutalism, los colores semánticos no cambian):**

| Contexto | Color | Token |
|---|---|---|
| StockStatus `available` | verde | `--ui-success` |
| StockStatus `low` / Alert `restock` | ámbar | `--ui-warning` |
| StockStatus `critical` o `out` / Alert `stockout_risk` | rojo | `--ui-danger` |
| Alert `excess` / capital congelado | violeta intenso | `--ui-excess` |
| OC pending / en tránsito | teal | `--ui-transit` |
| CTA principal, foco | negro | `--ui-primary` |
| Links, acentos suaves | violeta | `--ui-secondary` |
| ABC A (atención alta) | rojo | `--ui-danger` |
| ABC B | ámbar | `--ui-warning` |
| ABC C | verde | `--ui-success` |

### 2.2 Tokens de tipografía

```scss
:root {
  --ui-font-sans:    'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --ui-font-display: 'Montserrat', 'Roboto', sans-serif; /* titulares */
  --ui-font-mono:    'PT Mono', 'SF Mono', Menlo, monospace; /* SKUs, cantidades, precios */

  /* Escala: 14 / 16 / 18 / 24 / 32 / 40 */
  --ui-fs-xs:  14px;
  --ui-fs-sm:  16px;
  --ui-fs-md:  18px;  /* body por defecto */
  --ui-fs-lg:  24px;  /* card title, subheading */
  --ui-fs-xl:  32px;  /* section heading */
  --ui-fs-2xl: 40px;  /* page heading display */

  /* Weights disponibles: 100 200 300 400 500 600 700 800 900 */
  --ui-fw-regular: 400;
  --ui-fw-medium:  500;
  --ui-fw-semibold: 600;
  --ui-fw-bold:    700;
  --ui-fw-black:   900;  /* reservado para display y énfasis fuerte */

  --ui-lh-tight: 1.2;
  --ui-lh-base:  1.55;  /* paper usa line-height generoso para legibilidad */
}
```

**Reglas tipográficas (paper design):**
- Título de página: `Montserrat` `--ui-fs-2xl` / `--ui-fw-bold` (700, no 900) / `--ui-lh-tight`. Más refinado que neobrutalism.
- Body: `Roboto` `--ui-fs-md` (18px) / `--ui-fw-regular` / `--ui-lh-base`. Texto principal es 18px en web por la sensación impresa.
- **Números de inventario (cantidades, precios, SKUs, balance del kardex): SIEMPRE `--ui-font-mono`** (PT Mono) para alineación tabular en columnas.
- Un solo `<h1>` por página. No saltar niveles.
- **Tracking ligero** en uppercase: `letter-spacing: 0.04em` para labels y headers de tabla.

### 2.3 Tokens de espaciado

```scss
:root {
  --ui-sp-1: 4px;
  --ui-sp-2: 8px;
  --ui-sp-3: 12px;
  --ui-sp-4: 16px;
  --ui-sp-6: 24px;
  --ui-sp-8: 32px;
  --ui-sp-12: 48px;  /* margen generoso entre secciones (estilo print) */
}
```

**Regla de ritmo:** apégate a la escala. Paper design usa más whitespace que neobrutalism — no temas dejar aire alrededor de los elementos.

### 2.4 Breakpoints (continuum web ↔ móvil)

Defaults de Ionic, etiquetados por intención:

| Token | Min width | Intención ItemFlow |
|---|---|---|
| `xs` | 0 | Móvil retrato (operador en bodega) |
| `sm` | 576px | Móvil horizontal / tablet retrato |
| `md` | 768px | Tablet (admin caminando) |
| `lg` | 992px | Laptop (admin en oficina) |
| `xl` | 1200px | Desktop (reportes amplios) |

**Principio responsive:** diseñar **xs primero**, agregar complejidad en `md+` (split panes, sidebar persistente, hover). Nunca al revés.

### 2.5 Motion

- Duración: `150ms` (micro), `220ms` (default), `320ms` (modal/page).
- Easing: `cubic-bezier(0.4, 0, 0.2, 1)` (Material-like, suave).
- Paper design usa transiciones **muy sutiles**: cambios de color/opacity, sin grandes movimientos.
- Botones en `:active` se hunden ligeramente: `transform: translateY(1px)` + `box-shadow` reducida.
- Respetar `prefers-reduced-motion`: reducir a 60ms o desactivar.

---

## 3. Reglas por componente

### 3.1 Botón (`ion-button`)

**Anatomía:** label + icono opcional. Border `1px solid --ui-border-strong` (o sin border si fill solid), radius `--ui-radius` (6px), padding `--ui-sp-3 --ui-sp-4`, shadow `--ui-shadow-sm`.

**Variantes:**
- `primary` (solid) — bg `--ui-primary` (negro), texto blanco, sin border.
- `secondary` (outline) — bg `--ui-surface-2` blanco, texto `--ui-text`, border `1px solid --ui-border-strong`.
- `success/warning/danger` — bg del color semántico, texto con contraste correcto (rojo+blanco, ámbar+negro, verde+negro).
- `ghost` (fill="clear") — bg transparente, texto `--ui-text`, sin border. Para "Cancelar".

**Estados (obligatorios):**

| Estado | Cambio visual |
|---|---|
| `default` | sombra `--ui-shadow-sm` |
| `:hover` (solo web) | sombra `--ui-shadow-md`, bg ligeramente más oscuro |
| `:focus-visible` | outline `2px solid --ui-primary`, offset `2px` |
| `:active` / presión táctil | `translateY(1px)`, sombra removida |
| `disabled` | opacity `0.5`, cursor `not-allowed`, sin hover |
| `loading` | spinner reemplaza icono, button no-interactivo |

**Web:** hover obligatorio, cursor `pointer`.
**Móvil:** sin hover, `min-height: 44px`. Tap targets ≥ 44×44px.

### 3.2 Card

**Anatomía:** wrapper `bg --ui-surface-2` (blanco), `1px solid --ui-border`, radius `--ui-radius` (6px), shadow `--ui-shadow-sm`, padding `--ui-sp-4` o `--ui-sp-6`.

**Variantes:**
- `default` — la card básica blanca.
- `outlined` — sin shadow, solo border (estilo nota de papel).
- `status-accent` — barra superior de 4px del color del status (success/warning/danger/excess). Útil para AlertCard, KPI Card.

**Estados:**
- `default` — estática.
- `:hover` (solo si clickeable) — shadow `--ui-shadow-md`, ligero `translateY(-1px)`.
- `:focus-visible` — outline como botón.
- `:active` — shadow removida.

### 3.3 Input / Form field

**Anatomía:** label encima (text-sm bold), field con `1px solid --ui-border-strong`, bg `--ui-surface-2` blanco, padding `--ui-sp-3`, radius `--ui-radius-sm` (4px). Helper/error text debajo (text-xs).

**Estados:**

| Estado | Visual |
|---|---|
| `default` | border `--ui-border-strong`, sin shadow |
| `:focus-visible` | border `2px solid --ui-primary`, sin desplazamiento |
| `:hover` (web) | border `--ui-text-muted` |
| `error` | border `--ui-danger`, helper text `--ui-danger` `--ui-fw-medium` |
| `disabled` | opacity `0.5`, bg `--ui-surface-3`, cursor `not-allowed` |
| `readonly` | bg `--ui-surface-3`, border `--ui-border` |

**Web:** label asociado vía `for`; tab order lógico; `autocomplete` obligatorio.
**Móvil:** field height `≥ 48px`. Numéricos → `inputmode="numeric"`. SKU → `inputmode="text" autocapitalize="characters"`.

### 3.4 List item / Table row

**Anatomía:** divisor entre items: `1px solid --ui-border` (gris muy suave, casi imperceptible). Padding generoso `--ui-sp-3 --ui-sp-4`.

**Responsive:**
- **Móvil (xs–sm):** una columna, padding lateral `--ui-sp-4`.
- **Tablet (md):** dos columnas si encaja.
- **Desktop (lg+):** `ion-split-pane` — lista a la izquierda (380px), detalle a la derecha.

### 3.5 Navegación

**Móvil:** `ion-tab-bar` abajo (máx 5 items). Borde superior `1px solid --ui-border`.

**Web/Desktop (`md+`):** sidebar persistente vía `ion-menu` con `bg --ui-surface-2` y `border-right: 1px solid --ui-border`. Sin shadow agresiva — paper es sutil.

### 3.6 Modal / Alert / Toast

- **Modal:** fullscreen en móvil, card centrada (max-width 560px) con `--ui-shadow-xl` en desktop, radius `--ui-radius-lg` (8px). Header sin color de fondo agresivo (blanco con border bottom 1px).
- **Alert:** solo para confirmaciones destructivas. Dos botones: Cancelar (ghost) + Confirmar (danger).
- **Toast:** confirmaciones no-bloqueantes (3s). Card flotante con `--ui-shadow-lg`.

---

## 4. Patrones específicos de ItemFlow

### 4.1 StatusBadge (StockStatus)

Píldora con color de estado + label en español. Más sutil que neobrutalism: sin border grueso.

- Border `1px solid` del color del status (con opacity 0.3) o background tinte del color.
- Padding `2px 10px`, radius `9999px` (pill), `--ui-fs-xs`, `--ui-fw-semibold`.
- Cada variante: bg con tinte del color status (5-10% opacity), texto del color status pleno.

### 4.2 AlertCard

Card paper con **barra de color superior de 4px** (no franja lateral gruesa como neobrutalism).

```
┌─────────────────────────────────────────┐
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │ ← barra superior 4px del color
│                                         │
│ [RESTOCK]                       Alta    │
│ Harina de trigo                         │
│ Bodega Central · Quedan 3.2 kg          │
│ Punto de reorden: 10 kg                  │
│ [Generar OC]  [Marcar revisada]         │
└─────────────────────────────────────────┘
```

### 4.3 KardexRow

Fila densa con `font-family: --ui-font-mono` (PT Mono) para alineación. Divisores `1px dashed --ui-border` para sutileza tipo papel cuadriculado.

### 4.4 ABCClassBadge

Círculo o cuadrado pequeño con letra grande dentro:

```
┌───┐  ┌───┐  ┌───┐
│ A │  │ B │  │ C │
└───┘  └───┘  └───┘
```

- 32×32px, border `1px solid` del color, radius `--ui-radius-sm` (4px), `--ui-fw-bold`, `--ui-fs-lg`.

### 4.5 WizardStep (4-step setup)

Indicador horizontal de progreso. Steps con círculos numerados conectados con líneas finas.

### 4.6 EmptyState con CTA al paso faltante

Centrado, sin background, icono grande 64px, heading `--ui-fs-xl`, body, CTA primary.

### 4.7 KPI Card

Card paper blanca con **barra superior 4px** del color semántico:

```
┌─────────────────────────┐
│ ━━━━━━━━━━━━━━━━━━━━━━ │ ← stripe 4px (color del KPI)
│                         │
│ TOTAL PRODUCTOS         │ ← label tracking 0.04em --ui-fs-xs
│                         │
│ 247                     │ ← --ui-fs-2xl --ui-fw-bold --ui-font-mono
│                         │
│ ▲ 12 vs mes pasado     │ ← --ui-fs-xs delta
└─────────────────────────┘
```

---

## 5. Accesibilidad — criterios testeables (WCAG 2.2 AA)

| # | Criterio | Cómo testear |
|---|---|---|
| A1 | Todo interactivo alcanzable con Tab en orden lógico | Tabular toda la página |
| A2 | Indicador de foco visible | Outline `2px`, contraste `≥ 3:1` |
| A3 | Contraste texto/fondo `≥ 4.5:1` | axe DevTools |
| A4 | Ninguna info se transmite solo por color | StatusBadge tiene icono+texto |
| A5 | Botones de solo-icono con `aria-label` | Inspeccionar |
| A6 | Form fields asociados a labels (`for`/`id`) | Inspeccionar cada field |
| A7 | Errores anunciados a screen readers | `aria-live="polite"` |
| A8 | Touch targets `≥ 44×44px` en móvil | Computed size |
| A9 | Un `<h1>` por página | Heading outline |
| A10 | Modal atrapa foco; lo devuelve al cerrar | Abrir/cerrar |
| A11 | `prefers-reduced-motion` respetado | Activar OS reduce-motion |
| A12 | `<html lang="es">` declarado | Inspeccionar root |

---

## 6. Estándares de contenido y tono

**Idioma:** español. **Tono:** conciso, confiado, útil.

**Vocabulario canónico ItemFlow:**
- "Insumo" (no "materia prima")
- "Receta" (no "BOM")
- "Bodega" (no "almacén")
- "Punto de reorden" (no "ROP")
- "Kardex" o "Movimientos" (no "ledger")
- "Quiebre de stock" o "Agotado" (no "stockout")
- "Predicción de demanda" (no "forecast")

**Labels:** verbo + sustantivo. ✅ "Generar orden de compra"; ❌ "OK".

**Empty states:** decir qué falta + siguiente acción.

**Errores:** qué pasó + qué hacer + datos.

**Confirmaciones destructivas:** nombrar el objeto y la consecuencia.

**Números:** siempre con unidad. **i18n-ready:** sin strings inline.

---

## 7. Anti-patrones (prohibidos en Paper Design)

| Don't | Por qué |
|---|---|
| Hardcodear hex en componentes | Tokens son la fuente única |
| Sombras duras desplazadas `4px 4px 0 0` | Es neobrutalism, no paper |
| Bordes negros gruesos `2-3px solid #000` | Paper usa `1px` gris claro |
| Radius `0` (esquinas duras) | Paper usa `4-8px` |
| Texto sobre warning/success sin contraste | Validar 4.5:1 |
| Desactivar outline de `:focus` | Mata a11y |
| Spinners como loading principal de listas | Skeleton paper-like |
| Diseñar desktop primero | Mobile-first |
| Hover-only affordances | Proveer alternativa visible |
| Usar inglés en UI | Glosario español ItemFlow |
| Gradientes / glassmorphism / neumorphism | Anti-paper |
| Colores brillantes como brand | Brand es negro/blanco |
| Editar/eliminar filas del kardex | Append-only |

### Notas de migración

Si vienes de neobrutalism (o reciben código viejo):
1. Reemplaza `box-shadow: 4px 4px 0 0 #000` → `--ui-shadow-md`.
2. Reemplaza `border: 2px solid #000` → `1px solid var(--ui-border)`.
3. Reemplaza `border-radius: 0` → `var(--ui-radius)` (6px).
4. Reemplaza Inter → Roboto, mantén PT Mono para números.
5. Cambia `#FBFBF9` warm surface → `#FAFAF7` paper off-white o `#FFFFFF` blanco puro.

---

## 8. QA checklist (correr antes de mergear cualquier cambio UI)

### Tokens
- [ ] No hay hex de color, font-size ni spacing hardcodeados
- [ ] Border es `1px` (`--ui-border-w-md`) salvo casos justificados
- [ ] Sombras usan `--ui-shadow-*` (suaves, multi-capa, no offset duro)
- [ ] Radius es `--ui-radius` (6px) excepto pills (`9999px`) o sm (`4px`)

### Responsive
- [ ] Tested a 360, 768, 1280px
- [ ] Touch targets `≥ 44×44px` en xs/sm
- [ ] Grid o split-pane, no media queries custom
- [ ] Sin scroll horizontal

### Estados
- [ ] `default`, `:hover` (web), `:focus-visible`, `:active`, `disabled`, `loading` (si async)
- [ ] Presión: `translateY(1px)` + shadow reducida

### Accesibilidad (12 criterios §5)
- [ ] axe 0 violaciones
- [ ] Keyboard-only completa la tarea
- [ ] Screen reader anuncia correctamente
- [ ] `prefers-reduced-motion` respetado

### Contenido
- [ ] Verbo + sustantivo en botones
- [ ] Errores accionables
- [ ] Empty states nombran siguiente acción
- [ ] Vocabulario español canónico ItemFlow
- [ ] Sin strings inline (i18n)

### Cross-platform
- [ ] iOS WebView, Android WebView, Chrome desktop, Safari desktop iguales
- [ ] Capacitor features tienen fallback web

### ItemFlow específico
- [ ] StatusBadge nunca solo color
- [ ] Filas de kardex sin editar/eliminar
- [ ] Empty state cita el paso faltante
- [ ] Color semántico correcto (excess violeta, no rojo; transit teal)

---

## Comportamiento esperado (mío, como asistente)

- Reformular la intención en una frase antes de proponer componentes.
- Definir tokens antes de código.
- Mockups ASCII para móvil Y desktop antes de código.
- Si solicitud conflictúa con WCAG, plantear conflicto + alternativa.
- Default opinionado, concreto. Citar token por nombre.
- Priorizar accesibilidad sobre novedad estética.
- Vocabulario español canónico ItemFlow siempre.

<!-- TYPEUI_SH_MANAGED_END -->
