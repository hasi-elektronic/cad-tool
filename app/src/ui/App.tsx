import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Canvas, type CommandAPI } from './Canvas';
import { Toolbar } from './Toolbar';
import { LayerPanel } from './LayerPanel';
import { PropertiesPanel } from './PropertiesPanel';
import { StatusBar } from './StatusBar';
import { CommandLine } from './CommandLine';
import { HelpOverlay } from './HelpOverlay';
import { KalkulationDialog } from './KalkulationDialog';
import { store, useStore } from '../state/useStore';
import type { SnapResult, ToolId } from '../core/types';
import { downloadDXF } from '../io/dxf-export';
import { importDXFFromFile } from '../io/dxf-import';
import { sendToKalkulation, type KalkulationParams } from '../io/kalkulation-export';

export const App: React.FC = () => {
  const apiRef = useRef<CommandAPI | null>(null);
  const [hint, setHint] = useState<string>('');
  const [zoom, setZoom] = useState(4);
  const [cursor, setCursor] = useState<{ x: number; y: number; snap: SnapResult | null }>({
    x: 0,
    y: 0,
    snap: null,
  });
  const showHelp = useStore((s) => s.ui.showHelp);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Kalkulation dialog state
  const [showKalkDialog, setShowKalkDialog] = useState(false);
  const [kalkLoading,    setKalkLoading]    = useState(false);

  // OS file-association handler
  useEffect(() => {
    interface LaunchParams { files?: FileSystemFileHandle[] }
    const lq = (window as unknown as {
      launchQueue?: {
        setConsumer: (cb: (p: LaunchParams) => void | Promise<void>) => void;
      };
    }).launchQueue;
    if (!lq) return;
    lq.setConsumer(async (params) => {
      if (!params.files || params.files.length === 0) return;
      try {
        for (const handle of params.files) {
          const file = await handle.getFile();
          const result = await importDXFFromFile(file);
          const existing = new Set(store.get().doc.layers.map((l) => l.name));
          for (const layer of result.layers) {
            if (!existing.has(layer.name)) store.addLayer(layer);
          }
          store.addEntities(result.entities);
        }
        apiRef.current?.zoomFit();
      } catch (err) {
        alert('DXF konnte nicht gelesen werden: ' + (err as Error).message);
      }
    });
  }, []);

  const registerCommand = useCallback((api: CommandAPI) => {
    apiRef.current = api;
  }, []);

  const onCommand = useCallback((cmd: string) => {
    if (cmd.startsWith('tool:')) {
      const id = cmd.slice(5) as ToolId;
      store.setTool(id);
    } else if (cmd === 'export') {
      const name = prompt('Dateiname:', 'hasi-cad-zeichnung.dxf') ?? 'hasi-cad-zeichnung.dxf';
      downloadDXF(store.get().doc, name);
    } else if (cmd === 'import') {
      fileInputRef.current?.click();
    } else if (cmd === 'kalkulation') {
      setShowKalkDialog(true);
    } else if (cmd === 'undo') store.undo();
    else if (cmd === 'redo') store.redo();
    else if (cmd === 'fit') apiRef.current?.zoomFit();
    else if (cmd === 'help') store.setUI({ showHelp: true });
  }, []);

  // Kalkulation senden
  const handleKalkulationConfirm = useCallback(async (params: KalkulationParams) => {
    setShowKalkDialog(false);
    setKalkLoading(true);
    try {
      const doc = store.get().doc;
      if (doc.entities.length === 0) {
        alert('Zeichnung ist leer. Bitte zuerst zeichnen.');
        return;
      }
      const title = params.title || 'cad-export';
      const dxfName = `${title.replace(/[^a-z0-9_-]/gi, '_')}.dxf`;
      const result = await sendToKalkulation(doc, params, dxfName);
      window.open(result.url, '_blank');
    } catch (err) {
      alert('Fehler beim Senden:\n' + (err as Error).message);
    } finally {
      setKalkLoading(false);
    }
  }, []);

  // Global keyboard bindings.
  useEffect(() => {
    function isTyping() {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (isTyping()) return;
        if (store.get().ui.showHelp) {
          store.setUI({ showHelp: false });
        } else if (showKalkDialog) {
          setShowKalkDialog(false);
        } else {
          apiRef.current?.cancel();
        }
        return;
      }
      if (e.key === '?' && !isTyping()) {
        store.setUI({ showHelp: true });
        return;
      }

      const meta = e.ctrlKey || e.metaKey;
      if (meta) {
        if (e.key.toLowerCase() === 'z') {
          e.preventDefault();
          if (e.shiftKey) store.redo();
          else store.undo();
          return;
        }
        if (e.key.toLowerCase() === 'y') {
          e.preventDefault();
          store.redo();
          return;
        }
        if (e.key.toLowerCase() === 's') {
          e.preventDefault();
          downloadDXF(store.get().doc);
          return;
        }
        // Ctrl+K → Kalkulation
        if (e.key.toLowerCase() === 'k') {
          e.preventDefault();
          setShowKalkDialog(true);
          return;
        }
        return;
      }

      if (isTyping()) return;

      const map: Record<string, () => void> = {
        l: () => setTool('line'),
        c: () => setTool('circle'),
        r: () => setTool('rect'),
        a: () => setTool('arc'),
        p: () => setTool('polyline'),
        d: () => setTool('dimension'),
        v: () => setTool('select'),
        e: () => setTool('ellipse'),
        t: () => setTool('trim'),
        m: () => setTool('move'),
        f: () => {
          const sel = store.get().ui.selectedIds.length > 0;
          if (sel) setTool('fillet');
          else apiRef.current?.zoomFit();
        },
        g: () => store.setUI({ showGrid: !store.get().ui.showGrid }),
        s: () => store.setUI({ snap: !store.get().ui.snap }),
        o: () => store.setUI({ ortho: !store.get().ui.ortho }),
      };

      if (e.key === ' ') {
        e.preventDefault();
        store.setTool(store.get().ui.tool);
        return;
      }
      if (e.key === 'Enter') {
        apiRef.current?.commit();
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        store.deleteEntities(store.get().ui.selectedIds);
        return;
      }
      const k = e.key.toLowerCase();
      const fn = map[k];
      if (fn) {
        e.preventDefault();
        fn();
      }
    }
    function setTool(id: ToolId) {
      store.setTool(id);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showKalkDialog]);

  // Active layer adını malzeme önerisi olarak geç
  const activeLayerName = useStore((s) => {
    const doc = s.doc;
    return doc.layers.find((l) => l.id === doc.activeLayerId)?.name ?? '';
  });

  return (
    <div className="h-screen w-screen flex flex-col bg-canvas">
      <Toolbar
        onZoomFit={() => apiRef.current?.zoomFit()}
        onExport={() => onCommand('export')}
        onImport={() => fileInputRef.current?.click()}
        onHelp={() => store.setUI({ showHelp: true })}
        onKalkulation={() => setShowKalkDialog(true)}
        kalkulationLoading={kalkLoading}
      />
      <div className="flex-1 flex min-h-0">
        <LayerPanel />
        <main className="flex-1 min-w-0 flex flex-col">
          <div className="flex-1 min-h-0 relative">
            <Canvas
              registerCommand={registerCommand}
              onStatus={setCursor}
              onHint={setHint}
              onZoom={setZoom}
            />
          </div>
          <CommandLine api={apiRef.current} hint={hint} onCommand={onCommand} />
          <StatusBar cursorX={cursor.x} cursorY={cursor.y} zoom={zoom} snap={cursor.snap} />
        </main>
        <PropertiesPanel />
      </div>
      {showHelp && <HelpOverlay onClose={() => store.setUI({ showHelp: false })} />}
      {showKalkDialog && (
        <KalkulationDialog
          onConfirm={handleKalkulationConfirm}
          onCancel={() => setShowKalkDialog(false)}
          suggestedMaterial={activeLayerName}
        />
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept=".dxf"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          try {
            const result = await importDXFFromFile(f);
            const existing = new Set(store.get().doc.layers.map((l) => l.name));
            for (const layer of result.layers) {
              if (!existing.has(layer.name)) store.addLayer(layer);
            }
            store.addEntities(result.entities);
            apiRef.current?.zoomFit();
          } catch (err) {
            alert('DXF konnte nicht gelesen werden: ' + (err as Error).message);
          }
          (e.target as HTMLInputElement).value = '';
        }}
      />
    </div>
  );
};
