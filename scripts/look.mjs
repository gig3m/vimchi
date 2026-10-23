// Visual harness: see a lesson the way a learner does, as screenshots an agent can read.
//
//   node scripts/look.mjs <lesson-id> [--keys "round 1 keys|round 2 keys|…"] [--rounds 2,5] [--out dir]
//   node scripts/look.mjs --sweep [--out dir]        every round's opening screen, every lesson
//
// Keys are Vim notation (`dt)iuse<Esc>`, `<C-d>`, `<lt>`), fed through the editor's own keydown
// handler. Without --keys each round plays the lesson's own solution. A round with an empty
// entry in --keys is played by its solution too; any other entry is taken literally, spaces included. --rounds limits the opening shots (all rounds
// are still played, so the results screen is real).
//
// Writes PNGs of the practice panel (prompt, goal marks, coach hint, results) and an index.md
// listing each shot with the round's prompt and the keys played. Starts the dev server on 5317
// if it is not running, and stops it afterwards.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const opt = name => {
  const i = args.indexOf(name);
  return i >= 0 ? args.splice(i, 2)[1] : undefined;
};
const sweep = args.includes('--sweep') && args.splice(args.indexOf('--sweep'), 1);
const keysArg = opt('--keys');
const roundsArg = opt('--rounds');
const outArg = opt('--out');
const id = args[0];
const out = outArg ?? join('look', sweep ? 'sweep' : id ?? '');
if (!sweep && !id) {
  console.error('usage: node scripts/look.mjs <lesson-id> [--keys "r1|r2"] [--rounds 2,5] [--out dir] | --sweep');
  process.exit(2);
}
const only = roundsArg ? new Set(roundsArg.split(',').map(Number)) : null;
const BASE = 'http://localhost:5317/';

async function up() {
  try { return (await fetch(BASE)).ok ? null : undefined; } catch { /* not running */ }
  const dev = spawn('npx', ['vite', '--port', '5317', '--strictPort'], { stdio: 'ignore', detached: true });
  dev.unref(); // the script exits when it is done; the exit handler takes vite with it
  for (let i = 0; i < 100; i++) {
    await new Promise(r => setTimeout(r, 200));
    try { if ((await fetch(BASE)).ok) return dev; } catch { /* starting */ }
  }
  throw new Error('dev server did not start on 5317');
}

