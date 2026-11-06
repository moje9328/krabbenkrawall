// ===================================================================
// 3 · WELT (Physik und Spielregeln)
// Kennt kein DOM, keinen Bildschirm und keinen Ton. Dadurch läuft genau
// dieselbe Logik im Browser und in den Tests (node quelle/test-logik.js).
// Alles, was Grafik und Ton wissen müssen, landet in welt.ereignisse.
// ===================================================================

const KAT = { STATIK: 0x0001, TEIL: 0x0002, KRABBE: 0x0004, BONUS: 0x0008 };

// Aus Zugvektor (Krabbe relativ zur Ruheposition) Startpunkt und Tempo berechnen.
// Wird von Vorschau UND echtem Abschuss benutzt.
function startwerte(zug) {
  let zx = zug.x, zy = zug.y;
  const laenge = Math.hypot(zx, zy);
  if (laenge > KATAPULT.maxZug) { zx *= KATAPULT.maxZug / laenge; zy *= KATAPULT.maxZug / laenge; }
  if (KATAPULT.y + zy < KATAPULT.minHoehe) zy = KATAPULT.minHoehe - KATAPULT.y;
  const l = Math.hypot(zx, zy);
  const k = KATAPULT.maxTempo / KATAPULT.maxZug;
  return { x: KATAPULT.x + zx, y: KATAPULT.y + zy, vx: -zx * k, vy: -zy * k, zx, zy, laenge: l, staerke: l / KATAPULT.maxZug, gueltig: l >= KATAPULT.minZug };
}

// Tastatur: Winkel (Grad, 0 = waagerecht nach rechts) und Stärke (0..1) -> Zugvektor
function zugAusWinkel(winkelGrad, staerke) {
  const w = winkelGrad * Math.PI / 180;
  const l = staerke * KATAPULT.maxZug;
  return { x: -Math.cos(w) * l, y: -Math.sin(w) * l };
}

// Schwerpunkt eines Vielecks (für Dachstücke)
function schwerpunkt(punkte) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < punkte.length; i++) {
    const [x0, y0] = punkte[i], [x1, y1] = punkte[(i + 1) % punkte.length];
    const k = x0 * y1 - x1 * y0;
    a += k; cx += (x0 + x1) * k; cy += (y0 + y1) * k;
  }
  a /= 2;
  return { x: cx / (6 * a), y: cy / (6 * a) };
}

class Welt {
  constructor(level) {
    this.level = level;
    this.welt = new planck.World({ gravity: planck.Vec2(0, PHYSIK.schwerkraft) });
    this.takt = 0;
    this.teile = [];          // alle Spielkörper (Teile und Bojen)
    this.bonus = [];          // Bonusmünzen (Sensoren)
    this.statik = [];         // für die Grafik: Steg-Abschnitte
    this.ereignisse = [];
    this.punkte = 0;
    this.kettenPunkte = 0;
    this.schuesseUebrig = level.schuesse;
    this.bojenGesamt = 0;
    this.bojenUebrig = 0;
    this.bonusGesamt = 0;
    this.bonusGesammelt = 0;
    this.zerstoert = 0;
    this.krabbe = null;       // { body, phase, ruhe, zeit, kontakt, erster }
    this.schuss = null;       // { zeit, ruhe, kette, letzteZerstoerung, kettenSumme } solange ein Schuss läuft
    this.schussNummer = 0;
    this.geschafftTakt = -1;
    this.ergebnis = null;     // null | 'erfolg' | 'niederlage'
    this.restBonus = 0;
    this.schadenAn = false;
    this.bruchZahl = 0;
    this.schlag = new Map();  // Körper -> stärkster Aufprall in diesem Schritt
    this.bojenTreffer = new Map();
    this.toene = [];
    this.zaehler = 0;
    this.baue();
    this.hoerer = (kontakt) => this.vorKontakt(kontakt);
    this.welt.on('pre-solve', this.hoerer);
    this.vorlauf();
  }

