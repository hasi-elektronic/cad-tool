import type { SnapResult, Viewport } from '../core/types';
import { worldToScreen } from '../core/viewport';

export function drawSnapMarker(
  ctx: CanvasRenderingContext2D,
  v: Viewport,
  snap: SnapResult,
): void {
  const p = worldToScreen(v, snap.point);
  ctx.save();
  ctx.strokeStyle = '#ffd166';
  ctx.fillStyle = 'rgba(255, 209, 102, 0.18)';
  ctx.lineWidth = 1.5;
  switch (snap.type) {
    case 'endpoint':
    case 'quadrant':
      ctx.beginPath();
      ctx.rect(p.x - 6, p.y - 6, 12, 12);
      ctx.fill();
      ctx.stroke();
      break;
    case 'midpoint':
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 7);
      ctx.lineTo(p.x + 7, p.y + 6);
      ctx.lineTo(p.x - 7, p.y + 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    case 'center':
      ctx.beginPath();
      ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
    case 'intersection':
      ctx.beginPath();
      ctx.moveTo(p.x - 6, p.y - 6);
      ctx.lineTo(p.x + 6, p.y + 6);
      ctx.moveTo(p.x - 6, p.y + 6);
      ctx.lineTo(p.x + 6, p.y - 6);
      ctx.stroke();
      break;
    case 'grid':
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#ffd166';
      ctx.fill();
      break;
  }
  ctx.restore();
}
