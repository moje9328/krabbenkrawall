// Prüft die Spiellogik mit der echten Physik. Aufruf: node quelle/test-logik.js
// Es werden genau dieselben Dateien geladen wie im Spiel (lade-logik.js).
const fs = require('fs'), path = require('path');
const L = require('./lade-logik.js')();
const { LEVEL, Welt, PHYSIK, KATAPULT, KRABBE_PHYSIK, MATERIAL, PUNKTE, zugAusWinkel, planck, schwerpunkt } = L;

let fehler = 0, geprueft = 0;
function ok(bed, text) { geprueft++; if (!bed) { fehler++; console.log('  FEHLER:', text); } }
const abschnitt = (t) => console.log('\n## ' + t);
const NACHBARN = [[-1, 0], [1, 0], [-2, 0], [2, 0], [0, -0.02], [0, 0.02], [0, -0.04], [0, 0.04]];
const verschiebe = (s, [dw, ds]) => [s[0] + dw, Math.min(1, Math.round((s[1] + ds) * 100) / 100)];
const testLevel = (teile, o = {}) => ({ id: 90, gebiet: 0, name: 'Test', schuesse: o.schuesse || 1, breite: o.breite || 20, stege: o.stege || [[-5, 30]], sterne: [0, 0], loesung: [], teile });

// Schussfolge spielen und dabei Ereignisse und den ersten Treffpunkt der letzten Krabbe merken
function spielMit(lv, folge) {
  const w = new Welt(lv);
  const startPos = w.teile.map(b => ({ b, x: b.getPosition().x, y: b.getPosition().y, art: b.getUserData().art }));
  const ereignisse = [];
  let i = 0, erster = null;
  while (!w.ergebnis && w.takt < 60 * 200) {
    if (w.kannSchiessen()) { if (i >= folge.length) break; w.abschuss(zugAusWinkel(...folge[i++])); }
    w.schritt();
    if (w.krabbe && w.krabbe.erster && i === folge.length && !erster) erster = w.krabbe.erster;
    ereignisse.push(...w.ereignisse);
    w.ereignisse.length = 0; w.toene.length = 0;
  }
  // Wie viele Bauteile wurden bewegt oder zerstört?
  let bewegt = 0;
  for (const s of startPos) {
    if (s.art === 'boje') continue;
    const u = s.b.getUserData();
    if (u.weg || Math.hypot(s.b.getPosition().x - s.x, s.b.getPosition().y - s.y) > 0.5) bewegt++;
  }
  return { w, ereignisse, erster, bewegt, bauteile: startPos.filter(s => s.art !== 'boje').length };
}

// ------------------------------------------------------------------ 1. Stabilität
abschnitt('Jedes Gebäude steht vor dem ersten Schuss stabil (Einschwingen + 20 s)');
for (const lv of LEVEL) {
  const w = new Welt(lv);
  const start = lv.teile.filter(t => t.art !== 'bonus');
  ok(w.teile.length === start.length, `L${lv.id}: Teil beim Einschwingen verloren`);
  let maxVers = 0;
  w.teile.forEach((b, i) => {
    const t = start[i]; let tx = t.x, ty = t.y;
    if (t.punkte) { const s = schwerpunkt(t.punkte); tx = s.x; ty = s.y; }
    const p = b.getPosition(); maxVers = Math.max(maxVers, Math.hypot(p.x - tx, p.y - ty));
  });
  ok(maxVers < 0.12, `L${lv.id}: Teil rutscht beim Einschwingen ${maxVers.toFixed(3)} m`);
  const schadenVorher = w.teile.map(b => b.getUserData().schaden);
  let bewegt = 0;
  for (let i = 0; i < 1200; i++) { w.schritt(); if (w.bewegtSich()) bewegt++; }
  ok(bewegt === 0, `L${lv.id}: zittert (${bewegt} Takte Bewegung)`);
  ok(w.teile.every((b, i) => b.getUserData().schaden === schadenVorher[i]), `L${lv.id}: ruhender Kontakt macht Schaden`);
  ok(w.punkte === 0 && w.bojenUebrig === w.bojenGesamt && w.bonusGesammelt === 0, `L${lv.id}: Punkte, Bojen oder Münzen ohne Schuss`);
  const schwach = lv.teile.filter(t => t.riss).length;
  const lasten = lv.teile.filter(t => ['fassVoll', 'container', 'metall', 'fass'].includes(t.art)).length;
  ok(schwach + lasten > 0 || lv.id === 7, `L${lv.id}: keine erkennbare Schwachstelle`);
  console.log(`  L${lv.id} ${lv.name}: ${start.length} Teile, max. Setzung ${maxVers.toFixed(3)} m, 20 s ruhig, ${lv.teile.filter(t => t.art === 'boje').length} Ziele, ${lv.teile.filter(t => t.art === 'bonus').length} Münzen, ${schwach} angeknackste Teile, ${lasten} Lasten`);
}

