import React, { useState } from 'react';
import type { KalkulationParams } from '../io/kalkulation-export';

interface Props {
  onConfirm: (p: KalkulationParams) => void;
  onCancel:  () => void;
  /** Aktif layer adından ilk malzeme önerisi */
  suggestedMaterial?: string;
}

const CALC_TYPES = [
  { id: 'drueckteile' as const, label: 'Drückteile' },
  { id: 'laufrad'    as const, label: 'Laufrad'    },
  { id: 'baugruppe'  as const, label: 'Baugruppe'  },
];

export const KalkulationDialog: React.FC<Props> = ({
  onConfirm,
  onCancel,
  suggestedMaterial = '',
}) => {
  const [calcType, setCalcType]     = useState<KalkulationParams['calcType']>('drueckteile');
  const [title, setTitle]           = useState('');
  const [customerName, setCustomer] = useState('');
  const [drawingNo, setDrawingNo]   = useState('');
  const [batchQty, setBatchQty]     = useState(1);
  const [material, setMaterial]     = useState(suggestedMaterial || '1.4301');
  const [pricePerKg, setPrice]      = useState(0);
  const [qty, setQty]               = useState(1);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onConfirm({ calcType, title, customerName, drawingNo, batchQty, material, pricePerKg, qty });
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.65)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <form
        onSubmit={handleSubmit}
        className="bg-panel border border-line rounded-xl shadow-2xl w-[420px] max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-line">
          <div>
            <div className="text-brand font-bold text-sm tracking-wider">AN KALKULATION SENDEN</div>
            <div className="text-muted text-[10px] mt-0.5">Sickinger Kalkulationssystem</div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-muted hover:text-brand px-2 py-1 rounded text-lg leading-none"
          >✕</button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          {/* Kalk-Typ */}
          <Field label="Kalkulationstyp *">
            <select
              value={calcType}
              onChange={(e) => setCalcType(e.target.value as KalkulationParams['calcType'])}
              className={inputCls}
            >
              {CALC_TYPES.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </Field>

          {/* Titel */}
          <Field label="Titel / Teilename *">
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="z.B. Ronde Ø350 t5"
              className={inputCls}
            />
          </Field>

          {/* Kunde + Zeichnungsnummer */}
          <div className="grid grid-cols-2 gap-2">
            <Field label="Kunde">
              <input
                value={customerName}
                onChange={(e) => setCustomer(e.target.value)}
                placeholder="optional"
                className={inputCls}
              />
            </Field>
            <Field label="Zeich.-Nr.">
              <input
                value={drawingNo}
                onChange={(e) => setDrawingNo(e.target.value)}
                placeholder="optional"
                className={inputCls}
              />
            </Field>
          </div>

          {/* Losgröße + Stück */}
          <div className="grid grid-cols-2 gap-2">
            <Field label="Losgröße">
              <input
                type="number" min={1}
                value={batchQty}
                onChange={(e) => setBatchQty(Math.max(1, parseInt(e.target.value) || 1))}
                className={inputCls}
              />
            </Field>
            <Field label="Stück (Pos.)">
              <input
                type="number" min={1}
                value={qty}
                onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                className={inputCls}
              />
            </Field>
          </div>

          {/* Material */}
          <Field label="Material">
            <input
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              placeholder="z.B. 1.4301 / S235JR / AlMg3"
              className={inputCls}
            />
            <span className="text-[9px] text-muted mt-0.5 block">
              Wird automatisch auf Materialliste gemappt
            </span>
          </Field>

          {/* Preis/kg */}
          <Field label="Preis/kg (€, optional)">
            <input
              type="number" min={0} step="0.01"
              value={pricePerKg}
              onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
              className={inputCls}
            />
          </Field>

          {/* Info-Box */}
          <div className="bg-brand/10 border border-brand/30 rounded-lg px-3 py-2 text-[10px] text-muted leading-relaxed">
            ℹ️ Geometrie (Ø / B×H / Dicke) wird automatisch aus der Zeichnung gelesen.
            DXF wird als Anhang mitgeschickt.
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-3 border-t border-line justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="text-[11px] font-bold px-4 py-1.5 rounded-md text-ink hover:bg-panel2 bg-panel border border-line"
          >
            Abbrechen
          </button>
          <button
            type="submit"
            className="text-[11px] font-bold px-4 py-1.5 rounded-md bg-brand text-white hover:bg-brand/80"
          >
            Senden →
          </button>
        </div>
      </form>
    </div>
  );
};

const inputCls =
  'bg-panel2 text-ink text-[11px] px-2 py-1.5 rounded border border-line focus:border-brand outline-none w-full';

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block text-[9px] uppercase tracking-widest text-muted mb-1">{label}</label>
    {children}
  </div>
);
