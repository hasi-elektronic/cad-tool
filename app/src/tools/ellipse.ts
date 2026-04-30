import { uid } from '../core/id';
import type { EllipseEntity, Point } from '../core/types';
import type { Tool, ToolContext, ToolEvent, ToolResult } from './types';

export class EllipseTool implements Tool {
  id = 'ellipse';
  hint = 'ELLIPSE: Mittelpunkt wählen';
  private c: Point | null = null;
  private rxPoint: Point | null = null;

  step(ev: ToolEvent, ctx: ToolContext): ToolResult {
    if (ev.type === 'cancel') {
      this.c = null;
      this.rxPoint = null;
      return { done: true };
    }
    if (ev.type === 'click' || ev.type === 'value') {
      const p = ev.point ?? ctx.cursor;
      if (!this.c) {
        this.c = p;
        return { done: false, hint: 'ELLIPSE: Endpunkt der X-Achse wählen' };
      }
      if (!this.rxPoint) {
        this.rxPoint = p;
        return { done: false, hint: 'ELLIPSE: Abstand der Y-Achse wählen' };
      }
      const rx = Math.hypot(this.rxPoint.x - this.c.x, this.rxPoint.y - this.c.y);
      const rotation = Math.atan2(this.rxPoint.y - this.c.y, this.rxPoint.x - this.c.x);
      const dxp = p.x - this.c.x;
      const dyp = p.y - this.c.y;
      // Project p onto the axis perpendicular to the major axis to get ry.
      const px = dxp * Math.cos(rotation) + dyp * Math.sin(rotation);
      const py = -dxp * Math.sin(rotation) + dyp * Math.cos(rotation);
      void px;
      const ry = Math.abs(py);
      if (rx < 1e-6 || ry < 1e-6) return { done: false };
      const e: EllipseEntity = {
        id: uid('ell'),
        type: 'ellipse',
        layerId: ctx.activeLayerId,
        c: this.c,
        rx,
        ry,
        rotation,
      };
      this.c = null;
      this.rxPoint = null;
      return { commit: [e], done: true };
    }
    return { done: false };
  }

  preview(ctx: ToolContext) {
    if (!this.c) return [];
    if (!this.rxPoint) {
      const rx = Math.hypot(ctx.cursor.x - this.c.x, ctx.cursor.y - this.c.y);
      return [
        {
          id: 'preview',
          type: 'ellipse',
          layerId: ctx.activeLayerId,
          c: this.c,
          rx,
          ry: rx * 0.4,
          rotation: Math.atan2(ctx.cursor.y - this.c.y, ctx.cursor.x - this.c.x),
        } as EllipseEntity,
      ];
    }
    const rx = Math.hypot(this.rxPoint.x - this.c.x, this.rxPoint.y - this.c.y);
    const rotation = Math.atan2(this.rxPoint.y - this.c.y, this.rxPoint.x - this.c.x);
    const dxp = ctx.cursor.x - this.c.x;
    const dyp = ctx.cursor.y - this.c.y;
    const py = -dxp * Math.sin(rotation) + dyp * Math.cos(rotation);
    const ry = Math.abs(py);
    return [
      {
        id: 'preview',
        type: 'ellipse',
        layerId: ctx.activeLayerId,
        c: this.c,
        rx,
        ry,
        rotation,
      } as EllipseEntity,
    ];
  }

  expects() {
    return 'point' as const;
  }
}
