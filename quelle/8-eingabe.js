// ===================================================================
// 8 · EINGABE
// Maus, Finger und Stift über Pointer Events mit Pointer Capture: Das Ziehen
// geht weiter, auch wenn der Finger die Krabbe verlässt. pointercancel bricht
// sicher ab, ohne Schuss. Tastatur: Winkel, Kraft, Leertaste.
// Spieltasten wirken (und verhindern Scrollen) nur, wenn das Spiel den Fokus hat.
// ===================================================================

const Eingabe = (() => {
  let leinwand = null;
  let ziehen = null;           // { id } während eines Zugs
  let app = null;

  function punkt(e) {
    const r = leinwand.getBoundingClientRect();
    return Grafik.bildZuWelt(e.clientX - r.left, e.clientY - r.top);
  }

  function init(el, a) {
    leinwand = el;
    app = a;
    el.addEventListener('pointerdown', runter);
    el.addEventListener('pointermove', bewegt);
    el.addEventListener('pointerup', hoch);
    el.addEventListener('pointercancel', abbruch);
    el.addEventListener('lostpointercapture', (e) => { if (ziehen && e.pointerId === ziehen.id) abbruch(e); });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('keydown', taste);
  }

  function runter(e) {
    Ton.wecke();
    if (e.button !== undefined && e.button > 0) return;
    if (app.zustand() === 'intro') { app.introUeberspringen(); return; }
    if (!app.darfZielen() || ziehen) return;
    const w = punkt(e);
    const k = app.krabbenPunkt();
    const abstand = Math.hypot(w.x - k.x, w.y - k.y);
    const pixel = abstand * Grafik.kam.z / Grafik.dpr;
    if (abstand > KATAPULT.griffRadius && pixel > KATAPULT.griffPixel) return;
    e.preventDefault();
    ziehen = { id: e.pointerId, versatzX: k.x - w.x, versatzY: k.y - w.y };
    try { leinwand.setPointerCapture(e.pointerId); } catch (f) { /* ältere Browser */ }
    leinwand.focus({ preventScroll: true });
    app.zugStart();
    bewegt(e);
  }

  function bewegt(e) {
    if (!ziehen || e.pointerId !== ziehen.id) return;
    e.preventDefault();
    const w = punkt(e);
    // Der Griffpunkt bleibt dort, wo man die Krabbe angefasst hat
    app.zugSetzen({ x: w.x + ziehen.versatzX - KATAPULT.x, y: w.y + ziehen.versatzY - KATAPULT.y });
  }

  function hoch(e) {
    if (!ziehen || e.pointerId !== ziehen.id) return;
    e.preventDefault();
    ziehen = null;
    try { leinwand.releasePointerCapture(e.pointerId); } catch (f) { /* schon frei */ }
    app.loslassen();
  }

  function abbruch(e) {
    if (!ziehen || (e && e.pointerId !== undefined && e.pointerId !== ziehen.id)) return;
    ziehen = null;
    app.zugAbbrechen();
  }

  function spielHatFokus() {
    const a = document.activeElement;
    return !a || a === document.body || a === leinwand;
  }

  function taste(e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const z = app.zustand();
    const k = e.key;
    // Pause / weiter ist überall im Spiel erlaubt
    if ((k === 'p' || k === 'P' || k === 'Escape') && ['intro', 'zielen', 'flug', 'zurueck'].includes(z)) { e.preventDefault(); app.pause(); return; }
    if ((k === 'p' || k === 'P') && z === 'pause') { e.preventDefault(); app.weiter(); return; }
    if (!spielHatFokus() || app.fensterOffen()) return;
    if (k === 'm' || k === 'M') { app.tonUmschalten(); return; }
    if (k === 'r' || k === 'R') { if (['intro', 'zielen', 'flug', 'zurueck'].includes(z)) { e.preventDefault(); app.neustart(); } return; }
    if (z === 'intro' && (k === ' ' || k === 'Enter')) { e.preventDefault(); app.introUeberspringen(); return; }
    if (k === 'n' || k === 'N') { app.naechsteKrabbe(); return; }
    if (k === 'u' || k === 'U') { app.uebersichtUmschalten(); return; }
    const spielTasten = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Enter', 'w', 'a', 's', 'd', 'W', 'A', 'S', 'D'];
    if (!spielTasten.includes(k)) return;
    e.preventDefault();
    Ton.wecke();
    if (z !== 'zielen' || ziehen) return;
    const schnell = e.shiftKey ? 3 : 1;
    if (k === 'ArrowUp' || k === 'w' || k === 'W') app.tastatur(2 * schnell, 0);
    else if (k === 'ArrowDown' || k === 's' || k === 'S') app.tastatur(-2 * schnell, 0);
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') app.tastatur(0, 0.025 * schnell);
    else if (k === 'ArrowLeft' || k === 'a' || k === 'A') app.tastatur(0, -0.025 * schnell);
    else if ((k === ' ' || k === 'Enter') && !e.repeat) app.tastaturSchuss();
  }

  return { init, ziehtGerade: () => !!ziehen, abbrechen() { if (ziehen) abbruch(); } };
})();
