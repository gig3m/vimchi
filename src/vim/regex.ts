// Vim regular expressions → JavaScript RegExp.
//
// Supports magic levels (\v \m \M \V), \< \>, \zs \ze, \{n,m} and \{-},
// \( \) \%( \) \|, \= \? \+, \@= \@! \@<= \@<! after groups, character
// classes (\s \d \w \a \l \u \x \h \k \i \f and negations), \_x newline
// variants, \c \C, and POSIX bracket classes. Patterns are matched against a
// whole buffer joined with "\n", so ^ and $ use the JS "m" flag.

export class PatternError extends Error {}

export type Compiled = {
  re: RegExp;
  /** Pattern source as typed, for history and messages. */
  source: string;
};

const CLASSES: Record<string, string> = {
  s: '[ \\t]', S: '[^ \\t\\n]', d: '\\d', D: '[^\\d\\n]', w: '[0-9A-Za-z_]', W: '[^0-9A-Za-z_\\n]',
  a: '[A-Za-z]', A: '[^A-Za-z\\n]', l: '[a-z]', L: '[^a-z\\n]', u: '[A-Z]', U: '[^A-Z\\n]',
  x: '[0-9A-Fa-f]', X: '[^0-9A-Fa-f\\n]', o: '[0-7]', O: '[^0-7\\n]', h: '[A-Za-z_]', H: '[^A-Za-z_\\n]',
  k: '[0-9A-Za-z_\\u00C0-\\uFFFF]', K: '[A-Za-z_\\u00C0-\\uFFFF]', i: '[0-9A-Za-z_\\u00C0-\\uFFFF]', I: '[A-Za-z_\\u00C0-\\uFFFF]',
  f: '[0-9A-Za-z_/.~+,#$%-]', F: '[A-Za-z_/.~+,#$%-]', p: '[\\x20-\\x7E\\u00A0-\\uFFFF]', P: '[\\x21-\\x7E\\u00A0-\\uFFFF]',
};
const POSIX: Record<string, string> = {
  alpha: 'A-Za-z', digit: '0-9', alnum: '0-9A-Za-z', lower: 'a-z', upper: 'A-Z', space: ' \\t\\n\\r\\f\\v',
  blank: ' \\t', punct: '!-\\/:-@\\[-`{-~', xdigit: '0-9A-Fa-f', word: '0-9A-Za-z_', return: '\\r', tab: '\\t', escape: '\\x1b', backspace: '\\x08',
};
const WORD = '[0-9A-Za-z_]';
const JS_SPECIAL = /[\\^$.*+?()[\]{}|/]/;

type Magic = 'v' | 'm' | 'M' | 'V';

/**
 * Translate a Vim pattern. `ignorecase`/`smartcase` follow Vim's options;
 * \c and \C inside the pattern override them.
 */
