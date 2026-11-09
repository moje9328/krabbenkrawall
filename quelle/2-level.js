// ===================================================================
// 2 · LEVEL
// Drei Hafengebiete mit je vier Gebäuden. Jedes Gebäude besteht nur aus
// einzelnen Physikteilen, die ihre Lasten wirklich tragen. Nichts ist fest
// verbaut außer dem Steg. Bausteine: y ist immer die UNTERKANTE.
// Das Katapult steht bei x = 0, die Krabbe ruht bei (0 | 2,6).
//
// loesung: geprüfte erfolgreiche Schussfolge mit der Originalkrabbe,
// [Winkel in Grad, Stärke 0..1] wie bei der Tastatursteuerung. Die Tests
// (node quelle/test-logik.js) spielen jede Folge mit der echten Physik nach,
// auch mit leicht verändertem Winkel und leicht veränderter Stärke.
// ===================================================================

const BOJE_FUSS = 0.48 * Math.cos(Math.PI / 8);   // Abstand Mitte–Unterkante der achteckigen Boje

// Holz
const P = (x, y, h, o = {}) => ({ art: 'holz', x, y: y + h / 2, w: o.w || 0.2, h, riss: o.riss });                   // senkrechte Stütze
const BA = (x0, x1, y, o = {}) => ({ art: 'holz', x: (x0 + x1) / 2, y: y + (o.h || 0.22) / 2, w: x1 - x0, h: o.h || 0.22, riss: o.riss }); // Balken / Decke
const DACH = (x0, x1, y, hoch, farbe = 0) => {
  const xm = (x0 + x1) / 2;
  return [
    { art: 'dach', punkte: [[x0, y], [xm, y], [xm, y + hoch]], farbe },
    { art: 'dach', punkte: [[xm, y], [x1, y], [xm, y + hoch]], farbe },
  ];
};
// Lasten
const K = (x, y, farbe = 0, w = 1, h = 1) => ({ art: 'kiste', x, y: y + h / 2, w, h, farbe });
const F = (x, y) => ({ art: 'fass', x, y: y + 0.42, r: 0.42 });
const FV = (x, y) => ({ art: 'fassVoll', x, y: y + 0.45, r: 0.45 });
const M = (x0, x1, y, h = 0.26) => ({ art: 'metall', x: (x0 + x1) / 2, y: y + h / 2, w: x1 - x0, h });
const MP = (x, y, h, w = 0.24) => ({ art: 'metall', x, y: y + h / 2, w, h });                       // Metallstütze
const ST = (x, y, w = 0.9, h = 0.55) => ({ art: 'stein', x, y: y + h / 2, w, h });
const C = (x, y, farbe = 0, w = 2.4, h = 1.1) => ({ art: 'container', x, y: y + h / 2, w, h, farbe });
// Wippe: Steinkeil (Drehpunkt) bei xa mit Höhe hk, darauf eine Planke der Länge lang.
// Das rechte Ende liegt auf dem Steg, das linke zeigt zur Krabbe nach oben.
// links = Länge links vom Drehpunkt. Gibt Keil und Planke zurück.
const WIPPE = (xa, y = 0, hk = 0.7, lang = 4, links = 1.6, dicke = 0.2) => {
  const rechts = lang - links;
  const a = Math.asin(hk / rechts);                       // Neigung: rechtes Ende berührt den Boden
  const mitteX = xa + (rechts - lang / 2) * Math.cos(a);   // Mitte der Planke entlang der Neigung
  const mitteY = y + hk - (rechts - lang / 2) * Math.sin(a) + dicke / 2 / Math.cos(a);
  return [
    { art: 'keil', punkte: [[xa - 0.45, y], [xa + 0.45, y], [xa, y + hk]] },
    { art: 'holz', x: mitteX, y: mitteY, w: lang, h: dicke, a: -a * 180 / Math.PI },
  ];
};
// Ziele und Bonus
const Z = (x, y, a = 0) => ({ art: 'boje', x, y: y + BOJE_FUSS / Math.cos(a * Math.PI / 180), a });   // a: auf schräger Fläche flach aufliegend
const G = (x, y) => ({ art: 'bonus', x, y });

const GEBIETE = [
  { id: 'kai', name: 'Fischerkai', text: 'Fischerhütten aus Holz bei Tageslicht.', farbe: '#24D6CD' },
  { id: 'container', name: 'Containerhafen', text: 'Container auf Stelzen, Metall und Mauern.', farbe: '#FF805B' },
  { id: 'bucht', name: 'Leuchtturmbucht', text: 'Hohe Türme und große Kettenreaktionen im Abendrot.', farbe: '#B58CFF' },
  { id: 'werft', name: 'Werft im Morgennebel', text: 'Neu: Kaimauern. Gebäude stehen erhöht oder hinter Deckung.', farbe: '#5AA0E0' },
  { id: 'nacht', name: 'Nachtmarkt', text: 'Neu: die Wippe. Ein Treffer auf das hohe Ende schleudert die Last.', farbe: '#FFC94D' },
  { id: 'sturm', name: 'Sturmküste', text: 'Pfahlbauten über dem Wasser und weite Würfe.', farbe: '#7FB8C8' },
  { id: 'eis', name: 'Eishafen', text: 'Gut versteckte Ziele und alles zusammen. Für Profis.', farbe: '#E8F4FF' },
];

