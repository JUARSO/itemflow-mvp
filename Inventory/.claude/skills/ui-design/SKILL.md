---
name: ui-design
description: Sistema de diseño de ItemFlow — Paper Design (papel-texturizado, inspirado en print, paleta mínima, tipografía limpia, superficies táctiles, esquinas suaves, sombras blandas). Adaptado a la paleta semántica de ItemFlow. Cubre tokens (color/tipografía/espaciado), anatomía y estados de componentes, comportamiento responsive web + móvil, accesibilidad WCAG 2.2 AA, y patrones específicos de inventario (status badges, alert cards, kardex rows, ABC class). Activar en cualquier trabajo visual, mockups, revisión UI, definición de tokens o componentes en web/móvil/tablet. **Este es el sistema actualmente implementado en el código del proyecto.**
license: MIT
metadata:
  author: typeui.sh + ItemFlow-adapted
---

<!-- TYPEUI_SH_MANAGED_START -->

# Paper × ItemFlow — Sistema de Diseño (Web + Móvil)

Lenguaje visual **paper design** (superficie blanco-papel, paleta mínima, tipografía clara, sombras blandas, esquinas suavemente redondeadas, contrastes altos sin ruido visual) aplicado a la **paleta semántica de ItemFlow**. Un solo sistema para mobile (Capacitor iOS/Android), tablet y web/desktop. UI en **español**.

---

## 1. Contexto y objetivos

**Intención visual (una frase):** Paper Design funcional — superficie blanca tipo papel, bordes finos `1px` neutros, sombras blandas `0 1px 3px rgba(...)`, radius `6–8px`, tipografía Roboto/Montserrat/PT Mono, sobre superficie clara, usando la paleta semántica de ItemFlow (teal brand, emerald/ámbar/rojo/violeta para estados) para que el inventario se lea como un documento impreso bien diagramado.

**Por qué paper para ItemFlow:**
- Superficie limpia = larga sesión de lectura sin fatiga visual (operadores 8h en bodega).
- Sombras blandas + jerarquía clara = la UI se siente "documento" más que "interfaz", reduciendo carga cognitiva.
- Paleta mínima de neutros + acentos puros para estados = los estados (critical/low/excess) destacan inmediatamente sin competir con el chrome de la app.
- Tipografía Roboto (UI) + Montserrat (display) = legibilidad probada en pantallas pequeñas y carteles grandes; PT Mono para números de inventario.
- Sin gradientes complejos ni efectos pesados = renderiza igual en WebView Android viejo, Safari iOS y Chrome desktop.

**Anti-objetivos:**
- Nada de Material 3 ripples agresivos ni look iOS nativo — sobrescribimos los modos de Ionic.
- Nada de neobrutalism (bordes gruesos negros, sombras duras desplazadas).
- Nada de glassmorphism, gradientes saturados, neumorfismo, ni dark-mode "carbon".
- Nada de Bootstrap/Tailwind sobrepuesto a Ionic.
- **Sin dark mode automático**: paper es por definición blanco, no respondemos a `prefers-color-scheme: dark`. Si en el futuro se requiere modo nocturno, debe ser opt-in explícito por el usuario, no automático del OS.

---

## 2. Tokens de diseño y fundamentos

Todos los tokens en `src/theme/variables.scss` como CSS custom properties. **Nunca hardcodear valores en componentes.** Tokens = única fuente de verdad para web y móvil.

### 2.1 Tokens de color (paleta ItemFlow × Paper)

