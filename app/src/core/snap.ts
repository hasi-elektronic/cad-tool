import type { Entity, Point, SnapResult, SnapType, Viewport } from './types';
import {
  distance,
  segmentIntersection,
  segmentCircleIntersections,
  circleCircleIntersections,
  closestPointOnSegment,
  angleInArc,
} from './math';

export interface SnapOptions {
  enabled: boolean;
  gridStep: number;
  // Snap radius in screen pixels — converted to world units by dividing by viewport scale.
  pickRadiusPx: number;
  // The point the current tool draws FROM (base of the rubber band) — enables
  // perpendicular and tangent snaps, which are relative to that point.
  from?: Point | null;
  // Per-type enable flags; a missing key counts as enabled.
  types?: Partial<Record<SnapType, boolean>>;
}

// Priority: endpoint > midpoint/quadrant > center > intersection > lot/tangente > nearest > grid.
const PRIORITY: Record<SnapResult['type'], number> = {
  endpoint: 8,
  quadrant: 7,
  midpoint: 7,
  center: 6,
  intersection: 5,
  perpendicular: 4,
  tangent: 4,
  nearest: 2,
  grid: 1,
};

export function findSnap(
  cursorWorld: Point,
  entities: Entity[],
  viewport: Viewport,
  opts: SnapOptions,
): SnapResult | null {
  if (!opts.enabled) return null;
  const radius = opts.pickRadiusPx / viewport.scale;
  const enabled = (t: SnapType) => opts.types?.[t] !== false;

  let best: SnapResult | null = null;

  const consider = (cand: SnapResult) => {
    if (!enabled(cand.type)) return;
    const d = distance(cursorWorld, cand.point);
    if (d > radius) return;
    if (!best) {
      best = cand;
      return;
    }
    if (PRIORITY[cand.type] > PRIORITY[best.type]) {
      best = cand;
    } else if (PRIORITY[cand.type] === PRIORITY[best.type]) {
      const bd = distance(cursorWorld, best.point);
      if (d < bd) best = cand;
    }
  };

  // Collect candidate points per entity.
  const segments: { a: Point; b: Point; id: string }[] = [];
  const circles: { c: Point; r: number; id: string; start?: number; end?: number }[] = [];

  for (const e of entities) {
    switch (e.type) {
      case 'line':
        consider({ point: e.a, type: 'endpoint', entityId: e.id });
        consider({ point: e.b, type: 'endpoint', entityId: e.id });
        consider({
          point: { x: (e.a.x + e.b.x) / 2, y: (e.a.y + e.b.y) / 2 },
          type: 'midpoint',
          entityId: e.id,
        });
        segments.push({ a: e.a, b: e.b, id: e.id });
        break;
      case 'rect': {
        const corners: Point[] = [
          { x: e.a.x, y: e.a.y },
          { x: e.b.x, y: e.a.y },
          { x: e.b.x, y: e.b.y },
          { x: e.a.x, y: e.b.y },
        ];
        for (const c of corners) consider({ point: c, type: 'endpoint', entityId: e.id });
        for (let i = 0; i < 4; i++) {
          const p1 = corners[i];
          const p2 = corners[(i + 1) % 4];
          consider({
            point: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 },
            type: 'midpoint',
            entityId: e.id,
          });
          segments.push({ a: p1, b: p2, id: e.id });
        }
        break;
      }
      case 'circle':
        consider({ point: e.c, type: 'center', entityId: e.id });
        consider({ point: { x: e.c.x + e.r, y: e.c.y }, type: 'quadrant', entityId: e.id });
        consider({ point: { x: e.c.x - e.r, y: e.c.y }, type: 'quadrant', entityId: e.id });
        consider({ point: { x: e.c.x, y: e.c.y + e.r }, type: 'quadrant', entityId: e.id });
        consider({ point: { x: e.c.x, y: e.c.y - e.r }, type: 'quadrant', entityId: e.id });
        circles.push({ c: e.c, r: e.r, id: e.id });
        break;
      case 'arc': {
        consider({ point: e.c, type: 'center', entityId: e.id });
        const start = {
          x: e.c.x + e.r * Math.cos(e.startAngle),
          y: e.c.y + e.r * Math.sin(e.startAngle),
        };
        const end = {
          x: e.c.x + e.r * Math.cos(e.endAngle),
          y: e.c.y + e.r * Math.sin(e.endAngle),
        };
        consider({ point: start, type: 'endpoint', entityId: e.id });
        consider({ point: end, type: 'endpoint', entityId: e.id });
        const midA = (e.startAngle + e.endAngle) / 2;
        consider({
          point: { x: e.c.x + e.r * Math.cos(midA), y: e.c.y + e.r * Math.sin(midA) },
          type: 'midpoint',
          entityId: e.id,
        });
        circles.push({ c: e.c, r: e.r, id: e.id, start: e.startAngle, end: e.endAngle });
        break;
      }
      case 'polyline': {
        const n = e.points.length;
        const lim = e.closed ? n : n - 1;
        for (let i = 0; i < n; i++) consider({ point: e.points[i], type: 'endpoint', entityId: e.id });
        for (let i = 0; i < lim; i++) {
          const a = e.points[i];
          const b = e.points[(i + 1) % n];
          consider({
            point: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
            type: 'midpoint',
            entityId: e.id,
          });
          segments.push({ a, b, id: e.id });
        }
        break;
      }
      case 'ellipse':
        consider({ point: e.c, type: 'center', entityId: e.id });
        break;
      case 'dimension':
        consider({ point: e.a, type: 'endpoint', entityId: e.id });
        consider({ point: e.b, type: 'endpoint', entityId: e.id });
        break;
      case 'text':
        consider({ point: e.pos, type: 'endpoint', entityId: e.id });
        break;
    }
  }

  // Nächster Punkt (nearest): the exact point on the entity under the cursor.
  if (enabled('nearest')) {
    for (const s of segments) {
      const { point } = closestPointOnSegment(cursorWorld, s.a, s.b);
      consider({ point, type: 'nearest', entityId: s.id });
    }
    for (const c of circles) {
      const dx = cursorWorld.x - c.c.x;
      const dy = cursorWorld.y - c.c.y;
      const len = Math.hypot(dx, dy);
      if (len < 1e-9) continue;
      const ang = Math.atan2(dy, dx);
      if (c.start !== undefined && c.end !== undefined && !angleInArc(ang, c.start, c.end)) continue;
      consider({
        point: { x: c.c.x + (dx / len) * c.r, y: c.c.y + (dy / len) * c.r },
        type: 'nearest',
        entityId: c.id,
      });
    }
  }

  // Lot (perpendicular) and Tangente — both relative to the tool's base point.
  if (opts.from) {
    const from = opts.from;
    if (enabled('perpendicular')) {
      for (const s of segments) {
        const { point, t } = closestPointOnSegment(from, s.a, s.b);
        // Only a true interior foot counts; clamped ends are endpoint snaps.
        if (t > 1e-6 && t < 1 - 1e-6) consider({ point, type: 'perpendicular', entityId: s.id });
      }
      for (const c of circles) {
        const dx = from.x - c.c.x;
        const dy = from.y - c.c.y;
        const len = Math.hypot(dx, dy);
        if (len < 1e-9) continue;
        for (const sign of [1, -1]) {
          const p = { x: c.c.x + (dx / len) * c.r * sign, y: c.c.y + (dy / len) * c.r * sign };
          const ang = Math.atan2(p.y - c.c.y, p.x - c.c.x);
          if (c.start !== undefined && c.end !== undefined && !angleInArc(ang, c.start, c.end)) continue;
          consider({ point: p, type: 'perpendicular', entityId: c.id });
        }
      }
    }
    if (enabled('tangent')) {
      for (const c of circles) {
        const dx = from.x - c.c.x;
        const dy = from.y - c.c.y;
        const d = Math.hypot(dx, dy);
        if (d <= c.r + 1e-9) continue;
        const base = Math.atan2(dy, dx);
        const alpha = Math.acos(c.r / d);
        for (const sign of [1, -1]) {
          const ang = base + alpha * sign;
          if (c.start !== undefined && c.end !== undefined && !angleInArc(ang, c.start, c.end)) continue;
          consider({
            point: { x: c.c.x + c.r * Math.cos(ang), y: c.c.y + c.r * Math.sin(ang) },
            type: 'tangent',
            entityId: c.id,
          });
        }
      }
    }
  }

  // Intersections (cap iterations to keep it fast in dense scenes).
  if (segments.length < 200 && circles.length < 60) {
    for (let i = 0; i < segments.length; i++) {
      for (let j = i + 1; j < segments.length; j++) {
        const ip = segmentIntersection(segments[i].a, segments[i].b, segments[j].a, segments[j].b);
        if (ip) consider({ point: ip, type: 'intersection' });
      }
      for (const c of circles) {
        const pts = segmentCircleIntersections(segments[i].a, segments[i].b, c.c, c.r);
        for (const p of pts) consider({ point: p, type: 'intersection' });
      }
    }
    for (let i = 0; i < circles.length; i++) {
      for (let j = i + 1; j < circles.length; j++) {
        const pts = circleCircleIntersections(circles[i].c, circles[i].r, circles[j].c, circles[j].r);
        for (const p of pts) consider({ point: p, type: 'intersection' });
      }
    }
  }

  // Grid snap (always weakest).
  if (opts.gridStep > 0) {
    const gx = Math.round(cursorWorld.x / opts.gridStep) * opts.gridStep;
    const gy = Math.round(cursorWorld.y / opts.gridStep) * opts.gridStep;
    consider({ point: { x: gx, y: gy }, type: 'grid' });
  }

  return best;
}
