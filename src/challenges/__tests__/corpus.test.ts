import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CORPUS } from '../corpus';

const LICENSES = ['MIT', 'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0', 'ISC'];
const idents = (lines: string[]) => {
  const n = new Map<string, number>();
  for (const l of lines) for (const m of l.matchAll(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g)) n.set(m[0], (n.get(m[0]) ?? 0) + 1);
  return n;
};
const nearDuplicatePairs = (lines: string[]) => {
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < lines.length; i++) {
    const a = lines[i], b = lines[i + 1];
    if (a.length !== b.length || a.trim().length < 8) continue;
    let diff = 0;
    for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) diff++;
    if (diff >= 1 && diff <= 3) out.push([i, i + 1]);
  }
  return out;
};

describe('corpus', () => {
  it('has 10 uniquely named files', () => {
    expect(CORPUS.length).toBe(10);
    expect(new Set(CORPUS.map(f => f.name)).size).toBe(10);
  });
  it('covers three languages', () => {
    const ext = new Set(CORPUS.map(f => f.name.split('.').pop()));
    expect([...ext].sort()).toEqual(['go', 'lua', 'ts']);
  });
  describe.each(CORPUS.map(f => [f.name, f] as const))('%s', (_n, f) => {
    it('is attributed to an allowed license', () => {
      expect(f.source.repo).toMatch(/^[\w.-]+\/[\w.-]+$/);
      expect(f.source.path.length).toBeGreaterThan(0);
      expect(f.source.commit).toMatch(/^[0-9a-f]{7,40}$/);
      expect(LICENSES).toContain(f.source.license);
    });
    it('is 25–40 lines of ≤60 columns, no tabs or trailing spaces', () => {
      expect(f.lines.length).toBeGreaterThanOrEqual(25);
      expect(f.lines.length).toBeLessThanOrEqual(40);
      expect(f.lines.filter(l => l.length > 60)).toEqual([]);
      expect(f.lines.filter(l => /\t| $/.test(l))).toEqual([]);
    });
    it('is mutation-rich', () => {
      const n = idents(f.lines);
      const repeated = [...n].filter(([w, c]) => w.length >= 3 && w.length <= 6 && c >= 2);
      expect(repeated.length).toBeGreaterThanOrEqual(6);
      expect(f.lines.join('\n').match(/\b\d+\b/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    });
  });
  // The near-duplicate pair feeds one Challenge 2 kind only; real code rarely has one, so it is
  // required across the corpus rather than per file (ruling, 2026-09-29).
  it('has a near-duplicate line pair in at least 4 files', () => {
    expect(CORPUS.filter(f => nearDuplicatePairs(f.lines).length > 0).length).toBeGreaterThanOrEqual(4);
  });
  it('ships the upstream license notices with the app', () => {
    const notices = readFileSync('public/THIRD-PARTY-NOTICES.txt', 'utf8');
    for (const repo of new Set(CORPUS.map(f => f.source.repo))) {
      expect(notices, repo).toContain(repo);
      const block = notices.slice(notices.indexOf(repo));
      expect(block, `${repo} notice text`).toMatch(/Copyright|copyright/);
    }
  });
  it('README credits every source repo', () => {
    const readme = readFileSync('README.md', 'utf8');
    for (const repo of new Set(CORPUS.map(f => f.source.repo))) expect(readme, repo).toContain(repo);
  });
});
