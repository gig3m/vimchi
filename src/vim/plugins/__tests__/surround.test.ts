import { describe, expect, it } from 'vitest';
import { Vim } from '../../editor';
import { surround } from '../surround';

function run(text: string, col: number, keys: string, line = 0) {
  const vim = new Vim({ text, name: 'a.ts', plugins: [surround] });
  vim.win.cursor = { line, col };
  vim.feedKeys(keys);
  return vim;
}

describe('nvim-surround', () => {
  // The table from the nvim-surround README.
  it.each([
    ['surr*ound_words', 4, 'ysiw)', '(surround_words)'],
    ['*make strings', 0, 'ys$"', '"make strings"'],
    ['[delete ar*ound me!]', 10, 'ds]', 'delete around me!'],
    ['remove <b>HTML t*ags</b>', 15, 'dst', 'remove HTML tags'],
    ["'change quot*es'", 12, `cs'"`, '"change quotes"'],
    ['<b>or tag* types</b>', 9, 'csth1<CR>', '<h1>or tag types</h1>'],
    ['delete(functi*on calls)', 13, 'dsf', 'function calls'],
  ])('%s  %s', (text, _col, keys, want) => {
    expect(run(text.replace('*', ''), text.indexOf('*'), keys as string).buf.text()).toBe(want);
  });

  it.each([
    ['hello world', 0, 'ysiw(', '( hello ) world'],
    ['hello world', 0, 'ysiwb', '(hello) world'],
    ['hello world', 0, 'ysiwB', '{hello} world'],
    ['hello world', 0, 'ysiwr', '[hello] world'],
    ['hello world', 0, 'ysiwa', '<hello> world'],
    ['hello world', 0, 'ysiw<lt>em>', '<em>hello</em> world'],
    ['hello world', 0, 'ysiwtspan class="x"<CR>', '<span class="x">hello</span> world'],
    ['hello world', 0, 'ysiwfprint<CR>', 'print(hello) world'],
    ['  return x;', 4, 'yss)', '  (return x;)'],
    ['( spaced )', 4, 'ds(', 'spaced'],
    ['( spaced )', 4, 'ds)', ' spaced '],
    ['(tight)', 3, 'cs)[', '[ tight ]'],
    ['( a )', 2, 'cs(]', '[a]'],
    ['say "hi" now', 0, 'dsq', 'say hi now'],
    ["x = 'a' + \"b\"", 11, `csq'`, "x = 'a' + 'b'"],
    ['<div class="card">text</div>', 20, 'cstsection<CR>', '<section class="card">text</section>'],
    ['<div class="card">text</div>', 20, 'csTsection<CR>', '<section>text</section>'],
    ['<div class="card">text</div>', 20, 'cst<lt>p>', '<p class="card">text</p>'],
    ['log(value)', 5, 'csfconsole.log<CR>', 'console.log(value)'],
    ['a *b* c', 3, 'ds*', 'a b c'],
  ])('%s  %s', (text, col, keys, want) => {
    expect(run(text, col, keys as string).buf.text()).toBe(want);
  });

  it('S surrounds a visual selection', () => {
    expect(run('const x = a + b;', 10, 'vee)', 0).buf.text()).toBe('const x = a + b;'); // no S: nothing added
    expect(run('const x = a + b;', 10, 'v4lS)').buf.text()).toBe('const x = (a + b);');
    expect(run('const x = a + b;', 10, 'v4lS<lt>b>').buf.text()).toBe('const x = <b>a + b</b>;');
  });

  it('VS puts the delimiters on their own lines', () => {
    const vim = run('if (ok) {\n  run();\n}', 0, 'jVS{', 0);
    expect(vim.buf.text()).toBe('if (ok) {\n  {\n    run();\n  }\n}');
  });

  it('ySS adds on new lines', () => {
    expect(run('run();', 0, 'ySS{').buf.text()).toBe('{\n  run();\n}');
  });

  it('is dot-repeatable and undoable', () => {
    const vim = run('one two', 0, 'ysiw"W.');
    expect(vim.buf.text()).toBe('"one" "two"');
    vim.feedKeys('u');
    expect(vim.buf.text()).toBe('"one" two');
  });

  it('ds finds the next pair on the line when not inside one', () => {
    expect(run('call "x"', 0, 'ds"').buf.text()).toBe('call x');
  });
});
