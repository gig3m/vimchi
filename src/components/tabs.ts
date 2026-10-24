// Screen widths of buffer characters, as Vim draws them: a tab runs to the next tab stop (so its
// width depends on where it starts), a control character shows as ^X (two cells).

/** One width per code point of the line. */
export function cellWidths(line: string, tabstop: number): number[] {
  const ts = tabstop > 0 ? tabstop : 8;
  const out: number[] = [];
  let col = 0;
  for (const ch of line) {
    const w = ch === '\t' ? ts - (col % ts) : ch.charCodeAt(0) < 32 ? 2 : 1;
    out.push(w);
    col += w;
  }
  return out;
}

/** The screen width of a string (an indent, say) that starts at column 0. */
export const displayWidth = (s: string, tabstop: number) => cellWidths(s, tabstop).reduce((a, b) => a + b, 0);

/** 'listchars' as Neovim reads it: tab is two or three characters, the rest one each. */
export type ListChars = { tab?: [string, string, string?]; trail?: string; nbsp?: string; space?: string; lead?: string };
export function parseListchars(v: string): ListChars {
  const out: ListChars = {};
  for (const part of v.split(',')) {
    const i = part.indexOf(':');
    if (i < 0) continue;
    const k = part.slice(0, i), val = [...part.slice(i + 1)];
    if (k === 'tab' && val.length >= 2) out.tab = [val[0], val[1], val[2]];
    else if ((k === 'trail' || k === 'nbsp' || k === 'space' || k === 'lead') && val.length === 1) out[k] = val[0];
  }
  return out;
}

/**
 * What each character of a line shows with 'list' on (Neovim's drawing): a tab is its first
 * listchar then fill to the tab stop; spaces after the last non-blank are `trail` (tabs there stay
 * tabs, so a blank line of spaces is all trail); a no-break space is `nbsp`. Null where the
 * character draws as itself. Widths are cellWidths'.
 */
export function listGlyphs(line: string, tabstop: number, lcs: ListChars): (string | null)[] {
  const chars = [...line];
  const widths = cellWidths(line, tabstop);
  let trailFrom = chars.length;
  while (trailFrom > 0 && (chars[trailFrom - 1] === ' ' || chars[trailFrom - 1] === '\t')) trailFrom--;
  let leadTo = 0;
  while (leadTo < chars.length && chars[leadTo] === ' ') leadTo++;
  return chars.map((ch, i) => {
    if (ch === '\t' && lcs.tab) {
      const [a, b, c] = lcs.tab, w = widths[i];
      if (c) return w === 1 ? c : a + b.repeat(Math.max(0, w - 2)) + c;
      return a + b.repeat(w - 1);
    }
    if (ch === ' ') return i >= trailFrom && lcs.trail ? lcs.trail : i < leadTo && lcs.lead ? lcs.lead : lcs.space ?? null;
    if (ch === '\u00a0') return lcs.nbsp ?? null;
    return null;
  });
}