```scss
:root {
  /* Marca (paleta "tinta", baja saturación) */
  --ui-primary:          #3F7872;  /* teal apagado (sage) — brand, CTA principal */
  --ui-primary-contrast: #FFFFFF;
  --ui-secondary:        #6F5E8C;  /* slate-violet — acento secundario, también excess */

  /* Estados semánticos (paleta editorial, evita "neon") */
  --ui-success:    #5F8466;  /* sage green — available, healthy, sincronizado */
  --ui-warning:    #A87B41;  /* oro apagado — low, restock, advertencia */
  --ui-danger:     #9C5454;  /* rojo ladrillo — critical, out, stockout_risk */
  --ui-excess:     #6F5E8C;  /* slate-violet — excess, capital congelado */
  --ui-transit:    #3F7872;  /* teal apagado — en tránsito */

  /* Superficie (blancos cálidos tipo papel) */
  --ui-surface:    #FFFFFF;  /* papel base */
  --ui-surface-2:  #FAFAF8;  /* papel marfil sutil — cards elevadas */
  --ui-surface-3:  #F3F3F0;  /* hover / fila alterna */

  /* Texto (escala de 4 niveles en grises, no negro puro) */
  --ui-text-strong: #0A0A0A;  /* títulos h1/h2, valores KPI clave */
  --ui-text:        #1F1F1F;  /* tinta principal — body */
  --ui-text-muted:  #6E6E6E;  /* secundario, metadatos */
  --ui-text-subtle: #9A9A9A;  /* placeholders, labels muy chicos */

  /* Bordes (grises neutros, ritmo claro) */
  --ui-border:        #E8E8E4;  /* divisor sutil — cards, listas */
  --ui-border-strong: #C7C7C2;  /* énfasis — inputs, botones outline */

  /* Sombras blandas (núcleo paper design) */
  --ui-shadow-sm: 0 1px 2px rgba(17, 24, 39, 0.06);
  --ui-shadow-md: 0 1px 3px rgba(17, 24, 39, 0.08), 0 1px 2px rgba(17, 24, 39, 0.04);
  --ui-shadow-lg: 0 4px 12px rgba(17, 24, 39, 0.08), 0 2px 4px rgba(17, 24, 39, 0.04);
  --ui-shadow-xl: 0 12px 28px rgba(17, 24, 39, 0.12), 0 4px 8px rgba(17, 24, 39, 0.06);

  /* Bordes (paper: finos, sutiles) */
  --ui-border-w-sm: 1px;
  --ui-border-w-md: 1px;
  --ui-border-w-lg: 2px;   /* solo para énfasis: status accents, focus */
  --ui-radius-sm: 4px;
  --ui-radius:    6px;     /* default para cards, botones, inputs */
  --ui-radius-lg: 8px;     /* modales, sheets */
  --ui-radius-pill: 9999px;  /* badges, status pills */
}
```

**Regla de contraste (WCAG 2.2 AA):** ≥ 4.5:1 normal, ≥ 3:1 large.
- ✅ Blanco sobre teal apagado `#3F7872` → 4.9:1
- ✅ Blanco sobre rojo ladrillo `#9C5454` → 4.7:1
- ✅ Blanco sobre oro apagado `#A87B41` → 4.5:1
- ✅ `#1F1F1F` sobre superficie `#FFFFFF` → 15.4:1 (body)
- ✅ `#0A0A0A` sobre superficie `#FFFFFF` → 20.1:1 (títulos)
- ✅ `#6E6E6E` sobre `#FFFFFF` → 5.3:1 (texto muted)
- ⚠️ `#9A9A9A` sobre `#FFFFFF` → 2.8:1 — solo para texto ≥ 18px o decorativo

**Filosofía de color:** la app vive en **escala de grises** (4 niveles de texto + 3 de superficie + 2 de borde). Los **acentos semánticos son tintas desaturadas**, no colores saturados — destacan sin gritar.

**Mapa semántico ItemFlow → color/token:**
- `available` → success | `low` / `restock` → warning | `critical`/`out`/`stockout_risk` → danger | `excess` → excess (violeta) | PO pending / transit → teal | ABC: A → danger / B → warning / C → success.

### 2.2 Tokens de tipografía

```scss
:root {
  --ui-font-sans:    'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --ui-font-display: 'Montserrat', 'Roboto', sans-serif;
  --ui-font-mono:    'PT Mono', 'SF Mono', Menlo, monospace;

  /* Escala paper: 14 / 16 / 18 / 24 / 32 / 40 */
  --ui-fs-xs:  14px;
  --ui-fs-sm:  14px;
  --ui-fs-md:  16px;   /* body */
  --ui-fs-lg:  18px;   /* section headings inline */
  --ui-fs-xl:  24px;   /* card titles, h2 */
  --ui-fs-2xl: 32px;   /* page title h1 */
  --ui-fs-3xl: 40px;   /* hero KPI numbers */

  --ui-fw-thin:    100;
  --ui-fw-light:   300;
  --ui-fw-regular: 400;
  --ui-fw-medium:  500;
  --ui-fw-semibold:600;
  --ui-fw-bold:    700;
  --ui-fw-black:   900;

  --ui-lh-tight: 1.2;
  --ui-lh-base:  1.5;
  --ui-lh-loose: 1.7;
}
```

