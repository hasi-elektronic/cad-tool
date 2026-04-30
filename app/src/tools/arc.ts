import { uid } from '../core/id';
import { distance } from '../core/math';
import type { ArcEntity, Point } from '../core/types';
import type { Tool, ToolContext, ToolEvent, ToolResult } from './types';

// 3-point arc: pick center → start point → end point.
export class ArcTool implements Tool {
  id = 'arc';
  hint = 'ARC: pick center';
  private center: Point | null = null;
  private startPt: Point | null = null;

  step(ev: ToolEvent, ctx: ToolContext): ToolResult {
    if (ev.type === 'cancel') {
      this.center = null;
      this.startPt = null;
      return { done: true };
    }
    if (ev.type === 'click' || ev.type === 'value') {
      const p = ev.point ?? ctx.cursor;
      if (!this.center) {
        this.center = p;
        return { done: false, hint: 'ARC: pick start point' };
      }
      if (!this.startPt) {
        if (distance(this.center, p) < 1e-6) return { done: false };
        this.startPt = p;
        return { done: false, hint: 'ARC: pick end point (CCW)' };
      }
      const r = distance(this.center, this.startPt);
      const startAngle = Math.atan2(this.startPt.y - this.center.y, this.startPt.x - this.center.x);
      const endAngle = Math.atan2(p.y - this.center.y, p.x - this.center.x);
      const arc: ArcEntity = {
        id: uid('arc'),
        type: 'arc',
        layerId: ctx.activeLayerId,
        c: this.center,
        r,
        startAngle,
        endAngle,
      };
      this.center = null;
      this.startPt = null;
      return { commit: [arc], done: true };
    }
    return { done: false };
  }

  preview(ctx: ToolContext) {
    if (!this.center) return [];
    if (!this.startPt) {
      const r = distance(this.center, ctx.cursor);
      const arc: ArcEntity = {
        id: 'preview',
        type: 'arc',
        layerId: ctx.activeLayerId,
        c: this.center,
        r,
        startAngle: 0,
        endAngle: Math.PI * 2 - 1e-6,
      };
      return [arc];
    }
    const r = distance(this.center, this.startPt);
    const startAngle = Math.atan2(this.startPt.y - this.center.y, this.startPt.x - this.center.x);
    const endAngle = Math.atan2(ctx.cursor.y - this.center.y, ctx.cursor.x - this.center.x);
    const arc: ArcEntity = {
      id: 'preview',
      type: 'arc',
      layerId: ctx.activeLayerId,
      c: this.center,
      r,
      startAngle,
      endAngle,
    };
    return [arc];
  }

  expects() {
    return 'point' as const;
  }
}
