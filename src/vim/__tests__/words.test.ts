// Word motions under operators, counted word text objects, and command-line
// history. Every expectation here was confirmed in `nvim --clean` (v0.12.5).
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
/** [buffer text, unnamed register text, register kind]. */
const R = (doc: string, keys: string) => {
  const v = run(doc, keys);
  const r = v.registers.get('"');
  return [v.buf.text(), r.text, r.kind];
};

describe('w / W under an operator', () => {
  it.each([
    // Counted dw across whole lines: the last word ends its line, so the delete
    // becomes linewise (:help d).
    ['|one\ntwo\nthree', '2dw', 'three', 'one\ntwo\n', 'line'],
    ['|one\ntwo\nthree', 'd2w', 'three', 'one\ntwo\n', 'line'],
    ['|o.e\nt.o\nthree', '2dW', 'three', 'o.e\nt.o\n', 'line'],
    ['|one.two\nthree', '2dW', '', 'one.two\nthree\n', 'line'],
    ['|one  \ntwo\nthree', '2dw', 'three', 'one  \ntwo\n', 'line'],
    ['  |one\ntwo\nthree', '2dw', 'three', '  one\ntwo\n', 'line'],
    ['|  one\ntwo\nthree', '3dw', 'three', '  one\ntwo\n', 'line'],
    // Not in the indent: stays characterwise.
    ['a |one\ntwo\nthree', '2dw', 'a \nthree', 'one\ntwo', 'char'],
    ['a |one\n  two\nthree', '2dw', 'a \nthree', 'one\n  two', 'char'],
    ['a |one\ntwo three\nfour', '3dw', 'a \nfour', 'one\ntwo three', 'char'],
    // Nonblank intervening lines: the count lands mid-line.
    ['|one\n  two x\nthree', '2dw', 'x\nthree', 'one\n  two ', 'char'],
    ['|one\ntwo three', '2dw', 'three', 'one\ntwo ', 'char'],
    // Blank intervening lines: an empty line is a word stop.
    ['|one\n\nthree', '2dw', 'three', 'one\n\n', 'line'],
    ['|one\n\n\nthree', '2dw', '\nthree', 'one\n\n', 'line'],
    ['|one\n\n\nthree', '3dw', 'three', 'one\n\n\n', 'line'],
    ['a |one\n\nthree', '2dw', 'a \nthree', 'one\n', 'char'],
    ['|one\n\nx', '2dw', 'x', 'one\n\n', 'line'],
    ['|x\na\nb', '2dvw', 'a\nb', 'x\n', 'line'],
    // A whitespace-only line is not a stop.
    ['|one\n  \nthree', '2dw', '', 'one\n  \nthree\n', 'line'],
    // dw on the last word of a line never joins.
    ['|one\ntwo\nthree', 'dw', '\ntwo\nthree', 'one', 'char'],
    ['|one\n\nthree', 'dw', '\n\nthree', 'one', 'char'],
    ['one |two\nthree', 'dw', 'one \nthree', 'two', 'char'],
    ['one |two  \nthree', 'dw', 'one \nthree', 'two  ', 'char'],
    ['one tw|o\nthree', 'dw', 'one tw\nthree', 'o', 'char'],
    // dw on an empty line deletes the line.
    ['a\n|\nb', 'dw', 'a\nb', '\n', 'line'],
    ['a\n|\n\nb', '2dw', 'a\nb', '\n\n', 'line'],
    // At the end of the buffer.
    ['one\n|two', 'dw', 'one\n', 'two', 'char'],
    ['one\n|two', '2dw', 'one\n', 'two', 'char'],
    ['|one\ntwo', '5dw', '', 'one\ntwo\n', 'line'],
    ['x |one\ntwo', '5dw', 'x ', 'one\ntwo', 'char'],
    ['x |one\ntwo', 'd5w', 'x ', 'one\ntwo', 'char'],
    ['one two\nthre|e', 'dw', 'one two\nthre', 'e', 'char'],
    ['|one\ntwo\nthree', 'd2w.', '', 'three', 'char'],
    // Yank keeps the same range but never turns linewise.
    ['|one\ntwo\nthree', '2yw', 'one\ntwo\nthree', 'one\ntwo', 'char'],
    ['x |one\ntwo', '5yw', 'x one\ntwo', 'one\ntwo', 'char'],
    // cw: on a word it is ce; on blanks and empty lines it is dw.
    ['|one\ntwo\nthree', '2cwX<Esc>', 'X\nthree', 'one\ntwo', 'char'],
    ['|one\n\nthree', '2cwX<Esc>', 'X', 'one\n\nthree', 'char'],
    ['|one\ntwo', '5cwX<Esc>', 'X', 'one\ntwo', 'char'],
    ['one| \ntwo\nthree', 'cwX<Esc>', 'oneX\ntwo\nthree', ' ', 'char'],
    ['one| \ntwo\nthree', '2cwX<Esc>', 'oneX\nthree', ' \ntwo', 'char'],
    ['one| \n two\nthree', '2cwX<Esc>', 'oneX\nthree', ' \n two', 'char'],
    ['one| \n\nthree', '2cwX<Esc>', 'oneX\nthree', ' \n', 'char'],
    ['a\n|\nb', 'cwX<Esc>', 'a\nX\nb', '\n', 'line'],
    // o_v toggles the (end-of-line adjusted) inclusive end back to exclusive.
    ['|one\ntwo\nthree', '2dvw', 'o\nthree', 'one\ntw', 'char'],
    ['|one\ntwo\nthree', '2dVw', 'three', 'one\ntwo\n', 'line'],
  ])('%j  %s', (doc, keys, text, reg, kind) => {
    expect(R(doc, keys)).toEqual([text, reg, kind]);
  });
});

