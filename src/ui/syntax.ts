// Per-character syntax colours (Dracula) for the handful of filetypes lessons use.

export const C = {
  bg: '#282a36', fg: '#f8f8f2', comment: '#6272a4', cyan: '#8be9fd', green: '#50fa7b',
  orange: '#ffb86c', pink: '#ff79c6', purple: '#bd93f9', red: '#ff5555', yellow: '#f1fa8c',
};

type Lang = { kw: Set<string>; types?: Set<string>; lits: Set<string>; comment: RegExp; strings: RegExp };

const words = (s: string) => new Set(s.split(/\s+/).filter(Boolean));

const JS: Lang = {
  kw: words('const let var function return if else class new throw await async export import from for of in while do typeof instanceof extends constructor switch case default break continue try catch finally type interface enum implements as yield delete void static get set readonly'),
  types: words('string number boolean void any unknown never object Promise Record Array'),
  lits: words('true false null undefined this super NaN Infinity'),
  comment: /\/\/.*$|\/\*.*?\*\//,
  strings: /'(?:[^'\\]|\\.)*'?|"(?:[^"\\]|\\.)*"?|`[^`]*`?/,
};
const LUA: Lang = {
  kw: words('local function end if then else elseif for in do while repeat until return and or not break goto'),
  lits: words('true false nil self'),
  comment: /--.*$/,
  strings: /'(?:[^'\\]|\\.)*'?|"(?:[^"\\]|\\.)*"?|\[\[.*?\]\]/,
};
const PY: Lang = {
  kw: words('def return if elif else for in while import from as class with try except finally raise pass lambda and or not is yield global'),
  lits: words('True False None self'),
  comment: /#.*$/,
  strings: /'(?:[^'\\]|\\.)*'?|"(?:[^"\\]|\\.)*"?/,
};
const GO: Lang = {
  kw: words('func return if else for range package import var const type struct interface map chan go defer select switch case default break continue'),
  types: words('string int int64 float64 bool error byte rune'),
  lits: words('true false nil'),
  comment: /\/\/.*$/,
  strings: /"(?:[^"\\]|\\.)*"?|`[^`]*`?/,
};
const SH: Lang = {
  kw: words('if then else fi for do done while case esac function export alias echo return in'),
  lits: words('true false'),
  comment: /#.*$/,
  strings: /'[^']*'?|"(?:[^"\\]|\\.)*"?/,
};
const VIM: Lang = {
  kw: words('set let map nnoremap vnoremap inoremap noremap autocmd function endfunction if endif call'),
  lits: words(''),
  comment: /^\s*".*$/,
  strings: /'[^']*'?/,
};

const LANGS: Record<string, Lang> = { typescript: JS, javascript: JS, json: JS, lua: LUA, python: PY, go: GO, sh: SH, vim: VIM };

const TOKEN = (l: Lang) => new RegExp(
  `(${l.comment.source})|(${l.strings.source})|(\\b\\d+(?:\\.\\d+)?\\b)|([A-Za-z_$][\\w$]*)|(=>|===|!==|==|~=|[=+\\-*/!<>&|?%.:]+)|(.)`,
  'g',
);
const TOKENS = new Map<Lang, RegExp>();

export function colorize(t: string, filetype: string): string[] {
  const col = new Array<string>(t.length).fill(C.fg);
  if (filetype === 'markdown') return markdown(t, col);
  if (filetype === 'qf') return quickfix(t, col);
  if (filetype === 'fugitive') return fugitive(t, col);
  if (filetype === 'git' || filetype === 'diff' || filetype === 'gitcommit') return gitish(t, col);
  if (filetype === 'csv') return csv(t, col);
  if (filetype === 'help') return help(t, col);
  const lang = LANGS[filetype];
  if (!lang) return col;
  let re = TOKENS.get(lang);
  if (!re) TOKENS.set(lang, (re = TOKEN(lang)));
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    const s = m.index, w = m[0];
    let c = C.fg;
    if (m[1]) c = C.comment;
    else if (m[2]) c = filetype === 'json' && t.slice(s + w.length).trimStart().startsWith(':') ? C.cyan : C.yellow;
    else if (m[3]) c = C.purple;
    else if (m[4]) {
      if (lang.kw.has(w)) c = w === 'constructor' ? C.green : C.pink;
      else if (lang.lits.has(w)) c = C.purple;
      else if (lang.types?.has(w)) c = C.cyan;
      else if (t[s + w.length] === '(') c = C.green;
      else if (/^[A-Z]/.test(w)) c = C.cyan;
    } else if (m[5]) c = w === '.' || w === ':' ? C.fg : C.pink;
    for (let i = s; i < s + w.length; i++) col[i] = c;
    if (!w.length) re.lastIndex++;
  }
  return col;
}

