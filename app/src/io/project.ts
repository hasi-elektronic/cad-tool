import type { DocState } from '../state/store';

// Native project file: plain JSON keeping the full document (all entity
// fields, layers, active layer) — lossless, unlike DXF round-trips.
export interface ProjectFile {
  app: 'hasi-cad';
  version: 1;
  savedAt: string;
  doc: DocState;
}

export const AUTOSAVE_KEY = 'hasi-cad-autosave-v1';

export function serializeProject(doc: DocState): string {
  const file: ProjectFile = {
    app: 'hasi-cad',
    version: 1,
    savedAt: new Date().toISOString(),
    doc,
  };
  return JSON.stringify(file, null, 2);
}

export function parseProject(text: string): DocState {
  const raw = JSON.parse(text) as Partial<ProjectFile>;
  if (raw.app !== 'hasi-cad' || !raw.doc) throw new Error('Keine gültige HASI-CAD-Projektdatei');
  const doc = raw.doc;
  if (!Array.isArray(doc.entities) || !Array.isArray(doc.layers) || !doc.layers.length)
    throw new Error('Projektdatei ist beschädigt');
  if (!doc.layers.some((l) => l.id === doc.activeLayerId)) doc.activeLayerId = doc.layers[0].id;
  return doc;
}

export function downloadProject(doc: DocState, name = 'zeichnung.hasicad.json') {
  const blob = new Blob([serializeProject(doc)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

// --- Autosave (localStorage) ---

export function writeAutosave(doc: DocState) {
  try {
    localStorage.setItem(AUTOSAVE_KEY, serializeProject(doc));
  } catch {
    // Quota exceeded / private mode — autosave is best-effort.
  }
}

export function readAutosave(): DocState | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return null;
    const doc = parseProject(raw);
    return doc.entities.length ? doc : null;
  } catch {
    return null;
  }
}

export function clearAutosave() {
  try {
    localStorage.removeItem(AUTOSAVE_KEY);
  } catch {
    // ignore
  }
}
