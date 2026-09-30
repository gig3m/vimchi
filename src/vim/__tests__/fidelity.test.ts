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
    ['|a\nb\n\nc', 'y}', '|a\nb\n\nc', 'a\nb\n', 'line'],
    ['  |f(\n  a\n)\nz', 'd/)/e<CR>', '|z', '  f(\n  a\n)\n', 'line'],
    // nvim's matchit maps o_% through a forced charwise selection: d% stays characterwise.
    ['  |f(\n  a\n)\nz', 'd%', ' | \nz', 'f(\n  a\n)', 'char'],
    ['|(\n  a\n)\nz', 'd%', '|\nz', '(\n  a\n)', 'char'],
    // [( [{ ]) ]} are exclusive.
    ['f(a, |(b), c)', 'd])', 'f(a, |), c)', '(b', 'char'],
    ['f(a, (b),| c)', 'd[(', 'f| c)', '(a, (b),', 'char'],
    ['if (a) {\n  x; |y;\n}', 'd]}', 'if (a) {\n  x;| \n}', 'y;', 'char'],
    ['if (a) {\n  |x;\n}\ny', 'd]}', 'if (a) {\n|}\ny', '  x;\n', 'line'],
    ['if (a) {\n  |x;\n}\ny', 'y]}', 'if (a) {\n  |x;\n}\ny', '  x;\n', 'line'],
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

describe('block I / A leave the cursor at the block top-left', () => {
  it.each([
    ['ab|cd\nefgh', '<C-v>jIxy<Esc>', 'ab|xycd\nefxygh'],
    ['ab|cd\nefgh', '<C-v>Ixy<Esc>', 'ab|xycd\nefgh'], // a one-line block too
    ['ab|cd\nefgh', '<C-v>jI<Esc>', 'a|bcd\nefgh'], // nothing typed: plain <Esc>
    ['ab|cd\nefgh', '<C-v>jIx<CR>y<Esc>', 'abx\n|ycd\nefgh'], // a line break: no block insert
    ['a|bcd\nefgh', '<C-v>jlcXY<Esc>', 'aX|Yd\neXYh'], // block c is a plain <Esc>
    ['a|bcd\nefgh', 'l<C-v>jAXY<Esc>', 'ab|cXYd\nefgXYh'],
    ['a|bcd\nefgh', '<C-v>jlAXY<Esc>', 'a|bcXYd\nefgXYh'],
    ['|abcd\nefgh', 'l<C-v>jIXY<Esc>j.', 'aXYbcd\ne|XYXYfgh'],
    ['a|b\nefgh', '<C-v>j$AXY<Esc>', 'a|bXY\nefghXY'],
    ['ab|cd\nefgh\nij', '<C-v>jIX<Esc>jj.', 'abXcd\nefXgh\ni|Xj'],
    ['-- globals leak\nwidth = 80\nheight = 24\n|wrap = false\nreturn width', '<C-v>kkIlocal <Esc>',
      '-- globals leak\n|local width = 80\nlocal height = 24\nlocal wrap = false\nreturn width'],
    ['|const app = express()\napp.use(cors())\n// then\napp.use(auth)\napp.listen(3000)', '<C-v>j$A;<Esc>3j.',
      'const app = express();\napp.use(cors());\n// then\n|app.use(auth);\napp.listen(3000);'],
  ])('%j %s', (doc, keys, want) => {
    expect(C(doc, keys)).toBe(want);
  });
});

describe('built-in gc leaves the cursor on the operator start (g@)', () => {
  it.each([
    ['a\n  foo |bar\n  baz qux\n\nb', 'gcj', 'a\n  // f|oo bar\n  // baz qux\n\nb'],
    ['a\n | foo bar\n  baz qux\n\nb', 'gcj', 'a\n | // foo bar\n  // baz qux\n\nb'],
    ['a\n  foo bar\n  baz |qux\n\nb', 'gcip', '|// a\n//   foo bar\n//   baz qux\n\nb'],
    ['a\n  foo| bar\n  baz qux\n\nb', 'gc}', 'a\n  // |foo bar\n  // baz qux\n\nb'],
    ['a\n  foo |bar\n  baz qux\n\nb', 'Vjgc', 'a\n|  // foo bar\n  // baz qux\n\nb'],
    ['a\n  foo |bar\n  baz qux\n\nb', 'vjgc', 'a\n  // f|oo bar\n  // baz qux\n\nb'],
    ['a\n  foo bar\n  baz |qux\n\nb', 'vkgc', 'a\n  // f|oo bar\n  // baz qux\n\nb'],
    ['a\n  foo bar\n  baz |qux\n\nb', 'gck', 'a\n  // f|oo bar\n  // baz qux\n\nb'],
    ['a\n  foo ba|r\n  baz qux\n\nb', '2gcc', 'a\n  // foo| bar\n  // baz qux\n\nb'],
    // Uncommenting: gcgc starts on the comment block's first line, column 0; gcc on the first non-blank.
    ['f {\n  // for (x) {\n  //  | y;\n  // }\n}', 'gcgc', 'f {\n|  for (x) {\n    y;\n  }\n}'],
    ['if ok then\n  // vim.cm|d.x()\nend', 'gcc', 'if ok then\n  |vim.cmd.x()\nend'],
  ])('%j %s', (d, keys, want) => {
    expect(C(d, keys, 'x.ts')).toBe(want);
  });
});

