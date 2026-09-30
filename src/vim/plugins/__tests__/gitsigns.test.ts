import { describe, expect, it } from 'vitest';
import { Vim } from '../../editor';
import { gitState } from '../git-model';
import { gitsigns } from '../gitsigns';

const base = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].join('\n') + '\n';
// 'b' changed, 'X' added after d, 'g' deleted.
const work = ['a', 'B', 'c', 'd', 'X', 'e', 'f', 'h'].join('\n') + '\n';
function mk() {
  const vim = new Vim({ files: { 'x.txt': work }, open: 'x.txt', plugins: [gitsigns] });
  vim.pluginData.git = { head: { 'x.txt': base } };
  return vim;
}
const signs = (vim: Vim) => {
  const d = vim.decorators.map(f => f(vim.buf, vim.win)).find(Boolean)!;
  return [...d.signs!].map(([l, s]) => `${l}${s.text}`);
};

describe('gitsigns', () => {
  it('puts signs in the sign column', () => {
    expect(signs(mk())).toEqual(['1┃', '4┃', '6_']);
  });

  it(']c / [c walk hunks and wrap', () => {
    const vim = mk();
    vim.feedKeys(']c');
    expect(vim.cursor.line).toBe(1);
    vim.feedKeys('2]c');
    expect(vim.cursor.line).toBe(6);
    vim.feedKeys(']c');
    expect(vim.cursor.line).toBe(1);
    vim.feedKeys('[c');
    expect(vim.cursor.line).toBe(6);
  });

  it('<leader>hs stages the hunk under the cursor', () => {
    const vim = mk();
    vim.feedKeys(']c]c hs');
    expect(gitState(vim).index['x.txt']).toBe(['a', 'b', 'c', 'd', 'X', 'e', 'f', 'g', 'h'].join('\n') + '\n');
    expect(signs(vim)).toEqual(['1┃', '6_']);
  });

  it('<leader>hr resets it, and u undoes that', () => {
    const vim = mk();
    vim.feedKeys(']c hr');
    expect(vim.buf.lines[1]).toBe('b');
    vim.feedKeys('G[c hr');
    expect(vim.buf.lines).toEqual(['a', 'b', 'c', 'd', 'X', 'e', 'f', 'g', 'h']);
    vim.feedKeys('u');
    expect(vim.buf.lines[7]).toBe('h');
  });

  it('<leader>hp previews the hunk in a float that closes on the next key', () => {
    const vim = mk();
    vim.feedKeys(']c hp');
    expect(vim.floats[0].lines.map(l => l.text)).toEqual(['-b', '+B']);
    vim.feedKeys('j');
    expect(vim.floats).toHaveLength(0);
    expect(vim.cursor.line).toBe(2);
  });
});

describe('shared bindings (LazyVim)', () => {
  it(']h / [h walk hunks like ]c / [c, and <leader>ghs stages like <leader>hs', () => {
    const vim = mk();
    vim.feedKeys(']h');
    expect(vim.cursor.line).toBe(1);
    vim.feedKeys('[h');
    expect(vim.cursor.line).toBe(6);
    vim.feedKeys(']h]h ghs');
    expect(gitState(vim).index['x.txt']).toBe(['a', 'b', 'c', 'd', 'X', 'e', 'f', 'g', 'h'].join('\n') + '\n');
  });
});
