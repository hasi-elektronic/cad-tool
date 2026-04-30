import type { DimensionEntity, Entity, Layer, Point, Viewport } from '../core/types';
import { worldToScreen } from '../core/viewport';
import { distance, formatNumber } from '../core/math';

const SELECT_COLOR = '#33afe2';

export function drawEntities(
  ctx: CanvasRenderingContext2D,
  v: Viewport,
  entities: Entity[],
  layers: Layer[],
  selectedIds: Set<string>,
): void {
  const layerMap = new Map(layers.map((l) => [l.id, l]));

  for (const e of entities) {
    const layer = layerMap.get(e.layerId);
    if (!layer || !layer.visible) continue;
    const isSelected = selectedIds.has(e.id);
    const color = isSelected ? SELECT_COLOR : layer.color;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    // Hairline by default (matches AutoCAD's lineweight 0); slightly heavier
    // when selected so the highlight reads even over busy geometry.
    ctx.lineWidth = isSelected ? 1.75 : 1;
    drawEntity(ctx, v, e);
    if (isSelected) drawHandles(ctx, v, e);
  }
}

function drawEntity(ctx: CanvasRenderingContext2D, v: Viewport, e: Entity): void {
  switch (e.type) {
    case 'line': {
      const a = worldToScreen(v, e.a);
      const b = worldToScreen(v, e.b);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      return;
    }
    case 'rect': {
      const a = worldToScreen(v, e.a);
      const b = worldToScreen(v, e.b);
      ctx.beginPath();
      ctx.rect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      ctx.stroke();
      return;
    }
    case 'circle': {
      const c = worldToScreen(v, e.c);
      ctx.beginPath();
      ctx.arc(c.x, c.y, e.r * v.scale, 0, Math.PI * 2);
      ctx.stroke();
      return;
    }
    case 'arc': {
      const c = worldToScreen(v, e.c);
      // Screen Y is inverted, so swap angles to keep CCW-in-world look right.
      ctx.beginPath();
      ctx.arc(c.x, c.y, e.r * v.scale, -e.endAngle, -e.startAngle);
      ctx.stroke();
      return;
    }
    case 'polyline': {
      if (e.points.length < 2) return;
      ctx.beginPath();
      const first = worldToScreen(v, e.points[0]);
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < e.points.length; i++) {
        const p = worldToScreen(v, e.points[i]);
        ctx.lineTo(p.x, p.y);
      }
      if (e.closed) ctx.closePath();
      ctx.stroke();
      return;
    }
    case 'ellipse': {
      const c = worldToScreen(v, e.c);
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, e.rx * v.scale, e.ry * v.scale, -e.rotation, 0, Math.PI * 2);
      ctx.stroke();
      return;
    }
    case 'dimension':
      drawDimensionEntity(ctx, v, e);
      return;
    case 'text': {
      const p = worldToScreen(v, e.pos);
      const fontPx = Math.max(8, e.height * v.scale);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(-e.rotation);
      ctx.font = `${fontPx}px 'JetBrains Mono', monospace`;
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(e.text, 0, 0);
      ctx.restore();
      return;
    }
  }
}

// Format the numeric label for any dimension, honouring override / precision /
// prefix / suffix.
function dimLabel(d: DimensionEntity, value: number, isAngle = false): string {
  if (d.override && d.override.length > 0) return d.override;
  const precision = d.precision ?? 2;
  const num = formatNumber(value, precision);
  const core = isAngle ? `${num}°` : num;
  return `${d.prefix ?? ''}${core}${d.suffix ?? ''}`;
}

function drawDimensionEntity(ctx: CanvasRenderingContext2D, v: Viewport, d: DimensionEntity) {
  const kind = d.kind ?? 'aligned';
  if (kind === 'aligned') return drawLinearDim(ctx, v, d, d.a, d.b);
  if (kind === 'horizontal') {
    // Project both points onto a horizontal dimension line at y = midY+offset.
    const midY = (d.a.y + d.b.y) / 2 + d.offset;
    return drawProjectedLinearDim(ctx, v, d, d.a, d.b, { x: d.a.x, y: midY }, { x: d.b.x, y: midY }, Math.abs(d.b.x - d.a.x));
  }
  if (kind === 'vertical') {
    const midX = (d.a.x + d.b.x) / 2 + d.offset;
    return drawProjectedLinearDim(ctx, v, d, d.a, d.b, { x: midX, y: d.a.y }, { x: midX, y: d.b.y }, Math.abs(d.b.y - d.a.y));
  }
  if (kind === 'radius' || kind === 'diameter') return drawRadialDim(ctx, v, d);
  if (kind === 'angular') return drawAngularDim(ctx, v, d);
}

