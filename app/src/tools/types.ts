import type { Entity, Point, Viewport } from '../core/types';

export interface ToolContext {
  // Snapped (or raw) world point under the cursor; null if no input yet.
  cursor: Point;
  // The world-space cursor before snapping/ortho, useful for UI feedback.
  rawCursor: Point;
  viewport: Viewport;
  activeLayerId: string;
  // Allow a tool to request a one-off prompt input (e.g. radius value).
  prompt?: string;
}

export interface ToolEvent {
  type: 'click' | 'commit' | 'cancel' | 'value' | 'move';
  // For 'value' events from the command line.
  value?: string;
  point?: Point;
}

export interface ToolResult {
  // Newly committed entities to add to the document.
  commit?: Entity[];
  // Entities deleted by this action (e.g. trim).
  remove?: string[];
  // Whether the tool is finished (true means start a fresh instance).
  done: boolean;
  // Optional preview entities (drawn but not committed).
  preview?: Entity[];
  // Optional override for the command-line hint shown to the user.
  hint?: string;
}

export interface Tool {
  readonly id: string;
  readonly hint: string;
  // Each tool is a state machine; `step` advances it.
  step(event: ToolEvent, ctx: ToolContext): ToolResult;
  // Render-only preview based on current internal state and cursor position.
  preview(ctx: ToolContext): Entity[];
  // Allow a tool to declare which command-line input format it expects ("dist", "point", etc.).
  expects?(): 'point' | 'distance' | 'none';
}
