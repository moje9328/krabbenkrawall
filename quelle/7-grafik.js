// ===================================================================
// 7 · GRAFIK
// Cartoon-Stil passend zur Krabbe: kräftige dunkle Konturen, weiche
// Verläufe, Lichtkanten. Zeichnet scharf in Bildschirmauflösung (bis 2x).
// - Kulisse und Steg liegen in einer Zwischenleinwand, die nur bei
//   Kamerabewegung neu gemalt wird (dann halb aufgelöst).
// - Jedes Bauteil wird einmal je Zoomstufe als kleines Bild vorgerendert
//   und danach nur noch gedreht und verschoben gezeichnet.
// - Bewegliche Physikteile sind kräftig, die Kulisse ist bewusst blasser.
// ===================================================================

const KRABBE_EINHEIT = 1 / 33;   // Meter pro Zeichen-Einheit der Krabbe (44 x 36): passt zum Kollisionskreis
const KONTUR = '#1b2440';        // Marineblau-dunkel für alle Umrisse

const THEMEN = [
  { // Fischerkai: freundliches Tageslicht
    himmel: ['#4fc0f0', '#9fe2ff', '#e8f9ff'], sonne: '#FFE27A', wolke: '#ffffff',
    wasser: ['#26c6c9', '#138a9e', '#0d5f7a'], welle: '#c9fbff',
    steg: '#c98a4e', stegDunkel: '#8a5530', stegHell: '#e8b070',
    kisten: ['#24b9b0', '#ffc94d', '#ff805b'], dach: ['#ff805b', '#3a86d4', '#24b9b0'], container: ['#24b9b0', '#ff805b', '#ffc94d'],
    fern: ['#f3e6cc', '#e2d2b4'], fernDach: ['#ff9d7e', '#7fb3e6', '#7dd6cf', '#ffd27a'], dunst: 0.42,
  },
  { // Containerhafen: bunt und sonnig
    himmel: ['#3eb2e0', '#93dcf5', '#effbf6'], sonne: '#FFF0A8', wolke: '#ffffff',
    wasser: ['#1fbcc0', '#11809a', '#0b5574'], welle: '#c4f7ff',
    steg: '#b9a58a', stegDunkel: '#7d6c58', stegHell: '#d8c6aa',
    kisten: ['#1fb5ab', '#ff7a3c', '#ffc94d'], dach: ['#3a86d4', '#ff7a3c', '#1fb5ab'], container: ['#1fb5ab', '#ff7a3c', '#3a86d4'],
    fern: ['#e8eef2', '#d2dde4'], fernDach: ['#ff9a6a', '#5fb8d9', '#ffd27a', '#7dd6cf'], dunst: 0.4,
  },
  { // Leuchtturmbucht: warmes Abendlicht
    himmel: ['#5a3c94', '#c46a9a', '#ffc17a'], sonne: '#FFD06A', wolke: '#ffd9c4',
    wasser: ['#4aa8c8', '#2f6f9e', '#22416f'], welle: '#ffe0b0',
    steg: '#b97a4a', stegDunkel: '#7a4527', stegHell: '#dca06a',
    kisten: ['#b58cff', '#ff805b', '#ffd35a'], dach: ['#ff805b', '#7a5fd0', '#ffd35a'], container: ['#7a5fd0', '#ff805b', '#24b9b0'],
    fern: ['#f0c9b0', '#d9a99a'], fernDach: ['#a676d6', '#ff8f7a', '#ffcf7a', '#7a8fd6'], dunst: 0.35,
  },
];