export function compile(pattern: string, opts: { ignorecase?: boolean; smartcase?: boolean } = {}): Compiled {
  let magic: Magic = 'm';
  let caseFlag: 'i' | 'c' | null = null;
  let out = '';
  const atomStarts: number[] = []; // output index where the most recent atom began
  const groupStack: number[] = [];
  let zs = -1, ze = -1;
  let atLineStart = true; // ^ is an anchor here
  let i = 0;
  const n = pattern.length;

  const pushAtom = (s: string) => {
    atomStarts.push(out.length);
    out += s;
    atLineStart = false;
  };
  const lit = (ch: string) => {
    pushAtom(JS_SPECIAL.test(ch) ? '\\' + ch : ch);
  };
  const lastAtom = () => {
    const s = atomStarts.pop();
    if (s == null) throw new PatternError('E64: nothing to repeat');
    return s;
  };
  const quant = (q: string) => {
    const s = lastAtom();
    const atom = out.slice(s);
    out = out.slice(0, s) + (atom.length > 1 && !/^\\.$|^\[.*\]$|^\(.*\)$/s.test(atom) ? `(?:${atom})` : atom) + q;
    atLineStart = false;
  };

  // Does the character at position i act as a special in the current magic mode?
  // Returns [token, length] where token is the canonical backslash form ("\\(") or a literal char.
  // Read the next token. Returns [token, isSpecial, length]; special tokens use
  // their backslash spelling ("\\(") whatever the magic level.
  const next = (): [string, boolean, number] => {
    const ch = pattern[i];
    const multi = (at: number, lead: string): [string, boolean, number] => {
      // lead is "\\%", "\\@", "\\_" or "\\z"; take one more char
      return [lead + (pattern[at] ?? ''), true, at + 1 - i];
    };
    if (ch === '\\' && i + 1 < n) {
      const c2 = pattern[i + 1];
      if (magic === 'v' && /[<>(){}|=+?@%&]/.test(c2)) return [c2, false, 2];
      if (c2 === '%' || c2 === '@' || c2 === '_' || c2 === 'z') return multi(i + 2, '\\' + c2);
      if ((magic === 'M' || magic === 'V') && '.*[~'.includes(c2)) return [c2, true, 2];
      if (magic === 'V' && (c2 === '^' || c2 === '$')) return [c2, true, 2];
      return ['\\' + c2, true, 2];
    }
    if (magic === 'v') {
      if (ch === '%' || ch === '@') return multi(i + 1, '\\' + ch);
      if ('(){}|=+?<>'.includes(ch)) return ['\\' + ch, true, 1];
      return [ch, '^$.*[~'.includes(ch), 1];
    }
    if (magic === 'm') return [ch, '^$.*[~'.includes(ch), 1];
    if (magic === 'M') return [ch, '^$'.includes(ch), 1];
    return [ch, (ch === '^' && atLineStart && out === '') || (ch === '$' && i === n - 1), 1];
  };

  while (i < n) {
    const [tok, special, len] = next();
    i += len;
    if (!special) {
      lit(tok.length === 2 && tok[0] === '\\' ? tok[1] : tok);
      continue;
    }
    switch (tok) {
      case '\\v': magic = 'v'; continue;
      case '\\m': magic = 'm'; continue;
      case '\\M': magic = 'M'; continue;
      case '\\V': magic = 'V'; continue;
      case '\\c': caseFlag = 'i'; continue;
      case '\\C': caseFlag = 'c'; continue;
      case '^':
        if (atLineStart) { out += '^'; } else lit('^');
        continue;
      case '$': {
        const rest = pattern.slice(i);
        if (rest === '' || /^\\[|)]/.test(rest) || (magic === 'v' && /^[|)]/.test(rest))) out += '$';
        else lit('$');
        continue;
      }
      case '.': pushAtom('.'); continue;
      case '~': lit('~'); continue;
      case '*': quant('*'); continue;
      case '\\+': quant('+'); continue;
      case '\\=': case '\\?': quant('?'); continue;
      case '\\{': {
        const close = pattern.indexOf(magic === 'v' ? '}' : '}', i);
        if (close < 0) throw new PatternError('E554: Syntax error in \\{...}');
        let body = pattern.slice(i, close);
        if (body.endsWith('\\')) body = body.slice(0, -1);
        i = close + 1;
        const lazy = body.startsWith('-');
        if (lazy) body = body.slice(1);
        let q: string;
        if (body === '') q = '*';
        else if (/^\d+$/.test(body)) q = `{${body}}`;
        else if (/^\d*,\d*$/.test(body)) {
          const [a, b] = body.split(',');
          q = `{${a || '0'},${b}}`;
        } else throw new PatternError('E554: Syntax error in \\{...}');
        quant(q + (lazy ? '?' : ''));
        continue;
      }
      case '\\(':
        groupStack.push(out.length);
        out += '(';
        atLineStart = true;
        continue;
      case '\\%(':
        groupStack.push(out.length);
        out += '(?:';
        atLineStart = true;
        continue;
      case '\\)': {
        const s = groupStack.pop();
        if (s == null) throw new PatternError('E54: Unmatched \\)');
        out += ')';
        // A closed group is one atom starting at s: drop atoms recorded inside it.
        while (atomStarts.length && atomStarts[atomStarts.length - 1] >= s) atomStarts.pop();
        atomStarts.push(s);
        atLineStart = false;
        continue;
      }
      case '\\|':
        out += '|';
        atLineStart = true;
        continue;
      case '\\<': out += `(?<!${WORD})(?=${WORD})`; continue;
      case '\\>': out += `(?<=${WORD})(?!${WORD})`; continue;
      case '\\zs': zs = out.length; continue;
      case '\\ze': ze = out.length; continue;
      case '\\n': pushAtom('\\n'); continue;
      case '\\t': pushAtom('\\t'); continue;
      case '\\e': pushAtom('\\x1b'); continue;
      case '\\r': pushAtom('\\r'); continue;
      case '\\_.': pushAtom('[^]'); continue;
      case '\\_^': out += '^'; continue;
      case '\\_$': out += '$'; continue;
      case '\\&': lit('&'); continue;
      case '[': case '\\_[': {
        const r = collection(pattern, i, tok === '\\_[');
        if (!r) { lit('['); continue; }
        pushAtom(r.src);
        i = r.end;
        continue;
      }
      case '\\@=': case '\\@!': case '\\@<': {
        let op = tok.slice(2);
        if (op === '<') {
          // \@<= and \@<! have one more char
          op += pattern[i] ?? '';
          i++;
        }
        const s = lastAtom();
        const atom = out.slice(s);
        const js = { '=': '?=', '!': '?!', '<=': '?<=', '<!': '?<!' }[op];
        if (!js) throw new PatternError('E869: Unknown operator after \\@');
        out = out.slice(0, s) + `(${js}${atom})`;
        continue;
      }
    }
    if (tok.length === 2 && tok[0] === '\\') {
      const c = tok[1];
      if (/[1-9]/.test(c)) { pushAtom('\\' + c); continue; }
      if (CLASSES[c]) { pushAtom(CLASSES[c]); continue; }
      lit(c);
      continue;
    }
    if (tok.startsWith('\\_') && tok.length === 3) {
      const c = tok[2];
      if (CLASSES[c]) {
        const cls = CLASSES[c];
        pushAtom(cls.startsWith('[^') ? cls.replace('\\n]', ']') : cls.startsWith('[') ? '[\\n' + cls.slice(1) : `(?:${cls}|\\n)`);
        continue;
      }
    }
    if (tok.startsWith('\\%')) {
      // \%^ \%$ \%V etc. — support start/end of file.
      if (tok === '\\%^') { out += '(?<![^])'; continue; }
      if (tok === '\\%$') { out += '(?![^])'; continue; }
      throw new PatternError(`E71: Invalid character after \\%`);
    }
    if (tok.startsWith('\\z')) throw new PatternError('E68: Invalid character after \\z');
    lit(tok.replace(/^\\/, ''));
  }
  if (groupStack.length) throw new PatternError('E54: Unmatched \\(');

  let src = out;
  if (ze >= 0 && (zs < 0 || ze > zs)) src = src.slice(0, ze) + '(?=' + src.slice(ze) + ')';
  if (zs >= 0) src = '(?<=' + src.slice(0, zs) + ')' + src.slice(zs);

  let ignore = !!opts.ignorecase && !(opts.smartcase && hasUpperIn(pattern));
  if (caseFlag === 'i') ignore = true;
  if (caseFlag === 'c') ignore = false;
  try {
    return { re: new RegExp(src, 'gm' + (ignore ? 'i' : '')), source: pattern };
  } catch (e) {
    throw new PatternError('E486: Invalid pattern: ' + (e as Error).message);
  }
}

