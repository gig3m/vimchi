// Character classes and small text helpers shared by motions and objects.

export const BLANK = 0, PUNCT = 1, WORD = 2;

export const isBlank = (ch: string | undefined) => ch === ' ' || ch === '\t';
export const isWordChar = (ch: string | undefined) => !!ch && /[\wÀ-￿]/.test(ch);

export function charClass(ch: string | undefined, big: boolean): number {
  if (ch === undefined || isBlank(ch)) return BLANK;
  if (big) return WORD;
  return isWordChar(ch) ? WORD : PUNCT;
}

export const firstNonBlank = (t: string) => {
  const i = t.search(/[^ \t]/);
  return i < 0 ? Math.max(0, t.length - 1) : i;
};

export const lastNonBlank = (t: string) => {
  const m = /[^ \t](?=[ \t]*$)/.exec(t);
  return m ? m.index : 0;
};

export const indentOf = (t: string) => /^[ \t]*/.exec(t)![0];

export const lastCol = (t: string) => Math.max(0, t.length - 1);

export function isEmptyLine(t: string) {
  return t.length === 0;
}

export const BRACKETS: Record<string, string> = { '(': ')', '[': ']', '{': '}', '<': '>' };
export const CLOSERS: Record<string, string> = { ')': '(', ']': '[', '}': '{', '>': '<' };

/** Visual width of a string with tabs expanded. */
export function displayWidth(s: string, tabstop: number) {
  let w = 0;
  for (const ch of s) w = ch === '\t' ? w + tabstop - (w % tabstop) : w + 1;
  return w;
}
