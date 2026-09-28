// Key notation. Internally every key is a string: a single printable
// character ("a", "<", " ") or a bracketed name ("<Esc>", "<CR>", "<C-r>").
// A literal "<" is written "<lt>" in notation strings.

export type Key = string;

const NAMED: Record<string, Key> = {
  esc: '<Esc>', cr: '<CR>', enter: '<CR>', return: '<CR>', bs: '<BS>', backspace: '<BS>',
  tab: '<Tab>', 's-tab': '<S-Tab>', del: '<Del>', delete: '<Del>', space: ' ', lt: '<', bar: '|', bslash: '\\',
  up: '<Up>', down: '<Down>', left: '<Left>', right: '<Right>', home: '<Home>', end: '<End>',
  nl: '<C-j>', 'c-[': '<Esc>', leader: '<leader>',
};

/** Normalize one bracketed name such as "c-R" or "Esc" to canonical form. */
function canonical(inner: string): Key {
  const lower = inner.toLowerCase();
  if (NAMED[lower]) return NAMED[lower];
  const m = /^([cCsSaAmM])-(.+)$/.exec(inner);
  if (m) {
    const mod = m[1].toUpperCase() === 'M' ? 'A' : m[1].toUpperCase();
    let k = m[2];
    if (k.length === 1) {
      if (mod === 'C') k = k.toLowerCase();
      return `<${mod}-${k}>`;
    }
    const named = NAMED[k.toLowerCase()];
    if (named && named.startsWith('<')) return `<${mod}-${named.slice(1, -1)}>`;
    return `<${mod}-${k}>`;
  }
  return `<${inner}>`;
}

/** Split a notation string ("ciw<C-r>0<Esc>") into keys. */
export function parseKeys(s: string): Key[] {
  const out: Key[] = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '<') {
      const close = s.indexOf('>', i + 1);
      const inner = close > i + 1 ? s.slice(i + 1, close) : '';
      if (inner && /^[A-Za-z][\w-]*$|^[CSAMcsam]-.+$/.test(inner) && !/\s/.test(inner) && isKnownName(inner)) {
        out.push(canonical(inner));
        i = close;
        continue;
      }
    }
    out.push(ch);
  }
  return out;
}

function isKnownName(inner: string) {
  const lower = inner.toLowerCase();
  return !!NAMED[lower] || /^[csam]-/i.test(inner) || /^(f\d{1,2}|pageup|pagedown|insert|nop)$/i.test(inner);
}

/** Keys back to notation, e.g. for showing a solution. */
export function keysToString(keys: Key[]): string {
  return keys.map(k => (k === '<' ? '<lt>' : k === ' ' ? '␣' : k)).join('');
}

/** Human-friendly rendering of a single key for chips and showcmd. */
export function displayKey(k: Key): string {
  if (k === ' ') return '␣';
  if (k === '<Esc>') return 'esc';
  if (k === '<CR>') return '⏎';
  if (k === '<BS>') return '⌫';
  if (k === '<Tab>') return 'tab';
  const m = /^<C-(.+)>$/.exec(k);
  if (m) return '^' + m[1].toUpperCase();
  return k;
}

type KeyEventLike = { key: string; ctrlKey: boolean; altKey: boolean; metaKey: boolean; shiftKey: boolean };

/** Translate a DOM keyboard event. Returns null for keys we don't handle. */
export function keyFromEvent(e: KeyEventLike): Key | null {
  if (e.metaKey) return null;
  const k = e.key;
  if (k === 'Shift' || k === 'Control' || k === 'Alt' || k === 'Meta' || k === 'CapsLock' || k === 'Dead') return null;
  const special: Record<string, Key> = {
    Escape: '<Esc>', Enter: '<CR>', Backspace: '<BS>', Tab: e.shiftKey ? '<S-Tab>' : '<Tab>', Delete: '<Del>',
    ArrowUp: '<Up>', ArrowDown: '<Down>', ArrowLeft: '<Left>', ArrowRight: '<Right>', Home: '<Home>', End: '<End>',
    PageUp: '<PageUp>', PageDown: '<PageDown>',
  };
  if (e.ctrlKey && !e.altKey) {
    if (k === '[') return '<Esc>';
    if (k === ' ') return '<C-Space>';
    if (special[k]) return `<C-${special[k].slice(1, -1)}>`;
    if (k.length === 1) {
      if (k === '^' || k === '6') return '<C-^>';
      if (k === '\\') return '<C-\\>';
      return `<C-${k.toLowerCase()}>`;
    }
    return null;
  }
  if (special[k]) return special[k];
  if (e.altKey && k.length === 1) return `<A-${k}>`;
  if (k.length === 1) return k;
  return null;
}

export const isPrintable = (k: Key) => k.length === 1;
