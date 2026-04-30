# HASI CAD

Browser-based 2D technical drawing editor. Pure HTML5 Canvas (no external CAD libs),
React + Vite + TypeScript shell, dark industrial theme, AutoCAD-style keyboard shortcuts.

## Features

- Infinite canvas with pan (middle-click / Alt-drag) and zoom (wheel, towards cursor)
- Configurable minor/major grid (1/2/5/10/20/50/100 mm) with origin cross
- Drawing tools: **Line, Polyline, Rectangle, Circle, Arc, Ellipse, Dimension**
- Edit tools: **Select, Move, Copy, Mirror, Offset, Trim, Fillet, Delete**
- Snap system with priority: endpoint → midpoint/quadrant → center → intersection → grid
  with distinct yellow markers per snap type
- **Ortho** mode constrains drawing to horizontal/vertical from last point
- **Layers**: color, visibility, lock; reorderable defaults (`0`, `Construction`,
  `Dimensions`)
- Unlimited undo / redo
- AutoCAD-style command line at the bottom (history with ↑/↓):
  - `100,50` — absolute point
  - `@30,0` — relative point from last
  - numeric values for radius/length during a tool op
  - tool aliases (`line`, `circle`, `r`, `c`, …) and `undo`, `redo`, `fit`, `save`
- Real-time cursor coordinates, distance/angle readout while drawing
- Properties panel for the selected entity (editable values)
- DXF R2010 export (HEADER + TABLES + ENTITIES + EOF) and DXF import (LINE,
  CIRCLE, ARC, LWPOLYLINE, ELLIPSE, TEXT)
- PWA / offline support via `vite-plugin-pwa`

## Keyboard

```
L Line     C Circle   R Rectangle   A Arc       P Polyline
D Dim      V Select   E Ellipse     F Fillet*   T Trim
G Grid     S Snap     O Ortho       Space repeat last command
Del Delete selected
Ctrl+Z / Ctrl+Y  Undo / Redo
Ctrl+S Save (DXF export)
ESC Cancel current op    Enter Finish polyline
?  Help overlay
```
*F also performs Zoom-Fit when no entities are selected.*

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # → dist/
npm run preview
```

## Deploy to Cloudflare Pages

Project name: `hasi-cad` → `https://hasi-cad.pages.dev`

```bash
npm run build
npx wrangler pages deploy dist --project-name=hasi-cad
```

…or connect this GitHub repo to a Cloudflare Pages project and set the build
command to `npm run build` and output directory to `dist`.
