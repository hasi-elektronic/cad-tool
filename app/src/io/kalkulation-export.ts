/**
 * Kalkulation Export — An Kalkulation senden
 *
 * Belirlenen teknik parametreleri toplayarak Sickinger Kalkulationssystem'e
 * POST eder ve dönen URL'yi yeni sekmede açar.
 *
 * Endpoint: https://sickinger-kalkulationssystem.pages.dev/api/import/cad
 * Token:    cad_883064945860458e135defe1dd4c042976e5
 */

import { entitiesToDXF } from './dxf-export';
import type { DocState } from '../state/store';
import type { Entity } from '../core/types';
import { distance } from '../core/math';

const KALK_ENDPOINT = 'https://sickinger-kalkulationssystem.pages.dev/api/import/cad';
const KALK_TOKEN    = 'cad_883064945860458e135defe1dd4c042976e5';

// ───────────────────────────────────────────────────────────────────
// Malzeme eşleme — DXF layer adı  →  Kalkulation Materialliste adı
// ───────────────────────────────────────────────────────────────────
const MATERIAL_MAP: Record<string, string> = {
  // Edelstahl
  'edelstahl':      '1.4301',
  'v2a':            '1.4301',
  '1.4301':         '1.4301',
  '1.4307':         '1.4307',
  '1.4404':         '1.4404',
  '1.4571':         '1.4571',
  // Baustahl
  'stahl':          'S235JR',
  's235':           'S235JR',
  's235jr':         'S235JR',
  's355':           'S355J2',
  's355j2':         'S355J2',
  'st37':           'S235JR',
  'st52':           'S355J2',
  // Aluminium
  'aluminium':      'AlMg3',
  'alu':            'AlMg3',
  'almg3':          'AlMg3',
  'almgsi':         'AlMgSi0.5',
  'almgsi0.5':      'AlMgSi0.5',
  'en-aw6082':      'EN-AW6082',
  // Kupfer / Messing
  'kupfer':         'CW004A',
  'cw004a':         'CW004A',
  'messing':        'CW614N',
  'cw614n':         'CW614N',
};

function resolveMaterial(raw: string): string {
  const key = raw.toLowerCase().trim();
  return MATERIAL_MAP[key] ?? raw.trim();
}

// ───────────────────────────────────────────────────────────────────
// Geometri okuma  →  CAD çiziminden tek parça boyutlarını çıkar
// ───────────────────────────────────────────────────────────────────
interface PartGeometry {
  shape: 'rund' | 'eckig';
  /** Ø için width = diameter, eckig için width = B */
  width: number;
  /** eckig için height = H; rund için 0 */
  height: number;
  thickness: number;
}

/**
 * Tüm entitiy'lerden baskın şekli çıkar:
 * - Çizimde en büyük circle varsa → rund, diameter = 2r
 * - Çizimde en büyük rect varsa  → eckig, B×H
 * - Hiçbiri yoksa                → eckig, BBox'tan hesapla
 */
function extractGeometry(entities: Entity[]): PartGeometry {
  // En büyük daireyi bul
  const circles = entities.filter((e) => e.type === 'circle');
  if (circles.length > 0) {
    const biggest = circles.reduce((a, b) =>
      (a as any).r > (b as any).r ? a : b
    ) as Extract<Entity, { type: 'circle' }>;
    return {
      shape: 'rund',
      width: Math.round(biggest.r * 2 * 100) / 100,
      height: 0,
      thickness: guessThickness(entities),
    };
  }

  // En büyük dikdörtgeni bul
  const rects = entities.filter((e) => e.type === 'rect');
  if (rects.length > 0) {
    const biggest = rects.reduce((prev, curr) => {
      const ap = Math.abs(((prev as any).b.x - (prev as any).a.x) * ((prev as any).b.y - (prev as any).a.y));
      const ac = Math.abs(((curr as any).b.x - (curr as any).a.x) * ((curr as any).b.y - (curr as any).a.y));
      return ac > ap ? curr : prev;
    }) as Extract<Entity, { type: 'rect' }>;
    const w = Math.abs(biggest.b.x - biggest.a.x);
    const h = Math.abs(biggest.b.y - biggest.a.y);
    return {
      shape: 'eckig',
      width:  Math.round(w * 100) / 100,
      height: Math.round(h * 100) / 100,
      thickness: guessThickness(entities),
    };
  }

  // Fallback: bounding box
  const bbox = getBBox(entities);
  return {
    shape: 'eckig',
    width:  Math.round((bbox.maxX - bbox.minX) * 100) / 100,
    height: Math.round((bbox.maxY - bbox.minY) * 100) / 100,
    thickness: guessThickness(entities),
  };
}

