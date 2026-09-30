import { describe, expect, it } from 'vitest';
import { createVim } from '../../../lessons/runtime';

const files = { 'a.ts': 'const id = 1;\nconst identity = id;\n', 'b.ts': 'export { id };\n' };
const vim = () => createVim({ files, open: 'a.ts', plugins: ['grugfar'] });

describe('grug-far style project replace', () => {
  it('replaces whole words only, across every file, and reports', () => {
    const v = vim();
    v.feedKeys('w'); // on "id"
    v.feedKeys('<Space>sr');
    expect(v.mode).toBe('cmdline');
    v.feedKeys('key<CR>');
    expect(v.fs.read('a.ts')).toBe('const key = 1;\nconst identity = key;\n');
    expect(v.fs.read('b.ts')).toBe('export { key };\n');
    expect(v.buf.lines).toEqual(['const key = 1;', 'const identity = key;']);
    const f = v.floats.find(x => x.id === 'grug-far')!;
    expect(f.lines.some(l => l.text.includes('3 replacements in 2 files'))).toBe(true);
    v.feed('q');
    expect(v.floats.some(x => x.id === 'grug-far')).toBe(false);
  });
  it('replaces inside an open buffer with unsaved edits, and u undoes it', () => {
    const v = vim();
    v.feedKeys('oid();<Esc>');                          // unsaved edit in a.ts
    v.feedKeys('ggw<Space>srkey<CR>q');
    expect(v.buf.lines).toEqual(['const key = 1;', 'key();', 'const identity = key;']);
    expect(v.fs.read('a.ts')).toBe('const key = 1;\nkey();\nconst identity = key;\n');
    v.feed('u');
    expect(v.buf.lines).toEqual(['const id = 1;', 'id();', 'const identity = id;']);
  });
  it('asks for the search word when the cursor is not on one', () => {
    const v = vim();
    v.feedKeys('$'); // on ";"
    v.feedKeys('<Space>sr');
    expect(v.cmdline?.prompt).toMatch(/^Search/);
  });
});
