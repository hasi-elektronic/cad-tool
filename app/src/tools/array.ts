import type { Entity, Point } from '../core/types';
import type { Tool, ToolContext, ToolEvent, ToolResult } from './types';
import { rotateEntity } from '../core/transform';
import { translateEntity } from './move';
import { uid } from '../core/id';

interface ArrayOpts {
  ids: string[];
  getEntity: (id: string) => Entity | undefined;
}

function cloneWithNewIds(e: Entity, tag: string): Entity {
  return { ...structuredClone(e), id: uid(tag) };
}

// REIHE (rechteckig): "Spalten,Zeilen" eingeben → Basispunkt klicken →
// Versatzpunkt klicken (oder "dx,dy" tippen). Der Cursor definiert den
// Spalten-/Zeilenabstand als Vektor vom Basispunkt.
export class RectArrayTool implements Tool {
  readonly id = 'array_rect';
  hint: string;
  private cols = 0;
  private rows = 0;
  private base: Point | null = null;
  private opts: ArrayOpts;

  constructor(opts: ArrayOpts) {
    this.opts = opts;
    this.hint = opts.ids.length
      ? 'REIHE: Spalten,Zeilen eingeben (z.B. 4,3)'
      : 'REIHE: Keine Auswahl — erst Objekte wählen (V)';
  }

  expects(): 'point' | 'distance' {
    return this.cols ? 'point' : 'distance';
  }

  step(ev: ToolEvent, ctx: ToolContext): ToolResult {
    if (ev.type === 'cancel') return { done: true };
    if (!this.opts.ids.length) return { done: true };

    if (!this.cols) {
      if (ev.type === 'value' && ev.value !== undefined) {
        const m = ev.value.trim().match(/^(\d+)\s*[,x]\s*(\d+)$/i);
        if (!m) return { done: false, hint: 'REIHE: Format Spalten,Zeilen — z.B. 4,3' };
        this.cols = Math.max(1, parseInt(m[1], 10));
        this.rows = Math.max(1, parseInt(m[2], 10));
        if (this.cols * this.rows > 2000)
          return { done: true, hint: 'REIHE: zu viele Kopien (max 2000)' };
        return { done: false, hint: 'REIHE: Basispunkt wählen' };
      }
      return { done: false };
    }

    if (ev.type === 'click' || ev.type === 'value') {
      const p = ev.point ?? ctx.cursor;
      if (!this.base) {
        this.base = p;
        return { done: false, hint: 'REIHE: Versatzpunkt wählen (Spalten-/Zeilenabstand)' };
      }
      const dx = p.x - this.base.x;
      const dy = p.y - this.base.y;
      return { commit: this.build(dx, dy), done: true };
    }
    return { done: false };
  }

  private build(dx: number, dy: number): Entity[] {
    const out: Entity[] = [];
    for (const id of this.opts.ids) {
      const ent = this.opts.getEntity(id);
      if (!ent) continue;
      for (let i = 0; i < this.cols; i++) {
        for (let j = 0; j < this.rows; j++) {
          if (i === 0 && j === 0) continue; // original stays
          out.push(translateEntity(cloneWithNewIds(ent, 'ar'), dx * i, dy * j));
        }
      }
    }
    return out;
  }

  preview(ctx: ToolContext): Entity[] {
    if (!this.base) return [];
    const dx = ctx.cursor.x - this.base.x;
    const dy = ctx.cursor.y - this.base.y;
    return this.build(dx, dy).map((e, i) => ({ ...e, id: 'preview-ar-' + i }));
  }
}

// POLARREIHE: Zentrum klicken → Anzahl eingeben → Kopien gleichmässig auf
// 360° um das Zentrum verteilt (ideal für Lochkreise).
export class PolarArrayTool implements Tool {
  readonly id = 'array_polar';
  hint: string;
  private center: Point | null = null;
  private opts: ArrayOpts;

  constructor(opts: ArrayOpts) {
    this.opts = opts;
    this.hint = opts.ids.length
      ? 'POLARREIHE: Zentrum wählen'
      : 'POLARREIHE: Keine Auswahl — erst Objekte wählen (V)';
  }

  expects(): 'point' | 'distance' {
    return this.center ? 'distance' : 'point';
  }

  step(ev: ToolEvent, ctx: ToolContext): ToolResult {
    if (ev.type === 'cancel') return { done: true };
    if (!this.opts.ids.length) return { done: true };

    if (!this.center) {
      if (ev.type === 'click' || ev.type === 'value') {
        this.center = ev.point ?? ctx.cursor;
        return { done: false, hint: 'POLARREIHE: Anzahl eingeben (z.B. 6)' };
      }
      return { done: false };
    }

    if (ev.type === 'value' && ev.value !== undefined) {
      const n = parseInt(ev.value.trim(), 10);
      if (!isFinite(n) || n < 2 || n > 720)
        return { done: false, hint: 'POLARREIHE: Anzahl zwischen 2 und 720' };
      const out: Entity[] = [];
      for (const id of this.opts.ids) {
        const ent = this.opts.getEntity(id);
        if (!ent) continue;
        for (let k = 1; k < n; k++) {
          const ang = (k * 2 * Math.PI) / n;
          out.push(rotateEntity(cloneWithNewIds(ent, 'pa'), ang, this.center));
        }
      }
      return { commit: out, done: true };
    }
    return { done: false };
  }

  preview(): Entity[] {
    return [];
  }
}
