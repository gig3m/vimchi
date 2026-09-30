import { describe, expect, it } from 'vitest';
import { Vim } from '../editor';

/** Run keys against a document. `|` in the doc marks the cursor. */
function run(doc: string, keys: string, opts: { files?: Record<string, string> } = {}) {
  const at = doc.indexOf('|');
  const text = at >= 0 ? doc.slice(0, at) + doc.slice(at + 1) : doc;
  const vim = new Vim({ text, name: 'test.ts', files: opts.files });
  if (at >= 0) {
    const before = text.slice(0, at).split('\n');
    vim.win.cursor = { line: before.length - 1, col: before[before.length - 1].length };
    vim.win.want = vim.win.cursor.col;
  }
  vim.feedKeys(keys);
  return vim;
}
const T = (doc: string, keys: string) => run(doc, keys).buf.text();
/** Text with the cursor marked as |. */
const C = (doc: string, keys: string) => {
  const v = run(doc, keys);
  const lines = v.buf.lines.slice();
  const { line, col } = v.cursor;
  lines[line] = lines[line].slice(0, col) + '|' + lines[line].slice(col);
  return lines.join('\n');
};

describe('motions', () => {
  it(':N keeps the wanted column with nostartofline', () => {
    const v = run('abcdefghi\nab\nabcdefghijk', '');
    v.win.cursor = { line: 1, col: 1 }; v.win.want = 8;
    v.feedKeys(':2<CR>j');
    expect(v.cursor).toEqual({ line: 2, col: 8 });
    v.feedKeys('$:2<CR>j');
    expect(v.cursor).toEqual({ line: 2, col: 10 });
  });
  it.each([
    ['|foo bar baz', 'w', 'foo |bar baz'],
    ['|foo bar baz', '2w', 'foo bar |baz'],
    ['foo bar |baz', 'b', 'foo |bar baz'],
    ['|foo bar', 'e', 'fo|o bar'],
    ['foo |bar', 'ge', 'fo|o bar'],
    ['|a.b c.d', 'W', 'a.b |c.d'],
    ['a.b |c.d', 'B', '|a.b c.d'],
    ['|  abc', '$', '  ab|c'],
    ['  ab|c', '0', '|  abc'],
    ['ab|c', '^', '|abc'],
    ['  ab|c', '^', '  |abc'],
    ['|a,b,c,d', 'f,', 'a|,b,c,d'],
    ['|a,b,c,d', '2f,', 'a,b|,c,d'],
    ['|a,b,c,d', 'f,;', 'a,b|,c,d'],
    ['|a,b,c,d', 'f,;,', 'a|,b,c,d'],
    ['|a,b,c,d', 't,', '|a,b,c,d'],
    ['|a,b,c,d', 't,;', 'a,|b,c,d'],
    ['a,b,c|', 'F,', 'a,b|,c'],
    ['a,b,c|', 'T,', 'a,b,|c'],
    ['|f(a, b)', '%', 'f(a, b|)'],
    ['f(a, b|)', '%', 'f|(a, b)'],
    ['|a\nb\n\nc', '}', 'a\nb\n|\nc'],
    ['a\nb\n\n|c', '{', 'a\nb\n|\nc'],
    ['|a\nb\nc', 'G', 'a\nb\n|c'],
    ['a\nb\n|c', 'gg', '|a\nb\nc'],
    ['|a\nb\nc', '2G', 'a\n|b\nc'],
    // Neovim's default is nostartofline: line jumps keep the column (clamped), like j/k.
    ['abc|def\n  ghijkl', 'G', 'abcdef\n  g|hijkl'],
    ['abcdef\n  gh|ijkl', 'gg', 'abcd|ef\n  ghijkl'],
    ['abc|def\n  ghijkl\nx', '2G', 'abcdef\n  g|hijkl\nx'],
    ['abc|def\n  ghijkl\nx', ':2<CR>', 'abcdef\n  g|hijkl\nx'],
    ['abcdef\n  gh|ijkl\nx', ':1<CR>', 'abcd|ef\n  ghijkl\nx'],
    ['abcdefgh|i\nab', 'G', 'abcdefghi\na|b'],
    ['abc|def\n  ghijkl', ':set startofline<CR>G', 'abcdef\n  |ghijkl'],
    // …and so do the linewise operators and page scrolls.
    ['abcdef\n  gh|ijkl\n  mnopqr', 'dd', 'abcdef\n  mn|opqr'],
    ['abcdef\n  gh|ijkl', '>>', 'abcdef\n    |ghijkl'],
    ['abcdef\n    gh|ijkl', '<<', 'abcdef\n  ghij|kl'],
    ['abc|def\nghijkl', 'Vj>', '  a|bcdef\n  ghijkl'],
    ['abcdef\n  gh|ijkl\n  mnopqr', ':set sol<CR>dd', 'abcdef\n  |mnopqr'],
    ['abc|def\n  ghijkl', ':set sol<CR>:2<CR>', 'abcdef\n  |ghijkl'],
    ['|abc\nd', 'jk', '|abc\nd'],
    ['ab|c\nd\nefg', 'jj', 'abc\nd\nef|g'],
    ['abc|\nabcdef', '$j', 'abc\nabcde|f'],
    ['|a\n  b', '+', 'a\n  |b'],
    ['|x foo x', '*', 'x foo |x'],
    ['x foo |x', '#', '|x foo x'],
    ['|foo bar foo', '/foo\n', 'foo bar |foo'],
    ['|a x a x a', '/x\nn', 'a x a |x a'],
    ['|a x a x a', '/x\nnN', 'a |x a x a'],
    ['|foo bar', '/bar/e\n', 'foo ba|r'],
    ['|a\nb\nfoo', '/foo/-1\n', 'a\n|b\nfoo'],
    ['|a\nfoo\n  bar', '/foo/+1\n', 'a\nfoo\n|  bar'],
    ['|one. two. three.', ')', 'one. |two. three.'],
  ])('%s  %s', (doc, keys, want) => {
    expect(C(doc, keys.replace(/\n/g, '<CR>'))).toBe(want);
  });

  it('marks', () => {
    expect(C('a|b\nb\nc', 'majj`a')).toBe('a|b\nb\nc');
    expect(C('  ab\nb\n|c', "kkllmaG'a")).toBe('  |ab\nb\nc');
    // `. and g; land on the last typed character, not after it.
    expect(C('|let x = 1;\ny', 'wciwtotal<Esc>j`.')).toBe('let tota|l = 1;\ny');
    expect(C('|let x = 1;\ny', 'A // ok<Esc>jg;')).toBe('let x = 1; // o|k\ny');
    // `] after a linewise put is the last character of the last put line.
    expect(C('|abc\nxy', 'yjGp`]')).toBe('abc\nxy\nabc\nx|y');
  });

  it('jumplist', () => {
    expect(C('|a\nb\nc\nd', 'G<C-o>')).toBe('|a\nb\nc\nd');
    expect(C('|a\nb\nc\nd', 'G<C-o><C-i>')).toBe('a\nb\nc\n|d');
    expect(C('|a\nb\nc\nd', 'G``')).toBe('|a\nb\nc\nd');
  });
});

