// A small bundled help system: a few condensed pages of Neovim's help, :help {subject}, and
// <C-]> to follow a |link|. Enough for the Getting Help lesson; the real pages are far longer.

import { Buffer } from './buffer';
import type { Vim } from './editor';
import { fail, pos, type Pos } from './types';

/** A line with its tags right-aligned to column 60, the way help files align them. */
const t = (left: string, tags: string) => left.padEnd(Math.max(left.length + 1, 60 - tags.length)) + tags;

export const HELP_FILES: Record<string, string[]> = {
  'help.txt': [
    t('*help.txt*       Nvim', '(tutor excerpt)'),
    '',
    '                  VIM - main help file',
    '',
    'Move around:  |j| and |k| move, |CTRL-E| scrolls a line.',
    'Close this:   Use ":q".',
    '',
    'Jump to a subject:  Put the cursor on a word between',
    '              bars and type |CTRL-]|. See |bars|.',
    'Jump back:    Type |CTRL-O|. Repeat to go further back.',
    '',
    t('', '*:h* *:help*'),
    ':h[elp] {subject}   Open the help on {subject}:',
    '                :help x          the x command',
    '                :help CTRL-E     a CTRL key',
    "                :help 'wrap'     an option",
    '',
    t('', '*bars*'),
    'A word between bars is a link. It jumps to the same',
    'word between stars, which is a tag. |CTRL-]| follows',
    'a link; the tags on this line are where they land.',
    '',
    'Reference pages:',
    '|change.txt|   deleting and changing text',
    '|motion.txt|   moving around, text objects',
    '|undo.txt|     undo and redo',
    '|scroll.txt|   scrolling the window',
    '|options.txt|  options you can |:set|',
    '|tagsrch.txt|  tags and jumping to them',
  ],
  'change.txt': [
    t('*change.txt*     Nvim', 'VIM REFERENCE MANUAL'),
    '',
    'This file is about changing text: deleting it,',
    'replacing it, copying it. See |undo.txt| to undo.',
    '',
    t('1. Deleting text', '*deleting*'),
    '',
    t('["x]<Del>  or', '*<Del>* *x* *dl*'),
    '["x]x         Delete [count] characters under and',
    '              after the cursor [into register x]',
    '              (not |linewise|).',
    '',
    t('["x]X', '*X* *dh*'),
    '              Delete [count] characters before the',
    '              cursor [into register x].',
    '',
    t('', '*d*'),
    '["x]d{motion} Delete text that {motion} moves over',
    '              [into register x]. With a |word|',
    '              motion, see |d-special|.',
    '',
    t('', '*dd*'),
    '["x]dd        Delete [count] lines [into register x]',
    '              |linewise|.',
    '',
    t('', '*D*'),
    '["x]D         Delete to the end of the line and',
    '              [count]-1 more lines; a synonym for',
    '              "d$" (not |linewise|).',
    '',
    t('', '*d-special*'),
    'An exception for d{motion}: when the motion is not',
    'linewise, starts and ends on different lines, and',
    'there is only blank space around the text, the',
    'delete becomes linewise.',
  ],
  'motion.txt': [
    t('*motion.txt*     Nvim', 'VIM REFERENCE MANUAL'),
    '',
    'These commands move the cursor. After an operator',
    'they say what text it works on, see |d|.',
    '',
    t('', '*linewise* *charwise*'),
    'A motion is linewise or charwise. A linewise motion',
    'always takes whole lines, like |j| and |k|; a',
    'charwise one starts and ends at characters, like',
    '|word| motions.',
    '',
    t('j  or  <Down>', '*j*'),
    '              [count] lines downward, |linewise|.',
    '',
    t('k  or  <Up>', '*k*'),
    '              [count] lines upward, |linewise|.',
    '',
    t('', '*word*'),
    'A word is a run of letters, digits and underscores,',
    'or a run of other non-blank characters.',
    '',
    t('', '*w*'),
    'w             [count] words forward. Charwise.',
    '',
    t('', '*text-objects*'),
    'After an operator, an object selects a thing:',
    '|iw| is "inner word", |aw| is "a word".',
    '',
    t('', '*iw*'),
    'iw            [count] words, white space counts',
    '',
    t('', '*aw*'),
    'aw            [count] words with the space after',
    '',
    t('', '*jumplist*'),
    'Jumps (searches, G, tags) are remembered in a list.',
    '',
    t('', '*CTRL-O*'),
    'CTRL-O        Go to [count] Older cursor position in',
    '              the jump list. Also see |CTRL-T|.',
    '',
    t('<Tab>  or', '*CTRL-I* *<Tab>*'),
    'CTRL-I        Go to [count] newer cursor position.',
  ],
  'undo.txt': [
    t('*undo.txt*       Nvim', 'VIM REFERENCE MANUAL'),
    '',
    'Undo and redo. Every change can be undone, and the',
    'undone changes are kept: see |undo-branches|.',
    '',
    t('<Undo>  or', '*undo* *u*'),
    'u             Undo [count] changes.',
    '',
    t('', '*CTRL-R* *redo*'),
    'CTRL-R        Redo [count] changes that were undone.',
    '',
    t('', '*U*'),
    'U             Undo all latest changes on one line.',
    '',
    t('4. Undo branches', '*undo-branches*'),
    '',
    'Undo, then make a new change, and you create a new',
    'branch. |u| and |CTRL-R| walk only the latest branch;',
    '|g-| and |g+| walk every state in time order.',
    '',
    t('', '*g-*'),
    'g-            Go to an older text state, [count]',
    '              times. Can reach any undone branch.',
    '              Also see |:earlier|.',
    '',
    t('', '*g+*'),
    'g+            Go to a newer text state, [count]',
    '              times. See |:later|.',
    '',
    t('', '*:ea* *:earlier*'),
    ':earlier {N}  Go to an older text state {N} times.',
    ':earlier {N}s Go to the state about {N} seconds ago.',
    '',
    t('', '*:lat* *:later*'),
    ':later {N}    Go to a newer text state {N} times.',
  ],
  'scroll.txt': [
    t('*scroll.txt*     Nvim', 'VIM REFERENCE MANUAL'),
    '',
    'Scrolling moves the text in the window. The cursor',
    'stays on its line unless that line would leave the',
    'window. See |zz| to scroll relative to the cursor.',
    '',
    t('', '*CTRL-E*'),
    'CTRL-E        Scroll window [count] lines downwards',
    '              in the buffer. The text moves up.',
    '',
    t('', '*CTRL-Y*'),
    'CTRL-Y        Scroll window [count] lines upwards',
    '              in the buffer. The text moves down.',
    '',
    t('', '*CTRL-D*'),
    'CTRL-D        Scroll half a screen down; the cursor',
    '              moves the same number of lines.',
    '',
    t('', '*CTRL-U*'),
    'CTRL-U        Scroll half a screen up.',
    '',
    t('', '*zz*'),
    'zz            Redraw, cursor line at the centre.',
    '',
    t('', '*zt*'),
    'zt            Redraw, cursor line at the top.',
    '',
    t('', '*zb*'),
    'zb            Redraw, cursor line at the bottom.',
  ],
  'options.txt': [
    t('*options.txt*    Nvim', 'VIM REFERENCE MANUAL'),
    '',
    'Options change how Nvim behaves. Set them with',
    '|:set|; put the same lines in your config to keep',
    "them. A toggle option is on or off, like 'wrap'.",
    '',
    t('', '*:se* *:set*'),
    ':se[t] {option}   Toggle option: set, switch it on.',
    ':se[t] no{option} Toggle option: reset, switch it off.',
    ':se[t] {option}!  Toggle option: invert its value.',
    ':se[t] {option}?  Show the value of {option}.',
    ':se[t] {option}={value}   Set a number or string.',
    '',
    t('', "*'ignorecase'* *'ic'*"),
    "'ignorecase' 'ic'   boolean (default off)",
    '        Ignore case in search patterns. See |:set|.',
    '',
    t('', "*'number'* *'nu'*"),
    "'number' 'nu'       boolean (default off)",
    '        Print the line number in front of each line.',
    '',
    t('', "*'relativenumber'* *'rnu'*"),
    "'relativenumber'    boolean (default off)",
    '        Show each line number relative to the cursor',
    '        line, so a count for |j| and |k| is in view.',
    '',
    t('', "*'smartcase'* *'scs'*"),
    "'smartcase' 'scs'   boolean (default off)",
    "        With 'ignorecase': match case when the",
    '        pattern has an uppercase letter.',
    '',
    t('', "*'wrap'*"),
    "'wrap'              boolean (default on)",
    '        Long lines wrap and continue on the next',
    '        screen line. Off: they run past the edge.',
  ],
  'tagsrch.txt': [
    t('*tagsrch.txt*    Nvim', 'VIM REFERENCE MANUAL'),
    '',
    'A tag is a place you can jump to: in help, the word',
    'between stars. See |bars| for the links.',
    '',
    t('', '*CTRL-]*'),
    'CTRL-]        Jump to the definition of the keyword',
    '              under the cursor. In help, follow the',
    '              link under the cursor. Go back with',
    '              |CTRL-O| or |CTRL-T|.',
    '',
    t('', '*CTRL-T*'),
    'CTRL-T        Jump to [count] older entry in the tag',
    '              stack.',
  ],
};

