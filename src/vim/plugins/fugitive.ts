// vim-fugitive: the :Git status buffer (s u - = X cc ca ce dv gu gs gU ( ) gq
// <CR> o gO O), commits through a COMMIT_EDITMSG buffer, :Git blame,
// :Gwrite, :Gdiffsplit / :Gvdiffsplit (and the 3-way :Gdiffsplit! with d2o /
// d3o), and :Git add / commit / log. The repository is the model in
// git-model.ts; the worktree is vim.fs.

import { Buffer } from '../buffer';
import type { Plugin, Vim } from '../editor';
import { Window } from '../layout';
import { firstNonBlank } from '../text';
import { fail, pos } from '../types';
import { conflicts, resolveAll, setDiff } from './diff';
import {
  type Commit, NOT_COMMITTED, applyHunks, blame, commit, diffLines, fromLines, gitState, stageFile, status, toLines,
  unified, unstageFile,
} from './git-model';

export const STATUS_NAME = 'fugitive:///.git//';
export const COMMIT_MSG_NAME = '.git/COMMIT_EDITMSG';
export const commitBufferName = (hash: string) => `fugitive:///.git//${hash}`;
export const blameBufferName = (path: string) => `${path}.fugitiveblame`;

type Section = 'untracked' | 'unstaged' | 'staged';
type Row =
  | { kind: 'other' }
  | { kind: 'section'; section: Section }
  | { kind: 'file'; section: Section; path: string }
  | { kind: 'diff'; section: Section; path: string; group: number; line: string; header: boolean };

const TITLES: Record<Section, string> = { untracked: 'Untracked', unstaged: 'Unstaged', staged: 'Staged' };

/** Old/new sides of a file's diff in a section. */
function sides(vim: Vim, section: Section, path: string): [string[], string[]] {
  const g = gitState(vim);
  if (section === 'staged') return [toLines(g.head[path]), toLines(g.index[path])];
  if (section === 'unstaged') return [toLines(g.index[path]), toLines(vim.fs.read(path))];
  return [[], toLines(vim.fs.read(path))];
}

// ---- the status buffer ---------------------------------------------------------------------------------

function render(vim: Vim, buf: Buffer) {
  const g = gitState(vim);
  const st = status(vim);
  const expanded = buf.data.expanded as Set<string>;
  const lines = [`Head: ${g.branch}`, 'Help: g?'];
  const rows: Row[] = [{ kind: 'other' }, { kind: 'other' }];
  for (const section of ['untracked', 'unstaged', 'staged'] as Section[]) {
    const list = st[section];
    if (!list.length) continue;
    lines.push('', `${TITLES[section]} (${list.length})`);
    rows.push({ kind: 'other' }, { kind: 'section', section });
    for (const c of list) {
      lines.push(`${c.code} ${c.path}`);
      rows.push({ kind: 'file', section, path: c.path });
      if (!expanded.has(`${section}:${c.path}`)) continue;
      const [a, b] = sides(vim, section, c.path);
      unified(a, b).forEach((grp, gi) => {
        lines.push(grp.header);
        rows.push({ kind: 'diff', section, path: c.path, group: gi, line: grp.header, header: true });
        for (const l of grp.lines) {
          lines.push(l);
          rows.push({ kind: 'diff', section, path: c.path, group: gi, line: l, header: false });
        }
      });
    }
  }
  buf.lines = lines;
  buf.data.rows = rows;
  buf.modified = false;
}

/** Re-render every open status buffer (after staging from anywhere). */
export function refreshStatus(vim: Vim) {
  for (const b of vim.buffers) if (b.name === STATUS_NAME) render(vim, b);
}

const rowsOf = (buf: Buffer) => buf.data.rows as Row[];
const isItem = (r: Row) => r.kind === 'file' || (r.kind === 'diff' && r.header);

