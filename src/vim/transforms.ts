// Text transforms used by operators: formatting (gq), re-indenting (=),
// commenting (gc) and a few "shell" filters for ! and :%!.

import { COMMENT_STRINGS } from './buffer';
import { indentOf } from './text';

// ---- gq ---------------------------------------------------------------------------

const LEADER = /^(\s*)(\/\/+|#+|--|\*|;+|>)?(\s*)/;

/** Re-wrap lines to `tw` columns, paragraph by paragraph, keeping comment leaders. */
export function formatLines(lines: string[], tw: number): string[] {
  const out: string[] = [];
  let para: string[] = [];
  const flush = () => {
    if (!para.length) return;
    const m = LEADER.exec(para[0])!;
    const leader = m[1] + (m[2] ? m[2] + (m[3] || ' ') : '');
    const words = para.map(l => l.slice(LEADER.exec(l)![0].length)).join(' ').split(/\s+/).filter(Boolean);
    let cur = '';
    for (const w of words) {
      if (cur && (leader + cur + ' ' + w).length > tw) {
        out.push(leader + cur);
        cur = w;
      } else cur = cur ? cur + ' ' + w : w;
    }
    if (cur || !words.length) out.push((leader + cur).replace(/\s+$/, ''));
    para = [];
  };
  for (const l of lines) {
    const m = LEADER.exec(l)!;
    const body = l.slice(m[0].length);
    if (!body.trim()) {
      flush();
      out.push(l.replace(/\s+$/, ''));
      continue;
    }
    // A new comment style starts a new paragraph.
    if (para.length && (LEADER.exec(para[0])![2] ?? '') !== (m[2] ?? '')) flush();
    para.push(l);
  }
  flush();
  return out;
}

// ---- = ------------------------------------------------------------------------------

/** Re-indent lines by bracket depth (C-like) or block keywords (Lua). */
export function reindentLines(all: readonly string[], start: number, end: number, filetype: string, sw: number): string[] {
  const unit = ' '.repeat(sw);
  const lua = filetype === 'lua';
  // Establish the depth at `start` from the line above.
  let depth = 0;
  let base = '';
  for (let l = start - 1; l >= 0; l--) {
    if (all[l].trim()) {
      base = indentOf(all[l]);
      depth = netOpen(all[l], lua) > 0 ? 1 : 0;
      break;
    }
  }
  const out: string[] = [];
  for (let l = start; l <= end; l++) {
    const t = all[l].trim();
    if (!t) {
      out.push('');
      continue;
    }
    const closesFirst = lua ? /^(end\b|else\b|elseif\b|until\b|\}|\))/.test(t) : /^[}\])]/.test(t);
    const d = Math.max(0, depth - (closesFirst ? 1 : 0));
    out.push(base + unit.repeat(d) + t);
    depth = Math.max(0, depth + netOpen(t, lua));
    if (lua && /^(else\b|elseif\b)/.test(t)) depth = Math.max(0, depth);
  }
  // Re-derive the base: if the block's first line was dedented relative to the context, keep relative shape.
  return out;
}

