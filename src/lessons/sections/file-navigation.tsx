import { Code } from '../../components/Code';
import type { Vim } from '../../vim/editor';
import { openDir } from '../../vim/plugins/oil';
import type { Section } from '../types';
import { SHOP } from './finding-things';

/** Start in an oil buffer for `dir`, cursor on `focus`. */
const inOil = (dir: string, focus?: string) => (vim: Vim) => openDir(vim, dir, focus);
const exists = (vim: Vim, f: string) => vim.fs.read(f) != null;

export const fileNavigation: Section = {
  id: 'file-navigation',
  title: 'Explorer',
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
        title: 'Tree explorers',
        body: (
          <p>
            LazyVim's default is neo-tree on <Code>Space e</Code>; kickstart ships none (netrw's <Code>:Explore</Code>
            is built in). The idea is the same: a directory you move through. oil's twist is that the listing is a
            buffer you edit and <Code>:w</Code>; its README maps it to <Code>-</Code>, replacing a rarely used motion.
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
  ],
};