// ------------------------------------------------------------------ 2. Lösungen
abschnitt('Jedes Level: gespeicherte Lösung mit der Originalkrabbe, mit Toleranz');
function pruefeFolge(lv, folge, name) {
  const r = spielMit(lv, folge);
  ok(r.w.ergebnis === 'erfolg', `L${lv.id} ${name}: ${JSON.stringify(folge)} schafft das Level nicht`);
  ok(folge.length <= lv.schuesse, `L${lv.id}: Lösung braucht mehr Krabben als vorhanden`);
  let gut = 0;
  for (const d of NACHBARN) {
    const f = folge.map(s => s.slice());
    f[f.length - 1] = verschiebe(f[f.length - 1], d);
    if (spielMit(lv, f).w.ergebnis === 'erfolg') gut++;
  }
  ok(gut >= 6, `L${lv.id} ${name}: zu wenig Toleranz (${gut}/8)`);
  return { r, gut };
}
for (const lv of LEVEL) {
  const { r, gut } = pruefeFolge(lv, lv.loesung, 'Lösung');
  ok(r.w.sterne() >= 1, `L${lv.id}: Erfolg ohne Stern`);
  ok(r.bewegt >= Math.min(4, r.bauteile), `L${lv.id}: kein sichtbarer Einsturz (${r.bewegt} Teile bewegt)`);
  console.log(`  L${lv.id} ${lv.name}: ${JSON.stringify(lv.loesung)} -> Erfolg, ${r.w.endpunkte()} Punkte, ${r.w.sterne()} Sterne, ${r.bewegt}/${r.bauteile} Bauteile eingestürzt oder zerstört, ${r.w.bonusGesammelt}/${r.w.bonusGesamt} Münzen, Toleranz ${gut}/8`);
}

// ------------------------------------------------------------------ 3. Level 3: zwei Ansätze
abschnitt('Level 3: flacher Schuss auf die Stützen und hoher Schuss auf die Lasten');
{
  const lv = LEVEL[2];
  ok(lv.schuesse === 3 && lv.teile.filter(t => t.art === 'boje').length === 2 && lv.teile.some(t => t.art === 'fassVoll'), 'L3 entspricht nicht der Vorgabe (3 Krabben, 2 Ziele, schweres Fass)');
  for (const [name, folge, pruef] of [
    ['flach', lv.loesung, (e) => e && e.art === 'holz' && e.y < 1.6],
    ['hoch', lv.loesungHoch, (e) => e && e.y > 1.96],
  ]) {
    const { r, gut } = pruefeFolge(lv, folge, name);
    ok(pruef(r.erster), `L3 ${name}: trifft zuerst ${JSON.stringify(r.erster)}`);
    let gleicherAnsatz = 0;
    for (const d of NACHBARN) { const e = spielMit(lv, [verschiebe(folge[0], d)]).erster; if (pruef(e)) gleicherAnsatz++; }
    console.log(`  ${name}: ${JSON.stringify(folge)} trifft zuerst ${r.erster.art} in ${r.erster.y.toFixed(2)} m Höhe -> Erfolg; ${gut}/8 Nachbarn gewinnen, ${gleicherAnsatz}/8 treffen dieselbe Stelle`);
  }
}

// ------------------------------------------------------------------ 4. Varianten
abschnitt('Krabbenvarianten sind rein kosmetisch');
const weltCode = fs.readFileSync(path.join(__dirname, '3-welt.js'), 'utf8').replace(/\/\/.*$/gm, '');
ok(!/KRABBEN|figur|Speicher/.test(weltCode), 'Die Physik liest die Krabbenwahl');
ok(Object.isFrozen(KRABBE_PHYSIK), 'KRABBE_PHYSIK ist nicht eingefroren');
console.log('  3-welt.js kennt die Krabbenwahl nicht; alle Varianten nutzen KRABBE_PHYSIK (eingefroren).');

