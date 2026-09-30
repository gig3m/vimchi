// Built-in normal/visual/operator-pending commands.

import type { ActionCtx, MotionCtx, MotionResult, OpCtx, Vim } from './editor';
import { keysToRegister, registerToKeys, splitSearchOffset } from './editor';
import {
  findChar, firstNonBlankPos, functionStarts, matchPair, paragraphBackward, paragraphForward, sentenceBackward,
  sentenceForward, unmatchedClose, unmatchedOpen, wordBackward, wordEnd, wordEndBackward, wordForward,
} from './motions';
import { escapeVim } from './regex';
import type { RegValue } from './registers';
import { formatLines, reindentLines, toggleComment } from './transforms';
import { firstNonBlank, indentOf, lastCol, lastNonBlank } from './text';
import { TEXT_OBJECTS } from './textobjects';
import { type Pos, type Range, cmpPos, fail } from './types';

export function installCommands(vim: Vim) {
  const V = vim;
  const cur = () => V.cursor;
  const L = () => V.lines;
  const ln = (n = cur().line) => V.line(n);
  const M = (keys: string, run: (c: MotionCtx) => MotionResult | null, arg?: 'char') => V.defineMotion(keys, { run, arg });

  // ---- left/right/up/down ---------------------------------------------------------
  const left = (c: MotionCtx) => {
    const p = cur();
    if (p.col === 0) return c.op ? null : null;
    return { pos: pos(p.line, Math.max(0, p.col - c.count)) };
  };
  const right = (c: MotionCtx) => {
    const p = cur();
    const len = ln().length;
    const max = c.op || c.visual ? len : Math.max(0, len - 1);
    if (p.col >= max) return c.op && len > 0 ? { pos: pos(p.line, len) } : null;
    return { pos: pos(p.line, Math.min(max, p.col + c.count)) };
  };
  const vert = (dir: 1 | -1) => (c: MotionCtx): MotionResult | null => {
    const p = cur();
    let line = p.line;
    for (let i = 0; i < c.count; i++) {
      // Closed folds count as one line.
      const f = V.closedFoldAt(line);
      let next = dir === 1 ? (f ? f.end + 1 : line + 1) : line - 1;
      if (dir === -1) {
        const g = V.closedFoldAt(next);
        if (g) next = g.start;
      }
      if (next < 0 || next >= V.buf.lineCount) {
        if (i === 0) return null;
        break;
      }
      line = next;
    }
    return { pos: pos(line, Math.min(V.win.want, c.visual ? ln(line).length : lastCol(ln(line)))), linewise: true, keepWant: true };
  };
  M('h', left); M('<Left>', left); M('<BS>', left); M('<C-h>', left);
  M('l', right); M('<Right>', right); M(' ', right);
  M('j', vert(1)); M('<Down>', vert(1)); M('<C-j>', vert(1)); M('<C-n>', vert(1)); M('gj', vert(1));
  M('k', vert(-1)); M('<Up>', vert(-1)); M('<C-p>', vert(-1)); M('gk', vert(-1));
  const lineDown = (off: number) => (c: MotionCtx): MotionResult | null => {
    const l = cur().line + (off === 0 ? c.count - 1 : off * c.count);
    if (l < 0 || l >= V.buf.lineCount) return null;
    return { pos: firstNonBlankPos(L(), l), linewise: true };
  };
  M('+', lineDown(1)); M('<CR>', lineDown(1)); M('-', lineDown(-1)); M('_', lineDown(0));

  M('0', () => ({ pos: pos(cur().line, 0) }));
  M('<Home>', () => ({ pos: pos(cur().line, 0) }));
  M('^', () => ({ pos: firstNonBlankPos(L(), cur().line) }));
  M('$', c => {
    const l = Math.min(V.buf.lineCount - 1, cur().line + c.count - 1);
    return { pos: pos(l, Math.max(0, ln(l).length - (c.op ? 1 : 1))), inclusive: true, want: Infinity };
  });
  M('<End>', c => ({ pos: pos(cur().line + c.count - 1, Math.max(0, ln(cur().line + c.count - 1).length - 1)), inclusive: true, want: Infinity }));
  M('g_', c => {
    const l = Math.min(V.buf.lineCount - 1, cur().line + c.count - 1);
    return { pos: pos(l, lastNonBlank(ln(l))), inclusive: true };
  });
  M('|', c => ({ pos: pos(cur().line, Math.min(c.count - 1, lastCol(ln()))) }));
  M('gm', () => ({ pos: pos(cur().line, Math.min(Math.floor(V.win.width / 2), lastCol(ln()))) }));
  M('gM', () => ({ pos: pos(cur().line, Math.floor(ln().length / 2)) }));

  /** A jump to line l: first non-blank with 'startofline', the remembered column without it (Neovim's default). */
  /** Where a linewise change leaves the cursor on line l: first non-blank with 'startofline', else the wanted column. */
  const landOn = (l: number) => (V.options.startofline ? firstNonBlankPos(L(), l) : pos(l, Math.min(V.win.want, lastCol(ln(l)))));
  const lineJump = (l: number): MotionResult =>
    V.options.startofline
      ? { pos: firstNonBlankPos(L(), l), linewise: true, jump: true }
      : { pos: pos(l, Math.min(V.win.want, Math.max(0, L()[l].length - (V.visual ? 0 : 1)))), linewise: true, jump: true, keepWant: true };
  M('gg', c => lineJump(c.hasCount ? Math.min(c.count, V.buf.lineCount) - 1 : 0));
  M('G', c => lineJump(c.hasCount ? Math.min(c.count, V.buf.lineCount) - 1 : V.buf.lineCount - 1));

  // ---- words -------------------------------------------------------------------------
  const repeatMotion = (f: (p: Pos) => Pos | null) => (c: MotionCtx): MotionResult | null => {
    let p: Pos | null = cur();
    for (let i = 0; i < c.count; i++) {
      const n: Pos | null = f(p!);
      if (!n) {
        if (i === 0) return null;
        break;
      }
      p = n;
    }
    return { pos: p! };
  };
  M('w', c => {
    const r = repeatMotion(p => wordForward(L(), p, false))(c);
    if (!r && c.op) return { pos: pos(cur().line, ln().length) };
    // Going past the last word on the last line moves to its end.
    return r;
  });
  M('W', c => repeatMotion(p => wordForward(L(), p, true))(c) ?? (c.op ? { pos: pos(cur().line, ln().length) } : null));
  M('<S-Right>', repeatMotion(p => wordForward(L(), p, false)));
  const incl = (f: (c: MotionCtx) => MotionResult | null) => (c: MotionCtx) => {
    const r = f(c);
    return r ? { ...r, inclusive: true } : null;
  };
  M('e', incl(repeatMotion(p => wordEnd(L(), p, false))));
  M('E', incl(repeatMotion(p => wordEnd(L(), p, true))));
  M('b', repeatMotion(p => wordBackward(L(), p, false)));
  M('B', repeatMotion(p => wordBackward(L(), p, true)));
  M('<S-Left>', repeatMotion(p => wordBackward(L(), p, false)));
  M('ge', incl(repeatMotion(p => wordEndBackward(L(), p, false))));
  M('gE', incl(repeatMotion(p => wordEndBackward(L(), p, true))));

  // ---- find char ------------------------------------------------------------------------
  const find = (forward: boolean, till: boolean) => (c: MotionCtx): MotionResult | null => {
    V.lastFind = { ch: c.arg, forward, till };
    const col = findChar(ln(), cur().col, c.arg, forward, till, c.count);
    if (col == null) return null;
    return { pos: pos(cur().line, col), inclusive: forward };
  };
  M('f', find(true, false), 'char');
  M('F', find(false, false), 'char');
  M('t', find(true, true), 'char');
  M('T', find(false, true), 'char');
  const repeatFind = (reverse: boolean) => (c: MotionCtx): MotionResult | null => {
    const lf = V.lastFind;
    if (!lf) return null;
    const forward = reverse ? !lf.forward : lf.forward;
    const col = findChar(ln(), cur().col, lf.ch, forward, lf.till, c.count, true);
    if (col == null) return null;
    return { pos: pos(cur().line, col), inclusive: forward };
  };
  M(';', repeatFind(false));
  M(',', repeatFind(true));

  // ---- brackets, paragraphs, sentences -----------------------------------------------
  M('%', c => {
    if (c.hasCount) {
      const l = Math.min(V.buf.lineCount - 1, Math.max(0, Math.ceil((c.count * V.buf.lineCount) / 100) - 1));
      return lineJump(l);
    }
    const p = matchPair(L(), cur());
    return p ? { pos: p, inclusive: true, jump: true, openFold: true } : null;
  });
  M('}', c => {
    const l = paragraphForward(L(), cur().line, c.count);
    const atEnd = l === V.buf.lineCount - 1 && ln(l) !== '';
    return { pos: pos(l, atEnd ? Math.max(0, ln(l).length - (c.op ? 0 : 1)) : 0), jump: true };
  });
  M('{', c => ({ pos: pos(paragraphBackward(L(), cur().line, c.count), 0), jump: true }));
  M(')', c => {
    const p = sentenceForward(L(), cur(), c.count);
    return p ? { pos: p, jump: true } : { pos: pos(V.buf.lineCount - 1, lastCol(ln(V.buf.lineCount - 1))), jump: true };
  });
  M('(', c => { const p = sentenceBackward(L(), cur(), c.count); return p ? { pos: p, jump: true } : null; });
  M('[(', () => { const p = unmatchedOpen(L(), cur(), '(', ')'); return p ? { pos: p, jump: true } : null; });
  M('[{', () => { const p = unmatchedOpen(L(), cur(), '{', '}'); return p ? { pos: p, jump: true } : null; });
  M('])', () => { const p = unmatchedClose(L(), cur(), '(', ')'); return p ? { pos: p, inclusive: true, jump: true } : null; });
  M(']}', () => { const p = unmatchedClose(L(), cur(), '{', '}'); return p ? { pos: p, inclusive: true, jump: true } : null; });
  const funcJump = (dir: 1 | -1) => (c: MotionCtx): MotionResult | null => {
    const starts = functionStarts(L());
    let line = cur().line;
    for (let i = 0; i < c.count; i++) {
      const next = dir === 1 ? starts.find(l => l > line) : [...starts].reverse().find(l => l < line);
      if (next == null) { if (i === 0) return null; break; }
      line = next;
    }
    return { pos: firstNonBlankPos(L(), line), jump: true, openFold: true };
  };
  M(']m', funcJump(1));
  M('[m', funcJump(-1));
  M(']]', funcJump(1));
  M('[[', funcJump(-1));

  // ---- screen ---------------------------------------------------------------------------
  const screenRows = () => {
    const rows = V.visibleLines();
    const top = Math.max(0, rows.indexOf(V.win.top));
    return rows.slice(top, top + V.win.height);
  };
  M('H', c => {
    const rows = screenRows();
    const so = Math.min(Number(V.options.scrolloff), Math.floor((rows.length - 1) / 2));
    const i = Math.min(rows.length - 1, Math.max(c.count - 1, V.win.top === 0 ? c.count - 1 : so));
    return lineJump(rows[i]);
  });
  M('L', c => {
    const rows = screenRows();
    const i = Math.max(0, rows.length - c.count);
    return lineJump(rows[i]);
  });
  M('M', () => {
    const rows = screenRows();
    return lineJump(rows[Math.floor((rows.length - 1) / 2)]);
  });

  // ---- marks ------------------------------------------------------------------------------
  const markPos = (m: string): Pos | null => {
    if (m === '`' || m === "'") return V.buf.marks.get("'") ?? pos(0, 0);
    if (/[A-Z0-9]/.test(m)) {
      const g = V.globalMarks.get(m);
      if (!g) return null;
      if (g.buf !== V.buf) V.showBuffer(V.win, g.buf);
      return g.pos;
    }
    return V.buf.marks.get(m) ?? null;
  };
  M('`', c => {
    const p = markPos(c.arg);
    if (!p) fail('E20: Mark not set');
    return { pos: pos(Math.min(p.line, V.buf.lineCount - 1), p.col), jump: true, openFold: true };
  }, 'char');
  M("'", c => {
    const p = markPos(c.arg);
    if (!p) fail('E20: Mark not set');
    return { pos: firstNonBlankPos(L(), Math.min(p.line, V.buf.lineCount - 1)), linewise: true, jump: true, openFold: true };
  }, 'char');

  // ---- search ------------------------------------------------------------------------------
  M('n', c => V.searchMotion(V.search.pattern, V.search.dir, V.search.offset, c.count, { noSmartcase: V.search.noSmartcase }));
  M('N', c => V.searchMotion(V.search.pattern, (V.search.dir * -1) as 1 | -1, V.search.offset, c.count, { noSmartcase: V.search.noSmartcase }));
  const star = (dir: 1 | -1, whole: boolean) => (c: MotionCtx): MotionResult | null => {
    const w = V.wordUnderCursor(false);
    if (!w) fail('E348: No string under cursor');
    // Start from the beginning of the word so # skips the current one.
    const t = ln();
    let s = cur().col;
    while (s < t.length && !/\w/.test(t[s])) s++;
    while (s > 0 && /\w/.test(t[s - 1])) s--;
    const pat = whole && /^\w/.test(w) ? `\\<${escapeVim(w)}\\>` : escapeVim(w);
    V.search = { pattern: pat, dir, offset: '', noSmartcase: true };
    V.history['/'].push(pat);
    const save = { ...cur() };
    V.win.cursor = pos(save.line, s);
    try {
      return V.searchMotion(pat, dir, '', c.count, { noSmartcase: true });
    } finally {
      V.win.cursor = save;
    }
  };
  M('*', star(1, true)); M('#', star(-1, true)); M('g*', star(1, false)); M('g#', star(-1, false));

  // Search as a motion is typed on the command line: handled by actions below in
  // normal/visual, and here for operator-pending (d/foo<CR>).
  V.defineAction('/', { run: () => openSearch(1) }, ['n', 'v', 'o']);
  V.defineAction('?', { run: () => openSearch(-1) }, ['n', 'v', 'o']);
  function openSearch(dir: 1 | -1) {
    V.openCmdline(dir === 1 ? '/' : '?', '', text => {
      V.incsearchPos = null;
      const { pattern, offset } = splitSearchOffset(text, dir === 1 ? '/' : '?');
      const pat = pattern || V.search.pattern;
      V.search = { pattern: pat, dir, offset, noSmartcase: false };
      const res = V.searchMotion(pat, dir, offset, V.pendingSearchCount || 1);
      V.pendingSearchCount = 0;
      if (!res) return;
      if (V.pendingSearchOp) {
        const op = V.pendingSearchOp;
        V.pendingSearchOp = null;
        op(res);
        return;
      }
      if (res.jump) V.pushJump(V.cmdlineSaved ?? cur());
      V.applyMotion(res);
      V.openFoldsAt(cur().line);
    }, () => {
      V.pendingSearchOp = null;
    });
  }

  // ---- fold motions ---------------------------------------------------------------------------
  M('zj', () => {
    const l = cur().line;
    const starts = V.win.folds.map(f => f.start).filter(s => s > l).sort((a, b) => a - b);
    return starts.length ? { pos: pos(starts[0], 0), linewise: true } : null;
  });
  M('zk', () => {
    const l = cur().line;
    const ends = V.win.folds.map(f => f.end).filter(e => e < l).sort((a, b) => b - a);
    return ends.length ? { pos: pos(ends[0], 0), linewise: true } : null;
  });
  M('[z', () => {
    const f = V.win.folds.filter(f => f.start <= cur().line && cur().line <= f.end).sort((a, b) => b.start - a.start)[0];
    return f ? { pos: pos(f.start, 0), linewise: true } : null;
  });
  M(']z', () => {
    const f = V.win.folds.filter(f => f.start <= cur().line && cur().line <= f.end).sort((a, b) => b.start - a.start)[0];
    return f ? { pos: pos(f.end, 0), linewise: true } : null;
  });

  // gd / gD: first occurrence of the word (local / global declaration).
  const gotoDecl = () => {
    const w = V.wordUnderCursor(false);
    if (!w) fail('E348: No string under cursor');
    const re = new RegExp(`\\b${w.replace(/[$]/g, '\\$')}\\b`);
    for (let l = 0; l < V.buf.lineCount; l++) {
      const m = re.exec(ln(l));
      if (m) {
        V.search = { pattern: `\\<${escapeVim(w)}\\>`, dir: 1, offset: '', noSmartcase: true };
        V.hlActive = true;
        return { pos: pos(l, m.index), jump: true, openFold: true } as MotionResult;
      }
    }
    return null;
  };
  M('gd', gotoDecl);
  M('gD', gotoDecl);

  // ---- text objects -------------------------------------------------------------------------------
  for (const [k, obj] of Object.entries(TEXT_OBJECTS)) {
    V.defineObject('i' + k, obj);
    V.defineObject('a' + k, obj);
  }
  // gn: next match as an object.
  const gn = (dir: 1 | -1) => (): Range | null => {
    const pat = V.search.pattern;
    if (!pat) fail('E35: No previous regular expression');
    const m = V.findMatch(pat, cur(), dir, false, { noSmartcase: V.search.noSmartcase })
      ?? V.findMatch(pat, cur(), dir, true, { noSmartcase: V.search.noSmartcase });
    if (!m) return null;
    // A match that contains the cursor counts.
    const all = V.matches(pat, V.buf, { noSmartcase: V.search.noSmartcase });
    const inside = all.find(x => cmpPos(x.start, cur()) <= 0 && cmpPos(cur(), x.end) <= 0);
    const r = inside ?? m;
    V.hlActive = true;
    return { start: r.start, end: r.end, kind: 'char' };
  };
  V.defineObject('gn', () => gn(1)());
  V.defineObject('gN', () => gn(-1)());
  V.defineAction('gn', { run: () => { const r = gn(1)(); if (!r) fail(); V.enterVisual('v'); V.visual!.anchor = r.start; V.win.cursor = { ...r.end }; } }, ['n', 'v']);
  V.defineAction('gN', { run: () => { const r = gn(-1)(); if (!r) fail(); V.enterVisual('v'); V.visual!.anchor = r.end; V.win.cursor = { ...r.start }; } }, ['n', 'v']);

  // ---- operators -------------------------------------------------------------------------------------
  const put = (reg: string | null, v: RegValue, isDelete: boolean) => {
    if (isDelete) V.registers.delete(reg, v);
    else V.registers.yank(reg, v);
  };

  V.defineOperator('d', {
    change: true,
    run: (r, c) => {
      const v = V.deleteRange(r);
      put(c.reg, v, true);
      if (r.kind === 'line') { const l = Math.min(r.start.line, V.buf.lineCount - 1); V.setCursor(landOn(l), V.win.want); }
      else V.setCursor(pos(r.start.line, r.kind === 'block' ? Math.min(r.start.col, r.end.col) : r.start.col));
    },
  });
  V.defineOperator('y', {
    run: (r, c) => {
      const v = V.getText(r);
      put(c.reg, v, false);
      V.buf.marks.set('[', r.kind === 'line' ? pos(r.start.line, 0) : r.start);
      V.buf.marks.set(']', r.kind === 'line' ? pos(r.end.line, Math.max(0, ln(r.end.line).length - 1)) : r.end);
      if (r.kind === 'block') V.setCursor(pos(r.start.line, Math.min(r.start.col, r.end.col)));
      else if (r.kind === 'line' && !c.visual) { if (cmpPos(r.start, cur()) < 0) V.setCursor(pos(r.start.line, cur().col)); }
      else V.setCursor(r.kind === 'line' ? pos(r.start.line, c.visual ? 0 : cur().col) : r.start);
      V.emit('yank');
    },
  });
  V.defineOperator('c', {
    change: true,
    run: (r, c) => {
      if (r.kind === 'line') {
        const indent = V.opt('autoindent') ? indentOf(ln(r.start.line)) : '';
        const v = V.getText(r);
        put(c.reg, v, true);
        V.buf.splice(r.start.line, r.end.line - r.start.line + 1, [indent]);
        V.buf.recordChange(pos(r.start.line, indent.length));
        V.startInsert('cc', pos(r.start.line, indent.length));
        return;
      }
      if (r.kind === 'block') {
        const v = V.deleteRange(r);
        put(c.reg, v, true);
        const col = Math.min(r.start.col, r.end.col);
        V.startInsert('c', pos(r.start.line, col), 1, { block: { first: r.start.line, last: r.end.line, col, append: false, toEol: false } });
        return;
      }
      const v = V.deleteRange(r);
      put(c.reg, v, true);
      V.startInsert('c', r.start);
    },
  });

  const shift = (dir: 1 | -1) => (r: Range, c: OpCtx) => {
    const sw = Number(V.opt('shiftwidth')) || 8;
    const times = c.visual ? c.count : 1;
    for (let l = r.start.line; l <= r.end.line; l++) {
      const t = ln(l);
      if (!t.trim() && dir === 1) continue;
      const ind = indentOf(t).replace(/\t/g, ' '.repeat(Number(V.opt('tabstop')))).length;
      const n = dir === 1 ? ind + sw * times : Math.max(0, ind - sw * times);
      V.buf.setLine(l, ' '.repeat(n) + t.trimStart());
    }
    V.buf.recordChange(pos(r.start.line, 0));
    V.setCursor(landOn(r.start.line), V.win.want);
    const n = r.end.line - r.start.line + 1;
    if (n > 2) V.msg(`${n} lines ${dir === 1 ? '>' : '<'}ed ${times} time${times > 1 ? 's' : ''}`);
  };
  V.defineOperator('>', { change: true, run: shift(1) });
  V.defineOperator('<', { change: true, run: shift(-1) });
  V.defineOperator('=', {
    change: true,
    run: r => {
      const out = reindentLines(L(), r.start.line, r.end.line, V.buf.filetype, Number(V.opt('shiftwidth')) || 2);
      V.buf.splice(r.start.line, r.end.line - r.start.line + 1, out);
      V.setCursor(landOn(r.start.line), V.win.want);
      const n = r.end.line - r.start.line + 1;
      if (n > 2) V.msg(`${n} lines indented `);
    },
  });

  const caseOp = (f: (s: string) => string) => (r: Range) => {
    if (r.kind === 'line') {
      for (let l = r.start.line; l <= r.end.line; l++) V.buf.setLine(l, f(ln(l)));
      V.setCursor(pos(r.start.line, cur().line === r.start.line ? cur().col : 0));
    } else if (r.kind === 'block') {
      const [c1, c2] = [Math.min(r.start.col, r.end.col), Math.max(r.start.col, r.end.col)];
      for (let l = r.start.line; l <= r.end.line; l++) {
        const t = ln(l);
        const e = r.toEol ? t.length : c2 + 1;
        V.buf.setLine(l, t.slice(0, c1) + f(t.slice(c1, e)) + t.slice(e));
      }
      V.setCursor(pos(r.start.line, c1));
    } else {
      for (let l = r.start.line; l <= r.end.line; l++) {
        const t = ln(l);
        const s = l === r.start.line ? r.start.col : 0;
        const e = l === r.end.line ? r.end.col + 1 : t.length;
        V.buf.setLine(l, t.slice(0, s) + f(t.slice(s, e)) + t.slice(e));
      }
      V.setCursor(r.start);
    }
    V.buf.recordChange(r.start);
  };
  const swapCase = (s: string) => s.replace(/./g, ch => (ch === ch.toUpperCase() ? ch.toLowerCase() : ch.toUpperCase()));
  const rot13 = (s: string) => s.replace(/[a-zA-Z]/g, ch => {
    const b = ch <= 'Z' ? 65 : 97;
    return String.fromCharCode(((ch.charCodeAt(0) - b + 13) % 26) + b);
  });
  V.defineOperator('g~', { change: true, run: caseOp(swapCase) });
  V.defineOperator('gu', { change: true, run: caseOp(s => s.toLowerCase()) });
  V.defineOperator('gU', { change: true, run: caseOp(s => s.toUpperCase()) });
  V.defineOperator('g?', { change: true, run: caseOp(rot13) });

  const format = (keepCursor: boolean) => (r: Range) => {
    const save = { ...cur() };
    const tw = Number(V.opt('textwidth')) || 79;
    const out = formatLines(L().slice(r.start.line, r.end.line + 1), tw);
    V.buf.splice(r.start.line, r.end.line - r.start.line + 1, out);
    V.buf.recordChange(pos(r.start.line, 0));
    if (keepCursor) V.setCursor(pos(Math.min(save.line, V.buf.lineCount - 1), save.col));
    else V.setCursor(firstNonBlankPos(L(), Math.min(r.start.line + out.length - 1, V.buf.lineCount - 1)));
  };
  V.defineOperator('gq', { change: true, run: format(false) });
  V.defineOperator('gw', { change: true, run: format(true) });

  V.defineOperator('!', {
    run: r => {
      const n = r.end.line - r.start.line;
      const range = n === 0 ? '.' : `.,.+${n}`;
      V.setCursor(pos(r.start.line, cur().col));
      V.openCmdline(':', `${range}!`, text => V.ex(text));
    },
  });

  V.defineOperator('zf', {
    run: r => {
      V.win.folds.push({ start: r.start.line, end: r.end.line, closed: true });
      V.setCursor(pos(r.start.line, 0));
    },
  });

  // Neovim 0.10+: built-in commenting.
  V.defineOperator('gc', {
    change: true,
    run: r => {
      const out = toggleComment(L().slice(r.start.line, r.end.line + 1), V.buf.filetype);
      V.buf.splice(r.start.line, r.end.line - r.start.line + 1, out);
      V.buf.recordChange(pos(r.start.line, 0));
      V.setCursor(pos(r.start.line, Math.min(cur().col, lastCol(ln(r.start.line)))));
    },
  });
  V.defineObject('gc', ({ lines, cur: c }) => {
    const isC = (l: number) => lines[l] !== undefined && /^\s*(\/\/|#|--|")/.test(lines[l]);
    if (!isC(c.line)) return null;
    let s = c.line, e = c.line;
    while (isC(s - 1)) s--;
    while (isC(e + 1)) e++;
    return { start: pos(s, 0), end: pos(e, 0), kind: 'line' };
  });
  // The object is operator-pending only; in visual mode gc stays the comment operator.
  V.defineOperator('gc', V.getOperator('gc')!, ['v']);

  // ---- actions: simple edits ------------------------------------------------------------------------
  const A = (keys: string, run: (c: ActionCtx) => void, opts: { change?: boolean; arg?: 'char' | 'char2'; modes?: ('n' | 'v' | 'o')[] } = {}) =>
    V.defineAction(keys, { run, change: opts.change, arg: opts.arg }, opts.modes ?? ['n']);
  const runOp = (keys: string, r: Range, c: ActionCtx) => {
    V.getOperator(keys)!.run(r, { reg: c.reg, count: c.count, hasCount: c.hasCount, visual: null, keys });
  };
  const charRange = (count: number, back = false): Range | null => {
    const p = cur(), t = ln();
    if (!t.length) return null;
    if (back) {
      if (p.col === 0) return null;
      return { start: pos(p.line, Math.max(0, p.col - count)), end: pos(p.line, p.col - 1), kind: 'char' };
    }
    return { start: { ...p }, end: pos(p.line, Math.min(t.length - 1, p.col + count - 1)), kind: 'char' };
  };

  A('x', c => { const r = charRange(c.count); if (!r) fail(); runOp('d', r, c); }, { change: true });
  A('<Del>', c => { const r = charRange(c.count); if (!r) fail(); runOp('d', r, c); }, { change: true });
  A('X', c => { const r = charRange(c.count, true); if (!r) fail(); runOp('d', r, c); }, { change: true });
  A('D', c => {
    const endLine = Math.min(V.buf.lineCount - 1, cur().line + c.count - 1);
    const r: Range = { start: { ...cur() }, end: pos(endLine, Math.max(0, ln(endLine).length - 1)), kind: 'char' };
    if (!ln().length && c.count === 1) return;
    runOp('d', r, c);
    V.clampCursor(false);
  }, { change: true });
  A('C', c => {
    const endLine = Math.min(V.buf.lineCount - 1, cur().line + c.count - 1);
    if (!ln().length && c.count === 1) return V.startInsert('C', cur());
    runOp('c', { start: { ...cur() }, end: pos(endLine, Math.max(0, ln(endLine).length - 1)), kind: 'char' }, c);
  }, { change: true });
  A('s', c => {
    if (!ln().length) return V.startInsert('s', cur());
    runOp('c', charRange(c.count)!, c);
  }, { change: true });
  A('S', c => runOp('c', { start: pos(cur().line, 0), end: pos(Math.min(V.buf.lineCount - 1, cur().line + c.count - 1), 0), kind: 'line' }, c), { change: true });
  A('Y', c => {
    // Neovim: Y is y$.
    const endLine = Math.min(V.buf.lineCount - 1, cur().line + c.count - 1);
    const p = { ...cur() };
    runOp('y', { start: p, end: pos(endLine, Math.max(0, ln(endLine).length - 1)), kind: 'char' }, c);
    V.setCursor(p);
  });
  A('r', c => {
    const p = cur(), t = ln();
    if (p.col + c.count > t.length) fail();
    if (c.arg === '<CR>' || c.arg === '\r') {
      V.buf.splice(p.line, 1, [t.slice(0, p.col), t.slice(p.col + c.count)]);
      V.setCursor(pos(p.line + 1, 0));
      return;
    }
    V.buf.setLine(p.line, t.slice(0, p.col) + c.arg.repeat(c.count) + t.slice(p.col + c.count));
    V.buf.recordChange(p);
    V.setCursor(pos(p.line, p.col + c.count - 1));
  }, { change: true, arg: 'char' });
  A('~', c => {
    const p = cur(), t = ln();
    if (!t.length) fail();
    const e = Math.min(t.length, p.col + c.count);
    V.buf.setLine(p.line, t.slice(0, p.col) + swapCase(t.slice(p.col, e)) + t.slice(e));
    V.buf.recordChange(p);
    V.setCursor(pos(p.line, Math.min(e, t.length - 1)));
  }, { change: true });
  const join = (spaces: boolean) => (c: ActionCtx) => {
    const n = Math.max(2, c.count);
    const start = cur().line;
    if (start + 1 >= V.buf.lineCount) fail();
    const last = Math.min(V.buf.lineCount - 1, start + n - 1);
    let text = ln(start);
    let col = 0;
    for (let l = start + 1; l <= last; l++) {
      const next = ln(l);
      if (spaces) {
        const trimmed = next.replace(/^\s+/, '');
        text = text.replace(/\s+$/, '');
        col = text.length;
        const sep = !trimmed || !text ? '' : trimmed.startsWith(')') ? '' : /[.!?]$/.test(text) ? ' ' : ' ';
        text = text + sep + trimmed;
      } else {
        col = text.length;
        text += next;
      }
    }
    V.buf.splice(start, last - start + 1, [text]);
    V.buf.recordChange(pos(start, col));
    V.setCursor(pos(start, col));
  };
  A('J', join(true), { change: true });
  A('gJ', join(false), { change: true });

  // ---- insert -------------------------------------------------------------------------------------------
  A('i', c => V.startInsert('i', cur(), c.count), { change: true });
  A('<Insert>', c => V.startInsert('i', cur(), c.count), { change: true });
  A('a', c => V.startInsert('a', pos(cur().line, ln().length ? cur().col + 1 : 0), c.count), { change: true });
  A('I', c => V.startInsert('I', firstNonBlankPos(L(), cur().line), c.count), { change: true });
  A('gI', c => V.startInsert('gI', pos(cur().line, 0), c.count), { change: true });
  A('A', c => V.startInsert('A', pos(cur().line, ln().length), c.count), { change: true });
  A('R', c => V.startInsert('R', cur(), c.count), { change: true });
  const open = (above: boolean) => (c: ActionCtx) => {
    const l = cur().line;
    const indent = V.opt('autoindent') ? indentOf(ln(l)) + (!above && /[{([]\s*$/.test(ln(l)) ? ' '.repeat(Number(V.opt('shiftwidth'))) : '') : '';
    const at = above ? l : l + 1;
    V.insertLines(at, [indent]);
    V.startInsert(above ? 'O' : 'o', pos(at, indent.length), c.count);
  };
  A('o', open(false), { change: true });
  A('O', open(true), { change: true });
  A('gi', c => {
    const p = V.buf.marks.get('^') ?? cur();
    V.startInsert('gi', pos(Math.min(p.line, V.buf.lineCount - 1), p.col), c.count);
  }, { change: true });

  // ---- put ---------------------------------------------------------------------------------------------
  const doPut = (after: boolean, gp: boolean, indentAdjust = false) => (c: ActionCtx) => {
    const v = V.getRegister(c.reg);
    if (!v.text && c.reg !== '_') fail(c.reg ? `E353: Nothing in register ${c.reg}` : 'E353: Nothing in register "');
    putValue(v, after, gp, c.count, indentAdjust);
  };
  function putValue(v: RegValue, after: boolean, gp: boolean, count: number, indentAdjust = false) {
    const p = cur();
    if (v.kind === 'line') {
      let lines = v.text.replace(/\n$/, '').split('\n');
      if (indentAdjust) {
        const target = indentOf(ln()).length;
        const base = Math.min(...lines.filter(l => l.trim()).map(l => indentOf(l).length));
        lines = lines.map(l => (l.trim() ? ' '.repeat(target) + l.slice(base) : l));
      }
      const all: string[] = [];
      for (let i = 0; i < count; i++) all.push(...lines);
      const at = after ? p.line + 1 : p.line;
      V.insertLines(at, all);
      V.buf.marks.set('[', pos(at, 0));
      V.buf.marks.set(']', pos(at + all.length - 1, Math.max(0, all[all.length - 1].length - 1)));
      if (gp) V.setCursor(pos(Math.min(at + all.length, V.buf.lineCount - 1), 0));
      else V.setCursor(firstNonBlankPos(L(), at));
      return;
    }
    if (v.kind === 'block') {
      const parts = v.text.split('\n');
      const w = Math.max(...parts.map(x => x.length));
      const col = after && ln().length ? p.col + 1 : p.col;
      for (let i = 0; i < parts.length; i++) {
        const l = p.line + i;
        if (l >= V.buf.lineCount) V.insertLines(V.buf.lineCount, ['']);
        const t = ln(l).padEnd(col);
        const piece = (parts[i].padEnd(w)).repeat(count);
        V.buf.setLine(l, (t.slice(0, col) + piece + t.slice(col)).replace(/\s+$/, m => (t.slice(col).length ? m : '')));
      }
      V.buf.recordChange(pos(p.line, col));
      V.setCursor(pos(p.line, col));
      return;
    }
    const text = v.text.repeat(count);
    const at = after && ln().length ? pos(p.line, p.col + 1) : pos(p.line, p.col);
    const end = V.insertText(at, text);
    V.buf.marks.set('[', at);
    V.buf.marks.set(']', pos(end.line, Math.max(0, end.col - 1)));
    if (gp) V.setCursor(end);
    else if (text.includes('\n')) V.setCursor(at);
    else V.setCursor(pos(end.line, Math.max(0, end.col - 1)));
  }
  A('p', doPut(true, false), { change: true });
  A('P', doPut(false, false), { change: true });
  A('gp', doPut(true, true), { change: true });
  A('gP', doPut(false, true), { change: true });
  A(']p', doPut(true, false, true), { change: true });
  A('[p', doPut(false, false, true), { change: true });

  // ---- undo ---------------------------------------------------------------------------------------------
  A('u', c => {
    for (let i = 0; i < c.count; i++) {
      const p = V.buf.undo(cur());
      if (!p) {
        if (i === 0) V.msg('Already at oldest change');
        break;
      }
      V.setCursor(p);
      V.clampCursor(false);
    }
    V.emit('undo');
  });
  A('<C-r>', c => {
    for (let i = 0; i < c.count; i++) {
      const p = V.buf.redo(cur());
      if (!p) {
        if (i === 0) V.msg('Already at newest change');
        break;
      }
      V.setCursor(p);
      V.clampCursor(false);
    }
    V.emit('redo');
  });
  A('U', () => {
    const lu = V.buf.lineUndo;
    if (!lu || lu.line >= V.buf.lineCount) return;
    V.beginChange();
    const now = ln(lu.line);
    V.buf.setLine(lu.line, lu.text);
    V.buf.lineUndo = { line: lu.line, text: now };
    V.setCursor(pos(lu.line, 0));
    V.emit('undo');
  });
  A('.', c => { V.repeatChange(c.hasCount ? c.count : null); V.emit('dot'); });

  // ---- numbers -------------------------------------------------------------------------------------------
  const increment = (delta: number) => (c: ActionCtx) => {
    const p = cur(), t = ln();
    const re = /(0[xX][0-9a-fA-F]+|0[bB][01]+|-?\d+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(t))) {
      const s = m.index, e = s + m[0].length - 1;
      if (e < p.col) continue;
      let out: string;
      const lit = m[0];
      if (/^0[xX]/.test(lit)) {
        const n = parseInt(lit.slice(2), 16) + delta * c.count;
        const hex = (n >>> 0).toString(16);
        out = lit.slice(0, 2) + (/[A-F]/.test(lit.slice(2)) ? hex.toUpperCase() : hex).padStart(lit.length - 2, '0');
      } else if (/^0[bB]/.test(lit)) {
        out = lit.slice(0, 2) + Math.max(0, parseInt(lit.slice(2), 2) + delta * c.count).toString(2).padStart(lit.length - 2, '0');
      } else {
        // A leading "-" only counts if not preceded by a word character.
        let num = lit, start = s;
        if (lit.startsWith('-') && s > 0 && /\w/.test(t[s - 1])) { num = lit.slice(1); start = s + 1; }
        const n = parseInt(num, 10) + delta * c.count, digits = num.replace(/^-/, '');
        out = String(n);
        // Zero-padded decimals keep their width (007 -> 008), as octal is off in Neovim.
        if (digits.length > 1 && digits[0] === '0') out = (n < 0 ? '-' : '') + String(Math.abs(n)).padStart(digits.length, '0');
        V.buf.setLine(p.line, t.slice(0, start) + out + t.slice(e + 1));
        V.buf.recordChange(pos(p.line, start));
        V.setCursor(pos(p.line, start + out.length - 1));
        return;
      }
      V.buf.setLine(p.line, t.slice(0, s) + out + t.slice(e + 1));
      V.buf.recordChange(pos(p.line, s));
      V.setCursor(pos(p.line, s + out.length - 1));
      return;
    }
    fail();
  };
  A('<C-a>', increment(1), { change: true });
  A('<C-x>', increment(-1), { change: true });

  // ---- registers, macros, marks --------------------------------------------------------------------------
  A('q', c => {
    if (V.recording) return V.stopRecording();
    if (!/[a-zA-Z0-9"]/.test(c.arg)) fail();
    // qa clears then records; qA appends.
    if (/[a-z0-9]/.test(c.arg)) V.registers.set(c.arg, { text: '', kind: 'char' });
    V.startRecording(c.arg);
  }, { arg: 'char' });
  A('@', c => { V.executeRegister(c.arg, c.count); }, { arg: 'char' });
  A('m', c => {
    if (/[a-z]/.test(c.arg)) V.buf.marks.set(c.arg, { ...cur() });
    else if (/[A-Z]/.test(c.arg)) V.globalMarks.set(c.arg, { buf: V.buf, pos: { ...cur() } });
    else if (c.arg === "'" || c.arg === '`') V.pushJump();
    else if (c.arg === '<' || c.arg === '>' || c.arg === '[' || c.arg === ']') V.buf.marks.set(c.arg, { ...cur() });
    else fail();
  }, { arg: 'char' });

  // ---- visual ------------------------------------------------------------------------------------------------
  A('v', () => V.enterVisual('v'), { modes: ['n', 'v'] });
  A('V', () => V.enterVisual('V'), { modes: ['n', 'v'] });
  A('<C-v>', () => V.enterVisual('<C-v>'), { modes: ['n', 'v'] });
  A('<C-q>', () => V.enterVisual('<C-v>'), { modes: ['n', 'v'] });
  A('gv', () => {
    if (V.visual) {
      const lv = V.lastVisual;
      const [s, e] = V.visualBounds();
      const cur2 = { kind: V.visual.kind, start: { ...s }, end: { ...e }, toEol: V.visual.toEol, buf: V.buf };
      V.visual = null;
      V.lastVisual = lv;
      V.reselectVisual();
      V.lastVisual = cur2;
      return;
    }
    V.reselectVisual();
  }, { modes: ['n', 'v'] });

  // ---- scrolling ----------------------------------------------------------------------------------------------
  const scroll = (rowsFn: () => number, moveCursor: boolean) => (c: ActionCtx) => {
    const rows = V.visibleLines();
    const topRow = Math.max(0, rows.indexOf(V.win.top));
    const n = c.hasCount ? c.count : rowsFn();
    const newTop = Math.max(0, Math.min(rows.length - 1, topRow + n));
    const curRow = Math.max(0, rows.indexOf(V.closedFoldAt(cur().line)?.start ?? cur().line));
    if ((n > 0 && topRow >= rows.length - 1 && curRow >= rows.length - 1) || (n < 0 && topRow === 0 && curRow === 0)) fail();
    V.win.top = rows[newTop];
    if (moveCursor) {
      const target = Math.max(0, Math.min(rows.length - 1, curRow + n));
      V.win.cursor = pos(rows[target], 0);
      V.win.cursor.col = Math.min(V.win.want, lastCol(ln()));
    } else {
      // Keep the cursor on screen.
      const vis = rows.slice(newTop, newTop + V.win.height);
      if (!vis.includes(rows[curRow])) V.win.cursor = pos(n > 0 ? vis[0] : vis[vis.length - 1], 0);
    }
  };
  const half = () => Math.max(1, Math.floor(V.win.height / 2));
  A('<C-d>', scroll(half, true), { modes: ['n', 'v'] });
  A('<C-u>', c => scroll(() => -half(), true)({ ...c, count: -c.count }), { modes: ['n', 'v'] });
  A('<C-f>', c => {
    const n = Math.max(1, V.win.height - 2) * c.count;
    scroll(() => n, false)({ ...c, hasCount: false });
    const rows = V.visibleLines();
    const top = rows.indexOf(V.win.top);
    V.win.cursor = landOn(rows[top]);
  }, { modes: ['n', 'v'] });
  A('<PageDown>', c => V.getAction('<C-f>')!.run(c), { modes: ['n', 'v'] });
  A('<C-b>', c => {
    const n = -Math.max(1, V.win.height - 2) * c.count;
    scroll(() => n, false)({ ...c, hasCount: false });
    const rows = V.visibleLines();
    const top = rows.indexOf(V.win.top);
    const bottom = rows[Math.min(rows.length - 1, top + V.win.height - 1)];
    V.win.cursor = landOn(bottom);
  }, { modes: ['n', 'v'] });
  A('<PageUp>', c => V.getAction('<C-b>')!.run(c), { modes: ['n', 'v'] });
  A('<C-e>', c => scroll(() => 1, false)({ ...c, hasCount: c.hasCount }), { modes: ['n', 'v'] });
  A('<C-y>', c => scroll(() => -1, false)({ ...c, count: -c.count }), { modes: ['n', 'v'] });
  const recenter = (where: 'top' | 'center' | 'bottom', fnb: boolean) => (c: ActionCtx) => {
    if (c.hasCount) V.win.cursor = pos(Math.min(c.count, V.buf.lineCount) - 1, cur().col);
    if (fnb) V.win.cursor = firstNonBlankPos(L(), cur().line);
    V.scrollCursorTo(where);
  };
  A('zz', recenter('center', false), { modes: ['n', 'v'] });
  A('zt', recenter('top', false), { modes: ['n', 'v'] });
  A('zb', recenter('bottom', false), { modes: ['n', 'v'] });
  A('z<CR>', recenter('top', true), { modes: ['n', 'v'] });
  A('z.', recenter('center', true), { modes: ['n', 'v'] });
  A('z-', recenter('bottom', true), { modes: ['n', 'v'] });

  // ---- folds ----------------------------------------------------------------------------------------------------
  const foldsHere = () => V.win.folds.filter(f => f.start <= cur().line && cur().line <= f.end).sort((a, b) => (b.start - a.start) || (a.end - b.end));
  A('zo', () => { const f = foldsHere().filter(f => f.closed).pop() ?? null; if (!f) { if (!foldsHere().length) fail('E490: No fold found'); return; } f.closed = false; });
  A('zO', () => { const fs = foldsHere(); if (!fs.length) fail('E490: No fold found'); fs.forEach(f => (f.closed = false)); });
  A('zc', () => { const f = foldsHere().find(f => !f.closed); if (!f) { if (!foldsHere().length) fail('E490: No fold found'); return; } f.closed = true; V.win.cursor = pos(f.start, cur().col); });
  A('zC', () => { const fs = foldsHere(); if (!fs.length) fail('E490: No fold found'); fs.forEach(f => (f.closed = true)); });
  A('za', () => {
    const fs = foldsHere();
    if (!fs.length) fail('E490: No fold found');
    const closed = fs.filter(f => f.closed);
    if (closed.length) closed[closed.length - 1].closed = false;
    else fs[0].closed = true;
  });
  A('zA', () => { const fs = foldsHere(); if (!fs.length) fail('E490: No fold found'); const open = fs.some(f => !f.closed); fs.forEach(f => (f.closed = open)); });
  A('zv', () => V.openFoldsAt(cur().line));
  A('zR', () => V.win.folds.forEach(f => (f.closed = false)));
  A('zM', () => V.win.folds.forEach(f => (f.closed = true)));
  A('zd', () => { const f = foldsHere()[0]; if (!f) fail('E490: No fold found'); V.win.folds.splice(V.win.folds.indexOf(f), 1); });
  A('zD', () => { const fs = foldsHere(); if (!fs.length) fail('E490: No fold found'); V.win.folds = V.win.folds.filter(f => !fs.includes(f)); });
  A('zE', () => { V.win.folds = []; });
  A('zF', c => { V.win.folds.push({ start: cur().line, end: Math.min(V.buf.lineCount - 1, cur().line + c.count - 1), closed: true }); });

  // ---- jumps ---------------------------------------------------------------------------------------------------
  const jump = (dir: -1 | 1) => (c: ActionCtx) => {
    const w = V.win;
    if (dir === -1 && w.jumpIdx === w.jumplist.length) {
      // Remember where we are so <C-i> can come back.
      V.pushJump();
      w.jumpIdx = w.jumplist.length - 1;
    }
    let idx = w.jumpIdx + dir * c.count;
    // Skip entries equal to the current line.
    while (idx >= 0 && idx < w.jumplist.length && w.jumplist[idx].buf === V.buf && w.jumplist[idx].pos.line === cur().line) idx += dir;
    if (idx < 0 || idx >= w.jumplist.length) fail();
    w.jumpIdx = idx;
    const j = w.jumplist[idx];
    if (j.buf !== V.buf) V.showBuffer(w, j.buf);
    V.setCursor(pos(Math.min(j.pos.line, V.buf.lineCount - 1), j.pos.col));
    V.openFoldsAt(cur().line);
  };
  A('<C-o>', jump(-1));
  A('<C-i>', jump(1));
  A('<Tab>', jump(1));
  const changeJump = (dir: -1 | 1) => (c: ActionCtx) => {
    const b = V.buf;
    if (!b.changelist.length) fail('E664: changelist is empty');
    let idx = b.changeIdx + dir * c.count;
    if (idx < 0) { if (b.changeIdx === 0) fail('E662: At start of changelist'); idx = 0; }
    if (idx >= b.changelist.length) { if (b.changeIdx >= b.changelist.length - 1) fail('E663: At end of changelist'); idx = b.changelist.length - 1; }
    b.changeIdx = idx;
    const p = b.changelist[idx];
    V.setCursor(pos(Math.min(p.line, b.lineCount - 1), p.col));
  };
  A('g;', changeJump(-1));
  A('g,', changeJump(1));

  // ---- misc -----------------------------------------------------------------------------------------------------
  A(':', c => {
    const init = V.visual ? "'<,'>" : c.hasCount ? (c.count === 1 ? '.' : `.,.+${c.count - 1}`) : '';
    if (V.visual) V.exitVisual();
    V.openCmdline(':', init, text => V.ex(text));
  }, { modes: ['n', 'v'] });
  A('&', () => V.ex('&&'), { change: true });
  A('g&', () => V.ex('%s//~/&'), { change: true });
  A('<C-l>', () => { V.hlActive = false; });
  A('<C-g>', () => {
    const b = V.buf;
    V.msg(`"${b.name}"${b.modified ? ' [Modified]' : ''} ${b.lineCount} line${b.lineCount === 1 ? '' : 's'} --${Math.round(((cur().line + 1) * 100) / b.lineCount)}%--`);
  });
  A('ga', () => {
    const ch = ln()[cur().col];
    if (ch === undefined) return V.msg('NUL');
    const code = ch.codePointAt(0)!;
    V.msg(`<${ch}> ${code}, Hex ${code.toString(16).padStart(2, '0')}, Oct ${code.toString(8).padStart(3, '0')}`);
  });
  A('g8', () => {
    const ch = ln()[cur().col] ?? '';
    V.msg([...new TextEncoder().encode(ch)].map(b => b.toString(16)).join(' '));
  });
  A('ZZ', () => V.ex('x'));
  A('ZQ', () => V.ex('q!'));
  A('<C-^>', c => {
    const alt = c.hasCount ? V.buffers[c.count - 1] : V.win.alt;
    if (!alt) fail('E23: No alternate file');
    V.showBuffer(V.win, alt);
  });
  A('<C-6>', c => V.getAction('<C-^>')!.run(c));
  A('gf', () => {
    const t = ln();
    let s = cur().col, e = cur().col;
    const isF = (ch: string | undefined) => !!ch && /[\w./~-]/.test(ch);
    while (!isF(t[s]) && s < t.length) s = ++e; // like Vim, use the next file name after the cursor
    while (s > 0 && isF(t[s - 1])) s--;
    while (e < t.length && isF(t[e])) e++;
    const name = t.slice(s, e);
    if (!name) fail('E446: No file name under cursor');
    const resolved = V.resolveFile(name);
    if (!resolved) fail(`E447: Can't find file "${name}" in path`);
    V.pushJump();
    V.edit(resolved);
  });
  A('K', () => {
    const w = V.wordUnderCursor(false);
    if (!w) fail('E349: No identifier under cursor');
    V.msg(`E149: Sorry, no help for ${w}`, 'error');
  });
  A('gt', c => {
    if (c.hasCount) V.tabIdx = Math.min(V.tabs.length, c.count) - 1;
    else V.tabIdx = (V.tabIdx + 1) % V.tabs.length;
  });
  A('gT', c => { V.tabIdx = (V.tabIdx - c.count % V.tabs.length + V.tabs.length) % V.tabs.length; });
  A('<C-PageDown>', c => V.getAction('gt')!.run(c));
  A('<C-PageUp>', c => V.getAction('gT')!.run(c));
  A('q:', () => V.openCmdWindow());

  // ---- windows ------------------------------------------------------------------------------------------------------
  const W = (k: string, run: (c: ActionCtx) => void) => {
    A('<C-w>' + k, run);
    if (k.length === 1 && /[a-z]/.test(k)) A('<C-w><C-' + k + '>', run);
  };
  W('s', () => V.splitWindow('col'));
  W('S', () => V.splitWindow('col'));
  W('v', () => V.splitWindow('row'));
  W('n', () => V.ex('new'));
  W('c', () => V.closeWindow());
  W('q', () => V.ex('q'));
  W('o', () => V.ex('only'));
  for (const d of ['h', 'j', 'k', 'l'] as const) {
    W(d, c => {
      let w = V.win;
      for (let i = 0; i < c.count; i++) {
        const n = V.tab.neighbour(w, d);
        if (!n) break;
        w = n;
      }
      V.focusWindow(w);
    });
  }
  A('<C-w><Left>', c => V.getAction('<C-w>h')!.run(c));
  A('<C-w><Right>', c => V.getAction('<C-w>l')!.run(c));
  A('<C-w><Up>', c => V.getAction('<C-w>k')!.run(c));
  A('<C-w><Down>', c => V.getAction('<C-w>j')!.run(c));
  W('w', c => {
    const wins = V.tab.windows();
    const i = c.hasCount ? Math.min(c.count, wins.length) - 1 : (wins.indexOf(V.win) + 1) % wins.length;
    V.focusWindow(wins[i]);
  });
  W('W', () => { const wins = V.tab.windows(); V.focusWindow(wins[(wins.indexOf(V.win) - 1 + wins.length) % wins.length]); });
  W('p', () => { if (V.tab.prev && V.tab.windows().includes(V.tab.prev)) V.focusWindow(V.tab.prev); else fail(); });
  W('t', () => V.focusWindow(V.tab.windows()[0]));
  W('b', () => { const w = V.tab.windows(); V.focusWindow(w[w.length - 1]); });
  W('=', () => V.tab.equalizeAll());
  W('_', () => V.tab.maximize(V.win, 'col'));
  W('|', () => V.tab.maximize(V.win, 'row'));
  W('+', c => V.tab.resize(V.win, 'col', c.count));
  W('-', c => V.tab.resize(V.win, 'col', -c.count));
  W('>', c => V.tab.resize(V.win, 'row', c.count));
  W('<', c => V.tab.resize(V.win, 'row', -c.count));
  for (const e of ['H', 'J', 'K', 'L'] as const) W(e, () => V.tab.moveToEdge(V.win, e));
  W('x', () => {
    const wins = V.tab.windows();
    const other = wins[(wins.indexOf(V.win) + 1) % wins.length];
    if (other === V.win) return;
    const b = V.win.buf, cpos = { ...V.win.cursor };
    V.win.buf = other.buf; V.win.cursor = { ...other.cursor };
    other.buf = b; other.cursor = cpos;
  });
  W('r', () => {
    const wins = V.tab.windows();
    if (wins.length < 2) return;
    const bufs = wins.map(w => ({ buf: w.buf, cursor: w.cursor }));
    wins.forEach((w, i) => { const s = bufs[(i - 1 + bufs.length) % bufs.length]; w.buf = s.buf; w.cursor = s.cursor; });
    V.focusWindow(wins[(wins.indexOf(V.win) + 1) % wins.length]);
  });
  W('T', () => {
    const w = V.win;
    if (V.tab.windows().length === 1) return;
    V.closeWindow(w);
    V.newTab(w.buf);
  });

  // ---- built-in bracket maps (Neovim 0.11) ----------------------------------------------------------------
  A('[b', c => V.ex(`${c.hasCount ? c.count : ''}bprevious`));
  A(']b', c => V.ex(`${c.hasCount ? c.count : ''}bnext`));
  A('[B', () => V.ex('bfirst'));
  A(']B', () => V.ex('blast'));
  A('[q', c => V.ex(`${c.hasCount ? c.count : ''}cprevious`));
  A(']q', c => V.ex(`${c.hasCount ? c.count : ''}cnext`));
  A('[Q', () => V.ex('cfirst'));
  A(']Q', () => V.ex('clast'));
  A('[l', c => V.ex(`${c.hasCount ? c.count : ''}lprevious`));
  A(']l', c => V.ex(`${c.hasCount ? c.count : ''}lnext`));
  A('[a', () => V.ex('previous'));
  A(']a', () => V.ex('next'));
  A('[ ', c => {
    const l = cur().line;
    V.insertLines(l, Array(c.count).fill(''));
    V.setCursor(pos(l + c.count, cur().col));
  }, { change: true });
  A('] ', c => {
    V.insertLines(cur().line + 1, Array(c.count).fill(''));
  }, { change: true });

  installVisual(V, { swapCase, rot13, putValue, runOp });
}

// ---- visual-mode actions --------------------------------------------------------------------------------------

function installVisual(V: Vim, h: {
  swapCase: (s: string) => string;
  rot13: (s: string) => string;
  putValue: (v: RegValue, after: boolean, gp: boolean, count: number) => void;
  runOp: (keys: string, r: Range, c: ActionCtx) => void;
}) {
  const A = (keys: string, run: (c: ActionCtx) => void, change = false) => V.defineAction(keys, { run, change }, ['v']);
  const ln = (n = V.cursor.line) => V.line(n);
  const take = () => {
    const r = V.visualRange();
    const kind = V.visual!.kind;
    V.exitVisual();
    return { r, kind };
  };

  A('<Esc>', () => V.exitVisual());
  A('<C-c>', () => V.exitVisual());
  A('o', () => {
    const v = V.visual!;
    const a = v.anchor;
    v.anchor = { ...V.cursor };
    V.win.cursor = { ...a };
    V.win.want = a.col;
  });
  A('O', () => {
    const v = V.visual!;
    if (v.kind !== '<C-v>') return V.getAction('o', 'v')!.run({ count: 1, hasCount: false, reg: null, arg: '', keys: 'o' });
    const ac = v.anchor.col;
    v.anchor = pos(v.anchor.line, V.cursor.col);
    V.win.cursor = pos(V.cursor.line, ac);
    V.win.want = ac;
  });
  // Operators without motions in visual mode.
  const asOp = (op: string) => (c: ActionCtx) => {
    const { r } = take();
    V.setCursor(r.start);
    h.runOp(op, r, c);
  };
  A('x', asOp('d'), true);
  A('<Del>', asOp('d'), true);
  A('s', asOp('c'), true);
  A('X', c => { const { r } = take(); h.runOp('d', r.kind === 'block' ? { ...r, toEol: true } : { start: pos(r.start.line, 0), end: pos(r.end.line, 0), kind: 'line' }, c); }, true);
  A('D', c => { const { r } = take(); h.runOp('d', r.kind === 'block' ? { ...r, toEol: true } : { start: pos(r.start.line, 0), end: pos(r.end.line, 0), kind: 'line' }, c); }, true);
  A('Y', c => { const { r } = take(); h.runOp('y', r.kind === 'block' ? { ...r, toEol: true } : { start: pos(r.start.line, 0), end: pos(r.end.line, 0), kind: 'line' }, c); });
  A('C', c => { const { r } = take(); h.runOp('c', r.kind === 'block' ? { ...r, toEol: true } : { start: pos(r.start.line, 0), end: pos(r.end.line, 0), kind: 'line' }, c); }, true);
  A('S', c => { const { r } = take(); h.runOp('c', { start: pos(r.start.line, 0), end: pos(r.end.line, 0), kind: 'line' }, c); }, true);
  A('R', c => V.getAction('S', 'v')!.run(c), true);
  A('u', asOp('gu'), true);
  A('U', asOp('gU'), true);
  A('~', asOp('g~'), true);
  A('J', c => {
    const { r } = take();
    V.setCursor(pos(r.start.line, 0));
    V.getAction('J')!.run({ ...c, count: Math.max(2, r.end.line - r.start.line + 1) });
  }, true);
  A('gJ', c => {
    const { r } = take();
    V.setCursor(pos(r.start.line, 0));
    V.getAction('gJ')!.run({ ...c, count: Math.max(2, r.end.line - r.start.line + 1) });
  }, true);
  A('r', c => {
    const { r } = take();
    const ch = c.arg;
    for (let l = r.start.line; l <= r.end.line; l++) {
      const t = ln(l);
      let s = 0, e = t.length - 1;
      if (r.kind === 'char') { s = l === r.start.line ? r.start.col : 0; e = l === r.end.line ? r.end.col : t.length - 1; }
      if (r.kind === 'block') { s = Math.min(r.start.col, r.end.col); e = r.toEol ? t.length - 1 : Math.max(r.start.col, r.end.col); }
      e = Math.min(e, t.length - 1);
      if (e < s) continue;
      V.buf.setLine(l, t.slice(0, s) + ch.repeat(e - s + 1) + t.slice(e + 1));
    }
    V.buf.recordChange(r.start);
    V.setCursor(r.kind === 'line' ? pos(r.start.line, 0) : pos(r.start.line, r.kind === 'block' ? Math.min(r.start.col, r.end.col) : r.start.col));
  }, true);
  V.defineAction('r', { ...V.getAction('r', 'v')!, arg: 'char', change: true }, ['v']);

  // Visual p/P (Neovim's nv_put in Visual mode): delete the selection (into the unnamed register for p;
  // P keeps it), then put the register in its place. Every selection kind takes a count.
  const putOver = (keepReg: boolean) => (c: ActionCtx) => {
    const v = V.getRegister(c.reg);
    const vcur = { ...V.cursor };
    const { r } = take();
    const n = c.count;
    const whole = r.kind === 'line' && r.start.line === 0 && r.end.line === V.buf.lineCount - 1;
    const removed = V.deleteRange(r);
    if (!keepReg) V.registers.delete(null, removed);
    const times = (xs: string[]) => Array.from({ length: n }, () => xs).flat();
    const asLines = () => (v.kind === 'line' ? v.text.replace(/\n$/, '') : v.text).split('\n');
    const putLines = (at: number) => {
      const lines = times(asLines());
      if (whole) V.buf.splice(0, V.buf.lineCount, lines);
      else V.insertLines(at, lines);
      V.setCursor(firstNonBlankPos(V.lines, at));
    };
    const c1 = r.kind === 'block' ? Math.min(r.start.col, r.end.col) : r.start.col;
    /** Put at the deletion point, which may sit on the end-of-line. */
    const putAt = (p: Pos) => {
      if (v.kind === 'block') {
        V.win.cursor = { ...p };
        h.putValue(v, false, false, n);
        return;
      }
      const text = v.text.repeat(n);
      const end = V.insertText(p, text);
      V.setCursor(text.includes('\n') ? p : pos(end.line, Math.max(0, end.col - 1)));
    };
    if (r.kind === 'line') return putLines(r.start.line);
    if (r.kind === 'char') {
      if (v.kind !== 'line') return putAt(r.start);
      // Lines into a charwise selection: split the line around them.
      const t = ln(r.start.line);
      V.buf.splice(r.start.line, 1, [t.slice(0, c1), ...times(asLines()), t.slice(c1)]);
      V.setCursor(firstNonBlankPos(V.lines, r.start.line + 1));
      return;
    }
    // Block selection. Lines go below the line the Visual cursor was on (p) or above the block (P).
    if (v.kind === 'line') return putLines(keepReg ? r.start.line : vcur.line + 1);
    if (v.kind === 'char' && !v.text.includes('\n')) {
      // One line of text goes into every line of the block; lines ending before the block are skipped.
      const text = v.text.repeat(n);
      for (let l = r.start.line; l <= r.end.line; l++) {
        const t = ln(l);
        if (t.length < c1) continue;
        V.buf.setLine(l, t.slice(0, c1) + text + t.slice(c1));
      }
      V.buf.recordChange(pos(r.start.line, c1));
      V.setCursor(pos(r.start.line, c1 + Math.max(0, text.length - 1)));
      return;
    }
    putAt(pos(r.start.line, c1));
  };
  A('p', putOver(false), true);
  A('P', putOver(true), true);

  const blockInsert = (append: boolean) => (c: ActionCtx) => {
    const v = V.visual!;
    const r = V.visualRange();
    if (v.kind === '<C-v>') {
      const toEol = v.toEol;
      V.exitVisual();
      const col = append ? (toEol ? ln(r.start.line).length : Math.max(r.start.col, r.end.col) + 1) : Math.min(r.start.col, r.end.col);
      V.startInsert(append ? 'A' : 'I', pos(r.start.line, col), 1, { block: { first: r.start.line, last: r.end.line, col, append, toEol } });
      return;
    }
    V.exitVisual();
    if (v.kind === 'V') {
      V.startInsert(append ? 'A' : 'I', append ? pos(r.end.line, ln(r.end.line).length) : pos(r.start.line, firstNonBlank(ln(r.start.line))), c.count);
    } else {
      V.startInsert(append ? 'A' : 'I', append ? pos(r.end.line, r.end.col + 1) : r.start, c.count);
    }
  };
  A('I', blockInsert(false), true);
  A('A', blockInsert(true), true);

  const incr = (delta: number, progressive: boolean) => (c: ActionCtx) => {
    const { r } = take();
    let step = 0;
    for (let l = r.start.line; l <= r.end.line; l++) {
      const t = ln(l);
      const from = r.kind === 'line' ? 0 : r.kind === 'block' ? Math.min(r.start.col, r.end.col) : l === r.start.line ? r.start.col : 0;
      const m = /-?\d+/.exec(t.slice(from));
      if (!m) continue;
      step++;
      const s = from + m.index;
      let num = m[0];
      let start = s;
      if (num.startsWith('-') && s > 0 && /\w/.test(t[s - 1])) { num = num.slice(1); start++; }
      const n = parseInt(num, 10) + delta * c.count * (progressive ? step : 1);
      V.buf.setLine(l, t.slice(0, start) + String(n) + t.slice(start + num.length));
    }
    V.buf.recordChange(r.start);
    V.setCursor(pos(r.start.line, r.kind === 'block' ? Math.min(r.start.col, r.end.col) : r.kind === 'char' ? r.start.col : 0));
  };
  A('<C-a>', incr(1, false), true);
  A('<C-x>', incr(-1, false), true);
  A('g<C-a>', incr(1, true), true);
  A('g<C-x>', incr(-1, true), true);

  A('gq', c => asOp('gq')(c), true);
  void h.swapCase; void h.rot13; void h.putValue; void keysToRegister; void registerToKeys;
}

function pos(line: number, col: number): Pos {
  return { line, col };
}
