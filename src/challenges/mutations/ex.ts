// Ex-command mutations for Challenge 5 (rename & replace): a botched rename across several lines
// (`*` + `cgn` + `.`, or `:%s/old/new/g`), the same junk line left in several places
// (`:g/pat/d`), and leftover trailing comments with different words (`:%s/\v …$//`). Each par is
// the cheaper of the Ex route and the plain Normal-mode route; the Ex text is at most 24 chars.
import { type Rng, pick, randInt, shuffle } from '../rng';
import { JUNK, NOISE, indentOf, langOf } from './lines';
import { type MutationKind, type Site, keyText, words } from './types';

/** Longest command-line text (between `:` and Enter) an Ex fix may type. */
export const MAX_CMDLINE = 24;
/** Longest text a Normal-mode route may type. */
const MAX_TYPED = 6;
const MAX_LINE = 72;
/** Widest window (in lines) one Ex item may cover. */
const WINDOW = 14;
const filled = (l: string | undefined): l is string => l !== undefined && l.trim() !== '';
const clip = (s: string, n = 22) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
/** Keys of a notation string. */
const len = (k: string) => k.replace(/<[^>]+>/g, '#').length;
const ex = (text: string) => `:${text}<CR>`;

const KEYWORDS = new Set([
  'if', 'else', 'for', 'while', 'do', 'in', 'of', 'return', 'break', 'func', 'package', 'import', 'export',
  'const', 'let', 'var', 'type', 'new', 'local', 'end', 'then', 'elseif', 'and', 'or', 'not', 'nil', 'null',
  'true', 'false', 'range', 'go', 'defer', 'struct', 'class', 'public', 'private', 'static', 'async', 'await',
  'function', 'string', 'number', 'this', 'int', 'bool', 'error', 'continue', 'throw',
]);
/** Text other kinds put into a file: a wrong name must not occur in it, or one `:s` would hit both. */
const FOREIGN = [...NOISE, ...Object.values(JUNK).flat(), 'trace', 'old', 'tmp', 'TODO', 'FIXME'].join('\n');

/** Every whole-word occurrence of `w` in `l`, as columns. */
const occurrences = (l: string, w: string) => words(l).filter(x => x.text === w).map(x => x.col);

/**
 * Sites: an identifier and a window of 3–6 lines that use it (all its uses in that window),
 * starting and ending on a use, at most WINDOW lines tall. site.col is the first use.
 */
function renameSites(lines: readonly string[]): Site[] {
  const uses = new Map<string, number[]>();
  lines.forEach((l, line) => { for (const w of words(l)) if (w.text.length >= 3 && w.text.length <= 10 && !KEYWORDS.has(w.text)) { const u = uses.get(w.text) ?? []; if (u[u.length - 1] !== line) u.push(line); uses.set(w.text, u); } });
  const out: Site[] = [];
  for (const [w, ls] of uses) {
    for (let i = 0; i < ls.length; i++) for (let j = i + 2; j < Math.min(ls.length, i + 6); j++) {
      if (ls[j] - ls[i] + 1 > WINDOW) break;
      out.push({ line: ls[i], col: occurrences(lines[ls[i]], w)[0], len: ls[j] - ls[i] + 1 });
    }
  }
  return out;
}

/** Misspellings of `w`: one inner letter dropped, or two neighbouring letters swapped. */
function misspellings(w: string): string[] {
  const out = new Set<string>();
  for (let k = 1; k < w.length - 1; k++) if (/[a-z]/i.test(w[k])) out.add(w.slice(0, k) + w.slice(k + 1));
  for (let k = 1; k + 1 < w.length; k++) if (w[k] !== w[k + 1] && /[a-z]/i.test(w[k] + w[k + 1])) out.add(w.slice(0, k) + w[k + 1] + w[k] + w.slice(k + 2));
  return [...out].filter(x => x.length >= 3 && /^[A-Za-z_]\w*$/.test(x));
}

/**
 * The same identifier misspelled on every use in a window (a rename gone wrong) → `*` on the
 * first, `cgn` + the name, `.` for the rest; or `:%s/wrong/right/g`. Whichever is fewer keys.
 */
export const renamedIdent: MutationKind = {
  id: 'renamed-ident',
  weight: 4,
  sites: renameSites,
  apply(lines, site, rng) {
    const w = words(lines[site.line]).find(x => x.col === site.col)!.text;
    const text = lines.join('\n');
    const wrongs = misspellings(w).filter(x => !text.includes(x) && !FOREIGN.includes(x));
    if (!wrongs.length) return null;
    const wrong = pick(rng, wrongs);
    const window = lines.slice(site.line, site.line + site.len);
    const re = new RegExp(`\\b${w}\\b`, 'g');
    const body = window.map(l => l.replace(re, wrong));
    const count = window.reduce((n, l) => n + occurrences(l, w).length, 0);
    const perLine = Math.max(...window.map(l => occurrences(l, w).length));
    const routes: string[] = [];
    const cmd = `%s/${wrong}/${w}/${perLine > 1 ? 'g' : ''}`;
    if (cmd.length <= MAX_CMDLINE) routes.push(ex(cmd));
    if (w.length <= MAX_TYPED) routes.push(`*cgn${keyText(w)}<Esc>${'.'.repeat(count - 1)}`);
    if (!routes.length) return null;
    const keys = routes.sort((a, b) => len(a) - len(b))[0];
    const isEx = keys.startsWith(':');
    return {
      kind: 'renamed-ident', site, span: site.len, lines: body,
      fixAt: { dline: 0, col: site.col }, fixKeys: keys, parMs: 300 * len(keys) + 1500, multi: true, anywhere: isEx,
      claims: [wrong],
      checklist: `"${wrong}" → "${w}" (${count} places)`,
    };
  },
};

