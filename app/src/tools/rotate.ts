import type { Entity, Point } from '../core/types';
import type { Tool, ToolContext, ToolEvent, ToolResult } from './types';
import { angle } from '../core/math';
import { rotateEntity } from '../core/transform';

interface RotateOpts {
  ids: string[];
  getEntity: (id: string) => Entity | undefined;
}

// AutoCAD-style DREHEN: pick a base point, then the rotation angle — either
// by pointing (angle from base point to cursor, measured from the X axis)
// or by typing degrees into the command line.
export class RotateTool implements Tool {
  readonly id = 'rotate';
  hint: string;
  private base: Point | null = null;
  private opts: RotateOpts;

  constructor(opts: RotateOpts) {
    this.opts = opts;
    this.hint = opts.ids.length
      ? 'DREHEN: Basispunkt wählen'
      : 'DREHEN: Keine Auswahl — erst Objekte wählen (V)';
  }

  expects(): 'point' | 'distance' {
    return this.base ? 'distance' : 'point';
  }

  step(ev: ToolEvent, ctx: ToolContext): ToolResult {
    if (ev.type === 'cancel') return { done: true };
    if (!this.opts.ids.length) return { done: true };

    if (!this.base) {
      if (ev.type === 'click' || ev.type === 'value') {
        this.base = ev.point ?? ctx.cursor;
        return { done: false, hint: 'DREHEN: Winkel wählen oder Grad eingeben (z.B. 45)' };
      }
      return { done: false };
    }

    let rot: number | null = null;
    if (ev.type === 'value' && ev.value !== undefined) {
      const deg = parseFloat(ev.value.replace(',', '.'));
      if (!isFinite(deg)) return { done: false, hint: 'DREHEN: Ungültiger Winkel — Grad eingeben' };
      rot = (deg * Math.PI) / 180;
    } else if (ev.type === 'click') {
      rot = angle(this.base, ev.point ?? ctx.cursor);
    }
    if (rot === null) return { done: false };

    const commit: Entity[] = [];
    const remove: string[] = [];
    for (const id of this.opts.ids) {
      const ent = this.opts.getEntity(id);
      if (!ent) continue;
      commit.push(rotateEntity(ent, rot, this.base));
      remove.push(id);
    }
    return { commit, remove, done: true };
  }

  preview(ctx: ToolContext): Entity[] {
    if (!this.base) return [];
    const rot = angle(this.base, ctx.cursor);
    const out: Entity[] = [];
    for (const id of this.opts.ids) {
      const ent = this.opts.getEntity(id);
      if (!ent) continue;
      out.push({ ...rotateEntity(ent, rot, this.base), id: 'preview-' + ent.id });
    }
    return out;
  }
}
