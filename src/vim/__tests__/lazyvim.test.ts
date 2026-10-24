// LazyVim's options (lua/lazyvim/config/options.lua) as the tutor's defaults. Expectations were
// taken from `nvim --clean` with those options set (scrolloff=4, tabstop=2, ignorecase+smartcase…),
// a 20-row window over 60 lines unless said otherwise. Lines and tops here are 0-based.
import { describe, expect, it } from 'vitest';
import { Vim } from '../editor';

const sixty = () => {
  const v = new Vim({ text: Array.from({ length: 60 }, (_, i) => 'l' + i).join('\n'), name: 'sixty.txt' });
  v.win.height = 20;
  return v;
};
const at = (keys: string) => {
  const v = sixty();
  v.feedKeys(keys);
  return [v.cursor.line, v.win.top];
};

describe('scrolloff=4', () => {
  it('scrolling moves the cursor in from the edge; the view stays', () => {
    expect(at('<C-d>')).toEqual([14, 10]);
    expect(at('<C-d><C-u>')).toEqual([4, 0]);
    expect(at('<C-f>')).toEqual([22, 18]);
    expect(at('G<C-b>')).toEqual([37, 22]);
    expect(at('<C-e>')).toEqual([5, 1]);
    expect(at('3<C-e>')).toEqual([7, 3]);
    expect(at('30G<C-y>')).toEqual([28, 13]);
    expect(at('30Gzt<C-d>')).toEqual([39, 35]);
    expect(at('G<C-u>')).toEqual([45, 30]);
  });
  it('zt and zb leave 4 lines of context', () => {
    expect(at('30Gzt')).toEqual([29, 25]);
    expect(at('30Gzb')).toEqual([29, 14]);
    expect(at('2Gzt')).toEqual([1, 0]);
  });
  it("Visual and operator-pending H and L stop 4 short of an edge that is not the file's", () => {
    expect(at('vL<Esc>')).toEqual([15, 0]);
    expect(at('vL<Esc>M')).toEqual([9, 0]);
    expect(at('vL<Esc>MvH<Esc>')).toEqual([0, 0]);
    expect(at('30GztvH<Esc>')).toEqual([29, 25]);
    expect(at('30Gztv3H<Esc>')).toEqual([29, 25]);
    expect(at('30GztvL<Esc>')).toEqual([40, 25]);
    expect(at('GvL<Esc>')).toEqual([59, 40]);
    expect(at('GvH<Esc>')).toEqual([44, 40]);
  });
});

const lines = (text: string, keys: string, name = 'a.ts') => {
  const v = new Vim({ text, name });
  v.feedKeys(keys);
  return v;
};

describe('shiftround', () => {
  it('>> and << land on a multiple of shiftwidth', () => {
    const t = '   abc\n     def';
    expect(lines(t, '>>').buf.lines).toEqual(['    abc', '     def']);
    expect(lines(t, '<<').buf.lines).toEqual(['  abc', '     def']);
    expect(lines(t, '2>>').buf.lines).toEqual(['    abc', '      def']);
    expect(lines(t, '2<<').buf.lines).toEqual(['  abc', '    def']);
    expect(lines(t, 'Vj2>').buf.lines).toEqual(['      abc', '        def']);
    expect(lines(t, 'Vj2<').buf.lines).toEqual(['abc', '  def']);
  });
  it('says so the first time it rounds, and only then', () => {
    const v = lines('   abc\n  x', '>>');
    expect(v.lazyNote).toMatch(/shiftround/);
    v.lazyNote = null;
    v.feedKeys('>>');
    expect(v.lazyNote).toBeNull();
    expect(lines('  x', '>>').lazyNote).toBeNull(); // already a multiple: nothing to round
  });
});

describe('scrolloff notes', () => {
  it('zt and zb say why they stopped short, once', () => {
    const v = sixty();
    v.feedKeys('30Gzt');
    expect(v.lazyNote).toMatch(/rows in from the top/);
    v.lazyNote = null;
    v.feedKeys('40Gzb');
    expect(v.lazyNote).toBeNull();
  });
  it('no note where context changes nothing (the file starts on screen)', () => {
    const v = sixty();
    v.feedKeys('ggzt');
    expect(v.lazyNote).toBeNull();
  });
});

describe("H and L: LazyVim's previous and next buffer (Normal mode)", () => {
  const files = { 'a.ts': 'a\n', 'b.ts': 'b\n', 'c.ts': 'c\n' };
  const three = () => { const v = new Vim({ files, open: 'a.ts' }); v.feedKeys(':e b.ts<CR>:e c.ts<CR>:e a.ts<CR>'); return v; };
  it('L is :bnext, H is :bprevious, wrapping around; a count makes no difference', () => {
    const v = three();
    v.feedKeys('L');
    expect(v.buf.name).toBe('b.ts');
    expect(v.lazyNote).toMatch(/LazyVim uses H and L for the previous and next buffer/);
    v.lazyNote = null;
    v.feedKeys('LL');
    expect([v.buf.name, v.lazyNote]).toEqual(['a.ts', null]);
    v.feedKeys('H');
    expect(v.buf.name).toBe('c.ts');
    v.feedKeys('3L');
    expect(v.buf.name).toBe('a.ts');
  });
  it('after an operator they are the top and bottom of the window, with no scrolloff (nvim: 5GdL)', () => {
    const v = sixty();
    v.feedKeys('5GdL');
    expect(v.buf.lineCount).toBe(44);
    expect(v.buf.lines[4]).toBe('l20');
  });
  it('with one buffer nothing happens and nothing is noted', () => {
    const v = new Vim({ text: 'a\nb', name: 'a.ts' });
    v.feedKeys('jL');
    expect([v.buf.name, v.cursor.line, v.lazyNote]).toEqual(['a.ts', 1, null]);
  });
});

