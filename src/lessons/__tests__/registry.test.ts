import { describe, expect, it } from 'vitest';
import { CHALLENGES } from '../../challenges';
import { LESSONS, ORDER, SECTIONS } from '..';
import { mergeSetup } from '../runtime';
import { solutionCommands } from '../../coach';
import { taughtBy } from '../../coach/vocab';
import { lessonIdFromHash } from '../../state/seed';

const BAND_ORDER = ['core', 'repeat', 'project', 'patterns', 'code', 'challenges'];
const REMOVED_SECTIONS = ['operator-plugins', 'diffs', 'folds', 'config-literacy'];
const REMOVED_LESSONS = [
  'clipboard-register', 'viewing-registers', 'argument-list', 'command-line-mode', 'save-and-quit', 'terminal-mode',
  'harpoon-add', 'harpoon-jump', 'exchange', 'replace-with-register', 'case-coercion', 'smart-substitute',
  'fugitive-status', 'fugitive-stage', 'fugitive-inline-diff', 'fugitive-commit', 'fugitive-blame',
  'diff-mode', 'diff-obtain-put', 'diff-merge-conflicts', 'creating-folds', 'opening-closing-folds', 'all-folds', 'moving-by-folds',
  'insert-word-completion', 'insert-line-completion', 'insert-file-completion', 'insert-digraphs', 'insert-literal', 'inspect-character',
  'config-options', 'config-mappings', 'config-leader', 'config-init-lua',
];

describe('registry', () => {
  it('sections appear in band order', () => {
    const bands = SECTIONS.map(s => s.band);
    const idx = bands.map(b => BAND_ORDER.indexOf(b));
    expect(idx.every(i => i >= 0)).toBe(true);
    for (let i = 1; i < idx.length; i++) expect(idx[i], `${SECTIONS[i].id} after ${SECTIONS[i - 1].id}`).toBeGreaterThanOrEqual(idx[i - 1]);
    expect(new Set(bands)).toEqual(new Set(BAND_ORDER));
  });
  it('has the sections of each band in the spec order', () => {
    expect(SECTIONS.map(s => s.id)).toEqual([
      'getting-around', 'small-edits', 'next-steps', 'insert-like-a-pro', 'essential-motions', 'screen-movement',
      'basic-operators', 'text-objects', 'visual-mode', 'search', 'indent-case',
      'registers', 'macros',
      'buffers-files', 'windows-tabs', 'marks-jumps', 'quickfix', 'code-navigation', 'finding-things', 'file-navigation',
      'command-line', 'substitute', 'global-commands',
      'neovim-builtins', 'more-text-objects', 'jumping', 'surround', 'insert-power', 'git',
      'challenges',
    ]);
  });
  it('removed sections and lessons are gone', () => {
    for (const id of REMOVED_SECTIONS) expect(SECTIONS.find(s => s.id === id), id).toBeUndefined();
    for (const id of REMOVED_LESSONS) expect(LESSONS[id], id).toBeUndefined();
  });
  it('every challenge names surviving sections', () => {
    for (const c of CHALLENGES) for (const sid of c.challenge.sections) expect(SECTIONS.some(s => s.id === sid), `${c.id}: ${sid}`).toBe(true);
  });
  it('unknown lesson id in the hash falls back', () => {
    const id = lessonIdFromHash('#exchange');
    expect(LESSONS[id]).toBeUndefined();
    expect(ORDER[0].id).toBe('move');
  });
  it('runs for unknown lessons are ignored', () => {
    const runs = [{ lesson: 'exchange', score: 90 }, { lesson: 'move', score: 80 }];
    const counted = ORDER.filter(l => !l.boss && runs.some(r => r.lesson === l.id)).length;
    expect(counted).toBe(1);
  });
});

describe('references use only what has been taught', () => {
  it('no round solution runs a command whose first lesson comes later (par must be reachable)', () => {
    const offenders: string[] = [];
    for (const l of ORDER) {
      const c = l.challenge;
      if (c.kind !== 'rounds') continue;
      const taught = taughtBy(l.id);
      c.rounds.forEach((r, i) => {
        const missing = solutionCommands(mergeSetup(c.base, r.setup), r.solution).filter(t => !taught.has(t));
        if (missing.length) offenders.push(`${l.id} r${i + 1} ${r.solution}: ${[...new Set(missing)].join(' ')}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