describe('operators', () => {
  it.each([
    ['|foo bar baz', 'dw', 'bar baz'],
    ['a\n// |one\n// two\nb', 'gcgc', 'a\none\ntwo\nb'],
    ['a\n// |one\n// two\nb', 'dgc', 'a\nb'],
    ['|x\ny', 'gcc', '// x\ny'],
    ['|x\ny\nz', 'Vjgc', '// x\n// y\nz'],
    ['foo |bar', 'dw', 'foo '],
    ['|foo bar\nbaz', 'wdw', 'foo \nbaz'],
    ['|foo bar baz', 'd2w', 'baz'],
    ['|foo bar baz', '2dw', 'baz'],
    ['|foo bar', 'de', ' bar'],
    ['foo |bar', 'db', 'bar'],
    ['|a,b,c', 'dt,', ',b,c'],
    ['|a,b,c', 'df,', 'b,c'],
    ['|a\nb\nc', 'dd', 'b\nc'],
    ['|a\nb\nc', '2dd', 'c'],
    ['|a\nb\nc', 'dj', 'c'],
    ['a\nb\n|c', 'dk', 'a'],
    ['abc |def', 'D', 'abc '],
    ['abc |def', 'd$', 'abc '],
    ['  abc |def', 'd0', 'def'],
    ['  abc |def', 'd^', '  def'],
    ['|a\nb\nc\nd', 'dG', ''],
    ['a\nb\n|c\nd', 'dgg', 'd'],
    ['|foo bar', 'cwX<Esc>', 'X bar'],
    ['|foo  bar', 'cwX<Esc>', 'X  bar'],
    ['fo|o bar', 'cwX<Esc>', 'foX bar'],
    ['foo| bar', 'cwX<Esc>', 'fooXbar'],
    ['|ab cd', 'c2wX<Esc>', 'X'],
    ['  |abc', 'ccX<Esc>', '  X'],
    ['abc |def', 'CX<Esc>', 'abc X'],
    ['|abc', 'sX<Esc>', 'Xbc'],
    ['  |abc', 'SX<Esc>', '  X'],
    ['|abc', '3x', ''],
    ['ab|c', 'X', 'ac'],
    ['|a\nb', 'yyp', 'a\na\nb'],
    ['|a\nb', 'yyjP', 'a\na\nb'],
    ['|ab', 'xp', 'ba'],
    ['|a\nb', 'ddp', 'b\na'],
    ['|abc def', 'yiwP', 'abcabc def'],
    ['abc |def', 'Yp', 'abc ddefef'],
    ['|a\nb\nc', 'Jx', 'ab\nc'],
    ['|a\n  b', 'J', 'a b'],
    ['|a\n  b', 'gJ', 'a  b'],
    ['|a\nb\nc', '3J', 'a b c'],
    ['|hello world', 'gUiw', 'HELLO world'],
    ['|Hello', 'g~~', 'hELLO'],
    ['|ABC', 'guu', 'abc'],
    ['|abc', 'gUU', 'ABC'],
    ['|abc', 'gUgU', 'ABC'],
    ['|abc', '~~', 'ABc'],
    ['|abc', 'g??', 'nop'],
    ['|x', '>>', '  x'],
    ['  |x', '<<', 'x'],
    ['|a\nb', '2>>', '  a\n  b'],
    ['|a\nb\nc', '>j', '  a\n  b\nc'],
    ['|n = 5', '<C-a>', 'n = 6'],
    ['|n = 5', '10<C-a>', 'n = 15'],
    ['|n 10', '<C-x>', 'n 9'],
    ['|x 0x0f', '<C-a>', 'x 0x10'],
    ['|x-1', '<C-a>', 'x-2'],
    ['|abc', 'rx', 'xbc'],
    ['|abc', '3rx', 'xxx'],
    ['|abc', 'Rxy<Esc>', 'xyc'],
    ['|abc', 'Rxyz!<Esc>', 'xyz!'],
    ['|abc', 'Rxy<BS><BS><Esc>', 'abc'],
    ['|a\nb\nc', 'yjGp', 'a\nb\nc\na\nb'],
    ['|foo(bar)', 'fbd%', 'fooar)'],
    ['foo|(bar)', 'd%', 'foo'],
    ['|a\nb\n\nc\nd', 'd}', '\nc\nd'],
  ])('%s  %s', (doc, keys, want) => {
    expect(T(doc, keys)).toBe(want);
  });

  it.each([
    ['|abc abc abc', 'dw.', 'abc'],
    ['|x', 'A1<Esc>..', 'x111'],
    ['|a\nb\nc', 'A;<Esc>j.j.', 'a;\nb;\nc;'],
    ['|foo foo foo', 'cwbar<Esc>w.w.', 'bar bar bar'],
    ['|a\nb\nc\nd', 'dd2.', 'd'],
    ['|x foo foo', '/foo<CR>cgnbar<Esc>.', 'x bar bar'],
    ['|abc\nabc', 'ciwX<Esc>j.', 'X\nX'],
    ['|a b c', 'i-<Esc>W.W.', '-a -b -c'],
    ['|1 2 3', '<C-a>w.w.', '2 3 4'],
    ['|(a) (b)', 'ci(x<Esc>f(.', '(x) (x)'],
    ['|ab\nab', 'vlUj0.', 'AB\nAB'],
  ])('dot: %s  %s', (doc, keys, want) => {
    expect(T(doc, keys)).toBe(want);
  });

  it('undo/redo', () => {
    expect(T('|abc', 'xxu')).toBe('bc');
    expect(T('|abc', 'xxuu')).toBe('abc');
    expect(T('|abc', 'xxu<C-r>')).toBe('c');
    expect(T('|abc', 'xxU')).toBe('abc');
    expect(T('|abc', 'ixy<Esc>u')).toBe('abc');
    expect(C('|a\nb\nc', 'jddu')).toBe('a\n|b\nc');
  });

  it('counts with insert', () => {
    expect(T('|', '3ia<Esc>')).toBe('aaa');
    expect(T('|x', '2ohi<Esc>')).toBe('x\nhi\nhi');
    expect(T('|x', '3A!<Esc>')).toBe('x!!!');
  });
});

