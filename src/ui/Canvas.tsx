import React, { useEffect, useRef } from 'react';
import { store, useStore } from '../state/useStore';
import type { Entity, Point, SnapResult, Viewport } from '../core/types';
import {
  panByScreen,
  screenToWorld,
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
  // Submit a value (point or distance) from the command line.
  submitValue: (val: string) => void;
  // Cancel current op (ESC).
  cancel: () => void;
  // Commit current op (ENTER).
  commit: () => void;
  // Zoom-fit on all entities.
  zoomFit: () => void;
  // The tool currently expects this kind of input.
  expects: () => 'point' | 'distance' | 'none';
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

    // Cursor crosshair.
    const cs = cursorScreenRef.current;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cs.x - 10, cs.y);
    ctx.lineTo(cs.x + 10, cs.y);
    ctx.moveTo(cs.x, cs.y - 10);
    ctx.lineTo(cs.x, cs.y + 10);
    ctx.stroke();
    ctx.restore();

    // Live distance/angle readout if a tool has a "from" point.
    if (lastCommittedPointRef.current) {
      const from = lastCommittedPointRef.current;
      const to = cursorWorldRef.current;
      const d = distance(from, to);
      const ang = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
      ctx.save();
      ctx.fillStyle = 'rgba(34,34,58,0.85)';
      ctx.strokeStyle = '#33afe2';
      ctx.font = "11px 'JetBrains Mono', monospace";
      const txt = `Δ ${formatNumber(d, 2)}mm  ∠ ${formatNumber(ang, 1)}°`;
      const m = ctx.measureText(txt);
      ctx.fillRect(cs.x + 14, cs.y + 14, m.width + 12, 18);
      ctx.strokeRect(cs.x + 14, cs.y + 14, m.width + 12, 18);
      ctx.fillStyle = '#e8eef7';
      ctx.fillText(txt, cs.x + 20, cs.y + 27);
      ctx.restore();
    }

    onZoom(v.scale);
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

  function recomputeSnap() {
    const v = viewportRef.current;
    const world = screenToWorld(v, cursorScreenRef.current);
    cursorWorldRef.current = world;
    const ui = store.get().ui;
    if (ui.snap) {
      const s = findSnap(world, store.get().doc.entities, v, {
        enabled: true,
        gridStep: ui.gridMinor,
        pickRadiusPx: 12,
      });
      snapRef.current = s;
    } else {
      snapRef.current = null;
    }
    onStatus({ x: world.x, y: world.y, snap: snapRef.current });
  }

  function effectiveCursor(): Point {
    const raw = snapRef.current?.point ?? cursorWorldRef.current;
    return applyOrtho(raw);
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
    if (r.commit && r.commit.length) store.addEntities(r.commit);
    if (r.remove && r.remove.length) store.deleteEntities(r.remove);
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
    recomputeSnap();
    if (toolRef.current) toolRef.current.step({ type: 'move', point: effectiveCursor() }, buildToolContext());
    refreshPreview();
  }

  function onMouseUp(ev: React.MouseEvent) {
    if (isPanningRef.current && (ev.button === 1 || ev.button === 0)) {
      isPanningRef.current = false;
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
        const v = val.trim();
        const expects = t.expects ? t.expects() : 'point';
        if (expects === 'point') {
          const p = parsePoint(v, lastCommittedPointRef.current ?? cursorWorldRef.current);
          if (!p) return;
          const result = t.step({ type: 'value', point: p }, buildToolContext());
          lastCommittedPointRef.current = p;
          applyResult(result);
        } else if (expects === 'distance') {
          const result = t.step({ type: 'value', value: v }, buildToolContext());
          applyResult(result);
        } else {
          // fall back to value
          t.step({ type: 'value', value: v }, buildToolContext());
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
        className="absolute inset-0 cursor-crosshair"
      />
    </div>
  );
};

// Parse "x,y" (absolute) or "@dx,dy" (relative to last point).
function parsePoint(s: string, lastPoint: Point | null): Point | null {
  const trimmed = s.trim();
  if (!trimmed) return null;
  const rel = trimmed.startsWith('@');
  const body = rel ? trimmed.slice(1) : trimmed;
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
