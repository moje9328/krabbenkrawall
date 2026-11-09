// ===================================================================
// 5 · SPEICHER
// Fortschritt, Sterne, Bestpunkte, Ton und Krabbenwahl im Browser.
// Versioniertes Format. Fehlt localStorage oder ist der Inhalt kaputt,
// läuft das Spiel trotzdem – es merkt sich dann alles nur bis zum Neuladen.
// Version 3 (überarbeitete Level 1, 5, 6, 7, 9, 13, 15, 23: anspruchsvollere Gebäude
// und neue Sterne-Schwellen): Freischaltung, Sterne, Ton und Krabbe bleiben erhalten.
// Die alten Bestpunkte gehören zur alten Wertung und werden nicht übernommen
// (der alte Stand bleibt unter …-v2 gesichert); neue Bestpunkte zählen ab Version 3.
// Version 2 (neue Gebäude, neue Punktewertung): Freischaltung, Ton und Krabbe
// werden aus Version 1 übernommen. Die alten Bestpunkte gehören zur alten
// Wertung und werden deshalb NICHT übernommen; neue Bestleistungen und Sterne
// werden getrennt in Version 2 geführt.
// ===================================================================

const Speicher = (() => {
  const SCHLUESSEL = 'pixelhafen.krabbenkrawall';
  const VERSION = 3;
  const leer = () => ({ version: VERSION, ton: true, krabbe: 'kalle', level: {}, frei: 1 });
  let daten = leer();

  function lager() {
    try { return window.localStorage || null; } catch (e) { return null; }
  }

  // Nur gültige Werte übernehmen; alles andere fällt auf Standard zurück
  function pruefe(roh) {
    const d = leer();
    if (!roh || typeof roh !== 'object' || (roh.version !== 1 && roh.version !== 2 && roh.version !== VERSION)) return d;
    if (typeof roh.ton === 'boolean') d.ton = roh.ton;
    if (typeof roh.krabbe === 'string' && KRABBEN[roh.krabbe]) d.krabbe = roh.krabbe;
    if (roh.version === 1) {
      // Übernahme: bis wohin war freigeschaltet?
      let frei = 1;
      for (const lv of LEVEL) if (roh.level && roh.level[lv.id] && Number(roh.level[lv.id].sterne) >= 1) frei = Math.max(frei, lv.id + 1);
      d.frei = Math.min(frei, LEVEL.length);
      return d;
    }
    const f = Math.floor(Number(roh.frei));
    if (f >= 1) d.frei = Math.min(f, LEVEL.length);
    if (roh.level && typeof roh.level === 'object') {
      for (const lv of LEVEL) {
        const e = roh.level[lv.id];
        if (!e || typeof e !== 'object') continue;
        const sterne = Math.floor(Number(e.sterne));
        const best = Math.floor(Number(e.best));
        if (sterne >= 1 && sterne <= 3) d.level[lv.id] = { sterne, best: roh.version === VERSION && Number.isFinite(best) && best > 0 ? best : 0 };
      }
    }
    return d;
  }

  function laden() {
    try {
      const l = lager();
      const text = l ? l.getItem(SCHLUESSEL) : null;
      daten = text ? pruefe(JSON.parse(text)) : leer();
    } catch (e) { daten = leer(); }
    // Übernommene alte Daten gleich im neuen Format sichern (der alte Stand bleibt
    // zusätzlich unter dem Schlüssel …-v1 erhalten)
    try {
      const l = lager();
      const text = l ? l.getItem(SCHLUESSEL) : null;
      const alt = text ? JSON.parse(text).version : 0;
      if (alt === 1 || alt === 2) { l.setItem(SCHLUESSEL + '-v' + alt, text); sichern(); }
    } catch (e) { /* egal */ }
  }

  function sichern() {
    try { const l = lager(); if (l) l.setItem(SCHLUESSEL, JSON.stringify(daten)); } catch (e) { /* gesperrt oder voll */ }
  }

  laden();

  return {
    tonAn: () => daten.ton,
    setzeTon(an) { daten.ton = !!an; sichern(); },
    krabbe: () => daten.krabbe,
    setzeKrabbe(name) { if (KRABBEN[name]) { daten.krabbe = name; sichern(); } },
    level: (id) => daten.level[id] || null,
    sterne: (id) => (daten.level[id] ? daten.level[id].sterne : 0),
    sterneGesamt: () => Object.values(daten.level).reduce((s, e) => s + e.sterne, 0),
    frei(id) {
      const i = LEVEL.findIndex(l => l.id === id);
      return i === 0 || id <= daten.frei || (i > 0 && !!daten.level[LEVEL[i - 1].id]);
    },
    // Sterne und Bestpunkte gehen nie verloren, nur Verbesserungen werden gespeichert
    ergebnis(id, sterne, punkte) {
      const alt = daten.level[id] || { sterne: 0, best: 0 };
      const neu = { sterne: Math.max(alt.sterne, sterne), best: Math.max(alt.best, punkte) };
      const besser = { sterne: neu.sterne > alt.sterne, punkte: neu.best > alt.best };
      daten.level[id] = neu;
      daten.frei = Math.max(daten.frei, Math.min(id + 1, LEVEL.length));
      sichern();
      return besser;
    },
  };
})();
