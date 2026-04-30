import React from 'react';

interface Props {
  onClose: () => void;
}

const ROWS: [string, string][] = [
  ['L', 'Line'],
  ['C', 'Circle'],
  ['R', 'Rectangle'],
  ['A', 'Arc (3-point)'],
  ['P', 'Polyline'],
  ['D', 'Dimension'],
  ['E', 'Ellipse'],
  ['V', 'Select'],
  ['F', 'Fillet (also: Zoom Fit when nothing in progress)'],
  ['T', 'Trim'],
  ['G', 'Toggle grid'],
  ['S', 'Toggle snap'],
  ['O', 'Toggle ortho'],
  ['Del', 'Delete selected'],
  ['Ctrl+Z / Ctrl+Y', 'Undo / Redo'],
  ['Ctrl+S', 'Save (DXF export)'],
  ['ESC', 'Cancel current operation'],
  ['Enter', 'Finish polyline / submit value'],
  ['Space', 'Repeat last command'],
  ['?', 'This help'],
  ['Mouse wheel', 'Zoom (towards cursor)'],
  ['Middle drag / Alt + drag', 'Pan'],
];

const PROMPTS: [string, string][] = [
  ['100,50', 'Absolute point at (100, 50)'],
  ['@30,0', 'Relative point: 30 right of last'],
  ['25', 'During Circle/Offset/Fillet: numeric distance'],
  ['line', 'Switch to a tool by name'],
  ['undo / redo', 'History'],
  ['fit', 'Zoom to fit drawing'],
];

export const HelpOverlay: React.FC<Props> = ({ onClose }) => (
  <div
    onClick={onClose}
    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6"
  >
    <div
      onClick={(e) => e.stopPropagation()}
      className="bg-panel border border-line rounded-lg max-w-2xl w-full max-h-[85vh] overflow-y-auto scrollbar shadow-2xl"
    >
      <div className="px-5 py-4 border-b border-line flex items-center justify-between">
        <div>
          <div className="text-brand text-base font-bold tracking-widest">HASI CAD</div>
          <div className="text-muted text-[10px] tracking-widest uppercase">Keyboard Reference</div>
        </div>
        <button
          onClick={onClose}
          className="text-muted hover:text-brand text-2xl leading-none"
        >×</button>
      </div>
      <div className="grid grid-cols-2 gap-x-6 px-5 py-4">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted mb-2">Shortcuts</div>
          {ROWS.map(([k, v]) => (
            <div key={k} className="flex items-center gap-3 py-1 border-b border-line/50">
              <span className="text-brand font-bold text-[11px] w-32">{k}</span>
              <span className="text-ink text-[11px]">{v}</span>
            </div>
          ))}
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted mb-2">Command line examples</div>
          {PROMPTS.map(([k, v]) => (
            <div key={k} className="flex items-center gap-3 py-1 border-b border-line/50">
              <span className="text-brand font-bold text-[11px] w-32">{k}</span>
              <span className="text-ink text-[11px]">{v}</span>
            </div>
          ))}
          <div className="mt-4 text-muted text-[10px] leading-relaxed">
            Snap priority: endpoint &gt; midpoint/quadrant &gt; center &gt; intersection &gt; grid.
            Yellow square = endpoint, triangle = midpoint, circle = center, ✕ = intersection.
          </div>
        </div>
      </div>
    </div>
  </div>
);
