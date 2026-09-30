// Why a better way is better: every suggestion names the idea it teaches and the lesson that
// teaches it, so the report says "delete up to a character, don't count" rather than "saves 13".
export type Pattern = { name: string; principle: string; lesson: string };

export const PATTERNS: Record<string, Pattern> = {
  // Edits
  'op-to-char': { name: 'Delete to a character', principle: "operate up to a character you can see; don't count", lesson: 'delete-to-char' },
  'op-word': { name: 'Operate on words', principle: 'an operator takes a motion: dw deletes a word in one go', lesson: 'delete-words' },
  'change-word': { name: 'Change a word', principle: 'cw deletes the word and drops you into insert mode', lesson: 'change-words' },
  'text-object': { name: 'Word object', principle: 'edit the thing, not the characters: iw works from anywhere in the word', lesson: 'word-objects' },
  'quote-object': { name: 'Quote object', principle: 'i" is everything between the quotes, from anywhere inside them', lesson: 'text-objects-quotes' },
  'bracket-object': { name: 'Bracket object', principle: 'i( is everything between the parentheses, from anywhere inside them', lesson: 'text-objects-parens' },
  'block-object': { name: 'Paragraph object', principle: 'ip is the whole paragraph, wherever the cursor is in it', lesson: 'sentences-paragraphs' },
  'tag-object': { name: 'Tag object', principle: 'it (inner tag) is everything between the opening and closing tag', lesson: 'text-objects-tags' },
  'count-op': { name: 'Count the operator', principle: 'say how many once: d2w, 3dd', lesson: 'counts-operators' },
  'to-line-end': { name: 'To the end of the line', principle: 'D and C reach the end of the line on their own', lesson: 'delete-lines' },
  'change-line': { name: 'Change the whole line', principle: 'cc replaces the line and keeps its indent', lesson: 'change-lines' },
  'delete-line': { name: 'Delete lines', principle: 'dd takes the whole line; a count takes several', lesson: 'delete-lines' },
  substitute: { name: 'Change in place', principle: 'cl replaces the character under the cursor and starts typing (s in standard Vim)', lesson: 'substitute' },
  'replace-char': { name: 'Replace a character', principle: 'r swaps one character without entering insert mode', lesson: 'r' },
  'delete-char': { name: 'Delete characters', principle: 'x deletes the character under the cursor', lesson: 'x' },
  'toggle-case': { name: 'Toggle case', principle: '~ flips the case of the character under the cursor', lesson: 'toggle-case' },
  'case-op': { name: 'Case operator', principle: 'gU and gu take a motion or object: change the case of a word at once', lesson: 'case-operators' },
  indent: { name: 'Indent', principle: '>> shifts the line by one indent, wherever the cursor is', lesson: 'indenting' },
  join: { name: 'Join lines', principle: 'J pulls the next line up, with one space between', lesson: 'join-lines' },
  'line-end-insert': { name: 'Insert at the line ends', principle: 'A and I jump to the end or start of the line and start typing, from anywhere on it', lesson: 'insert-line-ends' },
  'open-line': { name: 'Open a line', principle: 'o and O open a new line and start typing on it', lesson: 'open-lines' },
  swap: { name: 'Swap with the register', principle: 'a delete fills the register: ddp swaps lines, xp swaps characters', lesson: 'unnamed-register' },
  dot: { name: 'Repeat the change', principle: 'make one change, then repeat it with .', lesson: 'repeat-last-change' },
  // Motions
  'find-char': { name: 'Find a character', principle: 'jump to a character you can see', lesson: 'find-char' },
  'repeat-find': { name: 'Repeat the find', principle: '; repeats the last f/t instead of typing it again', lesson: 'repeat-find' },
  'word-motion': { name: 'Move by words', principle: 'w, b and e hop a word at a time', lesson: 'words' },
  'line-ends': { name: 'Line ends', principle: '0, ^ and $ reach the ends of the line in one key', lesson: 'line-ends' },
  'count-motion': { name: 'Count the motion', principle: 'a count repeats a motion: 3j moves three lines', lesson: 'words' },
  'jump-line': { name: 'Jump to a line', principle: '42G goes straight to line 42; gg and G to the top and bottom', lesson: 'top-bottom' },
  paragraph: { name: 'Paragraph hops', principle: '{ and } jump to the blank line before or after a block', lesson: 'paragraphs' },
  'match-pair': { name: 'Matching pair', principle: '% jumps to the bracket that matches this one', lesson: 'matching-pairs' },
  'half-page': { name: 'Half pages', principle: 'C-d and C-u cover half a screen at a time', lesson: 'half-pages' },
  'screen-jump': { name: 'Screen lines', principle: 'H, M and L jump to the top, middle and bottom of the screen', lesson: 'screen-lines' },
  'search-jump': { name: 'Search to jump', principle: '/ or n goes straight to text you can see', lesson: 'search-forward' },
  'star-jump': { name: 'Search the word under the cursor', principle: '* and # find the next use of this word', lesson: 'word-under-cursor' },
};

/** The pattern a motion route teaches: the most specific idea in it wins. */
export function motionPattern(uses: readonly string[]): string {
  const has = (...t: string[]) => t.some(x => uses.includes(x));
  if (has('*', '#')) return 'star-jump';
  if (has('/', '?', 'n', 'N')) return 'search-jump';
  if (has('G', 'gg')) return 'jump-line';
  if (has('<C-d>', '<C-u>')) return 'half-page';
  if (has('H', 'M', 'L')) return 'screen-jump';
  if (has('%')) return 'match-pair';
  if (has('{', '}')) return 'paragraph';
  if (has(';', ',')) return 'repeat-find';
  if (has('f', 't', 'F', 'T')) return 'find-char';
  if (has('w', 'b', 'e', 'W', 'B', 'E', 'ge', 'gE')) return 'word-motion';
  if (has('0', '^', '$')) return 'line-ends';
  return 'count-motion';
}
