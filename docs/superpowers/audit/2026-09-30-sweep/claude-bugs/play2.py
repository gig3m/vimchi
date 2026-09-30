import json, re
from playwright.sync_api import sync_playwright
exec(open('/w/play.py').read().split('with sync_playwright() as p:')[0])
with sync_playwright() as p:
    b = p.chromium.launch()
    # B. stale seed after New file
    ctx, page, errs = fresh(b); goto(page, 'challenge-fix-the-file?seed=7')
    for k in SOL['challenge-fix-the-file?seed=7'][0]: send(page, k)
    page.wait_for_timeout(200)
    P('seed7 done', done(page), page.inner_text('.result-seed'))
    send(page, 'f'); page.wait_for_timeout(200)
    P('after f: hash', page.evaluate('location.hash'), 'file', page.inner_text('.ed-file'), 'items', page.inner_text('.checklist-count'))
    first_item = page.inner_text('.checklist-item')
    page.evaluate("location.hash = '#challenge-fix-the-file?seed=7'"); page.wait_for_timeout(300)
    P('after re-open ?seed=7: hash', page.evaluate('location.hash'), 'file', page.inner_text('.ed-file'), 'first item', page.inner_text('.checklist-item').replace('\n',' '), '(was', first_item.replace('\n',' '), ')')
    shot(page, '30-stale-seed'); P('errs', errs); ctx.close()
    # C/D. unknown id + bad seed
    ctx, page, errs = fresh(b); page.goto(BASE + '#no-such-lesson', wait_until='load'); page.wait_for_timeout(300)
    P('unknown id -> h1', page.inner_text('h1'), 'hash', page.evaluate('location.hash'))
    page.goto(BASE + '#challenge-operators?seed=abc', wait_until='load'); page.wait_for_timeout(300)
    P('bad seed -> h1', page.inner_text('h1'), 'hash', page.evaluate('location.hash')); ctx.close()
    # H. search in movement lesson
    ctx, page, errs = fresh(b); goto(page, 'words')
    for k in '/con': send(page, k)
    P('words /con cmdline:', page.inner_text('.ev-cmdline')); shot(page, '31-search-in-words'); ctx.close()
    # n from results: state reset + back button
    ctx, page, errs = fresh(b); goto(page, 'change-words')
    rounds(page, SOL['change-words'], 'x'); P('change-words done', done(page))
    send(page, 'n'); page.wait_for_timeout(300)
    P('after n: hash', page.evaluate('location.hash'), 'h1', page.inner_text('h1'), 'results?', done(page), 'label', label(page), 'focused', page.evaluate("document.activeElement?.className"))
    page.go_back(); page.wait_for_timeout(300)
    P('after back: hash', page.evaluate('location.hash'), 'h1', page.inner_text('h1'), 'results?', done(page), 'label', label(page))
    # Tab on results screen
    ctx.close()
    ctx, page, errs = fresh(b); goto(page, 'change-words'); rounds(page, SOL['change-words'], 'x')
    send(page, '<Tab>'); P('Tab on results: active', page.evaluate("document.activeElement?.className + ' ' + (document.activeElement?.innerText||'').slice(0,20)"))
    ctx.close()
    # E. narrow widths
    for w in (390, 768):
        ctx, page, errs = fresh(b, w, 900)
        goto(page, 'change-words'); page.screenshot(path=OUT + f'32-change-words-{w}.png', full_page=False)
        sw = page.evaluate('[document.documentElement.scrollWidth, document.documentElement.clientWidth]')
        page.evaluate("document.querySelector('.editor').scrollIntoView({block:'start'})"); page.screenshot(path=OUT + f'33-change-words-editor-{w}.png')
        goto(page, 'challenge-fix-the-file?seed=7'); page.evaluate("document.querySelector('.editor').scrollIntoView({block:'start'})"); page.screenshot(path=OUT + f'34-gen-{w}.png')
        P('width', w, 'scrollWidth/clientWidth', sw, errs); ctx.close()
    # I. 1400 generated editor/checklist widths
    ctx, page, errs = fresh(b); goto(page, 'challenge-fix-the-file?seed=7')
    P('gen widths', page.evaluate("(() => { const p = document.querySelector('.ev-panes'); const c = document.querySelector('.ev-text .cell'); return {panes: p.clientWidth, scroll: p.scrollWidth, ch: c.getBoundingClientRect().width, gutter: document.querySelector('.ev-gutter').getBoundingClientRect().width} })()"))
    ctx.close()
    open(OUT + 'play2.log', 'w').write('\n'.join(log)); b.close()
