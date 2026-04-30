import React from 'react';
import { store, useStore } from '../state/useStore';
import { formatNumber } from '../core/math';
import type { SnapResult } from '../core/types';

interface StatusBarProps {
  cursorX: number;
  cursorY: number;
  zoom: number;
  snap: SnapResult | null;
}

const GRID_OPTIONS = [1, 2, 5, 10, 20, 50, 100];

export const StatusBar: React.FC<StatusBarProps> = ({ cursorX, cursorY, zoom, snap }) => {
  const ortho = useStore((s) => s.ui.ortho);
  const snapEnabled = useStore((s) => s.ui.snap);
  const showGrid = useStore((s) => s.ui.showGrid);
  const gridMinor = useStore((s) => s.ui.gridMinor);
  const layers = useStore((s) => s.doc.layers);
  const active = useStore((s) => s.doc.activeLayerId);
  const activeLayer = layers.find((l) => l.id === active);
  return (
    <div className="bg-panel border-t border-line px-3 py-1 flex items-center gap-3 text-[10px] tracking-wider text-muted h-7">
      <span>X <span className="text-ink">{formatNumber(cursorX, 2)}</span></span>
      <span>Y <span className="text-ink">{formatNumber(cursorY, 2)}</span></span>
      <span className="opacity-50">|</span>
      <span>ZOOM <span className="text-ink">{(zoom * 100).toFixed(0)}%</span></span>
      <span className="opacity-50">|</span>
      <Toggle on={ortho} onClick={() => store.setUI({ ortho: !ortho })}>ORTHO</Toggle>
      <Toggle on={snapEnabled} onClick={() => store.setUI({ snap: !snapEnabled })}>SNAP</Toggle>
      <Toggle on={showGrid} onClick={() => store.setUI({ showGrid: !showGrid })}>GRID</Toggle>
      <span className="opacity-50">|</span>
      <span>GRID
        <select
          value={gridMinor}
          onChange={(e) => store.setUI({ gridMinor: parseFloat(e.target.value) })}
          className="ml-1 bg-panel2 text-ink rounded border border-line px-1 py-0.5"
        >
          {GRID_OPTIONS.map((g) => <option key={g} value={g}>{g}mm</option>)}
        </select>
      </span>
      <span className="opacity-50">|</span>
      <span>LAYER <span style={{ color: activeLayer?.color }} className="font-bold">{activeLayer?.name}</span></span>
      {snap && (
        <span className="ml-auto text-brand uppercase">SNAP: {snap.type}</span>
      )}
    </div>
  );
};

const Toggle: React.FC<{ on: boolean; onClick: () => void; children: React.ReactNode }> = ({ on, onClick, children }) => (
  <button
    onClick={onClick}
    className={'px-1.5 py-0.5 rounded font-bold ' + (on ? 'bg-brand/20 text-brand' : 'text-muted hover:text-ink')}
  >
    {children}
  </button>
);
