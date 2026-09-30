// Cursor, register and undo fidelity pinned against Neovim 0.12.5 (nvim --clean --headless,
// nostartofline, sw=2 et). Every expectation here was produced by real nvim.
import { describe, expect, it } from 'vitest';
import { Vim } from '../editor';

/** Run keys against a document. `|` in the doc marks the cursor. */
function run(doc: string, keys: string, name = 'test.txt') {
  const at = doc.indexOf('|');
  const text = at >= 0 ? doc.slice(0, at) + doc.slice(at + 1) : doc;
  const vim = new Vim({ text, name });
  if (at >= 0) {
    const before = text.slice(0, at).split('\n');
    vim.win.cursor = { line: before.length - 1, col: before[before.length - 1].length };
    vim.win.want = vim.win.cursor.col;
  }
  vim.feedKeys(keys);
  return vim;
}
/** Text with the cursor marked as |. */
function marked(v: Vim) {
  const lines = v.buf.lines.slice();
  const { line, col } = v.cursor;
  lines[line] = lines[line].slice(0, col) + '|' + lines[line].slice(col);
  return lines.join('\n');
}
const C = (doc: string, keys: string, name?: string) => marked(run(doc, keys, name));
/** [text with cursor, unnamed register text, register kind]. */
const S = (doc: string, keys: string, name?: string) => {
  const v = run(doc, keys, name);
  const r = v.registers.get('"');
  return [marked(v), r.text, r.kind];
};

describe('a charwise motion that becomes linewise sets a linewise register', () => {
  it.each([
    // [doc, keys, want (| = cursor), unnamed text, kind]
    ['|  ab\ncd\nx', 'd2e', '|x', '  ab\ncd\n', 'line'],
    ['|a\nb\n\nc', 'd}', '|\nc', 'a\nb\n', 'line'],
    ['x |a\nb\n\nc', 'd}', 'x| \n\nc', 'a\nb', 'char'],
    ['|a\nb', 'd}', '|', 'a\nb\n', 'line'],
    ['|  one\ntwo\nthree', 'd/thr<CR>', '|three', '  one\ntwo\n', 'line'],
    ['zz\n  one\ntw|o\nthree', 'd?one<CR>', 'zz\n  |o\nthree', 'one\ntw', 'char'],
    ['|one\n  two x', 'd/x<CR>', '|x', 'one\n  two ', 'char'],
    ['# vimchi\n\n|## Install (old)\n\nDownload the zip.\n\n## Usage\n\nRun vimchi.', 'd/## Usage<CR>',
      '# vimchi\n\n|## Usage\n\nRun vimchi.', '## Install (old)\n\nDownload the zip.\n\n', 'line'],
  ])('%j %s', (doc, keys, want, text, kind) => {
    expect(S(doc, keys)).toEqual([want, text, kind]);
  });
});

describe('a failed word object leaves the cursor where the search stopped', () => {
  it.each([
    ['|abc', '2diw', 'ab|c'],
    ['|abc def', '4diw', 'abc de|f'],
    ['|abc def', '5daw', 'abc de|f'],
    ['|a b', '9diw', 'a |b'],
  ])('%j %s', (doc, keys, want) => {
    expect(S(doc, keys)).toEqual([want, '', 'char']);
  });
  it.each([
    // Visual: the selection grows to where the search stopped.
    ['|abc def', 'v5iwd', '|', 'abc def'],
    ['|abc def', 'v5iw<Esc>', 'abc de|f', ''],
  ])('Visual %j %s', (doc, keys, want, text) => {
    expect(S(doc, keys)).toEqual([want, text, 'char']);
  });
  it('c5iw fails, so the next key runs as a Normal command', () => {
    expect(C('|abc def', 'c5iwX')).toBe('abc d|f');
  });
});
