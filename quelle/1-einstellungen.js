// ===================================================================
// 1 · EINSTELLUNGEN
// Alle Physik-, Material-, Katapult- und Punktewerte an einer Stelle.
// Welt-Einheiten sind Meter, y zeigt nach OBEN. Der Steg liegt bei y = 0.
// ===================================================================

const PHYSIK = {
  schwerkraft: -10,        // m/s²
  takt: 1 / 60,            // fester Simulationsschritt in Sekunden
  geschwIter: 10,          // Box2D-Geschwindigkeits-Iterationen (mehr = stabilere Stapel)
  posIter: 4,              // Box2D-Positions-Iterationen
  maxSchritteProBild: 6,   // nach Unterbrechungen höchstens so viel nachrechnen
  vorlauf: 180,            // Schritte zum Einschwingen beim Levelstart (ohne Schaden)
  wasserY: -0.6,           // Wasseroberfläche
  imWasserY: -0.75,        // Mittelpunkt darunter = ins Wasser gefallen
  // Ruheerkennung für das Ende eines Schusses
  ruheTempo: 0.12,         // m/s
  ruheDrehung: 0.25,       // rad/s
  ruheMasse: 0.06,         // leichtere Körper zählen für die Ruhe nicht mit
  ruheZeit: 0.8,           // so lange muss alles ruhig sein (s)
  maxSchussZeit: 16,       // großzügige Höchstdauer eines Schusses (s)
  krabbeRuheZeit: 0.45,    // Krabbe liegt still -> verdutzt schauen
  krabbeVerdutzt: 0.9,     // so lange schaut sie verdutzt, dann *puff*
  krabbeMaxFlug: 9,        // spätestens dann verschwindet die Krabbe
  siegNachlauf: 1.6,
  rollBremseAb: 1.2,       // Fässer langsamer als das (m/s) …
  rollBremse: 0.97,        // … verlieren je Schritt 3 % Tempo (Rollwiderstand)       // nach der letzten Boje Kettenreaktion auslaufen lassen, dann abrechnen
};

// Die Krabbe ist IMMER derselbe Physikkörper – egal welche Variante gewählt ist.
// Der Kreis deckt Körper, Augen und Beine der gezeichneten Krabbe ab.
const KRABBE_PHYSIK = Object.freeze({
  radius: 0.55,
  dichte: 3.0,
  reibung: 0.7,
  rueckprall: 0.2,
  winkelDaempfung: 2.5,       // dreht sich nach der Landung nicht ewig weiter
  daempfungNachKontakt: 0.35, // Lineare Dämpfung erst nach dem ersten Kontakt (Flug bleibt exakt)
});

const KATAPULT = {
  x: 0, y: 2.6,            // Ruheposition der Krabbe in der Schale
  pollerAbstand: 0.66,     // halber Abstand der beiden Poller
  maxZug: 2.0,             // maximale Zugweite (m)
  minZug: 0.35,            // darunter wird kein Schuss ausgelöst
  maxTempo: 15,            // Abschussgeschwindigkeit bei voller Zugweite (m/s)
  minHoehe: 0.7,           // die gezogene Krabbe bleibt über dem Steg
  griffRadius: 1.4,        // so nah (m) muss man die Krabbe anfassen …
  griffPixel: 46,          // … oder so nah in Bildschirmpunkten
  vorschauZeit: 0.9,       // Sekunden Flugbahn-Vorschau
  // Tastatur
  winkelStart: 20, staerkeStart: 0.7,
  winkelMin: -15, winkelMax: 85,
  staerkeMin: 0.2,
};

// Materialien. haltbar = so viel Aufprallstärke hält ein Teil aus.
// Aufprallstärke = reduzierte Masse × (Annäherungstempo − schwelle). Ruhender
// Kontakt hat kein Annäherungstempo und macht daher nie Schaden.
const MATERIAL = {
  holz:      { name: 'Holzbalken',   dichte: 0.6, reibung: 0.7,  rueckprall: 0.06, haltbar: 1.3, schwelle: 1.2, punkte: 20, ton: 'holz' },
  dach:      { name: 'Dachstück',    dichte: 0.5, reibung: 0.7,  rueckprall: 0.06, haltbar: 1.2, schwelle: 1.2, punkte: 30, ton: 'holz' },
  kiste:     { name: 'Frachtkiste',  dichte: 0.8, reibung: 0.75, rueckprall: 0.04, haltbar: 3.0, schwelle: 1.5, punkte: 40, ton: 'kiste' },
  fass:      { name: 'Leeres Fass',  dichte: 0.5, reibung: 0.55, rueckprall: 0.18, haltbar: 3.0, schwelle: 1.8, punkte: 30, ton: 'fass', winkelDaempfung: 0.25 },
  fassVoll:  { name: 'Volles Fass',  dichte: 2.2, reibung: 0.6,  rueckprall: 0.08, haltbar: 9,   schwelle: 2.0, punkte: 50, ton: 'fass', winkelDaempfung: 0.4 },
  metall:    { name: 'Metallträger', dichte: 3.6, reibung: 0.5,  rueckprall: 0.05, haltbar: 24,  schwelle: 2.0, punkte: 80, ton: 'metall' },
  stein:     { name: 'Mauerblock',   dichte: 2.0, reibung: 0.85, rueckprall: 0.03, haltbar: 8,   schwelle: 2.0, punkte: 50, ton: 'stein' },
  container: { name: 'Container',    dichte: 1.1, reibung: 0.6,  rueckprall: 0.04, haltbar: 16,  schwelle: 2.2, punkte: 100, ton: 'metall' },
  keil:      { name: 'Steinkeil',    dichte: 2.6, reibung: 0.95, rueckprall: 0.02, haltbar: 60,  schwelle: 3.0, punkte: 0,  ton: 'stein' },   // Drehpunkt einer Wippe
  boje:      { name: 'Zielboje',     dichte: 0.5, reibung: 0.6,  rueckprall: 0.25, ton: 'boje' },
};

// Ab wann eine Boje als getroffen gilt: Annäherungstempo UND Aufprallstärke
const BOJE_AKTIV = { tempo: 3.0, staerke: 0.5 };
// Bonusmünzen sammelt die Krabbe oder ein Teil, das schneller als das hier ist
const BONUS = { radius: 0.3, mindestTempo: 1.5 };

const PUNKTE = {
  boje: 500,               // je aktiviertem Pflichtziel
  bonus: 100,              // je Bonusmünze
  krabbeUebrig: 300,       // je nicht gebrauchter Krabbe
  kette: 20,               // Kettenbonus je weiterer Zerstörung kurz nacheinander …
  ketteMax: 5,             // … höchstens das 5-Fache …
  ketteDeckel: 400,        // … und höchstens so viel Kettenbonus pro Schuss
  ketteFenster: 0.8,       // Sekunden zwischen zwei Zerstörungen einer Kette
};

// Grenzen für Effekte, damit nichts ausufert
const GRENZEN = {
  bruchstuecke: 10,        // physikalische Bruchhälften gleichzeitig (der Rest ist nur Deko)
  bruchAbLaenge: 1.6,      // nur so lange Balken zerbrechen in zwei echte Hälften
  partikel: 160,
  aufprallToeneJeZehntel: 3,
  weltRand: 16,            // so weit links/rechts vom Level fliegt noch etwas
};