describe('text objects', () => {
  it.each([
    ['foo |bar baz', 'diw', 'foo  baz'],
    ['foo |bar baz', 'daw', 'foo baz'],
    ['foo |bar', 'daw', 'foo'],
    ['|foo bar', 'd2aw', ''],
    ['a b.c |d', 'diW', 'a b.c '],
    ['say("h|ello")', 'di"', 'say("")'],
    ['|say("hello")', 'di"', 'say("")'],
    ['say("h|ello")', 'da"', 'say()'],
    ["x = 'a|b' + 1", "ci'z<Esc>", "x = 'z' + 1"],
    ['f(a, |b)', 'di(', 'f()'],
    ['f(a, |b)', 'da(', 'f'],
    ['f(a, |b)', 'dib', 'f()'],
    ['f(a(|b))', 'di(', 'f(a())'],
    ['f(a(|b))', '2di(', 'f()'],
    ['x[1|2]', 'di[', 'x[]'],
    ['{\n  a|\n}', 'di{', '{\n}'],
    ['if (x) {|\n  a\n  b\n}', 'diB', 'if (x) {\n}'],
    ['<a>te|xt</a>', 'dit', '<a></a>'],
    ['<a>te|xt</a>', 'dat', ''],
    ['<div><p>h|i</p></div>', 'd2it', '<div></div>'],
    ['<p>h|i</p>', 'citX<Esc>', '<p>X</p>'],
    ['a\nb|\n\nc', 'dip', '\nc'],
    ['a\nb|\n\nc', 'dap', 'c'],
    ['One. Tw|o. Three.', 'dis', 'One.  Three.'],
    ['One. Tw|o. Three.', 'das', 'One. Three.'],
    ['x = "a" + |"b"', 'ci"z<Esc>', 'x = "a" + "z"'],
    ['|x = "a"', 'ci"z<Esc>', 'x = "z"'],
    ['x = "a" |+ "b"', 'ci"z<Esc>', 'x = "a"z"b"'],
    ['|foo(bar)', 'ci(z<Esc>', 'foo(z)'],
    ['f(a) |g(b)', 'ci(z<Esc>', 'f(a) g(z)'],
    ['|a [1] (2)', 'ci[z<Esc>', 'a [z] (2)'],
    ['|x = 1\nfoo(bar)', 'da(', 'x = 1\nfoo'],
    ['f(a) |x', 'ci(z<Esc>', 'f(a) x'],
    ['`a|b`', 'di`', '``'],
  ])('%s  %s', (doc, keys, want) => {
    expect(T(doc, keys)).toBe(want);
  });

  it('visual grows with repeated objects', () => {
    expect(T('f(a(|b))', 'va(a(d')).toBe('f');
    expect(T('f(a(|bc))', 'vi(i(d')).toBe('f()');
    expect(T('f(g(h(|xy)))', 'vi(i(i(d')).toBe('f()');
    expect(T('|a\nb\nc\nd\ne', 'jVj<Esc>Ggvd')).toBe('a\nd\ne');
    expect(T('f(g(h(|xy)))', 'va(a(a(d')).toBe('f');
  });
});

