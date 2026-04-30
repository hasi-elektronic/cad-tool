import type { Entity, Point } from '../core/types';
import type { Tool, ToolContext, ToolEvent, ToolResult } from './types';
import { uid } from '../core/id';

function translate(e: Entity, dx: number, dy: number): Entity {
  const t = (p: Point): Point => ({ x: p.x + dx, y: p.y + dy });
  switch (e.type) {
    case 'line':
    case 'rect':
    case 'dimension':
      return { ...e, a: t(e.a), b: t(e.b) };
    case 'circle':
    case 'arc':
    case 'ellipse':
      return { ...e, c: t(e.c) };
    case 'polyline':
      return { ...e, points: e.points.map(t) };
    case 'text':
      return { ...e, pos: t(e.pos) };
  }
}

interface MoveOpts {
  copy?: boolean;
  ids: string[];
  getEntity: (id: string) => Entity | undefined;
}

export class MoveTool implements Tool {
  id: string;
  hint: string;
  private base: Point | null = null;
  private opts: MoveOpts;

  constructor(opts: MoveOpts, copy = false) {
    this.opts = opts;
    this.id = copy ? 'copy' : 'move';
    this.hint = copy ? 'KOPIEREN: Basispunkt wählen' : 'VERSCHIEBEN: Basispunkt wählen';
  }

  step(ev: ToolEvent, ctx: ToolContext): ToolResult {
    if (ev.type === 'cancel') return { done: true };
    if (ev.type === 'click' || ev.type === 'value') {
      const p = ev.point ?? ctx.cursor;
      if (!this.base) {
        this.base = p;
        return { done: false, hint: this.id === 'copy' ? 'KOPIEREN: Zielpunkt wählen' : 'VERSCHIEBEN: Zielpunkt wählen' };
      }
      const dx = p.x - this.base.x;
      const dy = p.y - this.base.y;
      const moved: Entity[] = [];
      const remove: string[] = [];
      for (const id of this.opts.ids) {
        const ent = this.opts.getEntity(id);
        if (!ent) continue;
        if (this.id === 'copy') {
          const cloned = translate({ ...ent, id: uid('cp') }, dx, dy);
          moved.push(cloned);
        } else {
          moved.push(translate(ent, dx, dy));
          remove.push(id);
        }
      }
      this.base = null;
      return { commit: moved, remove, done: true };
    }
    return { done: false };
  }

  preview(ctx: ToolContext) {
    if (!this.base) return [];
    const dx = ctx.cursor.x - this.base.x;
    const dy = ctx.cursor.y - this.base.y;
    const out: Entity[] = [];
    for (const id of this.opts.ids) {
      const ent = this.opts.getEntity(id);
      if (!ent) continue;
      out.push({ ...translate(ent, dx, dy), id: 'preview-' + ent.id });
    }
    return out;
  }
}

export function translateEntity(e: Entity, dx: number, dy: number): Entity {
  return translate(e, dx, dy);
}
