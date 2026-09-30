// What the curriculum has taught by a given lesson, and which lessons the coach runs on.
import { LESSONS, ORDER, SECTIONS, sectionOf } from '../lessons';
import type { Challenge } from '../lessons/types';

/** Counts on motions are explained in prose here ("3w jumps three words ahead"). */
export const COUNTS_TAUGHT_FROM = 'words';

const NAMED: Record<string, string> = {
  esc: '<Esc>', '<esc>': '<Esc>', cr: '<CR>', '<cr>': '<CR>', enter: '<CR>', '<leader>': '<Space>', '␣': '<Space>', '<space>': '<Space>', '<tab>': '<Tab>',
};
/** Words that are prose, not keys: init.lua, vim.opt, macros, norm. */
const PROSE = /^[a-z]+(\.[a-z]+)+$|^[a-z]{4,}$/i;
const PROSE_WORDS = new Set(['tab', 'norm', 'macros']);
const TWO = /^(dd|yy|cc|cl|gg|ge|gE|g-|g\+|gc|gu|gU|g~|gv|gn|gN|gJ|gJ|gq|gw|gi|gd|gf|gt|gT|gs|gr|ga|g8|g;|g&|zz|zt|zb|zo|zc|za|zM|zR|zf|zj|zk|cs|ds|ys|yS|sa|sd|sr|sf|sF|cx|cr|ZZ|<<|>>|==|\[[a-zA-Z]|\][a-zA-Z]|q:)/;

