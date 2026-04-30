import type { SnapResult, Viewport } from '../core/types';
import { worldToScreen } from '../core/viewport';

const SNAP_LABEL_DE: Record<SnapResult['type'], string> = {
  endpoint: 'Endpunkt',
  midpoint: 'Mittelpunkt',
  center: 'Zentrum',
  intersection: 'Schnittpunkt',
  grid: 'Raster',
  quadrant: 'Quadrant',
};

export function drawSnapMarker(
  ctx: CanvasRenderingContext2D,
  v: Viewport,
  snap: SnapResult,
): void {
  const p = worldToScreen(v, snap.point);
  ctx.save();
  // AutoCAD's snap markers sit on a slightly stronger fill so they remain
  // legible over both light and dark areas of the drawing.
  ctx.strokeStyle = '#ffd166';
  ctx.fillStyle = 'rgba(255, 209, 102, 0.22)';
  ctx.lineWidth = 1.6;
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

  // Label tooltip: charcoal pill with yellow border so the snap kind is
  // discoverable at a glance, the way AutoCAD calls them out on hover.
  if (snap.type !== 'grid') {
    const label = SNAP_LABEL_DE[snap.type];
    ctx.font = "11px 'JetBrains Mono', monospace";
    const m = ctx.measureText(label);
    const pad = 5;
    const w = m.width + pad * 2;
    const h = 17;
    const lx = p.x + 12;
    const ly = p.y + 12;
    ctx.fillStyle = 'rgba(20,20,20,0.92)';
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.rect(lx, ly, w, h);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffd166';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, lx + pad, ly + h / 2 + 1);
  }
  ctx.restore();
}