/** After an action: stay on the same line if it is still a file or hunk, else the nearest one below/above. */
function settle(vim: Vim, line: number) {
  const rows = rowsOf(vim.buf);
  let l = Math.min(line, rows.length - 1);
  if (!isItem(rows[l]) && rows[l].kind !== 'diff') {
    let d = l;
    while (d < rows.length && !isItem(rows[d])) d++;
    if (d < rows.length) l = d;
    else {
      while (l > 0 && !isItem(rows[l])) l--;
    }
  }
  vim.setCursor(pos(l, 0));
}

function stageRow(vim: Vim, r: Row, stage: boolean) {
  const g = gitState(vim);
  if (r.kind === 'section') {
    const list = status(vim)[r.section];
    if (stage && r.section !== 'staged') list.forEach(c => stageFile(vim, c.path));
    if (!stage && r.section === 'staged') list.forEach(c => unstageFile(vim, c.path));
    return;
  }
  if (r.kind === 'file') {
    if (stage && r.section !== 'staged') stageFile(vim, r.path);
    if (!stage && r.section === 'staged') unstageFile(vim, r.path);
    return;
  }
  if (r.kind !== 'diff') return;
  const [a, b] = sides(vim, r.section, r.path);
  const grp = unified(a, b)[r.group];
  if (!grp) return;
  if (stage && r.section === 'unstaged') g.index[r.path] = fromLines(applyHunks(a, grp.hunks));
  else if (stage && r.section === 'untracked') stageFile(vim, r.path);
  else if (!stage && r.section === 'staged') {
    const keep = diffLines(a, b).filter(h => !grp.hunks.some(x => x.aStart === h.aStart && x.bStart === h.bStart));
    g.index[r.path] = fromLines(applyHunks(a, keep));
  }
}

function act(vim: Vim, fn: (rows: Row[]) => void) {
  const buf = vim.buf;
  const line = vim.cursor.line;
  let rows = [rowsOf(buf)[line]];
  if (vim.visual) {
    const [s, e] = vim.visualBounds();
    rows = rowsOf(buf).slice(s.line, e.line + 1);
    vim.exitVisual();
  }
  fn(rows);
  render(vim, buf);
  settle(vim, line);
}

function openStatus(vim: Vim) {
  const shown = vim.tab.windows().find(w => w.buf.name === STATUS_NAME);
  if (shown) {
    vim.focusWindow(shown);
    render(vim, shown.buf);
    return;
  }
  let buf = vim.findBuffer(STATUS_NAME);
  if (!buf) {
    buf = new Buffer(STATUS_NAME, '', { kind: 'plugin', filetype: 'fugitive' });
    buf.listed = false;
    buf.data.expanded = new Set<string>();
    vim.addBuffer(buf);
    statusMaps(vim, buf);
  }
  render(vim, buf);
  vim.splitWindow('col', buf);
  const first = rowsOf(buf).findIndex(r => r.kind === 'file');
  vim.setCursor(pos(Math.max(0, first), 0));
}

function closeStatus(vim: Vim) {
  if (vim.tab.windows().length > 1) vim.closeWindow();
  else {
    const alt = vim.win.alt && vim.win.alt !== vim.buf ? vim.win.alt : vim.buffers.find(b => b.kind === 'file');
    if (alt) vim.showBuffer(vim.win, alt);
  }
}

/** Open the file (at the line) for a status row. */
function openRow(vim: Vim, how: 'edit' | 'split' | 'vsplit' | 'tab') {
  const r = rowsOf(vim.buf)[vim.cursor.line];
  if (!r || (r.kind !== 'file' && r.kind !== 'diff')) {
    if (r?.kind === 'section') return;
    fail();
  }
  let line = 0;
  if (r.kind === 'diff') {
    const rows = rowsOf(vim.buf);
    let h = vim.cursor.line;
    while (h > 0 && !(rows[h].kind === 'diff' && (rows[h] as { header: boolean }).header)) h--;
    const m = /\+(\d+)/.exec(vim.buf.line(h));
    line = m ? Math.max(0, +m[1] - 1) : 0;
    for (let l = h + 1; l < vim.cursor.line; l++) if (!vim.buf.line(l).startsWith('-')) line++;
  }
  if (vim.fs.read(r.path) == null) fail(`fugitive: ${r.path} is not in the work tree`);
  if (how === 'split') vim.splitWindow('col');
  if (how === 'vsplit') vim.splitWindow('row');
  if (how === 'tab') vim.newTab();
  vim.pushJump();
  vim.edit(r.path);
  vim.setCursor(pos(Math.min(line, vim.buf.lineCount - 1), firstNonBlank(vim.buf.line(line))));
}

