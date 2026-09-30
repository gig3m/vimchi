// Behaviours pinned against Neovim 0.12 (nvim --clean --headless): Visual `$`,
// Visual put, :let @r, r<Tab>/r<CR>, J. Every expectation here was checked in nvim.
import { describe, expect, it } from 'vitest';
import { Vim } from '../editor';

/** Run keys against a document. `|` in the doc marks the cursor. */
function run(doc: string, keys: string) {
  const at = doc.indexOf('|');
  const text = at >= 0 ? doc.slice(0, at) + doc.slice(at + 1) : doc;
  const vim = new Vim({ text, name: 'test.txt' });
  if (at >= 0) {
    const before = text.slice(0, at).split('\n');
    vim.win.cursor = { line: before.length - 1, col: before[before.length - 1].length };
    vim.win.want = vim.win.cursor.col;
  }
  vim.feedKeys(keys);
  return vim;
}
/** Text with the cursor marked as |. */
const C = (doc: string, keys: string) => {
  const v = run(doc, keys);
  const lines = v.buf.lines.slice();
  const { line, col } = v.cursor;
  lines[line] = lines[line].slice(0, col) + '|' + lines[line].slice(col);
  return lines.join('\n');
};
const reg = (v: Vim, name = '"') => v.registers.get(name);

describe('Visual $ selects the end-of-line', () => {
  it.each([
    // [doc, keys, want (| = cursor), unnamed text]
    ['|abc\ndef', 'v$d', '|def', 'abc\n'],
    ['abc\n|def', 'v$d', 'abc\n|', 'def'], // last line: no newline to take
    ['|abc\ndef\nghi', 'v$jd', '|ghi', 'abc\ndef\n'],
    ['|abc\ndef\nghi', 'vj$d', '|ghi', 'abc\ndef\n'],
    ['|abc\ndef\nghi', 'v$jhd', '|\nghi', 'abc\ndef'],
    ['|abc\ndef\nghi', 'v$hd', '|\ndef\nghi', 'abc'],
    ['|abc\ndef\nghi', 'v$ggd', '|def\nghi', 'abc\n'],
    ['|abc\ndef\nghi', 'v$x', '|def\nghi', 'abc\n'],
    ['abc\n|\nghi', 'v$d', 'abc\n|ghi', '\n'],
    ['|abc\ndef', 'vllllld', '|def', 'abc\n'], // l in Visual reaches the newline too
    ['a|bc\ndef\nghi', 'v$<Esc>gvd', 'a|def\nghi', 'bc\n'],
    ['|abc\ndef\nghi', 'v2$d', '|ghi', 'abc\ndef\n'],
    ['|abc\ndef\nghi', 'v<End>d', '|def\nghi', 'abc\n'],
    ['|abc\ndef\nghi', 'v$cX<Esc>', '|Xdef\nghi', 'abc\n'],
  ])('%s  %s', (doc, keys, want, unnamed) => {
    const v = run(doc, keys);
    expect(C(doc, keys)).toBe(want);
    expect(reg(v)).toEqual({ text: unnamed, kind: 'char' });
  });
  it.each([
    ['|abc\ndef', 'v$y', 'abc\n'],
    ['|abc\ndef', 'v$ly', 'abc\n'],
    ['|abc\ndef\nghi', 'v$jy', 'abc\ndef\n'],
    ['abc\n|def\nghi', 'v$ky', '\nd'],
    ['|abc\ndef', 'vlllhy', 'abc'],
  ])('%s  %s yanks charwise with the newline', (doc, keys, text) => {
    const v = run(doc, keys);
    expect(reg(v)).toEqual({ text, kind: 'char' });
    expect(reg(v, '0')).toEqual({ text, kind: 'char' });
  });
  it('Esc after v$j leaves the cursor on the last character', () => {
    expect(C('|abc\ndef', 'v$j<Esc>')).toBe('abc\nde|f');
  });
  it.each([
    // dot-repeat of a Visual change reaches across the line break like nvim
    ['|one\ntwo\nthree', 'vld.', '|two\nthree'],
    ['|one\ntwo\nthree', 'vld2.', '|two\nthree'],
    ['|one two three', 'vld2.', '|two three'],
    ['|abcdef\nx\ny', 'vlldj0.', 'def\n|y'],
    ['a|bc\ndef\nghi', 'v$d.', 'a|ghi'],
    ['a|bcd\nx\nyy', 'v$dj0.', 'ax\n|'],
  ])('%s  %s', (doc, keys, want) => {
    expect(C(doc, keys)).toBe(want);
  });
});