describe('ignorecase + smartcase', () => {
  it('a lowercase search finds capitals, and says so once; a capital makes it exact', () => {
    const v = lines('let user = 1;\nconst User = 2;\nuser = User;', 'w/user<CR>');
    expect(v.cursor).toEqual({ line: 1, col: 6 });
    expect(v.lazyNote).toMatch(/"user" found "User"/);
    const w = lines('let user = 1;\nconst User = 2;\nuser = User;', '/User<CR>n');
    expect(w.cursor).toEqual({ line: 2, col: 7 });
    expect(w.lazyNote).toBeNull();
  });
});

describe('confirm', () => {
  const files = { 'a.ts': 'a\n', 'b.ts': 'b\n' };
  it(':q on a changed buffer asks to save; Yes writes, Cancel stays', () => {
    const v = new Vim({ files, open: 'a.ts' });
    v.feedKeys('x:q<CR>');
    expect(v.mode).toBe('confirm');
    expect(v.confirm?.prompt).toBe('Save changes to "a.ts"?\n[Y]es, (N)o, (C)ancel: ');
    expect(v.lazyNote).toMatch(/E37/);
    v.feedKeys('c');
    expect(v.mode).toBe('normal');
    expect(v.buf.modified).toBe(true);
    v.feedKeys(':q<CR>y');
    expect(v.fs.read('a.ts')).toBe('\n');
    expect(v.buf.modified).toBe(false);
    expect(v.events).toContain('quit');
  });
  it('No quits without saving; :q! and noconfirm keep plain Vim', () => {
    const v = new Vim({ files, open: 'a.ts' });
    v.feedKeys('x:q<CR>n');
    expect(v.events).toContain('quit');
    expect(v.fs.read('a.ts')).toBe('a\n');
    v.feedKeys(':q!<CR>');
    expect(v.events).toContain('quit');
    v.feedKeys(':set nocf<CR>:q<CR>');
    expect(v.message?.text).toBe('E37: No write since last change (add ! to override)');
  });
  it('<CR> answers Yes', () => {
    const v = new Vim({ files, open: 'a.ts' });
    v.feedKeys('x:q<CR><CR>');
    expect([v.fs.read('a.ts'), v.events.includes('quit'), v.confirm]).toEqual(['\n', true, null]);
  });
  it("with 'hidden', :q in a split just closes it; the last :q asks about hidden changed buffers", () => {
    const v = new Vim({ files, open: 'a.ts' });
    v.feedKeys(':sp b.ts<CR>x:q<CR>');
    expect([v.tab.windows().length, v.confirm]).toEqual([1, null]);
    v.feedKeys(':q<CR>');
    expect(v.confirm?.prompt).toBe('Save changes to "b.ts"?\n[Y]es, (N)o, (C)ancel: ');
    const w = new Vim({ files, open: 'a.ts' });
    w.feedKeys(':set nocf<CR>:e b.ts<CR>x:e a.ts<CR>:q<CR>');
    expect(w.message?.text).toBe('E162: No write since last change for buffer "b.ts"');
  });
  it(':qa asks for each changed buffer, with Save All and Discard All', () => {
    const v = new Vim({ files, open: 'a.ts' });
    v.feedKeys('x:e b.ts<CR>x:qa<CR>');
    expect(v.confirm?.prompt).toBe('Save changes to "a.ts"?\n[Y]es, (N)o, Save (A)ll, (D)iscard All, (C)ancel: ');
    v.feedKeys('a');
    expect([v.fs.read('a.ts'), v.fs.read('b.ts')]).toEqual(['\n', '\n']);
  });
});

