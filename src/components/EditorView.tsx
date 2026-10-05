// Renders a Vim instance: tab line, split windows, status lines, command
// line, floating windows and the tutor's overlays (targets, marks).

import { type CSSProperties, type ReactNode, useLayoutEffect, useRef } from 'react';
import type { Decoration, Float, Vim } from '../vim/editor';
import { displayKey } from '../vim/keys';
import type { Window } from '../vim/layout';
import { type Pos, cmpPos } from '../vim/types';
import { C, colorize } from '../ui/syntax';
import type { Annotations } from '../lessons/goalDiff';
import { cellWidths, displayWidth } from './tabs';

export type Overlay = {
  target: Pos | null;
  /** "line:col" → hint ('' for a red strike-through, a letter for an orange replace hint). */
  marks: Map<string, string>;
  markKind: 'fix' | 'replace' | null;
  brokenLines: Set<number>;
  /** Inline goal annotations (what to add and remove). */
  ann?: Annotations | null;
};

type Props = {
  vim: Vim;
  focused: boolean;
  overlay: Overlay;
  status: { keys: number; time: string };
  /** A tutor message shown in the command-line row (e.g. "Arrow keys are off"). */
  note?: { text: string; kind: string } | null;
};

const MODE_LABEL: Record<string, string> = {
  normal: 'NORMAL', insert: 'INSERT', replace: 'REPLACE', visual: 'VISUAL', cmdline: 'COMMAND', confirm: 'CONFIRM', prompt: 'PROMPT',
};
const MODE_BG: Record<string, string> = {
  NORMAL: C.purple, INSERT: C.green, REPLACE: C.red, VISUAL: C.orange, 'V-LINE': C.orange, 'V-BLOCK': C.orange, COMMAND: C.yellow, CONFIRM: C.yellow, 'O-PENDING': C.purple,
};

export function modeLabel(vim: Vim) {
  if (vim.visual) return vim.visual.kind === 'v' ? 'VISUAL' : vim.visual.kind === 'V' ? 'V-LINE' : 'V-BLOCK';
  if (vim.mode === 'normal' && vim.insert) return '(insert)';
  return MODE_LABEL[vim.mode] ?? 'NORMAL';
}

export function EditorView({ vim, focused, overlay, status, note }: Props) {
  const panes = useRef<HTMLDivElement>(null);
  // Scroll sideways so the cursor and the target stay visible on long lines.
  useLayoutEffect(() => {
    const el = panes.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    const box = el.getBoundingClientRect();
    const margin = 48;
    for (const sel of ['[data-target]', '[data-cursor]']) {
      const c = el.querySelector(sel);
      if (!c) continue;
      const r = c.getBoundingClientRect();
      if (r.right > box.right - margin) el.scrollLeft += r.right - box.right + margin;
      else if (r.left < box.left + 60) el.scrollLeft -= box.left + 60 - r.left;
    }
  });
  const tab = vim.tab;
  const wins = tab.windows();
  const multi = wins.length > 1;
  const rowPx = multi ? 24 : 30;
  const rows = vim.screenRows;
  const rects = tab.layoutFor(rows, 120);
  // Keep every window's scroll position valid after layout changes.
  for (const w of wins) if (w !== vim.win) clampTop(vim, w);
  vim.scrollToCursor();

  const totalHeight = rows * rowPx;
  return (
    <div className="ev" style={{ '--row': rowPx + 'px' } as CSSProperties}>
      {vim.tabs.length > 1 && (
        <div className="ev-tabline">
          {vim.tabs.map((t, i) => (
            <span key={i} className={'ev-tab' + (i === vim.tabIdx ? ' on' : '')}>
              {t.windows().length > 1 ? t.windows().length + ' ' : ''}
              {shortName(t.cur.buf.name)}
            </span>
          ))}
        </div>
      )}
      <div ref={panes} className={'ev-panes' + (multi ? ' multi' : '')} style={multi ? { height: totalHeight } : undefined}>
        {wins.map(w => {
          const r = rects.get(w)!;
          const style: CSSProperties = multi
            ? { position: 'absolute', top: r.top * rowPx, left: `${(r.left / 120) * 100}%`, width: `calc(${(r.width / 120) * 100}% - ${r.left + r.width < 120 ? 1 : 0}px)`, height: r.height * rowPx }
            : {};
          return (
            <Pane key={w.id} vim={vim} win={w} current={w === vim.win} focused={focused} overlay={w === vim.win ? overlay : null}
              style={style} textRows={multi ? r.height - 1 : rows} multi={multi} status={status} />
          );
        })}
        {vim.floats.map(f => <FloatBox key={f.id} f={f} vim={vim} rowPx={rowPx} />)}
        {vim.insert?.completion && focused && <Completion vim={vim} rowPx={rowPx} />}
      </div>
      {!multi && <StatusLine vim={vim} win={vim.win} current status={status} />}
      <CmdLine vim={vim} note={note ?? null} focused={focused} />
    </div>
  );
}

