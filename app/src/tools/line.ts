import { uid } from '../core/id';
import type { LineEntity, Point } from '../core/types';
import type { Tool, ToolContext, ToolEvent, ToolResult } from './types';

export class LineTool implements Tool {
  id = 'line';
  hint = 'LINE: pick first point';
  private start: Point | null = null;

  step(ev: ToolEvent, ctx: ToolContext): ToolResult {
    if (ev.type === 'cancel') {
      this.start = null;
      return { done: true };
    }
    if (ev.type === 'commit') {
      this.start = null;
      return { done: true };
    }
    if (ev.type === 'click' || ev.type === 'value') {
      const p = ev.point ?? ctx.cursor;
      if (!this.start) {
        this.start = p;
        return { done: false, hint: 'LINE: pick next point (ESC to end)' };
      }
      // The LINE tool chains: emit a segment and use the just-placed point as the new start.
      const e: LineEntity = { id: uid('ln'), type: 'line', layerId: ctx.activeLayerId, a: this.start, b: p };
      this.start = p;
      return { commit: [e], done: false, hint: 'LINE: pick next point (ESC to end)' };
    }
    return { done: false };
  }

  preview(ctx: ToolContext) {
    if (!this.start) return [];
    const e: LineEntity = {
      id: 'preview',
      type: 'line',
      layerId: ctx.activeLayerId,
      a: this.start,
      b: ctx.cursor,
    };
    return [e];
  }

  expects() {
    return 'point' as const;
  }
}
