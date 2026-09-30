import { Code } from '../../components/Code';
import type { Vim } from '../../vim/editor';
import { harpoonList } from '../../vim/plugins/harpoon';
import { openDir } from '../../vim/plugins/oil';
import type { Section } from '../types';
import { SHOP, cursorAt } from './finding-things';

/** Start in an oil buffer for `dir`, cursor on `focus`. */
const inOil = (dir: string, focus?: string) => (vim: Vim) => openDir(vim, dir, focus);
const exists = (vim: Vim, f: string) => vim.fs.read(f) != null;
const harpooned = (...files: string[]) => (vim: Vim) => JSON.stringify(harpoonList(vim)) === JSON.stringify(files);
const MARKS = ['src/app.ts', 'src/routes/invoices.ts', 'src/lib/money.ts', 'test/money.test.ts'];
const withMarks = (list: string[], ...open: string[]) => (vim: Vim) => {
  vim.pluginData.harpoon = { list: [...list] };
  for (const f of open) vim.ex(`edit ${f}`);
};

export const fileNavigation: Section = {
  id: 'file-navigation',
  title: 'File Navigation',
  band: 'project',
  lessons: [
    {
      id: 'oil-open-directory',
      title: 'Open the Directory',
      chips: ['-', 'CR'],
      keyCards: [
        { key: '-', glyph: '↑', label: 'parent directory', sub: 'oil.nvim' },
        { key: 'CR', glyph: '⏎', label: 'open entry' },
      ],
      intro: (
        <>
          <p>
            With oil.nvim, <Code>-</Code> opens the directory of the current file as an ordinary buffer: one entry per
            line, directories ending in <Code>/</Code>, the cursor on the file you came from. <Code>CR</Code> opens the
            entry under the cursor, and <Code>-</Code> again goes up a level.
          </p>
          <p>
            Since it is a buffer, you move with <Code>j</Code>, <Code>k</Code>, <Code>/</Code> and the rest, and{' '}
            <Code>C-^</Code> takes you back to the file.
          </p>
        </>
      ),
      practice: total => <p>Walk the project with <Code>-</Code> and <Code>CR</Code> to reach each file. {total} rounds.</p>,
      aside: {
        title: 'Where is -?',
        body: (
          <p>
            oil's README suggests <Code>{"vim.keymap.set('n', '-', '<CMD>Oil<CR>')"}</Code>; it replaces the rarely used
            {' '}<Code>-</Code> motion. mini.files and neo-tree are the column and tree-style alternatives; netrw's{' '}
            <Code>:Explore</Code> is built in.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { files: SHOP, plugins: ['oil'] },
        rounds: [
          {
            prompt: 'Open the directory this file is in.',
            setup: { open: 'src/routes/invoices.ts' },
            goal: { buffer: 'oil:///src/routes/' },
            solution: '-',
          },
          {
            prompt: 'Go to the directory and open dates.ts.',
            setup: { open: 'src/lib/money.ts' },
            goal: { buffer: 'src/lib/dates.ts' },
            solution: '-gg<CR>',
          },
          {
            prompt: 'Open the project root.',
            setup: { open: 'src/app.ts' },
            goal: { buffer: 'oil:///' },
            solution: '--',
          },
          {
            prompt: 'From the customers route, open src/lib/logger.ts.',
            setup: { open: 'src/routes/customers.ts' },
            goal: { buffer: 'src/lib/logger.ts' },
            solution: '--k<CR>j<CR>',
          },
          {
            prompt: 'From the README, open test/invoices.test.ts.',
            setup: { open: 'README.md' },
            goal: { buffer: 'test/invoices.test.ts' },
            solution: '-kk<CR><CR>',
          },
        ],
      },
    },
    {
      id: 'oil-edit-directory',
      title: 'Edit a Directory',
      chips: ['dd', 'cw', ':w'],
      keyCards: [
        { key: 'dd', glyph: 'del', label: 'delete entry' },
        { key: 'cw', glyph: '✎', label: 'rename entry' },
        { key: 'o', glyph: '+', label: 'new entry' },
        { key: ':w', glyph: '✓', label: 'apply changes', sub: 'y to confirm' },
      ],
      intro: (
        <>
          <p>
            An oil buffer is the file system as text. Delete a line to delete the file, change a name to rename it,
            add a line to create one. <Code>:w</Code> lists the changes in a float; <Code>y</Code> applies them,{' '}
            <Code>n</Code> backs out.
          </p>
          <p>
            All your editing works here: <Code>cw</Code> renames up to the extension, <Code>dj</Code> removes two
            entries, <Code>dd</Code> in one directory and <Code>p</Code> in another moves a file.
          </p>
        </>
      ),
      practice: total => <p>Change the files the prompt asks for, then save and confirm. {total} rounds.</p>,
      aside: {
        title: 'How oil keeps track',
        body: (
          <p>
            Each line starts with a hidden id like <Code>/003</Code>, which is how oil tells a rename from a delete plus
            a create. Clear a whole line with <Code>cc</Code> and the id goes too, so that entry counts as new.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { files: SHOP, open: 'README.md', plugins: ['oil'] },
        rounds: [
          {
            prompt: 'Rename dates.ts to time.ts.',
            setup: { init: inOil('src/lib', 'dates.ts') },
            goal: { check: vim => exists(vim, 'src/lib/time.ts') && !exists(vim, 'src/lib/dates.ts') },
            solution: 'cwtime<Esc>:w<CR>y',
          },
          {
            prompt: 'Delete logger.ts.',
            setup: { init: inOil('src/lib', 'logger.ts') },
            goal: { check: vim => !exists(vim, 'src/lib/logger.ts') && exists(vim, 'src/lib/money.ts') },
            solution: 'dd:w<CR>y',
          },
          {
            prompt: 'Create format.ts in src/lib.',
            setup: { init: inOil('src/lib', 'money.ts') },
            goal: { check: vim => exists(vim, 'src/lib/format.ts') },
            solution: 'oformat.ts<Esc>:w<CR>y',
          },
          {
            prompt: 'Delete both test files; keep setup.ts.',
            setup: {
              init: vim => {
                vim.fs.write('test/setup.ts', "process.env.TZ = 'UTC';\n");
                openDir(vim, 'test');
              },
            },
            goal: { check: vim => vim.fs.list().filter(f => f.startsWith('test/')).join() === 'test/setup.ts' },
            solution: 'dj:w<CR>y',
          },
          {
            prompt: 'Rename the routes directory to handlers.',
            setup: { init: inOil('src', 'routes') },
            goal: { check: vim => exists(vim, 'src/handlers/invoices.ts') && !vim.fs.isDir('src/routes') },
            solution: 'cwhandlers<Esc>:w<CR>y',
          },
          {
            prompt: 'In one save: rename money.ts to currency.ts and delete dates.ts.',
            setup: { init: inOil('src/lib', 'money.ts') },
            goal: { check: vim => exists(vim, 'src/lib/currency.ts') && !exists(vim, 'src/lib/money.ts') && !exists(vim, 'src/lib/dates.ts') },
            solution: 'cwcurrency<Esc>ggdd:w<CR>y',
          },
        ],
      },
    },
    {
      id: 'harpoon-add',
      title: 'Harpoon a File',
      chips: ['␣a'],
      keyCards: [{ key: '␣a', glyph: '⚓', label: 'add to harpoon', sub: 'current file' }],
      intro: (
        <>
          <p>
            Harpoon keeps a short, ordered list of the files you are working on right now. <Code>Space a</Code> adds
            the current file to the end of the list; adding it twice does nothing.
          </p>
          <p>
            The list belongs to the project and survives restarts. Keep it to the three or four files you keep coming
            back to, and jumping between them costs two keys, as the next lesson shows.
          </p>
        </>
      ),
      practice: total => <p>Build the list the prompt describes. {total} rounds.</p>,
      aside: {
        title: 'Marks with memory',
        body: (
          <p>
            Harpoon remembers where the cursor was in each file, like an uppercase mark per file. Built-in{' '}
            <Code>mA</Code>/<Code>'A</Code> marks and the arglist (<Code>:argadd</Code>) cover much of the same ground
            without a plugin.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { files: SHOP, open: 'src/lib/money.ts', plugins: ['harpoon', 'telescope'] },
        rounds: [
          {
            prompt: 'Add money.ts to harpoon.',
            goal: { check: harpooned('src/lib/money.ts') },
            solution: '<Space>a',
          },
          {
            prompt: 'app.ts is already on the list. Add the invoices route after it.',
            setup: { open: 'src/routes/invoices.ts', init: withMarks(['src/app.ts']) },
            goal: { check: harpooned('src/app.ts', 'src/routes/invoices.ts') },
            solution: '<Space>a',
          },
          {
            prompt: 'Add this file, then the alternate file (C-^).',
            setup: { init: withMarks([], 'src/lib/logger.ts', 'src/lib/money.ts') },
            goal: { check: harpooned('src/lib/money.ts', 'src/lib/logger.ts') },
            solution: '<Space>a<C-^><Space>a',
          },
          {
            prompt: 'Find dates.ts with Space ff and add it to the list.',
            setup: { open: 'src/app.ts', init: withMarks(['src/app.ts', 'src/lib/money.ts']) },
            goal: { check: harpooned('src/app.ts', 'src/lib/money.ts', 'src/lib/dates.ts') },
            solution: '<Space>ffdates<CR><Space>a',
          },
        ],
      },
    },
    {
      id: 'harpoon-jump',
      title: 'Jump to a Mark',
      chips: ['C-e', '␣1', '␣4'],
      keyCards: [
        { key: 'C-e', glyph: '☰', label: 'quick menu', sub: 'q or esc saves' },
        { key: '␣1', glyph: '1', label: 'first file' },
        { key: '␣2', glyph: '2', label: 'second file', sub: 'up to ␣4' },
      ],
      intro: (
        <>
          <p>
            <Code>Space 1</Code> to <Code>Space 4</Code> jump straight to the files on the harpoon list, landing where
            you left the cursor. <Code>C-e</Code> shows the list in a float; <Code>CR</Code> opens the entry under the
            cursor.
          </p>
          <p>
            The menu is a buffer: <Code>dd</Code> drops a file, <Code>dd</Code> then <Code>P</Code> moves one, and{' '}
            <Code>q</Code> or <Code>esc</Code> closes it and saves the new order.
          </p>
        </>
      ),
      practice: total => <p>Jump to marks and rearrange the list. {total} rounds.</p>,
      aside: {
        title: 'Which keys?',
        body: (
          <p>
            Harpoon's README maps <Code>C-h</Code>, <Code>C-t</Code>, <Code>C-n</Code> and <Code>C-s</Code> to the four
            slots. Browsers keep <Code>C-t</Code> and <Code>C-n</Code>, so the tutor uses <Code>Space 1</Code>–
            <Code>Space 4</Code>, another common choice.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { files: SHOP, open: 'README.md', plugins: ['harpoon'], init: withMarks(MARKS) },
        rounds: [
          {
            prompt: 'Jump to money.ts, the third mark.',
            goal: { buffer: 'src/lib/money.ts' },
            solution: '<Space>3',
          },
          {
            prompt: 'Jump to the invoices route.',
            goal: { buffer: 'src/routes/invoices.ts' },
            solution: '<Space>2',
          },
          {
            prompt: 'Open the quick menu and open the test file from it.',
            goal: { buffer: 'test/money.test.ts' },
            solution: '<C-e>G<CR>',
          },
          {
            prompt: 'Remove app.ts from the list.',
            goal: { check: vim => harpooned(...MARKS.slice(1))(vim) && !vim.floats.length },
            solution: '<C-e>ddq',
          },
          {
            prompt: 'Move money.ts to the top of the list.',
            goal: { check: vim => harpooned(MARKS[2], MARKS[0], MARKS[1], MARKS[3])(vim) && !vim.floats.length },
            solution: '<C-e>jjddggPq',
          },
          {
            prompt: 'Jump back to the invoices route, where you left the cursor on line 15.',
            setup: {
              init: vim => {
                vim.pluginData.harpoon = { list: [MARKS[0], { value: MARKS[1], row: 14, col: 2 }, MARKS[2]] };
              },
            },
            goal: { buffer: MARKS[1], check: cursorAt({ line: 14, col: 2 }) },
            solution: '<Space>2',
          },
        ],
      },
    },
  ],
};
