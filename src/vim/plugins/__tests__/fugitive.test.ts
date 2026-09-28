import { describe, expect, it } from 'vitest';
import { Vim } from '../../editor';
import { diff } from '../diff';
import { STATUS_NAME, fugitive } from '../fugitive';
import { diffLines, gitState, unified } from '../git-model';

const head = {
  'weather/api.py': 'import requests\n\ndef fetch(city):\n    return requests.get(URL + city)\n',
  'weather/units.py': 'def c_to_f(c):\n    return c * 9 / 5 + 32\n',
  'README.md': '# weather\n',
};
function mk() {
  const files = {
    ...head,
    'weather/api.py': 'import requests\n\nTIMEOUT = 5\n\ndef fetch(city):\n    return requests.get(URL + city, timeout=TIMEOUT)\n',
    'notes.txt': 'todo\n',
  };
  const vim = new Vim({ files, open: 'weather/api.py', plugins: [fugitive, diff] });
  vim.pluginData.git = { head: { ...head }, index: { ...head, 'README.md': '# weather\n\nA CLI.\n' } };
  return vim;
}

describe('git model', () => {
  it('diffs lines into hunks', () => {
    expect(diffLines(['a', 'b', 'c'], ['a', 'x', 'c', 'd'])).toEqual([
      { aStart: 1, aCount: 1, bStart: 1, bCount: 1, a: ['b'], b: ['x'] },
      { aStart: 3, aCount: 0, bStart: 3, bCount: 1, a: [], b: ['d'] },
    ]);
    expect(unified(['a', 'b', 'c'], ['a', 'x', 'c'])[0]).toMatchObject({ header: '@@ -1,3 +1,3 @@', lines: [' a', '-b', '+x', ' c'] });
  });
});

describe('fugitive', () => {
  it(':Git shows the status buffer', () => {
    const vim = mk();
    vim.ex('Git');
    expect(vim.buf.name).toBe(STATUS_NAME);
    expect(vim.buf.lines).toEqual([
      'Head: main', 'Help: g?', '',
      'Untracked (1)', '? notes.txt', '',
      'Unstaged (2)', 'M README.md', 'M weather/api.py', '',
      'Staged (1)', 'M README.md',
    ]);
    expect(vim.cursor.line).toBe(4);
    expect(vim.tab.windows()).toHaveLength(2);
  });

  it('s stages, u unstages, - toggles', () => {
    const vim = mk();
    vim.ex('G');
    vim.feedKeys('gus');
    expect(gitState(vim).index['README.md']).toBe('# weather\n');
    expect(vim.line(vim.cursor.line)).toBe('M weather/api.py');
    vim.feedKeys('-');
    expect(gitState(vim).index['weather/api.py']).toContain('TIMEOUT');
    vim.feedKeys('gsu');
    expect(gitState(vim).index['weather/api.py']).toBe(head['weather/api.py']);
    vim.feedKeys('gU-');
    expect(gitState(vim).index['notes.txt']).toBe('todo\n');
  });

  it('= shows an inline diff and s on a hunk stages only that hunk', () => {
    const vim = mk();
    vim.ex('Git');
    vim.feedKeys('gu');
    vim.feedKeys('j=');
    expect(vim.buf.lines.slice(9, 12)).toEqual(['@@ -1,4 +1,6 @@', ' import requests', ' ']);
    vim.feedKeys('js');
    expect(gitState(vim).index['weather/api.py']).toContain('TIMEOUT');
  });

  it('cc commits the staged changes with :wq', () => {
    const vim = mk();
    vim.ex('Git');
    vim.feedKeys('cc');
    expect(vim.buf.filetype).toBe('gitcommit');
    vim.feedKeys('iExplain the CLI<Esc>:wq<CR>');
    const g = gitState(vim);
    expect(g.log.map(c => c.message)).toEqual(['Explain the CLI']);
    expect(g.head['README.md']).toBe('# weather\n\nA CLI.\n');
    expect(vim.buf.name).toBe(STATUS_NAME);
    expect(vim.buf.lines).not.toContain('Staged (1)');
  });

  it(':Git blame opens a blame window; <CR> shows the commit', () => {
    const vim = mk();
    vim.pluginData.git = {
      log: [
        { hash: 'a1b2c3d', author: 'Ada', date: '2026-01-02', message: 'Add fetch', files: { 'weather/api.py': head['weather/api.py'] } },
      ],
    };
    vim.ex('Git blame');
    expect(vim.buf.lines[0]).toBe('a1b2c3d (Ada               2026-01-02 1)');
    expect(vim.buf.lines[2]).toMatch(/^0000000 \(Not Committed Yet 2026-09-27 3\)/);
    vim.feedKeys('<CR>');
    expect(vim.buf.name).toBe('fugitive:///.git//a1b2c3d');
    expect(vim.buf.lines[0]).toBe('commit a1b2c3d');
    expect(vim.tab.windows()).toHaveLength(1);
  });

  it(':Gvdiffsplit diffs against the index and :w stages', () => {
    const vim = mk();
    vim.ex('Gvdiffsplit');
    expect(vim.tab.windows()).toHaveLength(2);
    vim.feedKeys(']c');
    expect(vim.cursor.line).toBe(2);
    vim.feedKeys('dp<C-w>h');
    expect(vim.buf.name).toBe('fugitive:///.git//0/weather/api.py');
    vim.ex('w');
    expect(gitState(vim).index['weather/api.py']).toBe('import requests\n\nTIMEOUT = 5\n\ndef fetch(city):\n    return requests.get(URL + city)\n');
  });
});
