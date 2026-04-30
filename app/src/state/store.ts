import type { Entity, Layer, ToolId } from '../core/types';

export interface DocState {
  entities: Entity[];
  layers: Layer[];
  activeLayerId: string;
}

export interface UIState {
  tool: ToolId;
  selectedIds: string[];
  // Toggles
  ortho: boolean;
  snap: boolean;
  showGrid: boolean;
  // Grid step in mm.
  gridMinor: number;
  // Help overlay visibility
  showHelp: boolean;
}

export interface AppState {
  doc: DocState;
  ui: UIState;
}

type Listener = () => void;

const DEFAULT_LAYERS: Layer[] = [
  { id: 'L_0', name: '0', color: '#33d17a', visible: true, locked: false },
  { id: 'L_construction', name: 'Construction', color: '#9aa0b4', visible: true, locked: false },
  { id: 'L_dimensions', name: 'Dimensions', color: '#ffd166', visible: true, locked: false },
];

const initialState = (): AppState => ({
  doc: {
    entities: [],
    layers: DEFAULT_LAYERS.map((l) => ({ ...l })),
    activeLayerId: 'L_0',
  },
  ui: {
    tool: 'line',
    selectedIds: [],
    ortho: false,
    snap: true,
    showGrid: true,
    gridMinor: 10,
    showHelp: false,
  },
});

export class Store {
  private state: AppState = initialState();
  private undoStack: DocState[] = [];
  private redoStack: DocState[] = [];
  private listeners = new Set<Listener>();

  get(): AppState {
    return this.state;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }

  // --- DOC mutations: history-tracked ---

  private snapshotDoc(): DocState {
    const d = this.state.doc;
    return {
      entities: d.entities.map((e) => structuredClone(e)),
      layers: d.layers.map((l) => ({ ...l })),
      activeLayerId: d.activeLayerId,
    };
  }

  private commitDoc(next: DocState) {
    this.undoStack.push(this.snapshotDoc());
    if (this.undoStack.length > 500) this.undoStack.shift();
    this.redoStack = [];
    this.state = { ...this.state, doc: next };
    this.emit();
  }

  addEntities(entities: Entity[]) {
    if (!entities.length) return;
    const next = this.snapshotDoc();
    next.entities = [...next.entities, ...entities];
    this.commitDoc(next);
  }

  updateEntity(id: string, patch: Partial<Entity>) {
    const next = this.snapshotDoc();
    next.entities = next.entities.map((e) => (e.id === id ? ({ ...e, ...patch } as Entity) : e));
    this.commitDoc(next);
  }

  replaceEntities(entities: Entity[]) {
    const next = this.snapshotDoc();
    next.entities = entities.map((e) => structuredClone(e));
    this.commitDoc(next);
  }

  deleteEntities(ids: string[]) {
    if (!ids.length) return;
    const set = new Set(ids);
    const next = this.snapshotDoc();
    next.entities = next.entities.filter((e) => !set.has(e.id));
    this.commitDoc(next);
    this.setSelection([]);
  }

  // Layers
  addLayer(layer: Layer) {
    const next = this.snapshotDoc();
    next.layers = [...next.layers, layer];
    this.commitDoc(next);
  }

  updateLayer(id: string, patch: Partial<Layer>) {
    const next = this.snapshotDoc();
    next.layers = next.layers.map((l) => (l.id === id ? { ...l, ...patch } : l));
    this.commitDoc(next);
  }

  removeLayer(id: string) {
    if (this.state.doc.layers.length <= 1) return;
    const next = this.snapshotDoc();
    next.layers = next.layers.filter((l) => l.id !== id);
    next.entities = next.entities.filter((e) => e.layerId !== id);
    if (next.activeLayerId === id) next.activeLayerId = next.layers[0].id;
    this.commitDoc(next);
  }

  setActiveLayer(id: string) {
    if (!this.state.doc.layers.some((l) => l.id === id)) return;
    // Active layer is a UI affordance — don't push it onto the undo stack.
    this.state = { ...this.state, doc: { ...this.state.doc, activeLayerId: id } };
    this.emit();
  }

  // --- History ---

  undo() {
    const prev = this.undoStack.pop();
    if (!prev) return;
    this.redoStack.push(this.snapshotDoc());
    this.state = { ...this.state, doc: prev, ui: { ...this.state.ui, selectedIds: [] } };
    this.emit();
  }

  redo() {
    const next = this.redoStack.pop();
    if (!next) return;
    this.undoStack.push(this.snapshotDoc());
    this.state = { ...this.state, doc: next, ui: { ...this.state.ui, selectedIds: [] } };
    this.emit();
  }

  // --- UI state (not history-tracked) ---

  setUI(patch: Partial<UIState>) {
    this.state = { ...this.state, ui: { ...this.state.ui, ...patch } };
    this.emit();
  }

  setTool(tool: ToolId) {
    this.setUI({ tool, selectedIds: [] });
  }

  setSelection(ids: string[]) {
    this.setUI({ selectedIds: ids });
  }

  resetAll() {
    this.state = initialState();
    this.undoStack = [];
    this.redoStack = [];
    this.emit();
  }
}

export const store = new Store();
