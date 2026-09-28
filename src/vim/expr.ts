// A small Vim-script expression evaluator for \= replacements, the
// expression register (<C-r>=) and :let. Numbers, strings, arithmetic,
// concatenation, comparisons, ?:, and a handful of builtin functions.

export type Value = number | string;

export type ExprEnv = {
  submatch?: (n: number) => string;
  line?: (arg: string) => number;
  col?: (arg: string) => number;
  getreg?: (name: string) => string;
};

export class ExprError extends Error {}

const toNum = (v: Value): number => {
  if (typeof v === 'number') return v;
  const m = /^\s*(-?)(0x[0-9a-f]+|\d+)/i.exec(v);
  if (!m) return 0;
  return (m[1] ? -1 : 1) * Number(m[2]);
};
const toStr = (v: Value): string => (typeof v === 'number' ? String(v) : v);

export function valueToString(v: Value) {
  return toStr(v);
}

export function evaluate(src: string, env: ExprEnv = {}): Value {
  let i = 0;
  const s = src;
  const ws = () => { while (i < s.length && /\s/.test(s[i])) i++; };
  const peek = (t: string) => { ws(); return s.startsWith(t, i); };
  const eat = (t: string) => { if (peek(t)) { i += t.length; return true; } return false; };
  const expect = (t: string) => { if (!eat(t)) throw new ExprError(`E15: Invalid expression: "${src}"`); };

  const FUNCS: Record<string, (a: Value[]) => Value> = {
    submatch: a => env.submatch?.(toNum(a[0])) ?? '',
    toupper: a => toStr(a[0]).toUpperCase(),
    tolower: a => toStr(a[0]).toLowerCase(),
    len: a => toStr(a[0]).length,
    strlen: a => toStr(a[0]).length,
    strchars: a => [...toStr(a[0])].length,
    str2nr: a => toNum(a[0]),
    string: a => (typeof a[0] === 'string' ? `'${a[0]}'` : String(a[0])),
    repeat: a => toStr(a[0]).repeat(Math.max(0, toNum(a[1]))),
    trim: a => toStr(a[0]).trim(),
    abs: a => Math.abs(toNum(a[0])),
    max: a => Math.max(...a.map(toNum)),
    min: a => Math.min(...a.map(toNum)),
    line: a => env.line?.(toStr(a[0])) ?? 0,
    col: a => env.col?.(toStr(a[0])) ?? 0,
    getreg: a => env.getreg?.(toStr(a[0] ?? '"')) ?? '',
    reverse: a => [...toStr(a[0])].reverse().join(''),
    printf: a => printf(toStr(a[0]), a.slice(1)),
    substitute: a => toStr(a[0]).replace(new RegExp(toStr(a[1]), toStr(a[3]).includes('g') ? 'g' : ''), toStr(a[2])),
  };

  const primary = (): Value => {
    ws();
    if (eat('(')) { const v = ternary(); expect(')'); return v; }
    if (eat('-')) return -toNum(primary());
    if (eat('+')) return toNum(primary());
    if (eat('!')) return toNum(primary()) ? 0 : 1;
    const ch = s[i];
    if (ch === '"') {
      let out = '';
      i++;
      while (i < s.length && s[i] !== '"') {
        if (s[i] === '\\' && i + 1 < s.length) {
          const c = s[++i];
          out += { n: '\n', t: '\t', '\\': '\\', '"': '"', r: '\r', e: '\x1b' }[c] ?? c;
        } else out += s[i];
        i++;
      }
      expect('"');
      return out;
    }
    if (ch === "'") {
      let out = '';
      i++;
      while (i < s.length) {
        if (s[i] === "'" && s[i + 1] === "'") { out += "'"; i += 2; continue; }
        if (s[i] === "'") break;
        out += s[i++];
      }
      expect("'");
      return out;
    }
    const num = /^(0x[0-9a-fA-F]+|\d+(\.\d+)?)/.exec(s.slice(i));
    if (num) { i += num[0].length; return Number(num[0]); }
    if (ch === '@') {
      i++;
      const r = s[i++] ?? '"';
      return env.getreg?.(r) ?? '';
    }
    const id = /^[A-Za-z_][\w#:]*/.exec(s.slice(i));
    if (id) {
      i += id[0].length;
      const name = id[0];
      if (eat('(')) {
        const args: Value[] = [];
        if (!eat(')')) {
          do args.push(ternary()); while (eat(','));
          expect(')');
        }
        const f = FUNCS[name];
        if (!f) throw new ExprError(`E117: Unknown function: ${name}`);
        return f(args);
      }
      if (name === 'v:true') return 1;
      if (name === 'v:false') return 0;
      throw new ExprError(`E121: Undefined variable: ${name}`);
    }
    throw new ExprError(`E15: Invalid expression: "${src}"`);
  };
  const mul = (): Value => {
    let v = primary();
    for (;;) {
      if (eat('*')) v = toNum(v) * toNum(primary());
      else if (peek('//')) break;
      else if (eat('/')) { const d = toNum(primary()); v = d === 0 ? 0 : Math.trunc(toNum(v) / d); }
      else if (eat('%')) { const d = toNum(primary()); v = d === 0 ? 0 : toNum(v) % d; }
      else return v;
    }
    return v;
  };
  const add = (): Value => {
    let v = mul();
    for (;;) {
      if (eat('..')) v = toStr(v) + toStr(mul());
      else if (peek('.') && !/\d/.test(s[i + 1] ?? '')) { i++; v = toStr(v) + toStr(mul()); }
      else if (eat('+')) v = toNum(v) + toNum(mul());
      else if (eat('-')) v = toNum(v) - toNum(mul());
      else return v;
    }
  };
  const cmp = (): Value => {
    const a = add();
    for (const op of ['==', '!=', '>=', '<=', '>', '<']) {
      if (eat(op)) {
        const b = add();
        const both = typeof a === 'string' && typeof b === 'string';
        const x = both ? a : toNum(a), y = both ? b : toNum(b);
        const r = op === '==' ? x === y : op === '!=' ? x !== y : op === '>=' ? x >= y : op === '<=' ? x <= y : op === '>' ? x > y : x < y;
        return r ? 1 : 0;
      }
    }
    return a;
  };
  const and = (): Value => { let v = cmp(); while (eat('&&')) v = toNum(v) && toNum(cmp()) ? 1 : 0; return v; };
  const or = (): Value => { let v = and(); while (eat('||')) v = toNum(v) || toNum(and()) ? 1 : 0; return v; };
  const ternary = (): Value => {
    const c = or();
    if (eat('?')) {
      const a = ternary();
      expect(':');
      const b = ternary();
      return toNum(c) ? a : b;
    }
    return c;
  };

  const v = ternary();
  ws();
  if (i < s.length) throw new ExprError(`E15: Invalid expression: "${src}"`);
  return v;
}

function printf(fmt: string, args: Value[]): string {
  let k = 0;
  return fmt.replace(/%([-0 +]*)(\d*)(?:\.(\d+))?([dsxXof%])/g, (_, flags: string, width: string, prec: string, conv: string) => {
    if (conv === '%') return '%';
    const a = args[k++] ?? '';
    let out: string;
    if (conv === 'd') out = String(Math.trunc(toNum(a)));
    else if (conv === 'x') out = toNum(a).toString(16);
    else if (conv === 'X') out = toNum(a).toString(16).toUpperCase();
    else if (conv === 'o') out = toNum(a).toString(8);
    else if (conv === 'f') out = toNum(a).toFixed(prec ? +prec : 6);
    else out = toStr(a);
    const w = +width || 0;
    if (out.length < w) {
      if (flags.includes('-')) out = out.padEnd(w);
      else if (flags.includes('0') && conv !== 's') out = out.startsWith('-') ? '-' + out.slice(1).padStart(w - 1, '0') : out.padStart(w, '0');
      else out = out.padStart(w);
    }
    return out;
  });
}
