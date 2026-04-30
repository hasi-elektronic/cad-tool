# hasi-elektronic / cad-tool

Two things live in this repo:

| Path | What it is | Deploy target |
| ---- | ---------- | ------------- |
| `index.html`, `dashboard.html` | Static HTML CAD configurator (Flansche / Drückteile / Konus / Schablonen) — your existing tool, unchanged | (your existing Pages project) |
| `app/` | **HASI CAD** — a new browser-based 2D drafting editor (React + Vite + TS + raw Canvas) | `hasi-cad.pages.dev` |

## HASI CAD (`app/`)

Browser-based 2D technical drawing editor. Pure HTML5 Canvas, no external CAD libs.

### Features
- Infinite canvas, pan (middle / Alt-drag), zoom-to-cursor (wheel), configurable mm grid + origin cross
- Drawing: **Line, Polyline, Rect, Circle, Arc, Ellipse, Dimension**
- Editing: **Select, Move, Copy, Mirror, Offset, Trim, Fillet, Delete**
- Snap (endpoint > midpoint/quadrant > center > intersection > grid) with per-type yellow markers
- Ortho mode, layers (color/visibility/lock), unlimited undo/redo
- AutoCAD-style command line (`100,50`, `@30,0`, distances, tool aliases, ↑/↓ history)
- Properties panel with editable per-entity fields, status bar, help overlay (`?`)
- DXF R2010 export (HEADER + TABLES + ENTITIES + EOF) and DXF import
- PWA / offline-capable

### Develop
```bash
cd app
npm install
npm run dev      # http://localhost:5173
npm run build    # → app/dist/
```

### Deploy
GitHub Actions auto-deploys `app/dist/` to the Cloudflare Pages project `hasi-cad`
on every push to `main` (workflow: `.github/workflows/deploy.yml`).

Required GitHub repo secrets:
- `CLOUDFLARE_API_TOKEN` — token with `Account · Cloudflare Pages · Edit` permission
- `CLOUDFLARE_ACCOUNT_ID` — `ac6ab4ce1149a3591d014841856490af`

Manual deploy from your machine:
```bash
cd app && npm run build
npx wrangler pages deploy dist --project-name=hasi-cad
```