**Reglas tipográficas:**
- Page title `--ui-fs-2xl` (32px) / `--ui-fw-bold` / Montserrat.
- Section title `--ui-fs-xl` (24px) / `--ui-fw-semibold` / Montserrat.
- Body 16px Roboto `--ui-fw-regular` (14px móvil para listas densas).
- Números de inventario, SKU, IDs → **siempre `--ui-font-mono` (PT Mono)**.
- Botones: 16px `--ui-fw-medium`, sin uppercase forzado.
- Un solo `<h1>` por página.
- Line-height base 1.5 para lectura tipo documento; tight 1.2 solo para títulos grandes.

### 2.3 Espaciado

```scss
--ui-sp-1: 4px;   /* tight: chips, inline icons */
--ui-sp-2: 8px;   /* sm: inner padding */
--ui-sp-3: 12px;  /* md-: between siblings */
--ui-sp-4: 16px;  /* md: card padding default */
--ui-sp-6: 24px;  /* lg: section gaps */
--ui-sp-8: 32px;  /* xl: page padding, hero spacing */
```

Paper aprovecha **whitespace generoso**: padding interno de cards `--ui-sp-4` mínimo; entre secciones `--ui-sp-6`+; márgenes de página `--ui-sp-6` (móvil) / `--ui-sp-8` (desktop).

### 2.4 Breakpoints

| Token | Min | Intención |
|---|---|---|
| xs | 0 | Móvil retrato |
| sm | 576px | Móvil horizontal |
| md | 768px | Tablet |
| lg | 992px | Laptop (split-pane menu) |
| xl | 1200px | Desktop |

Diseñar **xs primero**, agregar complejidad y whitespace en `md+`.

### 2.5 Motion

- `120ms` micro (hover, focus) · `200ms` default (transitions) · `300ms` modal/sheet.
- Easing: `cubic-bezier(0.2, 0, 0, 1)`.
- Botones presionados: shadow se atenúa + `scale(0.98)` (no translate — paper "se hunde", no "cae").
- Cards hover (desktop): shadow sube de `md` → `lg`, sin transform.
- Respetar `prefers-reduced-motion`: desactivar todo lo no esencial.

---

## 3. Reglas por componente

### Botón

- Estructura: padding `12px 20px`, border `1px solid var(--ui-border-strong)`, radius `--ui-radius` (6px), shadow `--ui-shadow-sm`, font 16px medium.
- **Variantes:** `primary` (fondo teal, texto blanco, sin border), `secondary` (fondo blanco, border gris, texto principal), `success`/`warning`/`danger` (fondo color, texto blanco o `#111827` según contraste), `ghost` (sin border, sin shadow, solo hover bg).
- **Estados obligatorios:**
  - `default`
  - `:hover` (web): shadow sube a `md`, brillo +4%
  - `:focus-visible`: outline 2px `--ui-primary` offset 2px
  - `:active`: shadow `sm`, `scale(0.98)`
  - `:disabled`: opacity 0.5, cursor not-allowed
  - `loading`: spinner pequeño + texto, ancho fijo
- Móvil: altura mínima 44×44px.
- Texto: verbo + sustantivo en español, sin uppercase.

### Card

- Border `1px solid var(--ui-border)`, shadow `--ui-shadow-md`, bg `--ui-surface`, padding `--ui-sp-4` (16px) mínimo, radius `--ui-radius` (6px).
- Hover desktop: shadow → `--ui-shadow-lg`, sin movimiento.
- **Variantes:**
  - `default`
  - `status-accent` — franja izquierda 3px del color del status (border-left)
  - `elevated` — shadow `lg` por defecto, para destacar
  - `flat` — sin shadow, solo border (listas densas)

### Input / Select / Textarea

- Border `1px solid var(--ui-border-strong)`, bg `--ui-surface`, padding `10px 12px`, radius `--ui-radius`, font 16px (evita zoom iOS).
- `:focus` — border `--ui-primary` 1px + shadow ring `0 0 0 3px rgba(13,148,136,0.15)`.
- Error — border `--ui-danger` + helper text danger debajo.
- Disabled — bg `--ui-surface-3`, texto `--ui-text-muted`.
- Móvil height ≥ 48px. SKU → `inputmode="text" autocapitalize="characters"`.
- Label arriba del input, no flotante.

### List item

- Padding `12px 16px`, divisor `1px solid var(--ui-border)` (no shadow entre items).
- Hover desktop: bg `--ui-surface-3`.
- Móvil thumbnail 48px, tablet 56px.
- Desktop con detalle: `ion-split-pane` (lista izquierda + detalle derecha).

### Navegación