  // ---------------------------------------------------------------- Aufbau
  baue() {
    const L = this.level;
    for (const [x0, x1] of L.stege) {
      const body = this.welt.createBody({ type: 'static', position: planck.Vec2((x0 + x1) / 2, -1.5) });
      body.createFixture(planck.Box((x1 - x0) / 2, 1.5), { friction: 0.8, filterCategoryBits: KAT.STATIK, filterMaskBits: 0xffff });
      body.setUserData({ art: 'steg', statisch: true });
      this.statik.push({ art: 'steg', x0, x1 });
    }
    // Kaimauern: feste, erhöhte Steinkanten (Gelände, kein Gebäudeteil)
    for (const [x0, x1, oben] of (L.mauern || [])) {
      const body = this.welt.createBody({ type: 'static', position: planck.Vec2((x0 + x1) / 2, (oben - 3) / 2) });
      body.createFixture(planck.Box((x1 - x0) / 2, (oben + 3) / 2), { friction: 0.85, filterCategoryBits: KAT.STATIK, filterMaskBits: 0xffff });
      body.setUserData({ art: 'mauer', statisch: true });
      this.statik.push({ art: 'mauer', x0, x1, oben });
    }
    for (const t of L.teile) {
      if (t.art === 'bonus') this.neuerBonus(t);
      else this.neuesTeil(t);
    }
  }

  neuesTeil(t, extra = {}) {
    const m = MATERIAL[t.art];
    let x = t.x, y = t.y, form = null;
    if (t.punkte) { const s = schwerpunkt(t.punkte); x = s.x; y = s.y; form = t.punkte.map(([px, py]) => [px - s.x, py - s.y]); }
    const body = this.welt.createBody({ type: 'dynamic', position: planck.Vec2(x, y), angle: (t.a || 0) * Math.PI / 180 });
    const fix = { density: m.dichte, friction: m.reibung, restitution: m.rueckprall, filterCategoryBits: KAT.TEIL, filterMaskBits: KAT.STATIK | KAT.TEIL | KAT.KRABBE | KAT.BONUS };
    let r = 0, w = 0, h = 0;
    if (form) {
      body.createFixture(planck.Polygon(form.map(([px, py]) => planck.Vec2(px, py))), fix);
    } else if (t.art === 'fass' || t.art === 'fassVoll') {
      r = t.r || 0.42;
      body.createFixture(planck.Circle(r), fix);
    } else if (t.art === 'boje') {
      // Achteck statt Kreis: liegt ruhig und rollt nicht von allein davon.
      // Die Grafik zeichnet genau dieses gepolsterte Achteck.
      r = t.r || 0.48;
      const ecken = [];
      for (let i = 0; i < 8; i++) { const wi = (i + 0.5) * Math.PI / 4; ecken.push(planck.Vec2(Math.cos(wi) * r, Math.sin(wi) * r)); }
      body.createFixture(planck.Polygon(ecken), fix);
    } else {
      w = t.w || 1; h = t.h || 1;
      body.createFixture(planck.Box(w / 2, h / 2), fix);
    }
    if (m.winkelDaempfung) body.setAngularDamping(m.winkelDaempfung);
    if (t.art === 'boje') body.setAngularDamping(0.8);
    const ud = {
      id: this.zaehler++, art: t.art, r, w, h, form, farbe: t.farbe || 0, stil: t.stil || '',
      schaden: m.haltbar ? (t.riss || 0) * m.haltbar : 0, angeschlagen: !!t.riss,
      bruchstueck: !!extra.bruchstueck, weg: false, aktiv: false, px: x, py: y, pa: body.getAngle(),
    };
    body.setUserData(ud);
    this.teile.push(body);
    if (t.art === 'boje') { this.bojenGesamt++; this.bojenUebrig++; }
    return body;
  }

  // Bonusmünze: unbeweglicher Sensor, stützt nichts
  neuerBonus(t) {
    const body = this.welt.createBody({ type: 'static', position: planck.Vec2(t.x, t.y) });
    body.createFixture(planck.Circle(BONUS.radius), { isSensor: true, filterCategoryBits: KAT.BONUS, filterMaskBits: KAT.TEIL | KAT.KRABBE });
    body.setUserData({ art: 'bonus', statisch: true, id: this.zaehler++, x: t.x, y: t.y, weg: false });
    this.bonus.push(body);
    this.bonusGesamt++;
  }