function netOpen(line: string, lua: boolean): number {
  const code = line.replace(/(["'`])(?:\\.|(?!\1).)*\1/g, '""').replace(/\/\/.*$|--.*$/, '');
  if (lua) {
    let n = 0;
    n += (code.match(/\b(function|then|do|repeat)\b/g) ?? []).length;
    n -= (code.match(/\b(end|until)\b/g) ?? []).length;
    if (/^\s*elseif\b/.test(code)) n -= 1; // closes the previous branch; its `then` reopens
    n += (code.match(/[{(]/g) ?? []).length - (code.match(/[})]/g) ?? []).length;
    return n;
  }
  return (code.match(/[{[(]/g) ?? []).length - (code.match(/[}\])]/g) ?? []).length;
}

// ---- gc -----------------------------------------------------------------------------

/** Toggle comments like Neovim's built-in gc: uncomment if every non-blank line is commented. */
export function toggleComment(lines: string[], filetype: string): string[] {
  const cs = COMMENT_STRINGS[filetype] ?? '# %s';
  const [pre, post] = cs.split('%s').map(s => s.trim());
  const nonBlank = lines.filter(l => l.trim());
  const isCommented = (l: string) => {
    const t = l.trim();
    return t.startsWith(pre) && (!post || t.endsWith(post));
  };
  if (nonBlank.length && nonBlank.every(isCommented)) {
    return lines.map(l => {
      if (!l.trim()) return l;
      const ind = indentOf(l);
      let t = l.slice(ind.length).slice(pre.length);
      if (t.startsWith(' ')) t = t.slice(1);
      if (post) t = t.replace(new RegExp(`\\s?${escapeRe(post)}\\s*$`), '');
      return ind + t;
    });
  }
  const minInd = Math.min(...nonBlank.map(l => indentOf(l).length));
  return lines.map(l => {
    if (!l.trim()) return l;
    return l.slice(0, minInd) + pre + ' ' + l.slice(minInd) + (post ? ' ' + post : '');
  });
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ---- ! filters ------------------------------------------------------------------------

/** Run a tiny subset of shell commands over lines. Returns null for unknown commands. */
export function shellFilter(cmd: string, lines: string[]): string[] | { error: string } {
  const stages = cmd.split('|').map(s => s.trim()).filter(Boolean);
  let cur = lines.slice();
  for (const stage of stages) {
    const r = runStage(stage, cur);
    if ('error' in r) return r;
    cur = r.lines;
  }
  return cur;
}

function runStage(stage: string, lines: string[]): { lines: string[] } | { error: string } {
  const [name, ...rawArgs] = stage.split(/\s+/);
  const args = rawArgs.map(a => a.replace(/^['"]|['"]$/g, ''));
  const flags = args.filter(a => a.startsWith('-')).join('');
  switch (name) {
    case 'sort': {
      let out = lines.slice();
      const numeric = /n/.test(flags), rev = /r/.test(flags), uniq = /u/.test(flags), fold = /f/.test(flags);
      out.sort((a, b) => {
        if (numeric) return (parseFloat(a) || 0) - (parseFloat(b) || 0);
        const x = fold ? a.toLowerCase() : a, y = fold ? b.toLowerCase() : b;
        return x < y ? -1 : x > y ? 1 : 0;
      });
      if (rev) out.reverse();
      if (uniq) out = out.filter((l, i) => i === 0 || l !== out[i - 1]);
      return { lines: out };
    }
    case 'uniq':
      return { lines: lines.filter((l, i) => i === 0 || l !== lines[i - 1]) };
    case 'tac':
      return { lines: lines.slice().reverse() };
    case 'rev':
      return { lines: lines.map(l => [...l].reverse().join('')) };
    case 'cat':
      return { lines: /n/.test(flags) ? lines.map((l, i) => `${String(i + 1).padStart(6)}\t${l}`) : lines };
    case 'head': {
      const n = parseInt(args.find(a => /^-?\d+$/.test(a))?.replace('-', '') ?? '10', 10);
      return { lines: lines.slice(0, n) };
    }
    case 'tail': {
      const n = parseInt(args.find(a => /^-?\d+$/.test(a))?.replace('-', '') ?? '10', 10);
      return { lines: lines.slice(-n) };
    }
    case 'wc':
      return { lines: [String(/l/.test(flags) ? lines.length : lines.join('\n').split(/\s+/).filter(Boolean).length)] };
    case 'tr': {
      const [a, b] = args.filter(x => !x.startsWith('-'));
      if (!a || !b) return { error: 'tr: missing operand' };
      const expand = (s: string) => s.replace(/(\w)-(\w)/g, (_, x: string, y: string) => {
        let o = '';
        for (let c = x.charCodeAt(0); c <= y.charCodeAt(0); c++) o += String.fromCharCode(c);
        return o;
      });
      const from = expand(a), to = expand(b);
      return { lines: lines.map(l => [...l].map(ch => { const i = from.indexOf(ch); return i < 0 ? ch : to[Math.min(i, to.length - 1)]; }).join('')) };
    }
    case 'column': {
      const rows = lines.map(l => l.trim().split(/\s+/));
      const widths: number[] = [];
      rows.forEach(r => r.forEach((c, i) => (widths[i] = Math.max(widths[i] ?? 0, c.length))));
      return { lines: rows.map(r => r.map((c, i) => (i === r.length - 1 ? c : c.padEnd(widths[i]))).join('  ')) };
    }
    case 'jq': {
      try {
        const v = JSON.parse(lines.join('\n'));
        return { lines: JSON.stringify(v, null, 2).split('\n') };
      } catch (e) {
        return { error: 'jq: parse error: ' + (e as Error).message };
      }
    }
    case 'fmt':
      return { lines: formatLines(lines, 75) };
    case 'nl':
      return { lines: lines.map((l, i) => `${String(i + 1).padStart(6)}\t${l}`) };
    case 'awk': {
      const prog = stage.slice(stage.indexOf(' ') + 1).trim().replace(/^'|'$/g, '');
      const m = /^\{\s*print\s+([$\d,\s"]+)\}$/.exec(prog);
      if (!m) return { error: 'awk: only {print $n} is supported here' };
      const parts = m[1].split(',').map(s => s.trim());
      return { lines: lines.map(l => { const f = l.trim().split(/\s+/); return parts.map(p => (p.startsWith('$') ? (p === '$0' ? l : f[+p.slice(1) - 1] ?? '') : p.replace(/"/g, ''))).join(' '); }) };
    }
    case 'date':
      return { lines: [new Date(0).toUTCString()] };
    case 'echo':
      return { lines: [args.join(' ')] };
  }
  return { error: `/bin/sh: ${name}: command not found` };
}