- Móvil: tab-bar inferior 4–5 items max, fondo `--ui-surface`, border-top `1px`, ícono+label.
- Desktop: sidebar persistente `ion-menu` ancho 280px, bg `--ui-surface`, ítem activo con bg `--ui-surface-2` + border-left 3px teal.

### Modal / Sheet / Alert / Toast

- **Modal desktop**: card centrada max-w 560px, radius `--ui-radius-lg` (8px), shadow `--ui-shadow-xl`, backdrop `rgba(17,24,39,0.4)`.
- **Sheet móvil**: full-width bottom, radius top 8px, shadow `xl`.
- **Alert**: solo para destructive/confirm — título + descripción + 2 botones max (cancel/destructive).
- **Toast**: 3s no bloqueante, esquina inferior, shadow `lg`, max-w 400px.

### Badge / Chip

- Píldora `radius: 9999px`, padding `4px 10px`, font 14px medium.
- Variantes por color semántico (success/warning/danger/excess/neutral).
- **Nunca solo color** — siempre acompañado de texto o ícono.

---

## 4. Patrones ItemFlow

### StatusBadge

Píldora con ícono + texto. `radius-pill` + border-w-sm + bg suave del color (e.g. `success-tint`) o invertido sólido. Variantes: `available` (emerald), `low` (ámbar), `critical`/`out` (rojo). **Nunca solo color** — ícono o letra acompaña.

### AlertCard

- Card con franja izquierda `border-left: 3px solid` del color del tipo:
  - `restock` → ámbar
  - `stockout_risk` → rojo
  - `excess` → violeta
- Shadow por priority: `high` → `lg`, `medium` → `md`, `low` → `sm`.
- Header: tipo + timestamp; body: mensaje + datos; footer: acciones (Acknowledge / Resolve).

### KardexRow

- Fila densa, números en `--ui-font-mono` para alineación perfecta.
- Íconos por tipo: in ↑ emerald, out ↓ rojo, transfer ⇄ teal, adjust ⚙ ámbar.
- **Sin botones editar/eliminar — kardex es append-only** (regla de dominio).
- Hover: bg `--ui-surface-3` muy sutil.

### ABCClassBadge

Cuadrado 32×32px radius `--ui-radius-sm` con letra grande Montserrat black. A → fondo rojo, B → ámbar, C → emerald.

### WizardStep

4 pasos: Catálogo → Insumos → Recetas → Ventas. Círculo numerado + label. Bloqueados grises, actual primary, completos success con check ✓.

### EmptyStateCTA

Ícono 64px + heading `--ui-fs-xl` semibold Montserrat + body 16px regular + CTA primary. Mensaje cita el paso faltante por su nombre canónico ("Aún no tienes recetas. Crea tu primera receta para usar el cálculo de costos.").

### KPI Card

- Grid 2×2 móvil / 1×4 tablet+, gap `--ui-sp-4`.
- Card con border-top 2px del color semántico (no franja izquierda como AlertCard).
- Label arriba 14px muted; valor `--ui-fs-3xl` (40px) bold mono; delta abajo (▲ success / ▼ danger).

---

## 5. Accesibilidad WCAG 2.2 AA (12 criterios testeables)

| # | Criterio | Test |
|---|---|---|
| A1 | Tab order lógico | Tab a través de página sigue flujo visual |
| A2 | Focus visible | Outline 2px primary, offset 2px, contraste ≥ 3:1 |
| A3 | Contraste texto | 4.5:1 normal, 3:1 large (verificar con axe) |
| A4 | Nunca solo color | StatusBadge tiene texto/ícono además del color |
| A5 | aria-label en icon-only | Todos los botones de solo ícono tienen aria-label |
| A6 | Labels asociados | `<label for>` o aria-labelledby en todos los inputs |
| A7 | aria-live para errores | Errores en aria-live="polite", validaciones críticas "assertive" |
| A8 | Touch ≥ 44×44px | Targets táctiles móvil ≥ 44px |
| A9 | Un `<h1>` por página | Estructura semántica jerárquica |
| A10 | Modal trap + restore focus | Focus atrapado al abrir, restaurado al cerrar |
| A11 | prefers-reduced-motion | Animaciones desactivadas cuando preferido |
| A12 | `<html lang="es">` | Documento declara idioma |

---

## 6. Contenido y tono

**Vocabulario canónico ItemFlow:** Insumo, Receta, Bodega, Punto de reorden, Kardex, Quiebre, Predicción de demanda, Orden de Compra (OC), Clasificación ABC.