describe('visual', () => {
  it.each([
    ['|abcd', 'vld', 'cd'],
    ['|abcd', 'lvlohd', 'd'],
    ['|a\nb\nc', 'Vjd', 'c'],
    ['|abc', 'vl<Esc>gvd', 'c'],
    ['|a\nb\nc', '<C-v>jjI- <Esc>', '- a\n- b\n- c'],
    ['|a\nbb\nc', '<C-v>jj$A;<Esc>', 'a;\nbb;\nc;'],
    ['|ab\nab\nab', '<C-v>jjlAX<Esc>', 'abX\nabX\nabX'],
    ['|abc\nabc', '<C-v>jld', 'c\nc'],
    ['|abc\nabc', '<C-v>jlcX<Esc>', 'Xc\nXc'],
    ['|0\n0\n0', 'VGg<C-a>', '1\n2\n3'],
    ['|1\n1\n1', 'VG<C-a>', '2\n2\n2'],
    ['|abc', 'vlU', 'ABc'],
    ['|abc', 'vl~', 'ABc'],
    ['|a\nb', 'Vj>', '  a\n  b'],
    ['|a\nb', 'Vj2>', '    a\n    b'],
    ['|abc', 'vlrx', 'xxc'],
    ['|a\nb\nc', 'VjJ', 'a b\nc'],
    ['|foo bar', 'yiwwviwp', 'foo foo'],
    ['|foo bar', 'yiwwviwp0viwp', 'bar foo'],
    ['|a\nb', 'yyjVp', 'a\na'],
    ['|abc', 'viwy$p', 'abcabc'],
    ['|a b', 'vey', 'a b'],
    ['|word', 'viwcX<Esc>', 'X'],
    ['|a\nb\nc', 'VjoJ', 'a b\nc'],
  ])('%s  %s', (doc, keys, want) => {
    expect(T(doc, keys)).toBe(want);
  });
});

