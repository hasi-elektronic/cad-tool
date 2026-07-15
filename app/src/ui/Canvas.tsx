import React, { useEffect, useRef } from 'react';
import { store, useStore } from '../state/useStore';
import type { Entity, Point, SnapResult, Viewport } from '../core/types';
import {
  panByScreen,
  screenToWorld,
  worldToScreen,
  zoomAtScreen,
} from '../core/viewport';
import { drawGrid } from '../render/grid';
import { drawEntities } from '../render/entities';
import { drawSnapMarker } from '../render/snap';
import { findSnap } from '../core/snap';
import { distanceToEntity } from '../core/hit';
import { entityBox, isEmpty, unionBox } from '../core/bbox';
import { createTool, type ToolFactoryCtx } from '../tools/registry';
import type { Tool } from '../tools/types';
import { distance, formatNumber } from '../core/math';
import { gripsOf, moveGrip, type Grip } from '../core/grips';

interface CanvasHandle {
  setStatus: (s: { x: number; y: number; snap: SnapResult | null }) => void;
  setHint: (h: string) => void;
}

interface CanvasProps {
  registerCommand: (api: CommandAPI) => void;
  onStatus: (s: { x: number; y: number; snap: SnapResult | null }) => void;
  onHint: (h: string) => void;
  onZoom: (z: number) => void;
}

export interface CommandAPI {
  // Submit a value (point, distance or raw text) from the command line.
  submitValue: (val: string) => void;
  // Cancel current op (ESC).
  cancel: () => void;
  // Commit current op (ENTER).
  commit: () => void;
  // Zoom-fit on all entities.
  zoomFit: () => void;
  // The tool currently expects this kind of input.
  expects: () => 'point' | 'distance' | 'text' | 'none';
  // The current per-tool hint.
  hint: () => string;
}

