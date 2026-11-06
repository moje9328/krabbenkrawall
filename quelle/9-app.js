// ===================================================================
// 9 · APP
// Zustände: menue, intro, zielen, flug, zurueck, pause, erfolg, niederlage.
// Es gibt genau EINEN Game Loop (requestAnimationFrame). Die Physik läuft in
// festen Schritten (PHYSIK.takt) und nur in intro/zielen/flug/zurueck.
// ===================================================================

(() => {
  const $ = (id) => document.getElementById(id);
  const leinwand = $('bild');
  const wurzel = document.documentElement;
  const LAUFEND = ['intro', 'zielen', 'flug', 'zurueck'];

  const SPRUECHE_SCHADE = [
    'Die Bojen grinsen. Noch.',
    'Kisten 1, Krabbe 0. Revanche!',
    'Das war nur der Probewurf. Ganz bestimmt.',
    'Die Möwen haben nichts gesehen. Fast nichts.',
    '%n schüttelt sich kurz und will sofort wieder.',
    'Knapp daneben ist auch ein bisschen getroffen.',
  ];
  const SPRUECHE_ERFOLG = [
    '%n klopft sich den Staub vom Panzer.',
    'Das Lager ist jetzt sehr gut gelüftet.',
    '%n: „Ich wollte nur kurz vorbeischauen.“',
    'Die Möwen applaudieren. Glaube ich.',
    'Statik ist auch nur eine Meinung.',
  ];
  const TITEL_ERFOLG = ['Krawall gelungen!', 'Alle Bojen erwischt!', 'Hafen aufgeräumt!', 'Scherenstark!'];

  let zustand = 'menue', vorPause = null;
  let levelIndex = 0, lv = LEVEL[0];
  let welt = null;
  let zug = null;              // aktueller Zugvektor (Welt-Meter) oder null
  let tastaturAktiv = false, tWinkel = KATAPULT.winkelStart, tStaerke = KATAPULT.staerkeStart;
  let akku = 0, letzte = 0, malZeit = 0;
  let introZeit = 0, introStart = null;
  let anim = { phase: 'bereit', t: 0, klammer: 0, winkel: 0, hop: 0 };
  let letzterZugTon = 0;
  let hudCache = '';
  let meldungBis = 0;
  let erfolgTanz = false;
  let uebersicht = false;      // Schmaler Bildschirm: Spieler will gerade alles sehen
  let kameraRuhig = false;     // Zielen erst, wenn die Kamera stillsteht

  // ---------------------------------------------------------- Grundaufbau
  Grafik.init(leinwand);
  Eingabe.init(leinwand, {
    zustand: () => zustand,
    darfZielen: () => zustand === 'zielen' && kameraRuhig && welt && welt.kannSchiessen(),
    krabbenPunkt,
    introUeberspringen,
    zugStart() { tastaturAktiv = false; anim.phase = 'zielen'; },
    zugSetzen,
    loslassen,
    zugAbbrechen() { zug = null; anim.phase = 'bereit'; },
    pause, weiter, neustart, naechsteKrabbe,
    fensterOffen: () => !$('fenster').hidden,
    tonUmschalten,
    tastatur,
    tastaturSchuss,
    uebersichtUmschalten,
  });
  if (window.matchMedia && matchMedia('(pointer: coarse)').matches) wurzel.classList.add('touch');
  window.addEventListener('pointerdown', (e) => { wurzel.classList.toggle('touch', e.pointerType === 'touch'); }, { capture: true, passive: true });

  function setzeZustand(z) {
    zustand = z;
    wurzel.dataset.zustand = z;
  }

  // ---------------------------------------------------------- Level
  function starteLevel(i) {
    if (welt) welt.aufraeumen();
    Eingabe.abbrechen();
    levelIndex = i;
    lv = LEVEL[i];
    welt = new Welt(lv, 1 + i);
    zug = null;
    tastaturAktiv = false;
    tWinkel = KATAPULT.winkelStart; tStaerke = KATAPULT.staerkeStart;
    akku = 0;
    anim = { phase: 'bereit', t: 0, klammer: 0, winkel: 0, hop: 0 };
    erfolgTanz = false;
    hudCache = '';
    Grafik.groesse();
    Grafik.setzeLevel(lv);
    zeigeFenster(null);
    // Kamera-Intro: von der Konstruktion zur Gesamtansicht
    const ziel = Grafik.ansicht(lv);
    const mitTeilen = lv.teile.filter(t => Number.isFinite(t.x));
    const mitte = mitTeilen.reduce((s, t) => s + t.x, 0) / mitTeilen.length;
    introStart = { x: mitte, y: ziel.y + 0.5, z: ziel.z * 1.45 };
    Object.assign(Grafik.kam, introStart);
    introZeit = 0;
    uebersicht = false;
    kameraRuhig = false;
    setzeZustand('intro');
    if (i === 0 || !Speicher.level(lv.id)) zeigeMeldung('Zieh die Krabbe zurück und triff die Stützen!', i === 0 ? 'Zerstöre alle Zielbojen. Sammle Münzen für Extrapunkte.' : `${lv.name}: ${lv.tipp}`, 3.6);
    else zeigeMeldung(`${GEBIETE[lv.gebiet].name} · ${lv.name}`, lv.tipp, 2.6);
    $('ansage').textContent = `Level ${lv.id}: ${lv.name}. ${lv.bojen || ''}`;
    leinwand.focus({ preventScroll: true });
    aktualisiereHud(true);
  }

  function neustart() { Ton.klick(); starteLevel(levelIndex); }

  function introUeberspringen() { if (zustand === 'intro') introZeit = 99; }

  // ---------------------------------------------------------- Zielen
  function krabbenPunkt() {
    if (zug) { const s = startwerte(zug); return { x: s.x, y: s.y }; }
    return { x: KATAPULT.x, y: KATAPULT.y };
  }

  function zugSetzen(z) {
    zug = z;
    const s = startwerte(z);
    if (Math.abs(s.staerke - letzterZugTon) > 0.06) { Ton.knarzen(s.staerke); letzterZugTon = s.staerke; }
  }

  function loslassen() {
    if (!zug) return;
    const s = startwerte(zug);
    if (!s.gueltig || !welt.abschuss(zug)) {
      // zu wenig gezogen: kein Versuch verbraucht
      zug = null; anim.phase = 'bereit';
      if (!s.gueltig) zeigeMeldung('Weiter zurückziehen!', null, 1.2);
      return;
    }
    zug = null;
    tastaturAktiv = false;
    anim = { phase: 'los', t: 0, klammer: 1, winkel: 0, hop: 0 };
    setzeZustand('flug');
  }

  function tastatur(dWinkel, dStaerke) {
    if (!tastaturAktiv) {
      tastaturAktiv = true;
      if (zug) { const s = startwerte(zug); tWinkel = Math.atan2(-s.zy, -s.zx) * 180 / Math.PI; tStaerke = s.staerke; }
    } else {
      tWinkel = begrenzt(tWinkel + dWinkel, KATAPULT.winkelMin, KATAPULT.winkelMax);
      tStaerke = begrenzt(tStaerke + dStaerke, KATAPULT.staerkeMin, 1);
    }
    anim.phase = 'zielen';
    zugSetzen(zugAusWinkel(tWinkel, tStaerke));
  }

  function tastaturSchuss() {
    if (!tastaturAktiv) { tastatur(0, 0); return; }   // erster Druck zeigt die Vorschau
    loslassen();
  }

  function naechsteKrabbe() {
    if (welt && zustand === 'flug' && welt.naechsteKrabbe()) { Ton.klick(); setzeZustand('zurueck'); }
  }

  // ---------------------------------------------------------- Pause
  function pause() {
    if (!LAUFEND.includes(zustand)) return;
    Eingabe.abbrechen();
    if (zustand === 'zielen' && !tastaturAktiv) { zug = null; anim.phase = 'bereit'; }
    vorPause = zustand;
    setzeZustand('pause');
    $('pauseText').textContent = `Level ${lv.id} · ${lv.name}. Bojen übrig: ${welt.bojenUebrig}.`;
    zeigeFenster('fPause');
  }

  function weiter() {
    if (zustand !== 'pause') return;
    zeigeFenster(null);
    setzeZustand(vorPause || 'zielen');
    letzte = performance.now();
    akku = 0;
    leinwand.focus({ preventScroll: true });
  }

  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  window.addEventListener('pagehide', () => pause());

  // ---------------------------------------------------------- Game Loop
  function rahmen(jetzt) {
    requestAnimationFrame(rahmen);
    let dt = letzte ? (jetzt - letzte) / 1000 : 0;
    letzte = jetzt;
    dt = Math.min(dt, 0.1);
    malZeit += dt;

    if (welt && LAUFEND.includes(zustand) && !welt.ergebnis) {
      akku += dt;
      let n = 0;
      while (akku >= PHYSIK.takt && n < PHYSIK.maxSchritteProBild) {
        welt.schritt();
        verarbeite();
        akku -= PHYSIK.takt;
        n++;
        if (welt.ergebnis) break;
      }
      if (n >= PHYSIK.maxSchritteProBild) akku = 0;
    }

    if (welt && LAUFEND.includes(zustand)) {
      ablauf(dt);
      kamera(dt);
    }
    if (welt && zustand !== 'menue') {
      Grafik.groesse();
      Grafik.bild(welt, bildInfo(), zustand === 'pause' ? 0 : dt);
      aktualisiereHud();
    }
    if (!$('fStart').hidden) krabbeInLeinwand($('startKrabbe'), { figur: Speicher.krabbe(), lauf: malZeit * 1.2, wedel: malZeit, blick: Math.sin(malZeit * 1.1), tanzt: true, mund: Math.sin(malZeit * 0.7) > 0.8 ? 'jubel' : undefined });
    if (erfolgTanz) krabbeInLeinwand($('erfolgKrabbe'), { figur: Speicher.krabbe(), lauf: malZeit * 2, wedel: malZeit, tanzt: true, schereAuf: true, mund: 'jubel', blickHoch: true });
    if (!$('fKrabben').hidden) malKrabbenKarten();
    if (meldungBis && malZeit > meldungBis) { $('meldung').hidden = true; meldungBis = 0; }
  }

  // Zustandswechsel, die von der Welt abhängen
  function ablauf(dt) {
    anim.t += dt;
    if (zustand === 'intro') {
      introZeit += dt;
      if (introZeit >= introDauer()) setzeZustand('zielen');
    }
    if (zustand === 'flug' && !welt.schuss) setzeZustand('zurueck');
    if (welt.ergebnis === 'erfolg') zeigeErfolg();
    else if (welt.ergebnis === 'niederlage') zeigeNiederlage();
    // Krabben-Animation
    if (anim.phase === 'los') { anim.klammer = Math.max(0, 1 - anim.t / 0.18); if (anim.t > 0.18) anim.phase = 'flug'; }
    if (welt.krabbe && welt.krabbe.phase === 'rollt' && anim.phase === 'flug') anim.phase = 'rollt';
    if (welt.krabbe && welt.krabbe.phase === 'verdutzt') anim.phase = 'verdutzt';
    if (!welt.krabbe && ['flug', 'rollt', 'verdutzt', 'los'].includes(anim.phase) && zustand !== 'flug') { anim.phase = 'hop'; anim.t = 0; }
    if (anim.phase === 'hop' && anim.t > 0.35) { anim.phase = 'bereit'; }
    const kn = $('naechsteKnopf');
    const zeigeNaechste = zustand === 'flug' && welt.kannNaechste();
    if (kn.hidden === zeigeNaechste) kn.hidden = !zeigeNaechste;
  }

  // ---------------------------------------------------------- Kamera
  // Schmale Bildschirme: 1,3 s Weg zur Übersicht, 1 s Pause, 1 s zum Katapult
  const introDauer = () => (Grafik.istEng(lv) ? 3.3 : 1.4);
  const glatt = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  function mische(k, a, b, t) { k.x = a.x + (b.x - a.x) * t; k.y = a.y + (b.y - a.y) * t; k.z = a.z + (b.z - a.z) * t; }

  function kamera(dt) {
    const k = Grafik.kam;
    const ganz = Grafik.ansicht(lv);
    const zielen = Grafik.zielAnsicht(lv);
    const eng = Grafik.istEng(lv);
    wurzel.classList.toggle('eng', eng);
    if (zustand === 'intro') {
      const t1 = Math.min(1, introZeit / 1.3);
      if (!eng || introZeit < 2.3) mische(k, introStart, ganz, glatt(t1));
      else mische(k, ganz, zielen, glatt(Math.min(1, (introZeit - 2.3) / 1.0)));
      return;
    }
    let soll = zielen;
    if (zustand === 'zielen') {
      // Während eines Zugs bewegt sich die Kamera nie
      if (Eingabe.ziehtGerade() || zug) return;
      soll = eng && uebersicht ? ganz : zielen;
    } else if (zustand === 'flug' && welt.krabbe) {
      soll = { ...zielen };
      if (eng && welt.krabbe.kontakt) soll = Grafik.gebaeudeAnsicht(lv);   // nach dem Aufprall den Einsturz zeigen
      else {
        // Der Krabbe nur folgen, wenn sie aus dem Bild zu fliegen droht
        const p = welt.krabbe.body.getPosition();
        const halbB = (Grafik.cssW * Grafik.dpr) / 2 / soll.z, halbH = (Grafik.cssH * Grafik.dpr) / 2 / soll.z;
        const randX = halbB * (eng ? 0.4 : 0.75), randY = halbH * 0.7;
        if (p.x > soll.x + randX) soll.x = p.x - randX;
        if (p.x < soll.x - randX) soll.x = p.x + randX;
        if (p.y > soll.y + randY) soll.y = p.y - randY;
      }
    } else if (zustand === 'flug') {
      soll = eng ? Grafik.gebaeudeAnsicht(lv) : zielen;
    }
    const f = 1 - Math.exp(-dt * (zustand === 'flug' ? 3.5 : 6));
    k.x += (soll.x - k.x) * f;
    k.y += (soll.y - k.y) * f;
    k.z += (soll.z - k.z) * f;
    const da = Math.abs(k.x - soll.x) < 0.03 && Math.abs(k.y - soll.y) < 0.03 && Math.abs(k.z / soll.z - 1) < 0.004;
    if (da && zustand !== 'flug') Object.assign(k, soll);
    kameraRuhig = da;
    if (zustand === 'zurueck' && da && anim.phase === 'bereit' && welt.kannSchiessen()) {
      uebersicht = false;
      setzeZustand('zielen');
    }
  }

  function uebersichtUmschalten() {
    if (zustand !== 'zielen' || Eingabe.ziehtGerade() || zug) return;
    uebersicht = !uebersicht;
    kameraRuhig = false;
    $('uebersichtKnopf').setAttribute('aria-pressed', String(uebersicht));
  }

  // ---------------------------------------------------------- Ereignisse aus der Welt
  function verarbeite() {
    for (const e of welt.ereignisse) {
      switch (e.typ) {
        case 'abschuss':
          Ton.wupp(e.staerke);
          if (Math.random() < 0.35) sag(KATAPULT.x, KATAPULT.y + 0.5, ['Juhuu!', 'Platz da!', 'Scheren vor!', 'Wiiih!']);
          Grafik.spruehen(KATAPULT.x, KATAPULT.y - 0.4, 'staub', 5, { tempo: 1.5 });
          break;
        case 'krabbeStoss':
          Ton.stoss('krabbe', e.kraft / 15);
          if (e.kraft > 5) { Grafik.spruehen(e.x, e.y + 0.3, 'stern', 3, { tempo: 2.5, hoch: 2 }); if (e.kraft > 8) sag(e.x, e.y + 0.6, ['Uff!', 'Bonk!', 'Huch!', 'Tadaa?']); }
          break;
        case 'landung':
          Grafik.spruehen(e.x, e.y - 0.3, 'staub', 4, { tempo: 1.2 });
          Ton.blubb(1.1);
          break;
        case 'bruch': {
          const T = THEMEN[lv.gebiet];
          const farbe = { holz: '#d89a5a', dach: T.dach[e.farbe % 3], metall: '#93a8bd', fass: '#c98a4e', fassVoll: '#7a3f2a', stein: '#c9bfae', keil: '#8a96a6', container: T.container[e.farbe % 3] }[e.art] || T.kisten[e.farbe % 3];
          Grafik.spruehen(e.x, e.y, 'span', 6, { farbe, tempo: 3.5, hoch: 1.5 });
          Grafik.spruehen(e.x, e.y, 'staub', 3, { tempo: 1.3 });
          // Einzelne Teilpunkte zeigt das HUD; am Ort nur eine zusammengefasste Kettenanzeige
          if (e.kette && welt.schuss) Grafik.kette(e.x, e.y + 2.0, welt.schuss.kette, welt.schuss.kettenSumme);
          Ton.bruch(e.art);
          break;
        }
        case 'wasser':
          Grafik.spruehen(e.x, PHYSIK.wasserY, 'tropfen', 10, { tempo: 2.5, hoch: 3 });
          Ton.platsch();
          break;
        case 'raus':
          break;
        case 'bonus':
          Grafik.spruehen(e.x, e.y, 'stern', 4, { tempo: 2, hoch: 1.5, farbe: '#ffe27a' });
          Grafik.effekt({ art: 'blitz', x: e.x, y: e.y, vx: 0, vy: 0, leben: 0, max: 0.35 });
          Grafik.punkteText(e.x, e.y + 0.5, '+' + e.punkte, '#ffe27a', true);
          Ton.muenze();
          break;
        case 'boje': {
          const bunt = ['#ffd35a', '#24d6cd', '#ff805b', '#b58cff', '#fff4dc'];
          for (let i = 0; i < 18; i++) Grafik.spruehen(e.x, e.y, 'konfetti', 1, { farbe: bunt[i % 5], tempo: 5, hoch: 3 });
          Grafik.effekt({ art: 'ring', x: e.x, y: e.y, vx: 0, vy: 0, leben: 0, max: 0.5 });
          Grafik.effekt({ art: 'blitz', x: e.x, y: e.y, vx: 0, vy: 0, leben: 0, max: 0.4 });
          Grafik.spruehen(e.x, e.y, 'stern', 4, { tempo: 3, hoch: 2 });
          if (e.durch === 'krabbe') sag(e.x, e.y + 0.6, ['Treffer!', 'Volltreffer!', 'Hab dich!']);
          if (e.wie === 'wasser') Grafik.spruehen(e.x, PHYSIK.wasserY, 'tropfen', 10, { tempo: 2.5, hoch: 3 });
          Grafik.punkteText(e.x, e.y + 0.7, '+' + e.punkte, '#24d6cd');
          Ton.boje();
          $('ansage').textContent = welt.bojenUebrig ? `Boje getroffen! Noch ${welt.bojenUebrig}.` : 'Alle Bojen getroffen!';
          break;
        }
        case 'krabbePlatsch':
          Grafik.spruehen(e.x, PHYSIK.wasserY, 'tropfen', 12, { tempo: 3, hoch: 3 });
          Ton.platsch();
          Ton.blubb(0.8);
          break;
        case 'verdutzt':
          Ton.blubb(0.75);
          if (Math.random() < 0.5) sag(e.x, e.y + 0.7, ['Hä?', 'Huch?', 'Wo bin ich?', 'Nochmal!']);
          break;
        case 'puff':
          Grafik.spruehen(e.x, e.y, 'staub', 7, { tempo: 1.6 });
          Ton.puff();
          break;
      }
    }
    welt.ereignisse.length = 0;
    for (const t of welt.toene) Ton.stoss(t.ton, t.kraft);
    welt.toene.length = 0;
  }

  // Kurze Sprechblase der Krabbe – höchstens alle 1,5 s, damit es lustig bleibt
  let letzteBlase = -9;
  function sag(x, y, worte) {
    if (malZeit - letzteBlase < 1.5) return;
    letzteBlase = malZeit;
    Grafik.blase(x, y, worte[Math.floor(Math.random() * worte.length)]);
  }

  // ---------------------------------------------------------- Bild-Infos
  function bildInfo() {
    const figur = Speicher.krabbe();
    const info = { alpha: LAUFEND.includes(zustand) ? akku / PHYSIK.takt : 1, figur, spannung: 0, krabbe: null, krabbeImKatapult: null, vorschau: null, zeigeKraft: false, wartend: 0 };
    const imKatapult = !welt.krabbe && welt.schuesseUebrig > 0 && !welt.ergebnis && welt.geschafftTakt < 0;
    info.wartend = Math.max(0, welt.schuesseUebrig - (imKatapult ? 1 : 0));
    if (imKatapult && (anim.phase === 'bereit' || anim.phase === 'zielen' || anim.phase === 'hop') && zustand !== 'flug') {
      let x = KATAPULT.x, y = KATAPULT.y, o = { figur, wedel: malZeit, blick: 0.6, lauf: 0, klammer: 0 };
      if (anim.phase === 'hop') {
        // Die nächste Krabbe hüpft in die Schale
        const t = Math.min(1, anim.t / 0.35);
        x = -1.25 + (KATAPULT.x + 1.25) * t; y = 0.36 + (KATAPULT.y - 0.36) * t + Math.sin(t * Math.PI) * 0.9;
        o = { figur, lauf: anim.t * 4, schereAuf: true, mund: 'jubel', blickHoch: true };
      } else if (zug && zustand === 'zielen') {
        const s = startwerte(zug);
        x = s.x; y = s.y;
        info.spannung = s.staerke;
        info.zeigeKraft = true;
        const dir = Math.hypot(s.vx, s.vy) || 1;
        o = { figur, wedel: 0, blick: s.vx / dir, blickHoch: s.vy / dir > 0.3, klammer: 1, mund: s.staerke > 0.45 ? 'entschlossen' : undefined, lauf: 0 };
        if (s.gueltig) info.vorschau = welt.flugbahn(zug);
      }
      info.krabbeImKatapult = { x, y };
      info.krabbe = { x, y, winkel: 0, o };
    } else if (welt.krabbe) {
      const b = welt.krabbe.body, u = b.getUserData(), p = b.getPosition(), v = b.getLinearVelocity();
      const a = info.alpha;
      const x = u.px + (p.x - u.px) * a, y = u.py + (p.y - u.py) * a;
      let winkel = 0, o;
      if (anim.phase === 'los' || anim.phase === 'flug') {
        winkel = begrenzt(Math.atan2(v.y, Math.max(0.1, Math.abs(v.x))) * 0.35, -0.5, 0.5);
        const wechsel = Math.floor(anim.t / 0.32) % 2;
        o = { figur, lauf: anim.t * 9, wedel: anim.t, schereAuf: true, klammer: anim.klammer, blick: v.x > 0 ? 1 : -1, blickHoch: v.y > 0, mund: wechsel ? 'oh' : 'entschlossen' };
        info.krabbeImKatapult = anim.phase === 'los' ? { x, y } : null;
      } else if (anim.phase === 'rollt') {
        winkel = b.getAngle();
        o = { figur, lauf: anim.t * 4, schereAuf: true, mund: 'oh', schielen: true };
      } else {
        // verdutzt: richtet sich (nur optisch) wieder auf
        const roh = Math.atan2(Math.sin(b.getAngle()), Math.cos(b.getAngle()));   // auf -π..π bringen
        winkel = roh * Math.max(0, 1 - welt.krabbe.verdutzt / 0.3);
        o = { figur, lauf: 0, wedel: malZeit * 0.5, mund: 'verdutzt', schielen: true };
      }
      info.krabbe = { x, y, winkel, o, sternchen: anim.phase === 'verdutzt' };
    }
    return info;
  }

  // ---------------------------------------------------------- Anzeige
  function aktualisiereHud(erzwingen) {
    const sch = [lv.id, welt.schuesseUebrig, welt.bojenUebrig, welt.punkte, Speicher.krabbe()].join('|');
    if (sch === hudCache && !erzwingen) return;
    hudCache = sch;
    $('hudNr').textContent = lv.id;
    $('hudName').textContent = lv.name;
    $('hudZiele').textContent = welt.bojenUebrig;
    $('hudZieleFeld').setAttribute('aria-label', `Ziele: noch ${welt.bojenUebrig} von ${welt.bojenGesamt}`);
    $('hudKrabben').textContent = welt.schuesseUebrig;
    $('hudKrabbenFeld').setAttribute('aria-label', `Krabben: noch ${welt.schuesseUebrig} von ${lv.schuesse}`);
    $('hudPunkte').textContent = zahl(welt.punkte);
  }

  const zahl = (n) => Math.round(n).toLocaleString('de-DE');

  function zeigeMeldung(text, klein, dauer) {
    const m = $('meldung');
    m.textContent = text;
    if (klein) { const s = document.createElement('small'); s.textContent = klein; m.appendChild(s); }
    m.hidden = false;
    meldungBis = malZeit + dauer;
  }

  // ---------------------------------------------------------- Fenster
  function zeigeFenster(id) {
    for (const s of ['fStart', 'fKrabben', 'fLevel', 'fPause', 'fErfolg', 'fNiederlage']) $(s).hidden = s !== id;
    $('fenster').hidden = !id;
    $('naechsteKnopf').hidden = true;
    if (id) {
      const tafel = document.querySelector('.tafel');
      tafel.classList.toggle('breit', id === 'fLevel' || id === 'fKrabben');
      const titel = $(id).querySelector('[data-titel]');
      if (titel) { if (!titel.id) titel.id = id + 'Titel'; tafel.setAttribute('aria-labelledby', titel.id); }
      const erster = $(id).querySelector('.btn.main') || $(id).querySelector('button');
      if (erster) setTimeout(() => erster.focus({ preventScroll: true }), 30);
    }
    erfolgTanz = id === 'fErfolg';
  }

  function zeigeStart() {
    if (welt) { welt.aufraeumen(); welt = null; }
    setzeZustand('menue');
    zeigeFenster('fStart');
  }

  function zeigeLevelwahl() {
    if (welt && zustand !== 'menue') { welt.aufraeumen(); welt = null; }
    setzeZustand('menue');
    baueLevelwahl();
    zeigeFenster('fLevel');
  }

  function baueLevelwahl() {
    const liste = $('gebietListe');
    liste.textContent = '';
    GEBIETE.forEach((g, gi) => {
      const box = document.createElement('section');
      box.className = 'gebiet';
      box.style.setProperty('--g', g.farbe);
      const h = document.createElement('h3'); h.textContent = `${gi + 1} · ${g.name}`;
      const p = document.createElement('p'); p.textContent = g.text;
      const karten = document.createElement('div'); karten.className = 'karten';
      LEVEL.forEach((l, i) => {
        if (l.gebiet !== gi) return;
        const frei = Speicher.frei(l.id);
        const sterne = Speicher.sterne(l.id);
        const k = document.createElement('button');
        k.type = 'button';
        k.className = 'karte';
        k.disabled = !frei;
        k.setAttribute('aria-label', `Level ${l.id}: ${l.name}. ${frei ? (sterne ? sterne + ' von 3 Sternen' : 'noch nicht geschafft') : 'gesperrt'}`);
        const cv = document.createElement('canvas');
        cv.width = 320; cv.height = 180;
        Grafik.vorschau(cv, l);
        const nr = document.createElement('span'); nr.className = 'nr'; nr.textContent = `LEVEL ${l.id}`;
        const name = document.createElement('span'); name.textContent = l.name;
        const st = document.createElement('span'); st.className = 'sterne';
        st.innerHTML = '★'.repeat(sterne) + '<i>' + '★'.repeat(3 - sterne) + '</i>';

        k.append(cv, nr, name, st);
        const best = Speicher.level(l.id);
        if (best && best.best) { const b = document.createElement('span'); b.className = 'best'; b.textContent = 'Beste: ' + zahl(best.best); k.appendChild(b); }
        if (!frei) {
          const s = document.createElement('span'); s.className = 'schloss';
          s.innerHTML = '<svg aria-hidden="true"><use href="#schloss"/></svg>';
          k.appendChild(s);
        }
        k.addEventListener('click', () => { Ton.wecke(); Ton.klick(); starteLevel(i); });
        karten.appendChild(k);
      });
      box.append(h, p, karten);
      liste.appendChild(box);
    });
  }

  function baueKrabbenwahl() {
    const liste = $('krabbenListe');
    liste.textContent = '';
    for (const name of KRABBEN_REIHE) {
      const k = KRABBEN[name];
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'krabbenkarte';
      b.dataset.krabbe = name;
      b.setAttribute('aria-pressed', String(Speicher.krabbe() === name));
      const cv = document.createElement('canvas'); cv.width = 176; cv.height = 144;
      const n = document.createElement('span'); n.textContent = k.name;
      const t = document.createElement('small'); t.textContent = k.text;
      b.append(cv, n, t);
      b.addEventListener('click', () => {
        Ton.wecke(); Ton.blubb(1);
        Speicher.setzeKrabbe(name);
        liste.querySelectorAll('.krabbenkarte').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.krabbe === name)));
      });
      liste.appendChild(b);
    }
  }

  function malKrabbenKarten() {
    $('krabbenListe').querySelectorAll('.krabbenkarte').forEach((b, i) => {
      const gewaehlt = b.getAttribute('aria-pressed') === 'true';
      krabbeInLeinwand(b.querySelector('canvas'), { figur: b.dataset.krabbe, wedel: malZeit + i, tanzt: gewaehlt, lauf: gewaehlt ? malZeit : 0, blick: Math.sin(malZeit + i), mund: gewaehlt && Math.sin(malZeit * 2) > 0.6 ? 'jubel' : undefined });
    });
  }

  // ---------------------------------------------------------- Ergebnis
  function zeigeErfolg() {
    if (zustand === 'erfolg') return;
    Eingabe.abbrechen();
    setzeZustand('erfolg');
    const sterne = welt.sterne();
    const gesamt = welt.endpunkte();
    const besser = Speicher.ergebnis(lv.id, sterne, gesamt);
    $('erfolgTitel').textContent = TITEL_ERFOLG[(lv.id + welt.schussNummer) % TITEL_ERFOLG.length];
    $('eZiele').textContent = `${welt.bojenGesamt} × ${PUNKTE.boje} = ${zahl(welt.bojenGesamt * PUNKTE.boje)}`;
    $('eMuenzen').textContent = `${welt.bonusGesammelt}/${welt.bonusGesamt} = ${zahl(welt.bonusGesammelt * PUNKTE.bonus)}`;
    $('eTruemmer').textContent = zahl(welt.punkte - welt.bojenGesamt * PUNKTE.boje - welt.bonusGesammelt * PUNKTE.bonus);
    $('eBonus').textContent = zahl(welt.restBonus || 0);
    $('erfolgSpruch').textContent = SPRUECHE_ERFOLG[Math.floor(Math.random() * SPRUECHE_ERFOLG.length)].replace('%n', KRABBEN[Speicher.krabbe()].name);
    $('eGesamt').textContent = zahl(gesamt);
    $('eBest').textContent = zahl(Speicher.level(lv.id).best);
    $('neuBest').hidden = !besser.punkte;
    $('sterneText').textContent = `${sterne} von 3 Sternen`;
    const spans = document.querySelectorAll('.sternreihe span');
    spans.forEach(s => s.classList.remove('an'));
    spans.forEach((s, i) => { if (i < sterne) setTimeout(() => s.classList.add('an'), 250 + i * 280); });
    const letztes = levelIndex >= LEVEL.length - 1;
    $('weiterLevelKnopf').textContent = letztes ? 'Levelauswahl' : 'Weiter';
    zeigeFenster('fErfolg');
    Ton.sieg();
  }

  function zeigeNiederlage() {
    if (zustand === 'niederlage') return;
    Eingabe.abbrechen();
    setzeZustand('niederlage');
    const name = KRABBEN[Speicher.krabbe()].name;
    const s = SPRUECHE_SCHADE[Math.floor(Math.random() * SPRUECHE_SCHADE.length)].replace('%n', name);
    $('spruch').textContent = s;
    krabbeInLeinwand($('niederlageKrabbe'), { figur: Speicher.krabbe(), mund: 'verdutzt', schielen: true });
    zeigeFenster('fNiederlage');
    Ton.schade();
  }

  // ---------------------------------------------------------- Ton
  function tonUmschalten() {
    const an = !Ton.istAn();
    Ton.setze(an);
    Speicher.setzeTon(an);
    zeigeTon();
    if (an) Ton.klick();
  }
  function zeigeTon() {
    document.querySelectorAll('.js-ton').forEach(b => { b.textContent = Ton.istAn() ? 'Ton: an' : 'Ton: aus'; b.setAttribute('aria-pressed', String(Ton.istAn())); });
  }

  // ---------------------------------------------------------- Knöpfe
  // Alle Knöpfe liegen außerhalb der Spielfläche: Ein Klick darauf löst nie einen Schuss aus.
  const klick = (id, f) => $(id).addEventListener('click', (e) => { e.stopPropagation(); Ton.wecke(); f(); });
  klick('spielenKnopf', () => { Ton.klick(); const offen = LEVEL.findIndex(l => !Speicher.level(l.id)); zeigeLevelwahl(); if (offen === 0 && !Speicher.sterneGesamt()) starteLevel(0); });
  klick('krabbeWahlKnopf', () => { Ton.klick(); baueKrabbenwahl(); zeigeFenster('fKrabben'); });
  klick('krabbenFertig', () => { Ton.klick(); zeigeFenster('fStart'); });
  klick('levelZurueck', () => { Ton.klick(); zeigeStart(); });
  klick('pauseKnopf', () => { Ton.klick(); pause(); });
  klick('neuKnopfHud', () => neustart());
  klick('weiterKnopf', () => { Ton.klick(); weiter(); });
  klick('neuKnopf', () => neustart());
  klick('pauseLevelKnopf', () => { Ton.klick(); zeigeLevelwahl(); });
  klick('naechsteKnopf', () => naechsteKrabbe());
  klick('uebersichtKnopf', () => { Ton.klick(); uebersichtUmschalten(); });
  klick('weiterLevelKnopf', () => { Ton.klick(); if (levelIndex < LEVEL.length - 1) starteLevel(levelIndex + 1); else zeigeLevelwahl(); });
  klick('nochmalErfolgKnopf', () => neustart());
  klick('erfolgLevelKnopf', () => { Ton.klick(); zeigeLevelwahl(); });
  klick('nochmalKnopf', () => neustart());
  klick('niederlageLevelKnopf', () => { Ton.klick(); zeigeLevelwahl(); });
  document.querySelectorAll('.js-ton').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); Ton.wecke(); tonUmschalten(); }));
  // Kein Ziehen über die Knöpfe hinweg auf die Leinwand
  for (const id of ['hud', 'naechsteKnopf']) $(id).addEventListener('pointerdown', (e) => e.stopPropagation());

  window.addEventListener('resize', () => { Grafik.groesse(); });

  // ---------------------------------------------------------- Start
  Ton.setze(Speicher.tonAn(), false);   // AudioContext erst nach der ersten Berührung
  zeigeTon();
  setzeZustand('menue');
  zeigeFenster('fStart');
  requestAnimationFrame(rahmen);

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  // Für automatische Tests im Browser (ändert nichts am Spiel)
  window.__krawall = {
    zustand: () => zustand, welt: () => welt, starteLevel, LEVEL,
    zug: () => zug, kam: Grafik.kam, krabbenPunkt, pause, weiter,
    kameraRuhig: () => kameraRuhig,
    dpr: () => Grafik.dpr,
    // Schuss wie mit der Tastatur: Winkel in Grad, Stärke 0..1
    schiesse(winkel, staerke) {
      if (zustand !== 'zielen' || !kameraRuhig || !welt.kannSchiessen()) return false;
      tastaturAktiv = true; tWinkel = winkel; tStaerke = staerke;
      zugSetzen(zugAusWinkel(winkel, staerke));
      loslassen();
      return zustand === 'flug';
    },
    zuBild: (x, y) => Grafik.weltZuBildCss(x, y),
  };
})();
