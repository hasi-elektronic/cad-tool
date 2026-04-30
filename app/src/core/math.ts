import type { Point } from './types';

export const TAU = Math.PI * 2;

export const pt = (x: number, y: number): Point => ({ x, y });

export const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
export const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });
export const scale = (a: Point, k: number): Point => ({ x: a.x * k, y: a.y * k });
export const dot = (a: Point, b: Point): number => a.x * b.x + a.y * b.y;
export const cross = (a: Point, b: Point): number => a.x * b.y - a.y * b.x;
export const length = (a: Point): number => Math.hypot(a.x, a.y);
export const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);
export const angle = (a: Point, b: Point): number => Math.atan2(b.y - a.y, b.x - a.x);
export const lerp = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

export function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function normalize(v: Point): Point {
  const l = length(v);
  return l < 1e-9 ? { x: 0, y: 0 } : { x: v.x / l, y: v.y / l };
}

export function rotate(p: Point, angleRad: number, around: Point = { x: 0, y: 0 }): Point {
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);
  const dx = p.x - around.x;
  const dy = p.y - around.y;
  return { x: around.x + dx * c - dy * s, y: around.y + dx * s + dy * c };
}

// Distance from point p to a line segment (a,b).
export function distToSegment(p: Point, a: Point, b: Point): number {
  const ab = sub(b, a);
  const ap = sub(p, a);
  const t = Math.max(0, Math.min(1, dot(ap, ab) / Math.max(dot(ab, ab), 1e-12)));
  const proj = add(a, scale(ab, t));
  return distance(p, proj);
}

export function closestPointOnSegment(p: Point, a: Point, b: Point): { point: Point; t: number } {
  const ab = sub(b, a);
  const ap = sub(p, a);
  const t = Math.max(0, Math.min(1, dot(ap, ab) / Math.max(dot(ab, ab), 1e-12)));
  return { point: add(a, scale(ab, t)), t };
}

// Returns intersection point of two infinite lines, or null if parallel.
export function lineLineIntersection(
  a1: Point,
  a2: Point,
  b1: Point,
  b2: Point,
): Point | null {
  const d1 = sub(a2, a1);
  const d2 = sub(b2, b1);
  const denom = cross(d1, d2);
  if (Math.abs(denom) < 1e-9) return null;
  const t = cross(sub(b1, a1), d2) / denom;
  return add(a1, scale(d1, t));
}

// Intersection points of two segments (returns up to 1 point), or null.
export function segmentIntersection(a1: Point, a2: Point, b1: Point, b2: Point): Point | null {
  const d1 = sub(a2, a1);
  const d2 = sub(b2, b1);
  const denom = cross(d1, d2);
  if (Math.abs(denom) < 1e-9) return null;
  const ab = sub(b1, a1);
  const t = cross(ab, d2) / denom;
  const u = cross(ab, d1) / denom;
  if (t < -1e-6 || t > 1 + 1e-6 || u < -1e-6 || u > 1 + 1e-6) return null;
  return add(a1, scale(d1, t));
}

// Intersections between a segment and a circle.
export function segmentCircleIntersections(
  a: Point,
  b: Point,
  c: Point,
  r: number,
): Point[] {
  const d = sub(b, a);
  const f = sub(a, c);
  const A = dot(d, d);
  const B = 2 * dot(f, d);
  const C = dot(f, f) - r * r;
  const disc = B * B - 4 * A * C;
  if (disc < 0) return [];
  const s = Math.sqrt(disc);
  const t1 = (-B - s) / (2 * A);
  const t2 = (-B + s) / (2 * A);
  const out: Point[] = [];
  if (t1 >= -1e-6 && t1 <= 1 + 1e-6) out.push(add(a, scale(d, t1)));
  if (Math.abs(t1 - t2) > 1e-6 && t2 >= -1e-6 && t2 <= 1 + 1e-6) out.push(add(a, scale(d, t2)));
  return out;
}

// Intersections of two circles.
export function circleCircleIntersections(
  c1: Point,
  r1: number,
  c2: Point,
  r2: number,
): Point[] {
  const d = distance(c1, c2);
  if (d > r1 + r2 || d < Math.abs(r1 - r2) || d < 1e-9) return [];
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h2 = r1 * r1 - a * a;
  if (h2 < 0) return [];
  const h = Math.sqrt(h2);
  const px = c1.x + (a * (c2.x - c1.x)) / d;
  const py = c1.y + (a * (c2.y - c1.y)) / d;
  const rx = -(c2.y - c1.y) * (h / d);
  const ry = (c2.x - c1.x) * (h / d);
  if (h < 1e-9) return [{ x: px, y: py }];
  return [{ x: px + rx, y: py + ry }, { x: px - rx, y: py - ry }];
}

// Normalise an angle to [0, 2π).
export function normalizeAngle(a: number): number {
  let r = a % TAU;
  if (r < 0) r += TAU;
  return r;
}

// Is angle a within the CCW arc from start to end?
export function angleInArc(a: number, start: number, end: number): boolean {
  const na = normalizeAngle(a);
  const ns = normalizeAngle(start);
  const ne = normalizeAngle(end);
  if (ns <= ne) return na >= ns - 1e-9 && na <= ne + 1e-9;
  return na >= ns - 1e-9 || na <= ne + 1e-9;
}

export function formatNumber(n: number, digits = 2): string {
  if (!isFinite(n)) return '0';
  return n.toFixed(digits).replace(/\.?0+$/, '') || '0';
}
