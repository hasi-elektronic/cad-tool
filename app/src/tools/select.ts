import type { Tool, ToolContext, ToolEvent, ToolResult } from './types';

// Select is mostly handled by the canvas controller (clicking entities), so this tool
// is essentially a no-op. It exists so the tool dispatcher has a uniform interface.
export class SelectTool implements Tool {
  id = 'select';
  hint = 'SELECT: click an entity (Del to remove)';
  step(_ev: ToolEvent, _ctx: ToolContext): ToolResult {
    return { done: false };
  }
  preview(_ctx: ToolContext) {
    return [];
  }
  expects() {
    return 'none' as const;
  }
}
