import { uid } from '../core/id';
import { store } from '../state/store';
import type { DimensionEntity, Point } from '../core/types';
import type { Tool, ToolContext, ToolEvent, ToolResult } from './types';

// Dimension: pick two points → pick offset side.
export class DimensionTool implements Tool {
  id = 'dimension';
  hint = 'DIM: pick first point';
  private a: Point | null = null;
  private b: Point | null = null;

  step(ev: ToolEvent, ctx: ToolContext): ToolResult {
    if (ev.type === 'cancel') {
      this.a = null;
      this.b = null;
      return { done: true };
    }
    if (ev.type === 'click' || ev.type === 'value') {
      const p = ev.point ?? ctx.cursor;
      if (!this.a) {
        this.a = p;
        return { done: false, hint: 'DIM: pick second point' };
      }
      if (!this.b) {
        if (Math.hypot(p.x - this.a.x, p.y - this.a.y) < 1e-6) return { done: false };
        this.b = p;
        return { done: false, hint: 'DIM: pick dimension line offset' };
      }
      const offset = this.computeOffset(p);
      const layers = store.get().doc.layers;
      const dimLayer = layers.find((l) => l.id === 'L_dimensions') ? 'L_dimensions' : ctx.activeLayerId;
      const dim: DimensionEntity = {
        id: uid('dim'),
        type: 'dimension',
        layerId: dimLayer,
        a: this.a,
        b: this.b,
        offset,
      };
      this.a = null;
      this.b = null;
      return { commit: [dim], done: true };
    }
    return { done: false };
  }

  private computeOffset(p: Point): number {
    if (!this.a || !this.b) return 0;
    const dx = this.b.x - this.a.x;
    const dy = this.b.y - this.a.y;
    const L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L;
    const ny = dx / L;
    return (p.x - this.a.x) * nx + (p.y - this.a.y) * ny;
  }

  preview(ctx: ToolContext) {
    if (!this.a) return [];
    if (!this.b) {
      // Show a placeholder dimension with offset 0 against the moving second point.
      const dim: DimensionEntity = {
        id: 'preview',
        type: 'dimension',
        layerId: 'L_dimensions',
        a: this.a,
        b: ctx.cursor,
        offset: 0,
      };
      return [dim];
    }
    const dim: DimensionEntity = {
      id: 'preview',
      type: 'dimension',
      layerId: 'L_dimensions',
      a: this.a,
      b: this.b,
      offset: this.computeOffset(ctx.cursor),
    };
    return [dim];
  }

  expects() {
    return 'point' as const;
  }
}