type Tag = { file: string; pos: Pos };
let TAGS: Map<string, Tag> | null = null;

/** Every *tag* in the bundled pages. */
export function helpTags(): Map<string, Tag> {
  if (TAGS) return TAGS;
  TAGS = new Map();
  for (const [file, lines] of Object.entries(HELP_FILES)) {
    lines.forEach((l, line) => {
      for (const m of l.matchAll(/\*([^\s*|"]+)\*/g)) if (!TAGS!.has(m[1])) TAGS!.set(m[1], { file, pos: pos(line, m.index!) });
    });
  }
  return TAGS;
}

/** Where :help {subject} lands, following Vim's lookup loosely: exact, option, Ex command, CTRL keys, case, prefix. */
export function findHelp(subject: string): Tag | null {
  const tags = helpTags();
  const s = subject.trim() || 'help.txt';
  const ctrl = /^(\^|ctrl-)(.)$/i.exec(s);
  const tries = [s, `'${s}'`, `:${s}`];
  if (ctrl) tries.push(`CTRL-${ctrl[2].toUpperCase()}`);
  for (const k of tries) if (tags.has(k)) return tags.get(k)!;
  const low = s.toLowerCase();
  const names = [...tags.keys()];
  const ci = names.find(n => n.toLowerCase() === low);
  if (ci) return tags.get(ci)!;
  // A prefix: of the subject, then of the option and the Ex command (Neovim: :h wr -> 'wrap').
  for (const k of [s, `'${s}`, `:${s}`]) {
    const pre = names.filter(n => n.startsWith(k)).sort((a, b) => a.length - b.length)[0];
    if (pre) return tags.get(pre)!;
  }
  return null;
}

const isHelp = (b: Buffer) => b.data.help === true;

function helpBuffer(vim: Vim, file: string): Buffer {
  const hit = vim.buffers.find(b => isHelp(b) && b.name === file);
  if (hit) return hit;
  const buf = new Buffer(file, HELP_FILES[file], { kind: 'nofile', filetype: 'help' });
  buf.listed = false;
  buf.readonly = true;
  buf.modifiable = false;
  buf.data.help = true;
  vim.buffers.push(buf);
  return buf;
}

/** Show `tag` in the current window, remembering where we were in the jump list. */
function jumpTo(vim: Vim, tag: Tag) {
  vim.pushJump();
  if (vim.buf.name !== tag.file || !isHelp(vim.buf)) vim.showBuffer(vim.win, helpBuffer(vim, tag.file));
  vim.setCursor(tag.pos);
  vim.scrollCursorTo('top'); // Neovim shows the tag line at the top of the help window
}

/** :help {subject}: open (or reuse) a help window above the current one and jump to the subject. */
export function openHelp(vim: Vim, subject: string) {
  const tag = findHelp(subject);
  if (!tag) fail(`E149: No help for ${subject}`);
  if (!isHelp(vim.buf)) {
    const open = vim.tab.windows().find(w => isHelp(w.buf));
    if (open) vim.focusWindow(open);
    else {
      // Like :split: the new window starts on the same buffer with a copy of the jump list.
      const from = vim.win;
      const w = vim.splitWindow('col');
      w.jumplist = from.jumplist.map(j => ({ buf: j.buf, pos: { ...j.pos } }));
      w.jumpIdx = from.jumpIdx;
      vim.pushJump();
      vim.showBuffer(w, helpBuffer(vim, tag.file));
    }
  }
  jumpTo(vim, tag);
}

/** The link (|tag|), tag (*tag*) or keyword under or after the cursor, as <C-]> reads it in help. */
export function helpWordAt(line: string, col: number): string | null {
  for (const m of line.matchAll(/([|*])([^\s*|"]+)\1/g)) {
    if (col >= m.index! && col < m.index! + m[0].length) return m[2];
  }
  const kw = /[^\s*|"]/;
  let s = col;
  while (s < line.length && !kw.test(line[s])) s++;
  if (s >= line.length) return null;
  while (s > 0 && kw.test(line[s - 1])) s--;
  let e = s;
  while (e < line.length && kw.test(line[e])) e++;
  return line.slice(s, e);
}

/** <C-]>: in a help buffer, follow the link under the cursor. */
export function followTag(vim: Vim) {
  if (!isHelp(vim.buf)) fail('E433: No tags file');
  const word = helpWordAt(vim.line(), vim.cursor.col);
  if (!word) fail('E349: No identifier under cursor');
  const tag = helpTags().get(word) ?? findHelp(word);
  if (!tag) fail(`E426: Tag not found: ${word}`);
  jumpTo(vim, tag);
}
