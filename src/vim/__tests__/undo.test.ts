import { describe, expect, it } from 'vitest';
import { Vim } from '../editor';

// Every expectation below was produced by real Neovim (`nvim --clean --headless`, v0.12.5):
// the document starts with the cursor at (0,0), the keys are fed, and the resulting text is
// shown with the cursor marked as |. In key strings, `|` separates chunks that nvim was fed
// one at a time (a failing command flushes nvim's typeahead); the engine ignores it.

/** Feed keys to a fresh Vim; return the text with the cursor marked as |. */
function run(doc: string, keys: string) {
  const vim = new Vim({ text: doc, name: 'test.txt' });
  vim.feedKeys(keys.replace(/\|/g, ''));
  if (vim.mode !== 'normal') vim.feedKeys('<Esc>');
  const lines = vim.buf.lines.slice();
  const { line, col } = vim.cursor;
  lines[line] = lines[line].slice(0, col) + '|' + lines[line].slice(col);
  return lines.join('\n');
}

describe('undo/redo cursor placement (nvim oracle)', () => {
  // Most rows end in a follow-up `x` so a wrong column shows up as wrong TEXT, not only a cursor.
  it.each([
    ["abc", "lxu", "a|bc"],
    ["abc", "lxu<C-r>", "a|c"],
    ["one two three four\nfive six", "lxux", "o|e two three four\nfive six"],
    ["one two three four\nfive six", "lxu<C-r>x", "o| two three four\nfive six"],
    ["abc def", "wiX<Esc>ux", "abc |ef"],
    ["abc def", "waX<Esc>ux", "abc d|f"],
    ["abc def", "waXY<Esc>u<C-r>x", "abc d|Yef"],
    ["abc def", "wAXY<Esc>ux", "abc d|e"],
    ["  abc def", "wIXY<Esc>ux", "  |bc def"],
    ["a\nbcd\nc\nd\ne", "jll3ddux", "a\nb|c\nc\nd\ne"],
    ["a\nbcd\nc\nd\ne", "jll3ddu<C-r>x", "a\n|"],
    ["abc\n  def\nx", "jwddux", "abc\n  |ef\nx"],
    ["abc def\nghi", "llJxux", "abc def|ghi"],
    ["abc def\nghi", "llJux", "ab| def\nghi"],
    ["abc def\nghi", "llJu<C-r>x", "ab| def ghi"],
    ["abc foo xyz", "wlciwbar<Esc>ux", "abc |oo xyz"],
    ["abc foo xyz", "wlciwbar<Esc>u<C-r>x", "abc |ar xyz"],
    ["abc\ndef", "llox<Esc>ux", "a|b\ndef"],
    ["abc\ndef", "llox<Esc>u<C-r>x", "a|b\nx\ndef"],
    ["abc\ndef", "llOhi<Esc>ux", "a|b\ndef"],
    ["abc\ndef", "yjjllpux", "abc\nd|e"],
    ["abc\ndef", "yjjllpu<C-r>x", "abc\nd|e\nabc\ndef"],
    ["abc\ndef", "llyljjpux", "abc\nd|e"],
    ["abc def", "wxxuux", "abc |ef"],
    ["abc def", "$xux", "abc d|e"],
    ["abc def", "wdwu<C-r>x", "ab|c"],
    ["abc def ghi", "wd0ux", "|bc def ghi"],
    ["abc\ndef\nghi", "jl>>ux", "abc\nd|f\nghi"],
    ["abc\ndef\nghi", "jl~ux", "abc\nd|f\nghi"],
    ["abc\ndef\nghi", ":%s/e/X/<CR>ux", "abc\n|ef\nghi"],
    ["x\n\nabc def ghi\nbcde\n\nxyz", "2jww:%s/e/E/g<CR>u<C-r>x", "x\n\n|bc dEf ghi\nbcdE\n\nxyz"],
    ["abc\nbcde\nfghij\nxyz", "2jllldkux", "abc\nbc|d\nfghij\nxyz"],
    ["abcdef\nbcde\nfghij\nxyz", "2jlllldggux", "abcd|f\nbcde\nfghij\nxyz"],
    ["x\n\nabc\nbcde\n\nxyz", "2jllldapux", "x\n\n|bc\nbcde\n\nxyz"],
    ["x\n\nabc\nbcde\n\nxyz", "2jlll3Jux", "x\n\na|b\nbcde\n\nxyz"],
    ["x\n\nabc\nbcde\n\nxyz", "2jlllccZ<Esc>ux", "x\n\n|bc\nbcde\n\nxyz"],
    ["x\n\nabc\nbcde\n\nxyz", "2jlllgUUux", "x\n\n|bc\nbcde\n\nxyz"],
    ["x\n\nabc\nbcde\n\nxyz", "2jlllyyPux", "x\n\na|b\nbcde\n\nxyz"],
    ["x\n\nabc def ghi\nbcde\n\nxyz", "2j$d?b<CR>ux", "x\n\na|c def ghi\nbcde\n\nxyz"],
    ["x\n\nabc def ghi\nbcde\n\nxyz", "2j$dFbux", "x\n\na|c def ghi\nbcde\n\nxyz"],
    ["x\n\nabc def ghi\nbcde\n\nxyz", "2jwwlldiwux", "x\n\nabc def |hi\nbcde\n\nxyz"],
    ["x\n\nabc def ghi\nbcde\n\nxyz", "2jwwlldawux", "x\n\nabc def|ghi\nbcde\n\nxyz"],
    ["x\n\nabc def ghi\nbcde\n\nxyz", "2jwwvjdux", "x\n\nabc def |hi\nbcde\n\nxyz"],
    ["x\n\nabc def ghi\nbcde\n\nxyz", "2jwwxj.ux", "x\n\nabc def hi\nbc|d\n\nxyz"],
    ["x\n\nabc def ghi\nbcde\n\nxyz", "2jww:m0<CR>ux", "x\n\nabc def |hi\nbcde\n\nxyz"],
    ["abc def ghi", "wiX<CR>Y<Esc>u<C-r>x", "abc| \nYdef ghi"],
    ["abc def\nghi jkl", "wyiwjwviwpux", "abc def\nghi |kl"],
    ["abc def\nghi jkl", "wllVjr1ux", "|bc def\nghi jkl"],
    ["abc def\nghi jkl", "wllVjpux", "|bc def\nghi jkl"],
    ["abc def\nghi jkl", "wll<C-v>jhr1ux", "abc d|f\nghi jkl"],
    ["abc def\nghi jkl", "wllvjhXux", "|bc def\nghi jkl"],
    ["abc def\nghi jkl", "wllvh~ux", "abc d|f\nghi jkl"],
    ["abc def\nghi jkl", "wllXux", "abc d|f\nghi jkl"],
    ["abc def\nghi jkl", "wll2Xux", "abc |ef\nghi jkl"],
    ["abc def\nghi jkl", "wllSxy<Esc>ux", "|bc def\nghi jkl"],
    ["abc def\nghi jkl", "wllSxy<Esc>u<C-r>x", "|y\nghi jkl"],
    ["abc def\nghi jkl\nmno", "jw:1d<CR>ux", "abc |ef\nghi jkl\nmno"],
    ["abc def\nghi jkl\nmno", "jw:3d<CR>ux", "abc def\nghi jkl\nm|n"],
  ])('%j %s', (doc, keys, want) => {
    expect(run(doc, keys)).toBe(want);
  });
});

