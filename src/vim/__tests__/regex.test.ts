import { describe, expect, it } from 'vitest';
import { compile, replacer } from '../regex';

const sub = (text: string, pat: string, rep: string, g = true) => {
  const { re } = compile(pat);
  const r = replacer(rep, '', () => '');
  void g;
  return text.replace(re, (...a) => { const m = a.slice(0, -2) as unknown as RegExpExecArray; return r(m); });
};

describe('vim regex', () => {
  const cases: [string, string, string, string][] = [
    ['cat concat', '\\<cat\\>', 'dog', 'dog concat'],
    ['john smith', '\\v(\\w+) (\\w+)', '\\2 \\1', 'smith john'],
    ['john smith', '\\(\\w\\+\\) \\(\\w\\+\\)', '\\2 \\1', 'smith john'],
    ['john', '\\w\\+', '\\u&', 'John'],
    ['hello world', '\\w\\+', '\\U&', 'HELLO WORLD'],
    ['foobar', 'foo\\zsbar', 'X', 'fooX'],
    ['foobar', 'foo\\zebar', 'X', 'Xbar'],
    ['<a><b>', '<.\\{-}>', 'X', 'XX'],
    ['aaa', 'a\\{2}', 'b', 'ba'],
    ['a.b', 'a.b', 'X', 'X'],
    ['a.b axb', 'a\\.b', 'X', 'X axb'],
    ['a.b axb', '\\Va.b', 'X', 'X axb'],
    ['x = 1', '\\v\\s*\\=\\s*', ':', 'x:1'],
    ['foo(bar)', '\\vfoo\\(', 'X', 'Xbar)'],
    ['ab', 'a\\|b', 'X', 'XX'],
    ['ab ac', '\\va(c)@=', 'X', 'ab Xc'],
    ['  x', '^\\s\\+', '', 'x'],
    ['a$b', 'a$b', 'X', 'X'],
    ['Foo foo', '\\cfoo', 'x', 'x x'],
    ['one two', '\\v<(\\w)(\\w*)>', '\\u\\1\\L\\2', 'One Two'],
  ];
  for (const [text, pat, rep, want] of cases) {
    it(`${pat} → ${rep}`, () => expect(sub(text, pat, rep)).toBe(want));
  }
  it('smartcase', () => {
    expect(compile('foo', { ignorecase: true, smartcase: true }).re.flags).toContain('i');
    expect(compile('Foo', { ignorecase: true, smartcase: true }).re.flags).not.toContain('i');
    expect(compile('\\Sfoo', { ignorecase: true, smartcase: true }).re.flags).toContain('i');
  });
});
