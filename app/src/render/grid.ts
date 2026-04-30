import type { Viewport } from '../core/types';
import { screenToWorld, worldToScreen } from '../core/viewport';

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

  // Skip drawing if the grid would be too dense to be useful.
  const minorPx = minorStep * v.scale;

  if (minorPx >= 4) {
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
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

  // Major grid
  if (majorStep * v.scale >= 8) {
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
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

  // Origin cross
  const origin = worldToScreen(v, { x: 0, y: 0 });
  ctx.strokeStyle = 'rgba(229, 75, 75, 0.85)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(origin.x - 12, origin.y);
  ctx.lineTo(origin.x + 12, origin.y);
  ctx.moveTo(origin.x, origin.y - 12);
  ctx.lineTo(origin.x, origin.y + 12);
  ctx.stroke();
}
