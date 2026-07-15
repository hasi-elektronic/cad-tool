import type { Entity, Point } from '../core/types';
import type { Tool, ToolContext, ToolEvent, ToolResult } from './types';
import { distance } from '../core/math';
import { scaleEntity } from '../core/transform';

interface ScaleOpts {
  ids: string[];
  getEntity: (id: string) => Entity | undefined;
}

// AutoCAD-style SKALIEREN with reference: base point → reference point →
// new point (factor = new distance / reference distance). A numeric factor
// can be typed at any time after the base point.
export class ScaleTool implements Tool {
  readonly id = 'scale';
  hint: string;
  private base: Point | null = null;
  private ref: Point | null = null;
  private opts: ScaleOpts;

  constructor(opts: ScaleOpts) {
    this.opts = opts;
    this.hint = opts.ids.length
      ? 'SKALIEREN: Basispunkt wählen'
      : 'SKALIEREN: Keine Auswahl — erst Objekte wählen (V)';
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
        return { done: false, hint: 'SKALIEREN: Referenzpunkt wählen oder Faktor eingeben (z.B. 2)' };
      }
      return { done: false };
    }

    if (ev.type === 'value' && ev.value !== undefined) {
      const k = parseFloat(ev.value.replace(',', '.'));
      if (!isFinite(k) || k <= 0)
        return { done: false, hint: 'SKALIEREN: Faktor muss > 0 sein' };
      return this.commitScale(k);
    }

    if (ev.type === 'click') {
      const p = ev.point ?? ctx.cursor;
      if (!this.ref) {
        if (distance(this.base, p) < 1e-9)
          return { done: false, hint: 'SKALIEREN: Referenzpunkt darf nicht der Basispunkt sein' };
        this.ref = p;
        return { done: false, hint: 'SKALIEREN: Neuen Punkt wählen oder Faktor eingeben' };
      }
      const k = distance(this.base, p) / distance(this.base, this.ref);
      if (!isFinite(k) || k <= 0) return { done: false };
      return this.commitScale(k);
    }

    return { done: false };
  }

  private commitScale(k: number): ToolResult {
    const commit: Entity[] = [];
    const remove: string[] = [];
    for (const id of this.opts.ids) {
      const ent = this.opts.getEntity(id);
      if (!ent) continue;
      commit.push(scaleEntity(ent, k, this.base!));
      remove.push(id);
    }
    return { commit, remove, done: true };
  }

  preview(ctx: ToolContext): Entity[] {
    if (!this.base || !this.ref) return [];
    const refD = distance(this.base, this.ref);
    if (refD < 1e-9) return [];
    const k = distance(this.base, ctx.cursor) / refD;
    if (!isFinite(k) || k <= 1e-9) return [];
    const out: Entity[] = [];
    for (const id of this.opts.ids) {
      const ent = this.opts.getEntity(id);
      if (!ent) continue;
      out.push({ ...scaleEntity(ent, k, this.base), id: 'preview-' + ent.id });
    }
    return out;
  }
}
