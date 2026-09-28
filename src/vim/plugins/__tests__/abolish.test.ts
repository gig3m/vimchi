import { describe, expect, it } from 'vitest';
import { Vim } from '../../editor';
import { abolish, expandBraces } from '../abolish';

function run(text: string, keys: string, cursor = { line: 0, col: 0 }) {
  const vim = new Vim({ text, name: 'a.ts', plugins: [abolish] });
  vim.win.cursor = { ...cursor };
  vim.feedKeys(keys);
  return vim;
}

describe('vim-abolish coercion', () => {
  it.each([
    ['fooBar', 'crs', 'foo_bar'],
    ['foo_bar', 'crc', 'fooBar'],
    ['foo_bar', 'crm', 'FooBar'],
    ['fooBar', 'cru', 'FOO_BAR'],
    ['FOO_BAR', 'crc', 'fooBar'],
    ['FooBar', 'cr-', 'foo-bar'],
    ['fooBar', 'cr.', 'foo.bar'],
    ['fooBar', 'cr<Space>', 'foo bar'],
    ['foo_bar', 'crt', 'Foo Bar'],
    ['HTTPServer', 'crs', 'http_server'],
    ['user_id', 'crp', 'UserId'],
  ])('%s %s', (text, keys, want) => {
    expect(run(text, keys).buf.text()).toBe(want);
  });

  it('works on the word under the cursor and repeats with .', () => {
    const vim = run('const userName = user_id;', 'fNcrsfucrc');
    expect(vim.buf.text()).toBe('const user_name = userId;');
    expect(run('a fooBar, bazQux', 'wcrswww.').buf.text()).toBe('a foo_bar, baz_qux');
  });
});

describe(':Subvert', () => {
  it('expands braces pairwise', () => {
    expect(expandBraces('facilit{y,ies}', 'building{,s}')).toEqual([['facility', 'building'], ['facilities', 'buildings']]);
  });
  it('replaces every case variant (README example)', () => {
    const vim = run('The facility and its facilities.\nFACILITY: Facilities', ':%S/facilit{y,ies}/building{,s}/g<CR>');
    expect(vim.buf.text()).toBe('The building and its buildings.\nBUILDING: Buildings');
  });
  it('only the first match per line without g', () => {
    expect(run('child child', ':S/child/kid/<CR>').buf.text()).toBe('kid child');
  });
  it('swaps words in both directions', () => {
    expect(run('let min = max; // Min < MAX', ':S/{min,max}/{max,min}/g<CR>').buf.text()).toBe('let max = min; // Max < MIN');
  });
  it('the w flag keeps to whole words', () => {
    expect(run('user users username', ':S/user/member/gw<CR>').buf.text()).toBe('member users username');
  });
  it('undoes in one step', () => {
    const vim = run('a Box\nbox', ':%S/box/crate/g<CR>');
    expect(vim.buf.text()).toBe('a Crate\ncrate');
    vim.feedKeys('u');
    expect(vim.buf.text()).toBe('a Box\nbox');
  });
});