describe('redo survives commands that change nothing (nvim oracle)', () => {
  // Neovim drops the redo branch only when a command really saved undo state. An empty insert,
  // a cancelled or failed operator, a failed motion or a :s with no match leave it intact; an
  // insert that typed and erased (iQ<BS>), or x on an empty line, do not.
  it.each([
    ["abc", "xu|i<Esc>|<C-r>", "|bc"],
    ["abc", "xu|iQ<BS><Esc>|<C-r>", "|abc"],
    ["abc", "xu|d<Esc>|<C-r>", "|bc"],
    ["abc", "xu|dq|<C-r>", "|bc"],
    ["abc", "xu|:s/q/r/<CR>|<C-r>", "|bc"],
    ["abc", "xu|fq|<C-r>", "|bc"],
    ["abc", "xu|v<Esc>|<C-r>", "|bc"],
    ["abc", "xu|yy|<C-r>", "|bc"],
    ["abc\n\nz", "xu|j|x|<C-r>", "abc\n|\nz"],
    ["abc", "xu|rb|<C-r>", "|bbc"],
    // ~ / g~ over a non-letter, >> / << that shift nothing and a put from an empty register
    // change nothing but still save undo: the redo branch goes.
    ["1bc", "xu|~|<C-r>", "1|bc"],
    ["1bc", "xu|~|u", "|1bc"],
    ["1bc", "xu|g~l|<C-r>", "|1bc"],
    ["\nabc", "jxuk|>>|<C-r>", "|\nabc"],
    ["\nabc", "jxuk|<<|<C-r>", "|\nabc"],
    ["abc", "xu|<<|<C-r>", "|abc"],
    ["abc\ndef", "xu|\"zp|<C-r>", "|abc\ndef"],
    ["abc\ndef", "xu|\"zP|<C-r>", "|abc\ndef"],
    ["abc", "xu|\"_p|<C-r>", "|abc"],
    ["abc", "xu|gul|<C-r>", "|abc"],
    ["abc", "xu|==|<C-r>", "|abc"],
  ])('%j %s', (doc, keys, want) => {
    expect(run(doc, keys)).toBe(want);
  });
});