const LEVEL = [
  // ---------------------------------------------------------------- Fischerkai
  {
    id: 1, gebiet: 0, name: 'Fischerhütte', schuesse: 3, breite: 18,
    tipp: 'Die Boje sitzt im Anbau hinter der Steinmauer. Wirf drüber – oder knack die angeknackste Stütze!',
    stege: [[-5, 24]],
    teile: [
      // Hütte mit Stein-Mitte (Deckung) und Dach
      P(9.0, 0, 1.6), ST(10.2, 0), ST(10.2, 0.55), P(11.4, 0, 1.6),
      BA(8.7, 11.7, 1.6),
      K(9.5, 1.82, 2, 1.0, 1.2), P(11.2, 1.82, 1.2),
      BA(8.8, 11.6, 3.02),
      ...DACH(8.6, 11.8, 3.24, 1.0, 0),
      // Steinmauer zwischen Hütte und Anbau
      ST(12.2, 0), ST(12.2, 0.55), ST(12.2, 1.1), ST(12.2, 1.65),
      // Anbau mit der Boje
      P(13.3, 0, 1.5, { riss: 0.45 }), P(14.9, 0, 1.5),
      BA(13.1, 15.1, 1.5),
      Z(14.1, 1.72),
      K(16.4, 0, 1),
      G(10.2, 1.4), G(12.2, 2.6), G(16.4, 1.6),
    ],
    sterne: [1550, 1850],
    loesung: [[22,0.98]],   // geprüft: 2040 Punkte
  },
  {
    id: 2, gebiet: 0, name: 'Netzschuppen', schuesse: 3, breite: 18,
    tipp: 'Zwei Geschosse, zwei Bojen. Und oben wackelt ein Fass.',
    stege: [[-5, 24]],
    teile: [
      P(9, 0, 1.5), P(10.8, 0, 1.5, { riss: 0.4 }), P(12.6, 0, 1.5),
      BA(8.7, 12.9, 1.5),
      Z(9.9, 0),
      K(9.3, 1.72, 2, 0.9, 0.9), Z(10.9, 1.72), F(11.95, 1.72), P(12.65, 1.72, 0.9),
      BA(8.8, 12.9, 2.62),
      ...DACH(8.7, 13.0, 2.84, 0.8, 1),
      G(11.0, 0.6), G(13.8, 0.5),
    ],
    sterne: [2000, 2300],
    loesung: [[58, 0.7]],   // geprüft: 2450 Punkte
  },
  {
    id: 3, gebiet: 0, name: 'Hafenlager', schuesse: 3, breite: 18,
    tipp: 'Flach auf die Stützen – oder hoch auf die Last oben!',
    stege: [[-5, 24]],
    teile: [
      // unten: gut erreichbare Holzstützen
      P(9.0, 0, 1.7), P(10.6, 0, 1.7, { riss: 0.35 }), P(12.2, 0, 1.7), P(13.6, 0, 1.7),
      BA(8.7, 13.9, 1.7, { h: 0.26 }),
      Z(11.4, 0),
      // oben: Kisten und ein schweres Fass
      K(9.3, 1.96, 0), K(10.3, 1.96, 1), FV(11.6, 1.96), K(12.6, 1.96, 2), Z(12.6, 2.96), K(13.55, 1.96, 0, 0.7, 0.7),
      G(14.7, 0.6), G(10.0, 3.6), G(9.8, 0.9),
    ],
    sterne: [1900, 2200],
    loesung: [[4, 0.98]],   // geprüft: 2380 Punkte
    loesungHoch: [[16, 0.98]],   // zweiter Ansatz: hoch auf die oberen Lasten
  },
  {
    id: 4, gebiet: 0, name: 'Bootswerkstatt', schuesse: 4, breite: 19,
    tipp: 'Rollt das Fass, rollt der Ärger – zum Schuppen rechts.',
    stege: [[-5, 24]],
    teile: [
      P(8.8, 0, 2.0), P(10.4, 0, 2.0), P(12.4, 0, 2.0, { riss: 0.4 }),
      BA(8.5, 12.7, 2.0),
      Z(9.6, 0),
      Z(10.6, 2.22), F(12.2, 2.22),
      P(8.8, 2.22, 1.1), P(11.5, 2.22, 1.1),
      BA(8.6, 11.7, 3.32),
      ...DACH(8.5, 11.8, 3.54, 0.8, 2),
      // kleiner Schuppen rechts
      P(13.6, 0, 1.2), P(15.2, 0, 1.2),
      BA(13.4, 15.5, 1.2),
      Z(14.4, 1.42),
      G(11.4, 1.0), G(13.0, 2.8), G(16.2, 0.6),
    ],
    sterne: [2900, 3200],
    loesung: [[20, 0.86]],   // geprüft: 3360 Punkte
  },
  // ---------------------------------------------------------------- Containerhafen
  {
    id: 5, gebiet: 1, name: 'Container auf Stelzen', schuesse: 3, breite: 18,
    tipp: 'Ein Container auf Stelzen: links Metall, in der Mitte Holz, rechts Stein.',
    stege: [[-5, 24]],
    teile: [
      MP(9.4, 0, 1.8), P(11.0, 0, 1.8, { w: 0.22, riss: 0.4 }), P(12.6, 0, 1.8, { w: 0.22 }), ST(13.9, 0), ST(13.9, 0.55), ST(13.9, 1.1),
      BA(9.1, 14.4, 1.8, { h: 0.24 }),
      Z(10.2, 0),
      C(11.0, 2.04, 0, 3.2, 1.2),
      K(10.3, 3.24, 1, 0.8, 0.8), Z(11.6, 3.24),
      G(11.8, 1.0), G(13.6, 1.5),
    ],
    sterne: [1800, 2100],
    loesung: [[14,0.9]],   // geprüft: 2280 Punkte
  },
  {
    id: 6, gebiet: 1, name: 'Kranlager', schuesse: 4, breite: 18,
    tipp: 'Metall ist schwer. Und im Schuppen rechts wartet noch eine Boje.',
    stege: [[-5, 24]],
    teile: [
      P(9.2, 0, 1.5), P(11.2, 0, 1.5, { riss: 0.35 }), P(13.2, 0, 1.5),
      M(8.9, 13.5, 1.5),
      Z(10.2, 0),
      K(9.4, 1.76, 0), P(10.3, 1.76, 1.3), Z(11.2, 1.76), P(12.1, 1.76, 1.3), K(13.0, 1.76, 1),
      BA(9.0, 13.4, 3.06),
      M(9.2, 10.8, 3.28), Z(12.2, 3.28),
      // Lagerschuppen rechts, unabhängig vom Haupthaus
      ST(14.7, 0), ST(14.7, 0.55), ST(14.7, 1.1),
      P(15.9, 0, 1.5), P(17.3, 0, 1.5, { riss: 0.35 }),
      BA(15.7, 17.5, 1.5),
      Z(16.6, 1.72),
      G(14.3, 1.8), G(8.2, 2.5),
    ],
    sterne: [3250, 3550],
    loesung: [[12,0.9]],   // geprüft: 3740 Punkte
  },
  {
    id: 7, gebiet: 1, name: 'Schiefer Signalturm', schuesse: 3, breite: 18,
    tipp: 'Jedes Stockwerk hängt ein Stück weiter über.',
    stege: [[-5, 24]],
    teile: [
      ST(8.7, 0), ST(8.7, 0.55), ST(8.7, 1.1), ST(8.7, 1.65),
      P(10, 0, 1.4), P(11.4, 0, 1.4, { riss: 0.4 }),
      BA(9.8, 11.9, 1.4),
      Z(10.7, 0),
      MP(10.35, 1.62, 1.3), P(11.75, 1.62, 1.3),
      BA(10.15, 12.25, 2.92),
      P(10.7, 3.14, 1.2), P(12.1, 3.14, 1.2),
      BA(10.5, 12.6, 4.34),
      Z(11.6, 4.56), K(10.75, 4.56, 2, 0.6, 0.6),
      G(12.9, 2.0), G(13.6, 0.6), G(9.2, 4.0),
    ],
    sterne: [2100, 2400],
    loesung: [[68,0.82]],   // geprüft: 2560 Punkte
  },
  {
    id: 8, gebiet: 1, name: 'Zollhaus', schuesse: 4, breite: 18,
    tipp: 'Die Mauer hält viel aus. Die Holzseite nicht.',
    stege: [[-5, 24]],
    teile: [
      ST(9.0, 0), ST(9.0, 0.55), ST(9.0, 1.1),
      P(12.4, 0, 1.65, { riss: 0.4 }), P(13.6, 0, 1.65),
      M(8.6, 13.9, 1.65),
      Z(10.6, 0), Z(11.8, 0),
      K(9.4, 1.91, 2), Z(12.0, 1.91), P(13.3, 1.91, 1.0),
      BA(8.8, 13.6, 2.91),
      ...DACH(8.7, 13.7, 3.13, 0.9, 1),
      G(11.2, 1.3), G(14.6, 0.8),
    ],
    sterne: [2550, 2850],
    loesung: [[12, 0.98], [18, 0.86]],   // geprüft: 3040 Punkte
  },
  // ---------------------------------------------------------------- Leuchtturmbucht
  {
    id: 9, gebiet: 2, name: 'Aussichtsturm', schuesse: 3, breite: 18,
    tipp: 'Zwei Bojen oben, eine hinter der Steinmauer. Plane die Reihenfolge!',
    stege: [[-5, 24]],
    teile: [
      ST(10.75, 0), ST(11.65, 0), ST(10.75, 0.55), ST(11.65, 0.55),
      P(10.6, 1.1, 1.8), P(11.8, 1.1, 1.8, { riss: 0.4 }),
      BA(10.4, 12.0, 2.9),
      P(10.6, 3.12, 1.8), P(11.8, 3.12, 1.8),
      BA(9.6, 12.8, 4.92),
      Z(10.15, 5.14), FV(11.2, 5.14), Z(12.25, 5.14),
      ST(6.6, 0), ST(6.6, 0.55), Z(8.1, 0), K(14.0, 0, 1),
      G(11.2, 2.0), G(13.6, 3.2), G(9.0, 3.4),
    ],
    sterne: [2350, 2650],
    loesung: [[22,0.74]],   // geprüft: 2820 Punkte
  },
  {
    id: 10, gebiet: 2, name: 'Bootshaus am Wasser', schuesse: 4, breite: 20,
    tipp: 'Alles, was ins Hafenbecken fällt, ist erledigt.',
    stege: [[-5, 13.8], [16.8, 26]],
    teile: [
      P(10, 0, 1.6), P(11.6, 0, 1.6), P(13.2, 0, 1.6, { riss: 0.4 }),
      BA(9.7, 13.6, 1.6),
      Z(10.8, 0),
      K(10.2, 1.82, 0), Z(11.4, 1.82), P(12.2, 1.82, 1.0), F(12.9, 1.82),
      BA(9.7, 12.6, 2.82),
      ...DACH(9.6, 12.7, 3.04, 0.8, 2),
      K(17.6, 0, 1), Z(17.6, 1),
      G(14.6, 0.6), G(15.4, 1.6), G(11.4, 3.7),
    ],
    sterne: [2900, 3200],
    loesung: [[16, 0.9]],   // geprüft: 3350 Punkte
  },
  {
    id: 11, gebiet: 2, name: 'Leuchtfeuerlager', schuesse: 4, breite: 18,
    tipp: 'Stein unten, Holz in der Mitte, Container oben.',
    stege: [[-5, 24]],
    teile: [
      ST(9.4, 0), ST(9.4, 0.55), ST(12.8, 0), ST(12.8, 0.55),
      M(8.9, 13.3, 1.1),
      Z(11.1, 0),
      P(9.6, 1.36, 1.5), Z(10.35, 1.36), P(11.1, 1.36, 1.5, { riss: 0.4 }), P(12.6, 1.36, 1.5),
      BA(9.3, 12.9, 2.86),
      C(11.1, 3.08, 1, 2.6, 1.1),
      G(14.2, 1.6), G(8.2, 2.0), G(11.9, 1.9),
    ],
    sterne: [1800, 2100],
    loesung: [[30, 0.78], [74, 0.98]],   // geprüft: 2280 Punkte
  },
  {
    id: 12, gebiet: 2, name: 'Großes Hafenlager', schuesse: 4, breite: 19,
    tipp: 'Zwei Häuser, eine Brücke. Wo fängst du an?',
    stege: [[-5, 25]],
    teile: [
      // linkes Haus
      P(8.6, 0, 1.8), P(10.0, 0, 1.8, { riss: 0.4 }),
      BA(8.4, 10.2, 1.8),
      Z(9.3, 0), K(9.3, 2.02, 0),
      // Kisten unter der Brücke
      K(11.2, 0, 2), K(11.2, 1, 0),
      // rechtes Haus
      P(12.4, 0, 2.8), P(14.2, 0, 2.8, { riss: 0.3 }),
      BA(12.2, 14.4, 2.8),
      Z(13.3, 0), Z(13.8, 3.02),
      // Brücke mit Last
      BA(9.0, 12.8, 3.02),
      Z(10.4, 3.24), FV(11.6, 3.24),
      G(11.2, 2.55), G(15.2, 1.0), G(7.6, 1.5),
    ],
    sterne: [3100, 3400],
    loesung: [[14, 0.94], [18, 0.86]],   // geprüft: 3560 Punkte
  },
  // ---------------------------------------------------------------- Werft im Morgennebel (neu: Kaimauern)
  {
    id: 13, gebiet: 3, name: 'Hochkai', schuesse: 3, breite: 18,
    tipp: 'Neu: die Kaimauer. Sie steht fest. Das Haus darauf hat vorne Stein und hinten Holz.',
    stege: [[-5, 24]], mauern: [[8.5, 14.5, 1.6]],
    teile: [
      ST(8.95, 1.6), ST(8.95, 2.15), P(10.1, 1.6, 1.5, { riss: 0.4 }), P(12.4, 1.6, 1.5), P(13.4, 1.6, 1.5),
      BA(9.0, 13.7, 3.1),
      Z(11.3, 1.6),
      K(9.9, 3.32, 1), Z(11.6, 3.32), K(13.0, 3.32, 2, 0.8, 0.8),
      G(13.6, 2.4), G(15.4, 0.8),
    ],
    sterne: [1950, 2250],
    loesung: [[22,0.98]],   // geprüft: 2410 Punkte
  },
  {
    id: 14, gebiet: 3, name: 'Werftkran-Lager', schuesse: 4, breite: 18,
    tipp: 'Drei Etagen auf dem Kai. Metall hält – Holz nicht.',
    stege: [[-5, 24]], mauern: [[10, 15, 1.2]],
    teile: [
      P(10.6, 1.2, 1.4, { w: 0.24 }), P(12.5, 1.2, 1.4, { w: 0.24, riss: 0.25 }), P(14.4, 1.2, 1.4, { w: 0.24 }),
      M(10.3, 14.7, 2.6),
      Z(11.55, 1.2), K(13.45, 1.2, 1, 0.8, 0.8),
      P(10.8, 2.86, 1.3), Z(12.5, 2.86), K(13.5, 2.86, 0, 0.8, 0.8), P(14.2, 2.86, 1.3),
      BA(10.5, 14.5, 4.16),
      FV(12.0, 4.38), Z(13.4, 4.38),
      G(9.2, 3.5), G(15.6, 1.8), G(12.5, 5.7),
    ],
    sterne: [2800, 3100],
    loesung: [[24, 0.94]],   // geprüft: 3280 Punkte
  },
  {
    id: 15, gebiet: 3, name: 'Hinter der Mauer', schuesse: 3, breite: 18,
    tipp: 'Die Mauer schützt die Stützen. Wirf im Bogen darüber!',
    stege: [[-5, 24]], mauern: [[8.6, 9.6, 2.9]],
    teile: [
      MP(10.8, 0, 1.8), P(13.2, 0, 1.8, { w: 0.24, riss: 0.3 }), ST(14.9, 0), ST(14.9, 0.55), ST(14.9, 1.1), ST(14.9, 1.65),
      BA(10.5, 14.2, 1.8, { h: 0.26 }),
      Z(12.0, 0),
      K(11.1, 2.06, 1), Z(12.6, 2.06), K(13.5, 2.06, 2, 0.9, 0.9),
      G(10.1, 3.9), G(14.6, 1.0),
    ],
    sterne: [1600, 1900],
    loesung: [[46,0.82]],   // geprüft: 2090 Punkte
  },
  {
    id: 16, gebiet: 3, name: 'Helling-Gerüst', schuesse: 4, breite: 18,
    tipp: 'Zwei Stufen, ein schweres Fass ganz oben.',
    stege: [[-5, 24]], mauern: [[9, 11, 1.0], [11, 15, 2.0]],
    teile: [
      K(10, 1.0, 2), Z(10, 2.0),
      P(11.8, 2.0, 1.6, { w: 0.24 }), P(14.2, 2.0, 1.6, { w: 0.24 }),
      BA(11.5, 14.5, 3.6),
      Z(13.0, 2.0),
      FV(12.2, 3.82), Z(13.6, 3.82),
      G(11.0, 3.0), G(15.8, 1.0), G(12.9, 5.0),
    ],
    sterne: [2250, 2550],
    loesung: [[22, 0.98]],   // geprüft: 2720 Punkte
  },
  {
    id: 17, gebiet: 3, name: 'Trockendock', schuesse: 4, breite: 20,
    tipp: 'Eine Brücke über das Becken. Wer fällt, ist erledigt.',
    stege: [[-5, 8.5], [18, 30]], mauern: [[8.5, 11, 1.4], [15, 18, 1.4]],
    teile: [
      K(9.4, 1.4, 0),
      BA(10.6, 15.4, 1.4, { h: 0.3 }),
      Z(12.2, 1.7), K(13.2, 1.7, 2, 0.7, 0.7), Z(14.2, 1.7),
      P(15.6, 1.4, 1.4), P(17.4, 1.4, 1.4, { riss: 0.4 }),
      BA(15.4, 17.7, 2.8),
      Z(16.5, 3.02),
      G(13.0, 0.4), G(12.4, 3.2), G(18.6, 1.0),
    ],
    sterne: [2450, 2750],
    loesung: [[24, 0.98]],   // geprüft: 2900 Punkte
  },
  // ---------------------------------------------------------------- Nachtmarkt (neu: Wippe)
  {
    id: 18, gebiet: 4, name: 'Die Wippe', schuesse: 3, breite: 18,
    tipp: 'Neu: die Wippe. Triff das hohe Ende – die Boje fliegt!',
    stege: [[-5, 24]],
    teile: [
      ...WIPPE(9.4, 0, 0.5), Z(11.1, 0.36, -12.2),
      P(13.4, 0, 1.6), P(15.4, 0, 1.6, { riss: 0.35 }),
      BA(13.2, 15.6, 1.6),
      Z(14.4, 0),
      ...DACH(13.1, 15.7, 1.82, 0.8, 0),
      G(11.2, 2.8), G(12.4, 1.2),
    ],
    sterne: [1050, 1350],
    loesung: [[10, 0.86], [4, 0.98]],   // geprüft: 1500 Punkte (erst die Wippe, dann die Bude)
  },
  {
    id: 19, gebiet: 4, name: 'Laternenturm', schuesse: 3, breite: 18,
    tipp: 'Die Wippe wirft die Kiste. Und wer erwischt die Boje hinter dem Turm?',
    stege: [[-5, 24]],
    teile: [
      ...WIPPE(8.6), K(10.3, 0.44, 1, 0.6, 0.6),
      P(12.4, 0, 2.2, { w: 0.26 }), P(13.4, 0, 2.2, { w: 0.26 }),
      BA(12.2, 13.6, 2.2),
      P(12.4, 2.42, 1.8, { w: 0.24 }), P(13.4, 2.42, 1.8, { w: 0.24 }),
      BA(12.0, 13.8, 4.22),
      Z(12.9, 4.44),
      K(15.4, 0, 2, 0.8, 1.2), Z(16.4, 0),
      G(11.3, 2.6), G(14.6, 3.0), G(16.4, 1.6),
    ],
    sterne: [1750, 2050],
    loesung: [[56, 0.86]],   // geprüft: 2220 Punkte
  },
  {
    id: 20, gebiet: 4, name: 'Fischhalle', schuesse: 4, breite: 19,
    tipp: 'Links Metall, rechts Holz. Wo gibt die Halle nach?',
    stege: [[-5, 25]],
    teile: [
      MP(9.4, 0, 2.2), P(12.0, 0, 2.2), P(14.6, 0, 2.2, { riss: 0.3 }),
      BA(9.1, 14.9, 2.2, { h: 0.26 }),
      ...DACH(9.0, 15.0, 2.46, 1.0, 1),
      Z(10.7, 0), F(12.6, 0), Z(13.3, 0),
      F(15.6, 0), Z(16.8, 0),
      G(11.3, 1.5), G(16.0, 1.6), G(12.0, 4.2),
    ],
    sterne: [2150, 2450],
    loesung: [[22, 0.9], [26, 0.98]],   // geprüft: 2620 Punkte
  },
  {
    id: 21, gebiet: 4, name: 'Marktstände', schuesse: 4, breite: 19,
    tipp: 'Drei Buden, drei Bojen. Plane deine Krabben!',
    stege: [[-5, 25]],
    teile: [
      P(8.4, 0, 1.4, { riss: 0.35 }), P(10.0, 0, 1.4), BA(8.2, 10.2, 1.4), ...DACH(8.1, 10.3, 1.62, 0.7, 0), Z(9.2, 0),
      P(11.8, 0, 1.4), P(13.4, 0, 1.4), BA(11.6, 13.6, 1.4), ...DACH(11.5, 13.7, 1.62, 0.7, 1), Z(12.6, 0),
      P(15.2, 0, 1.4), P(16.8, 0, 1.4, { riss: 0.3 }), BA(15.0, 17.0, 1.4), ...DACH(14.9, 17.1, 1.62, 0.7, 2), Z(16.0, 0),
      G(10.9, 2.0), G(14.3, 2.0), G(17.8, 0.8),
    ],
    sterne: [2700, 3000],
    loesung: [[10, 0.98], [18, 0.94]],   // geprüft: 3180 Punkte
  },
  {
    id: 22, gebiet: 4, name: 'Mitternachtsmarkt', schuesse: 4, breite: 19,
    tipp: 'Boje, Wippe und Bude – drei Ziele, die nicht zusammen fallen.',
    stege: [[-5, 25]], mauern: [[8.6, 13.4, 1.2]],
    teile: [
      Z(9.1, 1.2),
      ...WIPPE(10.6, 1.2), K(12.3, 1.64, 0, 0.6, 0.6),
      P(14.2, 0, 1.6), P(16.4, 0, 1.6, { riss: 0.3 }),
      BA(14.0, 16.6, 1.6),
      Z(15.3, 0),
      K(14.6, 1.82, 2), Z(15.9, 1.82),
      G(13.4, 2.6), G(17.4, 1.0),
    ],
    sterne: [2300, 2600],
    loesung: [[40, 0.82], [22, 0.86]],   // geprüft: 2760 Punkte
  },
  // ---------------------------------------------------------------- Sturmküste (neu: Pfahlbauten, weite Würfe)
  {
    id: 23, gebiet: 5, name: 'Pfahlbau', schuesse: 3, breite: 19,
    tipp: 'Ein Haus auf Pfählen über dem Wasser. Ab in die Wellen!',
    stege: [[-5, 9.5], [17, 30]], mauern: [[11, 15.5, -0.35]],
    teile: [
      MP(11.4, -0.35, 2.2), P(12.4, -0.35, 2.2), P(13.4, -0.35, 2.2, { riss: 0.2 }), P(14.3, -0.35, 2.2), MP(15.0, -0.35, 2.2),
      BA(11.1, 15.3, 1.85, { h: 0.24 }),
      Z(12.9, -0.35),
      K(11.8, 2.09, 1), Z(13.2, 2.09), F(14.6, 2.09),
      G(16.2, 0.3), G(10.2, 1.2),
    ],
    sterne: [1850, 2150],
    loesung: [[16,0.94]],   // geprüft: 2300 Punkte
  },
  {
    id: 24, gebiet: 5, name: 'Weiter Wurf', schuesse: 3, breite: 21,
    tipp: 'Das Haus steht weit hinten. Volle Kraft!',
    stege: [[-5, 27]],
    teile: [
      K(13.5, 0, 2), K(13.5, 1, 0),
      MP(16.0, 0, 1.6), P(17.1, 0, 1.6), P(18.5, 0, 1.6, { riss: 0.35 }),
      BA(15.8, 18.9, 1.6),
      Z(17.8, 0),
      K(16.6, 1.82, 0), Z(17.65, 1.82), K(18.5, 1.82, 1, 0.7, 0.7),
      G(15.0, 2.6), G(19.4, 0.8),
    ],
    sterne: [1550, 1850],
    loesung: [[38,0.86]],   // geprüft: 2040 Punkte
  },
  {
    id: 25, gebiet: 5, name: 'Wellenbrecher', schuesse: 3, breite: 19,
    tipp: 'Hinter der hohen Mauer steht ein Pfahlbau.',
    stege: [[-5, 10.5], [18, 30]], mauern: [[8.6, 9.8, 3.0], [12, 16, -0.35]],
    teile: [
      P(12.4, -0.35, 2.0), P(14.0, -0.35, 2.0, { riss: 0.3 }), P(15.6, -0.35, 2.0),
      BA(12.2, 15.8, 1.65, { h: 0.24 }),
      Z(13.2, -0.35),
      Z(13.2, 1.89), FV(14.8, 1.89),
      G(11.0, 3.8), G(16.8, 0.4),
    ],
    sterne: [1450, 1750],
    loesung: [[62, 0.82]],   // geprüft: 1940 Punkte
  },
  {
    id: 26, gebiet: 5, name: 'Brandungslager', schuesse: 4, breite: 21,
    tipp: 'Wippe, Pfahlbau und ein Haus ganz hinten.',
    stege: [[-5, 10], [16.5, 30]], mauern: [[10.6, 14.6, -0.35]],
    teile: [
      ...WIPPE(7.4), K(9.1, 0.44, 1, 0.6, 0.6),
      P(11.0, -0.35, 1.9), P(12.7, -0.35, 1.9, { riss: 0.3 }), P(14.2, -0.35, 1.9),
      BA(10.8, 14.4, 1.55),
      Z(11.85, 1.77), K(13.45, 1.77, 1, 0.8, 0.8),
      P(17.2, 0, 1.4), P(18.8, 0, 1.4),
      BA(17.0, 19.0, 1.4),
      Z(18.0, 0), Z(18.0, 1.62),
      G(10.0, 2.4), G(15.6, 0.4), G(19.8, 1.0),
    ],
    sterne: [2500, 2800],
    loesung: [[30, 0.94]],   // geprüft: 2980 Punkte
  },
  {
    id: 27, gebiet: 5, name: 'Sturmturm', schuesse: 4, breite: 20,
    tipp: 'Ein Turm im Meer – und hinter der Kistenwand noch eine Boje.',
    stege: [[-5, 12], [19, 30]], mauern: [[14, 16.4, -0.35]],
    teile: [
      K(9.2, 0, 2), K(9.2, 1, 0), Z(10.4, 0),
      P(14.5, -0.35, 2.0), P(15.9, -0.35, 2.0, { riss: 0.3 }),
      BA(14.3, 16.1, 1.65),
      Z(15.2, -0.35),
      P(14.5, 1.87, 1.8), P(15.9, 1.87, 1.8),
      BA(14.0, 16.4, 3.67),
      Z(14.5, 3.89), FV(15.4, 3.89),
      G(12.6, 3.0), G(17.4, 0.6), G(10.4, 2.0),
    ],
    sterne: [2550, 2850],
    loesung: [[20, 0.94], [-6, 0.94]],   // geprüft: 3000 Punkte
  },
  // ---------------------------------------------------------------- Eishafen (alles zusammen)
  {
    id: 28, gebiet: 6, name: 'Eiskäfig', schuesse: 3, breite: 18,
    tipp: 'Die Boje sitzt im Metallkäfig. Nur der Holzdeckel gibt nach – was liegt darüber?',
    stege: [[-5, 24]],
    teile: [
      MP(11.82, 0, 1.1, 0.4), Z(12.5, 0), MP(13.18, 0, 1.1, 0.4),
      BA(11.0, 14.0, 1.1, { h: 0.2, riss: 0.3 }),
      P(11.2, 1.3, 1.8, { w: 0.24 }), P(13.8, 1.3, 1.8, { w: 0.24, riss: 0.2 }),
      BA(11.0, 14.0, 3.1),
      FV(12.5, 3.32), Z(13.4, 3.32),
      G(10.4, 2.4), G(14.8, 1.0),
    ],
    sterne: [1550, 1850],
    loesung: [[22, 0.94]],   // geprüft: 2000 Punkte
  },
  {
    id: 29, gebiet: 6, name: 'Gletscherlager', schuesse: 4, breite: 19,
    tipp: 'Zwei Stufen, eine Wippe, ein Käfig.',
    stege: [[-5, 25]], mauern: [[8.4, 11.6, 1.0], [11.6, 17, 2.0]],
    teile: [
      ...WIPPE(9.6, 1.0, 0.6, 3.2, 1.3), K(10.9, 1.38, 1, 0.5, 0.5),
      K(12.75, 2.0, 0, 0.5, 1.1), Z(13.5, 2.0), K(14.25, 2.0, 0, 0.5, 1.1),
      BA(12.1, 14.9, 3.1, { h: 0.2 }),
      P(12.3, 3.3, 1.6), P(14.7, 3.3, 1.6, { riss: 0.3 }),
      BA(12.1, 14.9, 4.9),
      FV(13.5, 5.12),
      P(15.6, 2.0, 1.4), P(16.7, 2.0, 1.4), BA(15.4, 16.9, 3.4), Z(16.15, 3.62),
      G(11.2, 3.2), G(17.8, 1.0), G(15.2, 5.4),
    ],
    sterne: [2250, 2550],
    loesung: [[30, 0.94]],   // geprüft: 2720 Punkte
  },
  {
    id: 30, gebiet: 6, name: 'Polarturm', schuesse: 3, breite: 18,
    tipp: 'Stein, Metall, Holz und ein Container. Vier Bojen, drei Krabben.',
    stege: [[-5, 24]],
    teile: [
      ST(11.6, 0), ST(13.4, 0), ST(11.6, 0.55), ST(13.4, 0.55),
      M(11.0, 14.0, 1.1),
      Z(12.5, 0),
      P(11.4, 1.36, 1.6), Z(12.5, 1.36), P(13.6, 1.36, 1.6, { riss: 0.3 }),
      BA(11.1, 13.9, 2.96),
      P(11.6, 3.18, 1.4), Z(12.5, 3.18), P(13.4, 3.18, 1.4),
      BA(11.3, 13.7, 4.58),
      C(12.5, 4.8, 0, 2.2, 1.0), Z(12.5, 5.8),
      G(10.2, 3.0), G(14.8, 2.0), G(12.5, 7.4),
    ],
    sterne: [2650, 2950],
    loesung: [[18, 0.86]],   // geprüft: 3120 Punkte
  },
  {
    id: 31, gebiet: 6, name: 'Doppelkai', schuesse: 4, breite: 20,
    tipp: 'Zwei Kais, dazwischen eiskaltes Wasser.',
    stege: [[-5, 8.5], [17.5, 30]], mauern: [[8.5, 11.5, 1.5], [14.5, 17.5, 1.5]],
    teile: [
      P(9.0, 1.5, 1.6), P(11.0, 1.5, 1.6, { riss: 0.3 }),
      BA(8.8, 11.2, 3.1),
      Z(10.0, 1.5), Z(10.0, 3.32),
      P(15.0, 1.5, 1.8), P(17.0, 1.5, 1.8),
      BA(14.8, 17.2, 3.3),
      Z(16.0, 1.5), FV(15.4, 3.52), Z(16.6, 3.52),
      G(12.9, 1.2), G(13.2, 4.2), G(18.4, 0.8),
    ],
    sterne: [2800, 3100],
    loesung: [[32, 0.94], [22, 0.86]],   // geprüft: 3290 Punkte
  },
  {
    id: 32, gebiet: 6, name: 'Großer Eiskrawall', schuesse: 5, breite: 24,
    tipp: 'Das große Finale: Kai, Wippe und Pfahlbau. Fünf Bojen!',
    stege: [[-5, 16.4], [21, 30]], mauern: [[8.6, 12.4, 1.2], [17, 20.4, -0.35]],
    teile: [
      P(9.0, 1.2, 1.5), P(11.8, 1.2, 1.5, { riss: 0.3 }),
      BA(8.8, 12.0, 2.7),
      Z(10.4, 1.2),
      K(9.4, 2.92, 1), Z(10.9, 2.92),
      ...WIPPE(13.6), K(15.3, 0.44, 0, 0.6, 0.6),
      P(17.4, -0.35, 2.0), P(19.8, -0.35, 2.0, { riss: 0.3 }),
      BA(17.2, 20.0, 1.65),
      Z(18.6, -0.35), Z(18.6, 1.87),
      Z(21.6, 0),
      G(12.9, 3.0), G(16.4, 2.2), G(21.6, 2.2),
    ],
    sterne: [3700, 4000],
    loesung: [[18, 0.98], [28, 0.98]],   // geprüft: 4180 Punkte
  },
];
