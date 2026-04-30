import type { Entity, Point } from '../core/types';
import type { Tool, ToolContext, ToolEvent, ToolResult } from './types';
import { uid } from '../core/id';

function offsetEntity(e: Entity, side: number, dist: number): Entity | null {
  // Side: +1 or -1 (which side of the entity). For lines/polylines, perpendicular
  // direction by the right-hand rule from a→b. For circles, +1 grows, -1 shrinks.
  switch (e.type) {
    case 'line': {
      const dx = e.b.x - e.a.x;
      const dy = e.b.y - e.a.y;
      const L = Math.hypot(dx, dy) || 1;
      const nx = (-dy / L) * side * dist;
      const ny = (dx / L) * side * dist;
      return { ...e, id: uid('of'), a: { x: e.a.x + nx, y: e.a.y + ny }, b: { x: e.b.x + nx, y: e.b.y + ny } };
    }
    case 'circle': {
      const r = e.r + side * dist;
      if (r <= 0) return null;
      return { ...e, id: uid('of'), r };
    }
    case 'arc': {
      const r = e.r + side * dist;
      if (r <= 0) return null;
      return { ...e, id: uid('of'), r };
    }
    case 'rect': {
      // Grow/shrink the rectangle by `dist` in all directions.
      const minX = Math.min(e.a.x, e.b.x) - dist * side;
      const maxX = Math.max(e.a.x, e.b.x) + dist * side;
      const minY = Math.min(e.a.y, e.b.y) - dist * side;
      const maxY = Math.max(e.a.y, e.b.y) + dist * side;
      if (maxX <= minX || maxY <= minY) return null;
      return { ...e, id: uid('of'), a: { x: minX, y: minY }, b: { x: maxX, y: maxY } };
    }
    case 'polyline': {
      // Per-segment parallel offset; vertices are recomputed as intersections of
      // adjacent offset lines. Doesn't handle self-intersection cleanup.
      const n = e.points.length;
      if (n < 2) return null;
      const offsetLines: { a: Point; b: Point }[] = [];
      for (let i = 0; i < n - 1; i++) {
        const a = e.points[i];
        const b = e.points[i + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const L = Math.hypot(dx, dy) || 1;
        const nx = (-dy / L) * side * dist;
        const ny = (dx / L) * side * dist;
        offsetLines.push({ a: { x: a.x + nx, y: a.y + ny }, b: { x: b.x + nx, y: b.y + ny } });
      }
      const newPts: Point[] = [offsetLines[0].a];
      for (let i = 0; i < offsetLines.length - 1; i++) {
        const l1 = offsetLines[i];
        const l2 = offsetLines[i + 1];
        const d1x = l1.b.x - l1.a.x;
        const d1y = l1.b.y - l1.a.y;
        const d2x = l2.b.x - l2.a.x;
        const d2y = l2.b.y - l2.a.y;
        const denom = d1x * d2y - d1y * d2x;
        if (Math.abs(denom) < 1e-9) {
          newPts.push(l1.b);
          continue;
        }
        const t = ((l2.a.x - l1.a.x) * d2y - (l2.a.y - l1.a.y) * d2x) / denom;
        newPts.push({ x: l1.a.x + t * d1x, y: l1.a.y + t * d1y });
      }
      newPts.push(offsetLines[offsetLines.length - 1].b);
      return { ...e, id: uid('of'), points: newPts };
    }
    default:
      return null;
  }
}

interface OffsetOpts {
  ids: string[];
  getEntity: (id: string) => Entity | undefined;
}

export class OffsetTool implements Tool {
  id = 'offset';
  hint = 'VERSATZ: Abstand eingeben, dann Seite klicken';
  private dist: number | null = null;
  private opts: OffsetOpts;

  constructor(opts: OffsetOpts) {
    this.opts = opts;
  }

  step(ev: ToolEvent, ctx: ToolContext): ToolResult {
    if (ev.type === 'cancel') return { done: true };
    if (ev.type === 'value') {
      const v = parseFloat(ev.value || '');
      if (isFinite(v) && v > 0) {
        this.dist = v;
        return { done: false, hint: `VERSATZ (${v}): Seite anklicken` };
      }
      return { done: false };
    }
    if (ev.type === 'click') {
      if (this.dist == null) {
        return { done: false, hint: 'VERSATZ: zuerst positiven Abstand eingeben' };
      }
      const out: Entity[] = [];
      const click = ev.point ?? ctx.cursor;
      for (const id of this.opts.ids) {
        const ent = this.opts.getEntity(id);
        if (!ent) continue;
        const side = pickSide(ent, click);
        const o = offsetEntity(ent, side, this.dist);
        if (o) out.push(o);
      }
      this.dist = null;
      return { commit: out, done: true };
    }
    return { done: false };
  }

  preview(_ctx: ToolContext) {
    return [];
  }

  expects() {
    return (this.dist == null ? 'distance' : 'point') as 'distance' | 'point';
  }
}

function pickSide(e: Entity, click: Point): number {
  if (e.type === 'line') {
    const dx = e.b.x - e.a.x;
    const dy = e.b.y - e.a.y;
    const cross = (click.x - e.a.x) * dy - (click.y - e.a.y) * dx;
    return cross > 0 ? -1 : 1;
  }
  if (e.type === 'circle' || e.type === 'arc') {
    const d = Math.hypot(click.x - e.c.x, click.y - e.c.y);
    return d > e.r ? 1 : -1;
  }
  if (e.type === 'rect') {
    const cx = (e.a.x + e.b.x) / 2;
    const cy = (e.a.y + e.b.y) / 2;
    const halfW = Math.abs(e.b.x - e.a.x) / 2;
    const halfH = Math.abs(e.b.y - e.a.y) / 2;
    const inside = Math.abs(click.x - cx) < halfW && Math.abs(click.y - cy) < halfH;
    return inside ? -1 : 1;
  }
  return 1;
}