function clampTop(vim: Vim, w: Window) {
  const rows = vim.visibleLines(w);
  if (!rows.includes(w.top)) w.top = rows[0] ?? 0;
}

const shortName = (n: string) => n.split('/').pop() || n;

// ---- a window ----------------------------------------------------------------------------------------

type PaneProps = {
  vim: Vim;
  win: Window;
  current: boolean;
  focused: boolean;
  overlay: Overlay | null;
  style: CSSProperties;
  textRows: number;
  multi: boolean;
  status: { keys: number; time: string };
};

function Pane({ vim, win, current, focused, overlay, style, textRows, multi, status }: PaneProps) {
  const buf = win.buf;
  const visible = vim.visibleLines(win);
  const topIdx = Math.max(0, visible.indexOf(win.top));
  const shown = visible.slice(topIdx, topIdx + textRows);
  const numbers = (win.opts.number ?? vim.options.number) as boolean;
  const rel = (win.opts.relativenumber ?? vim.options.relativenumber) as boolean;
  const numWidth = Math.max(3, String(buf.lineCount).length + 1);
  const decos = vim.decorators.map(d => d(buf, win)).filter(Boolean) as Decoration[];
  const signs = new Map<number, { text: string; color: string }>();
  const virt = new Map<number, { text: string; color: string }>();
  const lineBg = new Map<number, string>();
  for (const d of decos) {
    d.signs?.forEach((v, k) => signs.set(k, v));
    d.virt?.forEach((v, k) => virt.set(k, v));
    d.lineBg?.forEach((v, k) => lineBg.set(k, v));
  }
  const virtLines = new Map<number, { text: string; color?: string; bg?: string }[]>();
  const conceal = new Map<number, number>();
  for (const d of decos) {
    d.virtLines?.forEach((v, k) => virtLines.set(k, [...(virtLines.get(k) ?? []), ...v]));
    d.conceal?.forEach((v, k) => conceal.set(k, v));
  }
  const pushVirt = (l: number) => virtLines.get(l)?.forEach((v, i) => rowsOut.push(
    <div key={`v${l}:${i}`} className="ev-row" style={{ background: v.bg }}>
      {(numbers || rel) && <span className="ev-gutter" style={{ width: `${numWidth + 1}ch` }} />}
      {hasSigns && <span className="ev-sign" />}
      <span className="ev-text" style={{ color: v.color }}>{v.text || ' '}</span>
    </div>,
  ));
  const hasSigns = signs.size > 0;

  // Search highlights.
  const hl = vim.hlActive && vim.options.hlsearch && vim.search.pattern ? vim.matches(vim.search.pattern, buf, { noSmartcase: vim.search.noSmartcase }) : [];
  const inc = current ? vim.incsearchPos : null;
  const visualRange = current && vim.visual ? vim.visualRange() : null;
  const cur = win.cursor;
  const cursorVisible = current && vim.mode !== 'cmdline';
  const insertish = current && (vim.mode === 'insert' || vim.mode === 'replace');

  const rowsOut: ReactNode[] = [];
  const ts = Number(vim.options.tabstop) || 8;
  shown.forEach((l, rowIdx) => {
    pushVirt(l);
    // Insert hints float just above their row. The single pane has headroom for its first row;
    // a multi-pane window clips above its first row, so that row shows no hint (owner ruling:
    // no hint beats a hint that reads as belonging to the wrong line).
    const hintRow = !(multi && rowIdx === 0);
    const fold = vim.closedFoldAt(l, win);
    const isCurLine = l === cur.line || (fold && cur.line >= fold.start && cur.line <= fold.end);
    const num = rel && !isCurLine ? Math.abs(visible.indexOf(l) - visible.indexOf(fold ? fold.start : cur.line)) : l + 1;
    const numColor = overlay?.brokenLines.has(l) ? C.red : isCurLine && current ? C.yellow : C.comment;
    const gutter = numbers || rel ? (
      <span className="ev-gutter" style={{ width: `${numWidth + 1}ch`, color: numColor }}>
        {rel && isCurLine && numbers ? String(l + 1).padEnd(numWidth - 1) : num}
      </span>
    ) : null;
    const sign = hasSigns ? <span className="ev-sign" style={{ color: signs.get(l)?.color }}>{signs.get(l)?.text ?? ' '}</span> : null;
    if (fold) {
      const n = fold.end - fold.start + 1;
      const text = `+--${String(n).padStart(3)} lines: ${buf.line(fold.start).trim()}`;
      rowsOut.push(
        <div key={l} className={'ev-row ev-fold' + (isCurLine && current ? ' cur' : '')}>
          {gutter}{sign}
          <span className="ev-text">
            {current && isCurLine && vim.mode !== 'cmdline' ? <span className={focused ? 'ev-cursor' : 'ev-cursor-hollow'}>{text[0]}</span> : text[0]}
            {text.slice(1)}
            <span className="ev-fold-fill">{'·'.repeat(60)}</span>
          </span>
        </div>,
      );
      return;
    }
    const t = buf.line(l);
    const cols = colorize(t, buf.filetype);
    const chars = t.length ? [...t] : [];
    const widths = cellWidths(t, ts);
    const cells: ReactNode[] = [];
    const nCells = Math.max(chars.length, insertish && isCurLine ? cur.col + 1 : 0, 1);
    for (let c = conceal.get(l) ?? 0; c < nCells; c++) {
      const ch = chars[c] ?? ' ';
      const here = { line: l, col: c };
      let color = chars[c] !== undefined ? cols[c] : C.fg;
      let bg = 'transparent', shadow = 'none', deco = 'none', hint = '';
      if (ch === '\t') { /* rendered as spaces below */ }
      for (const m of hl) {
        if (cmpPos(m.start, here) <= 0 && cmpPos(here, m.end) <= 0 && chars[c] !== undefined) { bg = 'rgba(241,250,140,.28)'; break; }
      }
      if (inc && cmpPos(inc.start, here) <= 0 && cmpPos(here, inc.end) <= 0) { bg = C.orange; color = C.bg; }
      let over: string | undefined;
      for (const d of decos) for (const h of d.hl ?? []) if (!h.inline && h.line === l && c >= h.start && c < h.end) { color = h.color; if (h.bg) bg = h.bg; if (h.text) over = h.text[c - h.start]; }
      if (overlay) {
        const mk = overlay.marks.get(`${l}:${c}`);
        if (mk !== undefined) {
          if (overlay.markKind === 'fix') { bg = 'rgba(255,85,85,.22)'; color = C.red; deco = 'line-through'; }
          else { bg = 'rgba(255,184,108,.22)'; color = C.orange; hint = mk; }
        }
        const ann = overlay.ann;
        if (ann && chars[c] !== undefined && (ann.delLines.has(l) || ann.del.get(l)?.some(([a, b]) => c >= a && c <= b))) {
          bg = 'rgba(255,85,85,.2)'; color = C.red; deco = 'line-through';
        }
        if (overlay.target && overlay.target.line === l && overlay.target.col === c) {
          bg = 'rgba(80,250,123,.14)'; shadow = 'inset 0 0 0 2px #50fa7b'; color = C.green;
        }
      }
      // The selection wins over goal marks: in a lesson the text you select is usually the struck text.
      if (visualRange && inVisual(visualRange, here, t.length)) { bg = VISUAL_BG; shadow = 'none'; }
      const isCursor = current && cursorVisible && cur.line === l && cur.col === c && vim.mode !== 'cmdline' && vim.mode !== 'confirm';
      let cls = 'cell';
      // In insert mode the caret is its own element, placed before any ghost text at this column.
      const caretHere = isCursor && insertish && vim.mode === 'insert';
      // Ghost text (goal diff) at this column: the text to insert before this cell.
      const ghostsHere = overlay?.ann ? (overlay.ann.ins.get(l) ?? []).filter(tag => {
        const span = overlay.ann!.del.get(l)?.find(([a]) => a === tag.col);
        return (span ? span[1] + 1 : tag.col) === c;
      }) : [];
      if (isCursor) {
        if (caretHere) { /* drawn below */ }
        else if (focused) {
          bg = overlay?.marks.has(`${l}:${c}`) ? (overlay.markKind === 'fix' ? C.red : C.orange) : C.fg;
          color = C.bg;
          shadow = 'none';
          cls += ' ev-block';
          if (vim.mode === 'replace') { bg = 'transparent'; color = C.fg; cls += ' ev-under'; }
        } else shadow = 'inset 0 0 0 1px ' + C.fg;
      }
      if (caretHere) cells.push(<span key={`caret${c}`} className={'ev-caret' + (focused ? '' : ' dim')} />);
      if (hintRow) ghostsHere.forEach((tag, gi) => cells.push(<InsertHint key={`g${c}-${gi}`} text={tag.text} />));
      for (const d of decos) for (const h of d.hl ?? []) if (h.inline && h.line === l && h.start === c) cells.push(<span key={`i${c}-${cells.length}`} className="cell" style={{ color: h.color, background: h.bg }}>{h.text}</span>);
      cells.push(
        <span key={c} className={cls} style={{ color, background: bg, boxShadow: shadow, textDecoration: deco }}
          data-cursor={isCursor || undefined} data-target={(overlay?.target && overlay.target.line === l && overlay.target.col === c) || undefined}>
          {over ?? (ch === '\t' ? ' '.repeat(widths[c] ?? ts) : ch === '\0' ? '^@' : ch.charCodeAt(0) < 32 ? '^' + String.fromCharCode(ch.charCodeAt(0) + 64) : ch)}
          {hint && <span className="hint">{hint}</span>}
        </span>,
      );
    }
    for (const d of decos) for (const h of d.hl ?? []) if (h.inline && h.line === l && h.start >= nCells) cells.push(<span key={`i${h.start}-${cells.length}`} className="cell" style={{ color: h.color, background: h.bg }}>{h.text}</span>);
    for (const tag of overlay?.ann?.ins.get(l) ?? []) {
      const span = overlay!.ann!.del.get(l)?.find(([a]) => a === tag.col);
      const at = span ? span[1] + 1 : tag.col;
      if (at >= nCells && hintRow) cells.push(<InsertHint key={`ge${at}`} text={tag.text} />);
    }
    const v = virt.get(l);
    rowsOut.push(
      <div key={l} className={'ev-row' + (isCurLine && current && vim.options.cursorline ? ' cur' : '')} style={lineBg.has(l) ? { background: lineBg.get(l) } : undefined}>
        {gutter}{sign}
        <span className="ev-text">
          {cells}
          {v && <span className="ev-virt" style={{ color: v.color }}>  {v.text}</span>}
          {overlay?.ann && <AnnMarks ann={overlay.ann} line={l} text={t} next={buf.line(l + 1)} first={l === 0} tabstop={ts} />}
        </span>
      </div>,
    );
  });
  if (shown[shown.length - 1] === buf.lineCount - 1) pushVirt(buf.lineCount);
  for (let i = rowsOut.length; multi && i < textRows; i++) {
    rowsOut.push(<div key={'~' + i} className="ev-row"><span className="ev-tilde">~</span></div>);
  }
  return (
    <div className={'ev-pane' + (multi ? ' multi' : '') + (current ? ' current' : '')} style={style}>
      <div className="ev-lines">{rowsOut}</div>
      {multi && <StatusLine vim={vim} win={win} current={current} status={status} compact />}
    </div>
  );
}

