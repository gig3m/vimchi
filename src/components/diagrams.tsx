// Small explanatory diagrams for lesson prose. Each one runs the real engine,
// so what it shows is exactly what the practice editor will do.

import { type ReactNode, useMemo } from 'react';
import { Vim } from '../vim/editor';
import { displayKey, parseKeys } from '../vim/keys';
import { BLANK, charClass } from '../vim/text';
import { align } from '../lessons/goalDiff';

// ---- words ------------------------------------------------------------------------------------

/**
 * Numbered boxes under each word (or WORD with `big`) of a line of text:
 * "what counts as a word".
 */
export function Words({ text, big = false, caption }: { text: string; big?: boolean; caption?: ReactNode }) {
  const segs = useMemo(() => {
    const out: { start: number; end: number }[] = [];
    let i = 0;
    while (i < text.length) {
      const k = charClass(text[i], big);
      if (k === BLANK) { i++; continue; }
      let j = i;
      while (j + 1 < text.length && charClass(text[j + 1], big) === k) j++;
      out.push({ start: i, end: j });
      i = j + 1;
    }
    return out;
  }, [text, big]);
  return (
    <figure className="dg">
      <div className="dg-line">{text}</div>
      <div className="dg-line dg-boxes">
        {segs.map((s, n) => (
          <span key={n} className="dg-box" style={{ left: `calc(${s.start}ch + 1px)`, width: `calc(${s.end - s.start + 1}ch - 2px)` }}><small>{n + 1}</small></span>
        ))}
        {text.replace(/./g, ' ')}
      </div>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

// ---- motions ------------------------------------------------------------------------------------

type Landing = { key: string; col: number; line: number };

function runFrom(lines: string[], cursor: number | [number, number], keys: string, name = 'diagram.txt'): Vim {
  const vim = new Vim({ text: lines.join('\n'), name });
  const [line, col] = typeof cursor === 'number' ? [0, cursor] : cursor;
  vim.win.cursor = { line, col };
  vim.win.want = col;
  vim.feedKeys(keys);
  return vim;
}

/**
 * Where each motion lands from the cursor. `keys` are applied independently
 * from the start, or one after another with `chain`.
 */
export function Motions({ text, cursor, keys, chain = false, caption }: {
  text: string;
  cursor: number;
  keys: string[];
  chain?: boolean;
  caption?: ReactNode;
}) {
  const marks = useMemo(() => {
    const out: Landing[] = [];
    // A chain runs in one editor, so ; and , can repeat an earlier f/t.
    const shared = chain ? runFrom([text], cursor, '') : null;
    for (const k of keys) {
      const v = shared ?? runFrom([text], cursor, '');
      v.feedKeys(k);
      out.push({ key: k, col: v.cursor.col, line: 0 });
    }
    return out;
  }, [text, cursor, keys, chain]);
  return (
    <figure className="dg">
      <div className="dg-line">
        {[...text].map((ch, i) => (
          <span key={i} className={i === cursor ? 'dg-cursor' : marks.some(m => m.col === i) ? 'dg-land' : undefined}>{ch}</span>
        ))}
      </div>
      <div className="dg-line dg-labels">
        {marks.map((m, i) => (
          <span key={i} className="dg-label" style={{ left: `${m.col}ch`, top: `${(labelRow(marks, i)) * 1.5}em` }}>
            <small>↑{chain ? `${i + 1}` : ''} <b>{m.key}</b></small>
          </span>
        ))}
        {' '}
      </div>
      <div style={{ height: `${Math.max(0, ...marks.map((_, i) => labelRow(marks, i))) * 1.5}em` }} />
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

/** Stack labels that would overlap. */
function labelRow(marks: Landing[], i: number) {
  let row = 0;
  for (let j = 0; j < i; j++) if (Math.abs(marks[j].col - marks[i].col) < marks[j].key.length + 4) row = Math.max(row, labelRow(marks, j) + 1);
  return row;
}

// ---- text objects -------------------------------------------------------------------------------

/**
 * What each text object selects from the cursor, one row per object:
 * e.g. objects={['i(', 'a(']}.
 */
export function Objects({ text, cursor, objects, caption }: { text: string; cursor: number; objects: string[]; caption?: ReactNode }) {
  const rows = useMemo(() => objects.map(o => {
    const v = runFrom([text], cursor, 'v' + o);
    if (!v.visual) return { o, start: -1, end: -1 };
    const r = v.visualRange();
    return { o, start: r.start.col, end: r.end.col };
  }), [text, cursor, objects]);
  return (
    <figure className="dg">
      {rows.map(r => (
        <div key={r.o} className="dg-row">
          <span className="dg-key">{r.o}</span>
          <span className="dg-line">
            {[...text].map((ch, i) => (
              <span key={i} className={(i >= r.start && i <= r.end ? 'dg-sel' : '') + (i === cursor ? ' dg-cursor-ring' : '')}>{ch}</span>
            ))}
          </span>
        </div>
      ))}
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

// ---- before / after -----------------------------------------------------------------------------

export type KeySeg = { kind: 'key'; key: string } | { kind: 'text'; text: string };

/**
 * Split keys into commands and typed text by replaying them: characters typed
 * in insert mode or on the command line become one text run, not a chip each.
 */
export function segmentKeys(vim: Vim, keys: string): KeySeg[] {
  const segs: KeySeg[] = [];
  let chip = '';
  const flush = () => { if (chip) { segs.push({ kind: 'key', key: chip }); chip = ''; } };
  for (const k of parseKeys(keys)) {
    const typing = vim.mode === 'insert' || vim.mode === 'replace' || vim.mode === 'cmdline';
    if (typing && k.length === 1) {
      flush();
      const last = segs[segs.length - 1];
      if (last && last.kind === 'text') last.text += k;
      else segs.push({ kind: 'text', text: k });
      vim.feed(k);
      continue;
    }
    // Normal-mode keys join into one chip per complete command: "dd", "\"0P", "ciw".
    chip += displayKey(k);
    const special = k.length > 1;
    vim.feed(k);
    const done = vim.pending.length === 0;
    if (special || done) flush();
  }
  flush();
  return segs;
}

export function KeyRow({ segs }: { segs: KeySeg[] }) {
  return (
    <div className="dg-keys">
      {segs.map((s, i) => s.kind === 'key'
        ? <span key={i} className="kbd kbd-sm">{displayKey(s.key)}</span>
        : <span key={i} className="dg-typed" title="typed text">{s.text.replace(/^ | $/g, '␣')}</span>)}
    </div>
  );
}

/** Lines of `after` that aren't just `before` lines moved down or up. */
function changedLines(before: readonly string[], after: readonly string[]) {
  const kept = new Set(align(before, after).map(([, j]) => j));
  return new Set(after.map((_, j) => j).filter(j => !kept.has(j)));
}

/**
 * Lines of `before` that are gone rather than edited: within each block of
 * differences, the before-lines beyond those paired with after-lines.
 */
function deletedLines(before: readonly string[], after: readonly string[]) {
  const out = new Set<number>();
  let bi = 0, ai = 0;
  const hunk = (bEnd: number, aEnd: number) => {
    const paired = Math.min(bEnd - bi, aEnd - ai);
    for (let k = bi + paired; k < bEnd; k++) out.add(k);
  };
  for (const [b, a] of align(before, after)) {
    hunk(b, a);
    bi = b + 1;
    ai = a + 1;
  }
  hunk(before.length, after.length);
  return out;
}

export function DgBlock({ lines, cursor, changed, removed, label }: { lines: readonly string[]; cursor: { line: number; col: number }; changed?: Set<number>; removed?: Set<number>; label: string }) {
  return (
    <div className="dg-block">
      <div className="dg-block-label">{label}</div>
      {lines.map((t, l) => (
        <div key={l} className={'dg-line' + (changed?.has(l) ? ' dg-changed' : '') + (removed?.has(l) ? ' dg-removed' : '')}>
          {t.length ? [...t].map((ch, i) => <span key={i} className={l === cursor.line && i === cursor.col ? 'dg-cursor' : undefined}>{ch}</span>)
            : <span className={l === cursor.line ? 'dg-cursor' : undefined}> </span>}
        </div>
      ))}
    </div>
  );
}

/**
 * Shows a buffer, the keys typed, and the result (computed by the engine).
 * `cursor` is [line, col] (or a column on the first line).
 */
export function BeforeAfter({ lines, cursor, keys, caption, name }: {
  lines: string[];
  cursor: number | [number, number];
  keys: string;
  caption?: ReactNode;
  /** File name for filetype-dependent behaviour (gc comment style, = indent). */
  name?: string;
}) {
  const { after, segs } = useMemo(() => {
    const v = runFrom(lines, cursor, '', name);
    const segs = segmentKeys(v, keys);
    return { after: v, segs };
  }, [lines, cursor, keys, name]);
  const [cl, cc] = typeof cursor === 'number' ? [0, cursor] : cursor;
  const changed = changedLines(lines, after.buf.lines);
  const removed = deletedLines(lines, after.buf.lines);
  return (
    <figure className="dg dg-ba">
      <KeyRow segs={segs} />
      <div className="dg-ba-pair">
        <DgBlock lines={lines} cursor={{ line: cl, col: cc }} removed={removed} label="before" />
        <span className="dg-arrow">→</span>
        <DgBlock lines={after.buf.lines} cursor={after.cursor} changed={changed} label="after" />
      </div>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}
