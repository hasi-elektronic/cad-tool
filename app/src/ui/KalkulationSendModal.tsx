/**
 * KalkulationSendModal
 *
 * Zeichnung → Sickinger Kalkulations-System
 * POST https://sickinger-kalkulationssystem.pages.dev/api/import/cad
 *
 * Malzeme eşleme: CAD layer adları → Kalkulation material string'i
 * Shape çıkarma: circle entity → "rund" (width = Ø = r*2), rect/polyline → "eckig" (B×H bbox)
 */

import React, { useState, useCallback } from 'react';
import { store } from '../state/useStore';
import { entitiesToDXF } from '../io/dxf-export';
import type { Entity, CircleEntity, RectEntity } from '../core/types';

// ─── Sabitler ────────────────────────────────────────────────────────────────

const IMPORT_URL = 'https://sickinger-kalkulationssystem.pages.dev/api/import/cad';
const CAD_TOKEN  = 'cad_883064945860458e135defe1dd4c042976e5';

/** Kalkulation CalcType — sadece desteklenen 3 tür */
type CalcType = 'drueckteile' | 'laufrad' | 'baugruppe';

/** Kalkulation Materialliste adlarıyla örtüşen eşleme */
const MATERIAL_ALIASES: Record<string, string> = {
  // Rostfreie Stähle
  '1.4301': '1.4301',
  '1.4307': '1.4307',
  '1.4541': '1.4541',
  '1.4571': '1.4571',
  '1.4404': '1.4404',
  // Baustähle
  's235': 'S235',
  's355': 'S355',
  'st37': 'S235',
  'st52': 'S355',
  // Aluminium
  'alu': 'Al 1050',
  'aluminium': 'Al 1050',
  'al1050': 'Al 1050',
  'al5083': 'Al 5083',
  'al6082': 'Al 6082',
  // Kupfer / Messing
  'cu': 'Cu',
  'kupfer': 'Cu',
  'messing': 'CuZn37',
  // Titan
  'titan': 'Ti Grade 2',
  // Sonstige
  'pp': 'PP',
  'pe': 'PE',
};

function normalizeMaterial(raw: string): string {
  const key = raw.toLowerCase().replace(/[\s-]/g, '');
  return MATERIAL_ALIASES[key] ?? raw;
}

// ─── Geometrie-Auswertung ────────────────────────────────────────────────────

interface Position {
  label: string;
  material: string;
  shape: 'rund' | 'eckig';
  width: number;   // mm  (Ø bei rund, Breite bei eckig)
  height: number;  // mm  (ignoriert bei rund)
  thickness: number; // mm
  qty: number;
  pricePerKg: number;
}

/**
 * Tüm entity'lerden anlamlı pozisyonlar çıkart.
 *
 * Kural:
 *  - Circle  → rund,  width = Ø = r*2,  layer'dan material yaz
 *  - Rect    → eckig, width = |bx-ax|,  height = |by-ay|
 *  - Polyline (closed) → eckig, bbox
 *  Layer adı pattern: "ronde|blech|platte|scheibe" vs. tanımsız → fallback
 */
function extractPositions(entities: Entity[], layers: { id: string; name: string }[]): Position[] {
  const layerName = (id: string) => layers.find((l) => l.id === id)?.name ?? '0';
  const positions: Position[] = [];

  for (const e of entities) {
    const lname = layerName(e.layerId);
    const material = normalizeMaterial(lname !== '0' && lname !== 'Hilfslinien' && lname !== 'Bemaßungen' ? lname : '');

    if (e.type === 'circle') {
      const c = e as CircleEntity;
      positions.push({
        label: 'Ronde',
        material,
        shape: 'rund',
        width: Math.round(c.r * 2 * 100) / 100,  // Ø
        height: 0,
        thickness: 0,
        qty: 1,
        pricePerKg: 0,
      });
    } else if (e.type === 'rect') {
      const r = e as RectEntity;
      const w = Math.abs(r.b.x - r.a.x);
      const h = Math.abs(r.b.y - r.a.y);
      positions.push({
        label: 'Zuschnitt',
        material,
        shape: 'eckig',
        width: Math.round(w * 100) / 100,
        height: Math.round(h * 100) / 100,
        thickness: 0,
        qty: 1,
        pricePerKg: 0,
      });
    } else if (e.type === 'polyline' && (e as any).closed) {
      const pts = (e as any).points as { x: number; y: number }[];
      if (pts.length < 2) continue;
      const xs = pts.map((p) => p.x);
      const ys = pts.map((p) => p.y);
      const w = Math.max(...xs) - Math.min(...xs);
      const h = Math.max(...ys) - Math.min(...ys);
      positions.push({
        label: 'Zuschnitt',
        material,
        shape: 'eckig',
        width: Math.round(w * 100) / 100,
        height: Math.round(h * 100) / 100,
        thickness: 0,
        qty: 1,
        pricePerKg: 0,
      });
    }
  }

  return positions;
}

// ─── Stil sabitleri ──────────────────────────────────────────────────────────