  // Einschwingen ohne Schaden, danach alles schlafen legen: so steht ein Level
  // beim ersten Zielen garantiert ruhig.
  vorlauf() {
    for (let i = 0; i < PHYSIK.vorlauf; i++) this.welt.step(PHYSIK.takt, PHYSIK.geschwIter, PHYSIK.posIter);
    for (const b of this.teile) {
      b.setLinearVelocity(planck.Vec2(0, 0));
      b.setAngularVelocity(0);
      b.setAwake(false);
      const ud = b.getUserData(), p = b.getPosition();
      ud.px = p.x; ud.py = p.y; ud.pa = b.getAngle();
    }
    this.schlag.clear();
    this.bojenTreffer.clear();
    this.schadenAn = true;
  }

  // ---------------------------------------------------------------- Kontakte
  // Wird VOR dem Lösen eines Kontakts aufgerufen. Hier ist das Annäherungstempo
  // noch messbar. Je Körper zählt pro Schritt nur der stärkste Aufprall.
  vorKontakt(kontakt) {
    if (!this.schadenAn) return;
    const fA = kontakt.getFixtureA(), fB = kontakt.getFixtureB();
    if (fA.isSensor() || fB.isSensor()) return;
    const a = fA.getBody(), b = fB.getBody();
    const anzahl = kontakt.getManifold().pointCount;
    if (!anzahl) return;
    const wm = kontakt.getWorldManifold(null);
    if (!wm || !wm.points) return;
    const n = wm.normal;
    let vn = 0;
    for (let i = 0; i < anzahl; i++) {
      const p = wm.points[i];
      const va = a.getLinearVelocityFromWorldPoint(p), vb = b.getLinearVelocityFromWorldPoint(p);
      vn = Math.max(vn, (va.x - vb.x) * n.x + (va.y - vb.y) * n.y);
    }
    const ua = a.getUserData() || {}, ub = b.getUserData() || {};
    // Erster Treffpunkt der Krabbe (für Tests und Rückmeldung)
    const k = this.krabbe;
    if (k && !k.erster && (ua.art === 'krabbe' || ub.art === 'krabbe')) {
      const anderer = ua.art === 'krabbe' ? ub : ua;
      k.erster = { art: anderer.art, id: anderer.id, x: wm.points[0].x, y: wm.points[0].y };
    }
    if (vn <= 0.5) return;
    const ma = a.isDynamic() ? a.getMass() : Infinity, mb = b.isDynamic() ? b.getMass() : Infinity;
    const mred = ma === Infinity ? mb : mb === Infinity ? ma : (ma * mb) / (ma + mb);
    for (const [kb, u, anderer] of [[a, ua, ub], [b, ub, ua]]) {
      if (!u.art || u.statisch || u.weg) continue;
      if (u.art === 'boje') {
        if (!u.aktiv && vn >= BOJE_AKTIV.tempo && mred * vn >= BOJE_AKTIV.staerke) this.bojenTreffer.set(kb, anderer.art || 'steg');
        continue;
      }
      const m = MATERIAL[u.art];
      if (!m || !m.haltbar) continue;
      const staerke = mred * (vn - m.schwelle);
      if (staerke > 0 && staerke > (this.schlag.get(kb) || 0)) this.schlag.set(kb, staerke);
      if (vn > 2.2) this.toene.push({ ton: m.ton, kraft: Math.min(1, mred * vn / 12), x: kb.getPosition().x });
    }
    if ((ua.art === 'krabbe' || ub.art === 'krabbe') && vn > 3) {
      const kr = ua.art === 'krabbe' ? a : b;
      this.ereignisse.push({ typ: 'krabbeStoss', x: kr.getPosition().x, y: kr.getPosition().y, kraft: vn });
    }
  }

  // ---------------------------------------------------------------- Abschuss
  kannSchiessen() { return !this.ergebnis && this.geschafftTakt < 0 && !this.schuss && !this.krabbe && this.schuesseUebrig > 0; }

