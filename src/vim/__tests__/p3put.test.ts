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
  it.each([
    // j/k in Visual land on min(wanted column, line length): the end-of-line of a shorter line
    ['|abcd\nabc\nx', 'lllvjd', 'abc|x', { text: 'd\nabc\n', kind: 'char' }],
    ['|abcd\nab\nx', 'lllvjd', 'abc|x', { text: 'd\nab\n', kind: 'char' }],
    ['|abcd\nab\nx', 'lllvj<Esc>', 'abcd\na|b\nx', { text: '', kind: 'char' }],
    ['|abcd\nab\nx', 'lll<C-v>jd', 'a|b\nab\nx', { text: 'cd\n', kind: 'block' }],
    ['|abcd\nabcde\nx', 'jllll<C-v>ky', 'abc|d\nabcde\nx', { text: '\ne', kind: 'block' }],
    ['|ab\nx\nabcd', '<C-v>jly', '|ab\nx\nabcd', { text: 'ab\nx', kind: 'block' }],
  ])('%s  %s', (doc, keys, want, unnamed) => {
    const v = run(doc, keys);
    expect(C(doc, keys)).toBe(want);
    expect(reg(v)).toEqual(unnamed);
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

describe('Visual put: selection kind x register kind, p and P, counts', () => {
  const D = '|one two\nthree four\nfive six';
  const CH = { kind: 'char' } as const, LN = { kind: 'line' } as const, BL = { kind: 'block' } as const;
  it.each([
    // charwise register ("one")
    ['yiwjwviwp', 'one two\nthree on|e\nfive six', { text: 'four', ...CH }],
    ['yiwjwviw2p', 'one two\nthree oneon|e\nfive six', { text: 'four', ...CH }],
    ['yiwjwviwP', 'one two\nthree on|e\nfive six', { text: 'one', ...CH }],
    ['yiwjwviw2P', 'one two\nthree oneon|e\nfive six', { text: 'one', ...CH }],
    ['yiwjVp', 'one two\n|one\nfive six', { text: 'three four\n', ...LN }],
    ['yiwjV2p', 'one two\n|one\none\nfive six', { text: 'three four\n', ...LN }],
    ['yiwjVP', 'one two\n|one\nfive six', { text: 'one', ...CH }],
    ['yiwjV2P', 'one two\n|one\none\nfive six', { text: 'one', ...CH }],
    ['yiwj<C-v>jlp', 'one two\non|eree four\noneve six', { text: 'th\nfi', ...BL }],
    ['yiwj<C-v>jl2p', 'one two\noneon|eree four\noneoneve six', { text: 'th\nfi', ...BL }],
    ['yiwj<C-v>jlP', 'one two\non|eree four\noneve six', { text: 'one', ...CH }],
    ['yiwj<C-v>jl2P', 'one two\noneon|eree four\noneoneve six', { text: 'one', ...CH }],
    // linewise register ("one two\n")
    ['yyjwviwp', 'one two\nthree \n|one two\n\nfive six', { text: 'four', ...CH }],
    ['yyjwviw2p', 'one two\nthree \n|one two\none two\n\nfive six', { text: 'four', ...CH }],
    ['yyjwviwP', 'one two\nthree \n|one two\n\nfive six', { text: 'one two\n', ...LN }],
    ['yyjwviw2P', 'one two\nthree \n|one two\none two\n\nfive six', { text: 'one two\n', ...LN }],
    ['yyjVp', 'one two\n|one two\nfive six', { text: 'three four\n', ...LN }],
    ['yyjV2p', 'one two\n|one two\none two\nfive six', { text: 'three four\n', ...LN }],
    ['yyjVP', 'one two\n|one two\nfive six', { text: 'one two\n', ...LN }],
    ['yyjV2P', 'one two\n|one two\none two\nfive six', { text: 'one two\n', ...LN }],
    ['yyj<C-v>jlp', 'one two\nree four\nve six\n|one two', { text: 'th\nfi', ...BL }],
    ['yyj<C-v>jl2p', 'one two\nree four\nve six\n|one two\none two', { text: 'th\nfi', ...BL }],
    ['yyj<C-v>jlP', 'one two\n|one two\nree four\nve six', { text: 'one two\n', ...LN }],
    ['yyj<C-v>jl2P', 'one two\n|one two\none two\nree four\nve six', { text: 'one two\n', ...LN }],
    // blockwise register ("on\nth")
    ['<C-v>jlyjwviwp', 'one two\nthree |on\nfive sthix', { text: 'four', ...CH }],
    ['<C-v>jlyjwviw2p', 'one two\nthree |onon\nfive sththix', { text: 'four', ...CH }],
    ['<C-v>jlyjwviwP', 'one two\nthree |on\nfive sthix', { text: 'on\nth', ...BL }],
    ['<C-v>jlyjVp', 'one two\n|on\nth\nfive six', { text: 'three four\n', ...LN }],
    ['<C-v>jlyjV2p', 'one two\n|on\nth\non\nth\nfive six', { text: 'three four\n', ...LN }],
    ['<C-v>jlyjVP', 'one two\n|on\nth\nfive six', { text: 'on\nth', ...BL }],
    ['<C-v>jlyj<C-v>jlp', 'one two\n|onree four\nthve six', { text: 'th\nfi', ...BL }],
    ['<C-v>jlyj<C-v>jl2p', 'one two\n|ononree four\nththve six', { text: 'th\nfi', ...BL }],
    ['<C-v>jlyj<C-v>jlP', 'one two\n|onree four\nthve six', { text: 'on\nth', ...BL }],
  ])('%s', (keys, want, unnamed) => {
    const v = run(D, keys);
    expect(C(D, keys)).toBe(want);
    expect(reg(v)).toEqual(unnamed);
  });

  it.each([
    // a charwise register put over lines is put as lines, split at its newlines
    ['|abc\ndef\nghi', 'v$yjVp', 'abc\n|abc\n\nghi'],
    ['|one two\nthree four\nfive six', 'lllvjlyjjVp', 'one two\nthree four\n |two\nthree'],
    // a multi-line charwise register over a block is a plain charwise put
    ['|one two\nthree four\nfive six', 'lllvjlyj<C-v>jlp', 'one two\nthr| two\nthree four\nfivsix'],
    // a multi-line charwise register over a charwise selection leaves the cursor at its start
    ['|one two\nthree four\nfive six', 'lllvjlyGwviwp', 'one two\nthree four\nfive | two\nthree'],
    ['|one two\nthree four\nfive six', 'lllvjlyGwviw2p', 'one two\nthree four\nfive | two\nthree two\nthree'],
    ['|one\ntwo\nthree', 'yyV2p', '|one\none\ntwo\nthree'],
    ['|one\ntwo\nthree', 'yyV2P', '|one\none\ntwo\nthree'],
    ['|one\ntwo\nthree', 'yyjVjp', 'one\n|one'],
    ['|  one\n  two\nx', 'yyjjVp', '  one\n  two\n  |one'],
    ['|  one\n  two\nx', 'wyiwjjVp', '  one\n  two\n|one'],
    ['|  one\n  two\nx', 'yyjwviwp', '  one\n  \n  |one\n\nx'],
    ['|one\ntwo', 'yiwggVG2p', '|one\none'],
    ['|one\ntwo', 'yyggVGp', '|one'],
    // a one-line charwise register is put on every line of a block, skipping short lines
    ['|ab\nx\nabcd', 'yiwjj<C-v>kkp', 'a|bb\nab\nabbcd'],
    ['|ab\nx\nabcd', 'yiwjjl<C-v>kkp', 'aa|b\nxab\naabcd'],
    ['|ab\nxy\nabcd', 'yiwjjll<C-v>kkp', 'aba|b\nxyab\nababd'],
    ['|ab\nx\nabcd', 'yiwjjll<C-v>kkp', 'aba|b\nx\nababd'], // a line ending before the block is skipped
    ['|ab\nx\nabcd', '<C-v>jlyjjl<C-v>kkp', 'a|ab\nxx\nacd'],
  ])('%s  %s', (doc, keys, want) => {
    expect(C(doc, keys)).toBe(want);
  });

  it.each([
    // linewise register over a block: p puts below the line the Visual cursor was on, P above the block
    ['|one two\none two', 'yyj<C-v>lp', 'one two\ne two\n|one two', 'on'],
    ['|one two\none two', 'yyj<C-v>lP', 'one two\n|one two\ne two', 'one two\n'],
    ['|one two\none two', 'yyj<C-v>l2p', 'one two\ne two\n|one two\none two', 'on'],
    ['|  ab\n  cd\nx', 'yyG<C-v>p', '  ab\n  cd\n\n  |ab', 'x'],
    ['|  ab\n  cd\nx', 'jjyyk<C-v>kp', ' ab\n|x\n cd\nx', ' \n '],
    ['|  ab\n  cd\nx', 'jjyyk<C-v>kP', '|x\n ab\n cd\nx', 'x\n'],
  ])('%s  %s', (doc, keys, want, unnamed) => {
    const v = run(doc, keys);
    expect(C(doc, keys)).toBe(want);
    expect(reg(v).text).toBe(unnamed);
  });
});

describe('the unnamed register follows yanks and deletes, not raw writes', () => {
  const D = '|one\ntwo\nthree';
  it.each([
    // :let @r and macro recording leave "" alone
    ['yy:let @a = "X"<CR>p', 'one\n|one\ntwo\nthree', 'one\n'],
    ['yy:let @A = "X"<CR>p', 'one\n|one\ntwo\nthree', 'one\n'],
    ['yy:let @- = "X"<CR>p', 'one\n|one\ntwo\nthree', 'one\n'],
    ['yy:let @1 = "X"<CR>p', 'one\n|one\ntwo\nthree', 'one\n'],
    ['x:let @a = "X"<CR>p', 'n|oe\ntwo\nthree', 'o'],
    ['yyjqaxqp', 'one\nw|to\nthree', 't'],
    ['yyjqaxqqAxqp', 'one\no|w\nthree', 'w'],
    // :let @" writes "0 and "" with it
    ['yy:let @" = "X"<CR>p', 'o|Xne\ntwo\nthree', 'X'],
    ['yy:let @0 = "X"<CR>p', 'o|Xne\ntwo\nthree', 'X'],
    // yanks and deletes into a named register do set ""
    ['"ayyjp', 'one\ntwo\n|one\nthree', 'one\n'],
    ['"ayyj"Ayyp', 'one\ntwo\n|one\ntwo\nthree', 'one\ntwo\n'],
    ['"addp', 'two\n|one\nthree', 'one\n'],
    ['yy"_ddp', 'two\n|one\nthree', 'one\n'],
  ])('%s', (keys, want, unnamed) => {
    const v = run(D, keys);
    expect(C(D, keys)).toBe(want);
    expect(reg(v).text).toBe(unnamed);
  });
  it('recording keeps the macro in its register', () => {
    const v = run(D, 'qaxq:let @b = "Y"<CR>');
    expect(reg(v, 'a').text).toBe('x');
    expect(reg(v, 'b').text).toBe('Y');
  });
});

describe('r<Tab> and r<CR>', () => {
  it.each([
    // expandtab, sw=2, ts=8, smarttab (nvim default): a tab in the indent is shiftwidth wide
    ['|  abc', 'r<Tab>', ' |  abc'],
    ['|    abc', 'llr<Tab>', '   |  abc'],
    ['|    abc', '4lr<Tab>', '     | bc'],
    ['|    abc', '3r<Tab>', '     |  abc'],
    ['|abcdef', '2r<Tab>', '   | cdef'],
    ['|\tabc', 'lr<Tab>', '\t | bc'],
    // outside the indent it reaches the next tabstop
    ['|abcdef', 'lr<Tab>', 'a      | cdef'],
    ['|abcdef', 'l3r<Tab>', 'a' + ' '.repeat(22) + '|' + ' ef'],
    ['|ab\tcd', 'lr<Tab>', 'a      | \tcd'],
    ['|abcdef', 'lr<Tab>.', 'a      | cdef'],
    // noexpandtab: real tabs, except a partial shiftwidth in the indent
    ['|abcdef', ':set noet<CR>lr<Tab>', 'a|\tcdef'],
    ['|abcdef', ':set noet<CR>l2r<Tab>', 'a\t|\tdef'],
    ['|    abc', ':set noet<CR>r<Tab>', ' |    abc'],
    // r<CR> replaces [count] characters with ONE line break; without 'autoindent' nothing is stripped
    ['|  abc', ':set noai<CR>r<CR>', '\n| abc'],
    ['|  abc', ':set noai<CR>llr<CR>', '  \n|bc'],
    ['|ab  cd', ':set noai<CR>llr<CR>', 'ab\n| cd'],
    ['|ab  cd', ':set noai<CR>lllr<CR>', 'ab \n|cd'],
    ['|abcdef', ':set noai<CR>l3r<CR>', 'a\n|ef'],
    ['|abcdef', ':set noai<CR>l9r<CR>', 'a|bcdef'],
    ['|abcdef', ':set noai<CR>lr<CR>.', 'a\n\n|def'],
    // with 'autoindent' the new line takes the first part's indent and the rest loses its leading blanks
    ['|  abc', 'r<CR>', '\n|abc'],
    ['|  abc', 'llr<CR>', '  \n | bc'],
    ['|    abcdef', '5lr<CR>', '    a\n   | cdef'],
    ['|    abcdef', '5l2r<CR>', '    a\n   | def'],
    ['|  ab  cd', '5lr<CR>', '  ab \n | cd'],
    ['|    abcdef', '5lr<CR>.', '    a\n   \n  | cdef'],
    // <Esc> cancels, dropping the count
    ['|abcdef', 'r<Esc>', '|abcdef'],
    ['|abcdef', '3r<Esc>x', '|bcdef'],
    // Visual r puts the literal character
    ['|abcdef', 'lvlr<CR>', 'a|\r\rdef'],
    ['|abcdef', 'lvlr<Tab>', 'a|\t\tdef'],
  ])('%j  %s', (doc, keys, want) => {
    expect(C(doc, keys)).toBe(want);
  });
});

describe('J / gJ', () => {
  it.each([
    // J keeps the first line's trailing blanks, drops the next line's leading ones, and adds one
    // space unless the line already ends in a blank, either side is empty, or the next starts with ')'.
    // The cursor lands on the join point.
    ['|one  \n two', 'J', 'one  |two'],
    ['|one\n two', 'J', 'one| two'],
    ['|one\n)two', 'J', 'one|)two'],
    ['|one\n  )two', 'J', 'one|)two'],
    ['|one \n)two', 'J', 'one |)two'],
    ['|one\n\ttwo', 'J', 'one| two'],
    ['|one\t\ntwo', 'J', 'one\t|two'],
    ['|one\n\ntwo', 'J', 'on|e\ntwo'],
    ['|\ntwo', 'J', '|two'],
    ['|one\n   ', 'J', 'on|e'],
    ['|one\n  two  ', 'J', 'one| two  '],
    ['|one.\ntwo', 'J', 'one.| two'],
    ['|one\ntwo', 'J.', 'one| two'],
    ['|a', 'J', '|a'],
    ['|a\n b\n c\nd', '3J', 'a b| c\nd'],
    ['|a \n b\n  c', '3J', 'a b| c'],
    ['|a\n\n\nb', '3J', '|a\nb'],
    ['|a\n b', '5J', 'a| b'],
    ['|a\n b\n c', 'VjjJ', 'a b| c'],
    // gJ inserts and removes nothing
    ['|one  \n two', 'gJ', 'one  | two'],
    ['|one\n  two', 'gJ', 'one|  two'],
    ['|one \n  two', 'gJ', 'one |  two'],
    ['|a\n b\nc', '3gJ', 'a b|c'],
    ['|a\n b\n c', 'VjjgJ', 'a b| c'],
  ])('%j  %s', (doc, keys, want) => {
    expect(C(doc, keys)).toBe(want);
  });
});