describe('cursor after Ex commands', () => {
  it.each([
    // :> / :< — last line of the range, first non-blank.
    ['|a\n  b c\nd\n  e f', ':%><CR>', '  a\n    b c\n  d\n    |e f'],
    ['a\n  b c\nd\n  e| f', ':1,2><CR>', '  a\n    |b c\nd\n  e f'],
    ['|a\n  b c\nd\n  e f', ':2,4<<CR>', 'a\nb c\nd\n|e f'],
    ['abcde|fg\nxyzuvwq', ':1,2><CR>', '  abcdefg\n  |xyzuvwq'],
    ['abcde|fg\nxyzuvwq', ':><CR>', '  |abcdefg\nxyzuvwq'],
    ['abcde|fg\nxyzuvwq', ':>> 2<CR>', '    abcdefg\n    |xyzuvwq'],
    ['  abc|defg\n    xyzuvwq', ':<<CR>', '|abcdefg\n    xyzuvwq'],
    // :j — first non-blank of the joined line.
    ['a\n  b c\nd\n  e f\n|g', ':2,4j<CR>', 'a\n  |b c d e f\ng'],
    ['a\n  b| c\nd\n  e f\ng', ':j<CR>', 'a\n  |b c d\n  e f\ng'],
    ['a\n  b| c\nd\n  e f\ng', ':j!<CR>', 'a\n  |b cd\n  e f\ng'],
    ['  a\n  b| c\nd\n  e f\ng', ':j 3<CR>', '  a\n  |b c d e f\ng'],
    ['x\n  a| b\nc\nd', 'Vj:j<CR>', 'x\n  |a b c\nd'],
    // :m / :t / :co — the last moved or copied line, column from curswant (nostartofline).
    ['abcde|fg\nxyzuvwq\nfoo', ':1m$<CR>', 'xyzuvwq\nfoo\nabcde|fg'],
    ['abcde|fg\nxyzuvwq\nfoo', ':1,2m$<CR>', 'foo\nabcdefg\nxyzuv|wq'],
    ['abcdefg\nxyzuvwq\nfo|o', ':m0<CR>', 'fo|o\nabcdefg\nxyzuvwq'],
    ['abcde|fg\nxyzuvwq\nfoo', ':1t$<CR>', 'abcdefg\nxyzuvwq\nfoo\nabcde|fg'],
    ['abcde|fg\nxyzuvwq\nfoo', ':1,2t$<CR>', 'abcdefg\nxyzuvwq\nfoo\nabcdefg\nxyzuv|wq'],
    ['abcde|fg\nxyzuvwq\n  foo', ':1,3m0<CR>', 'abcdefg\nxyzuvwq\n  fo|o'],
    ['abcde|fg\nxyzuvwq\nfoo', ':1co1<CR>', 'abcdefg\nabcde|fg\nxyzuvwq\nfoo'],
    // :sort — first line of the range, first non-blank.
    ['abcde|fg\n  xyzuvwq\nfoo', ':2,3sort<CR>', 'abcdefg\n  |xyzuvwq\nfoo'],
    ['abcde|fg\n  xyzuvwq\n  foo', ':2,3sort u<CR>', 'abcdefg\n  |foo\n  xyzuvwq'],
    ['{\n  d;\n  |b;\n  c;\n}', 'vi{:sort<CR>', '{\n  |b;\n  c;\n  d;\n}'],
    ['d\n  b\n|c', ':sort<CR>', '  |b\nc\nd'],
    // :g — each command's own cursor rule; :m keeps curswant, :s ends on a first non-blank.
    ['a1 x\nb2 |y\nc3 z', ':g/^/m0<CR>', 'c3 |z\nb2 y\na1 x'],
    ['ex a\nb\nex cc\n\nz|z', ':g/^ex/t$<CR>', 'ex a\nb\nex cc\n\nzz\nex a\ne|x cc'],
    ['ex a\nb\n  ex cc\n  q\nz|z', ':g/ex/m0<CR>', ' | ex cc\nex a\nb\n  q\nzz'],
    ['ex a\nb\n  ex cc\n  q\nz|z', ':g/ex/j<CR>', 'ex a b\n  |ex cc q\nzz'],
    ['ex a\nb\n  ex cc\n  q\nz|z', ':g/ex/><CR>', '  ex a\nb\n    |ex cc\n  q\nzz'],
    // :s inside :g does not fail on a line without a match.
    ['ex a\nb\nex cc\n  q\nz|z', ':g/ex/s/c/Q/<CR>', 'ex a\nb\n|ex Qc\n  q\nzz'],
    ['ex a\nb\n  ex cc\n  q\nz|z', ':g/ex/s/c/Q/<CR>', 'ex a\nb\n  |ex Qc\n  q\nzz'],
    ['ex a\nb\n  ex cc\n  q\nz|z', ':g/ex/s/c/Q/|s/a/b/<CR>', 'ex b\nb\n  |ex Qc\n  q\nzz'],
    ['|b\na\nb', ':g/b/s/x/y/<CR>', 'b\na\n|b'],
    ['  ex cc\n  ex a\nz|z', ':g/ex/s/c/Q/<CR>', '  ex Qc\n  |ex a\nzz'],
    // Any other error still stops :g.
    ['ex a\nb\n  ex cc\n  q\nz|z', ':g/ex/d|foo<CR>', '|b\n  ex cc\n  q\nzz'],
  ])('%j %s', (doc, keys, want) => {
    expect(C(doc, keys)).toBe(want);
  });
});