function statusMaps(vim: Vim, buf: Buffer) {
  const L = (lhs: string, fn: () => void, modes: ('n' | 'v')[] = ['n']) => vim.mapLocal(buf, modes, lhs, () => fn());
  L('s', () => act(vim, rows => rows.forEach(r => stageRow(vim, r, true))), ['n', 'v']);
  L('u', () => act(vim, rows => rows.forEach(r => stageRow(vim, r, false))), ['n', 'v']);
  L('-', () => act(vim, rows => rows.forEach(r => stageRow(vim, r, r.kind === 'section' ? r.section !== 'staged' : r.kind !== 'other' && r.section !== 'staged'))), ['n', 'v']);
  L('X', () => act(vim, rows => rows.forEach(r => {
    if (r.kind !== 'file') return;
    const g = gitState(vim);
    if (r.section === 'untracked') vim.fs.remove(r.path);
    else if (r.section === 'unstaged') {
      if (r.path in g.index) vim.fs.write(r.path, g.index[r.path]);
      reloadBuffer(vim, r.path);
    }
  })));
  L('=', () => {
    const r = rowsOf(buf)[vim.cursor.line];
    if (!r || (r.kind !== 'file' && r.kind !== 'diff')) return;
    const key = `${r.section}:${r.path}`;
    const exp = buf.data.expanded as Set<string>;
    if (exp.has(key)) exp.delete(key);
    else exp.add(key);
    render(vim, buf);
    const at = rowsOf(buf).findIndex(x => x.kind === 'file' && x.section === r.section && x.path === r.path);
    vim.setCursor(pos(Math.max(0, at), 0));
  });
  L('<CR>', () => openRow(vim, 'edit'));
  L('o', () => openRow(vim, 'split'));
  L('gO', () => openRow(vim, 'vsplit'));
  L('O', () => openRow(vim, 'tab'));
  L('gq', () => closeStatus(vim));
  L('R', () => render(vim, buf));
  L('g?', () => vim.msg('s stage  u unstage  - toggle  = inline diff  X discard  cc commit  ca amend  ce amend (no edit)  dv diff  gq close', 'info'));
  const jumpSection = (section: Section) => (ctx: { count: number }) => {
    const rows = rowsOf(buf);
    const files = rows.flatMap((r, i) => (r.kind === 'file' && r.section === section ? [i] : []));
    if (!files.length) fail();
    vim.pushJump();
    vim.setCursor(pos(files[Math.min(ctx.count, files.length) - 1], 0));
  };
  vim.mapLocal(buf, ['n'], 'gu', jumpSection('unstaged'));
  vim.mapLocal(buf, ['n'], 'gs', jumpSection('staged'));
  vim.mapLocal(buf, ['n'], 'gU', jumpSection('untracked'));
  const step = (dir: 1 | -1) => (ctx: { count: number }) => {
    const rows = rowsOf(buf);
    let l = vim.cursor.line;
    for (let n = 0; n < ctx.count; n++) {
      let k = l + dir;
      while (k >= 0 && k < rows.length && !isItem(rows[k])) k += dir;
      if (k < 0 || k >= rows.length) break;
      l = k;
    }
    vim.setCursor(pos(l, 0));
  };
  vim.mapLocal(buf, ['n'], ')', step(1));
  vim.mapLocal(buf, ['n'], '(', step(-1));
  L('cc', () => openCommit(vim, false));
  L('ca', () => openCommit(vim, true));
  L('ce', () => {
    const g = gitState(vim);
    const last = g.log[g.log.length - 1];
    if (!last) fail('fatal: You have nothing to amend.');
    const c = commit(vim, last.message, { amend: true });
    vim.msg(`[${g.branch} ${c.hash}] ${c.message}`);
    refreshStatus(vim);
    settle(vim, vim.cursor.line);
  });
  const diffRow = (vertical: boolean) => () => {
    const r = rowsOf(buf)[vim.cursor.line];
    if (!r || (r.kind !== 'file' && r.kind !== 'diff')) fail();
    vim.edit(r.path);
    gdiff(vim, vertical, r.section === 'staged' ? 'head' : 'index');
  };
  L('dv', diffRow(true));
  L('dd', diffRow(false));
}

