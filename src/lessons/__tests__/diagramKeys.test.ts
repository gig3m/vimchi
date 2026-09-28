import { describe, expect, it } from 'vitest';
import { segmentKeys } from '../../components/diagrams';
import { Vim } from '../../vim/editor';

const seg = (text: string, keys: string) => segmentKeys(new Vim({ text, name: 'a.ts' }), keys);

describe('diagram key grouping', () => {
  it('typed text is one run, not a chip per character', () => {
    expect(seg("const user = {\n  name: 'Ada',\n};", "jorole: 'admin',<Esc>")).toEqual([
      { kind: 'key', key: 'j' }, { kind: 'key', key: 'o' }, { kind: 'text', text: "role: 'admin'," }, { kind: 'key', key: 'esc' },
    ]);
  });
  it('commands group into one chip each', () => {
    expect(seg('a\nb\nc', 'yyjdd"0P').map(s => (s.kind === 'key' ? s.key : s.text))).toEqual(['yy', 'j', 'dd', '"0P']);
    expect(seg('foo bar', 'ciwx<Esc>').map(s => (s.kind === 'key' ? s.key : s.text))).toEqual(['ciw', 'x', 'esc']);
  });
  it('ex commands: colon, typed command, enter', () => {
    expect(seg('a\nb', ':%s/a/b/g<CR>').map(s => (s.kind === 'key' ? s.key : `"${s.text}"`))).toEqual([':', '"%s/a/b/g"', '⏎']);
  });
});
