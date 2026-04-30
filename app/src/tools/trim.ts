import type { Entity, LineEntity, Point } from '../core/types';
import type { Tool, ToolContext, ToolEvent, ToolResult } from './types';
import { distanceToEntity } from '../core/hit';
import { distance, segmentCircleIntersections, segmentIntersection } from '../core/math';
import { uid } from '../core/id';

interface TrimOpts {
  getAll: () => Entity[];
}

// Click a line near one endpoint to trim it back to the nearest intersection
// with another entity. Supports trimming lines only (most common case).
export class TrimTool implements Tool {
  id = 'trim';
  hint = 'STUTZEN: Linie nahe dem zu entfernenden Teil anklicken';
  private opts: TrimOpts;
  constructor(opts: TrimOpts) {
    this.opts = opts;
  }

  step(ev: ToolEvent, ctx: ToolContext): ToolResult {
    if (ev.type === 'cancel') return { done: true };
    if (ev.type === 'click') {
      const click = ev.point ?? ctx.cursor;
      const all = this.opts.getAll();
      // Find the nearest line to the click point.
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
      if (!target || bestDist > 5 / ctx.viewport.scale) return { done: false };
      // Collect intersection points on the target with all other entities.
      const intersections: Point[] = [];
      for (const e of all) {
        if (e.id === target.id) continue;
        if (e.type === 'line') {
          const ip = segmentIntersection(target.a, target.b, e.a, e.b);
          if (ip) intersections.push(ip);
        } else if (e.type === 'circle') {
          intersections.push(...segmentCircleIntersections(target.a, target.b, e.c, e.r));
        } else if (e.type === 'arc') {
          intersections.push(...segmentCircleIntersections(target.a, target.b, e.c, e.r));
        }
      }
      if (intersections.length === 0) return { done: false };
      // Determine click side: which endpoint is the click closer to?
      const tNear = closerToEnd(target, click); // 0 = a, 1 = b
      // Find the intersection closest to that endpoint.
      const refPt = tNear === 0 ? target.a : target.b;
      let cut: Point | null = null;
      let bestCutDist = Infinity;
      for (const ip of intersections) {
        const d = distance(ip, refPt);
        if (d < bestCutDist && d > 1e-6) {
          bestCutDist = d;
          cut = ip;
        }
      }
      if (!cut) return { done: false };
      const remove = [target.id];
      const replacement: LineEntity = {
        id: uid('tr'),
        type: 'line',
        layerId: target.layerId,
        a: tNear === 0 ? cut : target.a,
        b: tNear === 0 ? target.b : cut,
      };
      return { commit: [replacement], remove, done: false };
    }
    return { done: false };
  }
  preview(_ctx: ToolContext) {
    return [];
  }
}

function closerToEnd(line: LineEntity, p: Point): 0 | 1 {
  const da = distance(p, line.a);
  const db = distance(p, line.b);
  return da < db ? 0 : 1;
}
