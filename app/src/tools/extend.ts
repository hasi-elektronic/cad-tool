import type { Entity, LineEntity, Point } from '../core/types';
import type { Tool, ToolContext, ToolEvent, ToolResult } from './types';
import { distanceToEntity } from '../core/hit';
import { distance, lineLineIntersection, segmentCircleIntersections, sub, dot } from '../core/math';
import { uid } from '../core/id';

interface ExtendOpts {
  getAll: () => Entity[];
}

// DEHNEN (Extend) — the inverse of trim: click a line near the end you want
// to grow; that end extends to the nearest intersection of the line's
// extension with any other entity.
export class ExtendTool implements Tool {
  id = 'extend';
  hint = 'DEHNEN: Linie nahe dem zu verlängernden Ende anklicken';
  private opts: ExtendOpts;
  constructor(opts: ExtendOpts) {
    this.opts = opts;
  }

  step(ev: ToolEvent, ctx: ToolContext): ToolResult {
    if (ev.type === 'cancel') return { done: true };
    if (ev.type !== 'click') return { done: false };

    const click = ev.point ?? ctx.cursor;
    const all = this.opts.getAll();
    let target: LineEntity | null = null;
    let bestDist = Infinity;
    for (const e of all) {
      if (e.type !== 'line') continue;
      const d = distanceToEntity(e, click);
      if (d < bestDist) {
        bestDist = d;
        target = e;
      }
    }
    if (!target || bestDist > 6 / ctx.viewport.scale) return { done: false };

    // Which end grows? The one the click is closer to.
    const growB = distance(click, target.b) < distance(click, target.a);
    const fixed = growB ? target.a : target.b;
    const tip = growB ? target.b : target.a;
    const dir = sub(tip, fixed);
    const len = Math.hypot(dir.x, dir.y);
    if (len < 1e-9) return { done: false };

    // Collect boundary intersections along the ray BEYOND the current tip.
    const candidates: Point[] = [];
    // Long helper segment from the tip outwards (10^5 mm covers any drawing).
    const far: Point = { x: tip.x + (dir.x / len) * 1e5, y: tip.y + (dir.y / len) * 1e5 };
    for (const e of all) {
      if (e.id === target.id) continue;
      if (e.type === 'line') {
        const ip = lineLineIntersection(fixed, tip, e.a, e.b);
        if (!ip) continue;
        // Must lie on the boundary segment...
        const t = paramOnSegment(ip, e.a, e.b);
        if (t < -1e-6 || t > 1 + 1e-6) continue;
        // ...and beyond the growing tip.
        if (dot(sub(ip, tip), dir) > 1e-9) candidates.push(ip);
      } else if (e.type === 'circle' || e.type === 'arc') {
        for (const ip of segmentCircleIntersections(tip, far, e.c, e.r)) {
          if (dot(sub(ip, tip), dir) > 1e-9) candidates.push(ip);
        }
      } else if (e.type === 'rect') {
        const cs = [
          { x: e.a.x, y: e.a.y },
          { x: e.b.x, y: e.a.y },
          { x: e.b.x, y: e.b.y },
          { x: e.a.x, y: e.b.y },
        ];
        for (let i = 0; i < 4; i++) {
          const ip = lineLineIntersection(fixed, tip, cs[i], cs[(i + 1) % 4]);
          if (!ip) continue;
          const t = paramOnSegment(ip, cs[i], cs[(i + 1) % 4]);
          if (t < -1e-6 || t > 1 + 1e-6) continue;
          if (dot(sub(ip, tip), dir) > 1e-9) candidates.push(ip);
        }
      }
    }
    if (!candidates.length)
      return { done: false, hint: 'DEHNEN: Keine Grenzkante in Verlängerung gefunden' };

    let cut = candidates[0];
    for (const c of candidates) if (distance(c, tip) < distance(cut, tip)) cut = c;

    const replacement: LineEntity = {
      id: uid('ex'),
      type: 'line',
      layerId: target.layerId,
      a: growB ? target.a : cut,
      b: growB ? cut : target.b,
    };
    return { commit: [replacement], remove: [target.id], done: false };
  }

  preview() {
    return [];
  }
}

// Parameter t of point p along segment a→b (p assumed collinear).
function paramOnSegment(p: Point, a: Point, b: Point): number {
  const ab = sub(b, a);
  const L2 = dot(ab, ab);
  if (L2 < 1e-12) return 0;
  return dot(sub(p, a), ab) / L2;
}
