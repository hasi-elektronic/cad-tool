import type { DocState } from '../state/store';
import type { Entity } from '../core/types';
import { distance, formatNumber } from '../core/math';

// AutoCAD R2010 (AC1024). We emit just enough HEADER + TABLES to satisfy strict
// importers, then write all entities and close the file.
export function entitiesToDXF(doc: DocState): string {
  const out: string[] = [];
  const w = (code: number, val: string | number) => {
    out.push(String(code).padStart(3, ' '));
    out.push(typeof val === 'number' ? String(val) : val);
  };

  // SECTION HEADER
  w(0, 'SECTION');
  w(2, 'HEADER');
  w(9, '$ACADVER');
  w(1, 'AC1024');
  w(9, '$INSUNITS');
  w(70, 4); // millimetres
  w(9, '$EXTMIN');
  w(10, '0.0');
  w(20, '0.0');
  w(30, '0.0');
  w(9, '$EXTMAX');
  w(10, '100.0');
  w(20, '100.0');
  w(30, '0.0');
  w(0, 'ENDSEC');

  // SECTION TABLES — minimal LAYER table.
  w(0, 'SECTION');
  w(2, 'TABLES');
  w(0, 'TABLE');
  w(2, 'LAYER');
  w(70, doc.layers.length);
  for (const l of doc.layers) {
    w(0, 'LAYER');
    w(2, sanitizeName(l.name));
    w(70, l.locked ? 4 : 0);
    w(62, dxfColorIndex(l.color));
    w(6, 'CONTINUOUS');
  }
  w(0, 'ENDTAB');
  w(0, 'ENDSEC');

  // SECTION ENTITIES
  w(0, 'SECTION');
  w(2, 'ENTITIES');
  for (const e of doc.entities) {
    const layerName = sanitizeName(doc.layers.find((l) => l.id === e.layerId)?.name ?? '0');
    writeEntity(w, e, layerName);
  }
  w(0, 'ENDSEC');

  w(0, 'EOF');

  // Pair up code/value lines.
  const lines: string[] = [];
  for (let i = 0; i < out.length; i += 2) lines.push(`${out[i].trim()}\n${out[i + 1]}`);
  return lines.join('\n') + '\n';
}

function sanitizeName(s: string): string {
  return s.replace(/[^A-Za-z0-9_\-]/g, '_');
}

// Map a hex CSS colour to an AutoCAD ACI index (closest match).
function dxfColorIndex(hex: string): number {
  // Standard ACI palette has 256 entries; we approximate using a small lookup.
  const palette: { aci: number; rgb: [number, number, number] }[] = [
    { aci: 1, rgb: [255, 0, 0] },        // red
    { aci: 2, rgb: [255, 255, 0] },      // yellow
    { aci: 3, rgb: [0, 255, 0] },        // green
    { aci: 4, rgb: [0, 255, 255] },      // cyan
    { aci: 5, rgb: [0, 0, 255] },        // blue
    { aci: 6, rgb: [255, 0, 255] },      // magenta
    { aci: 7, rgb: [255, 255, 255] },    // white
    { aci: 8, rgb: [128, 128, 128] },    // dark grey
    { aci: 9, rgb: [192, 192, 192] },    // light grey
    { aci: 30, rgb: [255, 127, 0] },     // orange
  ];
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return 7;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  let best = 7;
  let bestD = Infinity;
  for (const p of palette) {
    const d = (p.rgb[0] - r) ** 2 + (p.rgb[1] - g) ** 2 + (p.rgb[2] - b) ** 2;
    if (d < bestD) {
      bestD = d;
      best = p.aci;
    }
  }
  return best;
}

type W = (code: number, val: string | number) => void;