const dev = await up();
// A dev server this script started goes when it does, error or not (strictPort would block the next one).
process.on('exit', () => { if (dev) try { process.kill(-dev.pid); } catch { /* gone */ } });
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => process.exit(130));
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium' });
const page = await browser.newPage({ viewport: { width: 1400, height: 1100 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
// Analytics and /api (no backend under `vite`) fail in dev; those are not the page's errors.
page.on('console', m => m.type() === 'error' && !/cloudflareinsights|Failed to load resource/.test(m.text()) && errors.push(m.text()));
mkdirSync(out, { recursive: true });
const index = [];

/** Vim keys → keydown events on the editor, through its own handler. */
async function feed(keys) {
  await page.evaluate(keys => {
    const ed = document.querySelector('.editor');
    const special = { Esc: 'Escape', CR: 'Enter', BS: 'Backspace', Tab: 'Tab', Del: 'Delete', Up: 'ArrowUp', Down: 'ArrowDown', Left: 'ArrowLeft', Right: 'ArrowRight', Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown', Space: ' ', lt: '<', Bslash: '\\', Bar: '|' };
    for (const k of keys) {
      const ev = { key: k, ctrlKey: false, altKey: false, shiftKey: false, bubbles: true, cancelable: true };
      const m = /^<(?:([CAS])-)?(.+)>$/.exec(k);
      if (m) {
        if (m[1] === 'C') ev.ctrlKey = true;
        if (m[1] === 'A') ev.altKey = true;
        if (m[1] === 'S') ev.shiftKey = true;
        ev.key = special[m[2]] ?? m[2];
      }
      ed.dispatchEvent(new KeyboardEvent('keydown', ev));
    }
  }, keys);
  await page.waitForTimeout(40);
}

/** Wait out the round's ✓ until the next round is on screen (counter moved, round-ok gone; a
 * round may have no prompt). False when the round never finished: its keys did not reach the goal. */
async function settle(before, more) {
  if (!more) { await page.waitForTimeout(300); return true; }
  for (let i = 0; i < 60; i++) {
    if ((await label()) !== before && !(await page.$('.ed-body.round-ok'))) return true;
    await page.waitForTimeout(50);
  }
  return false;
}
/** The app keeps the cursor where the last round left it when the file is unchanged, but a round's
 * solution starts at the round's own cursor. Put it back there without keys (keys would be coached
 * as the learner's), and say where it was ('' when nothing carried). */
const walkBack = () => page.evaluate(() => {
  const s = window.__vimchi.session;
  const at = s?.vim?.cursor, start = s?.roundStart;
  if (!at || !start || (at.line === start.line && at.col === start.col)) return '';
  s.vim.win.cursor = { ...start };
  s.vim.win.want = start.col;
  s.vim.win.top = s.roundTop;
  // Par and the coach then count the round as played from its start, as it was. These are private
  // Session fields: fail loudly if they are renamed, rather than quietly inflating par.
  if (!('carryExtra' in s) || !Array.isArray(s.carryByRound)) throw new Error('Session carry fields moved: update walkBack in look.mjs');
  s.carryExtra = 0;
  s.carryByRound[s.roundIdx] = 0;
  return `line ${at.line + 1} col ${at.col + 1}`;
});
const label = () => page.$eval('.ed-title > span:last-child', e => e.textContent).catch(() => '');
const prompt = () => page.$eval('.ed-prompt', e => e.textContent).catch(() => '');
const opens = async () => (await prompt()) || '(no written prompt; the goal is marked in the editor)';
let n = 0;
let lastHint = null;
async function shot(name, note) {
  const file = `${String(++n).padStart(3, '0')}-${name}.png`;
  await page.evaluate(() => document.querySelector('.practice')?.scrollIntoView({ block: 'start' }));
  await (await page.$('.practice')).screenshot({ path: join(out, file) });
  index.push(`- \`${file}\`: ${note}`);
}

async function open(lesson) {
  await page.goto(`${BASE}#${lesson}`, { waitUntil: 'load' });
  await page.waitForSelector('.editor');
  await page.focus('.editor');
  return page.evaluate(id => {
    const { LESSONS, parseKeys } = window.__vimchi;
    const l = LESSONS[id];
    const c = l.challenge;
    const rounds = c.kind === 'rounds' ? c.rounds.map(r => ({ prompt: r.prompt ?? '', steps: (r.steps ?? []).map(s => s.prompt), solution: r.solution, keys: parseKeys(r.solution) })) : [];
    return { title: l.title, kind: c.kind, rounds };
  }, lesson);
}

if (sweep) {
  const ids = await (async () => { await open('move'); return page.evaluate(() => Object.keys(window.__vimchi.LESSONS)); })();
  for (const lesson of ids) {
    // One lesson's trouble (a screen without the editor, say) is a finding, not the end of the sweep.
    try {
      const l = await open(lesson);
      if (l.kind !== 'rounds') continue;
      for (let r = 0; r < l.rounds.length; r++) {
        if (!(await page.$('.editor'))) { index.push(`- **${lesson} round ${r + 1}: no editor on screen** (shot taken)`); await page.screenshot({ path: join(out, `${String(++n).padStart(3, '0')}-${lesson}-r${r + 1}-noeditor.png`) }); break; }
        await shot(`${lesson}-r${r + 1}`, `**${l.title}** round ${r + 1}: ${await opens()}`);
        const before = await label();
        await walkBack();
        await feed(l.rounds[r].keys);
        if (!(await settle(before, r + 1 < l.rounds.length))) index.push(`- **${lesson} round ${r + 1}: its solution did not finish the round**`);
      }
    } catch (e) {
      index.push(`- **${lesson}: the harness failed here**: ${String(e).split('\n')[0]}`);
    }
  }
} else {
  const l = await open(id);
  const scripted = keysArg?.split('|');
  index.push(`# ${l.title} (${id})`, '');
  if (l.kind !== 'rounds') {
    if (keysArg) await feed(await page.evaluate(k => window.__vimchi.parseKeys(k), keysArg.replace(/\|/g, '')));
    await shot('end', `after ${keysArg ? `\`${keysArg}\`` : 'no keys'}`);
  }
  for (let r = 0; r < l.rounds.length; r++) {
    const round = l.rounds[r];
    const mine = scripted?.[r] || undefined;
    // The start shot shows the cursor where the learner finds it. Your own keys are played from
    // there; the solution needs the round's start.
    if (!only || only.has(r + 1)) await shot(`r${r + 1}-start`, `round ${r + 1} opens: ${await opens()}`);
    const back = mine ? '' : await walkBack();
    const keys = mine ? await page.evaluate(k => window.__vimchi.parseKeys(k), mine) : round.keys;
    const played = mine ? `your keys \`${mine}\`` : `the solution \`${round.solution}\`${back ? ` (the cursor carried over to ${back}; the harness put it back at the round's start first)` : ''}`;
    // Feed key by key so a step change (yank → put) gets its own shot, and the live hint shows.
    let p = await prompt();
    const before = await label();
    for (const k of keys) {
      await feed([k]);
      const q = await prompt();
      if (q !== p && q && !q.startsWith('✓') && (!only || only.has(r + 1))) await shot(`r${r + 1}-step`, `round ${r + 1}, next step: ${q}`);
      p = q;
      const hint = await page.$eval('.ev-cmdline.coach', e => e.textContent).catch(() => null);
      if (hint && hint !== lastHint && (!only || only.has(r + 1))) await shot(`r${r + 1}-hint`, `round ${r + 1}, live hint after \`${k}\`: ${hint}`);
      lastHint = hint;
    }
    index.push(`  - played ${played}`);
    if (!(await settle(before, r + 1 < l.rounds.length))) index.push(`  - **round ${r + 1} did not finish**: later keys went to it, so the shots after this are off`);
  }
  const done = await page.waitForSelector('.results', { timeout: 3000 }).then(() => true, () => false);
  await shot('results', done ? 'results screen' : l.kind === 'rounds' || keysArg ? '**no results screen**: the run did not finish' : 'end (no keys played)');
}

writeFileSync(join(out, 'index.md'), index.join('\n') + (errors.length ? `\n\n## Page errors\n${errors.map(e => `- ${e}`).join('\n')}\n` : '\n'));
console.log(`${n} shots in ${out}/ (index.md)${errors.length ? `, ${errors.length} page errors` : ''}`);
await browser.close();
