// What the curriculum has taught by a given lesson, and which lessons the coach runs on.
import { LESSONS, ORDER, SECTIONS, sectionOf } from '../lessons';

/** Counts on motions are explained in prose here ("3w jumps three words ahead"). */
export const COUNTS_TAUGHT_FROM = 'words';

const NAMED: Record<string, string> = {
  esc: '<Esc>', '<esc>': '<Esc>', cr: '<CR>', '<cr>': '<CR>', enter: '<CR>', '<leader>': '<Space>', '␣': '<Space>', '<space>': '<Space>', '<tab>': '<Tab>',
};
/** Words that are prose, not keys: init.lua, vim.opt, macros, norm. */
const PROSE = /^[a-z]+(\.[a-z]+)+$|^[a-z]{4,}$/i;
const PROSE_WORDS = new Set(['tab', 'norm', 'macros']);
const TWO = /^(dd|yy|cc|gg|ge|gE|gc|gu|gU|g~|gv|gn|gN|gJ|gJ|gq|gw|gi|gd|gf|gt|gT|gs|gr|ga|g8|g;|g&|zz|zt|zb|zo|zc|za|zM|zR|zf|zj|zk|cs|ds|ys|cx|cr|ZZ|<<|>>|==|\[[a-zA-Z]|\][a-zA-Z]|q:)/;

/** Split a chip into engine tokens: operators, motions, text objects, prefixes, specials. */
export function tokenize(chip: string): string[] {
  const out: string[] = [];
  for (let p of chip.trim().split(/\s+/)) {
    if (!p) continue;
    const low = p.toLowerCase();
    if (NAMED[low]) { out.push(NAMED[low]); continue; }
    if (/^<c-.>$/i.test(p)) { out.push(`<C-${p[3].toLowerCase()}>`); continue; }
    if (/^C-.$/i.test(p)) { out.push(`<C-${p[2].toLowerCase()}>`); continue; }
    if (/^<[A-Za-z-]+>$/.test(p)) { out.push(p); continue; }
    if (PROSE_WORDS.has(low) || (PROSE.test(p) && !/^[gz][a-z]$/.test(p))) continue;
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
const ENTERS_TEXT = new Set([':', '/', '?']);

/**
 * The command tokens of one completed command, as the learner ran it: leading count and
 * register prefix handled, the argument of f/t/r/m/`/'/q/@ dropped, cmdline and inserted text
 * dropped, so `f(` → f, `"ayy` → " yy, `cwuser<Esc>` → c w, `/leader<CR>` → /.
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
    if (ENTERS_TEXT.has(k)) break;                                                        // cmdline text follows
    const prev = rest[rest.length - 2];
    if (ARG_HEADS.has(k) && !/^[ia]$/.test(prev ?? '')) break;                             // an argument follows (it/at keep their t)
    if (rest.length === 1 && /^[iaAIoOsSCR]$/.test(k)) break;                             // insert command: text follows
    if (rest[0] === 'c' && rest.length >= 2 && (/^[ia]$/.test(prev) || (rest.length === 2 && /^[wWeEbB$0^lhjkc]$/.test(k)))) break; // change: text follows
  }
  return [...out, ...tokenize(rest.join(''))];
}

const cache = new Map<string, Set<string>>();

export function taughtBy(lessonId: string): Set<string> {
  const hit = cache.get(lessonId);
  if (hit) return hit;
  const lesson = LESSONS[lessonId];
  const set = new Set<string>();
  const add = (id: string) => { const l = LESSONS[id]; for (const c of [...l.chips, ...l.keyCards.map(k => k.key)]) for (const t of tokenize(c)) set.add(t); };
  if (lesson?.challenge.kind === 'generated') {
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
export function coachable(lessonId: string): boolean {
  const l = LESSONS[lessonId];
  if (!l) return false;
  if (l.challenge.kind !== 'rounds' && l.challenge.kind !== 'generated') return false;
  const sec = sectionOf(lessonId);
  return !UNCOACHED_SECTIONS.has(sec.id);
}

/** Macros (deliberately safe motions while recording) and the plugin-driven sections whose
 * rounds run through pickers, modals or plugin operators the motion critic does not model. */
export const UNCOACHED_SECTIONS = new Set(['macros', 'surround', 'more-text-objects', 'jumping', 'finding-things', 'file-navigation', 'git']);
