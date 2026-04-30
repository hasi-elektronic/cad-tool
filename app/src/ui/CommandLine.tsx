import React, { useEffect, useRef, useState } from 'react';
import type { CommandAPI } from './Canvas';

interface CommandLineProps {
  api: CommandAPI | null;
  hint: string;
  onCommand: (raw: string) => void;
}

export const CommandLine: React.FC<CommandLineProps> = ({ api, hint, onCommand }) => {
  const [val, setVal] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [hi, setHi] = useState<number>(-1);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Focus the command line when the user starts typing (and isn't in another input).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.length === 1 && /[0-9.\-@,a-zA-Z]/.test(e.key)) {
        inputRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function submit() {
    const v = val.trim();
    if (!v) return;
    setHistory((h) => [...h, v]);
    setHi(-1);
    setVal('');
    // First, check whether it's a command alias for a tool/action.
    if (!handleAsCommand(v, onCommand) && api) {
      api.submitValue(v);
    }
  }

  return (
    <div className="bg-canvas border-t border-line px-3 py-1.5 flex items-center gap-2 h-9">
      <span className="text-brand text-[11px] tracking-widest font-bold">CMD</span>
      <span className="text-muted text-[10px] truncate max-w-[40%]">{hint}</span>
      <span className="text-muted text-[10px]">›</span>
      <input
        ref={inputRef}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submit();
          } else if (e.key === 'Escape') {
            (e.target as HTMLInputElement).blur();
            api?.cancel();
            setVal('');
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (history.length === 0) return;
            const next = hi === -1 ? history.length - 1 : Math.max(0, hi - 1);
            setHi(next);
            setVal(history[next]);
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (hi === -1) return;
            const next = hi + 1;
            if (next >= history.length) {
              setHi(-1);
              setVal('');
            } else {
              setHi(next);
              setVal(history[next]);
            }
          }
        }}
        placeholder="x,y  or  @dx,dy  or  distance  or  command (line, circle, ...)"
        className="flex-1 bg-transparent text-ink font-mono text-[12px] outline-none"
      />
    </div>
  );
};

function handleAsCommand(v: string, onCommand: (raw: string) => void): boolean {
  const aliases: Record<string, string> = {
    line: 'tool:line',
    l: 'tool:line',
    circle: 'tool:circle',
    c: 'tool:circle',
    rect: 'tool:rect',
    rectangle: 'tool:rect',
    r: 'tool:rect',
    arc: 'tool:arc',
    a: 'tool:arc',
    polyline: 'tool:polyline',
    pline: 'tool:polyline',
    p: 'tool:polyline',
    dim: 'tool:dimension',
    dimension: 'tool:dimension',
    dimaligned: 'tool:dimension',
    d: 'tool:dimension',
    dimh: 'tool:dim_horizontal',
    dimhor: 'tool:dim_horizontal',
    dimhorizontal: 'tool:dim_horizontal',
    horizontaldim: 'tool:dim_horizontal',
    dimv: 'tool:dim_vertical',
    dimver: 'tool:dim_vertical',
    dimvertical: 'tool:dim_vertical',
    verticaldim: 'tool:dim_vertical',
    dimr: 'tool:dim_radius',
    dimrad: 'tool:dim_radius',
    dimradius: 'tool:dim_radius',
    radius: 'tool:dim_radius',
    dimd: 'tool:dim_diameter',
    dimdia: 'tool:dim_diameter',
    dimdiameter: 'tool:dim_diameter',
    diameter: 'tool:dim_diameter',
    dima: 'tool:dim_angular',
    dimang: 'tool:dim_angular',
    dimangular: 'tool:dim_angular',
    angular: 'tool:dim_angular',
    select: 'tool:select',
    v: 'tool:select',
    move: 'tool:move',
    copy: 'tool:copy',
    mirror: 'tool:mirror',
    offset: 'tool:offset',
    fillet: 'tool:fillet',
    trim: 'tool:trim',
    ellipse: 'tool:ellipse',
    e: 'tool:ellipse',
    save: 'export',
    export: 'export',
    import: 'import',
    undo: 'undo',
    u: 'undo',
    redo: 'redo',
    fit: 'fit',
    zf: 'fit',
    help: 'help',
    '?': 'help',
  };
  const cmd = aliases[v.toLowerCase()];
  if (cmd) {
    onCommand(cmd);
    return true;
  }
  return false;
}