describe('insert-mode <C-g>u splits the undo block (nvim oracle)', () => {
  it.each([
    ["  abc", "iX<C-g>uY<Esc>u", "X|  abc"],
    ["  abc", "iX<C-g>uY<Esc>ux", "X| abc"],
    ["  abc", "iX<C-g>uY<Esc>uu", "|  abc"],
    ["  abc", "iX<C-g>uY<Esc>uu<C-r>", "|X  abc"],
    ["  abc", "iX<C-g>uY<Esc>u<C-r>", "X|Y  abc"],
    ["  abc", "wiX<C-g>uY<Esc>u", "  X|abc"],
    ["  abc", "wi<C-g>uXY<Esc>u", "  |abc"],
    ["  abc", "wiX<C-g>u<C-g>uY<Esc>u", "  X|abc"],
    ["abc", "iX<C-g>uY<C-g>uZ<Esc>uu", "X|abc"],
    ["  abc", "wiX<C-g>uY<Esc>..u", "  XX|YYabc"],
    ["abc", "iX<CR><C-g>uY<Esc>u", "X\n|abc"],
    // <C-g>u also moves the insert start, where <C-w> / <C-u> stop.
    ["abc", "A foo<C-g>u bar<C-w><C-w>z<Esc>u", "abc foo| "],
    ["abc", "A foo<C-g>u bar<C-w><C-w>z<Esc>", "abc |z"],
    ["abc", "A foo<C-g>u bar<C-w><C-w><C-w>z<Esc>", "abc|z"],
    ["abc", "A foo bar<C-w><C-w>z<Esc>", "abc |z"],
    ["abc", "A foo<C-g>u bar<C-u>z<Esc>", "abc|z"],
    ["abc", "A foo<C-g>u bar<BS><BS><BS><BS><BS>z<Esc>", "abc fo|z"],
    // Neovim's default mappings put a <C-g>u before every <C-w> and <C-u>.
    ["abc", "A foo bar<C-w><C-w>z<Esc>u", "abc foo| "],
    ["abc", "A foo<C-g>u bar<C-u>z<Esc>u", "abc foo ba|r"],
  ])('%j %s', (doc, keys, want) => {
    expect(run(doc, keys)).toBe(want);
  });
});

describe('g- / g+ walk the undo tree in time order (nvim oracle)', () => {
  it.each([
    ["abc\ndef", "xurZg-", "|bc\ndef"],
    ["abc\ndef", "xurZg-g-", "|abc\ndef"],
    ["abc\ndef", "xurZg-g-g+", "|bc\ndef"],
    ["abc\ndef", "xurZg-g-g+g+", "|Zbc\ndef"],
    ["abc\ndef", "xurZg-g-g+g+g+", "|Zbc\ndef"],
    ["abc\ndef", "xurZuu", "|abc\ndef"],
    ["abc\ndef", "xurZg-u", "|abc\ndef"],
    ["abc\ndef", "xurZg-<C-r>", "|bc\ndef"],
    ["abc\ndef", "xurZg-g-<C-r>", "|bc\ndef"],
    ["abc\ndef", "xurZ2g-", "|abc\ndef"],
    ["abc\ndef", "xurZ3g-g+", "|bc\ndef"],
    ["abc\ndef", "xurZ3g-3g+", "|Zbc\ndef"],
    ["abc\ndef", "g-", "|abc\ndef"],
    ["abc\ndef", "xxg-g-g+", "|bc\ndef"],
    ["abc\ndef", "jlxkurZg-", "abc\nd|f"],
    ["abc def\nghi jkl\nmno", "wxujwrZg-g+", "abc def\nghi jkl\n|Zno"],
    ["abc def\nghi jkl\nmno", "wxxuujwrZg-", "abc |f\nghi jkl\nmno"],
    ["abc def\nghi jkl\nmno", "wxxuujwrZg-g-g-", "abc |def\nghi jkl\nmno"],
    ["abc def\nghi jkl\nmno", "wxxuujwrZg-g-g-<C-r>", "abc |ef\nghi jkl\nmno"],
    ["abc def\nghi jkl\nmno", "wxxuujwrZg-g-u", "abc |def\nghi jkl\nmno"],
    ["abc def\nghi jkl\nmno", "wxxuujwrZg-g-x", "abc |f\nghi jkl\nmno"],
  ])('%j %s', (doc, keys, want) => {
    expect(run(doc, keys)).toBe(want);
  });
});