  abschuss(zug) {
    if (!this.kannSchiessen()) return false;
    const s = startwerte(zug);
    if (!s.gueltig) return false;
    const P = KRABBE_PHYSIK;
    const body = this.welt.createBody({ type: 'dynamic', position: planck.Vec2(s.x, s.y), bullet: true });
    body.createFixture(planck.Circle(P.radius), { density: P.dichte, friction: P.reibung, restitution: P.rueckprall, filterCategoryBits: KAT.KRABBE, filterMaskBits: KAT.STATIK | KAT.TEIL | KAT.BONUS });
    body.setAngularDamping(P.winkelDaempfung);
    body.setLinearVelocity(planck.Vec2(s.vx, s.vy));
    body.setUserData({ art: 'krabbe', px: s.x, py: s.y, pa: 0 });
    this.krabbe = { body, phase: 'flug', ruhe: 0, zeit: 0, kontakt: false, verdutzt: 0, start: s, erster: null };
    this.schuss = { zeit: 0, ruhe: 0, kette: 0, letzteZerstoerung: -1e9, kettenSumme: 0 };
    this.schuesseUebrig--;
    this.schussNummer++;
    this.ereignisse.push({ typ: 'abschuss', staerke: s.staerke });
    return true;
  }

  // Vorschau: dieselbe Schwerkraft, derselbe Takt und dieselbe Rechenreihenfolge
  // wie Box2D (erst Tempo, dann Ort). Endet am ersten vorhergesagten Kontakt.
  flugbahn(zug, dauer = KATAPULT.vorschauZeit) {
    const s = startwerte(zug);
    const dt = PHYSIK.takt, g = PHYSIK.schwerkraft;
    let x = s.x, y = s.y, vx = s.vx, vy = s.vy;
    const punkte = [{ x, y }];
    const n = Math.round(dauer / dt);
    let kontakt = null;
    for (let i = 0; i < n; i++) {
      vy += dt * g;
      x += dt * vx;
      y += dt * vy;
      if (y < PHYSIK.wasserY || this.kreisBeruehrt(x, y, KRABBE_PHYSIK.radius)) { kontakt = { x, y }; break; }
      punkte.push({ x, y });
    }
    return { punkte, kontakt, start: s };
  }

  kreisBeruehrt(x, y, r) {
    const kreis = planck.Circle(r);
    const xf = planck.Transform(planck.Vec2(x, y), 0);
    let treffer = false;
    const box = { lowerBound: planck.Vec2(x - r, y - r), upperBound: planck.Vec2(x + r, y + r) };
    this.welt.queryAABB(box, (fix) => {
      if (fix.isSensor()) return true;
      const kat = fix.getFilterCategoryBits();
      if (!(kat & (KAT.STATIK | KAT.TEIL))) return true;
      const shape = fix.getShape(), body = fix.getBody();
      for (let c = 0; c < shape.getChildCount(); c++) {
        if (planck.testOverlap(kreis, 0, shape, c, xf, body.getTransform())) { treffer = true; return false; }
      }
      return true;
    });
    return treffer;
  }

  // ---------------------------------------------------------------- Schritt
  schritt() {
    for (const b of this.teile) { const u = b.getUserData(), p = b.getPosition(); u.px = p.x; u.py = p.y; u.pa = b.getAngle(); }
    if (this.krabbe) { const u = this.krabbe.body.getUserData(), p = this.krabbe.body.getPosition(); u.px = p.x; u.py = p.y; u.pa = this.krabbe.body.getAngle(); }

    this.schlag.clear();
    this.bojenTreffer.clear();
    this.welt.step(PHYSIK.takt, PHYSIK.geschwIter, PHYSIK.posIter);
    this.takt++;
    const dt = PHYSIK.takt;

    // Schaden nach Aufprallstärke
    for (const [body, staerke] of this.schlag) {
      const u = body.getUserData();
      if (u.weg) continue;
      u.schaden += staerke;
      if (u.schaden >= MATERIAL[u.art].haltbar) this.entferne(body, 'bruch');
    }
    // Bojen
    for (const [body, durch] of this.bojenTreffer) this.aktiviereBoje(body, 'treffer', durch);
    // Bonusmünzen
    this.bonusPruefen();

    // Wasser und Weltgrenzen
    const rechts = this.level.breite + GRENZEN.weltRand, links = -GRENZEN.weltRand;
    for (const b of this.teile) {
      const u = b.getUserData();
      if (u.weg) continue;
      const p = b.getPosition();
      if (p.y < PHYSIK.imWasserY || p.x < links || p.x > rechts) {
        if (u.art === 'boje') this.aktiviereBoje(b, 'wasser');
        else this.entferne(b, p.y < PHYSIK.imWasserY ? 'wasser' : 'raus');
      }
    }
    this.teile = this.teile.filter(b => !b.getUserData().weg);

    this.rollwiderstand();
    this.krabbeSchritt(dt);
    this.schussSchritt(dt);
    this.ergebnisPruefen();
  }

