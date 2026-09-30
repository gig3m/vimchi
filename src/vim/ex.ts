// Ex commands: range parsing and the built-in command set.

import { Buffer } from './buffer';
import { type ExArgs, type Vim, lineStarts, offsetToPos, registerToKeys, showRegister, REG_KIND_LABEL } from './editor';
import { OPTION_ALIASES, type Pos, VimError, fail, pos } from './types';
import { type Compiled, replacer } from './regex';
import { firstNonBlank, indentOf } from './text';
import { shellFilter } from './transforms';
import { basename } from './fs';
import type { QfItem } from './layout';
import { parseKeys } from './keys';

type Cmd = { min: number; run: (vim: Vim, a: ExArgs) => void; bar?: boolean; defaultAll?: boolean };

// ---- ranges -----------------------------------------------------------------------------

function parseAddress(vim: Vim, s: string, i: number, base: number): { line: number; i: number } | null {
  let line: number | null = null;
  const ch = s[i];
  if (ch === '.') { line = base; i++; }
  else if (ch === '$') { line = vim.buf.lineCount - 1; i++; }
  else if (/\d/.test(ch ?? '')) {
    const m = /^\d+/.exec(s.slice(i))!;
    line = parseInt(m[0], 10) - 1;
    i += m[0].length;
  } else if (ch === "'") {
    const mk = s[i + 1];
    const p = mk === '<' || mk === '>' || /[a-z[\]]/.test(mk ?? '') ? vim.buf.marks.get(mk) : /[A-Z]/.test(mk ?? '') ? vim.globalMarks.get(mk)?.pos : null;
    if (!p) fail('E20: Mark not set');
    line = p.line;
    i += 2;
  } else if (ch === '/' || ch === '?') {
    let j = i + 1;
    while (j < s.length && s[j] !== ch) { if (s[j] === '\\') j++; j++; }
    const pat = s.slice(i + 1, j) || vim.search.pattern;
    i = j < s.length ? j + 1 : j;
    const dir = ch === '/' ? 1 : -1;
    const m = vim.findMatch(pat, pos(dir === 1 ? base : base, dir === 1 ? Number.MAX_SAFE_INTEGER : 0), dir as 1 | -1, true);
    if (!m) fail(`E486: Pattern not found: ${pat}`);
    vim.search = { pattern: pat, dir: dir as 1 | -1, offset: '' };
    line = m.start.line;
  } else if (ch === '\\' && (s[i + 1] === '/' || s[i + 1] === '?')) {
    const m = vim.findMatch(vim.search.pattern, pos(base, s[i + 1] === '/' ? Number.MAX_SAFE_INTEGER : 0), s[i + 1] === '/' ? 1 : -1, true);
    if (!m) fail('E486: Pattern not found');
    line = m.start.line;
    i += 2;
  }
  // Offsets: +N -N (repeated), bare + means +1.
  let sawOffset = false;
  for (;;) {
    const m = /^\s*([+-])(\d*)/.exec(s.slice(i));
    if (!m) break;
    sawOffset = true;
    if (line == null) line = base;
    const n = m[2] === '' ? 1 : parseInt(m[2], 10);
    line += m[1] === '+' ? n : -n;
    i += m[0].length;
  }
  if (line == null && !sawOffset) return null;
  return { line: line!, i };
}

function parseRange(vim: Vim, s: string): { range: { start: number; end: number } | null; addrCount: number; rest: string } {
  let i = 0;
  while (s[i] === ':' || s[i] === ' ') i++;
  if (s[i] === '%') {
    i++;
    return { range: { start: 0, end: vim.buf.lineCount - 1 }, addrCount: 2, rest: s.slice(i) };
  }
  if (s[i] === '*') {
    i++;
    const a = vim.buf.marks.get('<'), b = vim.buf.marks.get('>');
    if (!a || !b) fail('E20: Mark not set');
    return { range: { start: a.line, end: b.line }, addrCount: 2, rest: s.slice(i) };
  }
  const addrs: number[] = [];
  let base = vim.cursor.line;
  for (;;) {
    const a = parseAddress(vim, s, i, base);
    if (a) {
      addrs.push(a.line);
      i = a.i;
    }
    while (s[i] === ' ') i++;
    if (s[i] === ',' || s[i] === ';') {
      if (!a) addrs.push(base);
      if (s[i] === ';') base = addrs[addrs.length - 1];
      i++;
      continue;
    }
    break;
  }
  if (!addrs.length) return { range: null, addrCount: 0, rest: s.slice(i) };
  const start = addrs.length === 1 ? addrs[0] : addrs[addrs.length - 2];
  const end = addrs[addrs.length - 1];
  return { range: { start, end }, addrCount: Math.min(2, addrs.length), rest: s.slice(i) };
}

// ---- dispatch ---------------------------------------------------------------------------------

