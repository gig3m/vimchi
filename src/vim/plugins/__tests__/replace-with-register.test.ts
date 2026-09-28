import { describe, expect, it } from 'vitest';
import { Vim } from '../../editor';
import { replaceWithRegister } from '../replace-with-register';

function run(text: string, keys: string, cursor = { line: 0, col: 0 }) {
  const vim = new Vim({ text, name: 'a.ts', plugins: [replaceWithRegister] });
  vim.win.cursor = { ...cursor };
  vim.feedKeys(keys);
  return vim;
}

describe('ReplaceWithRegister', () => {
  it('griw replaces a word and keeps the register', () => {
    const vim = run('foo bar baz', 'yiwwgriwwgriw');
    expect(vim.buf.text()).toBe('foo foo foo');
    expect(vim.getRegister(null).text).toBe('foo');
  });
  it('is repeatable with .', () => {
    expect(run('foo bar baz', 'yiwwgriww.').buf.text()).toBe('foo foo foo');
  });
  it('grr replaces the line', () => {
    expect(run('keep\nold\nother', 'yyjgrr').buf.text()).toBe('keep\nkeep\nother');
  });
  it('uses a named register', () => {
    const vim = run('x = 1;', '"ayiwf1"agriw');
    expect(vim.buf.text()).toBe('x = x;');
  });
  it('a linewise register replaces charwise text without the newline', () => {
    expect(run('value\nf(arg)', 'yyjf(lgri(').buf.text()).toBe('value\nf(value)');
  });
  it('replaces a visual selection', () => {
    expect(run('new old', 'yiwwvegr').buf.text()).toBe('new new');
  });
  it('replaces to the end of the line', () => {
    expect(run('a = b; c', 'yiwf=wgr$').buf.text()).toBe('a = a');
  });
});