describe('formatoptions: comments continue (r, o) and join (j)', () => {
  // From nvim with LazyVim's options; indents kept as LazyVim's treesitter indent keeps them
  // (nvim --clean's TypeScript indent script drops them).
  const L = (text: string, keys: string, name = 'a.ts') => lines(text, keys, name).buf.lines;
  it('o, O and <CR> start the new line with the leader', () => {
    expect(L('  // foo', 'ox<Esc>')).toEqual(['  // foo', '  // x']);
    expect(L('  // foo', 'Ox<Esc>')).toEqual(['  // x', '  // foo']);
    expect(L('/* foo', 'ox<Esc>')).toEqual(['/* foo', ' * x']);
    expect(L(' * foo', 'ox<Esc>')).toEqual([' * foo', ' * x']);
    expect(L('//', 'ox<Esc>')).toEqual(['//', '//x']);
    expect(L('  //   foo', 'ox<Esc>')).toEqual(['  //   foo', '  //   x']);
    expect(L('-- foo', 'ox<Esc>', 'a.lua')).toEqual(['-- foo', '-- x']);
    expect(L('--- foo', 'ox<Esc>', 'a.lua')).toEqual(['--- foo', '--- x']);
    expect(L('# foo', 'ox<Esc>', 'a.py')).toEqual(['# foo', '# x']);
    expect(L('# foo', 'A<CR>x<Esc>', 'a.sh')).toEqual(['# foo', '# x']);
    expect(L('  -- foo bar', '0fbi<CR><Esc>', 'a.lua')).toEqual(['  -- foo ', '  -- bar']);
    expect(L('> foo', 'ox<Esc>', 'a.txt')).toEqual(['> foo', '> x']);
  });
  it('but not after code, a closed /* */, #foo in Python, or in Markdown', () => {
    expect(L('x = 1; // foo', 'ox<Esc>')).toEqual(['x = 1; // foo', 'x']);
    expect(L('  /* x */', 'ox<Esc>')).toEqual(['  /* x */', '  x']);
    expect(L('#foo', 'ox<Esc>', 'a.py')).toEqual(['#foo', 'x']);
    expect(L('> foo', 'ox<Esc>', 'a.md')).toEqual(['> foo', 'x']);
  });
  it("a first-line-only leader lines the next one up instead ('fb:-')", () => {
    expect(L('  - foo', 'ox<Esc>', 'a.txt')).toEqual(['  - foo', '    x']);
  });
  it('an untyped new line loses the blanks after its leader', () => {
    expect(L('  -- foo', 'A<CR><Esc>', 'a.lua')).toEqual(['  -- foo', '  --']);
    expect(L('  foo', 'A<CR><Esc>', 'a.txt')).toEqual(['  foo', '']);
  });
  it('<CR> keeps the first part\'s trailing blanks (Neovim keeps them)', () => {
    expect(L('  foo bar  ', '0fbi <CR><Esc>', 'a.txt')).toEqual(['  foo  ', '  bar  ']);
  });
  it('J drops the joined comment line\'s leader; gJ only the leader', () => {
    expect(L('// a\n// b', 'J')).toEqual(['// a b']);
    expect(L('// a\n  // b', 'J')).toEqual(['// a b']);
    expect(L('x = 1;\n// b', 'J')).toEqual(['x = 1; // b']);
    expect(L('// a\nx = 1;', 'J')).toEqual(['// a x = 1;']);
    expect(L('// a\n// b', 'gJ')).toEqual(['// a b']);
    expect(L('-- a\n-- b\n-- c', '3J', 'a.lua')).toEqual(['-- a b c']);
    expect(L(' * a\n * b', 'J')).toEqual([' * a b']);
    expect(L('/**\n * b', 'J')).toEqual(['/** b']);
  });
  it('notes the continuation only where plain Neovim would not continue', () => {
    expect(lines('# a', 'ox<Esc>', 'a.py').lazyNote).toMatch(/continued the comment.*python files/);
    expect(lines('// a', 'ox<Esc>').lazyNote).toBeNull(); // Neovim's TypeScript ftplugin continues it too
  });
  it('a second <CR> on an untyped comment line leaves the leader without its blank', () => {
    expect(L('  // a', 'A<CR><CR>x<Esc>')).toEqual(['  // a', '  //', '  // x']);
  });
});

describe('smartindent (filetypes without treesitter indent)', () => {
  const T = (text: string, keys: string) => lines(text, keys, 's.txt').buf.lines;
  it('in a level after "{" and after an if/for line, on o and <CR>', () => {
    expect(T('  if (x) {', 'A<CR>y<Esc>')).toEqual(['  if (x) {', '    y']);
    expect(T('  if (x) {', 'ox<Esc>')).toEqual(['  if (x) {', '    x']);
    expect(T('  if x', 'ox<Esc>')).toEqual(['  if x', '    x']);
    expect(T('  foo(', 'ox<Esc>')).toEqual(['  foo(', '  x']);
    expect(T('  if (x) {', 'Ox<Esc>')).toEqual(['  x', '  if (x) {']);
  });
  it('"}" first on a line goes back to its "{", or a level out; "#" to column 0', () => {
    expect(T('    x', 'A<CR>}<Esc>')).toEqual(['    x', '  }']);
    expect(T('  {\n    x', 'jA<CR>}<Esc>')).toEqual(['  {', '    x', '  }']);
    expect(T('  x', 'A<CR>#y<Esc>')).toEqual(['  x', '#y']);
  });
  it('code files indent after any opener, as treesitter does', () => {
    expect(lines('  foo(', 'A<CR>x<Esc>').buf.lines).toEqual(['  foo(', '    x']);
    expect(lines('  foo({\n    a,', 'jA<CR>}<Esc>').buf.lines).toEqual(['  foo({', '    a,', '  }']);
  });
});

describe('virtualedit=block', () => {
  it('a block keeps its column on a short line, past the end', () => {
    const v = lines('abcdef\nabcdef\nab', '04l<C-v>jjd', 'v.txt');
    expect(v.buf.lines).toEqual(['abcdf', 'abcdf', 'ab']);
    expect(v.cursor).toEqual({ line: 0, col: 4 });
    const w = lines('abcdef\nab', '04l<C-v>jAx<Esc>', 'v.txt');
    expect(w.buf.lines).toEqual(['abcdexf', 'ab   x']);
    expect(w.cursor).toEqual({ line: 0, col: 4 });
    expect(lines('ab\nabcdef\nabcdef', '0<C-v>jj4ld', 'v.txt').buf.lines).toEqual(['', 'f', 'f']);
    expect(lines('abcdef\nabcdef\nab', ':set ve=<CR>04l<C-v>jjd', 'v.txt').buf.lines).toEqual(['abf', 'abf', 'ab']);
  });
});

