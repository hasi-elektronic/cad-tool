import type { Entity, Layer } from '../core/types';
import { uid } from '../core/id';

export interface DxfImportResult {
  entities: Entity[];
  layers: Layer[];
}

interface Pair {
  code: number;
  value: string;
}

const ACI_RGB: Record<number, string> = {
  1: '#ff0000',
  2: '#ffff00',
  3: '#00ff00',
  4: '#00ffff',
  5: '#0000ff',
  6: '#ff00ff',
  7: '#ffffff',
  8: '#808080',
  9: '#c0c0c0',
  30: '#ff7f00',
};

export function parseDXF(text: string): DxfImportResult {
  const pairs = tokenize(text);
  const layers: Layer[] = [];
  const entities: Entity[] = [];
  // Walk pairs looking for SECTION markers, then dispatch.
  for (let i = 0; i < pairs.length; i++) {
    if (pairs[i].code === 0 && pairs[i].value === 'SECTION') {
      // Find the section name at the next code-2 line.
      const section = pairs[i + 1]?.value;
      if (section === 'TABLES') {
        i = readTables(pairs, i, layers);
      } else if (section === 'ENTITIES') {
        i = readEntities(pairs, i, entities, layers);
      }
    }
  }
  // Ensure every referenced layer exists.
  if (!layers.length) layers.push({ id: 'L_0', name: '0', color: '#33d17a', visible: true, locked: false });
  return { entities, layers };
}

function readTables(pairs: Pair[], start: number, layers: Layer[]): number {
  let i = start;
  while (i < pairs.length) {
    const p = pairs[i];
    if (p.code === 0 && p.value === 'ENDSEC') return i;
    if (p.code === 0 && p.value === 'LAYER') {
      let name = '0';
      let aci = 7;
      let locked = false;
      i++;
      while (i < pairs.length && !(pairs[i].code === 0)) {
        const q = pairs[i];
        if (q.code === 2) name = q.value;
        else if (q.code === 62) aci = parseInt(q.value, 10);
        else if (q.code === 70) locked = (parseInt(q.value, 10) & 4) !== 0;
        i++;
      }
      const id = 'L_' + name;
      if (!layers.some((l) => l.id === id)) {
        layers.push({
          id,
          name,
          color: ACI_RGB[aci] ?? '#9aa0b4',
          visible: true,
          locked,
        });
      }
      continue;
    }
    i++;
  }
  return i;
}

function readEntities(pairs: Pair[], start: number, entities: Entity[], layers: Layer[]): number {
  let i = start;
  while (i < pairs.length) {
    const p = pairs[i];
    if (p.code === 0 && p.value === 'ENDSEC') return i;
    if (p.code === 0) {
      const type = p.value;
      const block: Pair[] = [];
      i++;
      while (i < pairs.length && !(pairs[i].code === 0)) {
        block.push(pairs[i]);
        i++;
      }
      const ent = parseEntity(type, block, layers);
      if (ent) entities.push(...ent);
      continue;
    }
    i++;
  }
  return i;
}

function parseEntity(type: string, block: Pair[], layers: Layer[]): Entity[] | null {
  const get = (code: number) => block.find((p) => p.code === code)?.value;
  const num = (code: number) => {
    const v = get(code);
    return v != null ? parseFloat(v) : 0;
  };
  const layerName = get(8) ?? '0';
  const layerId = ensureLayer(layers, layerName);

  switch (type) {
    case 'LINE':
      return [
        {
          id: uid('imp'),
          type: 'line',
          layerId,
          a: { x: num(10), y: num(20) },
          b: { x: num(11), y: num(21) },
        },
      ];
    case 'CIRCLE':
      return [
        {
          id: uid('imp'),
          type: 'circle',
          layerId,
          c: { x: num(10), y: num(20) },
          r: num(40),
        },
      ];
    case 'ARC':
      return [
        {
          id: uid('imp'),
          type: 'arc',
          layerId,
          c: { x: num(10), y: num(20) },
          r: num(40),
          startAngle: (num(50) * Math.PI) / 180,
          endAngle: (num(51) * Math.PI) / 180,
        },
      ];
    case 'LWPOLYLINE': {
      const xs = block.filter((p) => p.code === 10).map((p) => parseFloat(p.value));
      const ys = block.filter((p) => p.code === 20).map((p) => parseFloat(p.value));
      const n = Math.min(xs.length, ys.length);
      const points = [];
      for (let i = 0; i < n; i++) points.push({ x: xs[i], y: ys[i] });
      const flag = parseInt(get(70) ?? '0', 10);
      return [
        {
          id: uid('imp'),
          type: 'polyline',
          layerId,
          points,
          closed: (flag & 1) === 1,
        },
      ];
    }
    case 'TEXT':
      return [
        {
          id: uid('imp'),
          type: 'text',
          layerId,
          pos: { x: num(10), y: num(20) },
          text: get(1) ?? '',
          height: num(40) || 3,
          rotation: ((parseFloat(get(50) ?? '0') || 0) * Math.PI) / 180,
        },
      ];
    case 'ELLIPSE': {
      const cx = num(10);
      const cy = num(20);
      const ex = num(11);
      const ey = num(21);
      const ratio = parseFloat(get(40) ?? '1');
      const rx = Math.hypot(ex, ey);
      const ry = rx * ratio;
      const rotation = Math.atan2(ey, ex);
      return [
        {
          id: uid('imp'),
          type: 'ellipse',
          layerId,
          c: { x: cx, y: cy },
          rx,
          ry,
          rotation,
        },
      ];
    }
    default:
      return null;
  }
}

function ensureLayer(layers: Layer[], name: string): string {
  const id = 'L_' + name;
  if (!layers.some((l) => l.id === id)) {
    layers.push({ id, name, color: '#9aa0b4', visible: true, locked: false });
  }
  return id;
}

function tokenize(text: string): Pair[] {
  const lines = text.replace(/\r/g, '').split('\n');
  const out: Pair[] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = parseInt(lines[i].trim(), 10);
    if (!isFinite(code)) continue;
    out.push({ code, value: lines[i + 1] });
  }
  return out;
}

export function importDXFFromFile(file: File): Promise<DxfImportResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(parseDXF(String(reader.result ?? '')));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
