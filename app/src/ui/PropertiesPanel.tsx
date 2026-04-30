import React, { useState } from 'react';
import { store, useStore } from '../state/useStore';
import type { Entity, Point } from '../core/types';
import { distance, formatNumber } from '../core/math';

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-center gap-2 px-3 py-1.5 border-b border-line">
    <div className="w-16 text-[10px] uppercase tracking-widest text-muted">{label}</div>
    <div className="flex-1 min-w-0">{children}</div>
  </div>
);

const NumInput: React.FC<{ value: number; onCommit: (v: number) => void; suffix?: string }> = ({
  value,
  onCommit,
  suffix,
}) => {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-1">
      <input
        className="bg-panel2 text-ink text-[11px] px-1.5 py-1 rounded border border-line focus:border-brand outline-none w-full"
        value={draft ?? formatNumber(value, 3)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const n = parseFloat(draft ?? '');
          if (isFinite(n)) onCommit(n);
          setDraft(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') {
            setDraft(null);
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
      {suffix ? <span className="text-[9px] text-muted">{suffix}</span> : null}
    </div>
  );
};

const PointInput: React.FC<{ label: string; p: Point; onCommit: (p: Point) => void }> = ({ label, p, onCommit }) => (
  <Row label={label}>
    <div className="flex gap-1">
      <NumInput value={p.x} onCommit={(x) => onCommit({ x, y: p.y })} suffix="x" />
      <NumInput value={p.y} onCommit={(y) => onCommit({ x: p.x, y })} suffix="y" />
    </div>
  </Row>
);

export const PropertiesPanel: React.FC = () => {
  const selectedIds = useStore((s) => s.ui.selectedIds);
  const entities = useStore((s) => s.doc.entities);
  const layers = useStore((s) => s.doc.layers);
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="bg-panel border-l border-line w-7 hover:bg-panel2 text-muted hover:text-brand text-[9px] tracking-widest"
        title="Show Properties"
      >
        P<br/>R<br/>O<br/>P
      </button>
    );
  }

  const selected = entities.filter((e) => selectedIds.includes(e.id));

  return (
    <aside className="bg-panel border-l border-line w-64 flex flex-col select-text">
      <div className="px-3 py-2 flex items-center justify-between border-b border-line">
        <div className="text-[10px] font-bold tracking-widest text-muted uppercase">Properties</div>
        <button
          onClick={() => setCollapsed(true)}
          className="text-muted hover:text-brand hover:bg-panel2 px-1.5 rounded text-sm leading-none"
        >›</button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar">
        {selected.length === 0 && (
          <div className="text-muted text-[10px] px-3 py-3 italic">
            No selection. Click an entity with the Select tool (V).
          </div>
        )}
        {selected.length === 1 && <SingleEntityProps entity={selected[0]} layers={layers} />}
        {selected.length > 1 && (
          <div className="text-muted text-[11px] px-3 py-3">{selected.length} entities selected</div>
        )}
      </div>
    </aside>
  );
};

const SingleEntityProps: React.FC<{
  entity: Entity;
  layers: { id: string; name: string }[];
}> = ({ entity, layers }) => {
  const update = (patch: Partial<Entity>) => store.updateEntity(entity.id, patch);

  return (
    <div>
      <Row label="Type">
        <span className="text-brand text-[11px] uppercase tracking-widest">{entity.type}</span>
      </Row>
      <Row label="Layer">
        <select
          value={entity.layerId}
          onChange={(e) => update({ layerId: e.target.value } as Partial<Entity>)}
          className="bg-panel2 text-ink text-[11px] px-1.5 py-1 rounded border border-line focus:border-brand outline-none w-full"
        >
          {layers.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      </Row>

      {(entity.type === 'line' || entity.type === 'rect' || entity.type === 'dimension') && (
        <>
          <PointInput label="A" p={entity.a} onCommit={(a) => update({ a } as any)} />
          <PointInput label="B" p={entity.b} onCommit={(b) => update({ b } as any)} />
          {entity.type === 'line' && (
            <Row label="Length">
              <span className="text-ink text-[11px]">{formatNumber(distance(entity.a, entity.b), 3)} mm</span>
            </Row>
          )}
          {entity.type === 'dimension' && (
            <Row label="Offset">
              <NumInput value={entity.offset} onCommit={(offset) => update({ offset } as any)} suffix="mm" />
            </Row>
          )}
        </>
      )}
      {entity.type === 'circle' && (
        <>
          <PointInput label="Center" p={entity.c} onCommit={(c) => update({ c } as any)} />
          <Row label="Radius">
            <NumInput value={entity.r} onCommit={(r) => update({ r } as any)} suffix="mm" />
          </Row>
        </>
      )}
      {entity.type === 'arc' && (
        <>
          <PointInput label="Center" p={entity.c} onCommit={(c) => update({ c } as any)} />
          <Row label="Radius">
            <NumInput value={entity.r} onCommit={(r) => update({ r } as any)} suffix="mm" />
          </Row>
          <Row label="Start ∠">
            <NumInput
              value={(entity.startAngle * 180) / Math.PI}
              onCommit={(deg) => update({ startAngle: (deg * Math.PI) / 180 } as any)}
              suffix="°"
            />
          </Row>
          <Row label="End ∠">
            <NumInput
              value={(entity.endAngle * 180) / Math.PI}
              onCommit={(deg) => update({ endAngle: (deg * Math.PI) / 180 } as any)}
              suffix="°"
            />
          </Row>
        </>
      )}
      {entity.type === 'ellipse' && (
        <>
          <PointInput label="Center" p={entity.c} onCommit={(c) => update({ c } as any)} />
          <Row label="Rx">
            <NumInput value={entity.rx} onCommit={(rx) => update({ rx } as any)} suffix="mm" />
          </Row>
          <Row label="Ry">
            <NumInput value={entity.ry} onCommit={(ry) => update({ ry } as any)} suffix="mm" />
          </Row>
          <Row label="Rotation">
            <NumInput
              value={(entity.rotation * 180) / Math.PI}
              onCommit={(deg) => update({ rotation: (deg * Math.PI) / 180 } as any)}
              suffix="°"
            />
          </Row>
        </>
      )}
      {entity.type === 'polyline' && (
        <Row label="Points"><span className="text-ink text-[11px]">{entity.points.length}</span></Row>
      )}
      {entity.type === 'text' && (
        <>
          <PointInput label="Pos" p={entity.pos} onCommit={(pos) => update({ pos } as any)} />
          <Row label="Text">
            <input
              value={entity.text}
              onChange={(e) => update({ text: e.target.value } as any)}
              className="bg-panel2 text-ink text-[11px] px-1.5 py-1 rounded border border-line focus:border-brand outline-none w-full"
            />
          </Row>
          <Row label="Height">
            <NumInput value={entity.height} onCommit={(height) => update({ height } as any)} suffix="mm" />
          </Row>
        </>
      )}
    </div>
  );
};
