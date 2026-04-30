// World coordinates are in millimetres. Y axis points UP (CAD convention).
// Screen coordinates are in CSS pixels. Y axis points DOWN.

export interface Point {
  x: number;
  y: number;
}

export interface Layer {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  locked: boolean;
}

export type EntityType =
  | 'line'
  | 'circle'
  | 'arc'
  | 'rect'
  | 'polyline'
  | 'ellipse'
  | 'dimension'
  | 'text';

interface BaseEntity {
  id: string;
  layerId: string;
  type: EntityType;
}

export interface LineEntity extends BaseEntity {
  type: 'line';
  a: Point;
  b: Point;
}

export interface CircleEntity extends BaseEntity {
  type: 'circle';
  c: Point;
  r: number;
}

export interface ArcEntity extends BaseEntity {
  type: 'arc';
  c: Point;
  r: number;
  // Angles in radians, drawn counter-clockwise from start to end.
  startAngle: number;
  endAngle: number;
}

export interface RectEntity extends BaseEntity {
  type: 'rect';
  a: Point;
  b: Point;
}

export interface PolylineEntity extends BaseEntity {
  type: 'polyline';
  points: Point[];
  closed: boolean;
}

export interface EllipseEntity extends BaseEntity {
  type: 'ellipse';
  c: Point;
  rx: number;
  ry: number;
  rotation: number; // radians
}

export type DimensionKind =
  | 'aligned'
  | 'horizontal'
  | 'vertical'
  | 'radius'
  | 'diameter'
  | 'angular';

export type DimensionArrow = 'tick' | 'arrow';

export interface DimensionEntity extends BaseEntity {
  type: 'dimension';
  // Default 'aligned' for backwards compatibility with older saved files.
  kind?: DimensionKind;
  // Common: linear dims use a→b as measured points; radius/diameter use a as
  // circle centre and b as a point on the circle/leader endpoint; angular uses
  // a and b as the two arm-end points around vertex `c`.
  a: Point;
  b: Point;
  c?: Point; // vertex point for angular; centre when explicit (radius/diam)
  // Perpendicular offset distance from baseline for linear dimension lines,
  // or arc radius for angular, or leader length for radius/diameter.
  offset: number;
  // Display options
  prefix?: string;
  suffix?: string;
  // If set, replaces the auto-computed numeric label.
  override?: string;
  // Decimal places (default 2).
  precision?: number;
  // Arrow head style for the dimension line endpoints.
  arrow?: DimensionArrow;
}

export interface TextEntity extends BaseEntity {
  type: 'text';
  pos: Point;
  text: string;
  height: number;
  rotation: number;
}

export type Entity =
  | LineEntity
  | CircleEntity
  | ArcEntity
  | RectEntity
  | PolylineEntity
  | EllipseEntity
  | DimensionEntity
  | TextEntity;

export interface SnapResult {
  point: Point;
  type: 'endpoint' | 'midpoint' | 'center' | 'intersection' | 'grid' | 'quadrant';
  entityId?: string;
}

export type SnapType = SnapResult['type'];

export interface Viewport {
  // World-space point at the centre of the canvas.
  cx: number;
  cy: number;
  // Pixels per world unit (mm).
  scale: number;
  width: number;
  height: number;
}

export type ToolId =
  | 'select'
  | 'line'
  | 'circle'
  | 'rect'
  | 'arc'
  | 'polyline'
  | 'dimension'
  | 'dim_horizontal'
  | 'dim_vertical'
  | 'dim_radius'
  | 'dim_diameter'
  | 'dim_angular'
  | 'ellipse'
  | 'fillet'
  | 'trim'
  | 'offset'
  | 'mirror'
  | 'copy'
  | 'move';
