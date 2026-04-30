import React, { useState } from 'react';
import { store, useStore } from '../state/useStore';
import { uid } from '../core/id';

const SWATCHES = ['#33d17a', '#33afe2', '#ffd166', '#e54b4b', '#9aa0b4', '#bb86fc', '#f57c00', '#26c6da'];

export const LayerPanel: React.FC = () => {
  const layers = useStore((s) => s.doc.layers);
  const active = useStore((s) => s.doc.activeLayerId);
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="bg-panel border-r border-line w-7 hover:bg-panel2 text-muted hover:text-brand text-[9px] tracking-widest"
        title="Ebenen anzeigen"
      >
        E<br/>B<br/>N
      </button>
    );
  }

  return (
    <aside className="bg-panel border-r border-line w-56 flex flex-col select-text">
      <div className="px-3 py-2 flex items-center justify-between border-b border-line">
        <div className="text-[10px] font-bold tracking-widest text-muted uppercase">Ebenen</div>
        <div className="flex gap-1">
          <button
            title="Ebene hinzufügen"
            onClick={() => store.addLayer({
              id: uid('L'),
              name: `Ebene ${layers.length}`,
              color: SWATCHES[layers.length % SWATCHES.length],
              visible: true,
              locked: false,
            })}
            className="text-brand hover:bg-panel2 px-1.5 rounded text-sm leading-none"
          >+</button>
          <button
            title="Panel ausblenden"
            onClick={() => setCollapsed(true)}
            className="text-muted hover:text-brand hover:bg-panel2 px-1.5 rounded text-sm leading-none"
          >‹</button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar">
        {layers.map((l) => (
          <div
            key={l.id}
            className={
              'flex items-center gap-1.5 px-2 py-1.5 border-b border-line text-[11px] cursor-pointer ' +
              (active === l.id ? 'bg-brand/10' : 'hover:bg-panel2')
            }
            onClick={() => store.setActiveLayer(l.id)}
          >
            <input
              type="color"
              value={l.color}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => store.updateLayer(l.id, { color: e.target.value })}
              className="w-5 h-5 rounded bg-transparent border border-line cursor-pointer"
              title="Ebenenfarbe"
            />
            <button
              onClick={(e) => { e.stopPropagation(); store.updateLayer(l.id, { visible: !l.visible }); }}
              title={l.visible ? 'Ausblenden' : 'Einblenden'}
              className={'text-xs px-1 ' + (l.visible ? 'text-ink' : 'text-muted')}
            >
              {l.visible ? '◉' : '○'}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); store.updateLayer(l.id, { locked: !l.locked }); }}
              title={l.locked ? 'Entsperren' : 'Sperren'}
              className={'text-xs px-1 ' + (l.locked ? 'text-yellow-400' : 'text-muted')}
            >
              {l.locked ? '⌧' : '⌗'}
            </button>
            <input
              value={l.name}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => store.updateLayer(l.id, { name: e.target.value })}
              className="flex-1 bg-transparent text-ink text-[11px] outline-none focus:bg-panel2 px-1 rounded min-w-0"
            />
            <button
              onClick={(e) => { e.stopPropagation(); if (confirm(`Ebene "${l.name}" und ihre Objekte löschen?`)) store.removeLayer(l.id); }}
              title="Ebene löschen"
              className="text-muted hover:text-red-400 text-xs px-1"
            >×</button>
          </div>
        ))}
      </div>
    </aside>
  );
};