describe('virtualedit=block registers', () => {
  it('a block past a line\'s end is padded with spaces, as in nvim with ve=block', () => {
    const a = lines('abcd\nab\nx', 'lll<C-v>jd', 'v.txt');
    expect([a.buf.lines, a.cursor, a.getRegister('"').text]).toEqual([['abc', 'ab', 'x'], { line: 0, col: 2 }, 'd\n ']);
    const b = lines('abcd\nabcde\nx', 'jllll<C-v>ky', 'v.txt');
    expect([b.cursor, b.getRegister('"').text]).toEqual([{ line: 0, col: 3 }, ' \ne']);
    const c = lines('ab\nx\nabcd', '<C-v>jly', 'v.txt');
    expect([c.cursor, c.getRegister('"').text]).toEqual([{ line: 0, col: 0 }, 'ab\nx ']);
  });
});

describe('virtualedit=block pads every line of a yanked block', () => {
  it('to the block\'s width (plain Vim leaves short lines short)', () => {
    expect(lines('abcdef\nabc', '02l<C-v>j3ly', 'v.txt').getRegister('"').text).toBe('cdef\nc   ');
    expect(lines('abcdef\nab\nabcdef', '02l<C-v>jj1ly', 'v.txt').getRegister('"').text).toBe('cd\n  \ncd');
    expect(lines('abcdef\nab\nabcdef', ':set ve=<CR>02l<C-v>jj1ly', 'v.txt').getRegister('"').text).toBe('cd\n\ncd');
  });
});

describe('foldmethod=indent/expr, foldlevel=99', () => {
  const code = ['function a() {', '  if (x) {', '    y();', '  }', '  return 1;', '}', '', 'const z = 1;'].join('\n');
  it('folds come from the code, all open; za closes the one under the cursor', () => {
    const v = lines(code, 'jza');
    expect(v.win.folds.map(f => [f.start, f.end])).toEqual([[0, 5], [1, 3]]);
    expect(v.win.folds.map(f => f.closed)).toEqual([false, true]);
    v.feedKeys('zM');
    expect(v.win.folds.every(f => f.closed)).toBe(true);
    expect(v.optIn(v.win, 'foldlevel')).toBe(0);
    v.feedKeys('zR');
    expect(v.win.folds.every(f => !f.closed)).toBe(true);
    expect(v.optIn(v.win, 'foldlevel')).toBe(2);
  });
  it('zf, zd and zE fail as in Neovim, with a note; manual folding still works when set', () => {
    const v = lines(code, 'zfj');
    expect(v.message?.text).toBe("E350: Cannot create fold with current 'foldmethod'");
    expect(v.lazyNote).toMatch(/foldmethod/);
    v.feedKeys('zE');
    expect(v.message?.text).toBe("E352: Cannot erase folds with current 'foldmethod'");
    const m = lines(code, ':setlocal fdm=manual<CR>zfj');
    expect(m.win.folds.map(f => [f.start, f.end, f.closed])).toEqual([[0, 1, true]]);
  });
});

describe('inccommand=nosplit', () => {
  it('a :s being typed previews its result; nothing changes until <CR>', async () => {
    const { subPreview } = await import('../ex');
    const v = lines('let a = foo;\nfoo(foo);\nbar', '');
    expect(subPreview(v, '%s/foo')).toBeNull(); // no replacement typed yet
    expect([...subPreview(v, '%s/foo/baz')!.entries()]).toEqual([[0, { text: 'let a = baz;', spans: [[8, 10]] }], [1, { text: 'baz(foo);', spans: [[0, 2]] }]]);
    expect(subPreview(v, '%s/foo/baz/g')!.get(1)).toEqual({ text: 'baz(baz);', spans: [[0, 2], [4, 6]] });
    expect([...subPreview(v, 's/foo/x')!.keys()]).toEqual([0]);
    expect(subPreview(v, 'set ts=2')).toBeNull();
    expect(v.buf.lines).toEqual(['let a = foo;', 'foo(foo);', 'bar']);
  });
});

describe('jumpoptions=view', () => {
  it('<C-o> brings back the view the jump was made from', () => {
    expect(at('30GztG<C-o>')).toEqual([29, 25]);
    expect(at('10Gzt40Gzb<C-o>')).toEqual([9, 5]);
  });
  it('and searches, marks, `` and g; bring back their views (nvim with LazyVim\'s options)', () => {
    const a = (keys: string) => at(keys).map(n => n + 1);
    expect(a("30GzbmaG'a")).toEqual([30, 15]);
    expect(a('30Gzbmagg`a')).toEqual([30, 15]);
    expect(a('30GzbxGg;')).toEqual([30, 15]);
    expect(a('30GzbG<C-o>')).toEqual([30, 15]);
    expect(a('30Gzb/l50<CR><C-o>')).toEqual([30, 15]);
    expect(a('30Gzb/l50<CR><C-o><C-i>')).toEqual([51, 41]);
    expect(a('30Gzb5G``')).toEqual([30, 15]);
    expect(a("10GztmaG'a")).toEqual([10, 6]);
  });
});