export function runEx(vim: Vim, input: string) {
  const text = input.replace(/^[\s:]+/, '');
  if (!text) return;
  vim.lastEx = text;
  const { range, addrCount, rest } = parseRange(vim, text);
  const m = /^\s*([A-Za-z]+|[&~<>!=#@*]|[<>]+)(!?)\s*/.exec(rest);
  if (!m) {
    if (range) {
      // :42 jumps to a line.
      vim.pushJump();
      const l = Math.max(0, Math.min(range.end, vim.buf.lineCount - 1));
      // 'startofline' off (Neovim's default) keeps the column, like G.
      if (vim.options.startofline) vim.setCursor(pos(l, firstNonBlank(vim.line(l))));
      else { vim.setCursor(pos(l, Math.min(vim.win.want, Math.max(0, vim.line(l).length - 1)))); vim.win.want = Math.max(vim.win.want, vim.cursor.col); }
      vim.openFoldsAt(l);
      return;
    }
    if (rest.trim().startsWith('|')) return runEx(vim, rest.trim().slice(1));
    fail(`E492: Not an editor command: ${text}`);
  }
  let name = m[1];
  const bang = m[2] === '!';
  let argStr = rest.slice(m[0].length);
  // :s/x/y/ where the command name runs into the pattern (:s#a#b#) handled by the regex above.
  // ">>>" style
  if (/^[<>]+$/.test(name)) {
    argStr = name.slice(1) + argStr;
    name = name[0];
  }
  const cmd = lookup(vim, name);
  if (!cmd) fail(`E492: Not an editor command: ${text}`);
  // Split on | for commands that don't take it as part of their argument.
  let tail = '';
  if (!cmd.bar) {
    // :s/pat/rep/ may contain | (\v alternation); only look for a bar after the replacement.
    const bar = findBar(argStr, cmd === COMMANDS.substitute ? subArgsEnd(argStr) : 0);
    if (bar >= 0) {
      tail = argStr.slice(bar + 1);
      argStr = argStr.slice(0, bar);
    }
  }
  let reg: string | null = null;
  let count: number | null = null;
  // :normal (and :g/:v, which may run it) keep trailing spaces (":norm I- " inserts "- ").
  const keepTrailing = cmd.run === normalCmd || cmd === COMMANDS.global || cmd === COMMANDS.vglobal;
  const args: ExArgs = { range, addrCount, bang, arg: keepTrailing ? argStr.replace(/^\s+/, '') : argStr.trim(), name, count, reg };
  if (range && (range.start < 0 || range.end >= vim.buf.lineCount + (name === 'm' || name === 't' ? 1 : 0))) {
    if (!(range.start === -1 && (name === 'pu' || name === 'put' || name === 'r' || name === 'read'))) fail('E16: Invalid range');
  }
  if (range && range.start > range.end) {
    args.range = { start: range.end, end: range.start };
  }
  void reg; void count;
  cmd.run(vim, args);
  if (tail.trim()) runEx(vim, tail);
}

function subArgsEnd(s: string) {
  const delim = s[0];
  if (!delim || /[\w\s\\"|]/.test(delim)) return 0;
  let seen = 0, i = 1;
  for (; i < s.length && seen < 2; i++) {
    if (s[i] === '\\') i++;
    else if (s[i] === delim) seen++;
  }
  return i;
}

function findBar(s: string, from = 0) {
  let inQuote = false;
  for (let i = from; i < s.length; i++) {
    if (s[i] === '\\') { i++; continue; }
    if (s[i] === '"') inQuote = !inQuote;
    if (s[i] === '|' && !inQuote) return i;
  }
  return -1;
}

function lookup(vim: Vim, name: string): Cmd | null {
  // Plugin commands first (exact or abbreviation).
  for (const [full, c] of vim.exCommands) {
    if (name === full || (name.length >= c.min && full.startsWith(name))) return { min: c.min, run: (_v, a) => c.run(a), bar: true };
  }
  for (const [full, c] of Object.entries(COMMANDS)) {
    if (name === full || (name.length >= c.min && full.startsWith(name) && !/[A-Z]/.test(full))) return c;
  }
  return null;
}

// ---- helpers ---------------------------------------------------------------------------------------

const lineRange = (vim: Vim, a: ExArgs, def: 'cur' | 'all' = 'cur') =>
  a.range ?? (def === 'all' ? { start: 0, end: vim.buf.lineCount - 1 } : { start: vim.cursor.line, end: vim.cursor.line });

/** Parse "[x] [count]" arguments of :d, :y. */
function regAndCount(a: ExArgs): { reg: string | null; count: number | null } {
  const m = /^([a-zA-Z"_+*-])?\s*(\d+)?$/.exec(a.arg);
  if (!m) fail('E488: Trailing characters');
  return { reg: m[1] ?? null, count: m[2] ? +m[2] : null };
}

function withCount(vim: Vim, a: ExArgs, count: number | null) {
  const r = lineRange(vim, a);
  if (count == null) return r;
  const start = r.end;
  return { start, end: Math.min(vim.buf.lineCount - 1, start + count - 1) };
}

function report(vim: Vim, n: number, what: string) {
  if (n > 2) vim.msg(`${n} ${what}`);
}

function parseAddrArg(vim: Vim, s: string): number {
  const t = s.trim();
  if (t === '0') return -1;
  const r = parseRange(vim, t);
  if (!r.range) fail('E14: Invalid address');
  return r.range.end;
}

// ---- :substitute ---------------------------------------------------------------------------------

function parseSub(s: string): { pattern: string; replacement: string; flags: string; count: number | null } | null {
  const delim = s[0];
  if (!delim || /[\w\s\\"|]/.test(delim)) return null;
  const parts: string[] = [];
  let cur = '', i = 1;
  for (; i < s.length && parts.length < 2; i++) {
    if (s[i] === '\\' && i + 1 < s.length) {
      cur += s[i + 1] === delim ? delim : s[i] + s[i + 1];
      i++;
    } else if (s[i] === delim) {
      parts.push(cur);
      cur = '';
    } else cur += s[i];
  }
  if (parts.length === 0) return { pattern: cur, replacement: '', flags: '', count: null };
  if (parts.length === 1) return { pattern: parts[0], replacement: cur, flags: '', count: null };
  const tail = s.slice(i).trim();
  const m = /^([&cegiInpr#lr]*)\s*(\d*)$/.exec(tail);
  if (!m) fail('E488: Trailing characters');
  return { pattern: parts[0], replacement: parts[1], flags: m[1], count: m[2] ? +m[2] : null };
}

function substitute(vim: Vim, a: ExArgs, mode: 's' | '&' | '~' = 's') {
  let pattern: string, replacement: string, flags: string, count: number | null = null;
  const parsed = mode === 's' ? parseSub(a.arg) : null;
  if (parsed) {
    ({ pattern, replacement, flags, count } = parsed);
    if (flags.startsWith('&')) flags = (vim.lastSub?.flags ?? '') + flags.slice(1);
  } else {
    // :s with no pattern (or :&) repeats the last substitute; :&& keeps flags.
    if (!vim.lastSub) fail('E35: No previous regular expression');
    pattern = mode === '~' ? vim.search.pattern : vim.lastSub.pattern;
    replacement = vim.lastSub.replacement;
    const m = /^(&?)([cegiInpr#l]*)\s*(\d*)$/.exec(a.arg);
    if (!m) fail('E488: Trailing characters');
    flags = (m[1] ? vim.lastSub.flags : '') + m[2];
    count = m[3] ? +m[3] : null;
  }
  if (pattern === '') pattern = vim.search.pattern;
  if (!pattern) fail('E35: No previous regular expression');
  if (replacement === '~') replacement = vim.lastSub?.replacement ?? '';
  const prevRep = vim.lastSub?.replacement ?? '';
  vim.lastSub = { pattern, replacement, flags: flags.replace(/[&]/g, '') };
  vim.search = { pattern, dir: 1, offset: '' };
  vim.history['/'].push(pattern);
  vim.hlActive = true;

  let range = lineRange(vim, a);
  if (count != null) range = { start: range.end, end: Math.min(vim.buf.lineCount - 1, range.end + count - 1) };
  const global = flags.includes('g');
  const confirm = flags.includes('c');
  const onlyCount = flags.includes('n');
  const noErr = flags.includes('e');
  const ic = flags.includes('i') ? true : flags.includes('I') ? false : undefined;

  let compiled: Compiled;
  const save = { ...vim.options };
  if (ic !== undefined) { vim.options.ignorecase = ic; vim.options.smartcase = false; }
  try {
    compiled = vim.compilePattern(pattern);
  } finally {
    vim.options.ignorecase = save.ignorecase;
    vim.options.smartcase = save.smartcase;
  }
  let curLine = range.start; // line('.') inside \= is the line being substituted
  const rep = replacer(replacement, prevRep, (src, m) => vim.evalExpr(src, { submatch: n => m[n] ?? '', line: a => (a === '.' ? curLine + 1 : a === '$' ? vim.buf.lineCount : 0) }));
  const re = compiled.re;
  const multiline = /\\n|\\_/.test(pattern);

  if (confirm) return confirmSubstitute(vim, re, rep, range, global);

  vim.beginChange();
  let subs = 0;
  const changedLines = new Set<number>();
  let lastLine = -1;

  if (multiline) {
    const B = vim.buf;
    // Every line ends in a newline, including the last one, as in Vim.
    const text = B.text() + '\n';
    const starts = lineStarts(B.lines);
    const rangeStart = starts[range.start];
    const rangeEnd = range.end + 1 < starts.length ? starts[range.end + 1] : text.length + 1;
    re.lastIndex = rangeStart;
    let out = text.slice(0, rangeStart);
    let last = rangeStart;
    const doneLines = new Set<number>();
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) && m.index < rangeEnd) {
      const l = offsetToPos(starts, m.index).line;
      curLine = l;
      if (!global && doneLines.has(l)) { if (!m[0].length) re.lastIndex++; continue; }
      doneLines.add(l);
      out += text.slice(last, m.index) + (onlyCount ? m[0] : rep(m));
      last = m.index + m[0].length;
      subs++;
      changedLines.add(l);
      lastLine = l;
      if (!m[0].length) re.lastIndex++;
    }
    out += text.slice(last);
    if (out.endsWith('\n')) out = out.slice(0, -1);
    if (!onlyCount && subs) {
      const newLines = out.split('\n');
      B.splice(0, B.lineCount, newLines.map(x => x.replace(/\0/g, '\0')));
    }
  } else {
    const B = vim.buf;
    let l = range.start;
    let end = range.end;
    while (l <= end) {
      const t = B.line(l);
      curLine = l;
      re.lastIndex = 0;
      let out = '', last = 0, any = false;
      let m: RegExpExecArray | null;
      while ((m = re.exec(t))) {
        out += t.slice(last, m.index) + (onlyCount ? m[0] : rep(m));
        last = m.index + m[0].length;
        any = true;
        subs++;
        if (!global) break;
        if (!m[0].length) {
          if (re.lastIndex >= t.length) break;
          out += t[re.lastIndex];
          last = ++re.lastIndex;
        }
      }
      if (any) {
        changedLines.add(l);
        lastLine = l;
        if (!onlyCount) {
          const newText = out + t.slice(last);
          const parts = newText.split('\n');
          B.splice(l, 1, parts);
          l += parts.length - 1;
          end += parts.length - 1;
          lastLine = l;
        }
      }
      l++;
    }
  }
  if (!subs) {
    if (!noErr) fail(`E486: Pattern not found: ${pattern}`);
    return;
  }
  if (onlyCount) {
    vim.msg(`${subs} match${subs === 1 ? '' : 'es'} on ${changedLines.size} line${changedLines.size === 1 ? '' : 's'}`);
    return;
  }
  vim.buf.recordChange(pos(lastLine, 0));
  vim.setCursor(pos(lastLine, firstNonBlank(vim.line(lastLine))));
  if (subs > 2 || changedLines.size > 2) vim.msg(`${subs} substitution${subs === 1 ? '' : 's'} on ${changedLines.size} line${changedLines.size === 1 ? '' : 's'}`);
  vim.emit('substitute');
}

function confirmSubstitute(vim: Vim, re: RegExp, rep: (m: RegExpExecArray) => string, range: { start: number; end: number }, global: boolean) {
  vim.beginChange();
  let line = range.start, col = 0, end = range.end, subs = 0;
  const next = (): { m: RegExpExecArray; line: number } | null => {
    while (line <= end) {
      re.lastIndex = col;
      const m = re.exec(vim.line(line));
      if (m && (global || col === 0 || !(vim as unknown as { _subLine?: number })._subLine || true)) {
        if (m) return { m, line };
      }
      line++;
      col = 0;
    }
    return null;
  };
  let cur = next();
  if (!cur) fail(`E486: Pattern not found: ${vim.lastSub?.pattern}`);
  const show = () => {
    const c = cur!;
    vim.incsearchPos = { start: pos(c.line, c.m.index), end: pos(c.line, c.m.index + Math.max(0, c.m[0].length - 1)) };
    vim.setCursor(pos(c.line, c.m.index));
    vim.confirm!.prompt = `replace with ${vim.lastSub?.replacement} (y/n/a/q/l/^E/^Y)?`;
  };
  const doReplace = () => {
    const c = cur!;
    const t = vim.line(c.line);
    const r = rep(c.m);
    const newText = t.slice(0, c.m.index) + r + t.slice(c.m.index + c.m[0].length);
    const parts = newText.split('\n');
    vim.buf.splice(c.line, 1, parts);
    end += parts.length - 1;
    subs++;
    if (global) {
      line = c.line + parts.length - 1;
      col = (parts.length > 1 ? parts[parts.length - 1].length - (t.length - c.m.index - c.m[0].length) : c.m.index + r.length) + (c.m[0].length ? 0 : 1);
    } else {
      line = c.line + parts.length;
      col = 0;
    }
  };
  const skip = () => {
    const c = cur!;
    if (global) {
      line = c.line;
      col = c.m.index + Math.max(1, c.m[0].length);
    } else {
      line = c.line + 1;
      col = 0;
    }
  };
  const finish = () => {
    vim.confirm = null;
    vim.incsearchPos = null;
    vim.mode = 'normal';
    if (subs) vim.msg(`${subs} substitution${subs === 1 ? '' : 's'}`);
    vim.emit('substitute');
  };
  vim.mode = 'confirm';
  vim.confirm = {
    prompt: '',
    onKey: k => {
      if (k === 'y' || k === 'l') {
        doReplace();
        if (k === 'l') return finish();
      } else if (k === 'n') skip();
      else if (k === 'a') {
        doReplace();
        while ((cur = next())) doReplace();
        return finish();
      } else if (k === 'q' || k === '<Esc>' || k === '<C-c>') return finish();
      else return;
      cur = next();
      if (!cur) return finish();
      show();
    },
  };
  show();
}

// ---- :global --------------------------------------------------------------------------------

function globalCmd(vim: Vim, a: ExArgs, invert: boolean) {
  const s = a.arg;
  const delim = s[0];
  if (!delim) fail('E35: No previous regular expression');
  let i = 1, pat = '';
  for (; i < s.length && s[i] !== delim; i++) {
    if (s[i] === '\\' && s[i + 1] === delim) { pat += delim; i++; } else if (s[i] === '\\') { pat += s[i] + (s[i + 1] ?? ''); i++; } else pat += s[i];
  }
  const cmd = s.slice(i + 1).replace(/^\s+/, '') || 'p';
  if (!pat) pat = vim.search.pattern;
  const re = vim.compilePattern(pat).re;
  vim.search = { pattern: pat, dir: 1, offset: '' };
  const range = a.range ?? { start: 0, end: vim.buf.lineCount - 1 };
  const B = vim.buf;
  const tokens: string[] = [];
  for (let l = range.start; l <= range.end; l++) {
    re.lastIndex = 0;
    const hit = re.test(B.line(l));
    if (hit !== (invert || a.bang)) {
      const k = `\u0001g${l}`;
      B.marks.set(k, pos(l, 0));
      tokens.push(k);
    }
  }
  if (!tokens.length) {
    vim.msg(`Pattern ${invert ? 'found in every line' : 'not found'}: ${pat}`);
    return;
  }
  vim.beginChange();
  const printed: string[] = [];
  for (const k of tokens) {
    const p = B.marks.get(k);
    if (!p) continue;
    B.marks.delete(k);
    vim.win.cursor = pos(p.line, 0);
    if (cmd === 'p' || cmd === 'print' || cmd === '#' || cmd === 'nu' || cmd === 'number') {
      printed.push((cmd === 'p' || cmd === 'print' ? '' : String(p.line + 1).padStart(3) + ' ') + B.line(p.line));
      continue;
    }
    try {
      runEx(vim, cmd);
    } catch (e) {
      if (!(e instanceof VimError)) throw e;
      for (const t of tokens) B.marks.delete(t);
      throw e;
    }
  }
  for (const t of tokens) B.marks.delete(t);
  if (printed.length) vim.msg(printed.join('\n'), 'more');
  vim.emit('global');
}

// ---- :normal ------------------------------------------------------------------------------------

function normalCmd(vim: Vim, a: ExArgs) {
  const keys = parseKeys(a.arg.replace(/^\s/, ''));
  if (!keys.length) return;
  const lines = a.range ? { start: a.range.start, end: a.range.end } : null;
  vim.beginChange();
  const runOnce = () => {
    vim.runKeys(keys, { catchErrors: true });
    // An incomplete command is ended as if <Esc> were typed.
    if (vim.mode === 'insert' || vim.mode === 'replace') vim.leaveInsert();
    if (vim.mode === 'cmdline') { vim.cmdline = null; vim.mode = vim.visual ? 'visual' : 'normal'; }
    if (vim.visual) vim.exitVisual();
    vim.pending = [];
  };
  if (!lines) return runOnce();
  const B = vim.buf;
  const tokens: string[] = [];
  for (let l = lines.start; l <= lines.end; l++) {
    const k = `\u0001n${l}`;
    B.marks.set(k, pos(l, 0));
    tokens.push(k);
  }
  for (const k of tokens) {
    const p = B.marks.get(k);
    if (!p) continue;
    vim.win.cursor = pos(p.line, 0);
    runOnce();
  }
  for (const t of tokens) B.marks.delete(t);
}

// ---- quickfix ------------------------------------------------------------------------------------

function globToRe(glob: string): RegExp {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    if (ch === '*' && glob[i + 1] === '*') {
      re += '.*';
      i++;
      if (glob[i + 1] === '/') i++;
    } else if (ch === '*') re += '[^/]*';
    else if (ch === '?') re += '[^/]';
    else re += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp('^' + re + '$');
}

function expandFiles(vim: Vim, args: string): string[] {
  const out: string[] = [];
  for (const g of args.split(/\s+/).filter(Boolean)) {
    if (g === '%') { out.push(vim.buf.name); continue; }
    if (g === '##') { out.push(...vim.args); continue; }
    const re = globToRe(g.replace(/^\.\//, ''));
    const hits = vim.fs.list().filter(p => re.test(p));
    out.push(...(hits.length ? hits : vim.fs.read(g) != null ? [g] : []));
  }
  return [...new Set(out)];
}

function fileLines(vim: Vim, name: string): readonly string[] {
  const b = vim.findBuffer(name);
  if (b) return b.lines;
  return (vim.fs.read(name) ?? '').split('\n');
}

function grep(vim: Vim, a: ExArgs, loc: boolean, vimRegex: boolean) {
  let pat: string, rest: string, global = true;
  if (vimRegex) {
    const d = a.arg[0];
    if (!d || /\w/.test(d)) {
      const sp = a.arg.indexOf(' ');
      pat = a.arg.slice(0, sp < 0 ? undefined : sp);
      rest = sp < 0 ? '' : a.arg.slice(sp + 1);
    } else {
      const end = a.arg.indexOf(d, 1);
      pat = a.arg.slice(1, end < 0 ? undefined : end);
      const tail = end < 0 ? '' : a.arg.slice(end + 1);
      const m = /^([gj]*)\s*(.*)$/.exec(tail)!;
      global = m[1].includes('g');
      rest = m[2];
    }
  } else {
    const m = /^(?:"([^"]*)"|'([^']*)'|(\S+))\s*(.*)$/.exec(a.arg);
    if (!m) fail('E683: File name missing or invalid pattern');
    pat = m[1] ?? m[2] ?? m[3];
    rest = m[4] || '**/*';
  }
  if (!pat) pat = vim.search.pattern;
  const files = expandFiles(vim, rest || '**/*');
  if (!files.length) fail('E479: No match');
  const items: QfItem[] = [];
  const re = vimRegex ? vim.compilePattern(pat).re : new RegExp(pat, 'g');
  for (const f of files) {
    fileLines(vim, f).forEach((t, l) => {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(t))) {
        items.push({ file: f, line: l, col: m.index, text: t.trim() });
        if (!global || !vimRegex) break;
        if (!m[0].length) re.lastIndex++;
      }
    });
  }
  if (!items.length) fail(`E480: No match: ${pat}`);
  const list = { items, idx: 0, title: `:${a.name} ${a.arg}` };
  if (loc) vim.win.loclist = list;
  else vim.quickfix = list;
  vim.msg(`(1 of ${items.length}): ${items[0].text}`);
  jumpQf(vim, loc, 0);
  vim.emit('quickfix');
}

function qfList(vim: Vim, loc: boolean) {
  const l = loc ? vim.win.loclist : vim.quickfix;
  if (!l || !l.items.length) fail(loc ? 'E776: No location list' : 'E42: No Errors');
  return l;
}

export function jumpQf(vim: Vim, loc: boolean, idx: number) {
  const list = qfList(vim, loc);
  if (idx < 0 || idx >= list.items.length) fail('E553: No more items');
  list.idx = idx;
  const it = list.items[idx];
  // Jump in a normal window, not the quickfix window itself.
  if (vim.buf.kind === 'quickfix') {
    const prev = vim.tab.prev && vim.tab.prev.buf.kind !== 'quickfix' && vim.tab.windows().includes(vim.tab.prev) ? vim.tab.prev : null;
    const other = prev ?? vim.tab.windows().find(w => w.buf.kind !== 'quickfix');
    if (other) vim.focusWindow(other);
  }
  if (vim.buf.name !== it.file) {
    vim.pushJump();
    vim.edit(it.file);
  } else vim.pushJump();
  vim.setCursor(pos(Math.min(it.line, vim.buf.lineCount - 1), it.col));
  vim.openFoldsAt(it.line);
  vim.msg(`(${idx + 1} of ${list.items.length}): ${it.text}`);
  refreshQfWindow(vim);
}

export function refreshQfWindow(vim: Vim) {
  for (const b of vim.buffers) {
    if (b.kind !== 'quickfix') continue;
    const loc = !!b.data.loc;
    const list = loc ? vim.tab.windows().find(w => w.loclist)?.loclist : vim.quickfix;
    if (!list) continue;
    b.lines = list.items.length ? list.items.map(it => `${it.file}|${it.line + 1} col ${it.col + 1}| ${it.text}`) : [''];
    b.data.idx = list.idx;
  }
}

function openQf(vim: Vim, loc: boolean) {
  const list = qfList(vim, loc);
  let win = vim.tab.windows().find(w => w.buf.kind === 'quickfix' && !!w.buf.data.loc === loc);
  if (!win) {
    const buf = new Buffer(loc ? '[Location List]' : '[Quickfix List]', '', { kind: 'quickfix', filetype: 'qf' });
    buf.listed = false;
    buf.readonly = true;
    buf.data.loc = loc;
    vim.addBuffer(buf);
    // <CR> jumps to the entry under the cursor.
    vim.mapLocal(buf, ['n'], '<CR>', () => jumpQf(vim, loc, vim.cursor.line));
    // Quickfix opens at the bottom, full width.
    const prev = vim.win;
    win = vim.splitWindow('col', buf);
    if (loc) win.loclist = list; // the location list window shares its window's list
    vim.tab.moveToEdge(win, 'J');
    vim.tab.resize(win, 'col', -3);
    vim.tab.prev = prev;
  }
  refreshQfWindow(vim);
  vim.focusWindow(win);
  vim.setCursor(pos(list.idx, 0));
}

function closeQf(vim: Vim, loc: boolean) {
  const w = vim.tab.windows().find(w => w.buf.kind === 'quickfix' && !!w.buf.data.loc === loc);
  if (w) vim.closeWindow(w);
}

function doOverList(vim: Vim, a: ExArgs, kind: 'cdo' | 'cfdo' | 'ldo' | 'lfdo' | 'argdo' | 'bufdo' | 'windo' | 'tabdo') {
  const cmd = a.arg;
  if (!cmd) fail('E471: Argument required');
  vim.beginChange();
  if (kind === 'cdo' || kind === 'ldo' || kind === 'cfdo' || kind === 'lfdo') {
    const loc = kind[0] === 'l';
    const list = qfList(vim, loc);
    const perFile = kind.endsWith('fdo');
    const seen = new Set<string>();
    list.items.forEach((it, i) => {
      if (perFile) {
        if (seen.has(it.file)) return;
        seen.add(it.file);
      }
      jumpQf(vim, loc, i);
      if (perFile) vim.setCursor(pos(0, 0));
      runEx(vim, cmd);
    });
    return;
  }
  if (kind === 'argdo') {
    if (!vim.args.length) fail('E163: There is only one file to edit');
    vim.args.forEach((f, i) => {
      vim.argIdx = i;
      vim.edit(f);
      runEx(vim, cmd);
    });
    return;
  }
  if (kind === 'bufdo') {
    for (const b of vim.buffers.filter(b => b.listed && b.kind === 'file')) {
      vim.showBuffer(vim.win, b);
      runEx(vim, cmd);
    }
    return;
  }
  if (kind === 'windo') {
    for (const w of vim.tab.windows()) {
      vim.focusWindow(w);
      runEx(vim, cmd);
    }
    return;
  }
  for (let i = 0; i < vim.tabs.length; i++) {
    vim.tabIdx = i;
    runEx(vim, cmd);
  }
}

// ---- buffers -----------------------------------------------------------------------------------------

function listedBuffers(vim: Vim) {
  return vim.buffers.filter(b => b.listed);
}

function bufferCycle(vim: Vim, dir: 1 | -1, n: number) {
  const list = listedBuffers(vim);
  if (!list.length) fail();
  let i = list.indexOf(vim.buf);
  for (let k = 0; k < n; k++) i = (i + dir + list.length) % list.length;
  vim.showBuffer(vim.win, list[i]);
}

/** Buffer numbers count from 1 in each editor, in creation order, like Vim's. */
export const bufnr = (vim: Vim, b: Buffer) => vim.buffers.indexOf(b) + 1;

function lsText(vim: Vim) {
  return listedBuffers(vim).map(b => {
    const flags = (b === vim.buf ? '%a' : b === vim.win.alt ? '# ' : vim.tab.windows().some(w => w.buf === b) ? ' a' : '  ') + (b.modified ? ' +' : '  ');
    const p = b === vim.buf ? vim.cursor.line + 1 : (vim.win.lastPos.get(b.id)?.line ?? 0) + 1;
    return `${String(bufnr(vim, b)).padStart(3)} ${flags} "${b.name}"`.padEnd(32) + ` line ${p}`;
  }).join('\n');
}

function findBufferArg(vim: Vim, arg: string) {
  if (/^\d+$/.test(arg)) {
    const b = vim.buffers[+arg - 1];
    if (!b) fail(`E86: Buffer ${arg} does not exist`);
    return b;
  }
  const exact = vim.buffers.find(b => b.name === arg);
  if (exact) return exact;
  const hits = vim.buffers.filter(b => b.listed && b.name.includes(arg));
  if (hits.length === 1) return hits[0];
  if (hits.length > 1) {
    const base = hits.filter(b => basename(b.name).startsWith(arg));
    if (base.length === 1) return base[0];
    fail(`E93: More than one match for ${arg}`);
  }
  fail(`E94: No matching buffer for ${arg}`);
}

function deleteBuffer(vim: Vim, b: Buffer, force: boolean) {
  if (b.modified && !force && b.kind === 'file') fail(`E89: No write since last change for buffer ${bufnr(vim, b)} (add ! to override)`);
  b.listed = false;
  const others = listedBuffers(vim);
  for (const tab of vim.tabs) {
    for (const w of tab.windows()) {
      if (w.buf !== b) continue;
      const alt = w.alt && w.alt.listed ? w.alt : others[0];
      if (alt) vim.showBuffer(w, alt);
      else {
        const empty = new Buffer('[No Name]', '');
        vim.addBuffer(empty);
        vim.showBuffer(w, empty);
      }
    }
  }
}

// ---- options -----------------------------------------------------------------------------------------------

function setOption(vim: Vim, arg: string, local: boolean) {
  if (!arg || arg === 'all') {
    const changed = Object.entries(vim.options).filter(([k, v]) => v !== (DEFAULTS as Record<string, unknown>)[k]);
    vim.msg('--- Options ---\n' + changed.map(([k, v]) => (typeof v === 'boolean' ? (v ? k : 'no' + k) : `${k}=${v}`)).join('  '), 'more');
    return;
  }
  const target = local ? vim.win.opts : (vim.options as Record<string, boolean | number | string>);
  for (const tok of arg.split(/\s+/)) {
    const m = /^(no|inv)?(\w+)(!|\?|&|([+^-]?=)(.*))?$/.exec(tok);
    if (!m) fail(`E518: Unknown option: ${tok}`);
    const name = OPTION_ALIASES[m[2]] ?? m[2];
    if (!(name in vim.options)) {
      if (m[2].startsWith('no') && (OPTION_ALIASES[m[2].slice(2)] ?? m[2].slice(2)) in vim.options) {
        const n2 = OPTION_ALIASES[m[2].slice(2)] ?? m[2].slice(2);
        target[n2] = false;
        continue;
      }
      fail(`E518: Unknown option: ${m[2]}`);
    }
    const cur = vim.options[name];
    if (m[3] === '?') {
      const v = name in vim.win.opts ? vim.win.opts[name] : cur;
      vim.msg(typeof v === 'boolean' ? (v ? `  ${name}` : `no${name}`) : `  ${name}=${v}`);
      continue;
    }
    if (m[3] === '&') { target[name] = (DEFAULTS as Record<string, boolean | number>)[name]; continue; }
    if (typeof cur === 'boolean') {
      if (m[4]) fail(`E474: Invalid argument: ${tok}`);
      target[name] = m[1] === 'no' ? false : m[1] === 'inv' || m[3] === '!' ? !cur : true;
      continue;
    }
    if (!m[4]) {
      vim.msg(`  ${name}=${cur}`);
      continue;
    }
    const val = typeof cur === 'number' ? parseInt(m[5], 10) : m[5];
    if (typeof cur === 'number' && isNaN(val as number)) fail(`E521: Number required after =: ${tok}`);
    if (m[4] === '+=') target[name] = typeof cur === 'number' ? cur + (val as number) : cur + String(val);
    else if (m[4] === '-=') target[name] = typeof cur === 'number' ? cur - (val as number) : String(cur).replace(String(val), '');
    else if (m[4] === '^=') target[name] = typeof cur === 'number' ? cur * (val as number) : String(val) + cur;
    else target[name] = val;
  }
  vim.emit('set');
}

import { DEFAULT_OPTIONS as DEFAULTS } from './types';

// ---- file ops ---------------------------------------------------------------------------------------------

function write(vim: Vim, a: ExArgs, buf = vim.buf) {
  if (buf.kind !== 'file') {
    if (buf.data.onWrite) return (buf.data.onWrite as () => void)();
    fail('E382: Cannot write, \'buftype\' option is set');
  }
  const name = a.arg || buf.name;
  if (name === '[No Name]') fail('E32: No file name');
  const text = buf.text() + '\n';
  if (a.range) {
    const part = buf.lines.slice(a.range.start, a.range.end + 1).join('\n') + '\n';
    vim.fs.write(name, part);
  } else {
    vim.fs.write(name, text);
    if (!a.arg || a.arg === buf.name) buf.modified = false;
    if (buf.name === '[No Name]') buf.name = name;
  }
  const bytes = text.length;
  vim.msg(`"${name}" ${buf.lineCount}L, ${bytes}B written`);
  vim.emit('write');
}

function quit(vim: Vim, a: ExArgs) {
  const b = vim.buf;
  const shownElsewhere = vim.tabs.some(t => t.windows().some(w => w !== vim.win && w.buf === b));
  if (b.modified && !a.bang && !shownElsewhere && b.kind === 'file') fail('E37: No write since last change (add ! to override)');
  vim.emit('quit');
  const wins = vim.tab.windows();
  if (wins.length > 1 || vim.tabs.length > 1) {
    vim.closeWindow();
    return;
  }
  vim.msg('(You would be back at your shell now. The tutor stays open.)');
}

// ---- the table -------------------------------------------------------------------------------------------

const COMMANDS: Record<string, Cmd> = {
  substitute: { min: 1, run: (v, a) => substitute(v, a, 's') },
  '&': { min: 1, run: (v, a) => substitute(v, a, '&') },
  '&&': { min: 2, run: (v, a) => substitute(v, { ...a, arg: '&' + a.arg }, '&') },
  '~': { min: 1, run: (v, a) => substitute(v, a, '~') },
  global: { min: 1, bar: true, run: (v, a) => globalCmd(v, a, false) },
  vglobal: { min: 1, bar: true, run: (v, a) => globalCmd(v, a, true) },
  normal: { min: 4, bar: true, run: normalCmd },
  delete: {
    min: 1,
    run: (v, a) => {
      const { reg, count } = regAndCount(a);
      const r = withCount(v, a, count);
      v.beginChange();
      const val = v.deleteRange({ start: pos(r.start, 0), end: pos(r.end, 0), kind: 'line' });
      v.registers.delete(reg, val);
      const l = Math.min(r.start, v.buf.lineCount - 1);
      v.setCursor(pos(l, firstNonBlank(v.line(l))));
      report(v, r.end - r.start + 1, 'fewer lines');
    },
  },
  yank: {
    min: 1,
    run: (v, a) => {
      const { reg, count } = regAndCount(a);
      const r = withCount(v, a, count);
      v.registers.yank(reg, v.getText({ start: pos(r.start, 0), end: pos(r.end, 0), kind: 'line' }));
      report(v, r.end - r.start + 1, 'lines yanked');
    },
  },
  put: {
    min: 2,
    run: (v, a) => {
      const reg = a.arg.trim() || null;
      const val = v.getRegister(reg);
      const text = val.kind === 'line' ? val.text.replace(/\n$/, '') : val.text;
      const line = a.range ? a.range.end : v.cursor.line;
      const at = a.bang ? Math.max(0, line) : line + 1;
      v.beginChange();
      const lines = text.split('\n');
      v.insertLines(at, lines);
      v.setCursor(pos(at + lines.length - 1, firstNonBlank(v.line(at + lines.length - 1))));
    },
  },
  move: {
    min: 1,
    run: (v, a) => {
      const r = lineRange(v, a);
      const dest = parseAddrArg(v, a.arg);
      if (dest >= r.start && dest < r.end) fail('E134: Cannot move a range of lines into itself');
      if (dest === r.end || (dest === r.start - 1 && false)) return;
      v.beginChange();
      const B = v.buf;
      const moved = B.lines.slice(r.start, r.end + 1);
      // Preserve marks by splicing.
      B.splice(r.start, moved.length, []);
      const insertAt = dest < r.start ? dest + 1 : dest - moved.length + 1;
      B.splice(insertAt, 0, moved);
      B.recordChange(pos(insertAt + moved.length - 1, 0));
      v.setCursor(pos(insertAt + moved.length - 1, firstNonBlank(v.line(insertAt + moved.length - 1))));
      report(v, moved.length, 'lines moved');
    },
  },
  copy: {
    min: 2,
    run: (v, a) => {
      const r = lineRange(v, a);
      const dest = parseAddrArg(v, a.arg);
      v.beginChange();
      const lines = v.buf.lines.slice(r.start, r.end + 1);
      v.insertLines(dest + 1, lines);
      v.setCursor(pos(dest + lines.length, firstNonBlank(v.line(dest + lines.length))));
    },
  },
  t: { min: 1, run: (v, a) => COMMANDS.copy.run(v, a) },
  join: {
    min: 1,
    run: (v, a) => {
      let r = lineRange(v, a);
      const m = /^(\d+)?$/.exec(a.arg.trim());
      if (m?.[1]) r = { start: r.end, end: r.end + +m[1] - 1 };
      else if (a.addrCount < 2) r = { start: r.start, end: r.start + 1 };
      r.end = Math.min(r.end, v.buf.lineCount - 1);
      if (r.end <= r.start) return;
      v.beginChange();
      v.setCursor(pos(r.start, 0));
      v.getAction(a.bang ? 'gJ' : 'J')!.run({ count: r.end - r.start + 1, hasCount: true, reg: null, arg: '', keys: 'J' });
    },
  },
  '>': {
    min: 1,
    run: (v, a) => {
      const times = 1 + (a.arg.match(/^>*/)?.[0].length ?? 0);
      const cnt = /\d+/.exec(a.arg)?.[0];
      const r = cnt ? { start: lineRange(v, a).end, end: lineRange(v, a).end + +cnt - 1 } : lineRange(v, a);
      v.beginChange();
      v.getOperator('>')!.run({ start: pos(r.start, 0), end: pos(Math.min(r.end, v.buf.lineCount - 1), 0), kind: 'line' }, { reg: null, count: times, hasCount: true, visual: 'V', keys: '>' });
    },
  },
  '<': {
    min: 1,
    run: (v, a) => {
      const times = 1 + (a.arg.match(/^<*/)?.[0].length ?? 0);
      const r = lineRange(v, a);
      v.beginChange();
      v.getOperator('<')!.run({ start: pos(r.start, 0), end: pos(r.end, 0), kind: 'line' }, { reg: null, count: times, hasCount: true, visual: 'V', keys: '<' });
    },
  },
  mark: { min: 2, run: (v, a) => { const l = a.range ? a.range.end : v.cursor.line; v.buf.marks.set(a.arg.trim(), pos(l, 0)); } },
  k: { min: 1, run: (v, a) => COMMANDS.mark.run(v, a) },
  sort: {
    min: 3,
    run: (v, a) => {
      const r = lineRange(v, a, 'all');
      const range = a.range ?? { start: 0, end: v.buf.lineCount - 1 };
      let flags = a.arg;
      let pat: RegExp | null = null;
      const pm = /\/((?:\\.|[^/])*)\//.exec(flags);
      if (pm) {
        pat = v.compilePattern(pm[1]).re;
        flags = flags.replace(pm[0], '');
      }
      const lines = v.buf.lines.slice(range.start, range.end + 1);
      const key = (l: string) => {
        if (!pat) return l;
        pat.lastIndex = 0;
        const m = pat.exec(l);
        return m ? l.slice(m.index + m[0].length) : '';
      };
      const numeric = flags.includes('n');
      const ic = flags.includes('i');
      let sorted = lines.map((l, i) => ({ l, i })).sort((x, y) => {
        let kx: string | number = key(x.l), ky: string | number = key(y.l);
        if (numeric) {
          const nx = /-?\d+/.exec(kx as string), ny = /-?\d+/.exec(ky as string);
          kx = nx ? +nx[0] : -Infinity;
          ky = ny ? +ny[0] : -Infinity;
        } else if (ic) { kx = (kx as string).toLowerCase(); ky = (ky as string).toLowerCase(); }
        return kx < ky ? -1 : kx > ky ? 1 : x.i - y.i;
      }).map(o => o.l);
      if (a.bang) sorted.reverse();
      if (flags.includes('u')) sorted = sorted.filter((l, i) => i === 0 || (ic ? l.toLowerCase() !== sorted[i - 1].toLowerCase() : l !== sorted[i - 1]));
      v.beginChange();
      v.buf.splice(range.start, lines.length, sorted);
      v.buf.recordChange(pos(range.start, 0));
      v.setCursor(pos(range.start, 0));
      void r;
      if (lines.length - sorted.length > 0) report(v, lines.length - sorted.length, 'fewer lines');
      v.emit('sort');
    },
  },
  nohlsearch: { min: 3, run: v => { v.hlActive = false; } },
  let: {
    min: 3,
    run: (v, a) => {
      const m = /^@(.)\s*(\.?=)\s*(.*)$/.exec(a.arg);
      if (m) {
        const val = v.evalExpr(m[3]);
        if (m[1] === '/') { v.search = { pattern: val, dir: 1, offset: '' }; v.hlActive = true; return; }
        const cur = m[2] === '.=' ? v.getRegister(m[1]).text : '';
        v.registers.set(m[1], { text: cur + val, kind: val.endsWith('\n') ? 'line' : 'char' });
        return;
      }
      const o = /^&(\w+)\s*=\s*(.*)$/.exec(a.arg);
      if (o) return setOption(v, `${o[1]}=${v.evalExpr(o[2])}`, false);
      fail(`E121: Undefined variable: ${a.arg}`);
    },
  },
  echo: { min: 2, run: (v, a) => v.msg(a.arg ? v.evalExpr(a.arg) : '') },
  registers: {
    min: 3,
    run: v => {
      const rows = v.registers.list().map(([n, val]) => `  ${REG_KIND_LABEL[val.kind]}  "${n}   ${showRegister(val.text).slice(0, 60)}`);
      v.msg('Type Name Content\n' + rows.join('\n'), 'more');
    },
  },
  display: { min: 2, run: (v, a) => COMMANDS.registers.run(v, a) },
  marks: {
    min: 4,
    run: v => {
      const rows: string[] = ['mark line  col file/text'];
      const entries = [...v.buf.marks.entries()].filter(([k]) => !k.startsWith('\u0001')).sort(([a], [b]) => a.localeCompare(b));
      for (const [k, p] of entries) rows.push(` ${k}  ${String(p.line + 1).padStart(6)} ${String(p.col).padStart(4)} ${v.line(p.line).trim()}`);
      for (const [k, g] of v.globalMarks) rows.push(` ${k}  ${String(g.pos.line + 1).padStart(6)} ${String(g.pos.col).padStart(4)} ${g.buf.name}`);
      v.msg(rows.join('\n'), 'more');
    },
  },
  jumps: {
    min: 2,
    run: v => {
      const w = v.win;
      const rows = w.jumplist.map((j, i) => ` ${String(Math.abs(w.jumpIdx - i)).padStart(3)} ${String(j.pos.line + 1).padStart(5)} ${String(j.pos.col).padStart(4)} ${j.buf === v.buf ? j.buf.line(j.pos.line).trim() : j.buf.name}`);
      v.msg(' jump line  col file/text\n' + rows.join('\n') + (w.jumpIdx >= w.jumplist.length ? '\n>' : ''), 'more');
    },
  },
  changes: {
    min: 7,
    run: v => {
      const b = v.buf;
      v.msg('change line  col text\n' + b.changelist.map((p, i) => ` ${String(Math.abs(b.changeIdx - i)).padStart(5)} ${String(p.line + 1).padStart(5)} ${String(p.col).padStart(4)} ${b.line(p.line).trim()}`).join('\n'), 'more');
    },
  },
  undo: { min: 1, run: v => v.getAction('u')!.run({ count: 1, hasCount: false, reg: null, arg: '', keys: 'u' }) },
  redo: { min: 3, run: v => v.getAction('<C-r>')!.run({ count: 1, hasCount: false, reg: null, arg: '', keys: '<C-r>' }) },
  set: { min: 2, run: (v, a) => setOption(v, a.arg, false) },
  setlocal: { min: 4, run: (v, a) => setOption(v, a.arg, true) },
  '!': {
    min: 1,
    bar: true,
    run: (v, a) => {
      if (!a.range) {
        const r = shellFilter(a.arg, []);
        v.msg(Array.isArray(r) ? `:!${a.arg}\n${r.join('\n')}` : r.error, Array.isArray(r) ? 'more' : 'error');
        return;
      }
      const lines = v.buf.lines.slice(a.range.start, a.range.end + 1);
      const r = shellFilter(a.arg, lines);
      if (!Array.isArray(r)) fail(r.error);
      v.beginChange();
      v.buf.splice(a.range.start, lines.length, r);
      v.buf.recordChange(pos(a.range.start, 0));
      v.setCursor(pos(a.range.start, 0));
      report(v, lines.length, 'lines filtered');
      v.emit('filter');
    },
  },
  read: {
    min: 1,
    bar: true,
    run: (v, a) => {
      const at = a.range ? a.range.end : v.cursor.line;
      let lines: string[];
      if (a.arg.startsWith('!')) {
        const r = shellFilter(a.arg.slice(1).trim(), []);
        if (!Array.isArray(r)) fail(r.error);
        lines = r;
      } else {
        const t = v.fs.read(a.arg || v.buf.name);
        if (t == null) fail(`E484: Can't open file ${a.arg}`);
        lines = t.replace(/\n$/, '').split('\n');
      }
      v.beginChange();
      v.insertLines(at + 1, lines);
      v.setCursor(pos(at + 1, firstNonBlank(v.line(at + 1))));
    },
  },
  write: { min: 1, run: (v, a) => write(v, a) },
  update: { min: 2, run: (v, a) => { if (v.buf.modified) write(v, a); } },
  wall: { min: 2, run: v => { for (const b of v.buffers) if (b.modified && b.kind === 'file') write(v, { range: null, addrCount: 0, bang: false, arg: '', name: 'w', count: null, reg: null }, b); } },
  wq: { min: 2, run: (v, a) => { write(v, a); quit(v, { ...a, bang: true }); } },
  xit: { min: 1, run: (v, a) => { if (v.buf.modified) write(v, a); quit(v, { ...a, bang: true }); } },
  exit: { min: 3, run: (v, a) => COMMANDS.xit.run(v, a) },
  quit: { min: 1, run: quit },
  qall: { min: 2, run: (v, a) => { if (!a.bang && v.buffers.some(b => b.modified && b.kind === 'file')) fail('E37: No write since last change (add ! to override)'); v.emit('quit'); v.msg('(You would be back at your shell now. The tutor stays open.)'); } },
  quitall: { min: 5, run: (v, a) => COMMANDS.qall.run(v, a) },
  wqall: { min: 3, run: (v, a) => { COMMANDS.wall.run(v, a); COMMANDS.qall.run(v, { ...a, bang: true }); } },
  xall: { min: 2, run: (v, a) => COMMANDS.wqall.run(v, a) },
  close: { min: 3, run: v => v.closeWindow() },
  only: { min: 2, run: v => { v.tab.only(v.win); } },
  edit: {
    min: 1,
    run: (v, a) => {
      if (!a.arg) {
        if (a.bang) {
          const t = v.fs.read(v.buf.name);
          if (t != null) { v.buf.setText(t.replace(/\n$/, '')); v.buf.modified = false; v.clampCursor(false); }
        }
        return;
      }
      if (v.buf.modified && !a.bang && v.tab.windows().filter(w => w.buf === v.buf).length === 1 && v.buf.kind === 'file') {
        // Vim refuses unless 'hidden' is set; Neovim sets hidden by default.
      }
      v.pushJump();
      v.edit(a.arg);
      v.emit('edit');
    },
  },
  enew: { min: 3, run: v => { const b = new Buffer('[No Name]', ''); v.addBuffer(b); v.showBuffer(v.win, b); } },
  find: {
    min: 3,
    run: (v, a) => {
      const f = v.resolveFile(a.arg);
      if (!f) fail(`E345: Can't find file "${a.arg}" in path`);
      v.pushJump();
      v.edit(f);
    },
  },
  split: { min: 2, run: (v, a) => { v.splitWindow('col'); if (a.arg) v.edit(v.resolveFile(a.arg) ?? a.arg); } },
  vsplit: { min: 2, run: (v, a) => { v.splitWindow('row'); if (a.arg) v.edit(v.resolveFile(a.arg) ?? a.arg); } },
  new: { min: 3, run: (v, a) => { const b = new Buffer(a.arg || '[No Name]', ''); v.addBuffer(b); v.splitWindow('col', b); } },
  vnew: { min: 3, run: (v, a) => { const b = new Buffer(a.arg || '[No Name]', ''); v.addBuffer(b); v.splitWindow('row', b); } },
  sfind: { min: 2, run: (v, a) => { const f = v.resolveFile(a.arg); if (!f) fail(`E345: Can't find file "${a.arg}" in path`); v.splitWindow('col'); v.edit(f); } },
  tabnew: { min: 6, run: (v, a) => { v.newTab(); if (a.arg) v.edit(v.resolveFile(a.arg) ?? a.arg); } },
  tabedit: { min: 4, run: (v, a) => COMMANDS.tabnew.run(v, a) },
  tabclose: {
    min: 4,
    run: v => {
      if (v.tabs.length === 1) fail('E784: Cannot close last tab page');
      v.tabs.splice(v.tabIdx, 1);
      v.tabIdx = Math.min(v.tabIdx, v.tabs.length - 1);
    },
  },
  tabonly: { min: 4, run: v => { v.tabs = [v.tab]; v.tabIdx = 0; } },
  tabnext: { min: 4, run: (v, a) => { const n = parseInt(a.arg, 10); v.tabIdx = isNaN(n) ? (v.tabIdx + 1) % v.tabs.length : Math.min(v.tabs.length, n) - 1; } },
  tabprevious: { min: 4, run: v => { v.tabIdx = (v.tabIdx - 1 + v.tabs.length) % v.tabs.length; } },
  tabNext: { min: 4, run: v => { v.tabIdx = (v.tabIdx - 1 + v.tabs.length) % v.tabs.length; } },
  tabfirst: { min: 4, run: v => { v.tabIdx = 0; } },
  tablast: { min: 4, run: v => { v.tabIdx = v.tabs.length - 1; } },
  tabs: { min: 4, run: v => v.msg(v.tabs.map((t, i) => `Tab page ${i + 1}\n` + t.windows().map(w => `${w === v.win ? '>' : ' '}   ${w.buf.name}`).join('\n')).join('\n'), 'more') },
  ls: { min: 2, run: v => v.msg(lsText(v), 'more') },
  buffers: { min: 7, run: v => v.msg(lsText(v), 'more') },
  files: { min: 5, run: v => v.msg(lsText(v), 'more') },
  buffer: {
    min: 1,
    run: (v, a) => {
      const arg = a.arg || (a.range ? String(a.range.end + 1) : '');
      if (!arg) return;
      v.showBuffer(v.win, findBufferArg(v, arg));
    },
  },
  sbuffer: { min: 2, run: (v, a) => { const b = findBufferArg(v, a.arg); v.splitWindow('col', b); } },
  bnext: { min: 2, run: (v, a) => bufferCycle(v, 1, a.range ? a.range.end + 1 : parseInt(a.arg, 10) || 1) },
  bprevious: { min: 2, run: (v, a) => bufferCycle(v, -1, a.range ? a.range.end + 1 : parseInt(a.arg, 10) || 1) },
  bNext: { min: 2, run: (v, a) => bufferCycle(v, -1, parseInt(a.arg, 10) || 1) },
  bfirst: { min: 2, run: v => v.showBuffer(v.win, listedBuffers(v)[0]) },
  brewind: { min: 2, run: v => v.showBuffer(v.win, listedBuffers(v)[0]) },
  blast: { min: 2, run: v => { const l = listedBuffers(v); v.showBuffer(v.win, l[l.length - 1]); } },
  bdelete: {
    min: 2,
    run: (v, a) => {
      const targets = a.arg ? a.arg.split(/\s+/).map(x => findBufferArg(v, x)) : a.range ? v.buffers.filter(b => bufnr(v, b) >= a.range!.start + 1 && bufnr(v, b) <= a.range!.end + 1) : [v.buf];
      for (const b of targets) deleteBuffer(v, b, a.bang);
    },
  },
  bwipeout: { min: 2, run: (v, a) => COMMANDS.bdelete.run(v, a) },
  bunload: { min: 3, run: (v, a) => COMMANDS.bdelete.run(v, a) },
  args: {
    min: 2,
    run: (v, a) => {
      if (!a.arg) {
        v.msg(v.args.map((f, i) => (i === v.argIdx ? `[${f}]` : f)).join(' '));
        return;
      }
      v.args = expandFiles(v, a.arg);
      if (!v.args.length) fail('E479: No match');
      v.argIdx = 0;
      v.edit(v.args[0]);
    },
  },
  next: { min: 1, run: v => { if (v.argIdx + 1 >= v.args.length) fail('E165: Cannot go beyond last file'); v.edit(v.args[++v.argIdx]); } },
  previous: { min: 4, run: v => { if (v.argIdx <= 0) fail('E164: Cannot go before first file'); v.edit(v.args[--v.argIdx]); } },
  Next: { min: 1, run: v => COMMANDS.previous.run(v, {} as ExArgs) },
  first: { min: 3, run: v => { if (!v.args.length) fail(); v.argIdx = 0; v.edit(v.args[0]); } },
  rewind: { min: 3, run: v => COMMANDS.first.run(v, {} as ExArgs) },
  last: { min: 2, run: v => { if (!v.args.length) fail(); v.argIdx = v.args.length - 1; v.edit(v.args[v.argIdx]); } },
  argdo: { min: 5, bar: true, run: (v, a) => doOverList(v, a, 'argdo') },
  bufdo: { min: 5, bar: true, run: (v, a) => doOverList(v, a, 'bufdo') },
  windo: { min: 5, bar: true, run: (v, a) => doOverList(v, a, 'windo') },
  tabdo: { min: 4, bar: true, run: (v, a) => doOverList(v, a, 'tabdo') },
  cdo: { min: 3, bar: true, run: (v, a) => doOverList(v, a, 'cdo') },
  cfdo: { min: 3, bar: true, run: (v, a) => doOverList(v, a, 'cfdo') },
  ldo: { min: 3, bar: true, run: (v, a) => doOverList(v, a, 'ldo') },
  lfdo: { min: 3, bar: true, run: (v, a) => doOverList(v, a, 'lfdo') },
  vimgrep: { min: 3, run: (v, a) => grep(v, a, false, true) },
  lvimgrep: { min: 2, run: (v, a) => grep(v, a, true, true) },
  grep: { min: 2, run: (v, a) => grep(v, a, false, false) },
  lgrep: { min: 3, run: (v, a) => grep(v, a, true, false) },
  copen: { min: 4, run: v => openQf(v, false) },
  cwindow: { min: 2, run: v => { if (v.quickfix.items.length) openQf(v, false); } },
  cclose: { min: 3, run: v => closeQf(v, false) },
  lopen: { min: 3, run: v => openQf(v, true) },
  lwindow: { min: 2, run: v => { if (v.win.loclist?.items.length) openQf(v, true); } },
  lclose: { min: 3, run: v => closeQf(v, true) },
  cnext: { min: 2, run: (v, a) => jumpQf(v, false, qfList(v, false).idx + (a.range ? a.range.end + 1 : parseInt(a.arg, 10) || 1)) },
  cprevious: { min: 2, run: (v, a) => jumpQf(v, false, qfList(v, false).idx - (a.range ? a.range.end + 1 : parseInt(a.arg, 10) || 1)) },
  cNext: { min: 2, run: (v, a) => jumpQf(v, false, qfList(v, false).idx - (parseInt(a.arg, 10) || 1)) },
  cfirst: { min: 3, run: v => jumpQf(v, false, 0) },
  crewind: { min: 2, run: v => jumpQf(v, false, 0) },
  clast: { min: 3, run: v => jumpQf(v, false, qfList(v, false).items.length - 1) },
  cc: { min: 2, run: (v, a) => jumpQf(v, false, (parseInt(a.arg, 10) || (a.range ? a.range.end + 1 : qfList(v, false).idx + 1)) - 1) },
  lnext: { min: 2, run: (v, a) => jumpQf(v, true, qfList(v, true).idx + (parseInt(a.arg, 10) || 1)) },
  lprevious: { min: 2, run: (v, a) => jumpQf(v, true, qfList(v, true).idx - (parseInt(a.arg, 10) || 1)) },
  lfirst: { min: 3, run: v => jumpQf(v, true, 0) },
  llast: { min: 3, run: v => jumpQf(v, true, qfList(v, true).items.length - 1) },
  ll: { min: 2, run: (v, a) => jumpQf(v, true, (parseInt(a.arg, 10) || qfList(v, true).idx + 1) - 1) },
  clist: { min: 2, run: v => v.msg(qfList(v, false).items.map((it, i) => `${String(i + 1).padStart(2)} ${it.file}:${it.line + 1} col ${it.col + 1}: ${it.text}`).join('\n'), 'more') },
  fold: { min: 2, run: (v, a) => { const r = lineRange(v, a); v.win.folds.push({ start: r.start, end: r.end, closed: true }); } },
  foldopen: { min: 5, run: (v, a) => { const r = lineRange(v, a); v.win.folds.forEach(f => { if (f.start <= r.end && f.end >= r.start) f.closed = false; }); } },
  foldclose: { min: 5, run: (v, a) => { const r = lineRange(v, a); v.win.folds.forEach(f => { if (f.start <= r.end && f.end >= r.start) f.closed = true; }); } },
  retab: {
    min: 3,
    run: (v, a) => {
      const r = lineRange(v, a, 'all');
      const ts = Number(v.opt('tabstop'));
      v.beginChange();
      const range = a.range ?? r;
      for (let l = range.start; l <= range.end; l++) {
        const t = v.line(l);
        if (v.opt('expandtab')) v.buf.setLine(l, t.replace(/^\t+/, m => ' '.repeat(m.length * ts)));
      }
    },
  },
  center: { min: 2, run: (v, a) => align(v, a, 'center') },
  right: { min: 2, run: (v, a) => align(v, a, 'right') },
  left: { min: 2, run: (v, a) => align(v, a, 'left') },
  print: { min: 1, run: (v, a) => { const r = lineRange(v, a); v.msg(v.buf.lines.slice(r.start, r.end + 1).join('\n'), 'more'); } },
  number: { min: 2, run: (v, a) => { const r = lineRange(v, a); v.msg(v.buf.lines.slice(r.start, r.end + 1).map((l, i) => `${String(r.start + i + 1).padStart(3)} ${l}`).join('\n'), 'more'); } },
  '#': { min: 1, run: (v, a) => COMMANDS.number.run(v, a) },
  '=': { min: 1, run: (v, a) => v.msg(String((a.range ? a.range.end : v.buf.lineCount - 1) + 1)) },
  help: { min: 1, run: (v, a) => v.msg(`Help for "${a.arg || 'help'}" isn't bundled in the tutor. In Neovim, :h ${a.arg || 'help'} opens it.`) },
  terminal: { min: 3, run: v => v.msg('The terminal is not available in the tutor.') },
  startinsert: { min: 4, run: (v, a) => { const p = v.cursor; v.startInsert(a.bang ? 'A' : 'i', a.bang ? pos(p.line, v.line().length) : p); } },
  stopinsert: { min: 5, run: v => { if (v.insert) v.leaveInsert(); } },
  execute: { min: 3, run: (v, a) => runEx(v, v.evalExpr(a.arg)) },
  '@': { min: 1, run: (v, a) => { const r = a.arg.trim() || '@'; if (a.range) v.setCursor(pos(a.range.end, 0)); v.executeRegister(r === '@' ? (v.lastMacro ?? ':') : r, 1); } },
  '*': { min: 1, run: (v, a) => COMMANDS['@'].run(v, a) },
  noh: { min: 3, run: v => { v.hlActive = false; } },
};

function align(vim: Vim, a: ExArgs, how: 'center' | 'right' | 'left') {
  const r = lineRange(vim, a);
  const width = parseInt(a.arg, 10) || (how === 'left' ? 0 : Number(vim.opt('textwidth')) || 80);
  vim.beginChange();
  for (let l = r.start; l <= r.end; l++) {
    const t = vim.line(l).trim();
    const pad = how === 'center' ? Math.max(0, Math.floor((width - t.length) / 2)) : how === 'right' ? Math.max(0, width - t.length) : width;
    vim.buf.setLine(l, t ? ' '.repeat(pad) + t : '');
  }
}

// Silence unused-import warnings for helpers kept for plugins.
void registerToKeys; void indentOf;
export type { Pos };
