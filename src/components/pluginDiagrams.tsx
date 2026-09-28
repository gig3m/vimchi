// Diagrams for plugin lessons. Like diagrams.tsx they run the real engine,
// but with plugins loaded, so surround, exchange, mini.ai and friends show
// exactly what the practice editor will do.

import { type ReactNode, useMemo } from 'react';
import type { Vim } from '../vim/editor';
import { createVim } from '../lessons/runtime';
import type { Pos } from '../vim/types';

type Cursor = number | [number, number];

function run(plugins: string[], name: string, lines: string[], cursor: Cursor, keys: string): Vim {
  const [line, col] = typeof cursor === 'number' ? [0, cursor] : cursor;
  const vim = createVim({ text: lines, name, plugins, cursor: { line, col } });
  vim.feedKeys(keys);
  return vim;
}

const asLines = (t: string | string[]) => (Array.isArray(t) ? t : [t]);

function Block({ lines, cursor, sel, cols }: { lines: readonly string[]; cursor?: Pos; sel?: { start: Pos; end: Pos; line: boolean }; cols?: number }) {
  const inSel = (l: number, c: number) => {
    if (!sel) return false;
    if (l < sel.start.line || l > sel.end.line) return false;
    if (sel.line) return true;
    if (l === sel.start.line && c < sel.start.col) return false;
    if (l === sel.end.line && c > sel.end.col) return false;
    return true;
  };
  return (
    <div className="dg-block" style={cols ? { minWidth: `calc(${cols}ch + 24px)` } : undefined}>
      {lines.map((t, l) => (
        <div key={l} className="dg-line">
          {(t.length ? [...t] : [' ']).map((ch, i) => {
            const cls = [inSel(l, i) ? 'dg-sel' : '', cursor && l === cursor.line && i === cursor.col ? (sel ? 'dg-cursor-ring' : 'dg-cursor') : '']
              .filter(Boolean).join(' ');
            return <span key={i} className={cls || undefined}>{ch}</span>;
          })}
        </div>
      ))}
    </div>
  );
}

export type Edit = {
  /** Keys fed to the engine. */
  keys: string;
  /** What to show as the keys, when that differs (e.g. "cxiw w ."). */
  label?: string;
  text: string | string[];
  cursor: Cursor;
};

/**
 * One row per edit: keys, the buffer before (with cursor), and after.
 */
export function Edits({ plugins, name = 'diagram.ts', rows, caption }: { plugins: string[]; name?: string; rows: Edit[]; caption?: ReactNode }) {
  const done = useMemo(() => rows.map(r => {
    const lines = asLines(r.text);
    const v = run(plugins, name, lines, r.cursor, r.keys);
    const [line, col] = typeof r.cursor === 'number' ? [0, r.cursor] : r.cursor;
    return { r, lines, before: { line, col }, after: [...v.buf.lines], cur: { ...v.cursor } };
  }), [plugins, name, rows]);
  const w = Math.max(...rows.map(r => (r.label ?? r.keys).length));
  const cols = Math.max(...done.map(d => Math.max(...d.lines.map(l => l.length))));
  return (
    <figure className="dg">
      {done.map((d, i) => (
        <div key={i} className="dg-row" style={{ alignItems: 'center', marginTop: i ? 8 : 0 }}>
          <span className="dg-key" style={{ width: `${w + 1}ch` }}>{renderLabel(d.r.label ?? d.r.keys)}</span>
          <Block lines={d.lines} cursor={d.before} cols={cols} />
          <span className="dg-arrow">→</span>
          <Block lines={d.after} cursor={d.cur} />
        </div>
      ))}
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

/**
 * What each text object selects from the cursor, with plugins loaded.
 * Handles multi-line objects (indent, function) as well as single lines.
 */
export function PluginObjects({ plugins, name = 'diagram.ts', text, cursor, objects, caption }: {
  plugins: string[];
  name?: string;
  text: string | string[];
  cursor: Cursor;
  objects: string[];
  caption?: ReactNode;
}) {
  const lines = asLines(text);
  const [line, col] = typeof cursor === 'number' ? [0, cursor] : cursor;
  const rows = useMemo(() => objects.map(o => {
    const v = run(plugins, name, lines, [line, col], 'v' + o);
    if (!v.visual) return { o, sel: undefined };
    const r = v.visualRange();
    return { o, sel: { start: r.start, end: r.end, line: r.kind === 'line' } };
  }), [plugins, name, lines, line, col, objects]);
  const multi = lines.length > 1;
  return (
    <figure className={multi ? 'dg dg-ba' : 'dg'}>
      {rows.map(r => (
        <div key={r.o} className="dg-row" style={{ alignItems: multi ? 'flex-start' : 'center', marginTop: multi ? 0 : 4 }}>
          <span className="dg-key">{r.o}</span>
          <Block lines={lines} cursor={{ line, col }} sel={r.sel} />
        </div>
      ))}
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

/** Labels may mark typed text with ‹…›, e.g. "cst‹h3›⏎". */
function renderLabel(label: string) {
  return label.split(/(‹[^›]*›)/).map((part, i) => part.startsWith('‹')
    ? <span key={i} className="dg-typed">{part.slice(1, -1)}</span>
    : <span key={i}>{part.replace(/<CR>/g, '⏎').replace(/<Esc>/g, 'esc')}</span>);
}
