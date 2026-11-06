#!/usr/bin/env python3
# Baut aus den Teilen in diesem Ordner die fertige index.html. Aufruf: python3 quelle/baue.py
import pathlib
q = pathlib.Path(__file__).parent
TEILE = ['0-planck.min.js', '1-einstellungen.js', '2-level.js', '3-welt.js', '4-krabbe.js',
         '5-speicher.js', '6-ton.js', '7-grafik.js', '8-eingabe.js', '9-app.js']
def lies(n):
    t = (q / n).read_text()
    # Verweis auf die Quellkarte weglassen (die Datei liegt nicht bei)
    return '\n'.join(z for z in t.split('\n') if not z.startswith('//# sourceMappingURL'))
kopf = (q / 'kopf.html').read_text()
spiel = '\n'.join(lies(n) for n in TEILE)
fertig = kopf.replace('%%SCHRIFT%%', (q / 'schrift.txt').read_text().strip()).replace('%%SPIEL%%', spiel)
(q.parent / 'index.html').write_text(fertig)
print('index.html:', len(fertig) // 1024, 'KB')
