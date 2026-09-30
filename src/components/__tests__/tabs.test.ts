import { describe, expect, it } from 'vitest';
import { cellWidths, displayWidth } from '../tabs';

describe('cellWidths', () => {
  it('a tab runs to the next tab stop, not a fixed tabstop width', () => {
    // substitute's '    return 0\t': the tab starts at column 12, so Vim draws 4 cells with ts=8.
    expect(cellWidths('    return 0\t', 8)[12]).toBe(4);
    expect(cellWidths('\tx\t', 8)).toEqual([8, 1, 7]);
    expect(cellWidths('ab\t', 4)).toEqual([1, 1, 2]);
  });
  it('control characters take two cells (^X), and the tab stops count them', () => {
    expect(cellWidths('\x01\t', 8)).toEqual([2, 6]);
  });
  it('displayWidth measures an indent in screen columns (tab-indented Go)', () => {
    expect(displayWidth('\t\t', 8)).toBe(16);
    expect(displayWidth('  \t', 4)).toBe(4);
    expect(displayWidth('    ', 8)).toBe(4);
  });
});
