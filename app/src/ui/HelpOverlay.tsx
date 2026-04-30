import React from 'react';

interface Props {
  onClose: () => void;
}

const ROWS: [string, string][] = [
  ['L', 'Linie'],
  ['C', 'Kreis'],
  ['R', 'Rechteck'],
  ['A', 'Bogen (3 Punkte)'],
  ['P', 'Polylinie'],
  ['D', 'Bemaßung (ausgerichtet)'],
  ['E', 'Ellipse'],
  ['V', 'Auswählen'],
  ['F', 'Abrunden (oder Zoom anpassen wenn frei)'],
  ['T', 'Stutzen'],
  ['G', 'Raster ein/aus'],
  ['S', 'Fang ein/aus'],
  ['O', 'Ortho ein/aus'],
  ['Entf', 'Auswahl löschen'],
  ['Strg+Z / Strg+Y', 'Rückgängig / Wiederherstellen'],
  ['Strg+S', 'Speichern (DXF)'],
  ['ESC', 'Aktion abbrechen'],
  ['Enter', 'Polylinie beenden / Wert übernehmen'],
  ['Leer', 'Letzten Befehl wiederholen'],
  ['?', 'Diese Hilfe'],
  ['Mausrad', 'Zoom (zum Cursor)'],
  ['Mitte / Alt + Ziehen', 'Verschieben (Pan)'],
];

const PROMPTS: [string, string][] = [
  ['100,50', 'Absoluter Punkt (100, 50)'],
  ['@30,0', 'Relativer Punkt: 30 nach rechts'],
  ['25', 'Beim Kreis/Versatz/Abrunden: numerischer Abstand'],
  ['linie / kreis / kreis...', 'Werkzeug nach Name aufrufen'],
  ['dimh / dimv / dimr / dimd / dima', 'Bemaßung horizontal/vertikal/Radius/Durchm./Winkel'],
  ['rückgängig / wiederherstellen', 'Verlauf'],
  ['anpassen', 'Zoom auf Zeichnung anpassen'],
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
          <div className="text-muted text-[10px] tracking-widest uppercase">Tastatur-Referenz</div>
        </div>
        <button
          onClick={onClose}
          className="text-muted hover:text-brand text-2xl leading-none"
        >×</button>
      </div>
      <div className="grid grid-cols-2 gap-x-6 px-5 py-4">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted mb-2">Tastenkürzel</div>
          {ROWS.map(([k, v]) => (
            <div key={k} className="flex items-center gap-3 py-1 border-b border-line/50">
              <span className="text-brand font-bold text-[11px] w-32">{k}</span>
              <span className="text-ink text-[11px]">{v}</span>
            </div>
          ))}
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted mb-2">Befehlszeile · Beispiele</div>
          {PROMPTS.map(([k, v]) => (
            <div key={k} className="flex items-center gap-3 py-1 border-b border-line/50">
              <span className="text-brand font-bold text-[11px] w-32">{k}</span>
              <span className="text-ink text-[11px]">{v}</span>
            </div>
          ))}
          <div className="mt-4 text-muted text-[10px] leading-relaxed">
            Fang-Priorität: Endpunkt &gt; Mittelpunkt/Quadrant &gt; Zentrum &gt; Schnittpunkt &gt; Raster.
            Gelbes Quadrat = Endpunkt, Dreieck = Mittelpunkt, Kreis = Zentrum, ✕ = Schnittpunkt.
          </div>
        </div>
      </div>
    </div>
  </div>
);
