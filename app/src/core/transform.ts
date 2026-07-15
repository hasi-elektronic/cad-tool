import type { Entity, LineEntity, Point } from './types';
import { rotate } from './math';
import { uid } from './id';

const QUARTER = Math.PI / 2;

// Is the angle (radians) a multiple of 90°? Axis-aligned entities like rects
// survive such rotations without losing their shape.
function isRightAngleMultiple(angle: number): boolean {
  const rem = Math.abs(angle % QUARTER);
  return rem < 1e-9 || QUARTER - rem < 1e-9;
}

// Rotate an entity around `center` by `angle` radians (CCW).
// Rects rotated by a non-90° angle are converted to a closed polyline,
// because RectEntity is axis-aligned by definition. The id is preserved.
export function rotateEntity(e: Entity, angle: number, center: Point): Entity {
  const r = (p: Point): Point => rotate(p, angle, center);
  switch (e.type) {
    case 'line':
      return { ...e, a: r(e.a), b: r(e.b) };
    case 'rect': {
      if (isRightAngleMultiple(angle)) return { ...e, a: r(e.a), b: r(e.b) };
      const corners: Point[] = [
        { x: e.a.x, y: e.a.y },
        { x: e.b.x, y: e.a.y },
        { x: e.b.x, y: e.b.y },
        { x: e.a.x, y: e.b.y },
      ];
      return {
        id: e.id,
        layerId: e.layerId,
        type: 'polyline',
        points: corners.map(r),
        closed: true,
      };
    }
    case 'circle':
      return { ...e, c: r(e.c) };
    case 'arc':
      return { ...e, c: r(e.c), startAngle: e.startAngle + angle, endAngle: e.endAngle + angle };
    case 'polyline':
      return { ...e, points: e.points.map(r) };
    case 'ellipse':
      return { ...e, c: r(e.c), rotation: e.rotation + angle };
    case 'dimension':
      return { ...e, a: r(e.a), b: r(e.b), c: e.c ? r(e.c) : undefined };
    case 'text':
      return { ...e, pos: r(e.pos), rotation: e.rotation + angle };
  }
}

// Uniformly scale an entity around `center` by factor `k` (> 0).
export function scaleEntity(e: Entity, k: number, center: Point): Entity {
  const s = (p: Point): Point => ({
    x: center.x + (p.x - center.x) * k,
    y: center.y + (p.y - center.y) * k,
  });
  switch (e.type) {
    case 'line':
    case 'rect':
      return { ...e, a: s(e.a), b: s(e.b) };
    case 'circle':
    case 'arc':
      return { ...e, c: s(e.c), r: e.r * k };
    case 'polyline':
      return { ...e, points: e.points.map(s) };
    case 'ellipse':
      return { ...e, c: s(e.c), rx: e.rx * k, ry: e.ry * k };
    case 'dimension':
      return { ...e, a: s(e.a), b: s(e.b), c: e.c ? s(e.c) : undefined, offset: e.offset * k };
    case 'text':
      return { ...e, pos: s(e.pos), height: e.height * k };
  }
}

// Break a composite entity into primitive lines. Returns null when the
// entity has no meaningful decomposition (line, circle, text, ...).
export function explodeEntity(e: Entity): Entity[] | null {
  const seg = (a: Point, b: Point): LineEntity => ({
    id: uid('xp'),
    layerId: e.layerId,
    type: 'line',
    a: { ...a },
    b: { ...b },
  });
  switch (e.type) {
    case 'rect': {
      const p1 = { x: e.a.x, y: e.a.y };
      const p2 = { x: e.b.x, y: e.a.y };
      const p3 = { x: e.b.x, y: e.b.y };
      const p4 = { x: e.a.x, y: e.b.y };
      return [seg(p1, p2), seg(p2, p3), seg(p3, p4), seg(p4, p1)];
    }
    case 'polyline': {
      if (e.points.length < 2) return null;
      const out: Entity[] = [];
      for (let i = 0; i < e.points.length - 1; i++) out.push(seg(e.points[i], e.points[i + 1]));
      if (e.closed && e.points.length > 2)
        out.push(seg(e.points[e.points.length - 1], e.points[0]));
      return out;
    }
    default:
      return null;
  }
}
