import { describe, expect, it } from 'vitest';
import { Vim } from '../../editor';
import { diff } from '../diff';

const files = {
  'config.json': '{\n  "port": 8080,\n  "host": "0.0.0.0",\n  "debug": false\n}\n',
  'config.old.json': '{\n  "port": 3000,\n  "host": "0.0.0.0",\n  "cache": true,\n  "debug": false\n}\n',
};
const mk = () => new Vim({ files, open: 'config.json', plugins: [diff] });

describe('diff', () => {
  it(':diffsplit opens a diff window above; :vert diffsplit to the left', () => {
    const vim = mk();
    vim.ex('diffsplit config.old.json');
    expect(vim.tab.windows().map(w => [w.buf.name, !!w.opts.diff])).toEqual([['config.old.json', true], ['config.json', true]]);
    expect(vim.tab.root.type).toBe('col');
    const v2 = mk();
    v2.ex('vert diffsplit config.old.json');
    expect(v2.tab.root.type).toBe('row');
  });

  it('highlights changes and draws filler lines', () => {
    const vim = mk();
    vim.ex('vert diffsplit config.old.json');
    vim.feedKeys('<C-w>l');
    const d = vim.decorators.map(f => f(vim.buf, vim.win)).find(Boolean)!;
    expect([...d.lineBg!.keys()]).toEqual([1]);
    expect(d.hl).toEqual([expect.objectContaining({ line: 1, start: 10, end: 13 })]);
    expect(d.virtLines!.get(3)).toHaveLength(1);
  });

  it(']c / [c jump between changes', () => {
    const vim = mk();
    vim.ex('diffsplit config.old.json');
    vim.feedKeys(']c');
    expect(vim.cursor).toEqual({ line: 1, col: 0 });
    vim.feedKeys(']c');
    expect(vim.cursor.line).toBe(3);
    vim.feedKeys('[c');
    expect(vim.cursor.line).toBe(1);
  });

  it('do obtains and dp puts', () => {
    const vim = mk();
    vim.ex('diffsplit config.old.json');
    vim.feedKeys('<C-w>jj');
    vim.feedKeys('do');
    expect(vim.buf.lines[1]).toBe('  "port": 3000,');
    vim.feedKeys('u');
    expect(vim.buf.lines[1]).toBe('  "port": 8080,');
    vim.feedKeys('<C-w>k4Gdp');
    expect(vim.findBuffer('config.json')!.lines).toEqual(['{', '  "port": 8080,', '  "host": "0.0.0.0",', '  "cache": true,', '  "debug": false', '}']);
  });

  it(':diffget //2 and //3 resolve the conflict under the cursor; ]c walks conflicts', () => {
    const text = [
      'const a = 1;',
      '<<<<<<< HEAD',
      'const port = 8080;',
      '=======',
      'const port = 3000;',
      '>>>>>>> feature',
      'const b = 2;',
      '<<<<<<< HEAD',
      'const host = "a";',
      '||||||| base',
      'const host = "x";',
      '=======',
      'const host = "b";',
      '>>>>>>> feature',
    ].join('\n');
    const vim = new Vim({ text, name: 'app.ts', plugins: [diff] });
    vim.feedKeys(']c');
    expect(vim.cursor.line).toBe(1);
    vim.feedKeys('j');
    vim.ex('diffget //3');
    expect(vim.buf.lines.slice(0, 3)).toEqual(['const a = 1;', 'const port = 3000;', 'const b = 2;']);
    vim.feedKeys(']c');
    vim.ex('diffget //2');
    expect(vim.buf.lines).toEqual(['const a = 1;', 'const port = 3000;', 'const b = 2;', 'const host = "a";']);
    vim.feedKeys('u');
    expect(vim.buf.lineCount).toBe(10);
  });
});
