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
const ST = (x, y, w = 0.9, h = 0.55) => ({ art: 'stein', x, y: y + h / 2, w, h });
const C = (x, y, farbe = 0, w = 2.4, h = 1.1) => ({ art: 'container', x, y: y + h / 2, w, h, farbe });
// Ziele und Bonus
const Z = (x, y) => ({ art: 'boje', x, y: y + BOJE_FUSS });
const G = (x, y) => ({ art: 'bonus', x, y });

const GEBIETE = [
  { id: 'kai', name: 'Fischerkai', text: 'Fischerhütten aus Holz bei Tageslicht.', farbe: '#24D6CD' },
  { id: 'container', name: 'Containerhafen', text: 'Container auf Stelzen, Metall und Mauern.', farbe: '#FF805B' },
  { id: 'bucht', name: 'Leuchtturmbucht', text: 'Hohe Türme und große Kettenreaktionen im Abendrot.', farbe: '#B58CFF' },
];

const LEVEL = [
  // ---------------------------------------------------------------- Fischerkai
  {
    id: 1, gebiet: 0, name: 'Fischerhütte', schuesse: 3, breite: 18,
    tipp: 'Die linke Stütze ist schon angeknackst!',
    stege: [[-5, 24]],
    teile: [
      P(9.2, 0, 1.6, { riss: 0.45 }), P(11.6, 0, 1.6),
      BA(8.9, 11.9, 1.6),
      Z(10.4, 1.82),
      P(9.2, 1.82, 1.2), P(11.6, 1.82, 1.2),
      BA(8.8, 12.0, 3.02),
      ...DACH(8.6, 12.2, 3.24, 1.0, 0),
      K(12.9, 0, 1),
      G(10.4, 0.7), G(12.9, 1.6),
    ],
    sterne: [1450, 1750],
    loesung: [[12, 0.94]],   // geprüft: 1920 Punkte
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
    tipp: 'Ein schwerer Container auf dünnen Holzstelzen …',
    stege: [[-5, 24]],
    teile: [
      P(9.4, 0, 1.8, { riss: 0.4, w: 0.22 }), P(11.0, 0, 1.8, { w: 0.22 }), P(12.6, 0, 1.8, { w: 0.22 }),
      BA(9.1, 12.9, 1.8, { h: 0.24 }),
      Z(10.2, 0),
      C(11.0, 2.04, 0, 3.2, 1.2),
      K(10.3, 3.24, 1, 0.8, 0.8), Z(11.6, 3.24),
      G(11.8, 1.0), G(13.6, 1.5),
    ],
    sterne: [1850, 2150],
    loesung: [[0, 0.98]],   // geprüft: 2320 Punkte
  },
  {
    id: 6, gebiet: 1, name: 'Kranlager', schuesse: 4, breite: 18,
    tipp: 'Metall ist schwer. Wenn es fällt, nimmt es alles mit.',
    stege: [[-5, 24]],
    teile: [
      P(9.2, 0, 1.5), P(11.2, 0, 1.5, { riss: 0.35 }), P(13.2, 0, 1.5),
      M(8.9, 13.5, 1.5),
      Z(10.2, 0),
      K(9.4, 1.76, 0), P(10.3, 1.76, 1.3), Z(11.2, 1.76), P(12.1, 1.76, 1.3), K(13.0, 1.76, 1),
      BA(9.0, 13.4, 3.06),
      M(9.2, 10.8, 3.28), Z(12.2, 3.28),
      G(14.3, 1.0), G(8.2, 2.5),
    ],
    sterne: [2800, 3100],
    loesung: [[18, 0.82]],   // geprüft: 3280 Punkte
  },
  {
    id: 7, gebiet: 1, name: 'Schiefer Signalturm', schuesse: 3, breite: 18,
    tipp: 'Jedes Stockwerk hängt ein Stück weiter über.',
    stege: [[-5, 24]],
    teile: [
      P(10, 0, 1.4), P(11.4, 0, 1.4),
      BA(9.8, 11.9, 1.4),
      Z(10.7, 0),
      P(10.35, 1.62, 1.3), P(11.75, 1.62, 1.3),
      BA(10.15, 12.25, 2.92),
      P(10.7, 3.14, 1.2), P(12.1, 3.14, 1.2),
      BA(10.5, 12.6, 4.34),
      Z(11.6, 4.56), K(10.75, 4.56, 2, 0.6, 0.6),
      G(12.9, 2.0), G(13.6, 0.6), G(9.2, 4.0),
    ],
    sterne: [2050, 2350],
    loesung: [[66, 0.82]],   // geprüft: 2520 Punkte
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
    tipp: 'Ein Turm auf Steinsockel. Oben drauf ein schweres Fass.',
    stege: [[-5, 24]],
    teile: [
      ST(10.75, 0), ST(11.65, 0), ST(10.75, 0.55), ST(11.65, 0.55),
      P(10.6, 1.1, 1.8), P(11.8, 1.1, 1.8),
      BA(10.4, 12.0, 2.9),
      P(10.6, 3.12, 1.8), P(11.8, 3.12, 1.8),
      BA(9.6, 12.8, 4.92),
      Z(10.15, 5.14), FV(11.2, 5.14), Z(12.25, 5.14),
      Z(13.7, 0), K(14.6, 0, 1),
      G(11.2, 2.0), G(13.6, 3.2), G(9.0, 3.4),
    ],
    sterne: [2500, 2800],
    loesung: [[54, 0.78]],   // geprüft: 2970 Punkte
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
];