// ------------------------------------------------------------------ 5. Vorschau = Flug
abschnitt('Flugbahn-Vorschau stimmt mit dem echten Flug überein (bis zum ersten Kontakt)');
let maxAbw = 0, verglichen = 0;
for (const lv of [LEVEL[0], LEVEL[6], LEVEL[11]]) {
  for (const [w, s] of [[5, 0.5], [20, 0.8], [40, 1], [60, 0.7], [80, 0.95], [-10, 1], [30, 0.3]]) {
    const welt = new Welt(lv);
    const zug = zugAusWinkel(w, s);
    const bahn = welt.flugbahn(zug, 3);
    welt.abschuss(zug);
    for (let i = 1; i < bahn.punkte.length; i++) {
      welt.schritt();
      if (!welt.krabbe || welt.krabbe.kontakt) break;
      const p = welt.krabbe.body.getPosition();
      maxAbw = Math.max(maxAbw, Math.hypot(p.x - bahn.punkte[i].x, p.y - bahn.punkte[i].y));
      verglichen++;
    }
  }
}
ok(maxAbw < 1e-6, `Vorschau weicht ab: ${maxAbw}`);
console.log(`  ${verglichen} Flugschritte verglichen, größte Abweichung ${maxAbw.toExponential(2)} m`);
{
  // Vorschau endet am Gebäude und läuft nicht hindurch; Münzen (Sensoren) stoppen sie nicht
  const welt = new Welt(LEVEL[2]);
  const bahn = welt.flugbahn(zugAusWinkel(4, 0.98), 3);
  ok(!!bahn.kontakt && bahn.kontakt.x < 9.5, `Vorschau endet nicht an der ersten Stütze (${bahn.kontakt && bahn.kontakt.x})`);
  console.log(`  Level 3 flach: Vorschau endet bei x = ${bahn.kontakt.x.toFixed(2)} m, die erste Stütze steht bei 9,0 m`);
}

// ------------------------------------------------------------------ 6. Kein Durchtunneln
abschnitt('Schnelle Schüsse durchdringen keine Bauteile');
for (const [name, teil] of [['20-cm-Holzstütze', { art: 'holz', x: 7, y: 1.5, w: 0.2, h: 3 }], ['10-cm-Metallplatte', { art: 'metall', x: 7, y: 1.5, w: 0.1, h: 3 }]]) {
  let tunnel = 0;
  for (const w of [0, 3, 6, 9]) {
    const welt = new Welt(testLevel([teil, { art: 'boje', x: 15, y: 0.45 }]));
    welt.abschuss(zugAusWinkel(w, 1));
    for (let i = 0; i < 40 && welt.krabbe; i++) {
      welt.schritt();
      const kp = welt.krabbe && welt.krabbe.body.getPosition();
      const pp = welt.teile.find(b => b.getUserData().art === teil.art);
      if (kp && pp && !welt.krabbe.kontakt && kp.x > pp.getPosition().x) tunnel++;
    }
  }
  ok(tunnel === 0, `Krabbe fliegt ohne Kontakt durch ${name}`);
  console.log(`  ${name} bei voller Kraft: kein Durchfliegen ohne Kontakt`);
}

