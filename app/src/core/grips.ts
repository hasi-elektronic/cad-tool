import type { Entity, Point } from './types';
import { distance, midpoint } from './math';
import { translateEntity } from '../tools/move';

// A grip is a draggable handle on a selected entity (AutoCAD's blue squares).
export interface Grip {
  point: Point;
  // vertex: moves that point; move: drags the whole entity; radius: resizes.
  kind: 'vertex' | 'move' | 'radius';
  index: number;
}

export function gripsOf(e: Entity): Grip[] {
  switch (e.type) {
    case 'line':
      return [
        { point: e.a, kind: 'vertex', index: 0 },
        { point: e.b, kind: 'vertex', index: 1 },
        { point: midpoint(e.a, e.b), kind: 'move', index: 2 },
      ];
    case 'rect': {
      const cs = rectCorners(e.a, e.b);
      return cs.map((point, index) => ({ point, kind: 'vertex' as const, index }));
    }
    case 'circle':
      return [
        { point: e.c, kind: 'move', index: 0 },
        { point: { x: e.c.x + e.r, y: e.c.y }, kind: 'radius', index: 1 },
        { point: { x: e.c.x - e.r, y: e.c.y }, kind: 'radius', index: 2 },
        { point: { x: e.c.x, y: e.c.y + e.r }, kind: 'radius', index: 3 },
        { point: { x: e.c.x, y: e.c.y - e.r }, kind: 'radius', index: 4 },
      ];
    case 'arc': {
      const start = { x: e.c.x + e.r * Math.cos(e.startAngle), y: e.c.y + e.r * Math.sin(e.startAngle) };
      const end = { x: e.c.x + e.r * Math.cos(e.endAngle), y: e.c.y + e.r * Math.sin(e.endAngle) };
      return [
        { point: e.c, kind: 'move', index: 0 },
        { point: start, kind: 'vertex', index: 1 },
        { point: end, kind: 'vertex', index: 2 },
      ];
    }
    case 'polyline':
      return e.points.map((point, index) => ({ point, kind: 'vertex' as const, index }));
    case 'ellipse':
      return [{ point: e.c, kind: 'move', index: 0 }];
    case 'text':
      return [{ point: e.pos, kind: 'move', index: 0 }];
    case 'dimension':
      return [
        { point: e.a, kind: 'vertex', index: 0 },
        { point: e.b, kind: 'vertex', index: 1 },
      ];
  }
}

// Returns the entity with the given grip moved to `p` (same id).
export function moveGrip(e: Entity, grip: Grip, p: Point): Entity {
  if (grip.kind === 'move') {
    const dx = p.x - grip.point.x;
    const dy = p.y - grip.point.y;
    return translateEntity(e, dx, dy);
  }
  switch (e.type) {
    case 'line':
      return grip.index === 0 ? { ...e, a: p } : { ...e, b: p };
    case 'rect': {
      // Move the dragged corner; the opposite corner stays fixed.
      const cs = rectCorners(e.a, e.b);
      const opposite = cs[(grip.index + 2) % 4];
      return {
        ...e,
        a: { x: Math.min(p.x, opposite.x), y: Math.min(p.y, opposite.y) },
        b: { x: Math.max(p.x, opposite.x), y: Math.max(p.y, opposite.y) },
      };
    }
    case 'circle':
      return { ...e, r: Math.max(distance(e.c, p), 1e-6) };
    case 'arc': {
      const ang = Math.atan2(p.y - e.c.y, p.x - e.c.x);
      return grip.index === 1 ? { ...e, startAngle: ang } : { ...e, endAngle: ang };
    }
    case 'polyline': {
      const points = e.points.map((pt, i) => (i === grip.index ? p : pt));
      return { ...e, points };
    }
    case 'dimension':
      return grip.index === 0 ? { ...e, a: p } : { ...e, b: p };
    default:
      return e;
  }
}

function rectCorners(a: Point, b: Point): Point[] {
  return [
    { x: a.x, y: a.y },
    { x: b.x, y: a.y },
    { x: b.x, y: b.y },
    { x: a.x, y: b.y },
  ];
}
