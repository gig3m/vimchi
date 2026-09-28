import { describe, expect, it } from 'vitest';
import { Vim } from '../../editor';
import { miniAi } from '../mini-ai';

/** `|` in the text marks the cursor. */
function run(text: string, keys: string, name = 'a.ts') {
  const lines = text.split('\n');
  const line = lines.findIndex(l => l.includes('|'));
  const col = lines[line].indexOf('|');
  lines[line] = lines[line].replace('|', '');
  const vim = new Vim({ text: lines.join('\n'), name, plugins: [miniAi] });
  vim.win.cursor = { line, col };
  vim.feedKeys(keys);
  return vim;
}

describe('mini.ai', () => {
  it.each([
    // Brackets: ")" keeps inner whitespace, "(" drops it; search is cover-or-next.
    ['f( a|, b )', 'di)', 'f()'],
    ['f( a|, b )', 'di(', 'f(  )'],
    ['|const x = f(a, b);', 'ci(z<Esc>', 'const x = f(z);'],
    ['g(|x) + [1, 2]', 'dib', 'g() + [1, 2]'],
    ['g(x) + [1, |2]', 'dab', 'g(x) + '],
    // Next and last.
    ['|log("a"); warn("b");', 'cin"z<Esc>', 'log("z"); warn("b");'],
    ['log("a"); |warn("b");', 'cil"z<Esc>', 'log("z"); warn("b");'],
    ['log("a"); warn(|"b");', 'di(', 'log("a"); warn();'],
    ['|if (ok) run(task);', 'din(', 'if () run(task);'],
    ['|if (ok) run(task);', '2din(', 'if (ok) run();'],
    ['foo(1); |bar(2);', 'dil(', 'foo(); bar(2);'],
    ['a = [1, 2]; |b = {x: 1};', 'dal[', 'a = ; b = {x: 1};'],
    ['x = |"one" + \'two\'', 'diq', 'x = "" + \'two\''],
    ['x = "one" |+ \'two\'', 'dinq', 'x = "one" + \'\''],
    // Arguments.
    ['f(aa, b|b, cc)', 'dia', 'f(aa, , cc)'],
    ['f(aa, b|b, cc)', 'daa', 'f(aa, cc)'],
    ['f(a|a, bb, cc)', 'daa', 'f(bb, cc)'],
    ['f(aa, bb, c|c)', 'daa', 'f(aa, bb)'],
    ['f(a|a)', 'daa', 'f()'],
    ['f(g(1, 2), |x)', 'daa', 'f(g(1, 2))'],
    ['f(g(1, |2), x)', 'daa', 'f(g(1), x)'],
    ['send({ id: 1, name: "a, b" }, |cb)', 'dia', 'send({ id: 1, name: "a, b" }, )'],
    ['|f(aa, bb)', 'cinaz<Esc>', 'f(z, bb)'],
  ])('%s  %s', (text, keys, want) => {
    expect(run(text, keys).buf.text()).toBe(want);
  });

  it('ii / ai select an indent scope', () => {
    const src = 'if (x) {\n  a();\n\n  |b();\n}\nnext();';
    expect(run(src, 'dii').buf.text()).toBe('if (x) {\n}\nnext();');
    expect(run(src, 'dai').buf.text()).toBe('next();');
  });

  const code = [
    'export function total(items: Item[]): number {',
    '  let sum = 0;',
    '  for (const it of items) {',
    '    sum += it.price;',
    '  }',
    '  return sum;',
    '}',
    '',
    'export class Cart {',
    '  add(item: Item): void {',
    '    this.items.push(item);',
    '  }',
    '}',
  ].join('\n');

  it('af / if select a function', () => {
    expect(run(code.replace('sum += ', 'sum |+= '), 'daf').buf.text()).toBe(['', ...code.split('\n').slice(8)].join('\n'));
    expect(run(code.replace('sum += ', 'sum |+= '), 'cifreturn 0;<Esc>').buf.text().split('\n').slice(0, 3))
      .toEqual(['export function total(items: Item[]): number {', '  return 0;', '}']);
    // Methods inside a class.
    expect(run(code.replace('this.items', '|this.items'), 'daf').buf.text().split('\n').slice(8)).toEqual(['export class Cart {', '}']);
  });

  it('ac / ic select a class', () => {
    expect(run(code.replace('add(item', 'add(|item'), 'dic').buf.text().split('\n').slice(8)).toEqual(['export class Cart {', '  ', '}']);
    expect(run(code.replace('add(item', 'add(|item'), 'dac').buf.text().split('\n')).toHaveLength(8);
  });

  it('af works for Lua functions', () => {
    const lua = 'local M = {}\n\nfunction M.setup(opts)\n  |M.opts = opts\nend\n\nreturn M';
    expect(run(lua, 'daf', 'init.lua').buf.text()).toBe('local M = {}\n\n\nreturn M');
  });

  it(']m and [m move between functions', () => {
    const vim = run('|' + code, ']m');
    expect(vim.cursor).toEqual({ line: 9, col: 2 });
    vim.feedKeys('[m');
    expect(vim.cursor).toEqual({ line: 0, col: 0 });
    vim.feedKeys(']M');
    expect(vim.cursor).toEqual({ line: 6, col: 0 });
  });

  it('repeating an object in visual mode grows the selection', () => {
    const vim = run('f(g(|xy))', 'vi)i)d');
    expect(vim.buf.text()).toBe('f()');
  });
});

describe('mini.ai indent scope borders', () => {
  it('ai keeps a following line that is not a closer (Python)', () => {
    const py = 'def main():\n    if DEBUG:\n        |print("debug")\n    run()';
    expect(run(py, 'dai', 'main.py').buf.text()).toBe('def main():\n    run()');
  });
});