// Aligned dimension: dimension line is parallel to a→b and offset perpendicular.
function drawLinearDim(
  ctx: CanvasRenderingContext2D,
  v: Viewport,
  d: DimensionEntity,
  a: Point,
  b: Point,
) {
  const aS = worldToScreen(v, a);
  const bS = worldToScreen(v, b);
  const dx = bS.x - aS.x;
  const dy = bS.y - aS.y;
  const L = Math.hypot(dx, dy) || 1;
  const offPx = d.offset * v.scale;
  const nx = -dy / L;
  const ny = dx / L;
  const aD = { x: aS.x + nx * offPx, y: aS.y + ny * offPx };
  const bD = { x: bS.x + nx * offPx, y: bS.y + ny * offPx };
  drawLinearGuts(ctx, d, aS, bS, aD, bD, dx, dy, L, nx, ny, offPx, distance(a, b));
}

// Linear dim with explicit projection points (for horizontal/vertical).
function drawProjectedLinearDim(
  ctx: CanvasRenderingContext2D,
  v: Viewport,
  d: DimensionEntity,
  a: Point,
  b: Point,
  pa: Point, // a projected onto dimension line (world)
  pb: Point, // b projected onto dimension line (world)
  measured: number,
) {
  const aS = worldToScreen(v, a);
  const bS = worldToScreen(v, b);
  const aD = worldToScreen(v, pa);
  const bD = worldToScreen(v, pb);
  const dx = bD.x - aD.x;
  const dy = bD.y - aD.y;
  const L = Math.hypot(dx, dy) || 1;
  // Extension line direction: from each measured point toward its projection.
  // We compute it directly from screen positions (signed offset implied).
  drawLinearGutsExplicit(ctx, d, aS, bS, aD, bD, dx, dy, L, measured);
}

// Shared body for linear dimensions; nx,ny is the unit perpendicular toward
// the dim line (sign-aware via offPx).
function drawLinearGuts(
  ctx: CanvasRenderingContext2D,
  d: DimensionEntity,
  aS: Point,
  bS: Point,
  aD: Point,
  bD: Point,
  dx: number,
  dy: number,
  L: number,
  nx: number,
  ny: number,
  offPx: number,
  measured: number,
) {
  const sgn = Math.sign(offPx) || 1;
  const gap = 4;
  const beyond = 4;
  const exA1 = { x: aS.x + nx * sgn * gap, y: aS.y + ny * sgn * gap };
  const exB1 = { x: bS.x + nx * sgn * gap, y: bS.y + ny * sgn * gap };
  const exA2 = { x: aD.x + nx * sgn * beyond, y: aD.y + ny * sgn * beyond };
  const exB2 = { x: bD.x + nx * sgn * beyond, y: bD.y + ny * sgn * beyond };
  ctx.beginPath();
  ctx.moveTo(exA1.x, exA1.y);
  ctx.lineTo(exA2.x, exA2.y);
  ctx.moveTo(exB1.x, exB1.y);
  ctx.lineTo(exB2.x, exB2.y);
  ctx.moveTo(aD.x, aD.y);
  ctx.lineTo(bD.x, bD.y);
  ctx.stroke();

  drawDimEnds(ctx, d, aD, bD, dx, dy, L, nx, ny);
  drawDimText(ctx, d, aD, bD, dx, dy, dimLabel(d, measured));
}

// Variant for horizontal/vertical where extension lines go straight from
// measured point to projected point regardless of normal vector.
function drawLinearGutsExplicit(
  ctx: CanvasRenderingContext2D,
  d: DimensionEntity,
  aS: Point,
  bS: Point,
  aD: Point,
  bD: Point,
  dx: number,
  dy: number,
  L: number,
  measured: number,
) {
  const gap = 4;
  const beyond = 4;
  // Direction from each S to its D, normalised.
  const dirA = unit(aD.x - aS.x, aD.y - aS.y);
  const dirB = unit(bD.x - bS.x, bD.y - bS.y);
  ctx.beginPath();
  ctx.moveTo(aS.x + dirA.x * gap, aS.y + dirA.y * gap);
  ctx.lineTo(aD.x + dirA.x * beyond, aD.y + dirA.y * beyond);
  ctx.moveTo(bS.x + dirB.x * gap, bS.y + dirB.y * gap);
  ctx.lineTo(bD.x + dirB.x * beyond, bD.y + dirB.y * beyond);
  ctx.moveTo(aD.x, aD.y);
  ctx.lineTo(bD.x, bD.y);
  ctx.stroke();

  // For end ticks/arrows we need a perpendicular to the dim line; use any
  // perpendicular to (dx,dy).
  const nx = -dy / L;
  const ny = dx / L;
  drawDimEnds(ctx, d, aD, bD, dx, dy, L, nx, ny);
  drawDimText(ctx, d, aD, bD, dx, dy, dimLabel(d, measured));
}

