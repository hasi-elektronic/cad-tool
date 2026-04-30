import React from 'react';
import { store, useStore } from '../state/useStore';
import type { ToolId } from '../core/types';

interface ToolButtonSpec {
  id: ToolId;
  label: string;
  short: string;
  icon: React.ReactNode;
  group: 'draw' | 'edit';
}

const SQ = 'inline-block align-middle';

const TOOLS: ToolButtonSpec[] = [
  { id: 'select', label: 'Select', short: 'V', group: 'edit', icon: (
    <svg viewBox="0 0 24 24" width="18" height="18" className={SQ}>
      <path fill="currentColor" d="M5 3l14 9-7 1 4 8-3 1-4-8-4 5z" />
    </svg>
  ) },
  { id: 'line', label: 'Line', short: 'L', group: 'draw', icon: (
    <svg viewBox="0 0 24 24" width="18" height="18" className={SQ}>
      <path stroke="currentColor" strokeWidth="2" d="M4 20L20 4" />
    </svg>
  ) },
  { id: 'polyline', label: 'Polyline', short: 'P', group: 'draw', icon: (
    <svg viewBox="0 0 24 24" width="18" height="18" className={SQ}>
      <path stroke="currentColor" strokeWidth="2" fill="none" d="M3 18 L8 7 L13 14 L21 5" />
    </svg>
  ) },
  { id: 'rect', label: 'Rectangle', short: 'R', group: 'draw', icon: (
    <svg viewBox="0 0 24 24" width="18" height="18" className={SQ}>
      <rect x="4" y="6" width="16" height="12" stroke="currentColor" strokeWidth="2" fill="none" />
    </svg>
  ) },
  { id: 'circle', label: 'Circle', short: 'C', group: 'draw', icon: (
    <svg viewBox="0 0 24 24" width="18" height="18" className={SQ}>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" fill="none" />
    </svg>
  ) },
  { id: 'arc', label: 'Arc', short: 'A', group: 'draw', icon: (
    <svg viewBox="0 0 24 24" width="18" height="18" className={SQ}>
      <path stroke="currentColor" strokeWidth="2" fill="none" d="M4 18 A10 10 0 0 1 20 18" />
    </svg>
  ) },
  { id: 'ellipse', label: 'Ellipse', short: 'E', group: 'draw', icon: (
    <svg viewBox="0 0 24 24" width="18" height="18" className={SQ}>
      <ellipse cx="12" cy="12" rx="9" ry="5" stroke="currentColor" strokeWidth="2" fill="none" />
    </svg>
  ) },
  { id: 'dimension', label: 'Dimension', short: 'D', group: 'draw', icon: (
    <svg viewBox="0 0 24 24" width="18" height="18" className={SQ}>
      <path stroke="currentColor" strokeWidth="2" fill="none" d="M3 8v8M21 8v8M3 12h18" />
    </svg>
  ) },
  { id: 'fillet', label: 'Fillet', short: 'F', group: 'edit', icon: (
    <svg viewBox="0 0 24 24" width="18" height="18" className={SQ}>
      <path stroke="currentColor" strokeWidth="2" fill="none" d="M4 20V12 A8 8 0 0 1 12 4 H20" />
    </svg>
  ) },
  { id: 'trim', label: 'Trim', short: 'T', group: 'edit', icon: (
    <svg viewBox="0 0 24 24" width="18" height="18" className={SQ}>
      <path stroke="currentColor" strokeWidth="2" fill="none" d="M3 12h7m4 0h7M14 6l4 6-4 6" />
    </svg>
  ) },
  { id: 'offset', label: 'Offset', short: 'O*', group: 'edit', icon: (
    <svg viewBox="0 0 24 24" width="18" height="18" className={SQ}>
      <path stroke="currentColor" strokeWidth="2" fill="none" d="M5 5h10v14H5zM18 8h2v8h-2z" />
    </svg>
  ) },
  { id: 'mirror', label: 'Mirror', short: 'Mi', group: 'edit', icon: (
    <svg viewBox="0 0 24 24" width="18" height="18" className={SQ}>
      <path stroke="currentColor" strokeWidth="2" fill="none" d="M12 3v18M5 7l4 5-4 5M19 7l-4 5 4 5" />
    </svg>
  ) },
  { id: 'copy', label: 'Copy', short: 'Cp', group: 'edit', icon: (
    <svg viewBox="0 0 24 24" width="18" height="18" className={SQ}>
      <rect x="8" y="8" width="12" height="12" stroke="currentColor" strokeWidth="2" fill="none" />
      <rect x="4" y="4" width="12" height="12" stroke="currentColor" strokeWidth="2" fill="none" />
    </svg>
  ) },
  { id: 'move', label: 'Move', short: 'Mv', group: 'edit', icon: (
    <svg viewBox="0 0 24 24" width="18" height="18" className={SQ}>
      <path stroke="currentColor" strokeWidth="2" fill="none" d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3 3M3 12l3-3M21 12l-3 3M21 12l-3-3" />
    </svg>
  ) },
];

interface ToolbarProps {
  onZoomFit: () => void;
  onExport: () => void;
  onImport: () => void;
  onHelp: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ onZoomFit, onExport, onImport, onHelp }) => {
  const tool = useStore((s) => s.ui.tool);
  return (
    <div className="flex items-center gap-1 bg-panel border-b border-line px-2 py-1.5">
      <div className="flex items-center gap-2 pr-3 border-r border-line mr-2">
        <div className="text-brand font-bold text-sm tracking-wider">HASI CAD</div>
        <div className="text-muted text-[9px] uppercase tracking-widest">2D Drafting</div>
      </div>
      {TOOLS.map((t) => (
        <button
          key={t.id}
          title={`${t.label} (${t.short})`}
          onClick={() => store.setTool(t.id)}
          className={
            'flex flex-col items-center justify-center gap-0.5 w-12 h-11 rounded-md transition ' +
            (tool === t.id
              ? 'bg-brand/20 text-brand glow'
              : 'text-ink hover:bg-panel2 hover:text-brand')
          }
        >
          {t.icon}
          <span className="text-[9px] tracking-wider opacity-70">{t.short}</span>
        </button>
      ))}
      <div className="ml-auto flex items-center gap-1 pl-3 border-l border-line">
        <SmallBtn onClick={onZoomFit} title="Zoom to Fit (F)">FIT</SmallBtn>
        <SmallBtn onClick={onImport} title="Import DXF">IMPORT</SmallBtn>
        <SmallBtn onClick={onExport} title="Export DXF (Ctrl+S)">EXPORT</SmallBtn>
        <SmallBtn onClick={onHelp} title="Help (?)">?</SmallBtn>
      </div>
    </div>
  );
};

const SmallBtn: React.FC<{
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}> = ({ onClick, title, children }) => (
  <button
    onClick={onClick}
    title={title}
    className="text-[10px] font-bold text-ink hover:text-brand bg-panel2 hover:bg-brand/10 px-2.5 py-1.5 rounded-md tracking-wider"
  >
    {children}
  </button>
);
