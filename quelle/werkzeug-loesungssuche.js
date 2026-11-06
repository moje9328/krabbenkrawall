// Entwickler-Werkzeug: sucht mit der echten Spielphysik Schussfolgen für ein Level.
// Aufruf: node quelle/werkzeug-loesungssuche.js <levelId> ['[[winkel,staerke],…]' schon gesetzte Schüsse]
// Ausgabe: beste nächste Schüsse und wie robust sie sind (Nachbarn ±1/±2°, ±0,02/±0,04 Stärke).
// Mit --gierig: baut Schuss für Schuss eine komplette robuste Lösung.
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const os = require('os');

const wert = (r) => r.bojen * 1e6 + (r.ergebnis === 'erfolg' ? 5e5 : 0) + r.punkte;

function verteile(id, basis, liste) {
  return new Promise((fertig) => {
    const n = os.cpus().length, alle = [];
    let offen = n;
    for (let k = 0; k < n; k++) {
      const wk = new Worker(__filename, { workerData: { id, basis, meine: liste.filter((_, i) => i % n === k) } });
      wk.on('message', (m) => { alle.push(...m); if (--offen === 0) fertig(alle); });
    }
  });
}

const NACHBARN = [[-2, 0], [2, 0], [0, -0.04], [0, 0.04], [-1, 0], [1, 0], [0, -0.02], [0, 0.02]];
const nb = (t, [dw, ds]) => [t[0] + dw, Math.min(1, Math.round((t[1] + ds) * 100) / 100)];

async function suche(id, basis, still) {
  const raster = [];
  for (let w = -10; w <= 80; w += 2) for (let s = 0.3; s <= 1.0001; s += 0.04) raster.push([w, Math.round(s * 100) / 100]);
  const t0 = Date.now();
  const erg = await verteile(id, basis, raster);
  erg.sort((a, b) => b.wert - a.wert);
  const erfolge = erg.filter(e => e.ergebnis === 'erfolg').length;
  const vert = {};
  for (const e of erg) vert[e.bojen] = (vert[e.bojen] || 0) + 1;
  if (!still) console.log(`Level ${id}, Basis ${JSON.stringify(basis)}: ${raster.length} Schüsse, ${erfolge} gewinnen, Bojen-Verteilung ${JSON.stringify(vert)} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  // Robustheit der besten Kandidaten (je beste Bojenzahl bis zu 24)
  const top = erg.slice(0, 24);
  const nachbarn = [];
  for (const t of top) for (const d of NACHBARN) nachbarn.push(nb(t.schuss, d));
  const nerg = await verteile(id, basis, nachbarn);
  const nach = new Map(nerg.map(e => [e.schuss.join(','), e]));
  for (const t of top) t.robust = NACHBARN.filter(d => { const e = nach.get(nb(t.schuss, d).join(',')); return e && e.bojen >= t.bojen; }).length;
  top.sort((a, b) => ((b.robust >= 5) - (a.robust >= 5)) || (b.bojen - a.bojen) || (b.ergebnis === 'erfolg') - (a.ergebnis === 'erfolg') || (b.robust - a.robust) || (b.wert - a.wert));
  return { top, erfolge, vert };
}

if (isMainThread) {
  (async () => {
    const id = Number(process.argv[2]);
    let basis = process.argv[3] && process.argv[3].startsWith('[') ? JSON.parse(process.argv[3]) : [];
    if (process.argv.includes('--gierig')) {
      const L = require('./lade-logik.js')();
      const lv = L.LEVEL.find(l => l.id === id);
      while (basis.length < lv.schuesse) {
        const { top, erfolge } = await suche(id, basis, true);
        const t = top[0];
        basis = [...basis, t.schuss];
        console.log(`  Schuss ${basis.length}: [${t.schuss}] -> Bojen ${t.bojen}/${t.gesamt} ${t.ergebnis || ''} robust ${t.robust}/8 (Raster-Erfolge ${erfolge})`);
        if (t.ergebnis === 'erfolg') break;
      }
      const r = L.spiele(lv, basis);
      console.log(`FOLGE L${id}: ${JSON.stringify(basis)} -> ${r.ergebnis} ${r.punkte} Punkte`);
      return;
    }
    const { top } = await suche(id, basis);
    for (const t of top.slice(0, 8)) console.log(`  [${t.schuss}] bojen ${t.bojen}/${t.gesamt} ${t.ergebnis || '-'} punkte ${t.punkte} robust ${t.robust}/8`);
  })();
} else {
  const L = require('./lade-logik.js')();
  const lv = L.LEVEL.find(l => l.id === workerData.id);
  const raus = [];
  for (const schuss of workerData.meine) {
    const r = L.spiele(lv, [...workerData.basis, schuss]);
    raus.push({ schuss, bojen: r.bojen, gesamt: r.gesamt, ergebnis: r.ergebnis, punkte: r.punkte, wert: wert(r) });
  }
  parentPort.postMessage(raus);
}
