# Krabben-Krawall – Übergabe

Stand: 6. November 2026. Erweiterung von 12 auf **32 Level** in **7 Gebieten**.
Die Erweiterung ist **online**: https://moje9328.github.io/krabbenkrawall/
(Karte auf https://moje9328.github.io/spiele/ ist aktualisiert).

## Bauen und prüfen

```
python3 quelle/baue.py          # baut index.html aus quelle/
node quelle/test-logik.js       # Logik mit echter Physik (~40 s)
python3 quelle/test-browser.py  # Browser-Test mit Playwright (~8 min, spielt alle Lösungen)
node quelle/werkzeug-loesungssuche.js <id> --gierig   # robuste Schussfolge suchen
```

`index.html` niemals direkt bearbeiten, immer die Dateien in `quelle/`.

## Neue Level (13–32)

Die Level 1–12 sind unverändert. Neue Mechaniken werden in jedem Gebiet zuerst
allein eingeführt und danach kombiniert. Die Spalte „1 Schuss“ ist der Anteil der
Rasterschüsse, die das Level mit einer Krabbe gewinnen. Kleiner heißt schwerer.

| Nr | Gebiet | Name | Neu / Idee | Krabben | Ziele | 1 Schuss | Musterlösung |
|---|---|---|---|---|---|---|---|
| 13 | Werft | Hochkai | **Kaimauer** eingeführt: Haus steht erhöht | 3 | 2 | 16 % | [22, 0.94] |
| 14 | Werft | Werftkran-Lager | 3 Etagen mit Metall auf dem Kai | 4 | 3 | 7 % | [24, 0.94] |
| 15 | Werft | Hinter der Mauer | Mauer deckt die Stützen → Bogenwurf | 3 | 2 | 5 % | [70, 0.9] |
| 16 | Werft | Helling-Gerüst | zwei Kaistufen, schweres Fass oben | 4 | 3 | 6 % | [22, 0.98] |
| 17 | Werft | Trockendock | Brücke über Wasserbecken zwischen zwei Kais | 4 | 3 | 5 % | [24, 0.98] |
| 18 | Nachtmarkt | Die Wippe | **Wippe** eingeführt: hohes Ende treffen | 3 | 2 | 6 % | [10, 0.86], [4, 0.98] |
| 19 | Nachtmarkt | Laternenturm | Wippe wirft Kiste, Boje hinter Kiste | 3 | 2 | 4 % | [56, 0.86] |
| 20 | Nachtmarkt | Fischhalle | Metall- vs. Holzseite, lange Dachbalken | 4 | 3 | 1 % | [22, 0.9], [26, 0.98] |
| 21 | Nachtmarkt | Marktstände | drei getrennte Buden → Planung | 4 | 3 | 0 % | [10, 0.98], [18, 0.94] |
| 22 | Nachtmarkt | Mitternachtsmarkt | Boje + Wippe auf dem Kai + Bude | 4 | 3 | 1 % | [40, 0.82], [22, 0.86] |
| 23 | Sturmküste | Pfahlbau | **Pfahlbau** auf Felssockel im Wasser eingeführt | 3 | 2 | 20 % | [24, 0.86] |
| 24 | Sturmküste | Weiter Wurf | Haus weit hinten, Kisten davor | 3 | 2 | 8 % | [24, 0.98] |
| 25 | Sturmküste | Wellenbrecher | hohe Mauer + Pfahlbau dahinter | 3 | 2 | 3 % | [62, 0.82] |
| 26 | Sturmküste | Brandungslager | Wippe + Pfahlbau + Haus hinten | 4 | 3 | 2 % | [30, 0.94] |
| 27 | Sturmküste | Sturmturm | Turm im Meer + Boje hinter Kistenwand | 4 | 3 | 1 % | [20, 0.94], [-6, 0.94] |
| 28 | Eishafen | Eiskäfig | **Käfig** eingeführt: Boje in Metallwänden, Holzdeckel | 3 | 2 | 13 % | [22, 0.94] |
| 29 | Eishafen | Gletscherlager | Kaistufen + Wippe + Käfig | 4 | 2 | 7 % | [30, 0.94] |
| 30 | Eishafen | Polarturm | Stein, Metall, Holz, Container; 4 Ziele, 3 Krabben | 3 | 4 | 2 % | [18, 0.86] |
| 31 | Eishafen | Doppelkai | zwei Kais mit Wasser dazwischen | 4 | 4 | 0 % | [32, 0.94], [22, 0.86] |
| 32 | Eishafen | Großer Eiskrawall | Finale: Kai, Wippe, Pfahlbau | 5 | 5 | 2 % | [18, 0.98], [28, 0.98] |

Lösungen: [Winkel in Grad, Stärke 0..1], wie bei der Tastatur. Jede ist in
`quelle/2-level.js` hinterlegt (`loesung`). Die Sterne-Schwellen ergeben sich aus
den Punkten der Lösung: 3 Sterne etwa auf Lösungsniveau, 2 Sterne mit einer
Krabbe mehr.

## Designentscheidungen

- **Schwierigkeit:**
  - Gemessen statt geschätzt. Jedes neue Level wurde mit dem Raster aus 828 Schüssen und der gierigen Suche vermessen und innerhalb seines Gebiets nach Schwierigkeit sortiert.
  - Jedes Gebiet beginnt mit einem leichteren Einführungslevel (13, 18, 23, 28) für die neue Idee und endet deutlich schwerer.
  - Schwerer wird es durch verteilte Ziele, Deckung, Entfernung, stabilere Bauteile und weniger Ersatzkrabben, nicht durch pixelgenaues Zielen.
- **Fairness:**
  - Jede Musterlösung gewinnt auch mit leicht verändertem letztem Schuss (±1°/±2°, ±0,02/±0,04), in mindestens 6 von 8 Varianten.
  - Bei Mehrschuss-Lösungen hat auch der erste Schuss eine Toleranz von mindestens 7 von 8.
  - Unfaire Entwürfe wurden umgebaut. Beispiel: Die ferne Zusatzboje im Finale war nur bei 3 von 828 Zweitschüssen treffbar.
- **Kaimauer** (`mauern: [[x0, x1, oben]]` im Level):
  - Feste Steinkante als Gelände, kein Gebäudeteil.
  - Bewusst kühl blaugrau gezeichnet, mit Abdeckstein und Algenstreifen, damit man sie nicht mit den beweglichen beigen Mauerblöcken verwechselt.
  - Mit `oben` knapp über dem Wasser (−0,35) dient sie als Felssockel für Pfahlbauten.
- **Wippe** (`WIPPE(xa, y, keilhoehe, laenge, links)`):
  - Steinkeil (`keil`, praktisch unzerbrechlich, 0 Punkte) mit einer Planke darauf, die sich frei bewegt (keine Gelenke).
  - Der linke Arm ist kürzer, damit das hohe Ende zur Krabbe zeigt.
  - Bojen auf der schrägen Planke werden um den Wippenwinkel gedreht (`Z(x, y, winkel)`), sonst kippt das Achteck ab.
- **Neue Hintergründe** (`THEMEN[3..6]` in `7-grafik.js`, jeweils eigene Fernkulisse):
  - **Werft im Morgennebel:** Schiffsrumpf auf der Helling, Gerüst, Portalkran, ziehende Nebelschwaden.
  - **Nachtmarkt:** Sterne, Mond, Marktbuden, Laternenketten mit leichtem Glimmen. Ein warmes Scheinwerferlicht hinter dem Gebäude hält es vom dunklen Himmel abgehoben.
  - **Sturmküste:** graue Wolken, Felsklippen, Leuchtturm mit Lichtkegel, Regen, höhere Wellen.
  - **Eishafen:** Eisberge, verschneite Häuser, Schneekante auf dem Steg, Schneefall.
- **Lesbarkeit:**
  - Die Wetter-Animationen liegen hinter den Spielobjekten, im gecachten Hintergrund bleibt alles statisch.
  - Bei „weniger Bewegung“ (prefers-reduced-motion) sind die Animationen aus.
  - Spielobjekte behalten ihre kräftigen Farben und dunklen Konturen in allen Themen.
- **Handy hochkant:** Die Zielansicht richtet sich nach dem vordersten *Bauteil*, nicht nach einer Mauer davor. So sind Gebäude hinter Mauern beim Zielen im Bild.
- **Levelauswahl:** Das Kartenraster füllt sich automatisch, sodass 5 Level eines Gebiets in einer Reihe stehen. Gebiete, Freischaltung und Speicherung waren schon generisch und erweitern sich automatisch.
- **Spielstände:** Das Speicherformat bleibt bei Version 2. Ein alter Spielstand mit 12 geschafften Leveln hat `frei: 12` gespeichert. Level 13 wird trotzdem frei, weil die Regel „Vorgänger geschafft“ greift (im Browser geprüft).

## Geänderte Dateien

| Datei | Änderung |
|---|---|
| `quelle/2-level.js` | 4 neue Gebiete, Level 13–32, Bausteine `WIPPE`, `MP` (Metallstütze), `Z(x, y, winkel)` |
| `quelle/3-welt.js` | Kaimauern als feste Körper (`mauern`) |
| `quelle/1-einstellungen.js` | neues Material `keil` |
| `quelle/7-grafik.js` | 4 neue Themen mit Fernkulissen, Kaimauer, Steinkeil, Wetter-Animationen, Nachtlicht, Schnee, Zielansicht nach Bauteilen |
| `quelle/9-app.js` | Splitterfarbe für den Keil |
| `quelle/kopf.html` | Kartenraster der Levelauswahl |
| `quelle/7-grafik.js` (Nachtrag) | Punkteanzeigen weichen einander aus, Kettenanzeige fest über dem Gebäude, größere Schrift auf dem Handy |
| `quelle/test-logik.js` | Levelaufbau, Kaimauer, Wippe, Schwierigkeitsverlauf; alle 32 Level |
| `quelle/test-browser.py` | alle Lösungen im Spiel, 32 Karten, alter 12-Level-Spielstand |
| `sw.js` | Cache `krabbenkrawall-v3`, damit installierte Apps die neuen Level laden |
| `index.html` | neu gebaut |

## Prüfergebnisse (tatsächlich ausgeführt)

- `node quelle/test-logik.js`: **520 Prüfungen, 0 Fehler**:
  - Alle 32 Gebäude stehen 20 s still, ohne Schaden durch Ruhekontakt.
  - Alle 32 Lösungen gewinnen, mit Toleranz von mindestens 6 von 8.
  - Level 3 ist mit beiden Ansätzen lösbar.
  - Die Kaimauer stoppt Vorschau und Krabbe.
  - In Level 18 trifft die Krabbe zuerst die Wippe, und die hochschnellende Planke aktiviert die Boje.
  - In jedem neuen Gebiet ist das letzte Level schwerer als das erste.
  - Der Eishafen ist im Schnitt deutlich schwerer als der Fischerkai (5 % gegenüber 19 % Ein-Schuss-Siegen).
  - Dazu alle bisherigen Prüfungen: Punkte nur einmal, Münzen, Erfolg vor Niederlage, Bildraten-Unabhängigkeit.
- `python3 quelle/test-browser.py`: **169 Prüfungen, 0 Fehler**:
  - 360×640, 390×844, 1440×900.
  - Maus, Touch, pointercancel, Tastatur, Pause, Tabwechsel, Neustart.
  - Alle 32 Lösungen und Level 3 hoch im echten Game Loop.
  - Speicherstände: v1-Übernahme, 12-Level-Stand, ohne localStorage.
  - Kalle ist pixelgleich mit Krabbenalarm.
- **Sichtkontrolle** per Screenshots: alle 20 neuen Level am Desktop, die 4 Themen und die Mauer-Level am Handy, die Levelauswahl.
- **Handy-Check vor der Veröffentlichung**:
  - Aufnahmen aller 7 Gebiete (Zielen und Einsturz), Start und Levelauswahl.
  - Einmal als iPhone (390×844, 3-fache Dichte) in **WebKit, der Safari-Engine**, einmal als Android (412×915) in Chromium.
  - Keine Konsolenfehler; Schrift, Verläufe, Wetter und Laternen werden korrekt dargestellt.
  - Gefunden und behoben: Beim Einsturz lagen Punkte, Kettenanzeige und Sprechblase übereinander. Die Kette steht jetzt fest über dem Gebäude, die Punkte weichen nach oben aus und sind auf dem Handy größer.
- **Safari-Physik:** Alle 33 Musterlösungen (32 + Level 3 hoch) gewinnen in WebKit mit **exakt denselben Punktzahlen** wie in Chromium. Die befürchtete Abweichung auf iPhones tritt nicht auf.
- **Leistung** (390×844, 3-fache Pixeldichte, CPU 4-fach gedrosselt, während eines Einsturzes): in allen 4 neuen Themen Median 16,8 ms, 95 % unter 35 ms, wie vorher.

## Offene Punkte / nicht geprüft

- **Nicht getestet:**
  - ein echtes Handy in der Hand (Touch-Gefühl, Wärme, Akku); geprüft ist nur die Safari- und Chrome-Engine mit Handy-Bildschirmmaßen
  - Klang
  - wie sich die Schwierigkeit für echte Spieler anfühlt
- **Messgrenzen:**
  - Die Schwierigkeit ist mit einem Schussraster gemessen. Menschen zielen anders, Rückmeldungen echter Spieler sind wertvoller als die Prozentzahlen.
  - Die Einführungslevel 13, 23 und 28 sind absichtlich leichter als das Ende des Gebiets davor (Verschnaufpause beim Kennenlernen).
- **Kleinigkeit:** In Level 18 („Die Wippe“) gewinnt man mit einem einzigen Schuss eher, wenn man die Boje direkt trifft. Die Wippe ist dort ein Angebot, kein Zwang. Die Musterlösung nutzt sie.