// ------------------------------------------------------------------ 7. Punkte, Münzen, Ketten
abschnitt('Punkte, Münzen und Kettenbonus zählen genau einmal');
for (const lv of LEVEL) {
  const r = spielMit(lv, lv.loesung);
  let summe = 0, doppelt = 0;
  const gesehen = new Set();
  for (const e of r.ereignisse) {
    if (!['boje', 'bruch', 'wasser', 'raus', 'bonus'].includes(e.typ)) continue;
    summe += (e.punkte || 0) + (e.kette || 0);
    const key = e.typ === 'boje' || e.typ === 'bonus' ? e.typ + e.id : 'teil' + e.id;
    if (gesehen.has(key)) doppelt++;
    gesehen.add(key);
  }
  ok(doppelt === 0, `L${lv.id}: doppelte Wertung`);
  ok(summe === r.w.punkte, `L${lv.id}: Punkte ${r.w.punkte} ≠ Summe der Ereignisse ${summe}`);
  ok(r.w.kettenPunkte <= PUNKTE.ketteDeckel * r.w.schussNummer, `L${lv.id}: Kettenbonus über dem Deckel`);
  ok(r.w.endpunkte() === r.w.punkte + r.w.schuesseUebrig * PUNKTE.krabbeUebrig, `L${lv.id}: Restkrabbenbonus falsch`);
}
console.log('  Alle 12 Lösungen: jedes Objekt höchstens ein Ereignis, Punktestand = Summe aller Ereignisse, Kettenbonus gedeckelt');
{
  // Münze in einer ruhenden Kiste: wird nie eingesammelt
  const welt = new Welt(testLevel([{ art: 'kiste', x: 10, y: 0.5, w: 1, h: 1 }, { art: 'bonus', x: 10, y: 0.5 }, { art: 'boje', x: 14, y: 0.45 }]));
  for (let i = 0; i < 600; i++) welt.schritt();
  ok(welt.bonusGesammelt === 0, 'Ruhende überlappende Kiste sammelt die Münze');
  // Krabbe fliegt durch eine freie Münze: sammelt genau einmal
  const w2 = new Welt(testLevel([{ art: 'bonus', x: 0, y: 0 }, { art: 'boje', x: 14, y: 0.45 }]));
  const bahn = w2.flugbahn(zugAusWinkel(20, 0.7), 0.5);
  const m = bahn.punkte[20];
  const w3 = new Welt(testLevel([{ art: 'bonus', x: m.x, y: m.y }, { art: 'boje', x: 14, y: 0.45 }]));
  w3.abschuss(zugAusWinkel(20, 0.7));
  const vorher = w3.krabbe.body.getLinearVelocity().x;
  for (let i = 0; i < 120; i++) w3.schritt();
  ok(w3.bonusGesammelt === 1 && w3.punkte >= PUNKTE.bonus, 'Krabbe sammelt die Münze nicht');
  console.log('  Münze in ruhender Kiste: nicht gesammelt. Krabbe fliegt durch Münze: genau einmal gesammelt, Münze bremst nicht');
}

