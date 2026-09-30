from playwright.sync_api import sync_playwright
exec(open('/w/play.py').read().split('with sync_playwright() as p:')[0])
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx, page, errs = fresh(b); goto(page, 'challenge-fix-the-file?seed=7')
    items = lambda: page.eval_on_selector_all('.checklist-text', 'es => es.map(e => e.textContent).join(" | ")')
    seven = items(); P('seed7 items', seven)
    for k in SOL['challenge-fix-the-file?seed=7'][0]: send(page, k)
    page.wait_for_timeout(200); send(page, 'f'); page.wait_for_timeout(200)
    other = items(); P('after f items', other, 'hash', page.evaluate('location.hash'))
    page.evaluate("location.hash = '#challenge-fix-the-file?seed=7'"); page.wait_for_timeout(300)
    now = items(); P('after reopening ?seed=7 items', now); P('STALE' if now == other and now != seven else 'OK-loaded-7' if now == seven else 'other')
    page.reload(wait_until='load'); page.wait_for_timeout(300); P('after reload', 'OK' if items() == seven else 'differs')
    ctx.close(); b.close()
