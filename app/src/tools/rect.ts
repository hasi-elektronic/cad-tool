import { uid } from '../core/id';
import type { Point, RectEntity } from '../core/types';
import type { Tool, ToolContext, ToolEvent, ToolResult } from './types';

export class RectTool implements Tool {
  id = 'rect';
  hint = 'RECT: pick first corner';
  private a: Point | null = null;

  step(ev: ToolEvent, ctx: ToolContext): ToolResult {
    if (ev.type === 'cancel') {
      this.a = null;
      return { done: true };
    }
    if (ev.type === 'click' || ev.type === 'value') {
      const p = ev.point ?? ctx.cursor;
      if (!this.a) {
        this.a = p;
        return { done: false, hint: 'RECT: pick opposite corner' };
      }
      if (Math.abs(this.a.x - p.x) < 1e-6 || Math.abs(this.a.y - p.y) < 1e-6) {
        return { done: false };
      }
      const r: RectEntity = { id: uid('rec'), type: 'rect', layerId: ctx.activeLayerId, a: this.a, b: p };
      this.a = null;
      return { commit: [r], done: true };
    }
    return { done: false };
  }

  preview(ctx: ToolContext) {
    if (!this.a) return [];
    const r: RectEntity = {
      id: 'preview',
      type: 'rect',
      layerId: ctx.activeLayerId,
      a: this.a,
      b: ctx.cursor,
    };
    return [r];
  }

  expects() {
    return 'point' as const;
  }
}