function reloadBuffer(vim: Vim, path: string) {
  const b = vim.findBuffer(path);
  const t = vim.fs.read(path);
  if (b && t != null) {
    b.lines = toLines(t);
    if (!b.lines.length) b.lines = [''];
    b.modified = false;
  }
}

// ---- committing -------------------------------------------------------------------------------------------

function openCommit(vim: Vim, amend: boolean) {
  const g = gitState(vim);
  const st = status(vim);
  const last = g.log[g.log.length - 1];
  if (amend && !last) fail('fatal: You have nothing to amend.');
  if (!amend && !st.staged.length) fail('nothing added to commit (use "git add" and/or "git commit -a")');
  const verb = { M: 'modified:   ', A: 'new file:   ', D: 'deleted:    ', '?': '' };
  const lines = [
    ...(amend ? last.message.split('\n') : ['']),
    '# Please enter the commit message for your changes. Lines starting',
    "# with '#' will be ignored, and an empty message aborts the commit.",
    '#',
    `# On branch ${g.branch}`,
    '# Changes to be committed:',
    ...st.staged.map(c => `#       ${verb[c.code]}${c.path}`),
    '#',
  ];
  const buf = new Buffer(COMMIT_MSG_NAME, lines, { kind: 'plugin', filetype: 'gitcommit' });
  buf.listed = false;
  vim.addBuffer(buf);
  buf.data.onWrite = () => {
    if (buf.data.done) {
      buf.modified = false;
      return;
    }
    const msg = buf.lines.filter(l => !l.startsWith('#')).join('\n').replace(/\s+$/, '').replace(/^\s*\n/, '');
    if (!msg.trim()) {
      buf.modified = false;
      vim.msg('Aborting commit due to empty commit message.', 'error');
      return;
    }
    const c = commit(vim, msg, { amend });
    buf.data.done = true;
    buf.modified = false;
    vim.msg(`[${g.branch} ${c.hash}] ${msg.split('\n')[0]}`);
    refreshStatus(vim);
  };
  vim.splitWindow('col', buf);
  vim.setCursor(pos(0, 0));
}

// ---- blame ------------------------------------------------------------------------------------------------

function commitLines(vim: Vim, c: Commit): string[] {
  const g = gitState(vim);
  const out = [`commit ${c.hash}`, `Author: ${c.author}`, `Date:   ${c.date}`, '', ...c.message.split('\n').map(l => '    ' + l), ''];
  const idx = g.log.indexOf(c);
  for (const [path, text] of Object.entries(c.files ?? {})) {
    let before: string | null = null;
    for (let i = idx - 1; i >= 0 && before == null; i--) {
      const f = g.log[i].files;
      if (f && path in f) before = f[path];
    }
    out.push(`diff --git a/${path} b/${path}`, `--- a/${path}`, `+++ b/${path}`);
    for (const grp of unified(toLines(before), toLines(text))) out.push(grp.header, ...grp.lines);
  }
  return out;
}

function showCommit(vim: Vim, c: Commit, win?: Window) {
  const name = commitBufferName(c.hash);
  let buf = vim.findBuffer(name);
  if (!buf) {
    buf = new Buffer(name, commitLines(vim, c), { kind: 'plugin', filetype: 'git' });
    buf.modified = false;
    vim.addBuffer(buf);
  }
  vim.showBuffer(win ?? vim.win, buf);
}