function paint(col: string[], s: number, e: number, c: string) {
  for (let i = s; i < Math.min(e, col.length); i++) col[i] = c;
}

function markdown(t: string, col: string[]) {
  if (/^#{1,6}\s/.test(t)) return paint(col, 0, t.length, C.purple), col;
  if (/^\s*[-*+]\s/.test(t)) paint(col, 0, t.indexOf(t.trim()[0]) + 1, C.cyan);
  if (/^\s*>/.test(t)) paint(col, 0, t.length, C.comment);
  for (const m of t.matchAll(/`[^`]*`/g)) paint(col, m.index!, m.index! + m[0].length, C.green);
  for (const m of t.matchAll(/\*\*[^*]+\*\*|__[^_]+__/g)) paint(col, m.index!, m.index! + m[0].length, C.orange);
  for (const m of t.matchAll(/\[[^\]]*\]\([^)]*\)/g)) paint(col, m.index!, m.index! + m[0].length, C.cyan);
  return col;
}

function quickfix(t: string, col: string[]) {
  const m = /^([^|]*)\|([^|]*)\|/.exec(t);
  if (m) {
    paint(col, 0, m[1].length, C.cyan);
    paint(col, m[1].length, m[0].length, C.comment);
    paint(col, m[1].length + 1, m[1].length + 1 + m[2].length, C.yellow);
  }
  return col;
}

function fugitive(t: string, col: string[]) {
  if (/^(Head|Push|Merge):/.test(t)) paint(col, 0, t.indexOf(':') + 1, C.purple);
  else if (/^(Untracked|Unstaged|Staged|Unpushed|Unpulled)\b/.test(t)) paint(col, 0, t.length, C.pink);
  else if (/^[MADRU?] /.test(t)) paint(col, 0, 1, t[0] === 'A' ? C.green : t[0] === 'D' ? C.red : t[0] === '?' ? C.comment : C.orange);
  else if (t.startsWith('+')) paint(col, 0, t.length, C.green);
  else if (t.startsWith('-')) paint(col, 0, t.length, C.red);
  else if (t.startsWith('@@')) paint(col, 0, t.length, C.purple);
  return col;
}

function gitish(t: string, col: string[]) {
  if (t.startsWith('+')) paint(col, 0, t.length, C.green);
  else if (t.startsWith('-')) paint(col, 0, t.length, C.red);
  else if (t.startsWith('@@')) paint(col, 0, t.length, C.purple);
  else if (t.startsWith('#')) paint(col, 0, t.length, C.comment);
  else if (/^[0-9a-f]{7,}/.test(t)) paint(col, 0, t.indexOf(' '), C.yellow);
  return col;
}

/** Help pages: *tags* purple, |links| cyan (bars dimmed), 'options' green, section titles orange. */
function help(t: string, col: string[]) {
  if (/^\d+\. [A-Z]/.test(t)) paint(col, 0, t.search(/\s{2,}|$/), C.orange);
  for (const m of t.matchAll(/'[a-z]{2,}'/g)) paint(col, m.index!, m.index! + m[0].length, C.green);
  for (const m of t.matchAll(/\*[^\s*|"]+\*/g)) paint(col, m.index!, m.index! + m[0].length, C.purple);
  for (const m of t.matchAll(/\|[^\s*|"]+\|/g)) {
    paint(col, m.index!, m.index! + m[0].length, C.cyan);
    col[m.index!] = col[m.index! + m[0].length - 1] = C.comment;
  }
  return col;
}

function csv(t: string, col: string[]) {
  const palette = [C.fg, C.cyan, C.green, C.orange, C.pink, C.purple];
  let field = 0;
  for (let i = 0; i < t.length; i++) {
    if (t[i] === ',') { col[i] = C.comment; field++; continue; }
    col[i] = palette[field % palette.length];
  }
  return col;
}