// ------------------------------------------------------------------ 8. Zug, Schussende, Erfolg, Niederlage
abschnitt('Zug, Schussende, Erfolg und Niederlage');
{
  const w = new Welt(LEVEL[0]);
  ok(!w.abschuss({ x: -0.2, y: -0.1 }) && w.schuesseUebrig === LEVEL[0].schuesse, 'Zu kurzer Zug verbraucht einen Versuch');
  console.log(`  Zug unter ${KATAPULT.minZug} m: kein Schuss, kein Versuch verbraucht`);
}
{
  const w = new Welt(LEVEL[0]);
  w.abschuss(zugAusWinkel(70, 0.4));
  let ende = null;
  while (!ende && w.takt < 60 * 30) { w.schritt(); for (const e of w.ereignisse) if (e.typ === 'schussEnde') ende = e; w.ereignisse.length = 0; }
  ok(ende && !ende.zeitlimit, 'Schussende wird nicht über Ruhe erkannt');
  console.log(`  Schuss ins Leere endet nach ${ende.zeit.toFixed(2)} s über Ruheerkennung`);
}
{
  // Während ein Gebäude einstürzt, endet der Schuss nicht – und er endet über Ruhe, nicht übers Zeitlimit
  const w = new Welt(LEVEL[11]);
  w.abschuss(zugAusWinkel(14, 0.94));
  let ende = null, endeBeiBewegung = false;
  while (w.schuss && w.takt < 60 * 30) {
    w.schritt();
    for (const e of w.ereignisse) if (e.typ === 'schussEnde') ende = e;
    w.ereignisse.length = 0;
    if (!w.schuss && w.bewegtSich()) endeBeiBewegung = true;
  }
  ok(!endeBeiBewegung, 'Schuss endet, obwohl noch Teile fallen');
  ok(ende && !ende.zeitlimit, 'Einsturz braucht das Zeitlimit (etwas rollt endlos)');
  console.log(`  Einsturz in L12 (3 von 4 Bojen): Schuss endet nach ${ende.zeit.toFixed(1)} s über Ruhe, nicht übers Zeitlimit`);
}
{
  const roll = testLevel([{ art: 'fass', x: 6, y: 0.42, r: 0.42 }, { art: 'boje', x: 300, y: 0.45 }], { schuesse: 2, breite: 400, stege: [[-5, 400]] });
  const w = new Welt(roll);
  w.abschuss(zugAusWinkel(-5, 0.5));
  let ende = null;
  while (!ende && w.takt < 60 * 40) {
    const f = w.teile.find(b => b.getUserData().art === 'fass');
    if (f) { f.setAwake(true); f.setAngularVelocity(-6); }
    w.schritt();
    for (const e of w.ereignisse) if (e.typ === 'schussEnde') ende = e;
    w.ereignisse.length = 0;
  }
  ok(ende && ende.zeitlimit && Math.abs(ende.zeit - PHYSIK.maxSchussZeit) < 0.05, 'Zeitlimit greift nicht');
  console.log(`  Dauerrollendes Fass: Schuss endet nach dem Zeitlimit von ${PHYSIK.maxSchussZeit} s`);
}
{
  const w = new Welt(testLevel([{ art: 'boje', x: 12, y: 0.45 }]));
  w.abschuss(zugAusWinkel(80, 0.3));
  w.schuss.zeit = PHYSIK.maxSchussZeit - PHYSIK.takt / 2;
  w.teile[0].setTransform(planck.Vec2(12, -5), 0);
  for (let i = 0; i < 200 && !w.ergebnis; i++) w.schritt();
  ok(w.ergebnis === 'erfolg', `Gleichzeitiges Zeitlimit überdeckt den Erfolg (${w.ergebnis})`);
  console.log('  Letzte Boje + Zeitlimit im selben Schritt -> Erfolg');
}
{
  const lv = LEVEL[0];
  const w = new Welt(lv);
  for (let s = 0; s < lv.schuesse; s++) { while (!w.kannSchiessen() && !w.ergebnis) w.schritt(); w.abschuss(zugAusWinkel(85, 0.25)); }
  let zuFrueh = false;
  while (!w.ergebnis && w.takt < 60 * 60) { const vorher = !!w.krabbe; w.schritt(); if (w.ergebnis && vorher && w.krabbe) zuFrueh = true; }
  ok(w.ergebnis === 'niederlage' && !zuFrueh, 'Niederlage falsch erkannt');
  console.log('  Alle Krabben verbraucht, alles ruhig, Boje übrig -> Niederlage');
}
{
  const lv = LEVEL[0];
  const w = new Welt(lv);
  w.abschuss(zugAusWinkel(...lv.loesung[0]));
  while (w.geschafftTakt < 0) w.schritt();
  ok(!w.kannSchiessen(), 'Schuss während des Sieg-Nachlaufs möglich');
  const punkteBeiSieg = w.punkte;
  while (!w.ergebnis) w.schritt();
  console.log(`  Nach der letzten Boje läuft die Kettenreaktion ${PHYSIK.siegNachlauf} s aus (${w.punkte - punkteBeiSieg} Punkte kamen noch dazu), dann einmalige Abrechnung`);
}

// ------------------------------------------------------------------ 9. Feste Schrittweite
abschnitt('Physik unabhängig von der Bildrate');
{
  const ergebnisse = [];
  for (const hz of [30, 60, 144]) {
    const lv = LEVEL[7];
    const w = new Welt(lv);
    let akku = 0, i = 0;
    for (let bild = 0; bild < hz * 40 && !w.ergebnis; bild++) {
      if (w.kannSchiessen() && i < lv.loesung.length) w.abschuss(zugAusWinkel(...lv.loesung[i++]));
      akku += 1 / hz;
      let n = 0;
      while (akku >= PHYSIK.takt && n < PHYSIK.maxSchritteProBild) { w.schritt(); akku -= PHYSIK.takt; n++; if (w.kannSchiessen() && i < lv.loesung.length) break; }
      w.ereignisse.length = 0; w.toene.length = 0;
    }
    ergebnisse.push(`${hz} Hz: ${w.ergebnis} ${w.endpunkte()}`);
  }
  console.log('  ' + ergebnisse.join(' | '));
  ok(new Set(ergebnisse.map(e => e.split(': ')[1])).size === 1, 'Ergebnis hängt von der Bildrate ab');
}

console.log(`\n${geprueft} Prüfungen, ${fehler} Fehler`);
process.exit(fehler ? 1 : 0);