function openBlame(vim: Vim) {
  const src = vim.win;
  const path = src.buf.name;
  if (src.buf.kind !== 'file' || !(path in gitState(vim).head || path in gitState(vim).index)) fail(`fugitive: file does not exist in the repository: ${path}`);
  const who = blame(vim, path, src.buf.lines);
  const aw = Math.max(...who.map(c => c.author.length));
  const nw = String(who.length).length;
  const lines = who.map((c, i) => `${c.hash} (${c.author.padEnd(aw)} ${c.date} ${String(i + 1).padStart(nw)})`);
  const buf = new Buffer(blameBufferName(path), lines, { kind: 'plugin', filetype: 'git' });
  buf.listed = false;
  buf.data.blame = { src, who };
  vim.addBuffer(buf);
  const w = vim.splitWindow('row', buf);
  w.cursor = pos(src.cursor.line, 0);
  w.top = src.top;
  w.opts.number = false;
  w.opts.relativenumber = false;
  const close = () => {
    if (vim.tab.windows().includes(w)) vim.closeWindow(w);
    if (vim.tab.windows().includes(src)) vim.focusWindow(src);
  };
  const at = () => who[vim.cursor.line];
  vim.mapLocal(buf, ['n'], 'gq', close);
  vim.mapLocal(buf, ['n'], 'q', close);
  vim.mapLocal(buf, ['n'], '<CR>', () => {
    const c = at();
    if (!c || c === NOT_COMMITTED) fail('fugitive: line is not committed yet');
    close();
    showCommit(vim, c);
  });
  vim.mapLocal(buf, ['n'], 'o', () => {
    const c = at();
    if (!c || c === NOT_COMMITTED) fail('fugitive: line is not committed yet');
    vim.splitWindow('col');
    showCommit(vim, c);
  });
}

// ---- diffs ------------------------------------------------------------------------------------------------

function gdiff(vim: Vim, vertical: boolean, against: 'index' | 'head' = 'index') {
  const src = vim.win;
  const path = src.buf.name;
  const g = gitState(vim);
  const text = against === 'index' ? g.index[path] : g.head[path];
  const name = `fugitive:///.git//${against === 'index' ? '0' : 'HEAD'}/${path}`;
  let buf = vim.findBuffer(name);
  if (!buf) {
    buf = new Buffer(name, toLines(text ?? ''), { kind: 'plugin' });
    buf.filetype = src.buf.filetype;
    buf.listed = false;
    vim.addBuffer(buf);
    const b = buf;
    // Writing the index version stages it (the classic :Gdiffsplit, dp, :w workflow).
    if (against === 'index') b.data.onWrite = () => {
      g.index[path] = fromLines(b.lines.length === 1 && b.lines[0] === '' ? [] : b.lines);
      b.modified = false;
      vim.msg(`"${path}" staged`);
      refreshStatus(vim);
    };
  } else {
    buf.lines = toLines(text ?? '');
    if (!buf.lines.length) buf.lines = [''];
  }
  setDiff(vim, src, true);
  const w = vim.splitWindow(vertical ? 'row' : 'col', buf);
  setDiff(vim, w, true);
  vim.focusWindow(src);
}

/** :Gdiffsplit! in a file with conflict markers: ours (//2) left, the file, theirs (//3) right. */
function gdiff3(vim: Vim, vertical: boolean) {
  const src = vim.win;
  const path = src.buf.name;
  if (!src.buf.lines.some(l => /^<{7}/.test(l))) return gdiff(vim, vertical);
  const make = (side: 2 | 3) => {
    const b = new Buffer(`fugitive:///.git//${side}/${path}`, resolveAll(src.buf.lines, side), { kind: 'plugin' });
    b.filetype = src.buf.filetype;
    b.listed = false;
    b.modified = false;
    vim.addBuffer(b);
    return b;
  };
  setDiff(vim, src, true);
  const left = vim.splitWindow(vertical ? 'row' : 'col', make(2));
  setDiff(vim, left, true);
  vim.focusWindow(src);
  const right = new Window(make(3));
  vim.tab.split(src, right, vertical ? 'row' : 'col', true);
  setDiff(vim, right, true);
  vim.focusWindow(src);
  vim.mapLocal(src.buf, ['n'], 'd2o', () => { vim.beginChange(); conflicts.takeSide(vim, 2); });
  vim.mapLocal(src.buf, ['n'], 'd3o', () => { vim.beginChange(); conflicts.takeSide(vim, 3); });
}

