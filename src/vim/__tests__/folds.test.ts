// Folds against Neovim (manual folds, nvim --clean). Expected values were read from Neovim with
// foldclosed()/foldclosedend() after zM; the text-and-cursor cases also live in
// scripts/nvimcheck/cases.json (fold-*), which the oracle replays.
import { describe, expect, it } from 'vitest';
import { Vim } from '../editor';

/** a..f with lines 2-3 (1-based) folded and opened, as `:2,3fold | zR`. */
function six() {
  const vim = new Vim({ text: 'a\nb\nc\nd\ne\nf', name: 'x.txt' });
  vim.win.folds.push({ start: 1, end: 2, closed: false });
  return vim;
}
/** foldclosed()-foldclosedend() per line after zM, 1-based like Neovim's (-1 when not in a closed fold). */
function report(vim: Vim) {
  vim.feedKeys('zM');
  return vim.lines.map((_, l) => {
    const f = vim.closedFoldAt(l);
    return f ? `${f.start + 1}-${f.end + 1}` : '-1--1';
  });
}
const N = '-1--1';

describe('folds follow edits (foldMarkAdjust)', () => {
  it.each([
    ['o on the last line: the new line is outside', '3Goxx<Esc>', [N, '2-3', '2-3', N, N, N, N]],
    ['O on the first line: the fold moves down', '2GOyy<Esc>', [N, N, '3-4', '3-4', N, N, N]],
    ['o inside: the fold grows', '2Goxx<Esc>', [N, '2-4', '2-4', '2-4', N, N, N]],
    ['dd the last line: one line left, which cannot close', '3Gdd', [N, N, N, N, N]],
    ['dd the first line', '2Gdd', [N, N, N, N, N]],
    ['dd every line: the fold goes', '2G2dd', [N, N, N, N]],
    ['dd above: the fold moves up', '1Gdd', ['1-2', '1-2', N, N, N]],
    ['o above: the fold moves down', '1Goxx<Esc>', [N, N, '3-4', '3-4', N, N, N]],
    ['Enter at the end of the last line joins the fold', '3GA<CR>zz<Esc>', [N, '2-4', '2-4', '2-4', N, N, N]],
    ['Enter at column 0 of the first line grows it', '2Gi<CR><Esc>', [N, '2-4', '2-4', '2-4', N, N, N]],
    ['J above eats the first line', '1GJ', [N, N, N, N, N]],
    ['J on the last line joins the line below in', '3GJ', [N, '2-3', '2-3', N, N]],
    ['p below the last line: outside', '3Gyyp', [N, '2-3', '2-3', N, N, N, N]],
    ['P above the first line: the fold moves', '2GyyP', [N, N, '3-4', '3-4', N, N, N]],
  ])('%s', (_name, keys, want) => {
    const vim = six();
    vim.feedKeys(keys);
    expect(report(vim)).toEqual(want);
  });
});

describe('fold commands', () => {
  const fns = 'function a() {\n  one();\n  two();\n}\nfunction b() {\n  three();\n  four();\n}\nend();';
  const make = () => {
    const vim = new Vim({ text: fns, name: 'x.ts' });
    vim.feedKeys(':2,3fold<CR>:6,7fold<CR>');
    return vim;
  };
  const closed = (vim: Vim) => vim.win.folds.map(f => f.closed);

  it('za opens a closed fold and closes an open one', () => {
    const vim = make();
    vim.feedKeys('jza');
    expect(closed(vim)).toEqual([false, true]);
    vim.feedKeys('jza');
    expect(closed(vim)).toEqual([true, true]);
    expect(vim.cursor.line).toBe(2); // za, zc and zM leave the line alone (Neovim)
  });
  it('the cursor keeps its line inside a closed fold (a..g, 5,7fold)', () => {
    const vim = new Vim({ text: 'a\nb\nc\nd\ne\nf\ng', name: 'x.txt' });
    vim.feedKeys(':5,7fold<CR>G');
    expect(vim.cursor.line).toBe(6); // G: 7
    vim.feedKeys('za');
    expect(vim.cursor.line).toBe(6); // Gza: 7
    vim.feedKeys('zMgg4j');
    expect(vim.cursor.line).toBe(4); // j onto a fold lands on its first line: 5
    vim.feedKeys('zR6Gzck');
    expect(vim.cursor.line).toBe(3); // k from inside leaves the fold: 4
    vim.feedKeys('ggyy6Gp');
    expect(vim.lines).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'a']); // p goes below the fold
    expect(vim.cursor.line).toBe(7);
  });
  it('zR opens every fold, zM closes every fold', () => {
    const vim = make();
    vim.feedKeys('zR');
    expect(closed(vim)).toEqual([false, false]);
    vim.feedKeys('4jzM');
    expect(closed(vim)).toEqual([true, true]);
    expect(vim.cursor.line).toBe(4);
  });
  it('zM keeps the cursor on its line inside the fold', () => {
    const vim = make();
    vim.feedKeys('zR2jzM');
    expect(vim.cursor.line).toBe(2);
  });
  it('za on nested folds opens the outer one first', () => {
    const vim = make();
    vim.feedKeys(':1,4fold<CR>za');
    expect(vim.closedFoldAt(0)).toBeNull();
    expect(vim.closedFoldAt(1)).toMatchObject({ start: 1, end: 2 });
    vim.feedKeys('jza');
    expect(vim.closedFoldAt(1)).toBeNull();
  });
  it('za with no fold is an error', () => {
    const vim = make();
    vim.feedKeys('3jza');
    expect(vim.message?.text).toMatch(/E490/);
  });
  it('dd and x take a closed fold whole', () => {
    for (const k of ['jdd', 'jx']) {
      const vim = make();
      vim.feedKeys(k);
      expect(vim.buf.text()).toBe('function a() {\n}\nfunction b() {\n  three();\n  four();\n}\nend();');
      expect(vim.getRegister('"')).toEqual({ text: '  one();\n  two();\n', kind: 'line' });
    }
  });
  it('an insert opens the fold at the cursor', () => {
    const vim = make();
    vim.feedKeys('jA;<Esc>');
    expect(closed(vim)).toEqual([false, true]);
    expect(vim.line(1)).toBe('  one();;');
  });
  it('zj / zk with a count', () => {
    const vim = make();
    vim.feedKeys('2zj');
    expect(vim.cursor.line).toBe(5);
    // Neovim leaves the line number on the fold's last line (6) where the engine shows it on the
    // fold's first; either way the closed fold is under the cursor, and x takes it whole.
    vim.feedKeys('Gzkx');
    expect(vim.buf.text()).toBe(fns.replace('  three();\n  four();\n', ''));
  });
});