describe('undo history is capped at undolevels (1000) like Neovim', () => {
  it('keeps the newest 1000 changes and drops the oldest', () => {
    const vim = new Vim({ text: 'abc', name: 'test.txt' });
    vim.feedKeys('ix<Esc>'.repeat(1100));
    expect((vim.buf as unknown as { undoNodes: unknown[] }).undoNodes.length).toBeLessThanOrEqual(1001);
    vim.feedKeys('u'.repeat(1100)); // nvim: the last 100 u find nothing left to undo
    expect(vim.buf.lines).toEqual(['x'.repeat(100) + 'abc']);
    vim.feedKeys('g-');
    expect(vim.buf.lines).toEqual(['x'.repeat(100) + 'abc']);
    vim.feedKeys('<C-r>'.repeat(1000));
    expect(vim.buf.lines).toEqual(['x'.repeat(1100) + 'abc']);
  });
  it('keeps branches that are still reachable', () => {
    const vim = new Vim({ text: 'abc', name: 'test.txt' });
    vim.feedKeys('ix<Esc>'.repeat(10) + 'uuuiy<Esc>' + 'ix<Esc>'.repeat(1000));
    expect((vim.buf as unknown as { undoNodes: unknown[] }).undoNodes.length).toBeLessThanOrEqual(1001);
    vim.feedKeys('u'.repeat(2000));
    expect(vim.buf.lines).toEqual(['y' + 'x'.repeat(7) + 'abc']);
  });
});

describe('insert-mode <C-g>j / <C-g>k go to the insert start column on the next / previous line (nvim oracle)', () => {
  it.each([
    ["abc\ndef", "Ax<C-g>jy<Esc>", "abcx\ndef|y"],
    ["abcdef\nxy", "Aq<C-g>jz<Esc>", "abcdefq\nxy|z"],
    ["abcdef\nghijkl", "lliqq<C-g>jz<Esc>", "abqqcdef\ngh|zijkl"],
    ["abc\ndef", "jliqq<C-g>kz<Esc>", "a|zbc\ndqqef"],
    ["a\nbcdefgh", "j5liqq<C-g>kz<Esc>", "a|z\nbcdefqqgh"],
    ["abc\n  def", "Aqq<C-g>jz<Esc>", "abcqq\n  d|zef"],
    ["abc\ndef", "iqq<C-g><C-j>z<Esc>", "qqabc\n|zdef"],
    ["abc\ndef", "iqq<C-g><Down>z<Esc>", "qqabc\n|zdef"],
    ["abc\ndef\nghi", "iqq<C-g>j<C-g>jz<Esc>", "qqabc\ndef\n|zghi"],
    ["abc\ndef\nghi", "lliqq<C-g>jz<C-g>jy<Esc>", "abqqc\ndezf\ngh|yi"],
    ["abc\ndef\nghi", "Aqq<C-g>jz<C-g>ky<Esc>", "abc|yqq\ndefz\nghi"],
    // No line there: nothing moves and the insert goes on.
    ["abc\ndef", "iqq<C-g>kz<Esc>", "qq|zabc\ndef"],
    // Any other key after <C-g> is swallowed with it.
    ["abc\ndef", "iqq<C-g>xz<Esc>", "qq|zabc\ndef"],
    ["abc\ndef", "iqq<C-g><Esc>z<Esc>", "qq|zabc\ndef"],
    // Like an arrow key: a new undo step, a count is dropped, and . repeats what follows as an i
    // (or the insert before it, when nothing followed).
    ["abc\ndef", "Aqq<C-g>jz<Esc>u", "abcqq\nde|f"],
    ["abc\ndef", "Aqq<C-g>jz<Esc>uu", "ab|c\ndef"],
    ["abc\ndef", "Aqq<C-g>jz<Esc>u<C-r>", "abcqq\ndef|z"],
    ["abc\ndef", "2Aqq<C-g>jz<Esc>", "abcqq\ndef|z"],
    ["abc\ndef", "Aqq<C-g>jz<Esc>0.", "abcqq\n|zdefz"],
    ["abc\ndef\nghi", "Aqq<C-g>jz<Esc>j.", "abcqq\ndefz\ngh|zi"],
    ["abc\ndef", "Aqq<C-g>j<Esc>", "abcqq\nde|f"],
    ["abc\ndef", "Aqq<C-g>j<Esc>u", "ab|c\ndef"],
    ["abc\ndef", "Aqq<C-g>j<Esc>0.", "abcqq\ndefq|q"],
  ])('%j %s', (doc, keys, want) => {
    expect(run(doc, keys)).toBe(want);
  });
});