const MARKS: Record<string, string[]> = {
  ts: ["console.debug('trace');", 'debugger; // trace me'],
  go: ['log.Println("trace")', '// trace: remove'],
  lua: ["print('trace')", '-- trace: remove'],
};

/** Windows of `min`–`max` lines that start and end on a non-blank line. */
function windows(lines: readonly string[], min: number, max: number): Site[] {
  const out: Site[] = [];
  lines.forEach((l, line) => {
    if (!filled(l)) return;
    for (let n = min; n <= max && line + n <= lines.length; n++) if (filled(lines[line + n - 1])) out.push({ line, col: 0, len: n });
  });
  return out;
}

/** `inner` more lines of a window passing `test`, plus its first and last, in order. */
function anchors(lines: readonly string[], site: Site, rng: Rng, test: (l: string) => boolean, inner: [number, number]): number[] | null {
  const first = site.line, last = site.line + site.len - 1;
  if (!test(lines[first]) || !test(lines[last])) return null;
  const pool = shuffle(rng, lines.slice(first + 1, last).flatMap((l, i) => (test(l) ? [first + 1 + i] : [])));
  const want = randInt(rng, inner[0], inner[1]);
  if (pool.length < want) return null;
  return [first, ...pool.slice(0, want), last].sort((a, b) => a - b);
}

/**
 * Motion keys the Normal-mode route spends reaching its first line, which an Ex command does not:
 * an allowance so the comparison is fair (the generator adds the real motion to the par).
 */
const REACH = 3;

/**
 * The same debugging line left after 4–5 lines of a window → `:g/trace/d`, or `dd` and `j.`
 * down the window when that is fewer keys.
 */
export const junkLines: MutationKind = {
  id: 'junk-lines',
  weight: 2,
  once: true,
  sites: lines => (lines.some(l => l.includes('trace')) ? [] : windows(lines, 8, 16)),
  apply(lines, site, rng) {
    const at = anchors(lines, site, rng, filled, [2, 3]);
    if (!at) return null;
    const junk = pick(rng, MARKS[langOf(lines)]);
    const body: string[] = [];
    const junkAt: number[] = [];
    for (let i = site.line; i < site.line + site.len; i++) {
      body.push(lines[i]);
      if (at.includes(i)) { junkAt.push(body.length); body.push(indentOf(lines[i]) + junk); }
    }
    const cmd = ex('g/trace/d');
    // dd on the first, then down to each next one (it sits one line higher once the one above is gone) and `.`.
    let plain = 'dd';
    for (let k = 1; k < junkAt.length; k++) { const d = junkAt[k] - junkAt[k - 1] - 1; plain += `${d > 1 ? d : ''}j.`; }
    const isEx = len(cmd) <= len(plain) + REACH;
    return {
      kind: 'junk-lines', site, span: site.len, lines: body,
      fixAt: { dline: junkAt[0], col: 0 }, fixKeys: isEx ? cmd : plain, parMs: isEx ? 3500 : 900 * junkAt.length, multi: true, anywhere: isEx,
      checklist: `delete the ${junkAt.length} "${junk.trim()}" lines`,
    };
  },
};

const TAILS: Record<string, { words: string[]; mark: string; re: RegExp; cmd: string }> = {
  ts: { words: ['old', 'tmp', 'TODO', 'FIXME'], mark: ' // ', re: / \/\/ \w+$/, cmd: '%s/\\v \\/\\/ \\w+$//' },
  go: { words: ['old', 'tmp', 'TODO', 'FIXME'], mark: ' // ', re: / \/\/ \w+$/, cmd: '%s/\\v \\/\\/ \\w+$//' },
  lua: { words: ['old', 'tmp', 'TODO', 'FIXME'], mark: ' -- ', re: / -- \w+$/, cmd: '%s/\\v -- \\w+$//' },
};

/**
 * Leftover trailing comments, a different word on each of 3–4 lines → one `:%s/\v …$//`, or
 * `$2F D` and the same again down the window when that is fewer keys.
 */
export const mixedTails: MutationKind = {
  id: 'mixed-tails',
  weight: 2,
  once: true,
  sites(lines) {
    const t = TAILS[langOf(lines)];
    return lines.some(l => t.re.test(l)) ? [] : windows(lines, 5, WINDOW);
  },
  apply(lines, site, rng) {
    const t = TAILS[langOf(lines)];
    const ok = (l: string) => filled(l) && !/\/\/|--/.test(l) && l.length + 9 <= MAX_LINE;
    const at = anchors(lines, site, rng, ok, [1, 2]);
    if (!at) return null;
    const ws = shuffle(rng, t.words);
    const body = lines.slice(site.line, site.line + site.len).map((l, i) => {
      const k = at.indexOf(site.line + i);
      return k < 0 ? l : l + t.mark + ws[k % ws.length];
    });
    const cmd = ex(t.cmd);
    let plain = '$2F D';
    for (let k = 1; k < at.length; k++) { const d = at[k] - at[k - 1]; plain += `${d > 1 ? d : ''}j$2F .`; }
    const isEx = len(cmd) <= len(plain) + REACH;
    return {
      kind: 'mixed-tails', site, span: site.len, lines: body,
      fixAt: { dline: at[0] - site.line, col: 0 }, fixKeys: isEx ? cmd : plain, parMs: isEx ? 5000 : 1000 * at.length, multi: true, anywhere: isEx,
      checklist: `remove the ${at.length} trailing "${t.mark.trim()} …" comments from "${clip(lines[at[0]].trim())}"`,
    };
  },
};

export const EX_KINDS: MutationKind[] = [renamedIdent, junkLines, mixedTails];