/** Visual selection: brighter than Dracula's #44475a, which vanishes on the cursorline. */
const VISUAL_BG = 'rgba(189,147,249,.42)';

function inVisual(r: ReturnType<Vim['visualRange']>, p: Pos, lineLen: number) {
  if (p.line < r.start.line || p.line > r.end.line) return false;
  if (r.kind === 'line') return true;
  if (r.kind === 'block') {
    const c1 = Math.min(r.start.col, r.end.col), c2 = Math.max(r.start.col, r.end.col);
    return p.col >= c1 && (r.toEol ? p.col < Math.max(lineLen, 1) : p.col <= c2);
  }
  return cmpPos(r.start, p) <= 0 && cmpPos(p, r.end) <= 0;
}

// ---- status & command lines ----------------------------------------------------------------------------

function StatusLine({ vim, win, current, status, compact }: { vim: Vim; win: Window; current: boolean; status: { keys: number; time: string }; compact?: boolean }) {
  const mode = modeLabel(vim);
  const pending = current ? vim.pending.map(displayKey).join('') : '';
  const name = win.buf.name + (win.buf.modified ? ' [+]' : '');
  if (compact && !current) {
    return (
      <div className="ev-status dim">
        <span className="seg-dim">{name}</span>
        <span className="grow" />
        <span>{win.cursor.line + 1}:{win.cursor.col + 1}</span>
      </div>
    );
  }
  return (
    <div className={'ev-status' + (compact ? ' compact' : '')}>
      <span className="mode" style={{ background: MODE_BG[mode] ?? C.purple }}>{mode.replace('(insert)', '-- (insert) --')}</span>
      <span className="seg">{name}</span>
      {vim.recording && <span className="rec">recording @{vim.recording.reg}</span>}
      <span className="grow" />
      <span className="pending">{pending}</span>
      <span className="stat-extra">{status.keys} keys</span>
      <span className="stat-extra">{status.time}</span>
      <span className="seg">{win.cursor.line + 1}:{win.cursor.col + 1}</span>
    </div>
  );
}

