import type { Point, Viewport } from './types';

// World → screen. World Y is up; screen Y is down, so flip the sign.
export function worldToScreen(v: Viewport, p: Point): Point {
  return {
    x: v.width / 2 + (p.x - v.cx) * v.scale,
    y: v.height / 2 - (p.y - v.cy) * v.scale,
  };
}

// Screen → world.
export function screenToWorld(v: Viewport, p: Point): Point {
  return {
    x: v.cx + (p.x - v.width / 2) / v.scale,
    y: v.cy - (p.y - v.height / 2) / v.scale,
  };
}

export function zoomAtScreen(v: Viewport, screen: Point, factor: number): Viewport {
  const before = screenToWorld(v, screen);
  const newScale = Math.max(0.01, Math.min(2000, v.scale * factor));
  const next: Viewport = { ...v, scale: newScale };
  const after = screenToWorld(next, screen);
  return { ...next, cx: next.cx + (before.x - after.x), cy: next.cy + (before.y - after.y) };
}

export function panByScreen(v: Viewport, dxPx: number, dyPx: number): Viewport {
  return {
    ...v,
    cx: v.cx - dxPx / v.scale,
    cy: v.cy + dyPx / v.scale,
  };
}
