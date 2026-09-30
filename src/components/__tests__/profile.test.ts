import { describe, expect, it } from 'vitest';
import { runTitle } from '../Profile';
import { ORDER } from '../../lessons';
import { WARMUP_ID } from '../../warmup';

describe('runTitle', () => {
  it('names lessons, Reps and the Warm-up (never a raw id)', () => {
    expect(runTitle(ORDER[0].id)).toBe(ORDER[0].title);
    expect(runTitle(WARMUP_ID)).toBe('Warm-up');
  });
});
