import { describe, expect, it } from 'vitest';
import { keyFromEvent } from '../keys';

const ev = (o: Partial<Parameters<typeof keyFromEvent>[0]>) =>
  ({ key: '', code: '', ctrlKey: false, altKey: false, metaKey: false, shiftKey: false, ...o });

describe('keyFromEvent on non-US layouts', () => {
  it('Windows AltGr characters are the literal character (AltGr reports Ctrl+Alt)', () => {
    expect(keyFromEvent(ev({ key: '@', code: 'KeyQ', ctrlKey: true, altKey: true }))).toBe('@');
    expect(keyFromEvent(ev({ key: '{', code: 'Digit7', ctrlKey: true, altKey: true }))).toBe('{');
    expect(keyFromEvent(ev({ key: '\\', code: 'Minus', ctrlKey: true, altKey: true }))).toBe('\\');
  });
  it('Mac Option characters are the literal character', () => {
    expect(keyFromEvent(ev({ key: '@', code: 'KeyL', altKey: true }))).toBe('@');
    expect(keyFromEvent(ev({ key: '{', code: 'Digit8', altKey: true }))).toBe('{');
    expect(keyFromEvent(ev({ key: '~', code: 'KeyN', altKey: true }))).toBe('~');
  });
  it('AltGraph modifier state wins even when key matches the code', () => {
    expect(keyFromEvent(ev({ key: 'q', code: 'KeyQ', altKey: true, getModifierState: () => true } as never))).toBe('q');
  });
  it('a plain Alt chord on the key printed on the cap is still <A-x> (the C-w/C-n stand-ins)', () => {
    expect(keyFromEvent(ev({ key: 'w', code: 'KeyW', altKey: true }))).toBe('<A-w>');
    expect(keyFromEvent(ev({ key: 'n', code: 'KeyN', altKey: true }))).toBe('<A-n>');
    expect(keyFromEvent(ev({ key: '6', code: 'Digit6', altKey: true }))).toBe('<A-6>');
  });
  it('Mac Option on a letter that produces a symbol still maps to the stand-in by code', () => {
    // Option-w on a US Mac yields ∑; the stand-in must come from the physical key.
    expect(keyFromEvent(ev({ key: '∑', code: 'KeyW', altKey: true }))).toBe('<A-w>');
  });
  it('AltGr producing a non-ASCII letter (Polish ł) is that letter', () => {
    expect(keyFromEvent(ev({ key: 'ł', code: 'KeyL', ctrlKey: true, altKey: true }))).toBe('ł');
  });
  it('a dead key is ignored (Option-n is dead on every Mac layout; the ~ arrives composed)', () => {
    expect(keyFromEvent(ev({ key: 'Dead', code: 'KeyN', altKey: true }))).toBeNull();
  });
  it('the stand-in follows the produced letter, not the US cap: AZERTY and Dvorak', () => {
    expect(keyFromEvent(ev({ key: 'w', code: 'KeyZ', altKey: true }))).toBe('<A-w>');   // AZERTY Alt+W
    expect(keyFromEvent(ev({ key: 'q', code: 'KeyA', altKey: true }))).toBe('<A-q>');   // AZERTY Alt+Q
    expect(keyFromEvent(ev({ key: 'w', code: 'Comma', altKey: true }))).toBe('<A-w>');  // Dvorak Alt+w
    expect(keyFromEvent(ev({ key: 'n', code: 'KeyL', altKey: true }))).toBe('<A-n>');   // Dvorak Alt+n
  });
  it('unchanged: plain keys, ctrl chords, specials', () => {
    expect(keyFromEvent(ev({ key: 'w', code: 'KeyW' }))).toBe('w');
    expect(keyFromEvent(ev({ key: 'w', code: 'KeyW', ctrlKey: true }))).toBe('<C-w>');
    expect(keyFromEvent(ev({ key: 'Escape', code: 'Escape' }))).toBe('<Esc>');
    expect(keyFromEvent(ev({ key: 'Tab', code: 'Tab', shiftKey: true }))).toBe('<S-Tab>');
  });
});
