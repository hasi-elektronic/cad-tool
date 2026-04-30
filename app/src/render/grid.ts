import type { Viewport } from '../core/types';
import { screenToWorld, worldToScreen } from '../core/viewport';

// AutoCAD-style grid: minor + major lines, plus full-canvas red X-axis and
// green Y-axis lines that pass through the origin to communicate orientation
// without relying on a tiny corner glyph.
export function drawGrid(
  ctx: CanvasRenderingContext2D,
  v: Viewport,
  minorStep: number,
): void {
  const majorStep = minorStep * 5;
  const tl = screenToWorld(v, { x: 0, y: 0 });
  const br = screenToWorld(v, { x: v.width, y: v.height });
  const minX = Math.min(tl.x, br.x);
  const maxX = Math.max(tl.x, br.x);
  const minY = Math.min(tl.y, br.y);
  const maxY = Math.max(tl.y, br.y);

  const minorPx = minorStep * v.scale;

  if (minorPx >= 4) {
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255,255,255,0.035)';
    ctx.lineWidth = 1;
    const x0 = Math.ceil(minX / minorStep) * minorStep;
    for (let x = x0; x <= maxX; x += minorStep) {
      const s = worldToScreen(v, { x, y: 0 });
      ctx.moveTo(Math.round(s.x) + 0.5, 0);
      ctx.lineTo(Math.round(s.x) + 0.5, v.height);
    }
    const y0 = Math.ceil(minY / minorStep) * minorStep;
    for (let y = y0; y <= maxY; y += minorStep) {
      const s = worldToScreen(v, { x: 0, y });
      ctx.moveTo(0, Math.round(s.y) + 0.5);
      ctx.lineTo(v.width, Math.round(s.y) + 0.5);
    }
    ctx.stroke();
  }

  if (majorStep * v.scale >= 8) {
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255,255,255,0.085)';
    ctx.lineWidth = 1;
    const x0 = Math.ceil(minX / majorStep) * majorStep;
    for (let x = x0; x <= maxX; x += majorStep) {
      const s = worldToScreen(v, { x, y: 0 });
      ctx.moveTo(Math.round(s.x) + 0.5, 0);
      ctx.lineTo(Math.round(s.x) + 0.5, v.height);
    }
    const y0 = Math.ceil(minY / majorStep) * majorStep;
    for (let y = y0; y <= maxY; y += majorStep) {
      const s = worldToScreen(v, { x: 0, y });
      ctx.moveTo(0, Math.round(s.y) + 0.5);
      ctx.lineTo(v.width, Math.round(s.y) + 0.5);
    }
    ctx.stroke();
  }

  // Coloured world axes — X red horizontal, Y green vertical — both rendered
  // as full-canvas dim lines so the user always knows which way is up.
  const origin = worldToScreen(v, { x: 0, y: 0 });
  const ox = Math.round(origin.x) + 0.5;
  const oy = Math.round(origin.y) + 0.5;
  if (oy >= 0 && oy <= v.height) {
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255,90,90,0.45)';
    ctx.lineWidth = 1;
    ctx.moveTo(0, oy);
    ctx.lineTo(v.width, oy);
    ctx.stroke();
  }
  if (ox >= 0 && ox <= v.width) {
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(90,210,110,0.45)';
    ctx.lineWidth = 1;
    ctx.moveTo(ox, 0);
    ctx.lineTo(ox, v.height);
    ctx.stroke();
  }
}