describe(':s///c leaves the cursor on the last match it prompted for', () => {
  const doc = '|a\n  i y\ni z\nq i\nw';
  it.each([
    // Column 0 when that match was substituted; on the match when it was skipped or the prompt quit.
    ['yq', 'a\n  Q y\n|i z\nq i\nw'],
    ['yn', 'a\n  Q y\ni z\nq |i\nw'],
    ['ynn', 'a\n  Q y\ni z\nq |i\nw'],
    ['nyn', 'a\n  i y\nQ z\nq |i\nw'],
    ['nnn', 'a\n  i y\ni z\nq |i\nw'],
    ['nq', 'a\n  i y\n|i z\nq i\nw'],
    ['q', 'a\n  |i y\ni z\nq i\nw'],
    ['y<Esc>', 'a\n  Q y\n|i z\nq i\nw'],
    ['na', 'a\n  i y\nQ z\n|q Q\nw'],
    ['a', 'a\n  Q y\nQ z\n|q Q\nw'],
    ['nl', 'a\n  i y\n|Q z\nq i\nw'],
    ['yyy', 'a\n  Q y\nQ z\n|q Q\nw'],
  ])('%s', (keys, want) => {
    expect(C(doc, `:%s/i/Q/gc<CR>${keys}`)).toBe(want);
  });
  it.each([
    ['|b\n  i i\nc', ':%s/i/Q/gc<CR>yy', 'b\n|  Q Q\nc'],
    ['|b\n  i i\nc', ':%s/i/Q/gc<CR>yn', 'b\n  Q |i\nc'],
    ['|b\n  i i\nc', ':%s/i/Q/gc<CR>l', 'b\n|  Q i\nc'],
    ['|i\nb\nc', ':%s/i/Q/gc<CR>y', '|Q\nb\nc'],
    ['|a\n  i y\ni z\nq  i', ':%s/i/Q/gc<CR>yyq', 'a\n  Q y\nQ z\nq  |i'],
    ['|a\n  xi iy\ni z\nq i\nw', ':%s/i/Q/c<CR>yyy', 'a\n  xQ iy\nQ z\n|q Q\nw'],
  ])('%j %s', (d, keys, want) => {
    expect(C(d, keys)).toBe(want);
  });
});

describe('a count past the end on the last line fails (cursor_down)', () => {
  it.each([
    ['|abc', '2dd', '|abc', ''],
    ['a\n|b', '2dd', 'a\n|b', ''],
    ['|abc', '2ccX<Esc>', '|abc', ''],
    ['|abc', '2yyp', '|abc', ''],
    ['abc\n|def', 'yy2ddp', 'abc\ndef\n|def', 'def\n'],
    // Not on the last line: the count stops at the end.
    ['a\n|b\nc', '5dd', '|a', 'b\nc\n'],
  ])('%j %s', (doc, keys, want, text) => {
    const [got, reg] = S(doc, keys);
    expect([got, reg]).toEqual([want, text]);
  });
});

describe('r onto the same character is still a change', () => {
  it.each([
    ['|abc', 'xura<C-r>', '|abc'], // it costs the redo branch
    ['|abc', 'xra.u', '|ac'], // and u undoes the no-op . on its own
    ['|abc', 'xuvra<C-r>', '|abc'], // Visual r too
  ])('%j %s', (doc, keys, want) => {
    expect(C(doc, keys)).toBe(want);
  });
});

