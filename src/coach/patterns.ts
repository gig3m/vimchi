// Why a better way is better: every suggestion names the idea it teaches and the lesson that
// teaches it. `name` is a short plain heading; `principle` explains it in whole sentences for
// someone who has not met the key yet, so the report never leans on shorthand like "saves 13".
export type Pattern = { name: string; principle: string; lesson: string };

export const PATTERNS: Record<string, Pattern> = {
  // Edits
  'op-to-char': { name: 'Edit up to a character', principle: 'After d or c, t and a character reach up to that character, and f takes the character too: ct) changes everything before the next ), df, deletes through the next comma. T and F do the same backwards. No counting, and no selecting first.', lesson: 'delete-to-char' },
  'op-word': { name: 'Delete whole words', principle: 'd takes a motion, so dw deletes a whole word in one go instead of a character at a time.', lesson: 'delete-words' },
  'change-word': { name: 'Change a word', principle: 'cw deletes the rest of the word and puts you in insert mode, ready to type its replacement.', lesson: 'change-words' },
  'text-object': { name: 'Work on the whole word', principle: 'iw means "this word". diw or ciw works from anywhere in the word, so you never have to move to its start first.', lesson: 'word-objects' },
  'quote-object': { name: 'Work inside quotes', principle: 'i" means "everything inside these quotes". ci" works from anywhere between them.', lesson: 'text-objects-quotes' },
  'bracket-object': { name: 'Work inside brackets', principle: 'i( means "everything inside these parentheses", and i[, i{ and i< work the same way for the other brackets. ci( works from anywhere between them.', lesson: 'text-objects-parens' },
  'block-object': { name: 'Work on a paragraph or sentence', principle: 'ip means "this paragraph" and is "this sentence": dip deletes the paragraph from wherever the cursor is in it. d} deletes from the cursor to the end of the paragraph and d{ back to its start.', lesson: 'sentences-paragraphs' },
  'tag-object': { name: 'Work inside a tag', principle: 'it means "everything between this opening and closing tag". cit works from anywhere inside it.', lesson: 'text-objects-tags' },
  'count-op': { name: 'Say how many up front', principle: 'Put a number before the command instead of repeating it: d2w deletes two words and 3dd deletes three lines.', lesson: 'counts-operators' },
  'to-line-end': { name: 'Reach either end of the line', principle: 'd$ (or just D) deletes from the cursor to the end of the line. d0 deletes back to its start and d^ back to its first character. C, c0 and c^ do the same and let you start typing.', lesson: 'delete-lines' },
  'change-line': { name: 'Replace the whole line', principle: 'cc clears the line and puts you in insert mode, keeping its indent.', lesson: 'change-lines' },
  'delete-line': { name: 'Work on whole lines', principle: "dd deletes the line you're on, wherever the cursor is in it, and 3dd deletes three. dj takes this line and the one below, and cj does the same but lets you type their replacement.", lesson: 'delete-lines' },
  substitute: { name: 'Replace a character and keep typing', principle: 'cl deletes the character under the cursor and puts you in insert mode. Standard Vim also has s for this.', lesson: 'substitute' },
  'replace-char': { name: 'Swap one character', principle: 'r and a character replace the one under the cursor without going into insert mode.', lesson: 'r' },
  'delete-char': { name: 'Delete characters', principle: 'x deletes the character under the cursor, with no need to go into insert mode.', lesson: 'x' },
  'toggle-case': { name: 'Flip the case', principle: '~ switches the character under the cursor between upper and lower case, then moves on to the next one.', lesson: 'toggle-case' },
  'case-op': { name: 'Change the case of a word', principle: 'gU makes text uppercase, gu lowercase and g~ flips it, and all three take a motion: gUiw uppercases the whole word at once.', lesson: 'case-operators' },
  indent: { name: 'Indent the line', principle: '>> shifts the whole line one indent to the right (and << to the left), wherever the cursor is on it.', lesson: 'indenting' },
  join: { name: 'Join lines', principle: 'J pulls the next line up onto the end of this one, with a single space between.', lesson: 'join-lines' },
  'line-end-insert': { name: 'Type at the start or end of the line', principle: 'A starts typing at the end of the line and I at the start, from anywhere on it.', lesson: 'insert-line-ends' },
  'open-line': { name: 'Start a new line', principle: 'o opens a new line below and starts typing on it. O opens one above.', lesson: 'open-lines' },
  swap: { name: 'Swap by pasting', principle: 'Deleting keeps the text, so you can paste it straight back: ddp swaps two lines and xp swaps two characters.', lesson: 'unnamed-register' },
  dot: { name: 'Repeat the last change', principle: 'Make the change once, then press . to make it again wherever you need it.', lesson: 'repeat-last-change' },
  // Motions
  'find-char': { name: 'Jump to a character', principle: 'f and a character jump straight to the next one on the line: f( lands on the next (.', lesson: 'find-char' },
  'repeat-find': { name: 'Repeat the jump', principle: '; repeats your last f or t jump, so you don\'t have to type it again. , goes back the other way.', lesson: 'repeat-find' },
  'word-motion': { name: 'Move by words', principle: 'w, b and e move a whole word at a time instead of one character.', lesson: 'words' },
  'line-ends': { name: 'Jump to the ends of the line', principle: '0 goes to the start of the line, ^ to its first character and $ to its end, each in one key.', lesson: 'line-ends' },
  'count-motion': { name: 'Count your moves', principle: 'Put a number before a motion to repeat it: 3j moves down three lines in one go.', lesson: 'words' },
  direct: { name: 'Go straight there', principle: 'You went back and forth before you landed. Look at where you want to go first, then make the move once.', lesson: 'move' },
  'jump-line': { name: 'Jump to a line number', principle: '42G goes straight to line 42. gg goes to the top of the file and G to the bottom.', lesson: 'top-bottom' },
  paragraph: { name: 'Hop between paragraphs', principle: '} jumps to the next blank line and { to the one before, skipping a whole block at a time.', lesson: 'paragraphs' },
  'match-pair': { name: 'Jump to the matching bracket', principle: '% jumps from a bracket to the one that closes or opens it.', lesson: 'matching-pairs' },
  'half-page': { name: 'Move half a screen', principle: 'Ctrl-d moves down half a screen and Ctrl-u moves up, instead of holding j or k.', lesson: 'half-pages' },
  'screen-jump': { name: 'Jump to the middle of the screen', principle: 'M jumps to the middle line you can see. (In LazyVim H and L switch buffers; they jump to the top and bottom only in Visual mode or after an operator.)', lesson: 'screen-lines' },
  'search-jump': { name: 'Jump by searching', principle: 'Type / and a few letters of where you want to go, then Enter: the cursor lands on the next match, however far away it is. n goes to the match after that.', lesson: 'search-forward' },
  'star-jump': { name: 'Find this word again', principle: '* jumps to the next place the word under the cursor appears, and # to the one before.', lesson: 'word-under-cursor' },
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
  // Plain hjkl: a count is the idea only if the route has one (jkjjk → j has none).
  return has('COUNT') ? 'count-motion' : 'direct';
}
