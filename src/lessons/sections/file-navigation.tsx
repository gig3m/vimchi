import { Code } from '../../components/Code';
import type { Vim } from '../../vim/editor';
import { explorerOpen, mainFile, openExplorer, projectHas, treeLines } from '../../vim/plugins/explorer';
import type { Section } from '../types';
import { SHOP } from './finding-things';

/** Start with the tree open, the cursor on the open file. */
const inTree = (vim: Vim) => openExplorer(vim);
const shows = (f: string) => (vim: Vim) => mainFile(vim) === f;

export const fileNavigation: Section = {
  id: 'file-navigation',
  title: 'Explorer',
  band: 'project',
  lessons: [
    {
      id: 'explorer-open',
      title: 'Open the Tree',
      chips: ['␣e', 'l', 'h', 'q'],
      keyCards: [
        { key: '␣e', glyph: '▤', label: 'toggle the tree', sub: 'kickstart: \\' },
        { key: 'l', glyph: '▸', label: 'expand or open' },
        { key: 'h', glyph: '◂', label: 'collapse' },
        { key: 'CR', glyph: '⏎', label: 'open or toggle' },
        { key: 'q', glyph: '✕', label: 'close the tree' },
      ],
      intro: (
        <>
          <p>
            <Code>Space e</Code> opens the file tree in a sidebar on the left, with the cursor on the file you are
            editing. Move with <Code>j</Code> and <Code>k</Code>. <Code>l</Code> expands a directory or opens a file;{' '}
            <Code>h</Code> collapses a directory, or closes the one you are in and moves up to it.
          </p>
          <p>
            <Code>enter</Code> opens a file or toggles a directory. A file opens in the main window and the tree stays
            open beside it; <Code>q</Code> in the tree closes it, and <Code>Space e</Code> closes it from anywhere.
          </p>
        </>
      ),
      practice: total => <p>Walk the tree to each file the prompt names, or close it when asked. {total} rounds.</p>,
      aside: {
        title: 'Two starters',
        body: (
          <p>
            <Code>Space e</Code> is LazyVim's snacks.explorer. kickstart's explorer is neo-tree, opt-in (uncomment its{' '}
            <Code>kickstart.plugins.neo-tree</Code> line), on <Code>\</Code>: <Code>enter</Code> toggles a directory and{' '}
            <Code>BS</Code> goes up, where snacks uses <Code>l</Code> and <Code>h</Code>. If you would rather edit a
            directory as text, look at oil.nvim.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { files: SHOP, open: 'README.md', plugins: ['explorer'], height: 16 },
        rounds: [
          {
            prompt: 'Open the tree.',
            goal: { check: explorerOpen },
            solution: '<Space>e',
          },
          {
            prompt: 'Open dates.ts, in the same directory as this file.',
            setup: { open: 'src/lib/money.ts' },
            goal: { check: shows('src/lib/dates.ts') },
            solution: '<Space>ekkl',
          },
          {
            prompt: 'Open test/money.test.ts.',
            setup: { open: 'src/app.ts' },
            goal: { check: shows('test/money.test.ts') },
            solution: '<Space>ejljjl',
          },
          {
            prompt: 'The tree is open on dates.ts. Open logger.ts, then close the tree.',
            setup: { open: 'src/lib/dates.ts', init: inTree },
            goal: { check: vim => shows('src/lib/logger.ts')(vim) && !explorerOpen(vim) },
            solution: 'jl<Space>e',
          },
          {
            prompt: 'The tree is open on invoices.ts. Collapse src, then open README.md.',
            setup: { open: 'src/routes/invoices.ts', init: inTree },
            goal: { check: vim => shows('README.md')(vim) && treeLines(vim).includes('▸ src') },
            solution: 'hhGl',
          },
          {
            prompt: 'Open src/db/client.ts.',
            goal: { check: shows('src/db/client.ts') },
            solution: '<Space>eggj<CR>j<CR>j<CR>',
          },
          {
            prompt: 'Close the tree.',
            setup: { open: 'src/routes/customers.ts', init: inTree },
            goal: { check: vim => !explorerOpen(vim) },
            solution: 'q',
          },
        ],
      },
    },
    {
      id: 'explorer-edit',
      title: 'Edit the Tree',
      chips: ['a', 'd', 'r'],
      keyCards: [
        { key: 'a', glyph: '+', label: 'add', sub: 'end with / for a directory' },
        { key: 'd', glyph: 'del', label: 'delete', sub: 'y to confirm' },
        { key: 'r', glyph: '✎', label: 'rename' },
      ],
      intro: (
        <>
          <p>
            In the tree, <Code>a</Code> asks for a name and adds a file in the directory under the cursor (or beside
            the file under it). End the name with <Code>/</Code> to make a directory; <Code>lib/fmt.ts</Code> makes
            both at once.
          </p>
          <p>
            <Code>d</Code> deletes the entry under the cursor after you confirm with <Code>y</Code>. <Code>r</Code>{' '}
            renames it: the prompt starts with the old name, so <Code>C-u</Code> clears it or <Code>BS</Code> trims the
            end. Open buffers follow a rename.
          </p>
        </>
      ),
      practice: total => <p>Add, delete and rename until the project matches the prompt. {total} rounds.</p>,
      aside: {
        title: 'Two starters',
        body: (
          <p>
            neo-tree, kickstart's opt-in explorer on <Code>\</Code>, uses the same <Code>a</Code>, <Code>d</Code> and{' '}
            <Code>r</Code>, and moves with <Code>enter</Code> and <Code>BS</Code> where snacks.explorer uses{' '}
            <Code>l</Code> and <Code>h</Code>. oil.nvim takes another route: the directory is a buffer you edit with{' '}
            <Code>dd</Code> and <Code>cw</Code>, then <Code>:w</Code>.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { files: SHOP, open: 'README.md', plugins: ['explorer'], height: 16 },
        rounds: [
          {
            prompt: 'Rename dates.ts to time.ts. The tree is open on it.',
            setup: { open: 'src/lib/dates.ts', init: inTree },
            goal: { check: vim => projectHas(vim, 'src/lib/time.ts') && !projectHas(vim, 'src/lib/dates.ts') },
            solution: 'r<C-u>time.ts<CR>',
          },
          {
            prompt: 'Delete logger.ts. The tree is open on it.',
            setup: { open: 'src/lib/logger.ts', init: inTree },
            goal: { check: vim => !projectHas(vim, 'src/lib/logger.ts') && projectHas(vim, 'src/lib/money.ts') },
            solution: 'dy',
          },
          {
            prompt: 'Add fmt.ts to src/lib. The tree is open on money.ts.',
            setup: { open: 'src/lib/money.ts', init: inTree },
            goal: { check: vim => projectHas(vim, 'src/lib/fmt.ts') },
            solution: 'afmt.ts<CR>',
          },
          {
            prompt: 'Add a services directory to src. The tree is open on app.ts.',
            setup: { open: 'src/app.ts', init: inTree },
            goal: { check: vim => projectHas(vim, 'src/services') },
            solution: 'aservices/<CR>',
          },
          {
            prompt: 'Rename the routes directory to api. The tree is open on invoices.ts, inside it.',
            setup: { open: 'src/routes/invoices.ts', init: inTree },
            goal: { check: vim => projectHas(vim, 'src/api/invoices.ts') && !projectHas(vim, 'src/routes') },
            solution: 'hr<C-u>api<CR>',
          },
          {
            prompt: 'Delete the test directory.',
            goal: { check: vim => !projectHas(vim, 'test') && projectHas(vim, 'README.md') },
            solution: '<Space>ekkdy',
          },
          {
            prompt: 'Rename money.ts to price.ts, then delete dates.ts.',
            setup: { open: 'src/lib/money.ts', init: inTree },
            goal: {
              check: vim => projectHas(vim, 'src/lib/price.ts') && !projectHas(vim, 'src/lib/money.ts') && !projectHas(vim, 'src/lib/dates.ts'),
            },
            solution: 'r<C-u>price.ts<CR>kkdy',
          },
        ],
      },
    },
  ],
};