function CmdLine({ vim, note, focused }: { vim: Vim; note: { text: string; kind: string } | null; focused: boolean }) {
  const cl = vim.cmdline;
  let content: ReactNode;
  let kind = '';
  if (!cl && note) {
    content = note.text;
    kind = note.kind;
  } else if (!cl && !vim.confirm && !vim.message && !focused) {
    content = '-- editor not focused --';
  } else if (cl) {
    const lead = cl.type === 'input' ? cl.prompt ?? '' : cl.type === '=' ? '=' : cl.type;
    content = (
      <>
        {lead}
        {cl.text.slice(0, cl.cursor)}
        <span className="ev-cmd-cursor">{cl.text[cl.cursor] ?? ' '}</span>
        {cl.text.slice(cl.cursor + 1)}
      </>
    );
  } else if (vim.confirm) {
    content = vim.confirm.prompt;
    kind = 'warn';
  } else if (vim.message) {
    content = vim.message.text.split('\n').length > 1 ? '' : vim.message.text;
    kind = vim.message.kind;
  } else if (vim.mode === 'insert' || vim.mode === 'replace') {
    content = <span className="ev-mode-msg">-- {vim.mode === 'insert' ? 'INSERT' : 'REPLACE'} --</span>;
  } else if (vim.visual) {
    content = <span className="ev-mode-msg">-- {modeLabel(vim)} --</span>;
  }
  const more = !cl && vim.message && vim.message.text.includes('\n') ? vim.message.text : null;
  return (
    <>
      {more && (
        <div className="ev-more">
          {more.split('\n').map((l, i) => <div key={i}>{l || ' '}</div>)}
          <div className="ev-more-prompt">Press any key to continue</div>
        </div>
      )}
      <div className={'ev-cmdline ' + kind}>{content}</div>
    </>
  );
}