describe('registers', () => {
  it.each([
    ['|one\ntwo', '"ayyj"ap', 'one\ntwo\none'],
    ['|one\ntwo', '"ayyj"Ayy"ap', 'one\ntwo\none\ntwo'],
    ['|keep\ndel', 'yyjdd"0p', 'keep\nkeep'],
    ['|keep\ndel', 'yyj"_ddp', 'keep\nkeep'],
    ['|a\nb\nc\nd', 'dddddd"1p', 'd\nc'],
    ['|a\nb\nc\nd', 'dddddd"3p', 'd\na'],
    ['|a\nb\nc\nd', 'dddddd"1p..', 'd\nc\nb\na'],
    ['|abc', 'x"-p', 'bac'],
    ['|foo', 'yiwA <C-r>"<Esc>', 'foo foo'],
    ['|foo', 'yiwA <C-r>0<Esc>', 'foo foo'],
    ['|', 'i<C-r>=5*12<CR><Esc>', '60'],
    ['|a: 0', '$s<C-r>=1+1<CR><Esc>', 'a: 2'],
    ['|a: 0', 'A<C-r>=1+1<CR><Esc>', 'a: 02'],
    ['|', 'ihi<Esc>o<C-r>.<Esc>', 'hi\nhi'],
    ['|x', ':s/x/y/<CR>o<C-r>:<Esc>', 'y\ns/x/y/'],
  ])('%s  %s', (doc, keys, want) => {
    expect(T(doc, keys)).toBe(want);
  });
});

describe('macros', () => {
  it.each([
    ['|1\n2\n3', 'qaA!<Esc>jq2@a', '1!\n2!\n3!'],
    ['|1\n2\n3', 'qaA!<Esc>jq@a@@', '1!\n2!\n3!'],
    ['|1\n2\n3\n4', 'qaqqaA.<Esc>j@aq@a', '1.\n2.\n3.\n4.'],
    ['|x', ":let @a='A!'<CR>@a<Esc>", 'x!'],
    ['|a\nb\nc', 'qaI-<Esc>jq:2,3norm @a<CR>', '-a\n-b\n-c'],
    ['|1\n2', 'qaA!<Esc>q"ap', '1!A!\x1b\n2'],
  ])('%s  %s', (doc, keys, want) => {
    expect(T(doc, keys)).toBe(want);
  });
  it('failing motion stops a macro', () => {
    expect(T('|a\nb', 'qaA.<Esc>jq10@a')).toBe('a.\nb.');
  });
});

