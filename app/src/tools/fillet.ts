import type { ArcEntity, Entity, LineEntity, Point } from '../core/types';
import type { Tool, ToolContext, ToolEvent, ToolResult } from './types';
import { distanceToEntity } from '../core/hit';
import { distance, lineLineIntersection } from '../core/math';
import { uid } from '../core/id';

interface FilletOpts {
  getAll: () => Entity[];
}

// Fillet two intersecting lines with a circular arc of the given radius.
// User: type R (radius), then click first line, then second line.
export class FilletTool implements Tool {
  id = 'fillet';
  hint = 'ABRUNDEN: Radius eingeben, dann erste Linie wählen';
  private radius: number | null = null;
  private first: LineEntity | null = null;
  private opts: FilletOpts;

  constructor(opts: FilletOpts) {
    this.opts = opts;
  }

  step(ev: ToolEvent, ctx: ToolContext): ToolResult {
    if (ev.type === 'cancel') return { done: true };
    if (ev.type === 'value') {
      const r = parseFloat(ev.value || '');
      if (isFinite(r) && r > 0) {
        this.radius = r;
        return { done: false, hint: `ABRUNDEN (R=${r}): erste Linie wählen` };
      }
      return { done: false };
    }
    if (ev.type === 'click') {
      if (this.radius == null) return { done: false, hint: 'ABRUNDEN: zuerst positiven Radius eingeben' };
      const click = ev.point ?? ctx.cursor;
      const line = this.findLineNear(click, ctx);
      if (!line) return { done: false };
      if (!this.first) {
        this.first = line;
        return { done: false, hint: `ABRUNDEN (R=${this.radius}): zweite Linie wählen` };
      }
      if (line.id === this.first.id) return { done: false };
      const result = computeFillet(this.first, line, this.radius);
      this.radius = null;
      const firstId = this.first.id;
      this.first = null;
      if (!result) return { done: true };
      return { commit: result.commit, remove: [firstId, line.id, ...result.removeOther], done: true };
    }
    return { done: false };
  }

  private findLineNear(p: Point, ctx: ToolContext): LineEntity | null {
    const all = this.opts.getAll();
    let best: LineEntity | null = null;
    let bestDist = 5 / ctx.viewport.scale;
    for (const e of all) {
      if (e.type !== 'line') continue;
      const d = distanceToEntity(e, p);
      if (d < bestDist) {
        bestDist = d;
        best = e;
      }
    }
    return best;
  }

  preview(_ctx: ToolContext) {
    return [];
  }
}

function computeFillet(
  l1: LineEntity,
  l2: LineEntity,
  r: number,
): { commit: Entity[]; removeOther: string[] } | null {
  const ip = lineLineIntersection(l1.a, l1.b, l2.a, l2.b);
  if (!ip) return null;

  // Direction from intersection along each line, choosing the endpoint farthest
  // from the intersection so the fillet is drawn on the outer side.
  const u1 = unitFromIntersection(ip, l1);
  const u2 = unitFromIntersection(ip, l2);
  if (!u1 || !u2) return null;

  // Half-angle between the two outgoing lines.
  const dot = u1.x * u2.x + u1.y * u2.y;
  const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
  if (angle < 1e-3 || angle > Math.PI - 1e-3) return null;
  const tangentDist = r / Math.tan(angle / 2);
  // Tangent points on the two lines.
  const t1 = { x: ip.x + u1.x * tangentDist, y: ip.y + u1.y * tangentDist };
  const t2 = { x: ip.x + u2.x * tangentDist, y: ip.y + u2.y * tangentDist };
  // Centre of the arc lies on the bisector between u1 and u2, at distance r/sin(angle/2).
  const bisX = u1.x + u2.x;
  const bisY = u1.y + u2.y;
  const bL = Math.hypot(bisX, bisY) || 1;
  const cDist = r / Math.sin(angle / 2);
  const c: Point = { x: ip.x + (bisX / bL) * cDist, y: ip.y + (bisY / bL) * cDist };
  // Build the arc from t1 to t2 going CCW; direction depends on orientation.
  const startAngle = Math.atan2(t1.y - c.y, t1.x - c.x);
  const endAngle = Math.atan2(t2.y - c.y, t2.x - c.x);
  const arc: ArcEntity = {
    id: uid('fl'),
    type: 'arc',
    layerId: l1.layerId,
    c,
    r,
    startAngle,
    endAngle,
  };

  // Trim each line: keep the segment between its far endpoint (away from ip) and the tangent point.
  const farEnd1 = distance(l1.a, ip) > distance(l1.b, ip) ? l1.a : l1.b;
  const farEnd2 = distance(l2.a, ip) > distance(l2.b, ip) ? l2.a : l2.b;
  const trimmed1: LineEntity = { ...l1, id: uid('fl'), a: farEnd1, b: t1 };
  const trimmed2: LineEntity = { ...l2, id: uid('fl'), a: farEnd2, b: t2 };

  return { commit: [trimmed1, trimmed2, arc], removeOther: [] };
}

function unitFromIntersection(ip: Point, line: LineEntity): Point | null {
  const farEnd = distance(line.a, ip) > distance(line.b, ip) ? line.a : line.b;
  const dx = farEnd.x - ip.x;
  const dy = farEnd.y - ip.y;
  const L = Math.hypot(dx, dy);
  if (L < 1e-6) return null;
  return { x: dx / L, y: dy / L };
}