// ---- floats ------------------------------------------------------------------------------------------------

function FloatBox({ f, vim, rowPx }: { f: Float; vim: Vim; rowPx: number }) {
  const width = f.width ?? (f.preview ? 96 : 60);
  let style: CSSProperties;
  if (f.anchor === 'cursor') {
    const visible = vim.visibleLines();
    const row = Math.max(0, visible.indexOf(vim.cursor.line) - Math.max(0, visible.indexOf(vim.win.top))) + 1;
    style = { top: row * rowPx + 4, left: `calc(${vim.cursor.col + 5}ch)`, width: `${Math.min(width, 60)}ch` };
  } else if (f.anchor === 'top') {
    style = { top: 8, left: '50%', transform: 'translateX(-50%)', width: `min(${width}ch, 94%)` };
  } else {
    style = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: `min(${width}ch, 94%)` };
  }
  const list = (
    <div className="ev-float-list">
      {f.prompt && (
        <div className="ev-float-prompt">
          <span className="label">{f.prompt.label}</span>
          {f.prompt.text.slice(0, f.prompt.cursor)}
          <span className="ev-cmd-cursor">{f.prompt.text[f.prompt.cursor] ?? ' '}</span>
          {f.prompt.text.slice(f.prompt.cursor + 1)}
        </div>
      )}
      <div className="ev-float-rows">
        {f.win ? f.win.buf.lines.map((t, i) => {
          const c = f.win!.cursor;
          if (vim.win !== f.win || i !== c.line) return <div key={i} className="ev-float-row">{t || ' '}</div>;
          const bar = vim.mode === 'insert';
          return (
            <div key={i} className="ev-float-row sel">
              {t.slice(0, c.col)}
              <span className={bar ? 'cell ev-bar' : 'ev-cursor'}>{t[c.col] ?? ' '}</span>
              {t.slice(c.col + 1)}
            </div>
          );
        }) : f.lines.map((l, i) => (
          <div key={i} className={'ev-float-row' + (i === f.sel ? ' sel' : '')} style={{ color: l.color, background: i === f.sel ? undefined : l.bg }}>
            {l.text || ' '}
          </div>
        ))}
      </div>
      {f.footer && <div className="ev-float-footer">{f.footer}</div>}
    </div>
  );
  return (
    <div className="ev-float" style={style}>
      {f.title && <div className="ev-float-title">{f.title}</div>}
      {f.preview ? (
        <div className="ev-float-split">
          {list}
          <div className="ev-float-preview">
            {f.preview.title && <div className="ev-float-title sub">{f.preview.title}</div>}
            {f.preview.lines.map((l, i) => (
              <div key={i} className={'ev-float-row' + (i === f.preview!.highlight ? ' hit' : '')}>{l || ' '}</div>
            ))}
          </div>
        </div>
      ) : list}
    </div>
  );
}