**Botones:** verbo + sustantivo, primera letra mayúscula, sin uppercase.
✅ "Generar OC" / "Recibir insumos" / "Guardar receta"
❌ "OK" / "ENVIAR" / "Click here"

**Empty states:** decir qué falta + siguiente acción concreta + CTA.
✅ "Aún no tienes insumos. Agrega tu primer insumo para empezar a registrar movimientos."

**Errores:** qué pasó + qué hacer + datos relevantes.
✅ "No pudimos guardar la receta. Verifica que todas las cantidades sean > 0 y vuelve a intentarlo."

**Confirmaciones destructivas:** nombrar el objeto + describir consecuencia.
✅ "¿Eliminar el insumo Harina de trigo? Se desactivará en todas las recetas que lo usan."

**Números:** siempre con unidad explícita (`12 kg`, `$1.200 CLP`, `3 días`).

**i18n:** sin strings inline — todo via tokens i18n preparado.

---

## 7. Anti-patrones

- Hardcodear hex / px / spacing en componentes (usar tokens).
- Radius > 8px (cards) o ≠ 9999px (pills).
- Sombras duras desplazadas tipo neobrutalism (`Xpx Xpx 0 0`).
- Bordes negros gruesos (`2–3px solid #000`).
- Texto blanco sobre ámbar / emerald claro (contraste insuficiente).
- Desactivar `:focus` para "verse limpio".
- Spinners en listas de datos cargados (usar skeleton paper).
- Componentes Material / Bootstrap sobrepuestos a Ionic.
- Diseñar desktop-first.
- Interacciones solo hover (móvil no las recibe).
- Botones icon-only sin `aria-label`.
- Strings inglés en UI productiva.
- Violeta para algo que no sea `excess`.
- Editar / eliminar entradas de kardex (append-only).
- Uppercase forzado en botones / links (Ionic Material default).
- Dark mode "negro carbón" — usar gris-azulado oscuro coherente con paper.

---

## 8. QA checklist

**Tokens:**
- [ ] Cero hex / px / font-family hardcoded en `.ts/.scss` de componentes.
- [ ] Borders usan `--ui-border-w-*` y color `--ui-border` o `--ui-border-strong`.
- [ ] Shadows usan `--ui-shadow-*` (blandas, no duras desplazadas).
- [ ] Radius usa `--ui-radius*` (6/8) o `--ui-radius-pill` (9999).

**Responsive:**
- [ ] Probado en 360 / 768 / 1280px.
- [ ] Targets ≥ 44×44px en móvil.
- [ ] Usa Ionic grid o CSS grid, sin scroll horizontal.
- [ ] Whitespace generoso en desktop (`--ui-sp-6`+).

**Estados:**
- [ ] Todos los interactivos tienen default + :hover (web) + :focus-visible + :active + disabled + loading donde aplique.
- [ ] Botones presionados: shadow `sm` + `scale(0.98)` (sin translate).

**A11y:**
- [ ] axe 0 violaciones críticas.
- [ ] Navegación 100% por teclado.
- [ ] Screen reader anuncia estados y cambios.
- [ ] `prefers-reduced-motion` respetado.

**Contenido:**
- [ ] Botones verbo+sustantivo en español.
- [ ] Errores accionables con qué hacer.
- [ ] Empty states con CTA citando paso faltante.
- [ ] Vocabulario ItemFlow canónico.
- [ ] Sin strings inline (i18n-ready).

**Cross-platform:**
- [ ] iOS / Android (Capacitor) / Chrome / Safari renderizan igual.
- [ ] Plugins Capacitor con fallback web cuando aplique.

**ItemFlow específico:**
- [ ] StatusBadge nunca solo color (texto+ícono).
- [ ] Kardex sin botones editar/eliminar.
- [ ] Empty state cita el paso del flujo faltante.
- [ ] Excess es violeta (no rojo).
- [ ] Números siempre con unidad.
- [ ] Números monetarios y cantidades en `--ui-font-mono` (PT Mono).

---

## Comportamiento esperado (mío, como asistente)

1. Reformular la intención visual en **una frase** antes de proponer reglas.
2. Definir **tokens** primero, después componentes.
3. Producir **mockups ASCII** móvil Y desktop antes de escribir código.
4. Si surge conflicto entre estética paper y WCAG → priorizar WCAG y plantear alternativa.
5. Ser **opinionado** y **concreto**: citar tokens por nombre, dar valores exactos.
6. Vocabulario español canónico ItemFlow siempre.
7. Cada regla "do" emparejada con un "don't" concreto.

<!-- TYPEUI_SH_MANAGED_END -->