describe('virtualedit=block: c, r, I and : on short lines', () => {
  const T = (text: string, keys: string) => lines(text, keys, 'v.txt').buf.lines;
  it('c and r pad a short line out to the block; I leaves it', () => {
    expect(T('abcdef\nab\nabcdef', '03l<C-v>jjcx<Esc>')).toEqual(['abcxef', 'ab x', 'abcxef']);
    expect(T('abcdef\nab\nabcdef', '03l<C-v>jjrx')).toEqual(['abcxef', 'ab x', 'abcxef']);
    expect(T('abcdef\nabcd\nab\nabcdef', '03l<C-v>3j2lrx')).toEqual(['abcxxx', 'abcxxx', 'ab xxx', 'abcxxx']);
    expect(T('abcdef\nabcd\nab\nabcdef', '03l<C-v>3j2lcx<Esc>')).toEqual(['abcx', 'abcx', 'ab x', 'abcx']);
    expect(T('abcdef\nab\nabcdef', '03l<C-v>jjIx<Esc>')).toEqual(['abcxdef', 'ab', 'abcxdef']);
  });
  it('v out of a block brings a cursor past the end back onto the line', () => {
    expect(lines('ab\nabcdef\nx', 'j5l<C-v>kv', 'v.txt').cursor).toEqual({ line: 0, col: 1 });
  });
  it(': from Visual puts the cursor at the start of the selection', () => {
    const at = (keys: string) => lines('abcdef\nabcdefgh\nxyz', keys, 'v.txt').cursor;
    expect(at('04lvj:<C-u>echo 1<CR>')).toEqual({ line: 0, col: 4 });
    expect(at('j06lvk:<C-u>echo 1<CR>')).toEqual({ line: 0, col: 5 });
    expect(at('02lVj:<C-u>echo 1<CR>')).toEqual({ line: 0, col: 0 });
    expect(at('j06l<C-v>k02l:<C-u>echo 1<CR>')).toEqual({ line: 0, col: 2 });
  });
});

describe('scrolling as Neovim 0.12 does it (update_topline, pagescroll)', () => {
  const a = (keys: string) => at(keys).map(n => n + 1); // 1-based, as probed
  it('C-f keeps two lines; with the end on screen it puts the last line at the top', () => {
    expect(a('<C-f><C-f><C-f>')).toEqual([59, 55]);
    expect(a('<C-f><C-f><C-f><C-f>')).toEqual([60, 60]);
    expect(a('3<C-f>')).toEqual([59, 55]);
    expect(a('G<C-f>')).toEqual([60, 60]);
    expect(a('45G<C-f>')).toEqual([58, 54]);
    expect(a('<C-f><C-f><C-f><C-f><C-b>')).toEqual([55, 40]);
    expect(a('G<C-b>')).toEqual([38, 23]);
    expect(a('<C-f><C-f><C-f>M')).toEqual([59, 55]);
  });
  it('C-d stops with the last line at the bottom', () => {
    expect(a('<C-d><C-d><C-d><C-d><C-d>')).toEqual([55, 41]);
    expect(a('<C-d><C-d><C-d><C-d><C-d><C-d>')).toEqual([60, 41]);
    expect(a('<C-d><C-d><C-d><C-d><C-d><C-u>')).toEqual([45, 31]);
  });
  it('a far jump centres the line; a near one scrolls just enough', () => {
    expect(a('30G')).toEqual([30, 15]);
    expect(a('31G')).toEqual([31, 21]);
    expect(a('37G')).toEqual([37, 27]);
    expect(a('38G')).toEqual([38, 29]);
    expect(a('40G')).toEqual([40, 31]);
    expect(a('40G<C-y>')).toEqual([40, 30]);
    expect(a('10Gzt45G')).toEqual([45, 36]);
    expect(a('20Gzt50G')).toEqual([50, 40]);
    expect(a('10Gzt52G')).toEqual([52, 41]);
    expect(a('G36G')).toEqual([36, 27]);
    expect(a('G37G')).toEqual([37, 33]);
    expect(a('/l30<CR>')).toEqual([31, 21]);
    expect(a('/l40<CR>')).toEqual([41, 32]);
    expect(a('40Gzt?l20<CR>')).toEqual([21, 12]);
  });
  it('plain Neovim (scrolloff=0) too', () => {
    const p = (keys: string) => a(':set so=0<CR>' + keys);
    expect(p('40G')).toEqual([40, 30]);
    expect(p('25G')).toEqual([25, 6]);
    expect(p('30G')).toEqual([30, 11]);
    expect(p('21G')).toEqual([21, 2]);
    expect(p('G25G')).toEqual([25, 16]);
    expect(p('Gk20G')).toEqual([20, 11]);
  });
});