function drawDimEnds(
  ctx: CanvasRenderingContext2D,
  d: DimensionEntity,
  aD: Point,
  bD: Point,
  dx: number,
  dy: number,
  L: number,
  nx: number,
  ny: number,
) {
  const arrow = d.arrow ?? 'tick';
  if (arrow === 'tick') {
    const tx = (dx / L) * 5;
    const ty = (dy / L) * 5;
    ctx.beginPath();
    ctx.moveTo(aD.x - tx - nx * 5, aD.y - ty - ny * 5);
    ctx.lineTo(aD.x + tx + nx * 5, aD.y + ty + ny * 5);
    ctx.moveTo(bD.x - tx - nx * 5, bD.y - ty - ny * 5);
    ctx.lineTo(bD.x + tx + nx * 5, bD.y + ty + ny * 5);
    ctx.stroke();
    return;
  }
  // Arrow heads: filled triangles pointing outward from each end.
  drawArrowHead(ctx, aD, { x: aD.x - dx / L, y: aD.y - dy / L });
  drawArrowHead(ctx, bD, { x: bD.x + dx / L, y: bD.y + dy / L });
}

function drawArrowHead(ctx: CanvasRenderingContext2D, tip: Point, dirTo: Point) {
  // dirTo is a point that gives direction tip→away-from-line.
  const dx = dirTo.x - tip.x;
  const dy = dirTo.y - tip.y;
  const L = Math.hypot(dx, dy) || 1;
  const ux = dx / L;
  const uy = dy / L;
  const back = { x: tip.x + ux * 9, y: tip.y + uy * 9 };
  const w = 3;
  const px = -uy * w;
  const py = ux * w;
  ctx.beginPath();
  ctx.moveTo(tip.x, tip.y);
  ctx.lineTo(back.x + px, back.y + py);
  ctx.lineTo(back.x - px, back.y - py);
  ctx.closePath();
  ctx.fill();
}

function drawDimText(
  ctx: CanvasRenderingContext2D,
  _d: DimensionEntity,
  aD: Point,
  bD: Point,
  dx: number,
  dy: number,
  text: string,
) {
  const mid = { x: (aD.x + bD.x) / 2, y: (aD.y + bD.y) / 2 };
  let ang = Math.atan2(dy, dx);
  if (ang > Math.PI / 2 || ang < -Math.PI / 2) ang += Math.PI;
  ctx.save();
  ctx.translate(mid.x, mid.y);
  ctx.rotate(ang);
  ctx.font = "11px 'JetBrains Mono', monospace";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(text, 0, -4);
  ctx.restore();
}

function unit(x: number, y: number): Point {
  const L = Math.hypot(x, y) || 1;
  return { x: x / L, y: y / L };
}

function drawRadialDim(ctx: CanvasRenderingContext2D, v: Viewport, d: DimensionEntity) {
  // a = circle centre; offset = circle radius; b = leader tail (text anchor).
  const cS = worldToScreen(v, d.a);
  const tail = worldToScreen(v, d.b);
  const r = d.offset * v.scale;
  // Direction from centre toward leader.
  const dirx = tail.x - cS.x;
  const diry = tail.y - cS.y;
  const L = Math.hypot(dirx, diry) || 1;
  const ux = dirx / L;
  const uy = diry / L;
  // Point on the circle nearest the leader.
  const onCircle = { x: cS.x + ux * r, y: cS.y + uy * r };
  // For diameter we draw across the full diameter; for radius from centre to circle.
  if ((d.kind ?? 'aligned') === 'diameter') {
    const opp = { x: cS.x - ux * r, y: cS.y - uy * r };
    ctx.beginPath();
    ctx.moveTo(opp.x, opp.y);
    ctx.lineTo(onCircle.x, onCircle.y);
    ctx.stroke();
    drawArrowHead(ctx, opp, { x: opp.x - ux, y: opp.y - uy });
    drawArrowHead(ctx, onCircle, { x: onCircle.x + ux, y: onCircle.y + uy });
  } else {
    ctx.beginPath();
    ctx.moveTo(cS.x, cS.y);
    ctx.lineTo(onCircle.x, onCircle.y);
    ctx.stroke();
    drawArrowHead(ctx, onCircle, { x: onCircle.x + ux, y: onCircle.y + uy });
  }
  // Leader from circle to tail (if leader sits outside the circle).
  if (L > r) {
    ctx.beginPath();
    ctx.moveTo(onCircle.x, onCircle.y);
    ctx.lineTo(tail.x, tail.y);
    ctx.stroke();
  }
  // Label
  const measure = (d.kind ?? 'aligned') === 'diameter' ? d.offset * 2 : d.offset;
  const fallbackPrefix = (d.kind ?? 'aligned') === 'diameter' ? 'Ø' : 'R';
  const label = (d.override && d.override.length > 0)
    ? d.override
    : `${d.prefix ?? fallbackPrefix}${formatNumber(measure, d.precision ?? 2)}${d.suffix ?? ''}`;
  ctx.save();
  ctx.font = "11px 'JetBrains Mono', monospace";
  ctx.textAlign = ux >= 0 ? 'left' : 'right';
  ctx.textBaseline = 'middle';
  const padX = (ux >= 0 ? 1 : -1) * 4;
  ctx.fillText(label, tail.x + padX, tail.y - 6);
  ctx.restore();
}

