import { uid } from '../core/id';
import type { Point, PolylineEntity } from '../core/types';
import type { Tool, ToolContext, ToolEvent, ToolResult } from './types';

export class PolylineTool implements Tool {
  id = 'polyline';
  hint = 'POLYLINIE: ersten Punkt wählen';
  private points: Point[] = [];

  step(ev: ToolEvent, ctx: ToolContext): ToolResult {
    if (ev.type === 'cancel') {
      this.points = [];
      return { done: true };
    }
    if (ev.type === 'commit') {
      // Enter pressed — commit accumulated points.
      if (this.points.length >= 2) {
        const e: PolylineEntity = {
          id: uid('pl'),
          type: 'polyline',
          layerId: ctx.activeLayerId,
          points: [...this.points],
          closed: false,
        };
        this.points = [];
        return { commit: [e], done: true };
      }
      this.points = [];
      return { done: true };
    }
    if (ev.type === 'click' || ev.type === 'value') {
      const p = ev.point ?? ctx.cursor;
      this.points.push(p);
      return { done: false, hint: `POLYLINIE: nächsten Punkt (Enter beendet, ESC bricht ab) — ${this.points.length} Pkt` };
    }
    return { done: false };
  }

  preview(ctx: ToolContext) {
    if (this.points.length === 0) return [];
    const e: PolylineEntity = {
      id: 'preview',
      type: 'polyline',
      layerId: ctx.activeLayerId,
      points: [...this.points, ctx.cursor],
      closed: false,
    };
    return [e];
  }

  expects() {
    return 'point' as const;
  }
}
