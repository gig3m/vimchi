// vim-abolish (tpope/vim-abolish):
//   cr{c}  coerce the word under the cursor: crs/cr_ snake_case, crc camelCase, crm/crp MixedCase,
//          cru/crU UPPER_CASE, cr-/crk dash-case, cr. dot.case, cr<Space> space case, crt Title Case
//   :[range]S[ubvert]/pat{a,b}/rep{x,y}/[gw]  substitute every case variant (lower, Mixed, UPPER)
//          of every brace alternative with the matching variant of the replacement

import type { Plugin, Vim } from '../editor';
import { firstNonBlank } from '../text';
import { fail, pos } from '../types';

// ---- case coercion (ported from abolish.vim) ---------------------------------------------------

export function camelcase(word: string) {
  const w = word.replace(/-/g, '_');
  if (!w.includes('_') && /[a-z]/.test(w)) return w.replace(/^./, c => c.toLowerCase());
  return w.replace(/(_)?(.)/g, (_m, u: string | undefined, c: string) => (u ? c.toUpperCase() : c.toLowerCase()));
}
export const mixedcase = (w: string) => camelcase(w).replace(/^./, c => c.toUpperCase());
export function snakecase(word: string) {
  return word
    .replace(/::/g, '/')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[.-]/g, '_')
    .toLowerCase();
}
export const uppercase = (w: string) => snakecase(w).toUpperCase();
export const dashcase = (w: string) => snakecase(w).replace(/_/g, '-');
export const dotcase = (w: string) => snakecase(w).replace(/_/g, '.');
export const spacecase = (w: string) => snakecase(w).replace(/_/g, ' ');
export const titlecase = (w: string) => spacecase(w).replace(/\b\w/g, c => c.toUpperCase());

const COERCIONS: Record<string, (w: string) => string> = {
  c: camelcase, m: mixedcase, p: mixedcase, s: snakecase, _: snakecase, u: uppercase, U: uppercase,
  '-': dashcase, k: dashcase, '.': dotcase, ' ': spacecase, t: titlecase,
};

function coerce(vim: Vim, kind: string) {
  const f = COERCIONS[kind];
  if (!f) fail();
  const t = vim.line();
  const at = vim.cursor.col;
  const isW = (c: string | undefined) => !!c && /\w/.test(c);
  if (!isW(t[at])) fail();
  let s = at, e = at;
  while (s > 0 && isW(t[s - 1])) s--;
  while (e + 1 < t.length && isW(t[e + 1])) e++;
  const word = t.slice(s, e + 1);
  const out = f(word);
  if (out !== word) {
    vim.buf.setLine(vim.cursor.line, t.slice(0, s) + out + t.slice(e + 1));
    vim.buf.recordChange(pos(vim.cursor.line, s));
  }
  vim.setCursor(pos(vim.cursor.line, Math.min(at, s + out.length - 1)));
}

// ---- :Subvert ---------------------------------------------------------------------------------------

/** Expand {a,b} groups; the replacement's groups follow the pattern's choices by position. */
export function expandBraces(lhs: string, rhs: string): [string, string][] {
  const m = /\{([^{}]*)\}/.exec(lhs);
  if (!m) return [[lhs, rhs]];
  const alts = m[1].split(',');
  const r = /\{([^{}]*)\}/.exec(rhs);
  const ralts = r ? r[1].split(',') : null;
  const out: [string, string][] = [];
  alts.forEach((a, i) => {
    const l2 = lhs.slice(0, m.index) + a + lhs.slice(m.index + m[0].length);
    // "{}" in the replacement reuses the pattern's alternative.
    const rep = ralts ? (r![1] === '' ? a : ralts[i] ?? ralts[ralts.length - 1]) : '';
    const r2 = r ? rhs.slice(0, r.index) + rep + rhs.slice(r.index + r[0].length) : rhs;
    out.push(...expandBraces(l2, r2));
  });
  return out;
}

export function subvertDictionary(lhs: string, rhs: string): Map<string, string> {
  const dict = new Map<string, string>();
  for (const [l, r] of expandBraces(lhs, rhs)) {
    dict.set(mixedcase(l), mixedcase(r));
    dict.set(l.toLowerCase(), r.toLowerCase());
    dict.set(l.toUpperCase(), r.toUpperCase());
    dict.set(l, r);
  }
  return dict;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function splitArgs(arg: string): string[] {
  const sep = arg[0];
  const parts: string[] = [];
  let cur = '';
  for (let i = 1; i < arg.length; i++) {
    if (arg[i] === '\\' && arg[i + 1] === sep) { cur += sep; i++; continue; }
    if (arg[i] === sep) { parts.push(cur); cur = ''; continue; }
    cur += arg[i];
  }
  parts.push(cur);
  return parts;
}

export const abolish: Plugin = {
  name: 'abolish',
  setup: vim => {
    vim.defineAction('cr', { arg: 'char', change: true, run: c => coerce(vim, c.arg) });

    vim.defineEx('Subvert', 1, a => {
      if (!a.arg || /^\w/.test(a.arg)) fail('E471: Argument required');
      const [pat, rep, flags = ''] = splitArgs(a.arg);
      if (!pat) fail('E35: No previous regular expression');
      const dict = subvertDictionary(pat, rep ?? '');
      const keys = [...dict.keys()].filter(Boolean).sort((x, y) => y.length - x.length);
      const word = flags.includes('w');
      const re = new RegExp((word ? '\\b(?:' : '(?:') + keys.map(escapeRe).join('|') + (word ? ')\\b' : ')'), flags.includes('g') ? 'g' : '');
      if (rep === undefined) {
        // :S/pat searches for any variant.
        vim.search = { pattern: `\\v${word ? '<' : ''}(${keys.map(k => k.replace(/[\\/.*+?^$~()|[\]{}=@<>%&]/g, '\\$&')).join('|')})${word ? '>' : ''}`, dir: 1, offset: '', noSmartcase: true };
        vim.hlActive = true;
        vim.feedKeys('n');
        return;
      }
      const range = a.range ?? { start: vim.cursor.line, end: vim.cursor.line };
      vim.beginChange();
      let subs = 0, lines = 0, last = -1;
      for (let l = range.start; l <= range.end; l++) {
        const t = vim.line(l);
        let n = 0;
        const out = t.replace(re, m => { n++; return dict.get(m) ?? m; });
        if (n) {
          vim.buf.setLine(l, out);
          subs += n;
          lines++;
          last = l;
        }
      }
      if (!subs) fail(`E486: Pattern not found: ${pat}`);
      vim.buf.recordChange(pos(last, 0));
      vim.setCursor(pos(last, firstNonBlank(vim.line(last))));
      if (subs > 2 || lines > 2) vim.msg(`${subs} substitution${subs === 1 ? '' : 's'} on ${lines} line${lines === 1 ? '' : 's'}`);
    });
  },
};
