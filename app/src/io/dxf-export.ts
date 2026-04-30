import type { DocState } from '../state/store';
import type { DimensionEntity, Entity, Point } from '../core/types';
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
      writeDimension(w, e, layerName);
      return;
    }
  }
}

function fmt(n: number): string {
  if (!isFinite(n)) return '0.0';
  return n.toFixed(6);
}

function dimText(d: DimensionEntity, value: number, isAngle = false): string {
  if (d.override && d.override.length > 0) return d.override;
  const num = formatNumber(value, d.precision ?? 2);
  const core = isAngle ? `${num}°` : num;
  return `${d.prefix ?? ''}${core}${d.suffix ?? ''}`;
}

function writeDimension(w: W, d: DimensionEntity, layerName: string): void {
  const kind = d.kind ?? 'aligned';
  if (kind === 'aligned') return writeLinearDim(w, d, layerName, 'aligned');
  if (kind === 'horizontal') return writeLinearDim(w, d, layerName, 'horizontal');
  if (kind === 'vertical') return writeLinearDim(w, d, layerName, 'vertical');
  if (kind === 'radius' || kind === 'diameter') return writeRadialDim(w, d, layerName);
  if (kind === 'angular') return writeAngularDim(w, d, layerName);
}

function writeLinearDim(
  w: W,
  d: DimensionEntity,
  layerName: string,
  kind: 'aligned' | 'horizontal' | 'vertical',
): void {
  const a = d.a;
  const b = d.b;
  let aD: Point;
  let bD: Point;
  let measured: number;
  if (kind === 'horizontal') {
    const lineY = (a.y + b.y) / 2 + d.offset;
    aD = { x: a.x, y: lineY };
    bD = { x: b.x, y: lineY };
    measured = Math.abs(b.x - a.x);
  } else if (kind === 'vertical') {
    const lineX = (a.x + b.x) / 2 + d.offset;
    aD = { x: lineX, y: a.y };
    bD = { x: lineX, y: b.y };
    measured = Math.abs(b.y - a.y);
  } else {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L;
    const ny = dx / L;
    aD = { x: a.x + nx * d.offset, y: a.y + ny * d.offset };
    bD = { x: b.x + nx * d.offset, y: b.y + ny * d.offset };
    measured = distance(a, b);
  }
  // Extension + dim lines.
  emitLine(w, layerName, a, aD);
  emitLine(w, layerName, b, bD);
  emitLine(w, layerName, aD, bD);
  // End ticks.
  const dimDx = bD.x - aD.x;
  const dimDy = bD.y - aD.y;
  const L = Math.hypot(dimDx, dimDy) || 1;
  const tx = (dimDx / L) * 2;
  const ty = (dimDy / L) * 2;
  const nx = -dimDy / L;
  const ny = dimDx / L;
  emitLine(w, layerName, { x: aD.x - tx - nx * 2, y: aD.y - ty - ny * 2 }, { x: aD.x + tx + nx * 2, y: aD.y + ty + ny * 2 });
  emitLine(w, layerName, { x: bD.x - tx - nx * 2, y: bD.y - ty - ny * 2 }, { x: bD.x + tx + nx * 2, y: bD.y + ty + ny * 2 });
  // Text.
  const mid = { x: (aD.x + bD.x) / 2 + nx * 2, y: (aD.y + bD.y) / 2 + ny * 2 };
  const ang = Math.atan2(dimDy, dimDx);
  emitText(w, layerName, mid, dimText(d, measured), ang);
}

function writeRadialDim(w: W, d: DimensionEntity, layerName: string): void {
  const c = d.a;
  const tail = d.b;
  const r = d.offset;
  const dirx = tail.x - c.x;
  const diry = tail.y - c.y;
  const L = Math.hypot(dirx, diry) || 1;
  const ux = dirx / L;
  const uy = diry / L;
  const onCircle = { x: c.x + ux * r, y: c.y + uy * r };
  const opp = { x: c.x - ux * r, y: c.y - uy * r };
  const isDia = (d.kind ?? 'aligned') === 'diameter';
  if (isDia) emitLine(w, layerName, opp, onCircle);
  else emitLine(w, layerName, c, onCircle);
  if (L > r) emitLine(w, layerName, onCircle, tail);
  const measure = isDia ? r * 2 : r;
  const fallback = isDia ? 'Ø' : 'R';
  const txt = (d.override && d.override.length > 0)
    ? d.override
    : `${d.prefix ?? fallback}${formatNumber(measure, d.precision ?? 2)}${d.suffix ?? ''}`;
  emitText(w, layerName, { x: tail.x + ux * 2, y: tail.y + uy * 2 }, txt, 0);
}

function writeAngularDim(w: W, d: DimensionEntity, layerName: string): void {
  if (!d.c) return;
  const v = d.c;
  const r = d.offset;
  const angA = Math.atan2(d.a.y - v.y, d.a.x - v.x);
  const angB = Math.atan2(d.b.y - v.y, d.b.x - v.x);
  let delta = angB - angA;
  while (delta <= -Math.PI) delta += 2 * Math.PI;
  while (delta > Math.PI) delta -= 2 * Math.PI;
  const start = delta >= 0 ? angA : angB;
  const end = delta >= 0 ? angB : angA;
  // Extension legs from vertex out to arc.
  emitLine(w, layerName, v, { x: v.x + Math.cos(angA) * (r + 4), y: v.y + Math.sin(angA) * (r + 4) });
  emitLine(w, layerName, v, { x: v.x + Math.cos(angB) * (r + 4), y: v.y + Math.sin(angB) * (r + 4) });
  // Arc as ARC entity (CCW from start to end).
  w(0, 'ARC');
  w(8, layerName);
  w(10, fmt(v.x)); w(20, fmt(v.y)); w(30, '0.0');
  w(40, fmt(r));
  w(50, fmt((start * 180) / Math.PI));
  w(51, fmt((end * 180) / Math.PI));
  // Text at mid-angle.
  const mid = (angA + angB) / 2;
  const tx = v.x + Math.cos(mid) * (r + 4);
  const ty = v.y + Math.sin(mid) * (r + 4);
  emitText(w, layerName, { x: tx, y: ty }, dimText(d, Math.abs(delta) * (180 / Math.PI), true), 0);
}

function emitLine(w: W, layerName: string, a: Point, b: Point): void {
  w(0, 'LINE');
  w(8, layerName);
  w(10, fmt(a.x)); w(20, fmt(a.y)); w(30, '0.0');
  w(11, fmt(b.x)); w(21, fmt(b.y)); w(31, '0.0');
}

function emitText(w: W, layerName: string, pos: Point, text: string, angRad: number): void {
  w(0, 'TEXT');
  w(8, layerName);
  w(10, fmt(pos.x)); w(20, fmt(pos.y)); w(30, '0.0');
  w(40, '3.0');
  w(1, text);
  w(50, fmt((angRad * 180) / Math.PI));
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
