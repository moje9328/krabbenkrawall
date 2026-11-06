// ===================================================================
// 6 · TON
// Eigene kurze Arcade-Geräusche mit Web Audio. Keine Dateien, keine
// Sprachausgabe. Startet erst nach einer Nutzeraktion, ist abschaltbar.
// Aufprallgeräusche sind begrenzt, damit einstürzende Stapel nicht lärmen.
// ===================================================================

const Ton = (() => {
  let ctx = null, haupt = null, rauschen = null;
  let an = true;
  let letztesKnarzen = 0;
  const stoesse = [];   // Zeitpunkte der letzten Aufprallgeräusche

  function wecke() {
    if (!an) return;
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        const komp = ctx.createDynamicsCompressor();
        komp.threshold.value = -16;
        komp.knee.value = 10;
        komp.ratio.value = 6;
        haupt = ctx.createGain();
        haupt.gain.value = 0.5;
        haupt.connect(komp).connect(ctx.destination);
      }
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    } catch (e) { ctx = null; }
  }

  const bereit = () => an && ctx && ctx.state === 'running';

  function rauschBuffer() {
    if (!rauschen) {
      rauschen = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.8), ctx.sampleRate);
      const d = rauschen.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return rauschen;
  }

  function huelle(g, t, laut, dauer, anstieg = 0.005) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, laut), t + anstieg);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dauer);
  }

  function ton(f1, f2, dauer, { typ = 'square', laut = 0.3, start = 0, anstieg } = {}) {
    const t = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = typ;
    osc.frequency.setValueAtTime(f1, t);
    if (f2 !== f1) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dauer);
    huelle(g, t, laut, dauer, anstieg);
    osc.connect(g).connect(haupt);
    osc.start(t);
    osc.stop(t + dauer + 0.03);
  }

  function rausch(dauer, { laut = 0.3, start = 0, typ = 'bandpass', f1 = 1800, f2 = 600, q = 0.9 } = {}) {
    const t = ctx.currentTime + start;
    const src = ctx.createBufferSource();
    src.buffer = rauschBuffer();
    const fil = ctx.createBiquadFilter();
    fil.type = typ;
    fil.Q.value = q;
    fil.frequency.setValueAtTime(f1, t);
    fil.frequency.exponentialRampToValueAtTime(Math.max(30, f2), t + dauer);
    const g = ctx.createGain();
    huelle(g, t, laut, dauer, 0.003);
    src.connect(fil).connect(g).connect(haupt);
    src.start(t, Math.random() * 0.3);
    src.stop(t + dauer + 0.03);
  }

  // Höchstens ein paar Aufprallgeräusche pro Zehntelsekunde
  function stossErlaubt() {
    const t = ctx.currentTime;
    while (stoesse.length && stoesse[0] < t - 0.1) stoesse.shift();
    if (stoesse.length >= GRENZEN.aufprallToeneJeZehntel) return false;
    stoesse.push(t);
    return true;
  }

  const v = () => 1 + (Math.random() * 2 - 1) * 0.06;

  return {
    wecke,
    istAn: () => an,
    setze(wert, wecken = true) {
      an = !!wert;
      if (an && wecken) wecke();
      else if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {});
    },

    // Elastisches Knarzen beim Spannen; höher, je stärker gespannt
    knarzen(staerke) {
      if (!bereit()) return;
      const t = ctx.currentTime;
      if (t - letztesKnarzen < 0.11) return;
      letztesKnarzen = t;
      const f = 90 + staerke * 120;
      ton(f, f * 1.08, 0.09, { typ: 'sawtooth', laut: 0.05 + staerke * 0.05 });
      rausch(0.07, { laut: 0.05, f1: 900 + staerke * 900, f2: 500, q: 4 });
    },

    // „Wupp!“ beim Loslassen, dazu ein kleines Krabben-„Hui“
    wupp(staerke) {
      if (!bereit()) return;
      rausch(0.22, { laut: 0.18, f1: 500, f2: 2600, q: 0.8 });
      ton(160, 520 + staerke * 200, 0.16, { typ: 'triangle', laut: 0.3 });
      ton(700, 1100, 0.08, { typ: 'sine', laut: 0.08, start: 0.06 });
      ton(1100, 820, 0.09, { typ: 'sine', laut: 0.07, start: 0.14 });
    },

    // Unterschiedliche Materialien
    stoss(art, kraft) {
      if (!bereit() || !stossErlaubt()) return;
      const k = 0.35 + 0.65 * begrenzt(kraft, 0, 1);
      if (art === 'holz') {
        ton(210 * v(), 150, 0.08, { typ: 'triangle', laut: 0.28 * k });
        rausch(0.06, { laut: 0.18 * k, f1: 1400, f2: 700, q: 2.5 });
      } else if (art === 'kiste') {
        ton(120 * v(), 80, 0.12, { typ: 'triangle', laut: 0.34 * k });
        rausch(0.08, { laut: 0.16 * k, f1: 600, f2: 300, q: 1.5 });
      } else if (art === 'metall') {
        const f = 620 * v();
        ton(f, f * 0.98, 0.42, { typ: 'triangle', laut: 0.14 * k });
        ton(f * 1.51, f * 1.5, 0.3, { typ: 'sine', laut: 0.08 * k });
        ton(f * 2.76, f * 2.7, 0.18, { typ: 'sine', laut: 0.04 * k });
        rausch(0.04, { laut: 0.1 * k, typ: 'highpass', f1: 3000, f2: 2000, q: 0.7 });
      } else if (art === 'fass') {
        ton(190 * v(), 120, 0.2, { typ: 'sine', laut: 0.36 * k });
        ton(380 * v(), 250, 0.1, { typ: 'triangle', laut: 0.1 * k });
      } else if (art === 'stein') {
        ton(95 * v(), 60, 0.14, { typ: 'triangle', laut: 0.34 * k });
        rausch(0.1, { laut: 0.2 * k, typ: 'lowpass', f1: 900, f2: 200, q: 0.8 });
      } else if (art === 'krabbe') {
        ton(300 * v(), 180, 0.09, { typ: 'triangle', laut: 0.2 * k });
      }
    },

    // Etwas zerbricht: Holz knackt kurz und trocken, Metall scheppert, Stein bröckelt
    bruch(art) {
      if (!bereit() || !stossErlaubt()) return;
      if (art === 'metall' || art === 'container') {
        ton(420 * v(), 180, 0.35, { typ: 'square', laut: 0.05 });
        rausch(0.3, { laut: 0.18, typ: 'highpass', f1: 2400, f2: 900, q: 0.6 });
      } else if (art === 'stein') {
        rausch(0.25, { laut: 0.26, typ: 'lowpass', f1: 1400, f2: 180, q: 0.7 });
        ton(80 * v(), 50, 0.2, { typ: 'triangle', laut: 0.2 });
      } else if (art === 'holz' || art === 'dach') {
        // Knacks: sehr kurzer heller Impuls, dann Splittern
        rausch(0.035, { laut: 0.32, typ: 'highpass', f1: 3200 * v(), f2: 2000, q: 0.7 });
        rausch(0.16, { laut: 0.2, f1: 2200 * v(), f2: 500, q: 1.4, start: 0.02 });
        ton(240 * v(), 90, 0.08, { typ: 'square', laut: 0.05, start: 0.01 });
      } else {
        rausch(0.18, { laut: 0.26, f1: 1300 * v(), f2: 400, q: 1.2 });
        ton(260 * v(), 90, 0.12, { typ: 'square', laut: 0.05 });
      }
    },

    // Münze: helles „Pling-Pling“
    muenze() {
      if (!bereit()) return;
      const f = 1568 * v();
      ton(f, f, 0.07, { typ: 'square', laut: 0.06 });
      ton(f * 1.5, f * 1.5, 0.16, { typ: 'triangle', laut: 0.16, start: 0.06 });
    },

    platsch() {
      if (!bereit()) return;
      rausch(0.32, { laut: 0.26, typ: 'lowpass', f1: 2600, f2: 260, q: 0.6 });
      ton(520, 160, 0.14, { typ: 'sine', laut: 0.12, start: 0.02 });
    },

    // Boje aktiviert: fröhliches Signal
    boje() {
      if (!bereit()) return;
      [784, 988, 1175, 1568].forEach((f, i) => ton(f, f, 0.1, { typ: i === 3 ? 'triangle' : 'square', laut: i === 3 ? 0.22 : 0.07, start: i * 0.055 }));
      ton(3136, 3136, 0.12, { typ: 'sine', laut: 0.04, start: 0.24 });
    },

    // Krabbe landet / schaut verdutzt: kurzer synthetischer Krabbenlaut
    blubb(hoch = 1) {
      if (!bereit()) return;
      ton(520 * hoch, 860 * hoch, 0.06, { typ: 'sine', laut: 0.14 });
      ton(860 * hoch, 430 * hoch, 0.1, { typ: 'sine', laut: 0.12, start: 0.06 });
    },

    puff() {
      if (!bereit()) return;
      rausch(0.14, { laut: 0.12, f1: 1800, f2: 500, q: 0.7 });
    },

    klick() {
      if (!bereit()) return;
      ton(660, 660, 0.04, { typ: 'square', laut: 0.05 });
    },

    // Kleine maritime Siegesfanfare: Schiffshorn, dann ein Dur-Lauf
    sieg() {
      if (!bereit()) return;
      ton(196, 196, 0.3, { typ: 'sawtooth', laut: 0.06 });
      ton(294, 294, 0.3, { typ: 'triangle', laut: 0.18 });
      const noten = [[523, 0.34], [659, 0.46], [784, 0.58], [1047, 0.72], [880, 0.88], [1047, 0.98], [1319, 1.1]];
      noten.forEach(([f, st], i) => {
        const lang = i === noten.length - 1 ? 0.5 : 0.12;
        ton(f, f, lang, { typ: 'triangle', laut: 0.24, start: st });
        ton(f / 2, f / 2, lang, { typ: 'square', laut: 0.04, start: st });
      });
    },

    // Freundliches „Wah-wah“
    schade() {
      if (!bereit()) return;
      ton(392, 370, 0.26, { typ: 'triangle', laut: 0.22 });
      ton(330, 262, 0.5, { typ: 'triangle', laut: 0.22, start: 0.28 });
    },
  };
})();