/** Split a chip into engine tokens: operators, motions, text objects, prefixes, specials. */
export function tokenize(chip: string, opts: { prose?: boolean } = {}): string[] {
  const out: string[] = [];
  for (let p of chip.trim().split(/\s+/)) {
    if (!p) continue;
    const low = p.toLowerCase();
    if (NAMED[low]) { out.push(NAMED[low]); continue; }
    if (/^<c-.>$/i.test(p)) { out.push(`<C-${p[3].toLowerCase()}>`); continue; }
    if (/^C-.$/i.test(p)) { out.push(`<C-${p[2].toLowerCase()}>`); continue; }
    if (/^<[A-Za-z-]+>$/.test(p)) { out.push(p); continue; }
    if (opts.prose !== false && (PROSE_WORDS.has(low) || (PROSE.test(p) && !/^[gz][a-z]$/.test(p)))) continue;
    if (p.startsWith(':')) { out.push(':'); continue; }
    if (/^[/?]/.test(p)) { out.push(p[0]); continue; }
    if (p.startsWith('\\')) continue;                       // regex atoms, not keys
    p = p.replace(/^[0-9]+/, '');                            // leading count
    while (p.length) {
      let m: RegExpMatchArray | null;
      if (p.startsWith('␣')) { out.push('<Space>'); p = p.slice(1); continue; }
      if ((m = p.match(/^"[^\s]?/))) { out.push('"'); p = p.slice(m[0].length); continue; }          // register prefix
      if ((m = p.match(/^[ia][wWsSpPbBt(){}\[\]<>"'`]/))) { out.push(m[0]); p = p.slice(2); continue; } // text object
      if ((m = p.match(TWO))) { out.push(m[0]); p = p.slice(m[0].length); continue; }
      if ((m = p.match(/^[0-9]+/))) { p = p.slice(m[0].length); continue; }                          // inner count (d3w)
      out.push(p[0]); p = p.slice(1);
    }
  }
  return out;
}

/** Commands whose next key is an argument (a character, mark, register or macro name), not a command. */
const ARG_HEADS = new Set(['f', 'F', 't', 'T', 'r', 'm', '`', "'", 'q', '@']);
/** Modes in which a key is text (or a prompt answer), not a command. */
export const TEXT_MODES = new Set(['insert', 'replace', 'cmdline', 'confirm', 'prompt']);

/**
 * The command tokens of one completed command from its NON-TEXT keys (the caller drops keys fed
 * in insert/replace/cmdline mode): leading count and register prefix handled, the argument of
 * f/t/r/m/`/'/q/@ dropped, so `f(` → f, `"ayy` → " yy, `cw` → c w, `<C-v>jj` → <C-v> j j.
 */
export function commandTokens(keys: readonly string[]): string[] {
  let i = 0;
  const out: string[] = [];
  const skipCount = () => { if (/^[1-9]$/.test(keys[i] ?? '')) while (/^[0-9]$/.test(keys[i] ?? '')) i++; };
  skipCount();
  if (keys[i] === '"' && i + 1 < keys.length) { out.push('"'); i += 2; skipCount(); }
  const rest: string[] = [];
  for (; i < keys.length; i++) {
    const k = keys[i];
    rest.push(k);
    const prev = rest[rest.length - 2];
    if (ARG_HEADS.has(k) && !/^[ia]$/.test(prev ?? '')) break; // an argument follows (it/at keep their t)
  }
  // Surround commands take their pair character as an argument: after the motion for sa/ys,
  // right after the command for sd/sf/sF/ds and sr/cs (two of them).
  const head = rest.slice(0, 2).join('');
  if (/^(sd|sf|sF|ds|sr|cs)$/.test(head)) return [...out, head];
  if (/^(sa|ys|yS)$/.test(head) && rest.length > 2) rest.pop();
  if (rest[0] === 'S' && rest.length === 2) return [...out, 'S'];
  // Special keys (<C-v>, <Esc>) are their own chips; plain keys run together so gg/ge/ciw tokenize as units.
  const text = rest.map(k => (k.length > 1 ? ` ${k} ` : k)).join('');
  return [...out, ...tokenize(text, { prose: false })]; // keys ran together are never prose
}

const cache = new Map<string, Set<string>>();

export function taughtBy(lessonId: string): Set<string> {
  const hit = cache.get(lessonId);
  if (hit) return hit;
  const lesson = LESSONS[lessonId];
  const set = new Set<string>();
  const OPERATOR_OF: Record<string, string> = { '>>': '>', '<<': '<', '==': '=' };
  const add = (id: string) => { const l = LESSONS[id]; for (const c of [...l.chips, ...l.keyCards.map(k => k.key)]) for (const t of tokenize(c)) { set.add(t); if (OPERATOR_OF[t]) set.add(OPERATOR_OF[t]); } };
  // Not a lesson (the Warm-up included): nothing is known to be taught. See warmUpTaught.
  if (!lesson) { cache.set(lessonId, set); return set; }
  if (lesson.challenge.kind === 'generated') {
    for (const sid of lesson.challenge.sections) for (const l of SECTIONS.find(s => s.id === sid)?.lessons ?? []) add(l.id);
    set.add('COUNT');
  } else {
    let past = false;
    for (const l of ORDER) {
      if (l.challenge.kind === 'generated') continue;
      add(l.id);
      if (l.id === COUNTS_TAUGHT_FROM) past = true;
      if (past) set.add('COUNT');
      if (l.id === lessonId) break;
    }
  }
  cache.set(lessonId, set);
  return set;
}

export function usesAllowed(uses: string[], taught: Set<string>): boolean {
  return uses.every(u => taught.has(u));
}

/** The coach runs on rounds lessons and generated challenges, outside the Macros section and the Plugins band. */
/** The spaced-review session (src/warmup) is coached like a generated challenge over the lessons it drew from (warmUpTaught). */
export const WARM_UP = 'warm-up';

export function coachable(lessonId: string): boolean {
  if (lessonId === WARM_UP) return true;
  const l = LESSONS[lessonId];
  if (!l) return false;
  if (l.challenge.kind !== 'rounds' && l.challenge.kind !== 'generated') return false;
  const sec = sectionOf(lessonId);
  return !UNCOACHED_SECTIONS.has(sec.id);
}

/** Macros (deliberately safe motions while recording) and the plugin-driven sections whose
 * rounds run through pickers, modals or plugin operators the motion critic does not model. */
export const UNCOACHED_SECTIONS = new Set(['macros', 'surround', 'more-text-objects', 'jumping', 'finding-things', 'file-navigation', 'git']);

const warmCache = new Map<string, Set<string>>();

/**
 * What a Warm-up may coach: the union of what its picked lessons taught (`picks`, lesson ids).
 * Without picks, the lower bound its challenge proves: for each mutation kind in the run, the
 * earliest lesson whose Reps drill it (every pick is at or after that lesson, and taughtBy is
 * cumulative, so nothing suggested is a key the learner has not met).
 */
export function warmUpTaught(picks?: readonly string[], challenge?: Challenge): Set<string> {
  let ids = (picks ?? []).filter(id => LESSONS[id]);
  if (!ids.length && challenge?.kind === 'generated') {
    ids = challenge.mutations.map(m => ORDER.find(l => l.reps?.mutations.includes(m))?.id).filter((id): id is string => !!id);
  }
  const key = [...new Set(ids)].sort().join(',');
  const hit = warmCache.get(key);
  if (hit) return hit;
  const set = new Set<string>();
  for (const id of ids) for (const t of taughtBy(id)) set.add(t);
  warmCache.set(key, set);
  return set;
}
