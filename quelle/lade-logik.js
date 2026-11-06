// Lädt Physik, Einstellungen, Level und Welt in Node – exakt dieselben Dateien wie im Spiel.
const fs = require('fs'), path = require('path'), vm = require('vm');
module.exports = function ladeLogik() {
  const ctx = { console, Math, Map, Set, Object, Array, Infinity };
  vm.createContext(ctx);
  ctx.globalThis = ctx; ctx.self = ctx; ctx.window = ctx;
  const teile = ['0-planck.min.js', '1-einstellungen.js', '2-level.js', '3-welt.js'];
  const code = teile.map(n => fs.readFileSync(path.join(__dirname, n), 'utf8')).join('\n;\n')
    + '\n;globalThis.__ = { PHYSIK, KRABBE_PHYSIK, KATAPULT, MATERIAL, LEVEL, GEBIETE, Welt, startwerte, zugAusWinkel, planck, schwerpunkt, PUNKTE, BONUS };';
  vm.runInContext(code, ctx, { filename: 'krabbenkrawall-logik.js' });
  const L = ctx.__;
  // Eine Schussfolge [[winkel, staerke], …] komplett durchspielen
  L.spiele = function (level, folge, { saat = 1, beiSchritt } = {}) {
    const w = new L.Welt(level, saat);
    let i = 0, schritte = 0;
    while (!w.ergebnis && schritte < 60 * 200) {
      if (w.kannSchiessen()) {
        if (i >= folge.length) break;
        const [winkel, staerke] = folge[i++];
        w.abschuss(L.zugAusWinkel(winkel, staerke));
      }
      w.schritt(); schritte++;
      if (beiSchritt) beiSchritt(w);
      w.ereignisse.length = 0; w.toene.length = 0;
    }
    return { welt: w, ergebnis: w.ergebnis, bojen: w.bojenGesamt - w.bojenUebrig, gesamt: w.bojenGesamt, punkte: w.endpunkte(), sterne: w.sterne(), schuesse: i, schritte };
  };
  return L;
};