  // Box2D kennt keinen Rollwiderstand: langsam rollende Fässer würden fast
  // endlos weiterrollen. Liegen sie auf, bremsen wir sie sanft ab.
  rollwiderstand() {
    for (const b of this.teile) {
      const u = b.getUserData();
      if ((u.art !== 'fass' && u.art !== 'fassVoll') || !b.isAwake()) continue;
      const v = b.getLinearVelocity();
      if (Math.hypot(v.x, v.y) > PHYSIK.rollBremseAb) continue;
      let liegt = false;
      for (let ce = b.getContactList(); ce; ce = ce.next) if (ce.contact.isTouching()) { liegt = true; break; }
      if (!liegt) continue;
      b.setLinearVelocity(planck.Vec2(v.x * PHYSIK.rollBremse, v.y));
      b.setAngularVelocity(b.getAngularVelocity() * PHYSIK.rollBremse);
    }
  }

  // Münze einsammeln: nur durch die Krabbe oder ein schnell bewegtes Teil.
  // Ein Teil, das ruhig an einer Münze liegt, sammelt sie nie.
  bonusPruefen() {
    let gesammelt = false;
    for (const m of this.bonus) {
      const u = m.getUserData();
      if (u.weg) continue;
      for (let ce = m.getContactList(); ce; ce = ce.next) {
        if (!ce.contact.isTouching()) continue;
        const anderer = ce.other, ua = anderer.getUserData() || {};
        const v = anderer.getLinearVelocity();
        if (ua.art === 'krabbe' || Math.hypot(v.x, v.y) >= BONUS.mindestTempo) {
          u.weg = true;
          gesammelt = true;
          this.bonusGesammelt++;
          this.punkte += PUNKTE.bonus;
          this.ereignisse.push({ typ: 'bonus', x: u.x, y: u.y, punkte: PUNKTE.bonus, id: u.id, durch: ua.art });
          break;
        }
      }
    }
    if (gesammelt) {
      for (const m of this.bonus) if (m.getUserData().weg) this.welt.destroyBody(m);
      this.bonus = this.bonus.filter(m => !m.getUserData().weg);
    }
  }

  aktiviereBoje(body, wie, durch = wie) {
    const u = body.getUserData();
    if (u.aktiv || u.weg) return;
    u.aktiv = true;
    u.weg = true;
    const p = body.getPosition();
    this.bojenUebrig--;
    this.punkte += PUNKTE.boje;
    this.ereignisse.push({ typ: 'boje', x: p.x, y: p.y, wie, durch, punkte: PUNKTE.boje, id: u.id, a: body.getAngle() });
    this.welt.destroyBody(body);
    if (this.bojenUebrig === 0 && this.geschafftTakt < 0) this.geschafftTakt = this.takt;
  }