describe('ex', () => {
  it.each([
    ['|a a\na', ':%s/a/b/g', 'b b\nb'],
    ['|a a\na', ':%s/a/b/', 'b a\nb'],
    ['|john smith', ':s/\\v(\\w+) (\\w+)/\\2 \\1/', 'smith john'],
    ['|john', ':s/\\w\\+/\\u&/', 'John'],
    ['|a1', ':s/\\d/\\=submatch(0)*2/', 'a2'],
    ['|foobar', ':s/foo\\zsbar/X/', 'fooX'],
    ['|cat concat', ':s/\\<cat\\>/dog/g', 'dog concat'],
    ['|<a><b>', ':s/<.\\{-}>/X/', 'X<b>'],
    ['|a,b', ':s/,/\\r/', 'a\nb'],
    ['|a\nb\nc', ':%s/\\n//', 'abc'],
    ['|a\nb', ':%s/\\n/, /', 'a, b, '],
    ['|a\nb\nc', ':1,2s/\\n/, /', 'a, b, c'],
    ['|Foo foo', ':s/foo/x/gi', 'x x'],
    ['|a\nx\nb\nx', ':g/x/d', 'a\nb'],
    ['|a\nx\nb\nx', ':v/x/d', 'x\nx'],
    ['|a\nx\nb\nx', ':g!/x/d', 'x\nx'],
    ['|a\nb', ':g/./normal A;', 'a;\nb;'],
    ['|a\nb', ':%normal I-', '-a\n-b'],
    ['|a\nb', ':%norm A;', 'a;\nb;'],
    ['|a\nb', ':%norm I- ', '- a\n- b'],
    ['|a\nb', ':g/./norm I- ', '- a\n- b'],
    ['a\nb\n|c', ':m0', 'c\na\nb'],
    ['|a\nb\nc', ':m$', 'b\nc\na'],
    ['|a\nb\nc', ':m+1', 'b\na\nc'],
    ['|a\nb', ':t.', 'a\na\nb'],
    ['|a\nb', ':co$', 'a\nb\na'],
    ['|a\nb\nc', ':1,2t$', 'a\nb\nc\na\nb'],
    ['|c\na\nb', ':sort', 'a\nb\nc'],
    ['|b\na\nb', ':sort u', 'a\nb'],
    ['|10\n9\n100', ':sort n', '9\n10\n100'],
    ['|a\nb\nc', ':sort!', 'c\nb\na'],
    ['|a\nb\nc', ':g/^/m0', 'c\nb\na'],
    ['|a\nb\nc', ':1,3j', 'a b c'],
    ['|a\nb\nc', ':j', 'a b\nc'],
    ['|a\nb\nc\nd', ':2,3d', 'a\nd'],
    ['|a', ':>', '  a'],
    ['|a', ':>>', '    a'],
    ['|a\nb\nc', ':2', 'a\nb\nc'],
    ['|b\na', ':%!sort', 'a\nb'],
    ['|b\na\n\nz', '!ipsort<CR>', 'a\nb\n\nz'],
    ['|{"a":1}', ':%!jq .', '{\n  "a": 1\n}'],
    ['|a a\na a', ':s/a/b/<CR>j:&&<CR>', 'b a\nb a'],
    ['|a a\na a', ':s/a/b/<CR>j&', 'b a\nb a'],
    ['|a a\na a', ':s/a/b/<CR>g&', 'b b\nb a'],
    ['|a a\na a', ':s/a/b/g<CR>ug&', 'b b\nb b'],
    ['|a a\na a', ':s/a/b/g<CR>j&', 'b b\nb b'],
    ['|let var', ':s/\\v<lt>(var|let)>/x/g', 'x x'],
    ['|ab c', ':s/\\va|b/x/g', 'xx c'],
    ['|x\nx\nx', ":%s/x/\\=line('.')/", '1\n2\n3'],
    ['|x foo', '/foo<CR>:s//bar/<CR>', 'x bar'],
    ['|a\nb\nc', ':s/$/!/<CR>j@:', 'a!\nb!\nc'],
    ['|foo bar', 'yiw:s/<C-r>"/X/<CR>', 'X bar'],
    ['|foo bar', ':s/<C-r><C-w>/X/<CR>', 'X bar'],
    ['|a\nb\nc\nd', 'jVj:d<CR>', 'a\nd'],
    ['|a\nb\nc\nd', 'jVj:s/$/!/<CR>', 'a\nb!\nc!\nd'],
    ['|a\nb\nc', ':2,3y<CR>:1put<CR>', 'a\nb\nc\nb\nc'],
  ])('%s  %s', (doc, keys, want) => {
    const k = keys.startsWith(':') && !keys.includes('<CR>') ? keys + '<CR>' : keys;
    expect(T(doc, k)).toBe(want);
  });

  it(':s with confirm', () => {
    expect(T('|a a a', ':s/a/b/gc<CR>yny')).toBe('b a b');
    expect(T('|a a a', ':s/a/b/gc<CR>a')).toBe('b b b');
    expect(T('|a a a', ':s/a/b/gc<CR>nq')).toBe('a a a');
  });

  it(':s undoes as one change', () => {
    expect(T('|a\na\na', ':%s/a/b/<CR>u')).toBe('a\na\na');
    expect(T('|a\nx\nb\nx', ':g/x/d<CR>u')).toBe('a\nx\nb\nx');
  });

  it(':g with :s', () => {
    expect(T('|a1\nb2\na3', ':g/^a/s/\\d/N/<CR>')).toBe('aN\nb2\naN');
  });
});

describe('increment', () => {
  it('keeps zero padding on decimals', () => {
    expect(T('build |007', '<C-a>')).toBe('build 008');
    expect(T('v|099', '<C-a>')).toBe('v100');
  });
});

describe('reindent', () => {
  it('re-indents Lua if/elseif/else blocks', () => {
    const vim = new Vim({ text: 'if a then\nx()\nelseif b then\ny()\nelse\nz()\nend\nw()', name: 'init.lua' });
    vim.feedKeys('=G');
    expect(vim.buf.text()).toBe('if a then\n  x()\nelseif b then\n  y()\nelse\n  z()\nend\nw()');
  });
});