function hasUpperIn(p: string) {
  // Uppercase letters that aren't part of an escape such as \S or \U.
  return /[A-Z]/.test(p.replace(/\\./g, ''));
}

function collection(p: string, start: number, withNewline: boolean): { src: string; end: number } | null {
  let i = start;
  let body = '';
  let neg = false;
  if (p[i] === '^') { neg = true; i++; }
  if (p[i] === ']') { body += '\\]'; i++; }
  while (i < p.length && p[i] !== ']') {
    if (p[i] === '[' && p[i + 1] === ':') {
      const close = p.indexOf(':]', i + 2);
      if (close > 0) {
        const name = p.slice(i + 2, close);
        if (POSIX[name] != null) { body += POSIX[name]; i = close + 2; continue; }
      }
    }
    if (p[i] === '\\' && i + 1 < p.length) {
      const c = p[i + 1];
      if ('nte\\]^-'.includes(c) || c === 'r') {
        body += { n: '\\n', t: '\\t', e: '\\x1b', r: '\\r' }[c as 'n'] ?? '\\' + c;
        i += 2;
        continue;
      }
      if (c === 'd') { body += '0-9'; i += 2; continue; }
      body += '\\\\';
      i++;
      continue;
    }
    if (p[i] === '[' || p[i] === '/') { body += '\\' + p[i]; i++; continue; }
    body += p[i];
    i++;
  }
  if (i >= p.length) return null;
  if (withNewline) body += '\\n';
  const src = neg ? `[^${body}${withNewline ? '' : '\\n'}]` : `[${body}]`;
  return { src, end: i + 1 };
}

// ---------------------------------------------------------------------------
// Replacement strings

export type Replacer = (match: RegExpExecArray) => string;

/**
 * Build a replacement function for :s. `expr` evaluates \= expressions with
 * submatch() bound to the current match. `prev` is the previous replacement
 * string, used for ~.
 */
export function replacer(sub: string, prev: string, expr: (src: string, m: RegExpExecArray) => string): Replacer {
  if (sub.startsWith('\\=')) {
    const src = sub.slice(2);
    return m => expr(src, m);
  }
  return m => {
    let out = '';
    let oneShot: 'u' | 'l' | null = null;
    let mode: 'U' | 'L' | null = null;
    const emit = (s: string) => {
      for (const ch of s) {
        let c = ch;
        if (oneShot) {
          c = oneShot === 'u' ? c.toUpperCase() : c.toLowerCase();
          oneShot = null;
        } else if (mode) c = mode === 'U' ? c.toUpperCase() : c.toLowerCase();
        out += c;
      }
    };
    for (let i = 0; i < sub.length; i++) {
      const ch = sub[i];
      if (ch === '&') { emit(m[0]); continue; }
      if (ch === '~') { emit(prev); continue; }
      if (ch !== '\\' || i + 1 >= sub.length) { emit(ch); continue; }
      const c = sub[++i];
      if (/[0-9]/.test(c)) emit(m[+c] ?? '');
      else if (c === 'u' || c === 'l') oneShot = c;
      else if (c === 'U' || c === 'L') mode = c;
      else if (c === 'E' || c === 'e') mode = null;
      else if (c === 'r') out += '\n';
      else if (c === 'n') out += '\0';
      else if (c === 't') out += '\t';
      else emit(c);
    }
    return out;
  };
}

/** Escape text so it matches literally in a Vim (magic) pattern. */
export function escapeVim(s: string) {
  return s.replace(/[\\/.*$^~[\]]/g, '\\$&');
}
