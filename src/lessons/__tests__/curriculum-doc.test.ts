import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderCurriculum } from '../../../scripts/curriculum';

describe('CURRICULUM.md', () => {
  it('matches the registry (run `npm run curriculum` to regenerate)', () => {
    if (process.env.CURRICULUM_WRITE) { writeFileSync('CURRICULUM.md', renderCurriculum()); return; }
    expect(readFileSync('CURRICULUM.md', 'utf8')).toBe(renderCurriculum());
  });
});
