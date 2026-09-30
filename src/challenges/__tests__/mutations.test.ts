import { describe, expect, it } from 'vitest';
import { createVim } from '../../lessons/runtime';
import { CORPUS } from '../corpus';
import { KINDS } from '../mutations';
import { applyMutation } from '../mutations/types';
import { mulberry32 } from '../rng';

const SEEDS = [1, 2, 3, 4, 5];

describe.each(Object.values(KINDS).map(k => [k.id, k] as const))('mutation %s', (_id, kind) => {
  // Not every kind fits every file (a colour table has no removable statement; most real
  // code has no near-duplicate pair), so sites are required corpus-wide, not per file.
  it('has candidate sites in at least 4 corpus files (2 for the function-body kind; Reps join files)', () => {
    expect(CORPUS.filter(f => kind.sites(f.lines).length > 0).length).toBeGreaterThanOrEqual(kind.id === 'fn-body-dedented' ? 2 : 4);
  });
  for (const f of CORPUS) {
    const sites = kind.sites(f.lines);
    for (const site of sites) for (const seed of SEEDS) {
      it(`${f.name} @${site.line}:${site.col} seed ${seed}`, () => {
        if (kind.id === 'line-to-remove') return; // inverted kind: tested on its own below
        const m = kind.apply(f.lines, site, mulberry32(seed));
        if (m === null) return; // rule 4: allowed to decline
        const after = applyMutation(f.lines, m);
        // rule 4: never a no-op
        expect(after.join('\n')).not.toBe(f.lines.join('\n'));
        // rule 1: only the site's line(s) differ
        for (let i = 0; i < site.line; i++) expect(after[i]).toBe(f.lines[i]);
        expect(after.slice(site.line + m.lines.length)).toEqual(f.lines.slice(site.line + (m.span ?? 1)));
        expect(m.checklist.length).toBeGreaterThan(3);
        expect(m.parMs).toBeGreaterThan(0);
        // rule 2: the reference fix restores the original from fixAt
        const vim = createVim({ text: after, name: f.name, plugins: kind.plugins });
        vim.win.cursor = { line: site.line + m.fixAt.dline, col: m.fixAt.col };
        vim.feedKeys(m.fixKeys);
        expect(vim.mode).toBe('normal');
        expect(vim.buf.text(), `fixKeys "${m.fixKeys}" did not restore`).toBe(f.lines.join('\n'));
      });
    }
  }
});

describe('challenge 1 kinds are registered', () => {
  it.each(['dropped-char', 'extra-char', 'wrong-char', 'wrong-literal', 'wrong-short-ident'])('%s', id => {
    expect(KINDS[id]).toBeDefined();
  });
});

describe('challenge 2 kinds are registered', () => {
  it.each(['stray-line', 'stray-word', 'wrong-word', 'missing-duplicate-line', 'line-to-remove'])('%s', id => {
    expect(KINDS[id]).toBeDefined();
  });
});

describe('line-to-remove', () => {
  it('dd on the line yields the original minus that line', () => {
    for (const f of CORPUS) for (const site of KINDS['line-to-remove'].sites(f.lines).slice(0, 5)) {
      const m = KINDS['line-to-remove'].apply(f.lines, site, mulberry32(1))!;
      const vim = createVim({ text: f.lines, name: f.name });
      vim.win.cursor = { line: site.line, col: 0 };
      vim.feedKeys(m.fixKeys);
      expect(vim.buf.lines).toEqual([...f.lines.slice(0, site.line), ...f.lines.slice(site.line + 1)]);
    }
  });
});

describe('line-to-remove sites', () => {
  it('never asks to delete a bare bracket line', () => {
    for (const f of CORPUS) for (const site of KINDS['line-to-remove'].sites(f.lines)) {
      expect(f.lines[site.line], `${f.name}:${site.line}`).toMatch(/[A-Za-z_][A-Za-z0-9_]*/);
    }
  });
});
