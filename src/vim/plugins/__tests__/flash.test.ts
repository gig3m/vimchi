import { describe, expect, it } from 'vitest';
import { Vim } from '../../editor';
import { flash, flashMatches, flashNodes } from '../flash';

function make(text: string, cursor = { line: 0, col: 0 }) {
  const vim = new Vim({ text, name: 'a.ts', plugins: [flash] });
  vim.win.cursor = { ...cursor };
  return vim;
}

const code = [
  'const user = await getUser(id);',
  'if (!user) throw new Error("missing user");',
  'return user.name;',
].join('\n');

describe('flash.nvim jump', () => {
  it('labels matches nearest first, skipping letters that continue the pattern', () => {
    const vim = make(code);
    const ms = flashMatches(vim, 'us');
    // Case-sensitive, so getUser doesn't match. "us" is always followed by "e": no "e" label.
    expect(ms.map(m => [m.start.line, m.start.col, m.label])).toEqual([
      [0, 6, 'a'], [1, 5, 's'], [1, 36, 'd'], [2, 7, 'f'],
    ]);
    expect(flashMatches(vim, 'e').map(m => m.label)).not.toContain('r');
  });

  it('s{chars}{label} jumps', () => {
    const vim = make(code);
    vim.feedKeys('suss');
    expect(vim.cursor).toEqual({ line: 1, col: 5 });
    expect(vim.modal).toBeNull();
    // The jump is in the jumplist.
    vim.feedKeys('<C-o>');
    expect(vim.cursor).toEqual({ line: 0, col: 0 });
  });

  it('keeps narrowing while the typed key is not a label', () => {
    const vim = make(code);
    vim.feedKeys('snamea');
    expect(vim.cursor).toEqual({ line: 2, col: 12 });
  });

  it('<CR> jumps to the nearest match, <Esc> cancels', () => {
    const vim = make(code);
    vim.feedKeys('sthr<CR>');
    expect(vim.cursor).toEqual({ line: 1, col: 11 });
    vim.feedKeys('sre<Esc>');
    expect(vim.cursor).toEqual({ line: 1, col: 11 });
    expect(vim.modal).toBeNull();
  });

  it('works as an operator motion (inclusive forward) and repeats with .', () => {
    const vim = make('one, two, three, four');
    vim.feedKeys('ds,a');
    expect(vim.buf.text()).toBe(' two, three, four');
    const v2 = make('alpha beta gamma');
    v2.feedKeys('ds ');
    // Space matches twice: nearest gets "a".
    v2.feedKeys('a');
    expect(v2.buf.text()).toBe('beta gamma');
    v2.feedKeys('.');
    expect(v2.buf.text()).toBe('gamma');
  });

  it('extends a visual selection', () => {
    const vim = make('let total = price * qty;');
    vim.feedKeys('vsqa');
    vim.feedKeys('d');
    expect(vim.buf.text()).toBe('ty;');
  });

  it('shows labels as overlays', () => {
    const vim = make(code);
    vim.feedKeys('sus');
    const deco = vim.decorators[0](vim.buf, vim.win)!;
    const labels = deco.hl!.filter(h => h.text).map(h => [h.line, h.start, h.text]);
    expect(labels).toContainEqual([0, 8, 'a']);
  });
});

describe('flash.nvim treesitter', () => {
  it('labels nested nodes from the inside out', () => {
    const vim = make('const total = sum(items.map(price));', { line: 0, col: 29 });
    const ns = flashNodes(vim).map(n => vim.buf.line(0).slice(n.start.col, n.end.col + 1));
    expect(ns).toEqual(['price', '(price)', 'items.map(price)', '(items.map(price))', 'sum(items.map(price))', 'const total = sum(items.map(price));']);
  });
  it('S{label} selects a node', () => {
    const vim = make('const total = sum(items.map(price));', { line: 0, col: 29 });
    vim.feedKeys('Sgd');
    expect(vim.buf.text()).toBe('const total = ;');
  });
  it('covers blocks across lines', () => {
    const vim = make('function f() {\n  if (ok) {\n    run();\n  }\n}', { line: 2, col: 4 });
    vim.feedKeys('S');
    const ns = flashNodes(vim);
    const last = ns[ns.length - 1];
    expect([last.start, last.end]).toEqual([{ line: 0, col: 0 }, { line: 4, col: 0 }]);
    vim.feedKeys('<Esc>');
    expect(vim.mode).toBe('normal');
  });
});

describe('flash beside mini.surround on LazyVim keys', () => {
  it('s jumps, S selects in visual mode, gsa still surrounds', async () => {
    const { surround } = await import('../surround');
    for (const plugins of [[surround, flash]]) { // createVim always loads flash last
      const vim = new Vim({ text: 'let a = b; let c = d;', name: 'a.ts', plugins });
      vim.feedKeys('sc');
      const m = flashMatches(vim, 'c')[0];
      vim.feedKeys(m.label!);
      expect(vim.cursor).toEqual({ line: 0, col: 15 });
      vim.feedKeys('gsaiw)');
      expect(vim.buf.text()).toBe('let a = b; let (c) = d;');
      vim.feedKeys('<Esc>0wwvS');
      expect(vim.pluginData.flash).toBeTruthy(); // flash's treesitter labels, not nvim-surround's S
      vim.feedKeys('<Esc>');
    }
  });
});

describe('flash reports one command for s + pattern + label', () => {
  const feed = (vim: Vim, keys: string[]) => keys.map(k => { vim.feed(k); return vim.lastCommand; });
  it('a jump completes as a motion on the label, with every key in it', () => {
    const vim = make('abc def\nabc xyz');
    const cmds = feed(vim, ['s', 'a', 'b', 'a']);
    expect(cmds.slice(0, 3)).toEqual([null, null, null]);
    expect(cmds[3]).toEqual({ keys: ['s', 'a', 'b', 'a'], kind: 'motion', error: false });
  });
  it('a cancelled jump completes as other; S completes as visual', () => {
    const vim = make('abc def\nabc xyz');
    expect(feed(vim, ['s', 'a', '<Esc>'])[2]).toEqual({ keys: ['s', 'a', '<Esc>'], kind: 'other', error: false });
    const w = make('f(a, b)', { line: 0, col: 2 });
    expect(feed(w, ['S', 'a'])[1]?.kind).toBe('visual');
  });
});