/** Dimension entity'lerinden kalınlık tahmini (küçük bemaßung = kalınlık) */
function guessThickness(entities: Entity[]): number {
  const dims = entities.filter((e) => e.type === 'dimension');
  if (dims.length === 0) return 5; // default 5mm
  // En küçük bemaßung değeri kalınlık adayıdır (≤ 50mm)
  const values = dims.map((d) => {
    const dd = d as Extract<Entity, { type: 'dimension' }>;
    return distance(dd.a, dd.b);
  }).filter((v) => v > 0 && v <= 50);
  if (values.length === 0) return 5;
  return Math.round(Math.min(...values) * 100) / 100;
}

function getBBox(entities: Entity[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  function check(x: number, y: number) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  for (const e of entities) {
    if (e.type === 'line' || e.type === 'rect' || e.type === 'dimension') {
      check(e.a.x, e.a.y); check(e.b.x, e.b.y);
    } else if (e.type === 'circle') {
      check(e.c.x - e.r, e.c.y - e.r); check(e.c.x + e.r, e.c.y + e.r);
    } else if (e.type === 'arc') {
      check(e.c.x - e.r, e.c.y - e.r); check(e.c.x + e.r, e.c.y + e.r);
    } else if (e.type === 'polyline') {
      for (const p of e.points) check(p.x, p.y);
    }
  }
  if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 100; maxY = 100; }
  return { minX, minY, maxX, maxY };
}

// ───────────────────────────────────────────────────────────────────
// Dialog verisi
// ───────────────────────────────────────────────────────────────────
export interface KalkulationParams {
  calcType:     'drueckteile' | 'laufrad' | 'baugruppe';
  title:        string;
  customerName: string;
  drawingNo:    string;
  batchQty:     number;
  material:     string;
  pricePerKg:   number;
  qty:          number;
}

// ───────────────────────────────────────────────────────────────────
// Ana export fonksiyonu
// ───────────────────────────────────────────────────────────────────
export async function sendToKalkulation(
  doc: DocState,
  params: KalkulationParams,
  dxfName = 'zeichnung.dxf',
): Promise<{ id: string; url: string }> {
  // Geometri çıkar
  const geo = extractGeometry(doc.entities);

  // DXF text → base64
  const dxfText   = entitiesToDXF(doc);
  const dxfBase64 = btoa(unescape(encodeURIComponent(dxfText)));

  const body = {
    token:         KALK_TOKEN,
    calc_type:     params.calcType,
    title:         params.title,
    customer_name: params.customerName,
    drawing_no:    params.drawingNo,
    batchQty:      params.batchQty,
    positions: [
      {
        label:      'Ronde',
        material:   resolveMaterial(params.material),
        shape:      geo.shape,
        width:      geo.width,
        height:     geo.height,
        thickness:  geo.thickness,
        qty:        params.qty,
        pricePerKg: params.pricePerKg,
      },
    ],
    dxf:     dxfBase64,
    dxfName: dxfName,
  };

  const resp = await fetch(KALK_ENDPOINT, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => resp.statusText);
    throw new Error(`Kalkulation API Fehler ${resp.status}: ${txt}`);
  }

  const result = await resp.json() as { id: string; url: string };
  if (!result.url) throw new Error('Kalkulation hat keine URL zurückgegeben');
  return result;
}