describe('insert mode', () => {
  it.each([
    ['|foo bar', 'A<C-w><Esc>', 'foo '],
    ['|foo bar', 'A<C-u><Esc>', ''],
    ['|foo', 'i<C-o>$!<Esc>', 'foo!'],
    ['|foo', 'A<C-h><Esc>', 'fo'],
    ['|', 'i<C-v>u2014<Esc>', '—'],
    ["|", "i<C-k>e'<Esc>", 'é'],
    ['|', 'ia<CR>b<Esc>', 'a\nb'],
    ['  |x', 'A<CR>y<Esc>', '  x\n  y'],
    ['|foo\nf', 'jA<C-n><Esc>', 'foo\nfoo'],
    ['|const foo = 1\nc', 'jSco<C-x><C-l><Esc>', 'const foo = 1\nconst foo = 1'],
    ['|ab', 'a<Del><Esc>', 'a'],
    ['|x', 'o<Esc>', 'x\n'],
    ['  |x', 'o<Esc>', '  x\n'],
    // <C-p> takes the nearest match above, then goes further back; <C-x><C-l> searches upward.
    ['alpha\nalphabet\n|\nalps', 'ial<C-p><Esc>', 'alpha\nalphabet\nalphabet\nalps'],
    ['alpha\nalphabet\n|\nalps', 'ial<C-p><C-p><Esc>', 'alpha\nalphabet\nalpha\nalps'],
    ['alpha\nalphabet\n|\nalps', 'ial<C-n><Esc>', 'alpha\nalphabet\nalps\nalps'],
    ['p(a)\np(ab)\n|\nz', 'ip(<C-x><C-l><Esc>', 'p(a)\np(ab)\np(ab)\nz'],
  ])('%s  %s', (doc, keys, want) => {
    expect(T(doc, keys)).toBe(want);
  });
});

describe('folds and scrolling', () => {
  it('zf, zo, zc and j over a fold', () => {
    const v = run('|a\nb\nc\nd', 'zfjj');
    expect(v.cursor.line).toBe(2);
    v.feedKeys('ggzo');
    expect(v.win.folds[0].closed).toBe(false);
    v.feedKeys('zc');
    expect(v.win.folds[0].closed).toBe(true);
    v.feedKeys('zR');
    expect(v.win.folds[0].closed).toBe(false);
  });
  it('<C-d> moves half a screen', () => {
    const doc = '|' + Array.from({ length: 60 }, (_, i) => 'l' + i).join('\n');
    const v = run(doc, '');
    v.win.height = 20;
    v.feedKeys('<C-d>');
    expect(v.cursor.line).toBe(10);
    expect(v.win.top).toBe(10);
    v.feedKeys('<C-u>');
    expect(v.cursor.line).toBe(0);
  });
  it('H M L', () => {
    const doc = '|' + Array.from({ length: 60 }, (_, i) => 'l' + i).join('\n');
    const v = run(doc, '');
    v.win.height = 20;
    v.feedKeys('L');
    expect(v.cursor.line).toBe(19);
    v.feedKeys('M');
    expect(v.cursor.line).toBe(9);
    v.feedKeys('H');
    expect(v.cursor.line).toBe(0);
  });
});

describe('windows and buffers', () => {
  const files = { 'a.ts': 'a1\na2\n', 'b.ts': 'b1\n', 'src/c.ts': 'import x from "./d"\n', 'src/d.ts': 'd\n' };
  it(':e and <C-^>', () => {
    const v = new Vim({ files, open: 'a.ts' });
    v.feedKeys(':e b.ts<CR>');
    expect(v.buf.name).toBe('b.ts');
    v.feedKeys('<C-^>');
    expect(v.buf.name).toBe('a.ts');
  });
  it(':sp and <C-w>j', () => {
    const v = new Vim({ files, open: 'a.ts' });
    v.feedKeys(':vs b.ts<CR>');
    expect(v.tab.windows().length).toBe(2);
    expect(v.buf.name).toBe('b.ts');
    v.feedKeys('<C-w>l');
    expect(v.buf.name).toBe('a.ts');
    v.feedKeys('<C-w>o');
    expect(v.tab.windows().length).toBe(1);
  });
  it(':vimgrep and :cnext', () => {
    const v = new Vim({ files, open: 'a.ts' });
    v.feedKeys(':vimgrep /1/ **/*.ts<CR>');
    expect(v.quickfix.items.length).toBe(2);
    v.feedKeys(':cn<CR>');
    expect(v.buf.name).toBe('b.ts');
  });
  it(':cdo s', () => {
    const v = new Vim({ files, open: 'a.ts' });
    v.feedKeys(':vimgrep /1/ **/*.ts<CR>:cdo s/1/X/ | update<CR>');
    expect(v.fs.read('a.ts')).toBe('aX\na2\n');
    expect(v.fs.read('b.ts')).toBe('bX\n');
  });
  it('gf', () => {
    const v = new Vim({ files, open: 'src/c.ts' });
    v.feedKeys('f.gf');
    expect(v.buf.name).toBe('src/d.ts');
  });
  it(':ls and :b', () => {
    const v = new Vim({ files, open: 'a.ts' });
    v.feedKeys(':e b.ts<CR>:b a<CR>');
    expect(v.buf.name).toBe('a.ts');
    v.feedKeys(':bn<CR>');
    expect(v.buf.name).toBe('b.ts');
  });
  it('buffer numbers start at 1 per editor', () => {
    const v = new Vim({ files, open: 'a.ts' });
    v.feedKeys(':e b.ts<CR>:e src/d.ts<CR>:b2<CR>');
    expect(v.buf.name).toBe('b.ts');
    v.feedKeys('3<C-^>');
    expect(v.buf.name).toBe('src/d.ts');
    v.feedKeys(':ls<CR>');
    expect(v.message?.text.split('\n')[0]).toMatch(/^ {2}1 /);
  });
  it('gf uses the file name after the cursor and ../ paths', () => {
    const v = new Vim({ files: { ...files, 'src/r/e.ts': "import { d } from '../d';\n" }, open: 'src/r/e.ts' });
    v.feedKeys("f'gf");
    expect(v.buf.name).toBe('src/d.ts');
  });
  it('<CR> in the quickfix and location list windows', () => {
    const v = new Vim({ files, open: 'a.ts' });
    v.feedKeys(':vimgrep /1/ **/*.ts<CR>:copen<CR>j<CR>');
    expect(v.buf.name).toBe('b.ts');
    expect(v.tab.windows().length).toBe(2);
    v.feedKeys(':cclose<CR>:lvimgrep /a/ a.ts<CR>:lopen<CR>j<CR>');
    expect(v.buf.name).toBe('a.ts');
    expect(v.cursor.line).toBe(1);
  });
});