describe('counted word text objects', () => {
  it.each([
    // Counts cross line boundaries; the line break itself is not a word.
    ['|one\ntwo\nthree', '2diw', 'three', 'one\ntwo\n', 'line'],
    ['|one\ntwo\nthree', 'd2iw', 'three', 'one\ntwo\n', 'line'],
    ['|one\ntwo\nthree', '2daw', 'three', 'one\ntwo\n', 'line'],
    ['|one\ntwo\nthree', '3diw', '', 'one\ntwo\nthree\n', 'line'],
    ['|one\ntwo\nthree', '3daw', '', 'one\ntwo\nthree\n', 'line'],
    ['one|two\nthree', '2diw', '', 'onetwo\nthree\n', 'line'],
    ['|one\ntwo\nthree', '2yiw', 'one\ntwo\nthree', 'one\ntwo', 'char'],
    ['one\n|two\nthree', '2yaw', 'one\ntwo\nthree', 'two\nthree', 'char'],
    ['|one\ntwo\nthree', '2ciwX<Esc>', 'X\nthree', 'one\ntwo', 'char'],
    ['  |one\n  two\nthree', '2diw', '  two\nthree', 'one\n  ', 'char'],
    ['  |one\n  two\nthree', '4diw', '', '  one\n  two\nthree\n', 'line'],
    ['a |b.c\nd.e f', '2diW', 'a  f', 'b.c\nd.e', 'char'],
    ['a |b.c\nd.e f', '2daW', 'a f', 'b.c\nd.e ', 'char'],
    ['a |b.c\nd.e f', '3daW', 'a', ' b.c\nd.e f', 'char'],
    // aw with trailing blanks at the end of a line runs onto the next line.
    ['abc |def  \nghi', '2daw', 'abc', ' def  \nghi', 'char'],
    ['abc |def  \nghi jkl', '2daw', 'abc jkl', 'def  \nghi ', 'char'],
    ['abc |def  \nghi jkl', 'daw', 'abc \nghi jkl', 'def  ', 'char'],
    ['abc  | \nx', 'daw', 'abc', '   \nx', 'char'],
    ['  |abc', 'daw', '  ', 'abc', 'char'],
    ['|  abc', 'daw', '', '  abc', 'char'],
    ['foo |bar baz', '2yaw', 'foo bar baz', ' bar baz', 'char'],
    // A blank line is a word for iw / aw.
    ['|one\n\nthree', '2diw', 'three', 'one\n\n', 'line'],
    ['|one\n\nthree', '3diw', '', 'one\n\nthree\n', 'line'],
    ['|one\n\nthree', '2daw', '', 'one\n\nthree\n', 'line'],
    ['|one\n\nthree', '2yiw', 'one\n\nthree', 'one\n\n', 'line'],
    ['|one\n\nthree', '2ciwX<Esc>', 'X\nthree', 'one\n\n', 'line'],
    ['a |one\n\nthree', '2diw', 'a \nthree', 'one\n', 'char'],
    ['a |one\n\nthree', '2daw', 'a', ' one\n\nthree', 'char'],
    ['a\n|\nb', 'daw', 'a', '\nb\n', 'line'],
    ['a\n|\nb', '2diw', 'a', '\nb\n', 'line'],
    ['a\n|\n\nb', '2diw', 'a\nb', '\n\n', 'line'],
    // iw on an empty line is an empty region: nothing is deleted or joined.
    ['a\n|\nb', 'yiw', 'a\n\nb', '', 'char'],
    ['a\n|\nb', 'ciwX<Esc>', 'a\nX\nb', '', 'char'],
    // Same-line counts keep working.
    ['|abc def', '2diw', 'def', 'abc ', 'char'],
    ['|abc def', '3diw', '', 'abc def', 'char'],
    ['fo|o, bar', '2diw', ' bar', 'foo,', 'char'],
    ['fo|o, bar', '2daw', 'bar', 'foo, ', 'char'],
    // A count that cannot be satisfied fails and changes nothing.
    ['|abc', '2diw', 'abc', '', 'char'],
    ['|abc', '2daw', 'abc', '', 'char'],
    ['abc |def', '2diw', 'abc def', '', 'char'],
    ['|abc def', '4diw', 'abc def', '', 'char'],
    ['abc  | ', 'daw', 'abc   ', '', 'char'],
    ['foo bar |baz', '2yaw', 'foo bar baz', '', 'char'],
    ['foo |bar baz', '3yaw', 'foo bar baz', '', 'char'],
  ])('%j  %s', (doc, keys, text, reg, kind) => {
    expect(R(doc, keys)).toEqual([text, reg, kind]);
  });
  it('diw on an empty line changes nothing', () => {
    expect(run('a\n|\nb', 'diw').buf.text()).toBe('a\n\nb');
    expect(run('a\n|\nb', 'diwix<Esc>').buf.text()).toBe('a\nx\nb');
  });

  /** Visual selection as "anchor-cursor", both line:col. */
  const sel = (doc: string, keys: string) => {
    const v = run(doc, keys);
    const a = v.visual!.anchor, c = v.cursor;
    return `${a.line}:${a.col}-${c.line}:${c.col}`;
  };
  it.each([
    ['|one\ntwo\nthree', 'v2iw', '0:0-1:2'],
    ['|one\ntwo\nthree', 'viwiw', '0:0-1:2'],
    ['|one\ntwo\nthree', 'viwiwiw', '0:0-2:4'],
    ['|one\ntwo\nthree', 'v2aw', '0:0-1:2'],
    ['|one two three', 'v2iw', '0:0-0:3'],
    ['|one two three', 'viwiwiw', '0:0-0:6'],
    ['|one\n\nthree', 'v2iw', '0:0-2:0'],
    ['a\n|\nb', 'viw', '1:0-1:0'],
    // Growing backwards from a cursor before the anchor.
    ['foo bar |baz', 'vbiw', '0:8-0:3'],
    ['foo bar |baz', 'vbbiw', '0:8-0:0'],
    ['foo bar |baz', 'vbaw', '0:8-0:0'],
    ['foo bar\nba|z', 'vbaw', '1:2-0:3'],
    ['foo bar\nba|z', 'vkiw', '1:2-0:0'],
  ])('%j  %s', (doc, keys, want) => {
    expect(sel(doc, keys)).toBe(want);
  });
  it.each([
    ['|one\ntwo\nthree', 'v2iwd', '\nthree', 'one\ntwo'],
    ['|one\ntwo\nthree', 'v2awd', '\nthree', 'one\ntwo'],
    ['a\n|\nb', 'viwd', 'a\nb', '\n'],
  ])('%j  %s', (doc, keys, text, reg) => {
    expect(R(doc, keys).slice(0, 2)).toEqual([text, reg]);
  });
});

