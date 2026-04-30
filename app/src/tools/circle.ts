import { uid } from '../core/id';
import { distance } from '../core/math';
import type { CircleEntity, Point } from '../core/types';
import type { Tool, ToolContext, ToolEvent, ToolResult } from './types';

export class CircleTool implements Tool {
  id = 'circle';
  hint = 'CIRCLE: pick center';
  private center: Point | null = null;

  step(ev: ToolEvent, ctx: ToolContext): ToolResult {
    if (ev.type === 'cancel') {
      this.center = null;
      return { done: true };
    }
    if (ev.type === 'click') {
      const p = ev.point ?? ctx.cursor;
      if (!this.center) {
        this.center = p;
        return { done: false, hint: 'CIRCLE: pick radius point or type radius' };
      }
      const r = distance(this.center, p);
      if (r < 1e-6) return { done: false };
      const c: CircleEntity = { id: uid('cir'), type: 'circle', layerId: ctx.activeLayerId, c: this.center, r };
      this.center = null;
      return { commit: [c], done: true };
    }
    if (ev.type === 'value') {
      if (!this.center) {
        if (ev.point) {
          this.center = ev.point;
          return { done: false, hint: 'CIRCLE: pick radius point or type radius' };
        }
        return { done: false };
      }
      const r = parseFloat(ev.value || '');
      if (!isFinite(r) || r <= 0) return { done: false };
      const c: CircleEntity = { id: uid('cir'), type: 'circle', layerId: ctx.activeLayerId, c: this.center, r };
      this.center = null;
      return { commit: [c], done: true };
    }
    return { done: false };
  }

  preview(ctx: ToolContext) {
    if (!this.center) return [];
    const r = distance(this.center, ctx.cursor);
    if (r < 1e-6) return [];
    const c: CircleEntity = {
      id: 'preview',
      type: 'circle',
      layerId: ctx.activeLayerId,
      c: this.center,
      r,
    };
    return [c];
  }

  expects() {
    return (this.center ? 'distance' : 'point') as 'point' | 'distance';
  }
}