function Completion({ vim, rowPx }: { vim: Vim; rowPx: number }) {
  const cp = vim.insert!.completion!;
  const visible = vim.visibleLines();
  const row = Math.max(0, visible.indexOf(vim.cursor.line) - Math.max(0, visible.indexOf(vim.win.top))) + 1;
  const numWidth = Math.max(3, String(vim.buf.lineCount).length + 1) + 1;
  return (
    <div className="ev-pum" style={{ top: row * rowPx + 16, left: `calc(${numWidth + cp.startCol}ch + 4px)` }}>
      {cp.items.slice(0, 8).map((it, i) => (
        <div key={it} className={'ev-pum-row' + (i === cp.idx ? ' sel' : '')}>{it}</div>
      ))}
    </div>
  );
}

/**
 * Text to insert at this point, shown vim-hero style: a dotted marker at the exact
 * insertion boundary and the text in a tag floating just above it. Nothing is drawn as if it
 * were in the buffer.
 */
function InsertHint({ text }: { text: string }) {
  const tag = useRef<HTMLSpanElement>(null);
  // The tag is centred on the insertion point; near either edge of the buffer it would hang
  // outside the editor (a column-0 insert put half of it over the gutter), so nudge it back in.
  useLayoutEffect(() => {
    const el = tag.current;
    const box = el?.closest('.ev-panes');
    if (!el || !box) return;
    el.style.setProperty('--ann-shift', '0px');
    const r = el.getBoundingClientRect(), b = box.getBoundingClientRect();
    const pad = 6;
    const shift = r.left < b.left + pad ? b.left + pad - r.left : r.right > b.right - pad ? b.right - pad - r.right : 0;
    if (shift) el.style.setProperty('--ann-shift', `${shift}px`);
  });
  return (
    <span className="ann-ins" aria-label={`insert ${JSON.stringify(text)} here`}>
      <span className="ann-ins-line" />
      <span ref={tag} className="ann-tag">{text.replace(/ /g, '·')}</span>
    </span>
  );
}

/** Goal annotations drawn over a row: inserted text tags and new-line markers. */
function AnnMarks({ ann, line, text, next, first, tabstop }: { ann: Annotations; line: number; text: string; next: string; first: boolean; tabstop: number }) {
  const out: ReactNode[] = [];
  const marker = (after: number, lines: string[], key: string, above: boolean) => {
    // Screen columns, not characters: a tab-indented line (Go) starts a tab stop in per tab.
    const indent = displayWidth(/^\s*/.exec(lines[0])![0], tabstop);
    const clear = Math.max(displayWidth(text, tabstop), above ? 0 : displayWidth(next, tabstop), indent) + 2;
    out.push(
      <span key={key} className={'ann-newline' + (above ? ' above' : '')} style={{ left: `${indent}ch` }}>
        <span className="ann-dash" style={{ width: `${Math.max(2, clear - indent)}ch` }} />
        <span className="ann-tag">{lines.map((l, i) => <span key={i} className="ann-tag-line">{l.trim() ? l.trim() : '(blank line)'}</span>)}</span>
      </span>,
    );
    void after;
  };
  // An empty line has no characters to strike through, so it gets a tag of its own.
  if (ann.delLines.has(line) && !text) out.push(<span key="d" className="ann-del-blank" aria-label="delete this blank line">(blank line)</span>);
  const nl = ann.newLines.get(line);
  if (nl) marker(line, nl, 'n', false);
  if (first && ann.newLines.get(-1)) marker(-1, ann.newLines.get(-1)!, 'n0', true);
  return <>{out}</>;
}