function writeEntity(w: W, e: Entity, layerName: string) {
  switch (e.type) {
    case 'line':
      w(0, 'LINE');
      w(8, layerName);
      w(10, fmt(e.a.x)); w(20, fmt(e.a.y)); w(30, '0.0');
      w(11, fmt(e.b.x)); w(21, fmt(e.b.y)); w(31, '0.0');
      return;
    case 'circle':
      w(0, 'CIRCLE');
      w(8, layerName);
      w(10, fmt(e.c.x)); w(20, fmt(e.c.y)); w(30, '0.0');
      w(40, fmt(e.r));
      return;
    case 'arc':
      w(0, 'ARC');
      w(8, layerName);
      w(10, fmt(e.c.x)); w(20, fmt(e.c.y)); w(30, '0.0');
      w(40, fmt(e.r));
      w(50, fmt((e.startAngle * 180) / Math.PI));
      w(51, fmt((e.endAngle * 180) / Math.PI));
      return;
    case 'rect': {
      // Emit as a closed LWPOLYLINE.
      w(0, 'LWPOLYLINE');
      w(8, layerName);
      w(90, 4);
      w(70, 1);
      const corners = [
        { x: e.a.x, y: e.a.y },
        { x: e.b.x, y: e.a.y },
        { x: e.b.x, y: e.b.y },
        { x: e.a.x, y: e.b.y },
      ];
      for (const c of corners) { w(10, fmt(c.x)); w(20, fmt(c.y)); }
      return;
    }
    case 'polyline':
      w(0, 'LWPOLYLINE');
      w(8, layerName);
      w(90, e.points.length);
      w(70, e.closed ? 1 : 0);
      for (const p of e.points) { w(10, fmt(p.x)); w(20, fmt(p.y)); }
      return;
    case 'ellipse': {
      // DXF ELLIPSE: center, major axis endpoint vector, ratio, params.
      const ex = Math.cos(e.rotation) * e.rx;
      const ey = Math.sin(e.rotation) * e.rx;
      const ratio = e.ry / Math.max(e.rx, 1e-9);
      w(0, 'ELLIPSE');
      w(8, layerName);
      w(10, fmt(e.c.x)); w(20, fmt(e.c.y)); w(30, '0.0');
      w(11, fmt(ex)); w(21, fmt(ey)); w(31, '0.0');
      w(40, fmt(ratio));
      w(41, '0.0');
      w(42, fmt(Math.PI * 2));
      return;
    }
    case 'text':
      w(0, 'TEXT');
      w(8, layerName);
      w(10, fmt(e.pos.x)); w(20, fmt(e.pos.y)); w(30, '0.0');
      w(40, fmt(e.height));
      w(1, e.text);
      w(50, fmt((e.rotation * 180) / Math.PI));
      return;
    case 'dimension': {
      // Emit dimension as concrete geometry: extension lines + dimension line + ticks + TEXT.
      const dx = e.b.x - e.a.x;
      const dy = e.b.y - e.a.y;
      const L = Math.hypot(dx, dy) || 1;
      const nx = -dy / L;
      const ny = dx / L;
      const off = e.offset;
      const aD = { x: e.a.x + nx * off, y: e.a.y + ny * off };
      const bD = { x: e.b.x + nx * off, y: e.b.y + ny * off };
      // Extension lines
      writeEntity(w, { id: '', type: 'line', layerId: '', a: e.a, b: aD } as Entity, layerName);
      writeEntity(w, { id: '', type: 'line', layerId: '', a: e.b, b: bD } as Entity, layerName);
      // Dimension line
      writeEntity(w, { id: '', type: 'line', layerId: '', a: aD, b: bD } as Entity, layerName);
      // Ticks
      const tx = (dx / L) * 2;
      const ty = (dy / L) * 2;
      writeEntity(w, { id: '', type: 'line', layerId: '', a: { x: aD.x - tx - nx * 2, y: aD.y - ty - ny * 2 }, b: { x: aD.x + tx + nx * 2, y: aD.y + ty + ny * 2 } } as Entity, layerName);
      writeEntity(w, { id: '', type: 'line', layerId: '', a: { x: bD.x - tx - nx * 2, y: bD.y - ty - ny * 2 }, b: { x: bD.x + tx + nx * 2, y: bD.y + ty + ny * 2 } } as Entity, layerName);
      // Text
      const text = formatNumber(distance(e.a, e.b), 2);
      const mid = { x: (aD.x + bD.x) / 2 + nx * 2, y: (aD.y + bD.y) / 2 + ny * 2 };
      const ang = Math.atan2(dy, dx);
      w(0, 'TEXT');
      w(8, layerName);
      w(10, fmt(mid.x)); w(20, fmt(mid.y)); w(30, '0.0');
      w(40, '3.0');
      w(1, text);
      w(50, fmt((ang * 180) / Math.PI));
      return;
    }
  }
}

function fmt(n: number): string {
  if (!isFinite(n)) return '0.0';
  return n.toFixed(6);
}

export function downloadDXF(doc: DocState, filename = 'hasi-cad-export.dxf'): void {
  const text = entitiesToDXF(doc);
  const blob = new Blob([text], { type: 'application/dxf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
}