function drawAngularDim(ctx: CanvasRenderingContext2D, v: Viewport, d: DimensionEntity) {
  if (!d.c) return;
  const vS = worldToScreen(v, d.c);
  const aS = worldToScreen(v, d.a);
  const bS = worldToScreen(v, d.b);
  const r = d.offset * v.scale;
  // Angles in screen space (note Y flipped on canvas).
  const angA = Math.atan2(aS.y - vS.y, aS.x - vS.x);
  const angB = Math.atan2(bS.y - vS.y, bS.x - vS.x);
  // Normalise to choose the smaller sweep direction.
  let start = angA;
  let end = angB;
  let delta = end - start;
  while (delta <= -Math.PI) delta += 2 * Math.PI;
  while (delta > Math.PI) delta -= 2 * Math.PI;
  const ccw = delta > 0;
  // Extension lines from arms toward arc radius.
  const armEnd = (a: number) => ({ x: vS.x + Math.cos(a) * (r + 6), y: vS.y + Math.sin(a) * (r + 6) });
  const aTip = armEnd(angA);
  const bTip = armEnd(angB);
  ctx.beginPath();
  ctx.moveTo(vS.x + Math.cos(angA) * 4, vS.y + Math.sin(angA) * 4);
  ctx.lineTo(aTip.x, aTip.y);
  ctx.moveTo(vS.x + Math.cos(angB) * 4, vS.y + Math.sin(angB) * 4);
  ctx.lineTo(bTip.x, bTip.y);
  ctx.stroke();
  // Arc
  ctx.beginPath();
  ctx.arc(vS.x, vS.y, r, start, end, !ccw);
  ctx.stroke();
  // Arrow heads at arc endpoints, tangent to the arc.
  const tangentTip = (a: number, sign: number) => ({
    x: vS.x + Math.cos(a) * r,
    y: vS.y + Math.sin(a) * r,
    dx: -Math.sin(a) * sign,
    dy: Math.cos(a) * sign,
  });
  const t1 = tangentTip(start, ccw ? -1 : 1);
  const t2 = tangentTip(end, ccw ? 1 : -1);
  drawArrowHead(ctx, { x: t1.x, y: t1.y }, { x: t1.x + t1.dx, y: t1.y + t1.dy });
  drawArrowHead(ctx, { x: t2.x, y: t2.y }, { x: t2.x + t2.dx, y: t2.y + t2.dy });
  // Label at midpoint angle.
  const mid = (start + end) / 2;
  const tx = vS.x + Math.cos(mid) * (r + 12);
  const ty = vS.y + Math.sin(mid) * (r + 12);
  // Compute world-space angle in degrees (use absolute sweep, accounting for
  // flipped Y axis: world delta = -screen delta).
  const worldDeg = Math.abs(delta) * (180 / Math.PI);
  ctx.save();
  ctx.font = "11px 'JetBrains Mono', monospace";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(dimLabel(d, worldDeg, true), tx, ty);
  ctx.restore();
}

function drawHandles(ctx: CanvasRenderingContext2D, v: Viewport, e: Entity): void {
  const handlePoints: Point[] = [];
  switch (e.type) {
    case 'line':
    case 'rect':
      handlePoints.push(e.a, e.b);
      break;
    case 'dimension':
      handlePoints.push(e.a, e.b);
      if (e.c) handlePoints.push(e.c);
      break;
    case 'circle':
    case 'arc':
    case 'ellipse':
      handlePoints.push(e.c);
      break;
    case 'polyline':
      handlePoints.push(...e.points);
      break;
    case 'text':
      handlePoints.push(e.pos);
      break;
  }
  // AutoCAD-style grips: filled cyan squares with a dark outline so they
  // remain visible even on cyan-coloured geometry.
  ctx.fillStyle = SELECT_COLOR;
  ctx.strokeStyle = '#0d0d10';
  ctx.lineWidth = 1;
  for (const p of handlePoints) {
    const s = worldToScreen(v, p);
    const x = Math.round(s.x) - 3.5;
    const y = Math.round(s.y) - 3.5;
    ctx.beginPath();
    ctx.rect(x, y, 7, 7);
    ctx.fill();
    ctx.stroke();
  }
}