const Grafik = (() => {
  let leinwand, c, W = 1, H = 1, dpr = 1, cssW = 1, cssH = 1;
  const kulisse = document.createElement('canvas');
  const kc = kulisse.getContext('2d');
  const kulisseKlein = document.createElement('canvas');
  const kk = kulisseKlein.getContext('2d');
  let kulissenSchluessel = '', letzterSchluessel = '', kulisseScharf = false, kameraBewegt = false;
  const kam = { x: 0, y: 0, z: 30 };
  let thema = THEMEN[0], level = null, grenzen = null;
  let effekte = [];
  let zeit = 0;
  const sprites = new Map();
  const ruhig = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let wenigBewegung = false;

  function init(el) {
    leinwand = el;
    c = el.getContext('2d');
    wenigBewegung = ruhig();
    if (window.matchMedia) matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change', () => { wenigBewegung = ruhig(); });
  }

  function groesse() {
    const r = leinwand.parentElement.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);   // mehr sieht man kaum, kostet aber viel
    cssW = Math.max(1, Math.round(r.width));
    cssH = Math.max(1, Math.round(r.height));
    W = Math.round(cssW * dpr);
    H = Math.round(cssH * dpr);
    if (leinwand.width !== W || leinwand.height !== H) {
      leinwand.width = W; leinwand.height = H;
      kulisse.width = W; kulisse.height = H;
      kulisseKlein.width = Math.ceil(W / 2); kulisseKlein.height = Math.ceil(H / 2);
      kulissenSchluessel = '';
    }
  }

  function setzeLevel(lv) {
    level = lv;
    thema = THEMEN[GEBIETE[lv.gebiet] ? lv.gebiet : 0];
    grenzen = bauGrenzen(lv);
    effekte = [];
    sprites.clear();
    kulissenSchluessel = '';
  }

  // --------------------------------------------------------------- Kamera
  // Umriss des Gebäudes (und der Bonusmünzen) aus den Leveldaten
  function bauGrenzen(lv) {
    let x0 = 1e9, x1 = -1e9, y1 = 0;
    for (const t of lv.teile) {
      const pts = t.punkte || [[t.x - (t.w || (t.r || 0.5) * 2) / 2, t.y - (t.h || (t.r || 0.5) * 2) / 2], [t.x + (t.w || (t.r || 0.5) * 2) / 2, t.y + (t.h || (t.r || 0.5) * 2) / 2]];
      for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    }
    return { x0, x1, oben: y1 };
  }

  // Bildausschnitt aus Startpunkt, Gebäudeausmaßen und Flugraumreserve.
  // oben/unten = Platz für die Anzeigen (CSS-Pixel)
  function rahmen(x0, x1, y1, zFest, oben, unten) {
    const y0 = -1.0;
    const z = zFest || Math.min((cssW - 12) / (x1 - x0), (cssH - oben - unten) / (y1 - y0), 95);
    const frei = (cssH - oben - unten) - (y1 - y0) * z;
    // Überschüssige Höhe: ein Viertel nach unten (Wasser), der Rest wird Himmel mit Kulisse
    const untenPx = unten + Math.max(0, frei) * 0.25;
    const cx = zFest ? null : (x0 + x1) / 2;
    return { x: cx, y: y0 + (cssH / 2 - untenPx) / z, z };
  }
  const reserve = () => Math.max(grenzen.oben + 1.6, KATAPULT.y + 2.6);
  function ansicht(lv) {
    if (!grenzen || level !== lv) grenzen = bauGrenzen(lv);
    const x0 = -2.3, x1 = grenzen.x1 + 0.9;
    const r = rahmen(x0, x1, reserve(), 0, 64, 56);
    return { x: r.x, y: r.y, z: r.z * dpr };
  }
  // Ab dieser Größe (CSS-Pixel pro Meter) sind Krabbe, Stützen und Bojen gut lesbar
  const MIN_ZOOM = 26;
  function istEng(lv) { return ansicht(lv).z / dpr < MIN_ZOOM - 0.01; }
  // Zielansicht: auf breiten Bildschirmen alles, auf schmalen näher heran mit Katapult links
  function zielAnsicht(lv) {
    const ganz = ansicht(lv);
    if (ganz.z / dpr >= MIN_ZOOM - 0.01) return ganz;
    // So nah, dass Katapult und die vorderen tragenden Stützen gemeinsam im Bild sind
    const links = -1.7, rechts = grenzen.x0 + 3.2;
    const z = Math.max(MIN_ZOOM, Math.min(MIN_ZOOM + 4, cssW / (rechts - links), (cssH - 120) / (reserve() + 1)));
    const r = rahmen(0, 0, reserve(), z, 64, 56);
    return { x: links + cssW / 2 / z, y: r.y, z: z * dpr };
  }
  // Gebäudeansicht (nur schmale Bildschirme): Einsturz in derselben Größe beobachten
  function gebaeudeAnsicht(lv) {
    const zi = zielAnsicht(lv);
    const halb = cssW / 2 / (zi.z / dpr);
    const mitte = Math.max((grenzen.x0 + grenzen.x1) / 2, -1.7 + halb);
    return { x: Math.min(mitte, grenzen.x1 + 1.2 - halb), y: zi.y, z: zi.z };
  }

  const bx = (x) => (x - kam.x) * kam.z + W / 2;
  const by = (y) => H / 2 - (y - kam.y) * kam.z;
  function bildZuWelt(px, py) {
    return { x: (px * dpr - W / 2) / kam.z + kam.x, y: (H / 2 - py * dpr) / kam.z + kam.y };
  }
  function weltZuBildCss(x, y) { return { x: bx(x) / dpr, y: by(y) / dpr }; }

  // --------------------------------------------------------------- Hilfen
  function rundeckig(g, x, y, b, h, r) {
    r = Math.min(r, b / 2, h / 2);
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + b, y, x + b, y + h, r);
    g.arcTo(x + b, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + b, y, r);
    g.closePath();
  }
  function schraube(g, x, y, r) {
    oval(g, x, y, r, r, '#c9d3dd', KONTUR, Math.max(0.6, r * 0.45));
    strich(g, KONTUR, Math.max(0.5, r * 0.35), x - r * 0.55, y, x + r * 0.55, y);
  }
  // fester Pseudozufall je Teil (für Astlöcher, Kratzer …)
  const pz = (id, n) => { const s = Math.sin(id * 12.9898 + n * 78.233) * 43758.5453; return s - Math.floor(s); };
  function mische(hex, ziel, t) {
    const a = parseInt(hex.slice(1), 16), b = parseInt(ziel.slice(1), 16);
    const f = (sh) => Math.round(((a >> sh) & 255) * (1 - t) + ((b >> sh) & 255) * t);
    return `rgb(${f(16)}, ${f(8)}, ${f(0)})`;
  }

  // ------------------------------------------------------------- Kulisse
  function maleKulisse() {
    const schluessel = [kam.x.toFixed(3), kam.y.toFixed(3), kam.z.toFixed(3), W, H, level && level.id].join('|');
    const bewegt = schluessel !== letzterSchluessel;
    letzterSchluessel = schluessel;
    kameraBewegt = bewegt;
    if (!bewegt && schluessel === kulissenSchluessel && kulisseScharf) return kulisse;
    if (bewegt) {
      kulissenSchluessel = '';
      kulisseScharf = false;
      kk.setTransform(0.5, 0, 0, 0.5, 0, 0);
      kulisseMalen(kk);
      return kulisseKlein;
    }
    kulissenSchluessel = schluessel;
    kulisseScharf = true;
    kc.setTransform(1, 0, 0, 1, 0, 0);
    kulisseMalen(kc);
    return kulisse;
  }

  function kulisseMalen(g) {
    g.save();
    const horizont = by(PHYSIK.wasserY);
    const verl = g.createLinearGradient(0, 0, 0, horizont);
    verl.addColorStop(0, thema.himmel[0]);
    verl.addColorStop(0.55, thema.himmel[1]);
    verl.addColorStop(1, thema.himmel[2]);
    g.fillStyle = verl;
    g.fillRect(0, 0, W, H);
    const z = kam.z;
    // Ferne Ebene: kleiner und mit Parallaxe
    const fz = Math.max(z * 0.5, horizont / 26);
    const fx = (x) => W / 2 + (x - kam.x * 0.4) * fz;
    const fy = (y) => horizont - y * fz;
    sonneUndWolken(g, fx, fy, fz, horizont);
    fernKulisse(g, fx, fy, fz, horizont);
    // Dunst: rückt die Kulisse nach hinten
    g.globalAlpha = thema.dunst;
    g.fillStyle = thema.himmel[2];
    g.fillRect(0, 0, W, horizont);
    g.globalAlpha = 1;
    // Wasser
    const wv = g.createLinearGradient(0, horizont, 0, H);
    wv.addColorStop(0, thema.wasser[0]);
    wv.addColorStop(0.35, thema.wasser[1]);
    wv.addColorStop(1, thema.wasser[2]);
    g.fillStyle = wv;
    g.fillRect(0, horizont, W, H - horizont);
    // Steg und Deko auf dem Steg
    for (const [x0, x1] of level.stege) maleSteg(g, x0, x1);
    stegDeko(g);
    malePoller(g, KATAPULT.x - KATAPULT.pollerAbstand, true);
    g.restore();
  }

  function wolke(g, x, y, s) {
    g.fillStyle = thema.wolke;
    g.strokeStyle = 'rgba(27, 36, 64, 0.12)';
    g.lineWidth = Math.max(1, s * 0.06);
    g.beginPath();
    g.arc(x, y, s * 0.6, Math.PI * 0.5, Math.PI * 1.5);
    g.arc(x + s * 0.7, y - s * 0.45, s * 0.75, Math.PI, Math.PI * 1.9);
    g.arc(x + s * 1.55, y - s * 0.2, s * 0.6, Math.PI * 1.25, Math.PI * 0.5);
    g.closePath();
    g.fill(); g.stroke();
    g.fillStyle = 'rgba(27, 36, 64, 0.06)';
    g.fillRect(x - s * 0.2, y + s * 0.2, s * 1.9, s * 0.35);
  }

  function sonneUndWolken(g, fx, fy, fz) {
    const sx = level.gebiet === 2 ? fx(20) : fx(30), sy = level.gebiet === 2 ? fy(4) : fy(16);
    const glow = g.createRadialGradient(sx, sy, 0, sx, sy, 6 * fz);
    glow.addColorStop(0, 'rgba(255, 236, 160, 0.8)');
    glow.addColorStop(1, 'rgba(255, 236, 160, 0)');
    g.fillStyle = glow;
    g.fillRect(sx - 6 * fz, sy - 6 * fz, 12 * fz, 12 * fz);
    oval(g, sx, sy, 2 * fz, 2 * fz, thema.sonne, 'rgba(27, 36, 64, 0.15)', Math.max(1, fz * 0.08));
    // Wolken wandern mit eigener, langsamer Parallaxe
    const wz = Math.max(kam.z * 0.4, fz * 0.8);
    for (const [x, y, s] of [[-8, 13, 1.5], [6, 17, 1.1], [19, 12, 1.8], [33, 16, 1.2], [46, 14, 1.5], [-2, 24, 1.3], [14, 28, 1.6], [28, 23, 1.1], [-12, 32, 1.4], [6, 38, 1.2]]) {
      const yy = fy(y);
      if (yy < -s * wz * 2) continue;
      wolke(g, W / 2 + (x - kam.x * 0.2) * wz, yy, s * wz * 1.2);
    }
  }

  function haus(g, x, b, h, dachFarbe, fx, fy, fz, wand) {
    const x0 = fx(x), x1 = fx(x + b), y0 = fy(0), y1 = fy(h);
    g.fillStyle = wand;
    g.fillRect(x0, y1, x1 - x0, y0 - y1);
    g.fillStyle = 'rgba(27, 36, 64, 0.12)';
    g.fillRect(x1 - (x1 - x0) * 0.22, y1, (x1 - x0) * 0.22, y0 - y1);
    flaeche(g, dachFarbe, null, x0 - fz * 0.35, y1, (x0 + x1) / 2, y1 - fz * 1.5, x1 + fz * 0.35, y1);
    g.strokeStyle = 'rgba(27, 36, 64, 0.35)';
    g.lineWidth = Math.max(1, fz * 0.08);
    g.strokeRect(x0, y1, x1 - x0, y0 - y1);
    // Fenster und Tor
    g.fillStyle = level.gebiet === 2 ? '#ffd56a' : 'rgba(58, 90, 130, 0.55)';
    for (let i = 0; i < Math.floor(b / 1.4); i++) g.fillRect(x0 + (0.5 + i * 1.4) * fz, y1 + fz * 0.6, fz * 0.6, fz * 0.6);
    g.fillStyle = 'rgba(27, 36, 64, 0.3)';
    g.fillRect(x0 + (x1 - x0) * 0.35, y0 - fz * 1.3, (x1 - x0) * 0.3, fz * 1.3);
  }

  function schiff(g, x, fx, fy, fz, rumpf, gross) {
    const b = gross ? 9 : 5;
    const x0 = fx(x), x1 = fx(x + b), y = fy(0);
    flaeche(g, rumpf, 'rgba(27, 36, 64, 0.4)', x0, y - fz * 1.1, x1, y - fz * 1.1, x1 - fz * 0.8, y, x0 + fz * 0.5, y);
    g.fillStyle = '#fff4dc';
    g.fillRect(x0 + fz * 0.4, y - fz * 0.55, x1 - x0 - fz * 1.2, fz * 0.18);
    g.fillStyle = '#f7f2e6';
    g.fillRect(x0 + (x1 - x0) * 0.55, y - fz * 2.3, (x1 - x0) * 0.28, fz * 1.2);
    g.fillStyle = '#ff805b';
    g.fillRect(x0 + (x1 - x0) * 0.62, y - fz * 3.1, fz * 0.45, fz * 0.8);
    if (!gross) { g.fillStyle = '#6b4a34'; g.fillRect(x0 + (x1 - x0) * 0.3, y - fz * 3.4, Math.max(1, fz * 0.12), fz * 2.3); flaeche(g, '#fff4dc', null, x0 + (x1 - x0) * 0.32, y - fz * 3.3, x0 + (x1 - x0) * 0.32 + fz * 1.2, y - fz * 1.4, x0 + (x1 - x0) * 0.32, y - fz * 1.4); }
  }

  function leuchtturm(g, x, fx, fy, fz, hoehe) {
    const st = hoehe / 6;
    for (let i = 0; i < 6; i++) {
      const b0 = 1.3 - i * 0.12, b1 = 1.3 - (i + 1) * 0.12;
      flaeche(g, i % 2 ? '#fff4dc' : '#ff6f6f', 'rgba(27, 36, 64, 0.3)', fx(x - b0), fy(i * st), fx(x + b0), fy(i * st), fx(x + b1), fy((i + 1) * st), fx(x - b1), fy((i + 1) * st));
    }
    g.fillStyle = '#3a4a6a';
    g.fillRect(fx(x - 0.9), fy(hoehe + 1.4), 1.8 * fz, 1.4 * fz);
    oval(g, fx(x), fy(hoehe + 0.7), 0.55 * fz, 0.55 * fz, '#ffe08a');
    flaeche(g, '#c24a3a', null, fx(x - 1.1), fy(hoehe + 1.4), fx(x), fy(hoehe + 2.3), fx(x + 1.1), fy(hoehe + 1.4));
  }

  function fernKulisse(g, fx, fy, fz, horizont) {
    const dach = thema.fernDach, wand = thema.fern;
    if (level.gebiet === 1) {
      // Containerstapel und Kräne
      const farben = ['#5fb8d9', '#ff9a6a', '#ffd27a', '#7dd6cf', '#a8b8d8'];
      for (let i = 0; i < 16; i++) {
        const x = -20 + i * 5.2, hoch = 1 + ((i * 7) % 4);
        for (let j = 0; j < hoch; j++) {
          g.fillStyle = farben[(i + j * 2) % 5];
          g.fillRect(fx(x), fy((j + 1) * 1.3), 4.9 * fz, 1.25 * fz);
          g.fillStyle = 'rgba(27, 36, 64, 0.12)';
          for (let k = 0; k < 7; k++) g.fillRect(fx(x + 0.35 + k * 0.65), fy((j + 1) * 1.3 - 0.15), Math.max(1, 0.12 * fz), 0.95 * fz);
        }
      }
      g.strokeStyle = 'rgba(232, 150, 110, 0.32)';
      g.lineWidth = Math.max(1, 0.2 * fz);
      for (const x of [-6, 34]) {
        g.beginPath();
        g.moveTo(fx(x), fy(0)); g.lineTo(fx(x), fy(14));
        g.moveTo(fx(x + 3), fy(0)); g.lineTo(fx(x + 3), fy(14));
        g.moveTo(fx(x - 7), fy(14)); g.lineTo(fx(x + 12), fy(14));
        for (let k = 0; k < 4; k++) { g.moveTo(fx(x), fy(2 + k * 3)); g.lineTo(fx(x + 3), fy(5 + k * 3)); }
        g.stroke();
        g.fillStyle = 'rgba(255, 210, 122, 0.32)';
        g.fillRect(fx(x - 0.5), fy(15.2), 4 * fz, 1.2 * fz);
      }
      schiff(g, 14, fx, fy, fz, '#3a86d4', true);
      leuchtturm(g, 62, fx, fy, fz, 8);
    } else {
      // Lagerhäuser und Fischerhütten
      for (let i = 0; i < 10; i++) {
        const x = -16 + i * 7.3, b = 4 + (i % 3), h = 2.4 + (i % 2) * 1.4;
        haus(g, x, b, h, dach[i % dach.length], fx, fy, fz, wand[i % 2]);
      }
      schiff(g, 9, fx, fy, fz, level.gebiet === 2 ? '#7a5fd0' : '#ff805b', false);
      schiff(g, 36, fx, fy, fz, '#3a86d4', true);
      leuchtturm(g, level.gebiet === 2 ? 47 : 58, fx, fy, fz, level.gebiet === 2 ? 11 : 8);
    }
    // ferne Hafenmauer am Horizont
    g.fillStyle = 'rgba(27, 36, 64, 0.18)';
    g.fillRect(0, horizont - fz * 0.25, W, fz * 0.25);
  }

  // Holzsteg: Bohlen mit Maserung, Nägel, Pfähle mit Seilen
  function maleSteg(g, x0, x1) {
    const z = kam.z;
    const r = (a, b, c2, d, f) => { g.fillStyle = f; g.fillRect(bx(a), by(d), (c2 - a) * z, (d - b) * z); };
    for (let x = x0 + 0.5; x < x1; x += 2.2) {
      r(x - 0.2, PHYSIK.wasserY - 3, x + 0.2, 0, thema.stegDunkel);
      r(x - 0.2, PHYSIK.wasserY - 3, x - 0.08, 0, 'rgba(255, 255, 255, 0.12)');
      r(x - 0.21, -0.75, x + 0.21, -0.62, '#d9c49a');   // Seilwicklung
    }
    r(x0, -0.46, x1, 0, thema.steg);
    r(x0, -0.07, x1, 0, thema.stegHell);
    r(x0, -0.46, x1, -0.36, thema.stegDunkel);
    g.strokeStyle = 'rgba(90, 50, 25, 0.35)';
    g.lineWidth = Math.max(1, 0.025 * z);
    for (let x = x0 + 0.9; x < x1; x += 0.9) {
      g.beginPath(); g.moveTo(bx(x), by(0)); g.lineTo(bx(x), by(-0.36)); g.stroke();
      oval(g, bx(x - 0.12), by(-0.2), 0.03 * z, 0.03 * z, '#5d4a3a');
    }
    g.strokeStyle = KONTUR;
    g.lineWidth = Math.max(1, 0.04 * z);
    g.strokeRect(bx(x0), by(0), (x1 - x0) * z, 0.46 * z);
    // Wasserkante unter dem Steg
    if (x1 < 30) {
      g.fillStyle = 'rgba(255, 255, 255, 0.35)';
      g.fillRect(bx(x1) - 0.04 * z, by(PHYSIK.wasserY), 0.08 * z, 0.1 * z);
    }
  }

  // Deko auf dem Steg nur links vom Katapult und rechts hinter dem Gebäude:
  // nie dort, wo die Krabbe fliegt oder Teile liegen.
  function stegDeko(g) {
    const z = kam.z;
    // Hafenpoller mit Seil, Rettungsring, Fahne
    const poller = (x) => {
      eckig(g, bx(x - 0.22), by(0.55), 0.44 * z, 0.55 * z, 0.08 * z, '#3a4458', KONTUR, Math.max(1, 0.04 * z));
      eckig(g, bx(x - 0.3), by(0.68), 0.6 * z, 0.18 * z, 0.08 * z, '#4b5670', KONTUR, Math.max(1, 0.04 * z));
      g.fillStyle = 'rgba(255, 255, 255, 0.25)'; g.fillRect(bx(x - 0.17), by(0.5), 0.07 * z, 0.4 * z);
    };
    poller(-3.6);
    // Seil vom Poller zum Wasser
    g.strokeStyle = '#d9c49a'; g.lineWidth = Math.max(1.5, 0.07 * z);
    g.beginPath(); g.moveTo(bx(-3.6), by(0.4)); g.quadraticCurveTo(bx(-4.5), by(-0.3), bx(-5), by(-0.5)); g.stroke();
    // Rettungsring am Pfosten
    const rx = -2.7, ry = 0.95;
    rechteck(g, rx - 0.07, 0, rx + 0.07, 1.6, '#8a5530');
    oval(g, bx(rx), by(ry), 0.36 * z, 0.36 * z, null, '#ff805b', 0.16 * z);
    g.strokeStyle = '#fff4dc'; g.lineWidth = 0.16 * z;
    for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(bx(rx), by(ry), 0.36 * z, i * Math.PI / 2 + 0.35, i * Math.PI / 2 + 0.8); g.stroke(); }
    oval(g, bx(rx), by(ry), 0.44 * z, 0.44 * z, null, 'rgba(27, 36, 64, 0.5)', Math.max(1, 0.03 * z));
    // Fahnen rechts hinter dem Gebäude
    const rechts = grenzen.x1 + 1.4;
    for (const [x, f] of [[rechts, '#ffd35a'], [rechts + 1.6, '#24d6cd']]) {
      rechteck(g, x - 0.04, 0, x + 0.04, 2.6, '#e9e2d0');
      flaeche(g, f, KONTUR, bx(x + 0.04), by(2.6), bx(x + 0.9), by(2.35), bx(x + 0.04), by(2.1));
    }
    poller(rechts + 0.8);
    // aufgerolltes Seil
    oval(g, bx(rechts + 2.6), by(0.12), 0.32 * z, 0.12 * z, '#d9c49a', '#8a7650', Math.max(1, 0.03 * z));
    oval(g, bx(rechts + 2.6), by(0.12), 0.16 * z, 0.06 * z, null, '#8a7650', Math.max(1, 0.03 * z));
  }

  function rechteck(g, x0, y0, x1, y1, f) {
    g.fillStyle = f;
    g.fillRect(bx(x0), by(y1), (x1 - x0) * kam.z, (y1 - y0) * kam.z);
  }

  // --------------------------------------------------------------- Katapult
  function malePoller(g, x, hinten) {
    const z = kam.z, oben = KATAPULT.y + 0.35;
    const lw = Math.max(1, 0.05 * z);
    // dicker Holzpfahl mit Maserung und Eisenbändern
    const holz = g.createLinearGradient(bx(x - 0.2), 0, bx(x + 0.2), 0);
    holz.addColorStop(0, hinten ? '#7a4a2a' : '#a8683c');
    holz.addColorStop(0.5, hinten ? '#8f5a34' : '#c9854e');
    holz.addColorStop(1, hinten ? '#5e3820' : '#7d4a28');
    g.fillStyle = holz;
    g.fillRect(bx(x - 0.2), by(oben - 0.3), 0.4 * z, (oben - 0.3) * z);
    g.strokeStyle = KONTUR; g.lineWidth = lw;
    g.strokeRect(bx(x - 0.2), by(oben - 0.3), 0.4 * z, (oben - 0.3) * z);
    for (const y of [0.5, oben - 0.95]) {
      g.fillStyle = '#3d4a5e'; g.fillRect(bx(x - 0.22), by(y + 0.14), 0.44 * z, 0.14 * z);
      schraube(g, bx(x), by(y + 0.07), 0.04 * z);
    }
    // Pollerkopf
    eckig(g, bx(x - 0.3), by(oben + 0.02), 0.6 * z, 0.36 * z, 0.1 * z, hinten ? '#2a3142' : '#343c52', KONTUR, lw);
    g.fillStyle = hinten ? '#c45a3e' : '#ff805b';
    g.fillRect(bx(x - 0.3), by(oben - 0.12), 0.6 * z, 0.08 * z);
    g.fillStyle = 'rgba(255, 255, 255, 0.25)';
    g.fillRect(bx(x - 0.22), by(oben - 0.02), 0.12 * z, 0.2 * z);
  }

  // Elastisches Seil: dicker und hell entspannt, dünner und korallrot gespannt
  function seil(x0, y0, x1, y1, spannung) {
    const z = kam.z;
    const hang = (1 - spannung) * 0.22;
    const dicke = (0.15 - spannung * 0.05) * z;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(bx(x0), by(y0));
    c.quadraticCurveTo(bx((x0 + x1) / 2), by((y0 + y1) / 2 - hang), bx(x1), by(y1));
    c.strokeStyle = KONTUR; c.lineWidth = dicke + Math.max(2, 0.05 * z); c.stroke();
    c.strokeStyle = spannung > 0.7 ? '#ff9f7a' : spannung > 0.4 ? '#f2c98a' : '#e8d3a8'; c.lineWidth = dicke; c.stroke();
    c.setLineDash([0.12 * z, 0.1 * z]);
    c.strokeStyle = 'rgba(120, 80, 40, 0.45)'; c.lineWidth = dicke * 0.45; c.stroke();
    c.setLineDash([]);
  }

  function maleKatapult(krabbePos, spannung, vorne) {
    const a = KATAPULT.pollerAbstand, kopf = KATAPULT.y + 0.22;
    const ziel = krabbePos || { x: KATAPULT.x, y: KATAPULT.y - 0.3 };
    const z = kam.z;
    if (!vorne) {
      seil(KATAPULT.x - a, kopf, ziel.x - 0.3, ziel.y - 0.12, spannung);
      // gepolstertes Netz hinter der Krabbe
      c.save();
      c.translate(bx(ziel.x), by(ziel.y - 0.3));
      c.fillStyle = '#efdcb4';
      c.strokeStyle = KONTUR;
      c.lineWidth = Math.max(1, 0.045 * z);
      c.beginPath(); c.ellipse(0, 0, 0.55 * z, 0.26 * z, 0, 0, Math.PI); c.closePath(); c.fill(); c.stroke();
      c.strokeStyle = 'rgba(120, 80, 40, 0.6)';
      for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * 0.2 * z, 0); c.lineTo(i * 0.13 * z, 0.22 * z); c.stroke(); }
      c.beginPath(); c.ellipse(0, 0.04 * z, 0.4 * z, 0.13 * z, 0, 0.2, Math.PI - 0.2); c.stroke();
      c.restore();
    } else {
      malePoller(c, KATAPULT.x + a, false);
      seil(KATAPULT.x + a, kopf, ziel.x + 0.3, ziel.y - 0.12, spannung);
    }
  }

  // --------------------------------------------------------------- Bauteile
  // Rendert ein Teil in ein kleines Bild (Sprite). Zeichnung im lokalen System:
  // Mitte = (0,0), x nach rechts, y nach UNTEN (Bildschirm), s = Pixel pro Meter.
  function teilSprite(u, s, stufe) {
    const ausdehnung = u.form ? Math.max(...u.form.map(([x, y]) => Math.hypot(x, y))) * 2 : u.r ? u.r * 2 : Math.hypot(u.w, u.h);
    const groesse = Math.ceil(ausdehnung * s + 8 * dpr + 6);
    const cv = document.createElement('canvas');
    cv.width = groesse; cv.height = groesse;
    const g = cv.getContext('2d');
    g.translate(groesse / 2, groesse / 2);
    zeichneTeil(g, u, s, stufe);
    return cv;
  }

  function zeichneTeil(g, u, s, stufe) {
    const lw = Math.max(1.2, 0.055 * s);
    switch (u.art) {
      case 'holz': holz(g, u, s, lw); break;
      case 'dach': dach(g, u, s, lw); break;
      case 'kiste': kiste(g, u, s, lw); break;
      case 'fass': case 'fassVoll': fass(g, u, s, lw); break;
      case 'metall': metall(g, u, s, lw); break;
      case 'stein': stein(g, u, s, lw); break;
      case 'container': container(g, u, s, lw); break;
      case 'boje': boje(g, u, s, lw); break;
    }
    if (stufe > 0 && u.art !== 'boje') risse(g, u, s, stufe);
  }

  function holz(g, u, s, lw) {
    const w = u.w * s, h = u.h * s, lang = w >= h;
    const quer = lang ? g.createLinearGradient(0, -h / 2, 0, h / 2) : g.createLinearGradient(-w / 2, 0, w / 2, 0);
    quer.addColorStop(0, '#f0bd7e'); quer.addColorStop(0.45, '#d09155'); quer.addColorStop(1, '#a5693a');
    rundeckig(g, -w / 2, -h / 2, w, h, Math.min(w, h) * 0.18);
    g.fillStyle = quer; g.fill();
    // Maserung
    g.save(); g.clip();
    g.strokeStyle = 'rgba(115, 62, 28, 0.32)';
    g.lineWidth = Math.max(0.8, 0.018 * s);
    const n = 3;
    for (let i = 1; i <= n; i++) {
      const t = i / (n + 1) - 0.5;
      g.beginPath();
      if (lang) { g.moveTo(-w / 2, t * h); g.bezierCurveTo(-w / 6, t * h + 0.04 * s * (i % 2 ? 1 : -1), w / 6, t * h - 0.04 * s, w / 2, t * h); }
      else { g.moveTo(t * w, -h / 2); g.bezierCurveTo(t * w + 0.03 * s, -h / 6, t * w - 0.03 * s, h / 6, t * w, h / 2); }
      g.stroke();
    }
    // Astloch
    const ax = lang ? (pz(u.id, 1) - 0.5) * w * 0.5 : 0, ay = lang ? 0 : (pz(u.id, 1) - 0.5) * h * 0.5;
    oval(g, ax, ay, (lang ? 0.07 : 0.04) * s, (lang ? 0.04 : 0.07) * s, 'rgba(110, 60, 25, 0.45)');
    // Lichtkante
    g.fillStyle = 'rgba(255, 238, 200, 0.45)';
    if (lang) g.fillRect(-w / 2, -h / 2, w, Math.max(1, 0.035 * s)); else g.fillRect(-w / 2, -h / 2, Math.max(1, 0.035 * s), h);
    // Gebrauchsspur: kleine Kerbe
    g.fillStyle = 'rgba(255, 230, 190, 0.6)';
    if (lang) flaeche(g, g.fillStyle, null, w * 0.2, h / 2, w * 0.26, h / 2 - 0.06 * s, w * 0.31, h / 2);
    g.restore();
    rundeckig(g, -w / 2, -h / 2, w, h, Math.min(w, h) * 0.18);
    g.strokeStyle = KONTUR; g.lineWidth = lw; g.stroke();
    // Beschläge an langen Balken
    const laenge = Math.max(u.w, u.h);
    if (laenge > 1.1) {
      for (const sgn of [-1, 1]) {
        const p = sgn * (laenge / 2 - 0.2) * s;
        const bw = 0.13 * s, bh = (lang ? u.h : u.w) * s + 0.03 * s;
        g.fillStyle = '#4b5870';
        if (lang) { g.fillRect(p - bw / 2, -bh / 2, bw, bh); g.strokeStyle = KONTUR; g.lineWidth = lw * 0.6; g.strokeRect(p - bw / 2, -bh / 2, bw, bh); schraube(g, p, 0, 0.032 * s); }
        else { g.fillRect(-bh / 2, p - bw / 2, bh, bw); g.strokeStyle = KONTUR; g.lineWidth = lw * 0.6; g.strokeRect(-bh / 2, p - bw / 2, bh, bw); schraube(g, 0, p, 0.032 * s); }
      }
    }
  }

  function dach(g, u, s, lw) {
    const pts = u.form.map(([x, y]) => [x * s, -y * s]);
    const farbe = thema.dach[u.farbe % 3];
    g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath();
    const ys = pts.map(p => p[1]);
    const v = g.createLinearGradient(0, Math.min(...ys), 0, Math.max(...ys));
    v.addColorStop(0, mische(farbe, '#ffffff', 0.15)); v.addColorStop(1, mische(farbe, '#1b2440', 0.25));
    g.fillStyle = v; g.fill();
    g.save(); g.clip();
    // Dachziegel-Reihen
    g.strokeStyle = 'rgba(27, 36, 64, 0.28)';
    g.lineWidth = Math.max(0.8, 0.025 * s);
    const unten = Math.max(...ys), oben = Math.min(...ys), xs = pts.map(p => p[0]);
    for (let y = unten - 0.22 * s; y > oben; y -= 0.22 * s) {
      g.beginPath();
      for (let x = Math.min(...xs) - 0.2 * s; x < Math.max(...xs); x += 0.24 * s) { g.moveTo(x, y); g.arc(x + 0.12 * s, y, 0.12 * s, Math.PI, 0, true); }
      g.stroke();
    }
    g.restore();
    // Holzleiste unten
    g.fillStyle = '#8a5530';
    g.fillRect(Math.min(...xs), unten - 0.09 * s, Math.max(...xs) - Math.min(...xs), 0.09 * s);
    g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath();
    g.strokeStyle = KONTUR; g.lineWidth = lw; g.lineJoin = 'round'; g.stroke();
  }

  function kiste(g, u, s, lw) {
    const w = u.w * s, h = u.h * s, f = thema.kisten[u.farbe % 3];
    const v = g.createLinearGradient(0, -h / 2, 0, h / 2);
    v.addColorStop(0, mische(f, '#ffffff', 0.2)); v.addColorStop(1, mische(f, '#1b2440', 0.22));
    rundeckig(g, -w / 2, -h / 2, w, h, 0.06 * s); g.fillStyle = v; g.fill();
    // Bretter
    g.strokeStyle = 'rgba(27, 36, 64, 0.22)'; g.lineWidth = Math.max(0.8, 0.02 * s);
    for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(-w / 2, -h / 2 + h * i / 4); g.lineTo(w / 2, -h / 2 + h * i / 4); g.stroke(); }
    // Rahmen und Strebe
    const r = 0.12 * s;
    g.strokeStyle = mische(f, '#1b2440', 0.45); g.lineWidth = r * 0.75;
    g.strokeRect(-w / 2 + r * 0.45, -h / 2 + r * 0.45, w - r * 0.9, h - r * 0.9);
    g.beginPath(); g.moveTo(-w / 2 + r, h / 2 - r); g.lineTo(w / 2 - r, -h / 2 + r); g.stroke();
    // Metallecken mit Schrauben
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      g.fillStyle = '#5d6b80';
      g.fillRect(sx * w / 2 - (sx > 0 ? 0.16 * s : 0), sy * h / 2 - (sy > 0 ? 0.16 * s : 0), 0.16 * s, 0.16 * s);
      schraube(g, sx * (w / 2 - 0.08 * s), sy * (h / 2 - 0.08 * s), 0.028 * s);
    }
    // Schablonen-Anker
    if (u.w >= 0.75) {
      g.strokeStyle = 'rgba(255, 244, 220, 0.55)'; g.lineWidth = Math.max(1, 0.035 * s);
      const a = 0.14 * s;
      g.beginPath(); g.moveTo(0, -a); g.lineTo(0, a); g.moveTo(-a * 0.6, -a * 0.4); g.lineTo(a * 0.6, -a * 0.4);
      g.moveTo(-a, a * 0.3); g.quadraticCurveTo(0, a * 1.6, a, a * 0.3); g.stroke();
    }
    g.fillStyle = 'rgba(255, 255, 255, 0.35)'; g.fillRect(-w / 2 + 0.06 * s, -h / 2 + 0.05 * s, w - 0.12 * s, 0.04 * s);
    rundeckig(g, -w / 2, -h / 2, w, h, 0.06 * s); g.strokeStyle = KONTUR; g.lineWidth = lw; g.stroke();
  }

  function fass(g, u, s, lw) {
    const r = u.r * s, voll = u.art === 'fassVoll';
    const holzF = voll ? '#7a3f2a' : (u.id % 2 ? '#c98a4e' : '#3a86d4');
    const v = g.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r);
    v.addColorStop(0, mische(holzF.length === 7 ? holzF : '#c98a4e', '#ffffff', 0.25)); v.addColorStop(1, mische(holzF, '#1b2440', 0.3));
    oval(g, 0, 0, r, r, v);
    // Dauben
    g.strokeStyle = 'rgba(27, 36, 64, 0.3)'; g.lineWidth = Math.max(0.8, 0.022 * s);
    for (let i = 0; i < 8; i++) { const w = i * Math.PI / 4; g.beginPath(); g.moveTo(Math.cos(w) * r * 0.25, Math.sin(w) * r * 0.25); g.lineTo(Math.cos(w) * r * 0.78, Math.sin(w) * r * 0.78); g.stroke(); }
    // Metallringe
    oval(g, 0, 0, r * 0.84, r * 0.84, null, voll ? '#2f3a4c' : '#6b7a90', 0.1 * s);
    oval(g, 0, 0, r * 0.5, r * 0.5, null, voll ? '#2f3a4c' : '#6b7a90', 0.06 * s);
    if (voll) for (let i = 0; i < 6; i++) { const w = i * Math.PI / 3; oval(g, Math.cos(w) * r * 0.84, Math.sin(w) * r * 0.84, 0.035 * s, 0.035 * s, '#c9d3dd'); }
    oval(g, 0, 0, r * 0.14, r * 0.14, '#2a2f3a');
    // Lichtkante
    g.strokeStyle = 'rgba(255, 255, 255, 0.55)'; g.lineWidth = Math.max(1, 0.05 * s);
    g.beginPath(); g.arc(0, 0, r * 0.84, Math.PI * 1.05, Math.PI * 1.45); g.stroke();
    oval(g, 0, 0, r, r, null, KONTUR, lw);
  }

  function metall(g, u, s, lw) {
    const w = u.w * s, h = u.h * s, lang = w >= h;
    const v = lang ? g.createLinearGradient(0, -h / 2, 0, h / 2) : g.createLinearGradient(-w / 2, 0, w / 2, 0);
    v.addColorStop(0, '#b6c7d8'); v.addColorStop(0.35, '#7d93aa'); v.addColorStop(1, '#4a5a70');
    rundeckig(g, -w / 2, -h / 2, w, h, 0.03 * s); g.fillStyle = v; g.fill();
    // Flansche (Doppel-T)
    g.fillStyle = 'rgba(27, 36, 64, 0.25)';
    if (lang) { g.fillRect(-w / 2, -h / 2 + h * 0.25, w, h * 0.08); g.fillRect(-w / 2, h / 2 - h * 0.33, w, h * 0.08); }
    else { g.fillRect(-w / 2 + w * 0.25, -h / 2, w * 0.08, h); g.fillRect(w / 2 - w * 0.33, -h / 2, w * 0.08, h); }
    const n = Math.max(2, Math.round(Math.max(u.w, u.h) / 0.5));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n - 0.5;
      if (lang) schraube(g, t * w, 0, 0.035 * s); else schraube(g, 0, t * h, 0.035 * s);
    }
    // Rostfleck
    oval(g, (pz(u.id, 2) - 0.5) * w * 0.6, (pz(u.id, 3) - 0.5) * h * 0.4, 0.06 * s, 0.03 * s, 'rgba(201, 110, 60, 0.45)');
    g.fillStyle = 'rgba(255, 255, 255, 0.45)';
    if (lang) g.fillRect(-w / 2 + lw, -h / 2 + lw * 0.5, w - 2 * lw, Math.max(1, 0.03 * s));
    rundeckig(g, -w / 2, -h / 2, w, h, 0.03 * s); g.strokeStyle = KONTUR; g.lineWidth = lw; g.stroke();
  }

  function stein(g, u, s, lw) {
    const w = u.w * s, h = u.h * s;
    const v = g.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
    v.addColorStop(0, '#e2d6c0'); v.addColorStop(1, '#a3937c');
    rundeckig(g, -w / 2, -h / 2, w, h, 0.08 * s); g.fillStyle = v; g.fill();
    // Behauene Kante
    g.strokeStyle = 'rgba(255, 255, 255, 0.5)'; g.lineWidth = Math.max(1, 0.04 * s);
    g.beginPath(); g.moveTo(-w / 2 + 0.06 * s, h / 2 - 0.08 * s); g.lineTo(-w / 2 + 0.06 * s, -h / 2 + 0.06 * s); g.lineTo(w / 2 - 0.08 * s, -h / 2 + 0.06 * s); g.stroke();
    g.fillStyle = 'rgba(90, 70, 50, 0.25)';
    for (let i = 0; i < 5; i++) oval(g, (pz(u.id, i) - 0.5) * w * 0.8, (pz(u.id, i + 7) - 0.5) * h * 0.7, 0.025 * s, 0.02 * s, g.fillStyle);
    rundeckig(g, -w / 2, -h / 2, w, h, 0.08 * s); g.strokeStyle = KONTUR; g.lineWidth = lw; g.stroke();
  }

  function container(g, u, s, lw) {
    const w = u.w * s, h = u.h * s, f = thema.container[u.farbe % 3];
    const v = g.createLinearGradient(0, -h / 2, 0, h / 2);
    v.addColorStop(0, mische(f, '#ffffff', 0.18)); v.addColorStop(1, mische(f, '#1b2440', 0.25));
    rundeckig(g, -w / 2, -h / 2, w, h, 0.04 * s); g.fillStyle = v; g.fill();
    // Wellblech
    for (let x = -w / 2 + 0.18 * s; x < w / 2 - 0.25 * s; x += 0.2 * s) {
      g.fillStyle = 'rgba(255, 255, 255, 0.16)'; g.fillRect(x, -h / 2 + 0.12 * s, 0.06 * s, h - 0.24 * s);
      g.fillStyle = 'rgba(27, 36, 64, 0.16)'; g.fillRect(x + 0.07 * s, -h / 2 + 0.12 * s, 0.05 * s, h - 0.24 * s);
    }
    // Rahmen oben/unten und Tür rechts
    g.fillStyle = mische(f, '#1b2440', 0.45);
    g.fillRect(-w / 2, -h / 2, w, 0.1 * s); g.fillRect(-w / 2, h / 2 - 0.1 * s, w, 0.1 * s);
    g.fillRect(w / 2 - 0.5 * s, -h / 2, 0.04 * s, h);
    g.strokeStyle = '#c9d3dd'; g.lineWidth = Math.max(1, 0.03 * s);
    for (const x of [w / 2 - 0.36 * s, w / 2 - 0.2 * s]) { g.beginPath(); g.moveTo(x, -h * 0.3); g.lineTo(x, h * 0.3); g.stroke(); }
    // Schild
    eckig(g, -w * 0.3, -0.12 * s, 0.5 * s, 0.22 * s, 0.03 * s, '#fff4dc', KONTUR, Math.max(0.8, 0.02 * s));
    rundeckig(g, -w / 2, -h / 2, w, h, 0.04 * s); g.strokeStyle = KONTUR; g.lineWidth = lw; g.stroke();
  }

  // Zielboje: gepolstertes Achteck (genau die Kollisionsform), Streifen, Gesicht, Fahne
  function boje(g, u, s, lw) {
    const r = u.r * s;
    const pfad = () => {
      g.beginPath();
      for (let i = 0; i < 8; i++) {
        const w0 = (i + 0.5) * Math.PI / 4, w1 = (i + 1.5) * Math.PI / 4;
        const ax = Math.cos(w0) * r, ay = Math.sin(w0) * r, bxx = Math.cos(w1) * r, byy = Math.sin(w1) * r;
        if (i === 0) g.moveTo((ax + bxx) / 2, (ay + byy) / 2);
        g.arcTo(bxx, byy, (bxx + Math.cos(w1 + Math.PI / 4) * r) / 2, (byy + Math.sin(w1 + Math.PI / 4) * r) / 2, r * 0.22);
      }
      g.closePath();
    };
    // Fahne
    g.strokeStyle = KONTUR; g.lineWidth = Math.max(1.2, 0.05 * s);
    g.beginPath(); g.moveTo(0, -r * 0.9); g.lineTo(0, -r * 1.95); g.stroke();
    flaeche(g, '#ffd35a', KONTUR, 0, -r * 1.95, r * 0.95, -r * 1.72, 0, -r * 1.48);
    pfad();
    g.save(); g.clip();
    g.fillStyle = '#ff4f5e'; g.fillRect(-r, -r, 2 * r, 2 * r);
    g.fillStyle = '#fff4dc'; g.fillRect(-r, -r * 0.42, 2 * r, r * 0.84);
    const glanz = g.createRadialGradient(-r * 0.4, -r * 0.5, 0, -r * 0.4, -r * 0.5, r * 1.3);
    glanz.addColorStop(0, 'rgba(255, 255, 255, 0.45)'); glanz.addColorStop(1, 'rgba(27, 36, 64, 0.2)');
    g.fillStyle = glanz; g.fillRect(-r, -r, 2 * r, 2 * r);
    g.restore();
    pfad(); g.strokeStyle = KONTUR; g.lineWidth = Math.max(1.4, 0.065 * s); g.stroke();
    // Gesicht
    const ex = r * 0.3, ey = -r * 0.08;
    oval(g, -ex, ey, r * 0.15, r * 0.19, KONTUR); oval(g, ex, ey, r * 0.15, r * 0.19, KONTUR);
    oval(g, -ex + r * 0.04, ey - r * 0.06, r * 0.05, r * 0.05, '#ffffff'); oval(g, ex + r * 0.04, ey - r * 0.06, r * 0.05, r * 0.05, '#ffffff');
    g.strokeStyle = KONTUR; g.lineWidth = Math.max(1, 0.035 * s);
    g.beginPath(); g.arc(0, ey + r * 0.12, r * 0.16, 0.3, Math.PI - 0.3); g.stroke();
    oval(g, -r * 0.55, ey + r * 0.18, r * 0.1, r * 0.06, 'rgba(255, 120, 120, 0.7)');
    oval(g, r * 0.55, ey + r * 0.18, r * 0.1, r * 0.06, 'rgba(255, 120, 120, 0.7)');
  }

  function risse(g, u, s, stufe) {
    const w = (u.w || u.r * 2 || 1) * s, h = (u.h || u.r * 2 || 1) * s;
    const lang = w >= h;
    g.save();
    g.lineCap = 'round'; g.lineJoin = 'round';
    const zick = (x0, y0, x1, y1, n) => {
      g.beginPath(); g.moveTo(x0, y0);
      for (let i = 1; i <= n; i++) {
        const t = i / n, sx = x0 + (x1 - x0) * t, sy = y0 + (y1 - y0) * t;
        const q = (i % 2 ? 1 : -1) * 0.045 * s;
        g.lineTo(sx + (lang ? q * 0.6 : 0) , sy + (lang ? 0 : q));
      }
      g.strokeStyle = 'rgba(255, 236, 200, 0.9)'; g.lineWidth = Math.max(3, 0.08 * s); g.stroke();
      g.strokeStyle = KONTUR; g.lineWidth = Math.max(1.4, 0.04 * s); g.stroke();
    };
    const v = (pz(u.id, 5) - 0.5) * 0.3;
    // Riss quer über die ganze Breite (bei Stützen gut sichtbar)
    if (lang) zick(-w * (0.05 + v * 0.3), -h / 2, w * (0.05 - v * 0.3), h / 2, 3);
    else zick(-w / 2, -h * (0.08 + v * 0.3), w / 2, h * (0.02 - v * 0.3), 3);
    // ausgebrochene Kerbe an einer Seite
    g.fillStyle = 'rgba(255, 228, 180, 0.95)';
    if (lang) flaeche(g, g.fillStyle, KONTUR, -0.08 * s, h / 2, 0, h / 2 - 0.09 * s, 0.08 * s, h / 2);
    else flaeche(g, g.fillStyle, KONTUR, -w / 2, -h * 0.05 - 0.1 * s, -w / 2 + 0.09 * s, -h * 0.05, -w / 2, -h * 0.05 + 0.1 * s);
    if (stufe > 1) {
      if (lang) zick(w * 0.28, h / 2, w * 0.36, -h / 2, 3);
      else zick(-w / 2, h * 0.28, w / 2, h * 0.34, 3);
    }
    g.restore();
  }

  function spriteFuer(u, z) {
    const m = MATERIAL[u.art];
    const anteil = m && m.haltbar ? u.schaden / m.haltbar : 0;
    const stufe = anteil > 0.6 ? 2 : anteil > 0.22 ? 1 : 0;
    const form = u.form ? u.form.map(p => p.map(v => v.toFixed(2)).join(',')).join(';') : '';
    const basis = [u.art, u.w, u.h, u.r, form, u.farbe, u.id % 2, stufe, u.art === 'fass' || u.art === 'fassVoll' || u.art === 'holz' || u.art === 'stein' || u.art === 'metall' ? u.id % 7 : 0].join('|');
    const zk = z.toFixed(2);
    let eintrag = sprites.get(basis);
    if (eintrag && eintrag.z === zk) return { bild: eintrag.bild, faktor: 1 };
    // Während Kamerafahrten altes Bild skalieren statt neu zu malen
    if (eintrag && kameraBewegt) return { bild: eintrag.bild, faktor: z / eintrag.zz };
    if (sprites.size > 400) sprites.clear();
    const bild = teilSprite(u, z, stufe);
    sprites.set(basis, { z: zk, zz: z, bild });
    return { bild, faktor: 1 };
  }

  function teil(b, alpha) {
    const u = b.getUserData();
    const p = b.getPosition();
    const x = u.px + (p.x - u.px) * alpha, y = u.py + (p.y - u.py) * alpha;
    let a = b.getAngle(), da = a - u.pa;
    if (da > Math.PI) da -= Math.PI * 2; else if (da < -Math.PI) da += Math.PI * 2;
    a = u.pa + da * alpha;
    const { bild, faktor } = spriteFuer(u, kam.z);
    c.save();
    c.translate(bx(x), by(y));
    c.rotate(-a);
    if (faktor !== 1) c.scale(faktor, faktor);
    c.drawImage(bild, -bild.width / 2, -bild.height / 2);
    c.restore();
    if (u.art === 'boje') zielMarke(x, y, u.r);
  }

  // Zielmarkierung über jeder Boje: pulsierender Ring und hüpfender Pfeil
  function zielMarke(x, y, r) {
    const z = kam.z;
    const puls = wenigBewegung ? 1.32 : 1.3 + Math.sin(zeit * 4) * 0.07;
    c.setLineDash([0.16 * z, 0.12 * z]);
    oval(c, bx(x), by(y), r * puls * z, r * puls * z, null, 'rgba(255, 244, 220, 0.95)', Math.max(1.5, 0.06 * z));
    c.setLineDash([]);
    const hop = wenigBewegung ? 0 : Math.abs(Math.sin(zeit * 3)) * 0.12;
    const py = y + r * 2.25 + hop;
    flaeche(c, '#ffd35a', KONTUR, bx(x - 0.17), by(py + 0.2), bx(x + 0.17), by(py + 0.2), bx(x), by(py));
  }

  // Bonusmünze: goldene Hafenmünze mit Anker, dreht sich langsam
  function muenze(x, y, id) {
    const z = kam.z, r = BONUS.radius * z;
    const dreh = wenigBewegung ? 1 : Math.max(0.25, Math.abs(Math.cos(zeit * 2 + id)));
    const schweb = wenigBewegung ? 0 : Math.sin(zeit * 2.5 + id) * 0.05;
    const sx = bx(x), sy = by(y + schweb);
    const glow = c.createRadialGradient(sx, sy, 0, sx, sy, r * 2);
    glow.addColorStop(0, 'rgba(255, 230, 120, 0.55)'); glow.addColorStop(1, 'rgba(255, 230, 120, 0)');
    c.fillStyle = glow; c.fillRect(sx - r * 2, sy - r * 2, r * 4, r * 4);
    c.save(); c.translate(sx, sy); c.scale(dreh, 1);
    const v = c.createLinearGradient(-r, -r, r, r);
    v.addColorStop(0, '#fff2a8'); v.addColorStop(0.5, '#ffc93a'); v.addColorStop(1, '#d48a12');
    oval(c, 0, 0, r, r, v, KONTUR, Math.max(1.2, 0.05 * z));
    oval(c, 0, 0, r * 0.72, r * 0.72, null, 'rgba(160, 90, 10, 0.6)', Math.max(1, 0.03 * z));
    c.strokeStyle = 'rgba(140, 80, 10, 0.85)'; c.lineWidth = Math.max(1, 0.04 * z); c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, -r * 0.45); c.lineTo(0, r * 0.4); c.moveTo(-r * 0.25, -r * 0.2); c.lineTo(r * 0.25, -r * 0.2);
    c.moveTo(-r * 0.4, r * 0.1); c.quadraticCurveTo(0, r * 0.65, r * 0.4, r * 0.1); c.stroke();
    c.restore();
    if (!wenigBewegung && Math.sin(zeit * 3 + id * 2) > 0.85) stern(c, sx + r * 0.6, sy - r * 0.6, r * 0.35, '#ffffff', zeit);
  }

  // Ein paar Möwen ziehen langsam durch den Himmel
  function moewen() {
    const z = kam.z;
    c.strokeStyle = 'rgba(27, 36, 64, 0.55)';
    c.lineWidth = Math.max(1.2, 0.04 * z);
    c.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const bahn = (zeit * (0.6 + i * 0.15) + i * 9) % 40 - 8;
      const x = bx(bahn + kam.x - 10 + i * 4), y = by(kam.y + 3.5 + i * 1.6 + Math.sin(zeit + i) * 0.3);
      const fl = Math.sin(zeit * 6 + i) * 0.08 * z, s = 0.28 * z;
      c.beginPath();
      c.moveTo(x - s, y - fl); c.quadraticCurveTo(x - s * 0.4, y - s * 0.5, x, y);
      c.quadraticCurveTo(x + s * 0.4, y - s * 0.5, x + s, y - fl);
      c.stroke();
    }
  }

  // --------------------------------------------------------------- Krabbe
  function maleKrabbe(x, y, winkel, o, skala = 1) {
    const e = kam.z * KRABBE_EINHEIT * skala;
    c.save();
    c.translate(bx(x), by(y));
    c.rotate(-winkel);
    c.scale(e, e);
    c.translate(-22, -22);
    malKrabbe(c, o);
    c.restore();
  }

  function maleSternchen(x, y, t) {
    const z = kam.z;
    for (let i = 0; i < 3; i++) {
      const w = t * 5 + (i * Math.PI * 2) / 3;
      stern(c, bx(x + Math.cos(w) * 0.48), by(y + 0.8 + Math.sin(w) * 0.12), 0.12 * z, '#ffd35a', w);
    }
  }

  function stern(g, x, y, r, farbe, dreh = 0) {
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 ? r * 0.45 : r, w = dreh + (i * Math.PI) / 5 - Math.PI / 2;
      g.lineTo(x + Math.cos(w) * rr, y + Math.sin(w) * rr);
    }
    g.closePath();
    g.fillStyle = farbe; g.fill();
    g.strokeStyle = KONTUR; g.lineWidth = Math.max(1, r * 0.18); g.stroke();
  }

  // --------------------------------------------------------------- Vorschau
  function maleVorschau(bahn, staerke) {
    const z = kam.z;
    const pts = bahn.punkte;
    const farbe = staerke > 0.8 ? '255, 128, 91' : staerke > 0.5 ? '255, 211, 90' : '255, 248, 230';
    for (let i = 3; i < pts.length; i += 4) {
      const a = 1 - i / (pts.length + 8) * 0.6;
      const p = pts[i], q = pts[Math.min(pts.length - 1, i + 2)];
      c.lineCap = 'round';
      c.strokeStyle = `rgba(27, 36, 64, ${(a * 0.55).toFixed(2)})`;
      c.lineWidth = Math.max(4, 0.2 * z);
      c.beginPath(); c.moveTo(bx(p.x), by(p.y)); c.lineTo(bx(q.x), by(q.y)); c.stroke();
      c.strokeStyle = `rgba(${farbe}, ${a.toFixed(2)})`;
      c.lineWidth = Math.max(2.5, 0.12 * z);
      c.stroke();
    }
    if (bahn.kontakt) {
      const k = bahn.kontakt;
      oval(c, bx(k.x), by(k.y), 0.24 * z, 0.24 * z, null, 'rgba(27, 36, 64, 0.6)', Math.max(4, 0.12 * z));
      oval(c, bx(k.x), by(k.y), 0.24 * z, 0.24 * z, null, `rgba(${farbe}, 1)`, Math.max(2, 0.07 * z));
    }
  }

  // Stärkeanzeige ohne Zahlen: fünf Kerben über dem Katapult
  function maleKraft(staerke) {
    const z = kam.z;
    const x = KATAPULT.x - 1.0, y = KATAPULT.y + 1.3;
    const farben = ['#24d6cd', '#7fe08a', '#ffd35a', '#ffad5a', '#ff805b'];
    for (let i = 0; i < 5; i++) {
      const voll = staerke * 5 > i + 0.15;
      eckig(c, bx(x + i * 0.42), by(y + i * 0.07), 0.32 * z, (0.22 + i * 0.07) * z, 0.07 * z, voll ? farben[i] : 'rgba(16, 36, 58, 0.5)', KONTUR, Math.max(1, 0.045 * z));
    }
  }

  // --------------------------------------------------------------- Wasser vorne
  function maleWasser() {
    const z = kam.z, y0 = by(PHYSIK.wasserY);
    c.fillStyle = 'rgba(30, 150, 170, 0.28)';
    c.fillRect(0, y0, W, H - y0);
    c.strokeStyle = thema.welle;
    c.lineWidth = Math.max(1.5, 0.06 * z);
    c.lineCap = 'round';
    let alpha = 0.75;
    for (let reihe = 0; reihe < 4; reihe++) {
      const yy = y0 + reihe * 0.42 * z + 0.08 * z;
      const schritt = 0.7 * z;
      const versatz = wenigBewegung ? 0 : ((zeit * (0.4 + reihe * 0.15) * z) % (schritt * 2));
      c.globalAlpha = alpha;
      c.beginPath();
      for (let x = -schritt * 2 + versatz - (reihe % 2) * schritt; x < W + schritt; x += schritt * 2) {
        c.moveTo(x, yy);
        c.quadraticCurveTo(x + schritt * 0.5, yy - 0.1 * z, x + schritt, yy);
      }
      c.stroke();
      alpha *= 0.62;
    }
    c.globalAlpha = 1;
    if (level.gebiet === 2 && !wenigBewegung) {
      const fz = z * 0.5;
      const lx = W / 2 + (47 - kam.x * 0.4) * fz, ly = y0 - 11.7 * fz;
      const w = Math.sin(zeit * 0.7) * 0.9 + Math.PI;
      const verl = c.createRadialGradient(lx, ly, 0, lx, ly, 30 * fz);
      verl.addColorStop(0, 'rgba(255, 230, 150, 0.3)');
      verl.addColorStop(1, 'rgba(255, 230, 150, 0)');
      c.fillStyle = verl;
      c.beginPath(); c.moveTo(lx, ly); c.arc(lx, ly, 30 * fz, w - 0.12, w + 0.12); c.closePath(); c.fill();
    }
  }

  // --------------------------------------------------------------- Effekte
  function effekt(e) {
    if (effekte.length >= GRENZEN.partikel) effekte.shift();
    effekte.push(e);
  }

  function spruehen(x, y, art, anzahl, extra = {}) {
    if (wenigBewegung) anzahl = Math.ceil(anzahl / 2);
    for (let i = 0; i < anzahl; i++) {
      const w = Math.random() * Math.PI * 2, v = 1 + Math.random() * (extra.tempo || 4);
      effekt({ art, x, y, vx: Math.cos(w) * v, vy: Math.abs(Math.sin(w)) * v + (extra.hoch || 1), leben: 0, max: 0.45 + Math.random() * 0.45, groesse: 0.08 + Math.random() * 0.1, farbe: extra.farbe, dreh: Math.random() * 6 });
    }
  }

  function punkteText(x, y, text, farbe = '#ffd35a', klein = false) {
    effekt({ art: 'text', x, y, vx: 0, vy: 1.1, leben: 0, max: 1.1, text, farbe, klein });
  }

  // Eine einzige Kettenanzeige, die bei jeder weiteren Zerstörung aktualisiert wird
  function kette(x, y, anzahl, summe) {
    const alt = effekte.find(e => e.art === 'text' && e.kette);
    const text = `KETTE ×${anzahl}  +${summe}`;
    if (alt) { alt.text = text; alt.leben = 0; alt.x += (x - alt.x) * 0.3; return; }
    effekt({ art: 'text', x, y, vx: 0, vy: 0.3, leben: 0, max: 1.3, text, farbe: '#24d6cd', klein: true, kette: true });
  }

  // Kurze Sprechblase der Krabbe
  function blase(x, y, text) {
    effekte = effekte.filter(e => e.art !== 'blase');
    effekt({ art: 'blase', x, y, vx: 0, vy: 0.4, leben: 0, max: 1.0, text });
  }

  function maleEffekte(dt) {
    const z = kam.z;
    for (const e of effekte) {
      e.leben += dt;
      if (e.art !== 'text' && e.art !== 'ring' && e.art !== 'blase' && e.art !== 'blitz') e.vy -= 9 * dt * (e.art === 'staub' ? 0.05 : 1);
      e.x += e.vx * dt; e.y += e.vy * dt;
      if (e.art === 'staub') { e.vx *= 0.94; e.vy *= 0.94; }
      const t = e.leben / e.max;
      if (t >= 1) continue;
      const sx = bx(e.x), sy = by(e.y);
      if (e.art === 'stern') stern(c, sx, sy, (0.15 - t * 0.07) * z, e.farbe || '#ffd35a', e.dreh + e.leben * 6);
      else if (e.art === 'tropfen') oval(c, sx, sy, e.groesse * z, e.groesse * z * 1.2, `rgba(200, 245, 255, ${(1 - t).toFixed(2)})`, `rgba(27, 36, 64, ${(0.35 * (1 - t)).toFixed(2)})`, 1);
      else if (e.art === 'staub') oval(c, sx, sy, (0.1 + t * 0.28) * z, (0.08 + t * 0.2) * z, `rgba(255, 244, 220, ${(0.6 * (1 - t)).toFixed(2)})`);
      else if (e.art === 'konfetti' || e.art === 'span') {
        c.save(); c.translate(sx, sy); c.rotate(e.dreh + e.leben * (e.art === 'span' ? 10 : 8));
        c.globalAlpha = 1 - t * t;
        c.fillStyle = e.farbe;
        const b = e.art === 'span' ? 0.2 : 0.14, h = e.art === 'span' ? 0.06 : 0.08;
        c.fillRect(-b / 2 * z, -h / 2 * z, b * z, h * z);
        if (e.art === 'span') { c.strokeStyle = KONTUR; c.lineWidth = 1; c.strokeRect(-b / 2 * z, -h / 2 * z, b * z, h * z); }
        c.restore();
      } else if (e.art === 'ring') {
        oval(c, sx, sy, (0.3 + t * (wenigBewegung ? 0.3 : 1.1)) * z, (0.3 + t * (wenigBewegung ? 0.3 : 1.1)) * z, null, `rgba(255, 244, 220, ${(1 - t).toFixed(2)})`, Math.max(2, 0.08 * z));
      } else if (e.art === 'blitz') {
        if (!wenigBewegung) {
          const gl = c.createRadialGradient(sx, sy, 0, sx, sy, 1.4 * z);
          gl.addColorStop(0, `rgba(255, 250, 210, ${(0.7 * (1 - t)).toFixed(2)})`); gl.addColorStop(1, 'rgba(255, 250, 210, 0)');
          c.fillStyle = gl; c.fillRect(sx - 1.4 * z, sy - 1.4 * z, 2.8 * z, 2.8 * z);
        }
      } else if (e.art === 'text') {
        const groesse = Math.max((e.klein ? 8 : 10) * dpr, (e.klein ? 0.3 : 0.4) * z);
        c.font = `${Math.round(groesse)}px "Press Start 2P", monospace`;
        c.textAlign = 'center';
        c.globalAlpha = t < 0.7 ? 1 : (1 - t) / 0.3;
        c.lineWidth = groesse * 0.3; c.lineJoin = 'round';
        c.strokeStyle = KONTUR; c.strokeText(e.text, sx, sy);
        c.fillStyle = e.farbe; c.fillText(e.text, sx, sy);
        c.globalAlpha = 1;
      } else if (e.art === 'blase') {
        const groesse = Math.max(11 * dpr, 0.34 * z);
        c.font = `600 ${Math.round(groesse)}px -apple-system, "Segoe UI", Roboto, sans-serif`;
        const bb = c.measureText(e.text).width + groesse * 1.2, bh = groesse * 1.9;
        const bx0 = sx - bb / 2, by0 = sy - bh - groesse * 0.8;
        c.globalAlpha = t < 0.8 ? 1 : (1 - t) / 0.2;
        eckig(c, bx0, by0, bb, bh, bh * 0.4, '#fff8ea', KONTUR, Math.max(1.5, 0.04 * z));
        flaeche(c, '#fff8ea', KONTUR, sx - groesse * 0.3, by0 + bh - 1, sx + groesse * 0.3, by0 + bh - 1, sx - groesse * 0.1, by0 + bh + groesse * 0.6);
        c.fillStyle = '#fff8ea'; c.fillRect(sx - groesse * 0.28, by0 + bh - 3, groesse * 0.56, 4);
        c.fillStyle = KONTUR; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(e.text, sx, by0 + bh / 2 + 1);
        c.textBaseline = 'alphabetic';
        c.globalAlpha = 1;
      }
    }
    effekte = effekte.filter(e => e.leben < e.max);
  }

  // --------------------------------------------------------------- Bild
  function bild(welt, info, dt) {
    zeit += dt;
    const hinten = maleKulisse();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(hinten, 0, 0, hinten.width, hinten.height, 0, 0, hinten === kulisse ? W : hinten.width * 2, hinten === kulisse ? H : hinten.height * 2);
    const alpha = info.alpha;
    for (const m of welt.bonus) { const u = m.getUserData(); muenze(u.x, u.y, u.id); }
    for (const b of welt.teile) teil(b, alpha);
    // Wartende Krabben neben dem Katapult
    for (let i = 0; i < info.wartend; i++) {
      const hops = wenigBewegung ? 0 : Math.abs(Math.sin(zeit * 2.2 + i * 1.3)) * 0.06;
      maleKrabbe(-1.25 - i * 0.6, 0.36 + hops, 0, { figur: info.figur, wedel: zeit + i, tanzt: false, blick: 1, lauf: 0 }, 0.62);
    }
    if (!wenigBewegung) moewen();
    maleKatapult(info.krabbeImKatapult, info.spannung, false);
    if (info.vorschau) maleVorschau(info.vorschau, info.spannung);
    if (info.krabbe) {
      const k = info.krabbe;
      maleKrabbe(k.x, k.y, k.winkel, k.o);
      if (k.sternchen) maleSternchen(k.x, k.y, zeit);
    }
    maleKatapult(info.krabbeImKatapult, info.spannung, true);
    if (info.zeigeKraft) maleKraft(info.spannung);
    maleWasser();
    maleEffekte(dt);
  }

  // Level-Vorschau für die Levelauswahl: echtes Gebäude aus denselben Zeichenfunktionen
  function vorschau(leinw, lv) {
    const g = leinw.getContext('2d');
    const altThema = thema;
    thema = THEMEN[lv.gebiet];
    const Wv = leinw.width, Hv = leinw.height;
    const verl = g.createLinearGradient(0, 0, 0, Hv);
    verl.addColorStop(0, thema.himmel[0]); verl.addColorStop(0.8, thema.himmel[2]);
    g.fillStyle = verl; g.fillRect(0, 0, Wv, Hv);
    const gr = bauGrenzen(lv);
    const x0 = -1.5, x1 = gr.x1 + 0.8, y0 = -1.0, y1 = gr.oben + 0.8;
    const z = Math.min(Wv / (x1 - x0), Hv / (y1 - y0));
    const px = (x) => (x - x0) * z + (Wv - (x1 - x0) * z) / 2;
    const py = (y) => Hv - (y - y0) * z;
    g.fillStyle = thema.wasser[1]; g.fillRect(0, py(PHYSIK.wasserY), Wv, Hv);
    g.fillStyle = thema.steg;
    for (const [a, b] of lv.stege) { g.fillRect(px(a), py(0), (b - a) * z, 0.4 * z); g.strokeStyle = KONTUR; g.lineWidth = 1; g.strokeRect(px(a), py(0), (b - a) * z, 0.4 * z); }
    let id = 0;
    for (const t of lv.teile) {
      if (t.art === 'bonus') {
        oval(g, px(t.x), py(t.y), BONUS.radius * z, BONUS.radius * z, '#ffc93a', KONTUR, 1);
        continue;
      }
      let x = t.x, y = t.y, form = null;
      if (t.punkte) { const s = schwerpunkt(t.punkte); x = s.x; y = s.y; form = t.punkte.map(([qx, qy]) => [qx - s.x, qy - s.y]); }
      const m = MATERIAL[t.art];
      const u = { art: t.art, w: t.w, h: t.h, r: t.r || (t.art === 'boje' ? 0.48 : 0.42), form, farbe: t.farbe || 0, id: id++, schaden: m.haltbar ? (t.riss || 0) * m.haltbar : 0 };
      g.save(); g.translate(px(x), py(y));
      zeichneTeil(g, u, z, u.schaden / (m.haltbar || 1) > 0.22 ? 1 : 0);
      g.restore();
    }
    // Katapult als Markierung
    g.fillStyle = '#8a5530';
    g.fillRect(px(-0.8), py(2.9), 0.32 * z, 2.9 * z);
    g.fillRect(px(0.5), py(2.9), 0.32 * z, 2.9 * z);
    thema = altThema;
  }

  return {
    init, groesse, setzeLevel, ansicht, zielAnsicht, gebaeudeAnsicht, istEng, kam, bildZuWelt, weltZuBildCss, bild, vorschau,
    spruehen, punkteText, effekt, blase, kette,
    get dpr() { return dpr; }, get cssW() { return cssW; }, get cssH() { return cssH; },
    get wenigBewegung() { return wenigBewegung; },
    leeren() { effekte = []; },
  };
})();
