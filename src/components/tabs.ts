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
