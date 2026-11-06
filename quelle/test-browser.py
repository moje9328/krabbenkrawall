#!/usr/bin/env python3
# Browser-Test mit Playwright (Chromium). Aufruf: python3 quelle/test-browser.py [bilder-ordner]
# Startet selbst einen kleinen Webserver und prüft das fertige index.html.
import asyncio, http.server, json, math, os, pathlib, socketserver, sys, threading
from playwright.async_api import async_playwright

ORDNER = pathlib.Path(__file__).resolve().parent.parent
BILDER = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ORDNER / 'quelle' / 'testbilder'
BILDER.mkdir(parents=True, exist_ok=True)
KRABBENALARM = pathlib.Path.home() / 'krabbenalarm-app' / 'index.html'

class Leise(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=str(ORDNER), **k)
    def log_message(self, *a): pass
server = socketserver.TCPServer(('127.0.0.1', 0), Leise)
threading.Thread(target=server.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{server.server_address[1]}/index.html'

fehler, geprueft = [], 0
def ok(bed, text):
    global geprueft
    geprueft += 1
    if not bed:
        fehler.append(text); print('  FEHLER:', text)

async def warte_auf(pg, ausdruck, ms=20000):
    try:
        await pg.wait_for_function(ausdruck, timeout=ms)
        return True
    except Exception:
        return False

async def neue_seite(b, w, h, touch=False, dpr=1, init=None):
    ctx = await b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=dpr, has_touch=touch, is_mobile=touch)
    if init: await ctx.add_init_script(init)
    pg = await ctx.new_page()
    pg.fehler = []
    pg.on('console', lambda m: pg.fehler.append(m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: pg.fehler.append(str(e)))
    await pg.goto(URL)
    await pg.wait_for_timeout(300)
    return ctx, pg

async def level_bereit(pg, i):
    await pg.evaluate(f'window.__krawall.starteLevel({i})')
    return await warte_auf(pg, "window.__krawall.zustand() === 'zielen' && window.__krawall.kameraRuhig()", 8000)

async def im_bild(pg, selektor):
    return await pg.evaluate(f'''(() => {{ const r = document.querySelector('{selektor}').getBoundingClientRect();
      return r.width > 0 && r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1; }})()''')

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()

        # ---------------------------------------------------------- Größen
        print('\n## Darstellung bei 360×640, 390×844, 1440×900')
        for (w, h, touch, dpr) in [(360, 640, True, 3), (390, 844, True, 3), (1440, 900, False, 1)]:
            ctx, pg = await neue_seite(b, w, h, touch, dpr)
            name = f'{w}x{h}'
            await pg.screenshot(path=str(BILDER / f'{name}-start.png'))
            ok(await pg.evaluate('document.documentElement.scrollWidth <= innerWidth'), f'{name}: waagerechtes Scrollen')
            for s in ['#spielenKnopf', '#krabbeWahlKnopf', '.js-ton']:
                ok(await im_bild(pg, s), f'{name}: {s} nicht sichtbar')
            await pg.click('#krabbeWahlKnopf'); await pg.wait_for_timeout(300)
            await pg.screenshot(path=str(BILDER / f'{name}-krabben.png'))
            await pg.click('#krabbenFertig')
            await pg.evaluate("document.getElementById('levelZurueck') && 0")
            ok(await level_bereit(pg, 0), f'{name}: Level 1 nicht bereit')
            await pg.screenshot(path=str(BILDER / f'{name}-level1.png'))
            for s in ['#hudLevel', '#hudZieleFeld', '#hudKrabbenFeld', '#hudPunkteFeld', '#pauseKnopf', '#neuKnopfHud']:
                ok(await im_bild(pg, s), f'{name}: {s} außerhalb des Bildes')
            # Krabbe muss gut erkennbar sein (mind. ~20 CSS-Pixel pro Meter)
            zoom = await pg.evaluate('window.__krawall.kam.z / window.__krawall.dpr()')
            ok(zoom >= 26, f'{name}: Zoom zu klein ({zoom:.1f} px/m)')
            hud = await pg.evaluate("document.getElementById('hud').innerText")
            ok('Ziele:' in hud and 'Krabben:' in hud and 'Punkte:' in hud, f'{name}: HUD ohne Beschriftung: {hud!r}')
            print(f'  {name}: Startseite, Krabbenwahl und Level 1 im Bild, Zoom {zoom:.1f} px/m')
            # Level 12 (breitestes Level) und Levelauswahl
            await level_bereit(pg, 11)
            await pg.screenshot(path=str(BILDER / f'{name}-level12.png'))
            await pg.click('#pauseKnopf'); await pg.wait_for_timeout(200)
            await pg.screenshot(path=str(BILDER / f'{name}-pause.png'))
            await pg.click('#pauseLevelKnopf'); await pg.wait_for_timeout(300)
            await pg.screenshot(path=str(BILDER / f'{name}-levelwahl.png'), full_page=False)
            ok(await pg.evaluate('document.querySelectorAll(".karte").length') == 12, f'{name}: nicht 12 Levelkarten')
            ok(await pg.evaluate('document.documentElement.scrollWidth <= innerWidth'), f'{name}: Levelwahl scrollt waagerecht')
            ok(not pg.fehler, f'{name}: Konsolenfehler {pg.fehler}')
            await ctx.close()

        # ---------------------------------------------------------- Maus
        print('\n## Maus: ziehen, zu kurzer Klick, Pause-Knopf')
        ctx, pg = await neue_seite(b, 1440, 900)
        await level_bereit(pg, 0)
        k = await pg.evaluate('window.__krawall.zuBild(0, 2.6)')
        await pg.mouse.click(k['x'], k['y'])
        await pg.wait_for_timeout(300)
        ok(await pg.evaluate('window.__krawall.welt().schuesseUebrig') == 3, 'Kurzer Klick hat einen Versuch verbraucht')
        await pg.click('#pauseKnopf')
        ok(await pg.evaluate('window.__krawall.zustand()') == 'pause', 'Pause-Knopf pausiert nicht')
        ok(await pg.evaluate('window.__krawall.welt().schuesseUebrig') == 3, 'Pause-Knopf hat geschossen')
        t1 = await pg.evaluate('window.__krawall.welt().takt'); await pg.wait_for_timeout(800)
        t2 = await pg.evaluate('window.__krawall.welt().takt')
        ok(t1 == t2, 'Physik läuft in der Pause weiter')
        await pg.click('#weiterKnopf'); await pg.wait_for_timeout(200)
        ok(await pg.evaluate('window.__krawall.zustand()') == 'zielen', 'Weiter geht nicht zurück zum Zielen')
        # Ziehen über die Krabbe hinaus (Zeiger verlässt die Krabbe)
        ziel = await pg.evaluate('window.__krawall.zuBild(-1.6, 1.6)')
        await pg.mouse.move(k['x'], k['y']); await pg.mouse.down()
        for i in range(1, 16):
            await pg.mouse.move(k['x'] + (ziel['x'] - k['x']) * i / 15, k['y'] + (ziel['y'] - k['y']) * i / 15); await pg.wait_for_timeout(16)
        kam1 = await pg.evaluate('JSON.stringify(window.__krawall.kam)')
        await pg.wait_for_timeout(300)
        kam2 = await pg.evaluate('JSON.stringify(window.__krawall.kam)')
        ok(kam1 == kam2, 'Kamera bewegt sich während des Zielens')
        await pg.screenshot(path=str(BILDER / 'maus-zielen.png'))
        await pg.mouse.up(); await pg.wait_for_timeout(150)
        ok(await pg.evaluate('window.__krawall.welt().schuesseUebrig') == 2, 'Maus-Zug löst keinen Schuss aus')
        await pg.wait_for_timeout(500)
        await pg.screenshot(path=str(BILDER / 'maus-flug.png'))
        print('  Kurzer Klick ohne Versuch, Pause-Knopf schießt nicht, Pause hält die Physik an, Ziehen schießt, Kamera fest beim Zielen')

        # ---------------------------------------------------------- Tabwechsel / Neustart
        print('\n## Tabwechsel, Neustart')
        await pg.evaluate("Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange'))")
        ok(await pg.evaluate('window.__krawall.zustand()') == 'pause', 'Tabwechsel pausiert nicht')
        await pg.evaluate("Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })")
        await pg.wait_for_timeout(500)
        ok(await pg.evaluate('window.__krawall.zustand()') == 'pause', 'Spiel läuft nach Tabwechsel von allein weiter')
        alt = await pg.evaluate('(() => { window.__alteWelt = window.__krawall.welt(); return 1; })()')
        await pg.click('#neuKnopf'); await pg.wait_for_timeout(200)
        ok(await pg.evaluate('window.__alteWelt.welt.getBodyCount() === 0 && window.__alteWelt.teile.length === 0'), 'Alte Welt nach Neustart nicht geleert')
        ok(await pg.evaluate('window.__krawall.welt() !== window.__alteWelt && window.__krawall.welt().punkte === 0 && window.__krawall.welt().schuesseUebrig === 3'), 'Neustart setzt nicht zurück')
        print('  Tabwechsel pausiert, Fortsetzen nur durch Spieler, Neustart leert die alte Welt vollständig')

        # ---------------------------------------------------------- Tastatur
        print('\n## Tastatur')
        await warte_auf(pg, "window.__krawall.zustand() === 'zielen' && window.__krawall.kameraRuhig()", 6000)
        await pg.focus('#bild')
        await pg.keyboard.press('ArrowUp')
        for _ in range(4): await pg.keyboard.press('ArrowUp')
        for _ in range(3): await pg.keyboard.press('ArrowRight')
        zug = await pg.evaluate('window.__krawall.zug()')
        ok(zug is not None, 'Pfeiltasten zeigen keinen Zug')
        await pg.screenshot(path=str(BILDER / 'tastatur-zielen.png'))
        await pg.keyboard.press(' ')
        await pg.wait_for_timeout(150)
        ok(await pg.evaluate('window.__krawall.welt().schuesseUebrig') == 2, 'Leertaste schießt nicht')
        ok(await pg.evaluate('scrollY') == 0, 'Spieltasten scrollen die Seite')
        # Leertaste auf einem fokussierten Knopf darf keinen Schuss auslösen
        await pg.click('#neuKnopfHud')
        await warte_auf(pg, "window.__krawall.zustand() === 'zielen' && window.__krawall.kameraRuhig()", 6000)
        await pg.focus('#pauseKnopf'); await pg.keyboard.press(' ')
        await pg.wait_for_timeout(200)
        ok(await pg.evaluate('window.__krawall.welt().schuesseUebrig') == 3, 'Leertaste auf Pause-Knopf hat geschossen')
        print('  Pfeiltasten zielen, Leertaste schießt, kein Scrollen, Leertaste auf einem Knopf schießt nicht')
        ok(not pg.fehler, f'Maus/Tastatur: Konsolenfehler {pg.fehler}')
        await ctx.close()

        # ---------------------------------------------------------- Touch
        print('\n## Touch (Finger) und pointercancel')
        ctx, pg = await neue_seite(b, 390, 844, True, 3)
        await level_bereit(pg, 0)
        cdp = await ctx.new_cdp_session(pg)
        k = await pg.evaluate('window.__krawall.zuBild(0, 2.6)')
        z = await pg.evaluate('window.__krawall.zuBild(-1.5, 1.8)')
        async def touch(typ, x=None, y=None):
            pts = [] if x is None else [{'x': x, 'y': y, 'id': 1}]
            await cdp.send('Input.dispatchTouchEvent', {'type': typ, 'touchPoints': pts})
        await touch('touchStart', k['x'], k['y'])
        for i in range(1, 11):
            await touch('touchMove', k['x'] + (z['x'] - k['x']) * i / 10, k['y'] + (z['y'] - k['y']) * i / 10); await pg.wait_for_timeout(16)
        await touch('touchCancel')
        await pg.wait_for_timeout(200)
        ok(await pg.evaluate('window.__krawall.welt().schuesseUebrig') == 3, 'pointercancel hat geschossen')
        ok(await pg.evaluate('window.__krawall.zug() === null'), 'pointercancel lässt den Zug hängen')
        await touch('touchStart', k['x'], k['y'])
        for i in range(1, 11):
            await touch('touchMove', k['x'] + (z['x'] - k['x']) * i / 10, k['y'] + (z['y'] - k['y']) * i / 10); await pg.wait_for_timeout(16)
        await pg.screenshot(path=str(BILDER / 'touch-zielen.png'))
        await touch('touchEnd')
        await pg.wait_for_timeout(200)
        ok(await pg.evaluate('window.__krawall.welt().schuesseUebrig') == 2, 'Finger-Zug schießt nicht')
        await pg.wait_for_timeout(700)
        await pg.screenshot(path=str(BILDER / 'touch-flug.png'))
        ok(not pg.fehler, f'Touch: Konsolenfehler {pg.fehler}')
        print('  Finger ziehen und loslassen schießt, abgebrochene Berührung schießt nicht')
        await ctx.close()

        # ---------------------------------------------------------- Alle Level im echten Spiel
        print('\n## Alle 12 Lösungen im echten Game Loop (Originalkrabbe Kalle)')
        ctx, pg = await neue_seite(b, 1440, 900)
        loesungen = await pg.evaluate('window.__krawall.LEVEL.map(l => l.loesung)')
        loesungen = [(i, f) for i, f in enumerate(loesungen)] + [(2, await pg.evaluate('window.__krawall.LEVEL[2].loesungHoch'))]
        for i, folge in loesungen:
            await level_bereit(pg, i)
            for (w, s) in folge:
                await warte_auf(pg, "(window.__krawall.zustand() === 'zielen' && window.__krawall.kameraRuhig()) || window.__krawall.zustand() === 'erfolg'", 30000)
                if await pg.evaluate('window.__krawall.zustand()') == 'erfolg': break
                ok(await pg.evaluate(f'window.__krawall.schiesse({w}, {s})'), f'L{i+1}: Schuss nicht möglich')
            erfolg = await warte_auf(pg, "['erfolg','niederlage'].includes(window.__krawall.zustand())", 40000)
            z = await pg.evaluate('window.__krawall.zustand()')
            punkte = await pg.evaluate("document.getElementById('eGesamt').textContent")
            ok(z == 'erfolg', f'L{i+1}: im Browser {z}')
            print(f'  L{i+1}: {json.dumps(folge)} -> {z}, {punkte} Punkte')
            if z == 'erfolg' and i in (2, 8): await pg.screenshot(path=str(BILDER / f'erfolg-l{i+1}-{len(folge)}.png'))
            if i in (0, 6, 11): await pg.screenshot(path=str(BILDER / f'erfolg-l{i+1}.png'))
        ok(not pg.fehler, f'Level-Durchlauf: Konsolenfehler {pg.fehler}')

        # ---------------------------------------------------------- Nächste Krabbe
        print('\n## „Nächste Krabbe“')
        await level_bereit(pg, 11)
        await pg.evaluate('window.__krawall.schiesse(14, 0.9)')
        sichtbar = await warte_auf(pg, "!document.getElementById('naechsteKnopf').hidden", 15000)
        ok(sichtbar, '„Nächste Krabbe“ erscheint nicht')
        if sichtbar:
            ok(await im_bild(pg, '#naechsteKnopf'), '„Nächste Krabbe“ außerhalb des Bildes')
            await pg.screenshot(path=str(BILDER / 'naechste-krabbe.png'))
            await pg.click('#naechsteKnopf')
            ok(await warte_auf(pg, "window.__krawall.zustand() === 'zielen'", 6000), 'Nach „Nächste Krabbe“ kein Zielen')
            ok(await pg.evaluate('window.__krawall.welt().schuesseUebrig') == 3, 'Falsche Krabbenzahl nach „Nächste Krabbe“')
        print('  Knopf erscheint, sobald die Krabbe fertig ist; danach sofort zielen, Trümmer bleiben liegen')

        # ---------------------------------------------------------- Speicherstand
        print('\n## Speicherstand')
        daten = await pg.evaluate("JSON.parse(localStorage.getItem('pixelhafen.krabbenkrawall'))")
        ok(daten and daten['version'] == 2 and len(daten['level']) == 12, 'Fortschritt nicht gespeichert')
        sterne_vorher = daten['level']['1']['sterne']
        # Schlechtere Wiederholung von Level 1: Niederlage
        await level_bereit(pg, 0)
        for _ in range(3):
            await warte_auf(pg, "(window.__krawall.zustand() === 'zielen' && window.__krawall.kameraRuhig()) || window.__krawall.zustand() === 'niederlage'", 30000)
            await pg.evaluate('window.__krawall.schiesse(85, 0.25)')
        ok(await warte_auf(pg, "window.__krawall.zustand() === 'niederlage'", 40000), 'Niederlage wird nicht angezeigt')
        await pg.screenshot(path=str(BILDER / 'niederlage.png'))
        ok(await im_bild(pg, '#nochmalKnopf'), '„Noch einmal“ nicht sichtbar')
        await pg.reload(); await pg.wait_for_timeout(300)
        daten = await pg.evaluate("JSON.parse(localStorage.getItem('pixelhafen.krabbenkrawall'))")
        ok(daten['level']['1']['sterne'] == sterne_vorher, 'Sterne nach schlechterer Runde verloren')
        await pg.click('#spielenKnopf'); await pg.wait_for_timeout(300)
        gesperrt = await pg.evaluate('[...document.querySelectorAll(".karte")].filter(k => k.disabled).length')
        ok(gesperrt == 0, f'Nach allen Leveln noch {gesperrt} gesperrt')
        await pg.evaluate("localStorage.setItem('pixelhafen.krabbenkrawall', JSON.stringify({version: 1, ton: false, krabbe: 'viola', level: {1: {sterne: 2, best: 100}}}))")
        await pg.reload(); await pg.wait_for_timeout(300)
        ok(await pg.evaluate("document.querySelector('.js-ton').textContent") == 'Ton: aus', 'Ton-Einstellung nicht geladen')
        await pg.click('#spielenKnopf'); await pg.wait_for_timeout(300)
        frei = await pg.evaluate('[...document.querySelectorAll(".karte")].map(k => !k.disabled)')
        ok(frei[:2] == [True, True] and not any(frei[2:]), f'Freischaltung falsch: {frei}')
        await pg.screenshot(path=str(BILDER / 'levelwahl-teilweise.png'))
        await pg.evaluate("localStorage.setItem('pixelhafen.krabbenkrawall', '{kaputt')")
        await pg.reload(); await pg.wait_for_timeout(300)
        ok(not pg.fehler, f'Kaputter Speicher führt zu Fehlern: {pg.fehler}')
        # Übernahme aus dem alten Format (Version 1): Freischaltung, Ton, Krabbe bleiben
        await pg.evaluate("localStorage.clear(); localStorage.setItem('pixelhafen.krabbenkrawall', JSON.stringify({version: 1, ton: true, krabbe: 'goldi', level: {1: {sterne: 3, best: 26000}, 2: {sterne: 1, best: 9000}, 3: {sterne: 2, best: 20000}}}))")
        await pg.reload(); await pg.wait_for_timeout(300)
        neu = await pg.evaluate("JSON.parse(localStorage.getItem('pixelhafen.krabbenkrawall'))")
        ok(neu['version'] == 2 and neu['krabbe'] == 'goldi' and neu['frei'] == 4 and neu['level'] == {}, f'Übernahme aus Version 1 falsch: {neu}')
        ok(await pg.evaluate("localStorage.getItem('pixelhafen.krabbenkrawall-v1') !== null"), 'Alter Stand nicht aufbewahrt')
        await pg.click('#spielenKnopf'); await pg.wait_for_timeout(300)
        frei = await pg.evaluate('[...document.querySelectorAll(".karte")].map(k => !k.disabled)')
        ok(frei[:4] == [True] * 4 and not any(frei[4:]), f'Übernommene Freischaltung falsch: {frei}')
        print('  Version 2 gespeichert, Sterne bleiben bei schlechterer Runde, Ton/Krabbe/Freischaltung werden geladen, kaputte Daten stören nicht')
        print('  Alter Spielstand (Version 1): Freischaltung bis Level 4, Ton und Krabbe übernommen, alte Bestpunkte getrennt aufbewahrt')
        await ctx.close()

        # ---------------------------------------------------------- localStorage gesperrt
        print('\n## Ohne localStorage')
        sperre = "Object.defineProperty(window, 'localStorage', { get() { throw new Error('gesperrt'); } });"
        ctx, pg = await neue_seite(b, 1440, 900, init=sperre)
        await pg.click('#spielenKnopf')
        ok(await warte_auf(pg, "window.__krawall.zustand() === 'zielen' && window.__krawall.kameraRuhig()", 8000), 'Ohne localStorage startet kein Level')
        await pg.evaluate('window.__krawall.schiesse(6, 0.94)')
        ok(await warte_auf(pg, "window.__krawall.zustand() === 'erfolg'", 30000), 'Ohne localStorage kein Erfolg')
        ok(not pg.fehler, f'Ohne localStorage: Fehler {pg.fehler}')
        print('  Spiel startet, Level 1 lässt sich gewinnen, keine Fehler')
        await ctx.close()

        # ---------------------------------------------------------- Kalle = Original
        print('\n## Kalle sieht aus wie in Krabbenalarm (Pixelvergleich)')
        if KRABBENALARM.exists():
            optionen = [
                {'figur': 'kalle'},
                {'figur': 'kalle', 'mund': 'oh', 'blick': 0.7, 'blickHoch': True},
                {'figur': 'kalle', 'mund': 'jubel', 'schereAuf': True, 'tanzt': True, 'wedel': 1.3, 'lauf': 0.4},
                {'figur': 'kalle', 'mund': 'tot', 'schereHoch': True, 'lauf': 0.8},
                {'figur': 'kalle', 'blick': -1, 'wedel': 0.25, 'lauf': 0.15},
            ]
            js = '''(o) => { const c = document.createElement('canvas'); c.width = 176; c.height = 144;
              (window.kalleInLeinwand || window.krabbeInLeinwand)(c, o);
              const d = c.getContext('2d').getImageData(0, 0, 176, 144).data; let h = 0, n = 0;
              for (let i = 0; i < d.length; i++) { h = (h * 31 + d[i]) >>> 0; if (i % 4 === 3 && d[i]) n++; } return [h, n]; }'''
            ctx = await b.new_context(viewport={'width': 600, 'height': 600})
            a = await ctx.new_page(); await a.goto(KRABBENALARM.as_uri()); await a.wait_for_timeout(300)
            k2 = await ctx.new_page(); await k2.goto(URL); await k2.wait_for_timeout(300)
            for o in optionen:
                ha = await a.evaluate(js, o)
                hk = await k2.evaluate(js, o)
                ok(ha == hk and ha[1] > 1000, f'Kalle weicht vom Original ab bei {o}: {ha} vs {hk}')
            print(f'  {len(optionen)} Posen verglichen (176×144 Pixel): identisch mit Krabbenalarm')
            await ctx.close()
        else:
            print('  Krabbenalarm nicht gefunden – übersprungen')

        await b.close()
    print(f'\n{geprueft} Browser-Prüfungen, {len(fehler)} Fehler. Bilder: {BILDER}')
    server.shutdown()
    sys.exit(1 if fehler else 0)

asyncio.run(main())
