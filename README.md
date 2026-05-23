# ItemFlow — Sistema de Gestión de Inventarios

Aplicación web/móvil multi-tenant para gestión de inventarios de PYMES, construida con **Ionic 8 + Angular 20 (standalone, signals)** y desplegada como SPA estática.

## Características

- **Catálogo** de productos terminados (con o sin receta)
- **Insumos** (materias primas) con políticas de stock min/max/reorden
- **Recetas** (BOM) que explosionan al vender productos
- **Ventas** con histórico que alimenta predicciones
- **Inventario** unificado con KPIs y alertas
- **Kardex** append-only para auditoría
- **Alertas automáticas** de restock (regeneradas en cada mutación de stock)
- **Órdenes de Compra** que soportan insumos y productos de reventa
- **Ajustes manuales** (devoluciones, mermas, donaciones, conteos)
- **Predicciones IA** con simulador local que produce trayectoria 180 días + decisión de compra + chart interactivo
- **Importación masiva CSV** para catálogo, insumos, recetas y ventas
- **Personalización** de marca (nombre + logo imagen) y 12 temas visuales

## Stack

- Ionic 8 + Angular 20 standalone components
- TypeScript estricto, signals + reactive forms
- Estado in-memory (mocks) — listo para conectar a Firebase
- SVG inline para charts (sin libs externas)
- localStorage para tema y branding personalizables

## Demo en vivo

Desplegado en GitHub Pages: ver enlace en la sección **About** del repo.

## Desarrollo local

```bash
cd Inventory
npm install
npm start
# abrir http://localhost:4200
```

Login demo: cualquier email + cualquier password (auth mockeada).

## Build de producción

```bash
cd Inventory
npm run build
# salida en Inventory/www/
```

## Deploy

El workflow `.github/workflows/deploy.yml` construye y publica automáticamente a GitHub Pages al hacer push a `main`.

## Estructura

```
gestion_inventarios/
├── Inventory/                  # Aplicación Angular/Ionic
│   ├── src/app/
│   │   ├── core/               # services, models, mocks, guards
│   │   ├── features/           # páginas por dominio
│   │   └── shared/             # componentes reutilizables
│   └── ...
├── .github/workflows/          # CI/CD a GitHub Pages
└── .claude/                    # Skills y configuración de Claude Code
```

## Licencia

MIT