describe('command-line history <Up> / <Down>', () => {
  const H = '/one<CR>/two<CR>';
  it.each([
    // The text typed before the first <Up> is a prefix filter.
    [H + '/o<Up><CR>', 'one'],
    [H + '/t<Up><CR>', 'two'],
    [H + '/o<Up><Up><CR>', 'one'],
    // <Down> past the newest match brings back what was typed.
    [H + '/o<Up><Down><CR>', 'o'],
    [H + '/o<Up><Up><Down><CR>', 'o'],
    // An empty prefix walks every entry.
    [H + '/<Up><CR>', 'two'],
    [H + '/<Up><Up><CR>', 'one'],
    [H + '/<Up><Up><Down><CR>', 'two'],
    [H + '/<Up><Down><CR>', 'two'],
    // No match: the typed text stays.
    [H + '/x<Up><CR>', 'x'],
    [H + '/o<Down><CR>', 'o'],
    // The prefix is the text before the cursor.
    [H + '/ox<Left><Up><CR>', 'one'],
    // Each step keeps matching the original prefix.
    ['/on<CR>' + H + '/o<Up><Up><CR>', 'on'],
    ['/on<CR>' + H + '/on<Up><Up><CR>', 'on'],
    ['/on<CR>' + H + '/on<Up><Up><Up><CR>', 'on'],
    // Editing starts a new prefix but keeps the place in history.
    [H + '/o<Up>x<Up><CR>', 'onex'],
    [H + '/o<Up><BS><Up><CR>', 'on'],
  ])('%s', (keys, want) => {
    expect(run('|one two\none two', keys).registers.get('/').text).toBe(want);
  });
  it.each([
    [':s/a/A/<CR>:s/b/B/<CR>:s/c/C/<CR>u:s/a<Up><CR>', 'A B c'],
    [':s/a/A/<CR>:s/b/B/<CR>u:s<Up><Up><CR>', 'A b c'],
    [':s/a/A/<CR>:s/b/B/<CR>uu:s/b<Up><Down><CR>', 'a  c'],
    [':s/a/A/<CR>:s/b/B/<CR>uu:<Up><Up><CR>', 'A b c'],
  ])('%s', (keys, want) => {
    expect(run('|a b c', keys).buf.text()).toBe(want);
  });
});
