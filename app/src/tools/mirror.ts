import type { Entity, Point } from '../core/types';
import type { Tool, ToolContext, ToolEvent, ToolResult } from './types';
import { uid } from '../core/id';

// Reflect a point across the line through (a,b).
function reflect(p: Point, a: Point, b: Point): Point {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const denom = dx * dx + dy * dy || 1;
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / denom;
  const proj = { x: a.x + t * dx, y: a.y + t * dy };
  return { x: 2 * proj.x - p.x, y: 2 * proj.y - p.y };
}

function reflectEntity(e: Entity, a: Point, b: Point): Entity {
  const r = (p: Point) => reflect(p, a, b);
  switch (e.type) {
    case 'line':
    case 'rect':
    case 'dimension': {
      const newA = r(e.a);
      const newB = r(e.b);
      if (e.type === 'dimension') return { ...e, a: newA, b: newB, offset: -e.offset };
      return { ...e, a: newA, b: newB };
    }
    case 'circle':
      return { ...e, c: r(e.c) };
    case 'arc': {
      // Reflecting flips the angular direction; swap and reflect angles.
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const axisAng = Math.atan2(dy, dx);
      const newC = r(e.c);
      const flipAngle = (ang: number) => 2 * axisAng - ang;
      return { ...e, c: newC, startAngle: flipAngle(e.endAngle), endAngle: flipAngle(e.startAngle) };
    }
    case 'polyline':
      return { ...e, points: e.points.map(r) };
    case 'ellipse':
      return { ...e, c: r(e.c), rotation: -e.rotation };
    case 'text':
      return { ...e, pos: r(e.pos), rotation: -e.rotation };
  }
}

interface MirrorOpts {
  ids: string[];
  getEntity: (id: string) => Entity | undefined;
  // If true, also remove originals.
  deleteSource: boolean;
}

export class MirrorTool implements Tool {
  id = 'mirror';
  hint = 'MIRROR: pick first axis point';
  private a: Point | null = null;
  private opts: MirrorOpts;

  constructor(opts: MirrorOpts) {
    this.opts = opts;
  }

  step(ev: ToolEvent, ctx: ToolContext): ToolResult {
    if (ev.type === 'cancel') return { done: true };
    if (ev.type === 'click' || ev.type === 'value') {
      const p = ev.point ?? ctx.cursor;
      if (!this.a) {
        this.a = p;
        return { done: false, hint: 'MIRROR: pick second axis point' };
      }
      const out: Entity[] = [];
      const remove: string[] = [];
      for (const id of this.opts.ids) {
        const ent = this.opts.getEntity(id);
        if (!ent) continue;
        const mirrored = { ...reflectEntity(ent, this.a, p), id: uid('mr') };
        out.push(mirrored);
        if (this.opts.deleteSource) remove.push(id);
      }
      this.a = null;
      return { commit: out, remove, done: true };
    }
    return { done: false };
  }

  preview(ctx: ToolContext) {
    if (!this.a) return [];
    const out: Entity[] = [];
    for (const id of this.opts.ids) {
      const ent = this.opts.getEntity(id);
      if (!ent) continue;
      out.push({ ...reflectEntity(ent, this.a, ctx.cursor), id: 'preview-' + ent.id });
    }
    return out;
  }
}
