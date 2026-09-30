# Headless playthroughs for the audit. Run inside the cellgate-bridge image:
#   docker run --rm --network host -v $PWD/<dir>:/w cellgate-bridge-cellgate-bridge:latest python /w/play.py
import json, re, sys
from playwright.sync_api import sync_playwright

BASE = 'http://localhost:5397/'
OUT = '/w/shots/'
SOL = json.load(open('/w/solutions.json'))
log = []

def P(*a):
    s = ' '.join(str(x) for x in a); log.append(s); print(s, flush=True)

SPECIAL = {'<Esc>': 'Escape', '<CR>': 'Enter', '<BS>': 'Backspace', '<Tab>': 'Tab', '<S-Tab>': 'Shift+Tab', '<Space>': ' ', '<lt>': '<', '<Del>': 'Delete'}
def send(page, k):
    if k in SPECIAL: page.keyboard.press(SPECIAL[k])
    elif re.fullmatch(r'<C-(.)>', k): page.keyboard.press('Control+' + k[3])
    elif re.fullmatch(r'<A-(.)>', k): page.keyboard.press('Alt+' + k[3])
    elif len(k) == 1: page.keyboard.type(k)
    else: P('  ?? key', k)
    page.wait_for_timeout(15)

def fresh(browser, w=1400, h=1000):
    ctx = browser.new_context(viewport={'width': w, 'height': h})
    page = ctx.new_page()
    errs = []
    page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
    page.on('console', lambda m: m.type in ('error', 'warning') and errs.append(f'console.{m.type}: {m.text}'))
    return ctx, page, errs

def goto(page, hsh):
    page.goto(BASE + '#' + hsh, wait_until='load')
    page.wait_for_selector('.editor')
    page.focus('.editor')

def label(page):
    return page.eval_on_selector('.ed-title', 'e => e.innerText').replace('\n', ' ')

def done(page):
    return page.locator('.results').count() > 0

def shot(page, name):
    page.evaluate("document.querySelector('.editor')?.scrollIntoView({block:'center'})")
    page.screenshot(path=OUT + name + '.png')

def rel(page, sel):
    return page.evaluate("""sel => { const c = document.querySelector('[data-cursor]'), t = document.querySelector(sel);
      if (!c || !t) return null; const a = c.getBoundingClientRect(), b = t.getBoundingClientRect();
      return { dy: Math.round((b.top - a.top) / a.height), dx: Math.round((b.left - a.left) / a.width) }; }""", sel)

def chase(page, sel, act, limit=60):
    for i in range(limit):
        if done(page): return True
        r = rel(page, sel)
        if r is None: P('  no', sel); return False
        for _ in range(abs(r['dy'])): send(page, 'j' if r['dy'] > 0 else 'k')
        r = rel(page, sel)
        if r is None: continue
        for _ in range(abs(r['dx'])): send(page, 'l' if r['dx'] > 0 else 'h')
        act(page)
        page.wait_for_timeout(40)
    return done(page)

def rounds(page, keys_per_round, name):
    for i, ks in enumerate(keys_per_round):
        before = label(page)
        for k in ks: send(page, k)
        page.wait_for_timeout(550)
        if not done(page) and label(page) == before:
            P(f'  round {i+1} not solved from carried cursor; :reset and retry')
            for k in ':reset': send(page, k)
            send(page, '<CR>'); page.wait_for_timeout(100)
            for k in ks: send(page, k)
            page.wait_for_timeout(550)
            if not done(page) and label(page) == before:
                P(f'  round {i+1} STILL unsolved: {label(page)}'); shot(page, name + f'-stuck-r{i+1}'); return False
    return done(page)

with sync_playwright() as p:
    b = p.chromium.launch()
    # 1. target
    ctx, page, errs = fresh(b); goto(page, 'move'); shot(page, '01-move-start')
    ok = chase(page, '[data-target]', lambda pg: None); P('move done', ok, errs); shot(page, '01-move-results'); ctx.close()
    # 2. word
    ctx, page, errs = fresh(b); goto(page, 'words')
    ok = chase(page, '[data-target]', lambda pg: None); P('words done', ok, errs); shot(page, '02-words-results'); ctx.close()
    # 3. fix
    ctx, page, errs = fresh(b); goto(page, 'x'); shot(page, '03-x-start')
    page.evaluate("document.querySelectorAll('.ev-text .cell').forEach(c => { if (c.style.textDecoration.includes('line-through')) c.setAttribute('data-mark','1') })")
    def fixact(pg):
        send(pg, 'x')
        pg.evaluate("document.querySelectorAll('[data-mark]').forEach(c=>c.removeAttribute('data-mark')); document.querySelectorAll('.ev-text .cell').forEach(c => { if (c.style.textDecoration.includes('line-through')) c.setAttribute('data-mark','1') })")
    ok = chase(page, '[data-mark]', fixact); P('x done', ok, errs); shot(page, '03-x-results'); ctx.close()
    # 4. replace
    ctx, page, errs = fresh(b); goto(page, 'r'); shot(page, '04-r-start')
    def mark_r(pg): pg.evaluate("document.querySelectorAll('[data-mark]').forEach(c=>c.removeAttribute('data-mark')); const h = document.querySelector('.cell .hint'); if (h) h.parentElement.setAttribute('data-mark', h.textContent)")
    mark_r(page)
    def ract(pg):
        ch = pg.evaluate("document.querySelector('[data-cursor]')?.querySelector('.hint')?.textContent || document.querySelector('[data-mark]')?.getAttribute('data-mark')")
        send(pg, 'r'); send(pg, ch); mark_r(pg)
    ok = chase(page, '[data-mark]', ract); P('r done', ok, errs); shot(page, '04-r-results'); ctx.close()
    # 5. rounds lessons, incl. plugin sims
    for i, (lid, ks) in enumerate([(k, v) for k, v in SOL.items() if '?' not in k]):
        ctx, page, errs = fresh(b); goto(page, lid); shot(page, f'1{i}-{lid}-start')
        ok = rounds(page, ks, f'1{i}-{lid}'); P(lid, 'done', ok, errs); shot(page, f'1{i}-{lid}-end'); ctx.close()
    # 6. generated
    for i, (lid, ks) in enumerate([(k, v) for k, v in SOL.items() if '?' in k]):
        ctx, page, errs = fresh(b); goto(page, lid); shot(page, f'2{i}-gen-start')
        for k in ks[0]: send(page, k)
        page.wait_for_timeout(300); P(lid, 'done', done(page), errs); shot(page, f'2{i}-gen-end'); ctx.close()
    open(OUT + 'play.log', 'w').write('\n'.join(log))
    b.close()