  // Ein Teil verschwindet: zerbrochen, ins Wasser gefallen oder aus der Welt.
  // Punkte gibt es genau einmal, weil u.weg danach gesetzt ist. Bruchhälften
  // bringen keine Punkte mehr (kein Punkte-Sammeln durch Zerkleinern).
  entferne(body, wie) {
    const u = body.getUserData();
    if (u.weg) return;
    u.weg = true;
    const m = MATERIAL[u.art];
    const p = body.getPosition(), v = body.getLinearVelocity(), a = body.getAngle();
    const punkte = u.bruchstueck ? 0 : m.punkte;
    this.punkte += punkte;
    if (!u.bruchstueck) this.zerstoert++;
    const kette = u.bruchstueck ? 0 : this.kettenbonus();
    this.ereignisse.push({ typ: wie === 'bruch' ? 'bruch' : wie, art: u.art, x: p.x, y: p.y, a, w: u.w, h: u.h, r: u.r, form: u.form, farbe: u.farbe, punkte, kette, ton: m.ton, vx: v.x, vy: v.y, id: u.id });
    const wDreh = body.getAngularVelocity();
    this.welt.destroyBody(body);
    if (wie === 'bruch') this.halbieren(u, p, v, a, wDreh);
  }

  // Kurz nacheinander zerstörte Teile geben einen begrenzten Kettenbonus
  kettenbonus() {
    const s = this.schuss;
    if (!s) return 0;
    const fenster = Math.round(PUNKTE.ketteFenster / PHYSIK.takt);
    s.kette = this.takt - s.letzteZerstoerung <= fenster ? s.kette + 1 : 1;
    s.letzteZerstoerung = this.takt;
    if (s.kette < 2) return 0;
    const bonus = Math.min(PUNKTE.kette * Math.min(s.kette - 1, PUNKTE.ketteMax), PUNKTE.ketteDeckel - s.kettenSumme);
    if (bonus <= 0) return 0;
    s.kettenSumme += bonus;
    this.kettenPunkte += bonus;
    this.punkte += bonus;
    return bonus;
  }

  // Lange Balken brechen in zwei echte Hälften, die weiter fallen und stoßen
  halbieren(u, p, v, a, w) {
    if (u.bruchstueck || !u.w || Math.max(u.w, u.h) < GRENZEN.bruchAbLaenge) return;
    if (u.art !== 'holz' && u.art !== 'metall') return;
    if (this.bruchZahl >= GRENZEN.bruchstuecke) return;
    const lang = u.w >= u.h;
    for (const s of [-1, 1]) {
      const versatz = (lang ? u.w : u.h) / 4;
      const dx = lang ? Math.cos(a) * versatz * s : -Math.sin(a) * versatz * s;
      const dy = lang ? Math.sin(a) * versatz * s : Math.cos(a) * versatz * s;
      const t = { art: u.art, x: p.x + dx, y: p.y + dy, w: lang ? u.w / 2 - 0.04 : u.w, h: lang ? u.h : u.h / 2 - 0.04, a: a * 180 / Math.PI, farbe: u.farbe };
      const b = this.neuesTeil(t, { bruchstueck: true });
      b.setLinearVelocity(planck.Vec2(v.x, v.y));
      b.setAngularVelocity(w + s * 0.8);
      b.getUserData().schaden = MATERIAL[u.art].haltbar * 0.4;
      this.bruchZahl++;
    }
  }

  krabbeSchritt(dt) {
    const k = this.krabbe;
    if (!k) return;
    const b = k.body;
    k.zeit += dt;
    if (!k.kontakt) {
      for (let ce = b.getContactList(); ce; ce = ce.next) {
        if (ce.contact.isTouching() && !ce.contact.getFixtureA().isSensor() && !ce.contact.getFixtureB().isSensor()) {
          k.kontakt = true;
          b.setLinearDamping(KRABBE_PHYSIK.daempfungNachKontakt);
          k.phase = 'rollt';
          const p = b.getPosition();
          this.ereignisse.push({ typ: 'landung', x: p.x, y: p.y });
          break;
        }
      }
    }
    const p = b.getPosition();
    if (p.y < PHYSIK.imWasserY || p.x < -GRENZEN.weltRand || p.x > this.level.breite + GRENZEN.weltRand) {
      this.ereignisse.push({ typ: p.y < PHYSIK.imWasserY ? 'krabbePlatsch' : 'krabbeWeg', x: p.x, y: p.y });
      this.krabbeWeg(false);
      return;
    }
    const v = b.getLinearVelocity();
    const ruhig = Math.hypot(v.x, v.y) < 0.25 && Math.abs(b.getAngularVelocity()) < 0.6;
    if (k.phase === 'verdutzt') {
      k.verdutzt += dt;
      if (k.verdutzt >= PHYSIK.krabbeVerdutzt) this.krabbeWeg(true);
    } else {
      k.ruhe = ruhig ? k.ruhe + dt : 0;
      if (k.ruhe >= PHYSIK.krabbeRuheZeit || k.zeit >= PHYSIK.krabbeMaxFlug) { k.phase = 'verdutzt'; k.verdutzt = 0; this.ereignisse.push({ typ: 'verdutzt', x: p.x, y: p.y }); }
    }
  }