// ---- :Git ----------------------------------------------------------------------------------------------------

function git(vim: Vim, arg: string, bang: boolean) {
  const [sub, ...rest] = arg.split(/\s+/).filter(Boolean);
  const g = gitState(vim);
  switch (sub ?? '') {
    case '':
    case 'status':
      return openStatus(vim);
    case 'blame':
      return openBlame(vim);
    case 'add': {
      const paths = rest.map(p => (p === '%' ? vim.buf.name : p));
      if (!paths.length) fail('Nothing specified, nothing added.');
      for (const p of paths) {
        if (p === '.' || p === '-A') vim.fs.list().forEach(f => stageFile(vim, f));
        else stageFile(vim, vim.resolveFile(p) ?? p);
      }
      refreshStatus(vim);
      return;
    }
    case 'commit': {
      const amend = rest.includes('--amend');
      const m = /-m\s+(["']?)(.+)\1\s*$/.exec(rest.join(' '));
      if (m) {
        if (!amend && !status(vim).staged.length) fail('nothing added to commit');
        const c = commit(vim, m[2], { amend });
        vim.msg(`[${g.branch} ${c.hash}] ${c.message}`);
        refreshStatus(vim);
        return;
      }
      return openCommit(vim, amend);
    }
    case 'log': {
      const lines = [...g.log].reverse().map(c => `${c.hash} ${c.message.split('\n')[0]}`);
      const buf = new Buffer('fugitive:///.git//log', lines.length ? lines : [''], { kind: 'plugin', filetype: 'git' });
      buf.listed = false;
      vim.addBuffer(buf);
      vim.splitWindow('col', buf);
      vim.mapLocal(buf, ['n'], '<CR>', () => { const c = [...g.log].reverse()[vim.cursor.line]; if (c) showCommit(vim, c); });
      vim.mapLocal(buf, ['n'], 'gq', () => closeStatus(vim));
      return;
    }
    default:
      void bang;
      vim.msg(`:Git ${sub} isn't part of the tutor's fugitive.`, 'warn');
  }
}

// ---- the plugin ------------------------------------------------------------------------------------------------

export const fugitive: Plugin = {
  name: 'fugitive',
  setup: vim => {
    vim.defineEx('Git', 1, a => git(vim, a.arg, a.bang));
    vim.defineEx('Gwrite', 2, () => {
      if (vim.buf.kind !== 'file') fail('fugitive: not a work tree file');
      vim.ex('write');
      stageFile(vim, vim.buf.name);
      refreshStatus(vim);
    });
    vim.defineEx('Gdiffsplit', 2, a => (a.bang ? gdiff3(vim, !!vim.pluginData.vertical) : gdiff(vim, !!vim.pluginData.vertical)));
    vim.defineEx('Gvdiffsplit', 3, a => (a.bang ? gdiff3(vim, true) : gdiff(vim, true)));
    // Keep the blame window's cursor line in step with its file (scrollbind).
    vim.cursorHooks.push(() => {
      const wins = vim.tab.windows();
      for (const w of wins) {
        const bl = w.buf.data.blame as { src: Window } | undefined;
        if (!bl || !wins.includes(bl.src)) continue;
        const [lead, follow] = vim.win === w ? [w, bl.src] : vim.win === bl.src ? [bl.src, w] : [null, null];
        if (!lead || !follow) continue;
        follow.cursor = pos(Math.min(lead.cursor.line, follow.buf.lineCount - 1), follow === w ? 0 : follow.cursor.col);
        follow.top = lead.top;
      }
    });
  },
};
