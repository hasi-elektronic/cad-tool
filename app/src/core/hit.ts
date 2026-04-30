import type { Entity, Point } from './types';
import {
  distToSegment,
  distance,
  angleInArc,
  normalizeAngle,
  rotate,
} from './math';

// Returns the distance (in world units) from `p` to entity `e`, or Infinity if not hittable.
export function distanceToEntity(e: Entity, p: Point): number {
  switch (e.type) {
    case 'line':
      return distToSegment(p, e.a, e.b);
    case 'rect': {
      const corners = [
        { x: e.a.x, y: e.a.y },
        { x: e.b.x, y: e.a.y },
        { x: e.b.x, y: e.b.y },
        { x: e.a.x, y: e.b.y },
      ];
      let best = Infinity;
      for (let i = 0; i < 4; i++) {
        const d = distToSegment(p, corners[i], corners[(i + 1) % 4]);
        if (d < best) best = d;
      }
      return best;
    }
    case 'circle':
      return Math.abs(distance(p, e.c) - e.r);
    case 'arc': {
      const ang = Math.atan2(p.y - e.c.y, p.x - e.c.x);
      if (angleInArc(ang, e.startAngle, e.endAngle)) {
        return Math.abs(distance(p, e.c) - e.r);
      }
      const start = { x: e.c.x + e.r * Math.cos(e.startAngle), y: e.c.y + e.r * Math.sin(e.startAngle) };
      const end = { x: e.c.x + e.r * Math.cos(e.endAngle), y: e.c.y + e.r * Math.sin(e.endAngle) };
      return Math.min(distance(p, start), distance(p, end));
    }
    case 'polyline': {
      let best = Infinity;
      const n = e.points.length;
      const lim = e.closed ? n : n - 1;
      for (let i = 0; i < lim; i++) {
        const d = distToSegment(p, e.points[i], e.points[(i + 1) % n]);
        if (d < best) best = d;
      }
      return best;
    }
    case 'ellipse': {
      // Transform point to ellipse-local space then compare to unit circle.
      const local = rotate(p, -e.rotation, e.c);
      const dx = (local.x - e.c.x) / Math.max(e.rx, 1e-6);
      const dy = (local.y - e.c.y) / Math.max(e.ry, 1e-6);
      const r = Math.hypot(dx, dy);
      const closestParam = Math.atan2(dy, dx);
      const onEll = {
        x: e.c.x + e.rx * Math.cos(closestParam),
        y: e.c.y + e.ry * Math.sin(closestParam),
      };
      const onWorld = rotate(onEll, e.rotation, e.c);
      void r;
      return distance(p, onWorld);
    }
    case 'dimension': {
      const dx = e.b.x - e.a.x;
      const dy = e.b.y - e.a.y;
      const L = Math.hypot(dx, dy) || 1;
      const nx = -dy / L;
      const ny = dx / L;
      const aDim = { x: e.a.x + nx * e.offset, y: e.a.y + ny * e.offset };
      const bDim = { x: e.b.x + nx * e.offset, y: e.b.y + ny * e.offset };
      return Math.min(
        distToSegment(p, aDim, bDim),
        distToSegment(p, e.a, aDim),
        distToSegment(p, e.b, bDim),
      );
    }
    case 'text':
      return distance(p, e.pos);
  }
  // exhaustive
  void normalizeAngle;
  return Infinity;
}
