import { uid } from '../core/id';
import { store } from '../state/store';
import type { DimensionEntity, DimensionKind, Entity, Point } from '../core/types';
import type { Tool, ToolContext, ToolEvent, ToolResult } from './types';

const DIM_LAYER = 'L_dimensions';
function pickDimLayer(activeLayerId: string): string {
  const layers = store.get().doc.layers;
  return layers.find((l) => l.id === DIM_LAYER) ? DIM_LAYER : activeLayerId;
}

// Linear dimension: aligned (parallel to a→b), horizontal, or vertical.
// All three share the pick flow: first point → second point → offset side.
export class LinearDimensionTool implements Tool {
  id: string;
  hint: string;
  private a: Point | null = null;
  private b: Point | null = null;
  private kind: 'aligned' | 'horizontal' | 'vertical';

  constructor(kind: 'aligned' | 'horizontal' | 'vertical') {
    this.kind = kind;
    this.id = kind === 'aligned' ? 'dimension' : `dim_${kind}`;
    this.hint = `${this.label()}: pick first point`;
  }

  private label(): string {
    return this.kind === 'aligned' ? 'DIM' : this.kind === 'horizontal' ? 'DIM-H' : 'DIM-V';
  }

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
        return { done: false, hint: `${this.label()}: pick second point` };
      }
      if (!this.b) {
        if (Math.hypot(p.x - this.a.x, p.y - this.a.y) < 1e-6) return { done: false };
        this.b = p;
        return { done: false, hint: `${this.label()}: pick dimension line offset` };
      }
      const dim: DimensionEntity = {
        id: uid('dim'),
        type: 'dimension',
        kind: this.kind,
        layerId: pickDimLayer(ctx.activeLayerId),
        a: this.a,
        b: this.b,
        offset: linearOffset(this.kind, this.a, this.b, p),
      };
      this.a = null;
      this.b = null;
      return { commit: [dim], done: true };
    }
    return { done: false };
  }

  preview(ctx: ToolContext): Entity[] {
    if (!this.a) return [];
    if (!this.b) {
      return [
        {
          id: 'preview',
          type: 'dimension',
          kind: this.kind,
          layerId: DIM_LAYER,
          a: this.a,
          b: ctx.cursor,
          offset: 0,
        } as DimensionEntity,
      ];
    }
    return [
      {
        id: 'preview',
        type: 'dimension',
        kind: this.kind,
        layerId: DIM_LAYER,
        a: this.a,
        b: this.b,
        offset: linearOffset(this.kind, this.a, this.b, ctx.cursor),
      } as DimensionEntity,
    ];
  }

  expects() {
    return 'point' as const;
  }
}

function linearOffset(
  kind: 'aligned' | 'horizontal' | 'vertical',
  a: Point,
  b: Point,
  p: Point,
): number {
  if (kind === 'horizontal') {
    // Dimension line is horizontal at y = p.y; offset is signed Y distance
    // from the midpoint of a/b (we store relative to midpoint Y average).
    return p.y - (a.y + b.y) / 2;
  }
  if (kind === 'vertical') {
    return p.x - (a.x + b.x) / 2;
  }
  // Aligned — perpendicular to a→b.
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L;
  const ny = dx / L;
  return (p.x - a.x) * nx + (p.y - a.y) * ny;
}

// Radius / Diameter dimension: pick a circle/arc, then the leader end point.
export class RadialDimensionTool implements Tool {
  id: string;
  hint: string;
  private kind: 'radius' | 'diameter';
  private target: { c: Point; r: number; entityId: string } | null = null;

  constructor(kind: 'radius' | 'diameter') {
    this.kind = kind;
    this.id = kind === 'radius' ? 'dim_radius' : 'dim_diameter';
    this.hint = `${kind === 'radius' ? 'RAD' : 'DIA'}: pick a circle or arc`;
  }

  step(ev: ToolEvent, ctx: ToolContext): ToolResult {
    if (ev.type === 'cancel') {
      this.target = null;
      return { done: true };
    }
    if (ev.type === 'click' || ev.type === 'value') {
      if (!this.target) {
        const hit = pickCircleArc(ev.point ?? ctx.cursor);
        if (!hit) return { done: false };
        this.target = hit;
        return {
          done: false,
          hint: `${this.kind === 'radius' ? 'RAD' : 'DIA'}: pick leader end point`,
        };
      }
      const lead = ev.point ?? ctx.cursor;
      const dim: DimensionEntity = {
        id: uid('dim'),
        type: 'dimension',
        kind: this.kind,
        layerId: pickDimLayer(ctx.activeLayerId),
        a: this.target.c,
        b: lead,
        offset: this.target.r,
      };
      this.target = null;
      return { commit: [dim], done: true };
    }
    return { done: false };
  }

  preview(ctx: ToolContext): Entity[] {
    if (!this.target) return [];
    return [
      {
        id: 'preview',
        type: 'dimension',
        kind: this.kind,
        layerId: DIM_LAYER,
        a: this.target.c,
        b: ctx.cursor,
        offset: this.target.r,
      } as DimensionEntity,
    ];
  }

