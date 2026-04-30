import type { Entity, ToolId } from '../core/types';
import type { Tool } from './types';
import { LineTool } from './line';
import { CircleTool } from './circle';
import { RectTool } from './rect';
import { ArcTool } from './arc';
import { PolylineTool } from './polyline';
import {
  DimensionTool,
  LinearDimensionTool,
  RadialDimensionTool,
  AngularDimensionTool,
} from './dimension';
import { EllipseTool } from './ellipse';
import { SelectTool } from './select';
import { MoveTool } from './move';
import { MirrorTool } from './mirror';
import { OffsetTool } from './offset';
import { TrimTool } from './trim';
import { FilletTool } from './fillet';

export interface ToolFactoryCtx {
  getEntity: (id: string) => Entity | undefined;
  getAll: () => Entity[];
  selectedIds: () => string[];
}

export function createTool(id: ToolId, ctx: ToolFactoryCtx): Tool {
  switch (id) {
    case 'select':
      return new SelectTool();
    case 'line':
      return new LineTool();
    case 'circle':
      return new CircleTool();
    case 'rect':
      return new RectTool();
    case 'arc':
      return new ArcTool();
    case 'polyline':
      return new PolylineTool();
    case 'dimension':
      return new DimensionTool();
    case 'dim_horizontal':
      return new LinearDimensionTool('horizontal');
    case 'dim_vertical':
      return new LinearDimensionTool('vertical');
    case 'dim_radius':
      return new RadialDimensionTool('radius');
    case 'dim_diameter':
      return new RadialDimensionTool('diameter');
    case 'dim_angular':
      return new AngularDimensionTool();
    case 'ellipse':
      return new EllipseTool();
    case 'move':
      return new MoveTool({ ids: ctx.selectedIds(), getEntity: ctx.getEntity }, false);
    case 'copy':
      return new MoveTool({ ids: ctx.selectedIds(), getEntity: ctx.getEntity }, true);
    case 'mirror':
      return new MirrorTool({ ids: ctx.selectedIds(), getEntity: ctx.getEntity, deleteSource: false });
    case 'offset':
      return new OffsetTool({ ids: ctx.selectedIds(), getEntity: ctx.getEntity });
    case 'trim':
      return new TrimTool({ getAll: ctx.getAll });
    case 'fillet':
      return new FilletTool({ getAll: ctx.getAll });
  }
}