  krabbeWeg(puff) {
    const b = this.krabbe.body, p = b.getPosition();
    if (puff) this.ereignisse.push({ typ: 'puff', x: p.x, y: p.y });
    this.welt.destroyBody(b);
    this.krabbe = null;
  }

  // Bewegt sich noch etwas Relevantes? Winzige Körper zählen nicht mit.
  bewegtSich() {
    for (const b of this.teile) {
      if (!b.isAwake() || b.getMass() < PHYSIK.ruheMasse) continue;
      const v = b.getLinearVelocity();
      if (Math.hypot(v.x, v.y) > PHYSIK.ruheTempo || Math.abs(b.getAngularVelocity()) > PHYSIK.ruheDrehung) return true;
    }
    return false;
  }

  schussSchritt(dt) {
    const s = this.schuss;
    if (!s) return;
    s.zeit += dt;
    s.ruhe = (this.krabbe || this.bewegtSich()) ? 0 : s.ruhe + dt;
    if (s.ruhe >= PHYSIK.ruheZeit || s.zeit >= PHYSIK.maxSchussZeit) {
      if (this.krabbe) this.krabbeWeg(true);
      this.schuss = null;
      this.ereignisse.push({ typ: 'schussEnde', zeit: s.zeit, zeitlimit: s.ruhe < PHYSIK.ruheZeit });
    }
  }

  // Darf der Spieler schon die nächste Krabbe holen? (Krabbe ist fertig, Rest rollt noch)
  kannNaechste() { return !!this.schuss && !this.krabbe && this.schuesseUebrig > 0 && !this.ergebnis && this.geschafftTakt < 0; }
  naechsteKrabbe() {
    if (!this.kannNaechste()) return false;
    this.schuss = null;
    this.ereignisse.push({ typ: 'schussEnde', vorzeitig: true });
    return true;
  }

  // Erfolg hat immer Vorrang: Er wird geprüft, bevor eine Niederlage überhaupt möglich ist.
  ergebnisPruefen() {
    if (this.ergebnis) return;
    if (this.geschafftTakt >= 0) {
      if (this.takt - this.geschafftTakt >= Math.round(PHYSIK.siegNachlauf / PHYSIK.takt)) {
        this.restBonus = this.schuesseUebrig * PUNKTE.krabbeUebrig;
        this.ergebnis = 'erfolg';
        this.ereignisse.push({ typ: 'erfolg' });
      }
      return;
    }
    if (this.schuesseUebrig === 0 && !this.schuss && !this.krabbe && this.bojenUebrig > 0) {
      this.ergebnis = 'niederlage';
      this.ereignisse.push({ typ: 'niederlage' });
    }
  }

  endpunkte() { return this.punkte + (this.restBonus || 0); }

  sterne() {
    if (this.ergebnis !== 'erfolg') return 0;
    const p = this.endpunkte(), [zwei, drei] = this.level.sterne;
    return p >= drei ? 3 : p >= zwei ? 2 : 1;
  }

  aufraeumen() {
    // Alle Körper aus der Welt nehmen, damit nichts weiterläuft oder Arbeitsspeicher belegt
    for (let b = this.welt.getBodyList(); b;) { const n = b.getNext(); this.welt.destroyBody(b); b = n; }
    this.welt.off('pre-solve', this.hoerer);
    this.teile = []; this.bonus = []; this.krabbe = null; this.ereignisse = [];
  }
}
