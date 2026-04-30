import type { Entity, Layer, Point, Viewport } from '../core/types';
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
    ctx.lineWidth = isSelected ? 2 : 1.25;
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
      drawDimension(ctx, v, e.a, e.b, e.offset);
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

export function drawDimension(
  ctx: CanvasRenderingContext2D,
  v: Viewport,
  a: Point,
  b: Point,
  offset: number,
): void {
  const aS = worldToScreen(v, a);
  const bS = worldToScreen(v, b);
  const dx = bS.x - aS.x;
  const dy = bS.y - aS.y;
  const L = Math.hypot(dx, dy) || 1;
  // Convert offset from world to screen, then take perpendicular.
  // Screen Y is inverted, so the perpendicular calculation also inverts naturally.
  const offPx = offset * v.scale;
  const nx = -dy / L;
  const ny = dx / L;
  const aD = { x: aS.x + nx * offPx, y: aS.y + ny * offPx };
  const bD = { x: bS.x + nx * offPx, y: bS.y + ny * offPx };

  // Extension lines (with a small gap from the measured points).
  const gap = 4;
  const exA1 = { x: aS.x + nx * Math.sign(offPx) * gap, y: aS.y + ny * Math.sign(offPx) * gap };
  const exB1 = { x: bS.x + nx * Math.sign(offPx) * gap, y: bS.y + ny * Math.sign(offPx) * gap };
  const exA2 = { x: aD.x + nx * 4 * Math.sign(offPx), y: aD.y + ny * 4 * Math.sign(offPx) };
  const exB2 = { x: bD.x + nx * 4 * Math.sign(offPx), y: bD.y + ny * 4 * Math.sign(offPx) };

  ctx.beginPath();
  ctx.moveTo(exA1.x, exA1.y);
  ctx.lineTo(exA2.x, exA2.y);
  ctx.moveTo(exB1.x, exB1.y);
  ctx.lineTo(exB2.x, exB2.y);
  // Dimension line
  ctx.moveTo(aD.x, aD.y);
  ctx.lineTo(bD.x, bD.y);
  ctx.stroke();

  // Architectural ticks (45° slashes)
  const tx = (dx / L) * 5;
  const ty = (dy / L) * 5;
  ctx.beginPath();
  ctx.moveTo(aD.x - tx - nx * 5, aD.y - ty - ny * 5);
  ctx.lineTo(aD.x + tx + nx * 5, aD.y + ty + ny * 5);
  ctx.moveTo(bD.x - tx - nx * 5, bD.y - ty - ny * 5);
  ctx.lineTo(bD.x + tx + nx * 5, bD.y + ty + ny * 5);
  ctx.stroke();

  // Distance text, parallel to dimension line, above it.
  const dist = distance(a, b);
  const text = formatNumber(dist, 2);
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

function drawHandles(ctx: CanvasRenderingContext2D, v: Viewport, e: Entity): void {
  const handlePoints: Point[] = [];
  switch (e.type) {
    case 'line':
    case 'rect':
    case 'dimension':
      handlePoints.push(e.a, e.b);
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
  ctx.fillStyle = SELECT_COLOR;
  ctx.strokeStyle = '#0a0a18';
  ctx.lineWidth = 1;
  for (const p of handlePoints) {
    const s = worldToScreen(v, p);
    ctx.beginPath();
    ctx.rect(s.x - 4, s.y - 4, 8, 8);
    ctx.fill();
    ctx.stroke();
  }
}