  expects() {
    return 'point' as const;
  }
}

function pickCircleArc(p: Point): { c: Point; r: number; entityId: string } | null {
  const ents = store.get().doc.entities;
  let best: { c: Point; r: number; entityId: string; d: number } | null = null;
  for (const e of ents) {
    if (e.type !== 'circle' && e.type !== 'arc') continue;
    const d = Math.abs(Math.hypot(p.x - e.c.x, p.y - e.c.y) - e.r);
    if (d < (best?.d ?? Infinity) && d < 5) {
      best = { c: e.c, r: e.r, entityId: e.id, d };
    }
  }
  return best
    ? { c: best.c, r: best.r, entityId: best.entityId }
    : null;
}

// Angular dimension: pick two lines (sharing or near a common point), then
// pick a point on the arc to set its radius.
export class AngularDimensionTool implements Tool {
  id = 'dim_angular';
  hint = 'ANG: pick first line';
  private firstLine: { id: string; a: Point; b: Point } | null = null;
  private secondLine: { id: string; a: Point; b: Point } | null = null;

  step(ev: ToolEvent, ctx: ToolContext): ToolResult {
    if (ev.type === 'cancel') {
      this.firstLine = null;
      this.secondLine = null;
      return { done: true };
    }
    if (ev.type === 'click' || ev.type === 'value') {
      if (!this.firstLine) {
        const ln = pickLine(ev.point ?? ctx.cursor);
        if (!ln) return { done: false };
        this.firstLine = ln;
        return { done: false, hint: 'ANG: pick second line' };
      }
      if (!this.secondLine) {
        const ln = pickLine(ev.point ?? ctx.cursor);
        if (!ln || ln.id === this.firstLine.id) return { done: false };
        this.secondLine = ln;
        return { done: false, hint: 'ANG: pick arc radius' };
      }
      const ang = buildAngularEntity(this.firstLine, this.secondLine, ev.point ?? ctx.cursor);
      this.firstLine = null;
      this.secondLine = null;
      if (!ang) return { done: true };
      ang.layerId = pickDimLayer(ctx.activeLayerId);
      ang.id = uid('dim');
      return { commit: [ang], done: true };
    }
    return { done: false };
  }

  preview(ctx: ToolContext): Entity[] {
    if (!this.firstLine || !this.secondLine) return [];
    const ang = buildAngularEntity(this.firstLine, this.secondLine, ctx.cursor);
    if (!ang) return [];
    return [ang];
  }

  expects() {
    return 'point' as const;
  }
}

function pickLine(p: Point): { id: string; a: Point; b: Point } | null {
  const ents = store.get().doc.entities;
  let best: { id: string; a: Point; b: Point; d: number } | null = null;
  for (const e of ents) {
    if (e.type !== 'line') continue;
    const d = pointToSegmentDistance(p, e.a, e.b);
    if (d < (best?.d ?? Infinity) && d < 5) {
      best = { id: e.id, a: e.a, b: e.b, d };
    }
  }
  return best ? { id: best.id, a: best.a, b: best.b } : null;
}

function pointToSegmentDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const L2 = dx * dx + dy * dy;
  if (L2 < 1e-9) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function buildAngularEntity(
  l1: { a: Point; b: Point },
  l2: { a: Point; b: Point },
  arcPt: Point,
): DimensionEntity | null {
  const v = lineIntersection(l1.a, l1.b, l2.a, l2.b);
  if (!v) return null;
  // For each line, pick the endpoint farther from the vertex as the arm end.
  const arm1 = farthest(v, l1.a, l1.b);
  const arm2 = farthest(v, l2.a, l2.b);
  const radius = Math.hypot(arcPt.x - v.x, arcPt.y - v.y);
  return {
    id: 'preview',
    type: 'dimension',
    kind: 'angular',
    layerId: DIM_LAYER,
    a: arm1,
    b: arm2,
    c: v,
    offset: radius,
  };
}

function lineIntersection(a1: Point, a2: Point, b1: Point, b2: Point): Point | null {
  const d = (a2.x - a1.x) * (b2.y - b1.y) - (a2.y - a1.y) * (b2.x - b1.x);
  if (Math.abs(d) < 1e-9) return null;
  const t = ((b1.x - a1.x) * (b2.y - b1.y) - (b1.y - a1.y) * (b2.x - b1.x)) / d;
  return { x: a1.x + t * (a2.x - a1.x), y: a1.y + t * (a2.y - a1.y) };
}

function farthest(v: Point, a: Point, b: Point): Point {
  return Math.hypot(a.x - v.x, a.y - v.y) > Math.hypot(b.x - v.x, b.y - v.y) ? a : b;
}

// Backwards-compat default export retained for callers that imported the
// original DimensionTool name.
export class DimensionTool extends LinearDimensionTool {
  constructor() {
    super('aligned');
  }
}
export type DimensionToolKind = DimensionKind;
