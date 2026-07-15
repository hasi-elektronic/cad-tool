import type { Entity, Point, TextEntity } from '../core/types';
import type { Tool, ToolContext, ToolEvent, ToolResult } from './types';
import { uid } from '../core/id';

export const DEFAULT_TEXT_HEIGHT = 5; // mm

// TEXT: click the insertion point, then type the content into the command
// line and confirm with Enter. Height/rotation are edited afterwards in the
// properties panel.
export class TextTool implements Tool {
  readonly id = 'text';
  hint = 'TEXT: Einfügepunkt wählen';
  private pos: Point | null = null;

  expects(): 'point' | 'text' {
    return this.pos ? 'text' : 'point';
  }

  step(ev: ToolEvent, ctx: ToolContext): ToolResult {
    if (ev.type === 'cancel') return { done: true };

    if (!this.pos) {
      if (ev.type === 'click' || ev.type === 'value') {
        this.pos = ev.point ?? ctx.cursor;
        return { done: false, hint: 'TEXT: Text eingeben und mit Enter bestätigen' };
      }
      return { done: false };
    }

    if (ev.type === 'value' && ev.value !== undefined) {
      const text = ev.value;
      if (!text.trim()) return { done: true };
      const ent: TextEntity = {
        id: uid('tx'),
        layerId: ctx.activeLayerId,
        type: 'text',
        pos: this.pos,
        text,
        height: DEFAULT_TEXT_HEIGHT,
        rotation: 0,
      };
      return { commit: [ent], done: true };
    }

    // Enter without content cancels the placement.
    if (ev.type === 'commit') return { done: true };
    return { done: false };
  }

  preview(ctx: ToolContext): Entity[] {
    // Ghost marker at the pending insertion point (or under the cursor) so
    // the user sees where the text will land.
    const p = this.pos ?? ctx.cursor;
    const ghost: TextEntity = {
      id: 'preview-text',
      layerId: ctx.activeLayerId,
      type: 'text',
      pos: p,
      text: this.pos ? 'Text…' : 'TEXT',
      height: DEFAULT_TEXT_HEIGHT,
      rotation: 0,
    };
    return [ghost];
  }
}