export const Canvas: React.FC<CanvasProps> = ({ registerCommand, onStatus, onHint, onZoom }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Mutable refs for transient state (not React-tracked) to avoid re-renders per frame.
  const viewportRef = useRef<Viewport>({ cx: 0, cy: 0, scale: 4, width: 800, height: 600 });
  const cursorScreenRef = useRef<Point>({ x: 0, y: 0 });
  const cursorWorldRef = useRef<Point>({ x: 0, y: 0 });
  const snapRef = useRef<SnapResult | null>(null);
  const isPanningRef = useRef(false);
  const panOriginRef = useRef<Point>({ x: 0, y: 0 });
  const lastMouseRef = useRef<Point>({ x: 0, y: 0 });
  const toolRef = useRef<Tool | null>(null);
  const previewRef = useRef<Entity[]>([]);
  const hintRef = useRef<string>('');
  const lastCommittedPointRef = useRef<Point | null>(null);
  const dragSelectRef = useRef<{ start: Point } | null>(null);
  // Object-snap tracking: recently acquired snap points that spawn
  // horizontal/vertical alignment guides (AutoCAD "Spurverfolgung").
  const acquiredRef = useRef<Point[]>([]);
  const trackGuidesRef = useRef<{ src: Point; axis: 'x' | 'y' }[]>([]);
  // Grip editing (select tool): the grip currently being dragged.
  const gripDragRef = useRef<{ entityId: string; grip: Grip } | null>(null);

  // We only subscribe to the active tool to drive the tool-recreation effect.
  // Other UI flags (ortho/snap/grid/gridMinor) are read directly from the store
  // inside render/event handlers to avoid stale closures across React renders.
  const tool = useStore((s) => s.ui.tool);

  // Recreate the active tool when the user switches.
  useEffect(() => {
    const factoryCtx: ToolFactoryCtx = {
      getEntity: (id) => store.get().doc.entities.find((e) => e.id === id),
      getAll: () => store.get().doc.entities,
      selectedIds: () => store.get().ui.selectedIds,
    };
    toolRef.current = createTool(tool, factoryCtx);
    hintRef.current = toolRef.current.hint;
    onHint(hintRef.current);
    previewRef.current = [];
    lastCommittedPointRef.current = null;
    acquiredRef.current = [];
    trackGuidesRef.current = [];
    gripDragRef.current = null;
    requestRender();
  }, [tool, onHint]);

  // Re-render on store changes.
  useEffect(() => store.subscribe(() => requestRender()), []);

  // Resize observer.
  useEffect(() => {
    const onResize = () => {
      const c = canvasRef.current;
      const ct = containerRef.current;
      if (!c || !ct) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = ct.getBoundingClientRect();
      c.width = Math.round(rect.width * dpr);
      c.height = Math.round(rect.height * dpr);
      c.style.width = `${rect.width}px`;
      c.style.height = `${rect.height}px`;
      const ctx = c.getContext('2d')!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      viewportRef.current.width = rect.width;
      viewportRef.current.height = rect.height;
      requestRender();
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const renderQueuedRef = useRef(false);
  function requestRender() {
    if (renderQueuedRef.current) return;
    renderQueuedRef.current = true;
    requestAnimationFrame(() => {
      renderQueuedRef.current = false;
      render();
    });
  }

  function render() {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    const v = viewportRef.current;
    const ui = store.get().ui;
    ctx.clearRect(0, 0, v.width, v.height);
    if (ui.showGrid) drawGrid(ctx, v, ui.gridMinor);

    const { entities, layers } = store.get().doc;
    const sel = new Set(store.get().ui.selectedIds);
    drawEntities(ctx, v, entities, layers, sel);

    // Draw tool preview entities (with a subtle dashed style for clarity).
    if (previewRef.current.length) {
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.globalAlpha = 0.85;
      drawEntities(ctx, v, previewRef.current, layers, new Set());
      ctx.restore();
    }

    // Drag-select rubber band.
    if (dragSelectRef.current) {
      const a = dragSelectRef.current.start;
      const b = cursorScreenRef.current;
      const x1 = Math.min(a.x, b.x);
      const y1 = Math.min(a.y, b.y);
      const w = Math.abs(b.x - a.x);
      const h = Math.abs(b.y - a.y);
      ctx.save();
      ctx.fillStyle = 'rgba(51, 175, 226, 0.10)';
      ctx.strokeStyle = '#33afe2';
      ctx.setLineDash([4, 3]);
      ctx.fillRect(x1, y1, w, h);
      ctx.strokeRect(x1, y1, w, h);
      ctx.restore();
    }

    if (snapRef.current) drawSnapMarker(ctx, v, snapRef.current);

    // "Magnet" snap visualisation: when snap is active, the visible crosshair
    // jumps to the snapped (or ortho-constrained) position so the cursor
    // physically locks to the geometry instead of just reporting it on click.
    const eff = effectiveCursor();
    const tracking = trackGuidesRef.current.length > 0;
    const visualScreen = snapRef.current || hasOrthoLock() || tracking
      ? worldToScreen(v, eff)
      : cursorScreenRef.current;

    // Tracking guides: dashed alignment rays from acquired points.
    if (tracking) {
      ctx.save();
      ctx.strokeStyle = 'rgba(91, 214, 106, 0.65)';
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 1;
      for (const g of trackGuidesRef.current) {
        const s = worldToScreen(v, g.src);
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(visualScreen.x, visualScreen.y);
        ctx.stroke();
        // Small cross at the source point.
        ctx.beginPath();
        ctx.moveTo(s.x - 4, s.y);
        ctx.lineTo(s.x + 4, s.y);
        ctx.moveTo(s.x, s.y - 4);
        ctx.lineTo(s.x, s.y + 4);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Grips (select tool): blue squares on every selected entity.
    if (store.get().ui.tool === 'select' && sel.size) {
      ctx.save();
      for (const e of entities) {
        if (!sel.has(e.id)) continue;
        for (const g of gripsOf(e)) {
          const gs = worldToScreen(v, g.point);
          const active =
            gripDragRef.current &&
            gripDragRef.current.entityId === e.id &&
            gripDragRef.current.grip.index === g.index;
          ctx.fillStyle = active ? '#ff5b5b' : '#33afe2';
          ctx.strokeStyle = '#0e1420';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.rect(gs.x - 4, gs.y - 4, 8, 8);
          ctx.fill();
          ctx.stroke();
        }
      }
      ctx.restore();
    }
    const locked = !!snapRef.current;
    drawCrosshair(ctx, visualScreen, v.width, v.height, locked);
    if (locked) drawMagnetLink(ctx, cursorScreenRef.current, visualScreen);

    // UCS icon (X/Y axes) in the bottom-left corner.
    drawUCS(ctx, v);

    // Live distance/angle readout uses the effective (snapped/ortho) point so
    // the readout matches what the click will actually commit.
    if (lastCommittedPointRef.current) {
      const from = lastCommittedPointRef.current;
      const to = eff;
      const d = distance(from, to);
      const ang = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
      ctx.save();
      ctx.font = "11px 'JetBrains Mono', monospace";
      const txt = `Δ ${formatNumber(d, 2)} mm   ∠ ${formatNumber(ang, 1)}°`;
      const m = ctx.measureText(txt);
      const w = m.width + 14;
      const h = 20;
      const x = visualScreen.x + 16;
      const y = visualScreen.y - h - 16;
      ctx.fillStyle = 'rgba(20,20,20,0.92)';
      ctx.strokeStyle = '#33afe2';
      ctx.lineWidth = 1;
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = '#e8eef7';
      ctx.textBaseline = 'middle';
      ctx.fillText(txt, x + 7, y + h / 2);
      ctx.restore();
    }

    onZoom(v.scale);
  }

  function hasOrthoLock(): boolean {
    return store.get().ui.ortho && lastCommittedPointRef.current !== null;
  }

  // Apply ortho constraint relative to the tool's "from" point if any.
  function applyOrtho(p: Point): Point {
    if (!store.get().ui.ortho) return p;
    const from = lastCommittedPointRef.current;
    if (!from) return p;
    const dx = p.x - from.x;
    const dy = p.y - from.y;
    return Math.abs(dx) > Math.abs(dy)
      ? { x: from.x + dx, y: from.y }
      : { x: from.x, y: from.y + dy };
  }

  function recomputeSnap(excludeId?: string) {
    const v = viewportRef.current;
    const world = screenToWorld(v, cursorScreenRef.current);
    cursorWorldRef.current = world;
    const ui = store.get().ui;
    if (ui.snap) {
      const ents = excludeId
        ? store.get().doc.entities.filter((e) => e.id !== excludeId)
        : store.get().doc.entities;
      const s = findSnap(world, ents, v, {
        enabled: true,
        gridStep: ui.gridMinor,
        // Generous magnet radius so the cursor reliably "sticks" to nearby
        // geometry without the user having to hover pixel-perfectly.
        pickRadiusPx: 16,
        from: lastCommittedPointRef.current,
        types: ui.snapTypes,
      });
      snapRef.current = s;
      // Acquire tracking sources from strong snaps (not grid/nearest noise).
      if (s && s.type !== 'grid' && s.type !== 'nearest') {
        const acq = acquiredRef.current;
        if (!acq.some((p) => distance(p, s.point) < 1e-6)) {
          acq.unshift({ ...s.point });
          if (acq.length > 3) acq.pop();
        }
      }
    } else {
      snapRef.current = null;
    }
    onStatus({ x: world.x, y: world.y, snap: snapRef.current });
  }

  function effectiveCursor(): Point {
    const raw = snapRef.current?.point ?? cursorWorldRef.current;
    // A direct object snap always wins; ortho constrains relative to the
    // tool's base point; tracking guides only kick in when neither applies.
    if (snapRef.current || hasOrthoLock()) {
      trackGuidesRef.current = [];
      return applyOrtho(raw);
    }
    if (!store.get().ui.snap) {
      trackGuidesRef.current = [];
      return raw;
    }
    const tol = 8 / viewportRef.current.scale;
    const sources: Point[] = [];
    if (lastCommittedPointRef.current) sources.push(lastCommittedPointRef.current);
    sources.push(...acquiredRef.current);
    const p = { ...raw };
    const guides: { src: Point; axis: 'x' | 'y' }[] = [];
    for (const src of sources) {
      if (Math.abs(p.x - src.x) < tol) {
        p.x = src.x;
        guides.push({ src, axis: 'x' });
        break;
      }
    }
    for (const src of sources) {
      if (Math.abs(p.y - src.y) < tol) {
        p.y = src.y;
        guides.push({ src, axis: 'y' });
        break;
      }
    }
    trackGuidesRef.current = guides;
    return p;
  }

  function buildToolContext() {
    return {
      cursor: effectiveCursor(),
      rawCursor: cursorWorldRef.current,
      viewport: viewportRef.current,
      activeLayerId: store.get().doc.activeLayerId,
    };
  }

  function refreshPreview() {
    if (!toolRef.current) return;
    previewRef.current = toolRef.current.preview(buildToolContext());
    requestRender();
  }

  function applyResult(r: ReturnType<Tool['step']>) {
    // Add + remove happen in ONE history step so a move/rotate undoes as one.
    if ((r.commit && r.commit.length) || (r.remove && r.remove.length))
      store.applyChange(r.commit ?? [], r.remove ?? []);
    if (r.hint) {
      hintRef.current = r.hint;
      onHint(r.hint);
    }
    if (r.done) {
      // Reset the active tool with a fresh instance so the next op starts cleanly.
      const factoryCtx: ToolFactoryCtx = {
        getEntity: (id) => store.get().doc.entities.find((e) => e.id === id),
        getAll: () => store.get().doc.entities,
        selectedIds: () => store.get().ui.selectedIds,
      };
      toolRef.current = createTool(store.get().ui.tool, factoryCtx);
      hintRef.current = toolRef.current.hint;
      onHint(hintRef.current);
      lastCommittedPointRef.current = null;
    }
    refreshPreview();
  }

  // Mouse handling.
  function onMouseDown(ev: React.MouseEvent) {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    const sp: Point = { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
    cursorScreenRef.current = sp;
    lastMouseRef.current = sp;
    recomputeSnap();

    if (ev.button === 1 || (ev.button === 0 && ev.altKey)) {
      isPanningRef.current = true;
      panOriginRef.current = sp;
      ev.preventDefault();
      return;
    }
    if (ev.button !== 0) return;

    const cur = effectiveCursor();
    const t = store.get().ui.tool;

    if (t === 'select') {
      // Grip hit-test first: clicking a grip of a selected entity starts a
      // grip drag instead of re-selecting.
      const gripHit = findGripAt(sp);
      if (gripHit) {
        gripDragRef.current = gripHit;
        requestRender();
        return;
      }
      const hit = pickEntity(cur, viewportRef.current);
      if (hit) {
        const cur = store.get().ui.selectedIds;
        if (ev.shiftKey) {
          const next = cur.includes(hit) ? cur.filter((x) => x !== hit) : [...cur, hit];
          store.setSelection(next);
        } else {
          store.setSelection([hit]);
        }
      } else {
        // Begin a drag-select rectangle.
        dragSelectRef.current = { start: sp };
        if (!ev.shiftKey) store.setSelection([]);
      }
      requestRender();
      return;
    }

    if (!toolRef.current) return;
    const result = toolRef.current.step({ type: 'click', point: cur }, buildToolContext());
    lastCommittedPointRef.current = cur;
    applyResult(result);
  }

  function onMouseMove(ev: React.MouseEvent) {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    const sp: Point = { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
    const dx = sp.x - lastMouseRef.current.x;
    const dy = sp.y - lastMouseRef.current.y;
    cursorScreenRef.current = sp;
    if (isPanningRef.current) {
      viewportRef.current = panByScreen(viewportRef.current, dx, dy);
      lastMouseRef.current = sp;
      recomputeSnap();
      requestRender();
      return;
    }
    lastMouseRef.current = sp;
    if (gripDragRef.current) {
      // Grip drag: snap against everything except the edited entity, then
      // preview the modified shape live.
      recomputeSnap(gripDragRef.current.entityId);
      const ent = store.get().doc.entities.find((e) => e.id === gripDragRef.current!.entityId);
      if (ent) {
        const moved = moveGrip(ent, gripDragRef.current.grip, effectiveCursor());
        previewRef.current = [{ ...moved, id: 'preview-grip' }];
      }
      requestRender();
      return;
    }
    recomputeSnap();
    if (toolRef.current) toolRef.current.step({ type: 'move', point: effectiveCursor() }, buildToolContext());
    refreshPreview();
  }

  function onMouseUp(ev: React.MouseEvent) {
    if (isPanningRef.current && (ev.button === 1 || ev.button === 0)) {
      isPanningRef.current = false;
      return;
    }
    if (gripDragRef.current && ev.button === 0) {
      const { entityId, grip } = gripDragRef.current;
      gripDragRef.current = null;
      previewRef.current = [];
      const ent = store.get().doc.entities.find((e) => e.id === entityId);
      if (ent) {
        const moved = moveGrip(ent, grip, effectiveCursor());
        store.updateEntity(entityId, moved as Partial<Entity>);
      }
      requestRender();
      return;
    }
    if (dragSelectRef.current && ev.button === 0) {
      const start = dragSelectRef.current.start;
      const end = cursorScreenRef.current;
      dragSelectRef.current = null;
      const v = viewportRef.current;
      const wa = screenToWorld(v, start);
      const wb = screenToWorld(v, end);
      const xMin = Math.min(wa.x, wb.x);
      const xMax = Math.max(wa.x, wb.x);
      const yMin = Math.min(wa.y, wb.y);
      const yMax = Math.max(wa.y, wb.y);
      const ids: string[] = [];
      for (const e of store.get().doc.entities) {
        const b = entityBox(e);
        if (b.minX >= xMin && b.maxX <= xMax && b.minY >= yMin && b.maxY <= yMax) ids.push(e.id);
      }
      if (ids.length) store.setSelection(ev.shiftKey ? Array.from(new Set([...store.get().ui.selectedIds, ...ids])) : ids);
      requestRender();
    }
  }

  function onWheel(ev: React.WheelEvent) {
    ev.preventDefault();
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    const sp: Point = { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
    const factor = ev.deltaY > 0 ? 0.85 : 1 / 0.85;
    viewportRef.current = zoomAtScreen(viewportRef.current, sp, factor);
    recomputeSnap();
    requestRender();
  }

  // Find a grip of any selected entity within pick range of the screen point.
  function findGripAt(sp: Point): { entityId: string; grip: Grip } | null {
    const v = viewportRef.current;
    const sel = new Set(store.get().ui.selectedIds);
    if (!sel.size) return null;
    for (const e of store.get().doc.entities) {
      if (!sel.has(e.id)) continue;
      for (const g of gripsOf(e)) {
        const gs = worldToScreen(v, g.point);
        if (Math.hypot(gs.x - sp.x, gs.y - sp.y) <= 7) return { entityId: e.id, grip: g };
      }
    }
    return null;
  }

  function pickEntity(p: Point, v: Viewport): string | null {
    const tolerance = 6 / v.scale;
    let best: string | null = null;
    let bestD = tolerance;
    for (const e of store.get().doc.entities) {
      const layer = store.get().doc.layers.find((l) => l.id === e.layerId);
      if (!layer || !layer.visible) continue;
      const d = distanceToEntity(e, p);
      if (d < bestD) {
        bestD = d;
        best = e.id;
      }
    }
    return best;
  }

  // Expose commands for the keyboard bindings & command line.
  useEffect(() => {
    const api: CommandAPI = {
      submitValue: (val) => {
        const t = toolRef.current;
        if (!t) return;
        const expects = t.expects ? t.expects() : 'point';
        if (expects === 'point') {
          const v = val.trim();
          const from = lastCommittedPointRef.current;
          let p: Point | null = null;
          // Direct distance entry (AutoCAD style): a plain number draws that
          // many mm from the last point towards the current cursor direction
          // (ortho/snap-aware via effectiveCursor).
          if (from && /^-?\d+(?:\.\d+)?$/.test(v)) {
            const d = parseFloat(v);
            const to = effectiveCursor();
            const len = Math.hypot(to.x - from.x, to.y - from.y);
            if (isFinite(d) && len > 1e-9) {
              p = {
                x: from.x + ((to.x - from.x) / len) * d,
                y: from.y + ((to.y - from.y) / len) * d,
              };
            }
          }
          if (!p) p = parsePoint(v, from ?? cursorWorldRef.current);
          if (!p) return;
          const result = t.step({ type: 'value', point: p }, buildToolContext());
          lastCommittedPointRef.current = p;
          applyResult(result);
        } else {
          // 'distance' gets the trimmed number, 'text' the raw string.
          const v = expects === 'text' ? val : val.trim();
          const result = t.step({ type: 'value', value: v }, buildToolContext());
          applyResult(result);
        }
      },
      cancel: () => {
        if (!toolRef.current) return;
        const r = toolRef.current.step({ type: 'cancel' }, buildToolContext());
        applyResult(r);
      },
      commit: () => {
        if (!toolRef.current) return;
        const r = toolRef.current.step({ type: 'commit' }, buildToolContext());
        applyResult(r);
      },
      zoomFit: () => {
        const ents = store.get().doc.entities;
        if (!ents.length) return;
        let box = entityBox(ents[0]);
        for (let i = 1; i < ents.length; i++) box = unionBox(box, entityBox(ents[i]));
        if (isEmpty(box)) return;
        const v = viewportRef.current;
        const margin = 40;
        const w = box.maxX - box.minX;
        const h = box.maxY - box.minY;
        const sx = (v.width - margin * 2) / Math.max(w, 1e-6);
        const sy = (v.height - margin * 2) / Math.max(h, 1e-6);
        const newScale = Math.max(0.05, Math.min(sx, sy));
        viewportRef.current = {
          ...v,
          scale: newScale,
          cx: (box.minX + box.maxX) / 2,
          cy: (box.minY + box.maxY) / 2,
        };
        requestRender();
      },
      expects: () => (toolRef.current?.expects ? toolRef.current.expects() : 'point'),
      hint: () => hintRef.current,
    };
    registerCommand(api);
  }, [registerCommand]);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden">
      <canvas
        ref={canvasRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={() => (isPanningRef.current = false)}
        onWheel={onWheel}
        onContextMenu={(e) => e.preventDefault()}
        className="absolute inset-0"
        style={{ cursor: 'none' }}
      />
    </div>
  );
};

// Full-screen crosshair (signature AutoCAD look) with a small pickbox in the
// middle. Pickbox switches to yellow when the cursor is magnetised to a snap
// point so the lock is unmistakable.
function drawCrosshair(
  ctx: CanvasRenderingContext2D,
  cs: Point,
  width: number,
  height: number,
  locked: boolean,
) {
  ctx.save();
  ctx.strokeStyle = locked ? 'rgba(255,209,102,0.55)' : 'rgba(220,220,220,0.55)';
  ctx.lineWidth = 1;
  const x = Math.round(cs.x) + 0.5;
  const y = Math.round(cs.y) + 0.5;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(width, y);
  ctx.moveTo(x, 0);
  ctx.lineTo(x, height);
  ctx.stroke();
  ctx.strokeStyle = locked ? '#ffd166' : 'rgba(255,255,255,0.85)';
  ctx.lineWidth = locked ? 1.6 : 1.25;
  const r = locked ? 6 : 5;
  ctx.strokeRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

// Faint dashed line from the raw mouse position to the snapped target, so the
// user can feel the magnet pulling the cursor across the gap.
function drawMagnetLink(ctx: CanvasRenderingContext2D, raw: Point, snapped: Point) {
  if (Math.hypot(raw.x - snapped.x, raw.y - snapped.y) < 4) return;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,209,102,0.45)';
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 3]);
  ctx.beginPath();
  ctx.moveTo(raw.x, raw.y);
  ctx.lineTo(snapped.x, snapped.y);
  ctx.stroke();
  ctx.restore();
}

// World-coordinate UCS marker: the small X/Y arrow icon AutoCAD draws in the
// bottom-left. We render it in screen space, anchored to the corner.
function drawUCS(ctx: CanvasRenderingContext2D, v: Viewport) {
  const pad = 18;
  const len = 28;
  const x0 = pad;
  const y0 = v.height - pad;
  ctx.save();
  ctx.lineWidth = 1.5;
  ctx.font = "bold 10px 'JetBrains Mono', monospace";
  // X axis (red, points right)
  ctx.strokeStyle = '#ff5b5b';
  ctx.fillStyle = '#ff5b5b';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x0 + len, y0);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x0 + len, y0);
  ctx.lineTo(x0 + len - 6, y0 - 3);
  ctx.lineTo(x0 + len - 6, y0 + 3);
  ctx.closePath();
  ctx.fill();
  ctx.fillText('X', x0 + len + 4, y0 + 4);
  // Y axis (green, points up — screen Y is inverted)
  ctx.strokeStyle = '#5bd66a';
  ctx.fillStyle = '#5bd66a';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x0, y0 - len);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x0, y0 - len);
  ctx.lineTo(x0 - 3, y0 - len + 6);
  ctx.lineTo(x0 + 3, y0 - len + 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillText('Y', x0 - 4, y0 - len - 6);
  // Origin dot
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  ctx.arc(x0, y0, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Parse "x,y" (absolute), "@dx,dy" (relative to last point) or polar
// "@100<45" (100 mm at 45°, CCW from +X, relative to last point).
function parsePoint(s: string, lastPoint: Point | null): Point | null {
  const trimmed = s.trim();
  if (!trimmed) return null;
  const rel = trimmed.startsWith('@');
  const body = rel ? trimmed.slice(1) : trimmed;
  const polar = body.match(/^(-?\d+(?:\.\d+)?)\s*<\s*(-?\d+(?:\.\d+)?)$/);
  if (polar) {
    const d = parseFloat(polar[1]);
    const ang = (parseFloat(polar[2]) * Math.PI) / 180;
    const base = rel && lastPoint ? lastPoint : { x: 0, y: 0 };
    return { x: base.x + d * Math.cos(ang), y: base.y + d * Math.sin(ang) };
  }
  const parts = body.split(/[,\s]+/).filter(Boolean);
  if (parts.length !== 2) return null;
  const x = parseFloat(parts[0]);
  const y = parseFloat(parts[1]);
  if (!isFinite(x) || !isFinite(y)) return null;
  if (rel) {
    const base = lastPoint ?? { x: 0, y: 0 };
    return { x: base.x + x, y: base.y + y };
  }
  return { x, y };
}

export type { CanvasHandle };
