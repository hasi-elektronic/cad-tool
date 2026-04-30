import type { Entity, Point } from './types';
import { angleInArc, normalizeAngle, TAU } from './math';

export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export const emptyBox = (): BBox => ({
  minX: Infinity,
  minY: Infinity,
  maxX: -Infinity,
  maxY: -Infinity,
});

export const isEmpty = (b: BBox): boolean => !isFinite(b.minX);

export function expand(b: BBox, p: Point): BBox {
  if (p.x < b.minX) b.minX = p.x;
  if (p.y < b.minY) b.minY = p.y;
  if (p.x > b.maxX) b.maxX = p.x;
  if (p.y > b.maxY) b.maxY = p.y;
  return b;
}

export function unionBox(a: BBox, b: BBox): BBox {
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

export function entityBox(e: Entity): BBox {
  const b = emptyBox();
  switch (e.type) {
    case 'line':
    case 'rect':
    case 'dimension':
      expand(b, e.a);
      expand(b, e.b);
      // Dimensions extend by their offset on the perpendicular.
      if (e.type === 'dimension') {
        const dx = e.b.x - e.a.x;
        const dy = e.b.y - e.a.y;
        const L = Math.hypot(dx, dy) || 1;
        const nx = -dy / L;
        const ny = dx / L;
        expand(b, { x: e.a.x + nx * e.offset, y: e.a.y + ny * e.offset });
        expand(b, { x: e.b.x + nx * e.offset, y: e.b.y + ny * e.offset });
      }
      break;
    case 'circle':
      expand(b, { x: e.c.x - e.r, y: e.c.y - e.r });
      expand(b, { x: e.c.x + e.r, y: e.c.y + e.r });
      break;
    case 'arc': {
      expand(b, { x: e.c.x + e.r * Math.cos(e.startAngle), y: e.c.y + e.r * Math.sin(e.startAngle) });
      expand(b, { x: e.c.x + e.r * Math.cos(e.endAngle), y: e.c.y + e.r * Math.sin(e.endAngle) });
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2;
        if (angleInArc(a, e.startAngle, e.endAngle)) {
          expand(b, { x: e.c.x + e.r * Math.cos(a), y: e.c.y + e.r * Math.sin(a) });
        }
      }
      break;
    }
    case 'polyline':
      e.points.forEach((p) => expand(b, p));
      break;
    case 'ellipse': {
      // Approximate (axis-aligned) — sufficient for hit/cull tests.
      const c = Math.cos(e.rotation);
      const s = Math.sin(e.rotation);
      const w = Math.hypot(e.rx * c, e.ry * s);
      const h = Math.hypot(e.rx * s, e.ry * c);
      expand(b, { x: e.c.x - w, y: e.c.y - h });
      expand(b, { x: e.c.x + w, y: e.c.y + h });
      break;
    }
    case 'text':
      expand(b, e.pos);
      expand(b, { x: e.pos.x + e.text.length * e.height * 0.6, y: e.pos.y + e.height });
      break;
  }
  // Avoid degenerate boxes for things like a single-point arc.
  if (b.minX === b.maxX) {
    b.minX -= 0.5;
    b.maxX += 0.5;
  }
  if (b.minY === b.maxY) {
    b.minY -= 0.5;
    b.maxY += 0.5;
  }
  // Suppress unused-import warnings that may appear in some configs.
  void normalizeAngle;
  void TAU;
  return b;
}
