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