const INPUT_CLS =
  'bg-[#1a1f2e] text-[#e2e8f0] text-[11px] px-2 py-1.5 rounded border border-[#2d3548] focus:border-[#33afe2] outline-none w-full';
const SELECT_CLS = INPUT_CLS;
const LABEL_CLS = 'text-[10px] uppercase tracking-widest text-[#6b7280]';

// ─── Bileşen ─────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
}

type State = 'idle' | 'sending' | 'success' | 'error';

export const KalkulationSendModal: React.FC<Props> = ({ onClose }) => {
  const state       = store.get();
  const entities    = state.doc.entities;
  const layers      = state.doc.layers;

  // Formular-Felder
  const [title,      setTitle]      = useState('');
  const [customer,   setCustomer]   = useState('');
  const [drawingNo,  setDrawingNo]  = useState('');
  const [calcType,   setCalcType]   = useState<CalcType>('drueckteile');
  const [batchQty,   setBatchQty]   = useState(1);
  const [thickness,  setThickness]  = useState(0);  // global Dicke-Hilfe

  const [sendState,  setSendState]  = useState<State>('idle');
  const [resultUrl,  setResultUrl]  = useState('');
  const [errorMsg,   setErrorMsg]   = useState('');

  // Positionen aus Zeichnung ableiten (memo-ähnlich, aber simpel)
  const rawPositions = extractPositions(entities, layers);

  // Lokale Overrides für jede Position (material, thickness, qty)
  const [overrides, setOverrides] = useState<Partial<Position>[]>(
    () => rawPositions.map(() => ({}))
  );

  const merged: Position[] = rawPositions.map((p, i) => ({
    ...p,
    ...overrides[i],
    // Globale Dicke als Fallback wenn positions.thickness == 0
    thickness: overrides[i]?.thickness ?? (p.thickness > 0 ? p.thickness : thickness),
  }));

  const setOverride = useCallback(<K extends keyof Position>(idx: number, key: K, val: Position[K]) => {
    setOverrides((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [key]: val };
      return next;
    });
  }, []);

  // ─── Senden ──────────────────────────────────────────────────────────────

  const handleSend = async () => {
    if (merged.length === 0) {
      setErrorMsg('Die Zeichnung enthält keine auswertbaren Formen (Kreis, Rechteck, geschl. Polylinie).');
      setSendState('error');
      return;
    }

    setSendState('sending');
    setErrorMsg('');

    try {
      // DXF als Base64
      const dxfText   = entitiesToDXF(state.doc);
      const dxfBase64 = btoa(unescape(encodeURIComponent(dxfText)));

      const body = {
        token: CAD_TOKEN,
        calc_type: calcType,
        title: title.trim() || 'Hasi CAD Import',
        customer_name: customer.trim(),
        drawing_no: drawingNo.trim(),
        batchQty,
        positions: merged.map((p) => ({
          label:      p.label,
          material:   p.material || '1.4301',
          shape:      p.shape,
          width:      p.width,
          height:     p.height,
          thickness:  p.thickness,
          qty:        p.qty,
          pricePerKg: p.pricePerKg,
        })),
        dxf:     dxfBase64,
        dxfName: (title.trim() || 'hasi-cad').replace(/\s+/g, '-').toLowerCase() + '.dxf',
      };

      const res = await fetch(IMPORT_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });

      const json = await res.json() as { id?: number; url?: string; error?: string };

      if (!res.ok || json.error) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }

      setResultUrl(json.url ?? '');
      setSendState('success');
    } catch (err) {
      setErrorMsg((err as Error).message);
      setSendState('error');
    }
  };

  const openResult = () => {
    if (resultUrl) window.open(resultUrl, '_blank', 'noopener');
    onClose();
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    /* Overlay */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(10,14,23,0.82)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="flex flex-col rounded-xl border border-[#2d3548] shadow-2xl"
        style={{
          background: '#111827',
          width: 'min(680px, 96vw)',
          maxHeight: '90vh',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1e2636]">
          <div>
            <div className="text-[#33afe2] font-bold text-sm tracking-wider">AN KALKULATION SENDEN</div>
            <div className="text-[#6b7280] text-[10px] mt-0.5">Zeichnung → Sickinger Kalkulationssystem</div>
          </div>
          <button onClick={onClose} className="text-[#4b5563] hover:text-[#e2e8f0] text-xl leading-none px-1">×</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* ── Allgemein ── */}
          <section>
            <div className={`${LABEL_CLS} mb-2.5`}>Allgemein</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className={`${LABEL_CLS} mb-1`}>Bezeichnung</div>
                <input value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder="z. B. Ronde 500 mm" className={INPUT_CLS} />
              </div>
              <div>
                <div className={`${LABEL_CLS} mb-1`}>Kalkulations-Typ</div>
                <select value={calcType} onChange={(e) => setCalcType(e.target.value as CalcType)} className={SELECT_CLS}>
                  <option value="drueckteile">Drückteile</option>
                  <option value="laufrad">Laufrad</option>
                  <option value="baugruppe">Baugruppe</option>
                </select>
              </div>
              <div>
                <div className={`${LABEL_CLS} mb-1`}>Kunde</div>
                <input value={customer} onChange={(e) => setCustomer(e.target.value)}
                  placeholder="Kundenname" className={INPUT_CLS} />
              </div>
              <div>
                <div className={`${LABEL_CLS} mb-1`}>Zeichnungsnr.</div>
                <input value={drawingNo} onChange={(e) => setDrawingNo(e.target.value)}
                  placeholder="ZN-2026-001" className={INPUT_CLS} />
              </div>
              <div>
                <div className={`${LABEL_CLS} mb-1`}>Losgröße</div>
                <input type="number" min={1} value={batchQty}
                  onChange={(e) => setBatchQty(Math.max(1, parseInt(e.target.value) || 1))}
                  className={INPUT_CLS} />
              </div>
              <div>
                <div className={`${LABEL_CLS} mb-1`}>Dicke (global, mm)</div>
                <input type="number" min={0} step={0.1} value={thickness}
                  onChange={(e) => setThickness(parseFloat(e.target.value) || 0)}
                  placeholder="z. B. 5"
                  className={INPUT_CLS} />
              </div>
            </div>
          </section>

          {/* ── Positionen ── */}
          <section>
            <div className={`${LABEL_CLS} mb-2.5`}>
              Erkannte Positionen ({rawPositions.length})
            </div>
            {rawPositions.length === 0 ? (
              <div className="text-[#6b7280] text-[11px] italic py-2">
                Keine Kreise, Rechtecke oder geschlossenen Polylinien in der Zeichnung gefunden.
              </div>
            ) : (
              <div className="space-y-2.5">
                {rawPositions.map((p, i) => {
                  const m = merged[i];
                  return (
                    <div key={i} className="rounded-lg border border-[#1e2636] bg-[#0f1623] px-3 py-2.5">
                      {/* Kopfzeile */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1e2636] text-[#33afe2] font-mono">
                          {i + 1}
                        </span>
                        <span className="text-[11px] text-[#e2e8f0] font-semibold">
                          {p.shape === 'rund' ? `⊙ Ø ${p.width} mm` : `▭ ${p.width} × ${p.height} mm`}
                        </span>
                        <span className="text-[10px] text-[#6b7280] ml-auto">Layer: {
                          layers.find((l) => l.id === p.label) ? '' :
                          (entities.find((_e, _j) => _j === i) as any)?.layerId
                        }</span>
                      </div>
                      {/* Felder */}
                      <div className="grid grid-cols-4 gap-2">
                        <div>
                          <div className={`${LABEL_CLS} mb-1`}>Bezeichnung</div>
                          <input value={overrides[i]?.label ?? p.label}
                            onChange={(e) => setOverride(i, 'label', e.target.value)}
                            className={INPUT_CLS} />
                        </div>
                        <div>
                          <div className={`${LABEL_CLS} mb-1`}>Material</div>
                          <input value={overrides[i]?.material ?? p.material}
                            onChange={(e) => setOverride(i, 'material', e.target.value)}
                            placeholder="1.4301"
                            className={INPUT_CLS} />
                        </div>
                        <div>
                          <div className={`${LABEL_CLS} mb-1`}>Dicke mm</div>
                          <input type="number" min={0} step={0.1}
                            value={overrides[i]?.thickness ?? (p.thickness > 0 ? p.thickness : thickness)}
                            onChange={(e) => setOverride(i, 'thickness', parseFloat(e.target.value) || 0)}
                            className={INPUT_CLS} />
                        </div>
                        <div>
                          <div className={`${LABEL_CLS} mb-1`}>Menge</div>
                          <input type="number" min={1}
                            value={overrides[i]?.qty ?? p.qty}
                            onChange={(e) => setOverride(i, 'qty', parseInt(e.target.value) || 1)}
                            className={INPUT_CLS} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ── Ergebnis / Fehler ── */}
          {sendState === 'error' && (
            <div className="rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-red-300 text-[11px]">
              ⚠ {errorMsg}
            </div>
          )}
          {sendState === 'success' && (
            <div className="rounded-lg border border-green-900 bg-green-950/40 px-4 py-3 text-green-300 text-[11px]">
              ✓ Kalkulation erfolgreich angelegt — Kalkulation wird geöffnet…
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-[#1e2636]">
          <button onClick={onClose}
            className="text-[11px] text-[#6b7280] hover:text-[#e2e8f0] px-3 py-1.5 rounded-md">
            Abbrechen
          </button>
          {sendState === 'success' ? (
            <button onClick={openResult}
              className="text-[11px] font-bold bg-green-700 hover:bg-green-600 text-white px-4 py-1.5 rounded-md tracking-wider">
              KALKULATION ÖFFNEN ↗
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={sendState === 'sending'}
              className={
                'text-[11px] font-bold px-4 py-1.5 rounded-md tracking-wider transition ' +
                (sendState === 'sending'
                  ? 'bg-[#1a2535] text-[#6b7280] cursor-not-allowed'
                  : 'bg-[#33afe2] hover:bg-[#5dc1ec] text-white')
              }
            >
              {sendState === 'sending' ? '⟳ WIRD GESENDET…' : 'AN KALKULATION SENDEN ↗'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