describe('the ignorecase note', () => {
  const note = (text: string, keys: string) => lines(text, keys).lazyNote;
  it('fires when ignoring case made the match: /, *, :s and :g', () => {
    expect(note("const User = 1;\nuser();", "w*")).toMatch(/\* and # don.t use smartcase, so they found "user"/);
    expect(note('a User\nb', ':%s/user/x/<CR>')).toMatch(/ignores case/);
    expect(note('a User\nb', ':g/user/d<CR>')).toMatch(/ignores case/);
  });
  it('not for \\c, the i flag, or an exact match', () => {
    expect(note('x\nAB', '/ab\\c<CR>')).toBeNull();
    expect(note('a User\nb', ':%s/user/x/i<CR>')).toBeNull();
    expect(note('a user\nb', ':%s/user/x/<CR>')).toBeNull();
    expect(note('a user\nuser', 'w*')).toBeNull();
  });
});

describe("new-line indent as LazyVim's treesitter indent gives it (nvim with its indentexpr)", () => {
  const L = (text: string, keys: string, name: string) => lines(text, keys, name).buf.lines;
  it('a level in after each language\'s openers', () => {
    expect(L('def f(x):', 'oy<Esc>', 'a.py')).toEqual(['def f(x):', '    y']);
    expect(L('if x:', 'A<CR>y<Esc>', 'a.py')).toEqual(['if x:', '    y']);
    expect(L('    return x', 'oy<Esc>', 'a.py')).toEqual(['    return x', '    y']);
    expect(L('local function f()', 'oy<Esc>', 'a.lua')).toEqual(['local function f()', '  y']);
    expect(L('if x then', 'oy<Esc>', 'a.lua')).toEqual(['if x then', '  y']);
    expect(L('if [ x ]; then', 'ox<Esc>', 'a.sh')).toEqual(['if [ x ]; then', '  x']);
    expect(L('for x in y; do', 'ox<Esc>', 'a.sh')).toEqual(['for x in y; do', '  x']);
    expect(L('function f() { // a', 'ox<Esc>', 'a.ts')).toEqual(['function f() { // a', '  x']);
    expect(L('if (x)', 'oy<Esc>', 'a.ts')).toEqual(['if (x)', '  y']);
    expect(L('def f():\n    return x', 'joy<Esc>', 'a.py')).toEqual(['def f():', '    return x', 'y']);
    expect(L('x = foo(a,', 'ob<Esc>', 'a.py')).toEqual(['x = foo(a,', '        b']);
  });
  it('block words go back out as typed', () => {
    expect(L('  if x then\n    y()', 'jA<CR>end<Esc>', 'a.lua')).toEqual(['  if x then', '    y()', '  end']);
  });
  it('O takes the indent an o from the line above would; o after a closed comment returns to its indent', () => {
    expect(L('function f() {\n}', 'jOx<Esc>', 'a.ts')).toEqual(['function f() {', '  x', '}']);
    expect(L('if (a) {\n  b();\n}', 'GOx<Esc>', 'a.ts')).toEqual(['if (a) {', '  b();', '  x', '}']);
    expect(L('function f() {\n  if (a) {\n    b();\n  }\n}', '4GOx<Esc>', 'a.ts')).toEqual(['function f() {', '  if (a) {', '    b();', '    x', '  }', '}']);
    expect(L('  {\n  }', 'jOx<Esc>', 'a.txt')).toEqual(['  {', '    x', '  }']);
    expect(L('/**\n * foo\n */', 'Gox<Esc>', 'a.ts')).toEqual(['/**', ' * foo', ' */', 'x']);
    expect(L('  /**\n   * foo\n   */', 'Gox<Esc>', 'a.ts')).toEqual(['  /**', '   * foo', '   */', '  x']);
  });
  it('Markdown keeps the indent; a YAML key takes its children\'s; unfinished JSON starts at column 0', () => {
    expect(L('- item {', 'ox<Esc>', 'a.md')).toEqual(['- item {', 'x']);
    expect(L('if you can', 'ox<Esc>', 'a.md')).toEqual(['if you can', 'x']);
    expect(L('a:\n  b:', 'jox<Esc>', 'a.yaml')).toEqual(['a:', '  b:', '  x']);
    expect(L('a:\n  b: 1', 'ggox<Esc>', 'a.yaml')).toEqual(['a:', '  x', '  b: 1']);
    expect(L('a:\n  b:\n    c: 1', 'jox<Esc>', 'a.yaml')).toEqual(['a:', '  b:', '    x', '    c: 1']);
    expect(L('{\n  "a": 1,', 'jox<Esc>', 'a.json')).toEqual(['{', '  "a": 1,', 'x']);
    expect(L('{\n  "a": 1\n}', 'jox<Esc>', 'a.json')).toEqual(['{', '  "a": 1', '  x', '}']);
  });
});

describe('folds made from the text, made again after edits', () => {
  const closed = (v: Vim) => v.win.folds.filter(f => f.closed && f.end > f.start).map(f => [f.start + 1, f.end + 1]);
  it("text files fold as Vim's foldmethod=indent: the indented lines, not their header", () => {
    expect(closed(lines('a\n  b\n  c\nd', 'jza', 'a.txt'))).toEqual([[2, 3]]);
    expect(closed(lines('a\n  b\n\n  c\nd', 'zM', 'a.txt'))).toEqual([[2, 4]]);
    expect(closed(lines('a\n  b\nc', 'zRGo  d<Esc>zM', 'a.txt'))).toEqual([]); // one-line folds don't close
  });
  it('Markdown folds by section', () => {
    expect(closed(lines('# A\n\ntext\n\n## B\n\nmore', 'zM', 'a.md'))).toEqual([[1, 7], [5, 7]]);
    expect(closed(lines('# A\n\ntext\n\n# B\n\nmore', 'zM', 'a.md'))).toEqual([[1, 3], [5, 7]]); // no trailing blank
    // A fenced code block is a fold of its own; a # inside it is no heading.
    expect(closed(lines('# A\n\n```lua\nx = 1\ny = 2\n```\n\ntext', 'zMzo', 'a.md'))).toEqual([[3, 6]]);
    expect(closed(lines('# A\n\n```sh\n# not a heading\nls\n```\n\n## B\nx', 'zM', 'a.md'))).toEqual([[1, 9], [3, 6], [8, 9]]);
  });
  it('a function added after zR folds too on zM; folds keep their state through edits', () => {
    expect(closed(lines('function a() {\n  x();\n}', 'zRGofunction b() {<CR>y();<CR>}<Esc>zM'))).toEqual([[1, 3], [4, 6]]);
    expect(closed(lines('function a() {\n  x();\n}\n\nconst c = 1;', 'zcGx'))).toEqual([[1, 3]]);
  });
  it('a fold an edit makes starts open, even a copy of a closed one (nvim)', () => {
    const v = lines('function a() {\n  x();\n}\n\nconst c = 1;', 'zMggyyGp');
    expect(closed(v)).toEqual([[1, 3]]);
    v.feedKeys('x');
    expect(v.buf.lines[5]).toBe('unction a() {');
  });
  it('folds a lesson sets up are left alone', () => {
    const v = lines('a\nb\nc', '');
    v.win.folds.push({ start: 0, end: 1, closed: true });
    v.feedKeys('Gx');
    expect(closed(v)).toEqual([[1, 2]]);
  });
});

describe('splitbelow / splitright sizes', () => {
  it('the new window takes the odd row (nvim: 9 rows old, 10 new)', () => {
    const v = new Vim({ text: 'a\nb', name: 'a.txt' });
    v.feedKeys(':sp<CR>');
    const r = v.tab.layoutFor(20, 120, true);
    const [top, bottom] = v.tab.windows();
    expect([r.get(top)!.height - 1, r.get(bottom)!.height - 1]).toEqual([9, 10]);
    expect(bottom).toBe(v.win);
  });
});

describe('> and < on a Visual block (shift_block)', () => {
  const T = (text: string, keys: string) => { const v = lines(text, 'gg0' + keys, 's.txt'); return [v.buf.lines, v.cursor.col]; };
  it('shifts from the block\'s column, as nvim does', () => {
    expect(T('a  abc\na  abc', 'll<C-v>j>')).toEqual([['a    abc', 'a    abc'], 2]);
    expect(T('a   abc\na  abc', 'll<C-v>j>')).toEqual([['a     abc', 'a    abc'], 2]);
    expect(T('a  abc\na  abc', 'll<C-v>j2>')).toEqual([['a      abc', 'a      abc'], 2]);
    expect(T('abcdef\nabcdef', 'll<C-v>j>')).toEqual([['ab  cdef', 'ab  cdef'], 2]);
    expect(T('a  abc\na  abc', '<C-v>j>')).toEqual([['  a  abc', '  a  abc'], 0]);
    expect(T('a  abc\na  abc', 'll<C-v>j<')).toEqual([['a abc', 'a abc'], 2]);
    expect(T('a    bc\na    bc', 'll<C-v>j<')).toEqual([['a  bc', 'a  bc'], 2]);
    expect(T('a    bc\na    bc', 'll<C-v>j3<')).toEqual([['a bc', 'a bc'], 2]);
    expect(T('abcdef\nabcdef', 'll<C-v>j<')).toEqual([['abcdef', 'abcdef'], 2]);
  });
});

describe('the view a page scroll sets lasts until the cursor changes line (VALID_TOPLINE)', () => {
  it('G<C-f> leaves the last line at the top through keys that keep the cursor line', () => {
    for (const k of ['0', 'M', ':echo<CR>', 'j', 'u', '<C-f>', '<C-d>']) expect(at('G<C-f>' + k)[1], k).toBe(59);
    expect(at('<C-f><C-f><C-f><C-f><C-f>')).toEqual([59, 59]);
    expect(at('G<C-f>k')[1]).toBeLessThan(59);
  });
});

describe('scrolling as move.c computes it (update_topline and friends), any window height', () => {
  const eighty = (h: number, keys: string) => {
    const v = new Vim({ text: Array.from({ length: 80 }, (_, i) => 'l' + i).join('\n'), name: 's.ts' });
    v.win.height = h;
    v.feedKeys(keys);
    return v.win.top + 1;
  };
  it('matches LazyVim (wrap off) at heights 13 and 14', () => {
    expect([eighty(13, '30G'), eighty(13, 'G33G'), eighty(13, '/l26<CR>')]).toEqual([24, 27, 21]);
    expect(eighty(14, '19G')).toBe(10);
  });
});

describe('three-way splits', () => {
  it(':sp :sp gives the odd row to the bottom (new) window, as nvim (6/6/7 of 21)', () => {
    const v = new Vim({ text: 'a', name: 'a.txt' });
    v.feedKeys(':sp<CR>:sp<CR>');
    const r = v.tab.layoutFor(21, 120, true); // 21 rows of windows and separators, then the status line
    expect(v.tab.windows().map(w => r.get(w)!.height - 1)).toEqual([6, 6, 7]);
  });
});

// Round-3 review, each case checked against stock LazyVim (nvim 0.12.6, its plugins loaded).
describe("[b ]b [B ]B: bufferline's cycle and move", () => {
  const files = { 'a.ts': 'a\n', 'b.ts': 'b\n', 'c.ts': 'c\n', 'd.ts': 'd\n', 'e.ts': 'e\n' };
  const five = () => {
    const v = new Vim({ files, open: 'a.ts' });
    v.feedKeys(':e b.ts<CR>:e c.ts<CR>:e d.ts<CR>:e e.ts<CR>:e a.ts<CR>');
    return v;
  };
  it('[b and ]b go one buffer and ignore a count (2]b → b.ts, 2[b → e.ts)', () => {
    let v = five();
    v.feedKeys('2]b');
    expect(v.buf.name).toBe('b.ts');
    expect(v.lazyNote).toMatch(/take no count/);
    v = five();
    v.feedKeys('2[b');
    expect(v.buf.name).toBe('e.ts');
  });
  it("[B and ]B move the current buffer's tab; the buffer stays and :ls keeps its numbers", () => {
    const v = five();
    v.feedKeys(']B');
    expect(v.buf.name).toBe('a.ts');
    expect(v.bufferOrder().map(b => b.name)).toEqual(['b.ts', 'a.ts', 'c.ts', 'd.ts', 'e.ts']);
    expect(v.lazyNote).toMatch(/move the buffer's tab/);
    v.feedKeys('L');
    expect(v.buf.name).toBe('c.ts'); // H and L follow the new order
    v.feedKeys('H[B');
    expect(v.bufferOrder().map(b => b.name)).toEqual(['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts']);
    v.feedKeys('[B'); // no wrap at the ends
    expect(v.bufferOrder()[0].name).toBe('a.ts');
  });
});

describe('new-line indent, round 3 (LazyVim treesitter)', () => {
  const L = (text: string, keys: string, name: string) => lines(text, keys, name).buf.lines;
  it('only a braceless `if (…)` indents its statement, and the line after it goes back out', () => {
    expect(L('for (const a of b)', 'oy<Esc>', 'a.ts')).toEqual(['for (const a of b)', 'y']);
    expect(L('} else if (x)', 'oy<Esc>', 'a.ts')).toEqual(['} else if (x)', 'y']);
    expect(L('if (x) // c', 'oy<Esc>', 'a.ts')).toEqual(['if (x) // c', '  y']);
    expect(L('  if (x)\n    y();', 'joz<Esc>', 'a.ts')).toEqual(['  if (x)', '    y();', '  z']);
    expect(L('if (a &&\n    b)', 'joy<Esc>', 'a.ts')).toEqual(['if (a &&', '    b)', '  y']);
  });
  it('Python: return leaves the function, pass and raise keep the indent', () => {
    expect(L('def f():\n    if a:\n        return x', 'Goy<Esc>', 'a.py').at(-1)).toBe('y');
    expect(L('def f():\n    if a:\n        pass', 'Goy<Esc>', 'a.py').at(-1)).toBe('        y');
    expect(L('def f():\n    raise E', 'Goy<Esc>', 'a.py').at(-1)).toBe('    y');
  });
  it('Python: line up after the outermost open bracket, not one in a string; return ( keeps the indent', () => {
    expect(L('x = foo(a, [1,', 'ob<Esc>', 'a.py')[1]).toBe('        b');
    expect(L('x = foo("(", a,', 'ob<Esc>', 'a.py')[1]).toBe('        b');
    expect(L("s = '(' + x", 'ob<Esc>', 'a.py')[1]).toBe('b');
    expect(L('def f():\n    return (a,', 'Gob<Esc>', 'a.py')[2]).toBe('    b');
  });
  it('YAML: a key with children, or a list item key, goes a level in', () => {
    expect(L('- a:\n    b: 1', 'ggox<Esc>', 'a.yaml')[1]).toBe('  x');
    expect(L('x:\n  - a:', 'jox<Esc>', 'a.yaml')[2]).toBe('    x');
    expect(L('a: # c\n  b: 1', 'ggox<Esc>', 'a.yaml')[1]).toBe('  x');
    expect(L('a:\n    b: 1', 'ggox<Esc>', 'a.yaml')[1]).toBe('  x');
  });
  it('JSON: brackets inside strings leave the file balanced', () => {
    expect(L('{\n  "a": "{"\n}', 'jox<Esc>', 'a.json')[2]).toBe('  x');
  });
  it('Rust: a statement without its ; continues a level in', () => {
    expect(L('fn f() {\n    x.a()\n}', 'joy<Esc>', 'a.rs')[2]).toBe('        y');
    expect(L('fn f() {\n    a;\n}', 'joy<Esc>', 'a.rs')[2]).toBe('    y');
  });
});

describe('round 3: Markdown preamble folds, small windows', () => {
  const closed = (v: Vim) => v.win.folds.filter(f => f.closed && f.end > f.start).map(f => [f.start + 1, f.end + 1]);
  it('the text before the first heading is a section (the whole document with none)', () => {
    expect(closed(lines('text\n\n```js\na\nb\n```\n\nmore', 'zM', 'a.md'))[0]).toEqual([1, 8]);
    expect(closed(lines('intro\nmore\n\n# A\nx', 'zM', 'a.md'))).toEqual([[1, 2], [4, 5]]);
    expect(closed(lines('intro\n\n# A\nx', 'zM', 'a.md'))).toEqual([[3, 4]]);
  });
  const atH = (h: number, keys: string) => {
    const v = sixty();
    v.win.height = h;
    v.feedKeys(keys);
    return [v.cursor.line, v.win.top];
  };
  it('zb keeps half an even window below the cursor; a 4-line window pages 3 lines', () => {
    expect(atH(8, '30Gzb')).toEqual([29, 26]);
    expect(atH(8, '30Gzt')).toEqual([29, 26]);
    expect(atH(4, '30G<C-f>')).toEqual([32, 31]);
    expect(atH(4, 'G<C-b>')).toEqual([54, 53]);
  });
});
