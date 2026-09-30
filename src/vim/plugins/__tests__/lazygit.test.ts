import { describe, expect, it } from 'vitest';
import { createVim } from '../../../lessons/runtime';

const vim = () => createVim({ files: { 'a.ts': 'x\n' }, open: 'a.ts', plugins: ['lazygit'] });

describe('lazygit', () => {
  it('<leader>gg opens a floating status and q closes it', () => {
    const v = vim();
    v.feedKeys('<Space>gg');
    const f = v.floats.find(x => x.id === 'lazygit');
    expect(f).toBeDefined();
    expect(f!.title).toBe('lazygit');
    expect((v.pluginData.lazygit as { opened: number }).opened).toBe(1);
    v.feed('q');
    expect(v.floats.some(x => x.id === 'lazygit')).toBe(false);
    expect((v.pluginData.lazygit as { closed: number }).closed).toBe(1);
    expect(v.modal).toBeNull();
  });
});