describe('<C-o> in insert mode restarts the insert', () => {
  it.each([
    // The text before <C-o>, the <C-o> command and the text after are separate undo steps.
    ['|abc', 'iX<C-o>lY<Esc>u', 'Xa|bc'],
    ['|abc def', 'iX<C-o>zzY<Esc>u', 'X|abc def'],
    ['|abc def', 'AX<C-o>0Y<Esc>u', '|abc defX'],
    ['|abc def', 'iX<C-o>ddY<Esc>u', '|'],
    ['|abc def', 'iX<C-o>ddY<Esc>uu', 'X|abc def'],
    ['|abc def', 'iX<C-o>lY<Esc>u<C-r>', 'Xa|Ybc def'],
    // . repeats only what was typed after the <C-o>, as an i, and a count is dropped.
    ['|abc def', 'iX<C-o>lY<Esc>0.', '|YXaYbc def'],
    ['|  abc def', 'wiX<C-o>lY<Esc>$.', '  XaYbc de|Yf'],
    ['|  abc def', 'AX<C-o>0Y<Esc>$.', 'Y  abc def|YX'],
    ['|  abc def', 'wiX<C-o>ddY<Esc>.', '|YY'],
    ['|  abc def', 'w3iX<C-o>lY<Esc>$.', '  XaYbc de|Yf'],
    // curswant follows the typing, and a <C-o> from the end of the line returns there.
    ['|  abc def\nxyz', 'woX<C-o>kY<Esc>G$.', '  aYbc def\n  X\nxy|Yz'],
    ['|abc', 'AX<C-o>zzY<Esc>', 'abcX|Y'],
    ['|abc\nlonger line', 'AX<C-o>jY<Esc>', 'abcX\nlong|Yer line'],
  ])('%j %s', (doc, keys, want) => {
    expect(C(doc, keys)).toBe(want);
  });
});

describe('r<C-v> takes the next character literally, or a code', () => {
  it.each([
    ['r<C-v><Tab>', '\tbc'],
    ['2r<C-v><Tab>', '\t\tc'],
    ['r<C-v><Tab>l.', '\t\tc'],
    ['r<C-v>x41', 'Abc'],
    ['r<C-v>065', 'Abc'],
    ['r<C-v>o101', 'Abc'],
    ['r<C-v>u00e9', 'ébc'],
    ['r<C-v>q', 'qbc'],
    ['r<C-v><C-a>', '\x01bc'],
    ['r<C-v>xx<Esc>', '\x1bbc'], // no digits: the ending key itself, even <Esc>
    ['r<C-v><CR>', '\rbc'], // a literal ^M does not split the line
  ])('%s', (keys, want) => {
    expect(run('abc', keys).buf.text()).toBe(want);
  });
  it('Visual block r<C-v><Tab>', () => {
    expect(run('a|bcd\nefgh', '<C-v>jlr<C-v><Tab>').buf.text()).toBe('a\t\td\ne\t\th');
  });
});

describe('word objects on an empty line and the unnamed register', () => {
  it.each([
    ['|abc\n\ndef', 'yiwjdiw', 'abc'], // d of an empty region leaves the registers alone
    ['|abc\n\ndef', 'yiwjyiw', ''],
    ['|abc\n\ndef', 'yiwjciw<Esc>', ''],
  ])('%j %s', (doc, keys, text) => {
    expect(S(doc, keys)[1]).toBe(text);
  });
});

describe('the coach sees g- / g+ / U as undo', () => {
  it.each(['g-', 'g+', 'U', 'u', '<C-r>'])('%s', keys => {
    const v = run('|abc def', 'xxu');
    v.feedKeys(keys);
    expect(v.lastCommand?.kind).toBe('undo');
  });
});

describe('blockwise yank and put over short lines', () => {
  it.each([
    // A line ending before the block starts yanks as blanks as wide as the block ($: to the
    // longest line's end, plus one); one that reaches into it is not padded.
    ['abc|defgh\ng\nmnop', '<C-v>jjly', 'de\n  \np'],
    ['abc|defgh\ng\nmnop', '<C-v>jj$y', 'defgh\n      \np'],
    ['ab|cd\ng\nmnopqrst', '<C-v>jj$y', 'cd\n       \nopqrst'],
    ['a|bc\ng\nmno', '<C-v>jjly', 'bc\n\nno'],
    ['ab|c\ng\nmno', '<C-v>jjd', 'c\n \no'],
  ])('%j %s', (doc, keys, text) => {
    expect(S(doc, keys)[1]).toBe(text);
  });
  it.each([
    // Put pads a short line out to the block; trailing blanks only where text follows.
    ['abc|def\ng\nmnopqr', '<C-v>jjldup', 'abcd|deef\ng     \nmnoppqqr'],
    ['abc|def\ng\nmnopqr', '<C-v>jj$dup', 'abcd|defef\ng       \nmnoppqrqr'],
  ])('%j %s', (doc, keys, want) => {
    expect(C(doc, keys)).toBe(want);
  });
});