describe('plugin command hooks', () => {
  it('visual operators read argAfter; actions read surround / tag arguments', () => {
    const v = new Vim({ text: 'abc def', name: 'x.ts' });
    v.defineOperator('Q', { change: true, argAfter: 'surround', run: r => { v.insertText(r.start, `[${v.opArgument}]`); } }, ['v']);
    v.defineAction('zq', { arg: 'tag', change: true, run: c => { v.insertText({ line: 0, col: 0 }, c.arg); } });
    v.feedKeys('vlQ-');
    expect(v.buf.text()).toBe('[-]abc def');
    v.feedKeys('zqh1<CR>');
    expect(v.buf.text()).toBe('h1<CR>[-]abc def');
    v.feedKeys('u');
    expect(v.buf.text()).toBe('[-]abc def');
  });
  it('a motion with pick defers the operator like a search does', () => {
    const v = new Vim({ text: 'one two three', name: 'x.ts' });
    let typed: string[] = [];
    v.defineMotion('Z', {
      run: () => null,
      pick: done => {
        typed = [];
        v.modal = k => { typed.push(k); v.modal = null; done({ pos: { line: 0, col: +k }, inclusive: true }, [k]); return true; };
      },
    });
    v.feedKeys('dZ3');
    expect(v.buf.text()).toBe('two three');
    v.feedKeys('.');
    expect(v.buf.text()).toBe('three');
    expect(typed).toEqual(['3']);
  });
});

describe('plugin hooks', () => {
  it('cursorHooks run after every typed key (a CursorMoved autocmd)', () => {
    const v = new Vim({ text: 'abc def', name: 'a.ts' });
    v.cursorHooks.push(() => { if (v.cursor.col < 4) v.win.cursor.col = 4; });
    v.feedKeys('0');
    expect(v.cursor.col).toBe(4);
    v.feedKeys('b');
    expect(v.cursor.col).toBe(4);
  });
});

describe(':set forms (Neovim 0.12)', () => {
  const make = () => new Vim({ text: 'abcd', name: 'a.txt' });
  it.each([
    ['set nosw', 'E474: Invalid argument: nosw'],
    ['set invsw', 'E474: Invalid argument: invsw'],
    ['set sw!', 'E488: Trailing characters: sw!'],
  ])(':%s is an error on a number option', (cmd, msg) => {
    const vim = make();
    vim.feedKeys(`:${cmd}<CR>`);
    expect(vim.message?.text).toBe(msg);
    expect(vim.opt('shiftwidth')).toBe(2);
  });
  it(':set after :setlocal changes the window too', () => {
    const vim = make();
    vim.feedKeys(':setlocal nonu<CR>:set nu<CR>');
    expect(vim.opt('number')).toBe(true);
    vim.feedKeys(':setlocal nonu<CR>');
    expect(vim.opt('number')).toBe(false);
  });
  it(':earlier 0 does nothing; :earlier is :earlier 1', () => {
    const vim = make();
    vim.feedKeys('xxxu:earlier 0<CR>');
    expect(vim.buf.text()).toBe('cd');
    vim.feedKeys(':earlier<CR>');
    expect(vim.buf.text()).toBe('bcd');
  });
});
