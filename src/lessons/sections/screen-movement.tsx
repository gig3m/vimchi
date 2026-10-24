import { Code } from '../../components/Code';
import type { Vim } from '../../vim/editor';
import type { Section } from '../types';

// Long buffers: the editor shows 13 rows, so these scroll.
const QUEUE = [
  "import { EventEmitter } from 'node:events';",
  "import { setTimeout as sleep } from 'node:timers/promises';",
  '',
  'export type Job<T> = {',
  '  id: string;',
  '  payload: T;',
  '  attempts: number;',
  '  runAt: number;',
  '};',
  '',
  'export type Handler<T> = (payload: T) => Promise<void>;',
  '',
  'export type QueueOptions = {',
  '  concurrency: number;',
  '  maxAttempts: number;',
  '  backoffMs: number;',
  '};',
  '',
  'const DEFAULTS: QueueOptions = {',
  '  concurrency: 4,',
  '  maxAttempts: 5,',
  '  backoffMs: 500,',
  '};',
  '',
  'export class Queue<T> extends EventEmitter {',
  '  private jobs: Job<T>[] = [];',
  '  private running = 0;',
  '  private stopped = false;',
  '  private readonly opts: QueueOptions;',
  '',
  '  constructor(',
  '    private handler: Handler<T>,',
  '    opts: Partial<QueueOptions> = {},',
  '  ) {',
  '    super();',
  '    this.opts = { ...DEFAULTS, ...opts };',
  '  }',
  '',
  '  push(id: string, payload: T, delayMs = 0) {',
  '    const runAt = Date.now() + delayMs;',
  '    this.jobs.push({ id, payload, attempts: 0, runAt });',
  "    this.emit('queued', id);",
  '    this.tick();',
  '  }',
  '',
  '  get size() {',
  '    return this.jobs.length + this.running;',
  '  }',
  '',
  '  private next(): Job<T> | undefined {',
  '    const now = Date.now();',
  '    const i = this.jobs.findIndex(j => j.runAt <= now);',
  '    return i === -1 ? undefined : this.jobs.splice(i, 1)[0];',
  '  }',
  '',
  '  private tick() {',
  '    const max = this.opts.concurrency;',
  '    while (!this.stopped && this.running < max) {',
  '      const job = this.next();',
  '      if (!job) return;',
  '      this.running++;',
  '      void this.run(job).finally(() => {',
  '        this.running--;',
  '        this.tick();',
  '      });',
  '    }',
  '  }',
  '',
  '  private async run(job: Job<T>) {',
  '    try {',
  '      await this.handler(job.payload);',
  "      this.emit('done', job.id);",
  '    } catch (err) {',
  '      job.attempts++;',
  '      if (job.attempts >= this.opts.maxAttempts) {',
  "        this.emit('failed', job.id, err);",
  '        return;',
  '      }',
  '      const wait = this.opts.backoffMs * 2 ** job.attempts;',
  '      this.jobs.push({ ...job, runAt: Date.now() + wait });',
  "      this.emit('retry', job.id, wait);",
  '    }',
  '  }',
  '',
  '  async drain() {',
  '    while (this.size > 0) await sleep(50);',
  '  }',
  '',
  '  stop() {',
  '    this.stopped = true;',
  '  }',
  '}',
];

const CHANGELOG = [
  '# Changelog',
  '',
  'All notable changes to this project are documented here.',
  'The format follows Keep a Changelog and SemVer.',
  '',
  '## [3.2.0] - 2026-08-14',
  '',
  '### Added',
  '- `retry.jitter` option to spread retries after an outage.',
  '- `Queue.pause()` and `Queue.resume()`.',
  '- Metrics for time spent waiting in the queue.',
  '',
  '### Fixed',
  '- Jobs pushed during `drain()` were sometimes skipped.',
  '- The `failed` event now includes the last error.',
  '',
  '## [3.1.1] - 2026-07-02',
  '',
  '### Fixed',
  '- Backoff overflowed after 31 attempts and retried at once.',
  '- Types for `Handler` accept sync functions again.',
  '',
  '## [3.1.0] - 2026-06-19',
  '',
  '### Added',
  '- `delayMs` argument to `push()` for scheduled jobs.',
  '- A `size` getter that counts running and waiting jobs.',
  '',
  '### Changed',
  '- `concurrency` defaults to 4 instead of 1.',
  '- Retries use exponential backoff instead of a fixed delay.',
  '- `Queue.flush()` is deprecated. Use `drain()` instead.',
  '',
  '## [3.0.0] - 2026-04-30',
  '',
  '### Changed',
  '- Node 20 is now the minimum supported version.',
  '- The package is ESM only. Use `import`, not `require`.',
  '- `Queue` extends `EventEmitter`; `onDone` is gone.',
  '',
  '### Removed',
  '- The `legacy` export and its callback-style API.',
  '- Support for the `QUEUE_DEBUG` environment variable.',
  '',
  '### Migration',
  "1. Replace `require('jobq')` with an `import`.",
  "2. Replace `onDone: fn` with `queue.on('done', fn)`.",
  '3. Replace `flush()` with `await drain()`.',
  '',
  '## [2.4.2] - 2026-02-11',
  '',
  '### Fixed',
  '- A job that threw a non-Error value crashed the worker.',
  '- `stop()` now stops new jobs from starting immediately.',
  '',
  '## [2.4.1] - 2026-01-20',
  '',
  '### Security',
  '- Updated `semver` to 7.6.3 to fix a ReDoS in range parsing.',
  '',
  '## [2.4.0] - 2025-12-03',
  '',
  '### Added',
  '- `maxAttempts` option. Jobs over the limit emit `failed`.',
  '- The `retry` event, with the job id and the wait in ms.',
  '',
  '### Fixed',
  '- Memory leak when thousands of jobs finished in one tick.',
  '',
  '## [2.3.0] - 2025-10-15',
  '',
  '### Added',
  '- First public release on npm.',
];

const PLUGINS = [
  'return {',
  '  {',
  "    'nvim-treesitter/nvim-treesitter',",
  "    build = ':TSUpdate',",
  '    opts = {',
  "      ensure_installed = { 'lua', 'typescript', 'json' },",
  '      highlight = { enable = true },',
  '      indent = { enable = true },',
  '    },',
  '  },',
  '  {',
  "    'nvim-telescope/telescope.nvim',",
  "    dependencies = { 'nvim-lua/plenary.nvim' },",
  '    keys = {',
  "      { '<leader>ff', '<cmd>Telescope find_files<cr>' },",
  "      { '<leader>fg', '<cmd>Telescope live_grep<cr>' },",
  "      { '<leader>fb', '<cmd>Telescope buffers<cr>' },",
  '    },',
  '  },',
  '  {',
  "    'lewis6991/gitsigns.nvim',",
  "    event = 'BufReadPre',",
  '    opts = {',
  '      signs = {',
  "        add = { text = '+' },",
  "        change = { text = '~' },",
  "        delete = { text = '_' },",
  '      },',
  '      current_line_blame = false,',
  '    },',
  '  },',
  '  {',
  "    'stevearc/oil.nvim',",
  '    opts = { view_options = { show_hidden = true } },',
  '    keys = {',
  "      { '-', '<cmd>Oil<cr>', desc = 'Parent directory' },",
  '    },',
  '  },',
  '  {',
  "    'kylechui/nvim-surround',",
  "    version = '*',",
  "    event = 'VeryLazy',",
  '    config = true,',
  '  },',
  '  {',
  "    'folke/flash.nvim',",
  "    event = 'VeryLazy',",
  '    keys = {',
  "      { 's', function() require('flash').jump() end },",
  "      { 'S', function() require('flash').treesitter() end },",
  '    },',
  '  },',
  '}',
];

const ROWS = 13;
/** Start with this line at the top of the screen. */
const top = (line: number) => (vim: Vim) => {
  vim.win.top = line;
};
const topIs = (line: number) => (vim: Vim) => vim.win.top === line;
/** The cursor is on this line, whatever its column (scrolling keeps the column it had). */
const onLine = (line: number) => (vim: Vim) => vim.cursor.line === line;

export const screenMovement: Section = {
  id: 'screen-movement',
  title: 'Screen Movement',
  band: 'core',
  lessons: [
    {
      id: 'half-pages',
      title: 'Half Pages',
      chips: ['C-d', 'C-u'],
      keyCards: [
        { key: 'C-d', glyph: '⇣½', label: 'half page down' },
        { key: 'C-u', glyph: '⇡½', label: 'half page up' },
      ],
      intro: (
        <>
          <p>
            <Code>C-d</Code> scrolls down half a screen and moves the cursor down by the same amount. <Code>C-u</Code>{' '}
            does the same going up. The cursor keeps its place on the screen, so your eyes don't have to hunt for it.
          </p>
          <p>
            Half a page is small enough that you can follow the text as it moves. It's the usual way to read through a
            file: when you know the line number, <Code>39G</Code> is faster; when you're looking for something you
            can't see yet, you scroll.
          </p>
        </>
      ),
      lazyvim: (
        <p>
          LazyVim keeps 4 lines between the cursor and the window's edge (<Code>scrolloff=4</Code>). So from the top of a
          file, the first <Code>C-d</Code> takes the cursor 10 lines down, not 6. In plain Vim, the cursor always moves
          exactly as far as the text scrolls.
        </p>
      ),
      practice: total => (
        <p>
          Line numbers are off: scroll with <Code>C-d</Code> and <Code>C-u</Code> until the thing the prompt names is
          under the cursor. The window shows {ROWS} lines, so each press moves six. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Changing the step',
        body: (
          <p>
            A count sets the step and it sticks: after <Code>10C-d</Code>, every <Code>C-d</Code> and <Code>C-u</Code>{' '}
            moves ten lines until the window is resized.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        showGoal: false,
        base: { name: 'queue.ts', text: QUEUE, height: ROWS, options: { number: false, relativenumber: false } },
        rounds: [
          {
            prompt: 'Scroll down to "private readonly opts".',
            setup: { cursor: { line: 0, col: 0 } },
            goal: { check: onLine(28) },
            solution: '<C-d><C-d><C-d><C-d>',
          },
          {
            prompt: 'Scroll down to "return this.jobs.length".',
            setup: { cursor: { line: 28, col: 0 } },
            goal: { check: onLine(46) },
            solution: '<C-d><C-d><C-d>',
          },
          {
            prompt: 'Scroll down to "await this.handler".',
            setup: { cursor: { line: 46, col: 0 } },
            goal: { check: onLine(70) },
            solution: '<C-d><C-d><C-d><C-d>',
          },
          {
            prompt: 'Scroll down to "stop() {".',
            setup: { cursor: { line: 70, col: 0 } },
            goal: { check: onLine(88) },
            solution: '<C-d><C-d><C-d>',
          },
          {
            prompt: 'Scroll back up to "try {".',
            setup: { cursor: { line: 88, col: 0 } },
            goal: { check: onLine(69) },
            solution: '<C-u><C-u><C-u>',
          },
          {
            prompt: 'Scroll up to "get size()".',
            setup: { cursor: { line: 69, col: 0 } },
            goal: { check: onLine(45) },
            solution: '<C-u><C-u><C-u><C-u>',
          },
        ],
      },
    },
    {
      id: 'full-pages',
      title: 'Full Pages',
      chips: ['C-f', 'C-b'],
      keyCards: [
        { key: 'C-f', glyph: '⇣', label: 'page forward' },
        { key: 'C-b', glyph: '⇡', label: 'page back' },
      ],
      intro: (
        <>
          <p>
            <Code>C-f</Code> scrolls forward a whole screen, keeping two lines of overlap, and puts the cursor near the
            top. <Code>C-b</Code> scrolls back a screen and puts the cursor near the bottom.
          </p>
          <p>
            Use them to skim a long file: a changelog, a log, generated code. When you spot what you want, finish with{' '}
            <Code>j</Code> or <Code>k</Code>.
          </p>
        </>
      ),
      lazyvim: (
        <p>
          In LazyVim the cursor lands 4 lines below the top after <Code>C-f</Code>, and 4 lines above the bottom after{' '}
          <Code>C-b</Code>, because it keeps 4 lines of context (<Code>scrolloff=4</Code>). Plain Vim puts it on the top
          or bottom line itself.
        </p>
      ),
      practice: total => (
        <p>
          Line numbers are off: page with <Code>C-f</Code> and <Code>C-b</Code> until the release or step the prompt
          names is on screen, then step onto it. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Page Down works too',
        body: (
          <p>
            <Code>PageDown</Code> and <Code>PageUp</Code> do the same thing, but <Code>C-f</Code> and <Code>C-b</Code>{' '}
            keep your hands on the home row. Many people use <Code>C-d</Code> for reading and save these for skimming.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        showGoal: false,
        base: { name: 'CHANGELOG.md', text: CHANGELOG, height: ROWS, options: { number: false, relativenumber: false } },
        rounds: [
          {
            prompt: 'Page down to the 3.1.1 release.',
            setup: { cursor: { line: 0, col: 0 } },
            goal: { cursor: { line: 16, col: 0 } },
            solution: '<C-f>j',
          },
          // Each round opens on the view the last one ended with.
          {
            prompt: 'Page down to the third migration step.',
            setup: { cursor: { line: 16, col: 0 }, top: 11 },
            goal: { cursor: { line: 47, col: 0 } },
            solution: '<C-f><C-f><C-f>k',
          },
          {
            prompt: 'Page down to the 2.3.0 release.',
            setup: { cursor: { line: 47, col: 0 }, top: 43 },
            goal: { cursor: { line: 69, col: 0 } },
            solution: '<C-f><C-f>',
          },
          {
            prompt: 'Page back to the 2.4.2 release.',
            setup: { cursor: { line: 69, col: 0 }, top: 65 },
            goal: { cursor: { line: 49, col: 0 } },
            solution: '<C-b><C-b>kk',
          },
          {
            prompt: 'Page back to the 3.1.1 release.',
            setup: { cursor: { line: 49, col: 0 }, top: 43 },
            goal: { cursor: { line: 16, col: 0 } },
            solution: '<C-b><C-b><C-b>kk',
          },
          {
            prompt: 'Page down to the 3.0.0 release.',
            setup: { cursor: { line: 16, col: 0 }, top: 10 },
            goal: { cursor: { line: 33, col: 0 } },
            solution: '<C-f><C-f>3k',
          },
        ],
      },
    },
    {
      id: 'screen-lines',
      title: 'Middle of the Screen',
      chips: ['M'],
      keyCards: [{ key: 'M', glyph: '▭', label: 'middle of the window', sub: 'middle' }],
      intro: (
        <>
          <p>
            <Code>M</Code> moves the cursor to the <b>middle</b> line of the window. Nothing scrolls, and your column
            is kept (Neovim's default). When the file ends before the window does, it is the middle of the lines you
            can see.
          </p>
          <p>
            It gets you near anything in the middle of the screen in one key: look at the line, press{' '}
            <Code>M</Code>, then finish with <Code>j</Code> or <Code>k</Code>.
          </p>
        </>
      ),
      lazyvim: (
        <>
          <p>
            LazyVim gives <Code>H</Code> and <Code>L</Code> to buffers: <Code>H</Code> is the previous buffer,{' '}
            <Code>L</Code> the next. In plain Vim, <Code>H</Code> and <Code>L</Code> jump to the top and bottom of the
            window; <Code>M</Code> is the same in both.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Reach each <span className="hl-green">green box</span> with <Code>M</Code>. {total} rounds.
        </p>
      ),
      aside: {
        title: 'H and L still work in Visual mode',
        body: (
          <p>
            LazyVim maps <Code>H</Code> and <Code>L</Code> in Normal mode only. After an operator or in Visual mode
            they are still Vim's top and bottom of the window: <Code>dL</Code> deletes down to the bottom,{' '}
            <Code>vH</Code> selects up to the top. With LazyVim's <Code>scrolloff=4</Code> they stop 4 lines short
            of an edge that isn't the file's.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        showGoal: false,
        base: { name: 'plugins.lua', text: PLUGINS, height: 20 },
        rounds: [
          { setup: { cursor: { line: 26, col: 4 }, init: top(11) }, goal: { cursor: { line: 20, col: 4 } }, solution: 'M' },
          { setup: { cursor: { line: 24, col: 4 }, init: top(20) }, goal: { cursor: { line: 29, col: 4 } }, solution: 'M' },
          { setup: { cursor: { line: 43, col: 4 }, init: top(28) }, goal: { cursor: { line: 37, col: 3 } }, solution: 'M' },
          // The start of the file is on screen. The init sets the view, so the cursor isn't carried
          // from round 3 (M from there lands elsewhere) only to be put back with a warning.
          { setup: { cursor: { line: 15, col: 4 }, init: top(0) }, goal: { cursor: { line: 9, col: 3 } }, solution: 'M' },
          // The end of the file is on screen: the middle of the lines shown.
          { setup: { cursor: { line: 44, col: 4 }, init: top(40) }, goal: { cursor: { line: 46, col: 4 } }, solution: 'M' },
        ],
      },
    },
    {
      id: 'recenter',
      title: 'Recenter',
      chips: ['zz', 'zt', 'zb'],
      keyCards: [
        { key: 'zz', glyph: '▭·', label: 'line to middle' },
        { key: 'zt', glyph: '▭⤒', label: 'line to top' },
        { key: 'zb', glyph: '▭⤓', label: 'line to bottom' },
      ],
      intro: (
        <>
          <p>
            These scroll the window without moving the cursor. <Code>zz</Code> puts the cursor's line in the middle of the
            screen, <Code>zt</Code> near the top, <Code>zb</Code> near the bottom.
          </p>
          <p>
            Use <Code>zt</Code> to see as much as possible of a function that starts on your line, <Code>zb</Code> to see
            what leads up to it, and <Code>zz</Code> to see both.
          </p>
        </>
      ),
      lazyvim: (
        <p>
          LazyVim keeps 4 lines of context around the cursor (<Code>scrolloff=4</Code>), so <Code>zt</Code> leaves your
          line fifth from the top and <Code>zb</Code> fifth from the bottom. Plain Vim puts it on the very top or bottom
          line. <Code>zz</Code> is the same in both.
        </p>
      ),
      practice: total => (
        <p>
          The cursor is already on the line the round names. Scroll that line where the round asks. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Always centred',
        body: (
          <p>
            A popular mapping keeps the cursor mid-screen after half-page jumps:{' '}
            <Code>{"vim.keymap.set('n', '<C-d>', '<C-d>zz')"}</Code>, and the same for <Code>{'<C-u>'}</Code>.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        showGoal: false,
        base: { name: 'queue.ts', text: QUEUE, height: ROWS },
        rounds: [
          {
            prompt: 'Put the "private async run" line near the top of the screen.',
            setup: { cursor: { line: 68, col: 2 }, init: top(60) },
            goal: { cursor: { line: 68, col: 2 }, check: topIs(64) },
            solution: 'zt',
          },
          {
            prompt: 'Put the "constructor(" line near the bottom of the screen.',
            setup: { cursor: { line: 30, col: 2 }, init: top(26) },
            goal: { cursor: { line: 30, col: 2 }, check: topIs(22) },
            solution: 'zb',
          },
          {
            prompt: 'Centre the "private tick()" line on the screen.',
            setup: { cursor: { line: 55, col: 2 }, init: top(51) },
            goal: { cursor: { line: 55, col: 2 }, check: topIs(49) },
            solution: 'zz',
          },
          {
            prompt: 'Centre the "const wait" line on the screen.',
            setup: { cursor: { line: 78, col: 6 }, init: top(70) },
            goal: { cursor: { line: 78, col: 6 }, check: topIs(72) },
            solution: 'zz',
          },
          {
            prompt: 'Put the "export class Queue" line near the bottom of the screen.',
            setup: { cursor: { line: 24, col: 0 }, init: top(20) },
            goal: { cursor: { line: 24, col: 0 }, check: topIs(16) },
            solution: 'zb',
          },
          {
            prompt: 'Put the "private next()" line near the top of the screen.',
            setup: { cursor: { line: 49, col: 2 }, init: top(41) },
            goal: { cursor: { line: 49, col: 2 }, check: topIs(45) },
            solution: 'zt',
          },
        ],
      },
    },
    {
      id: 'scroll-by-line',
      title: 'Scroll by Line',
      chips: ['C-e', 'C-y'],
      keyCards: [
        { key: 'C-e', glyph: '⇣1', label: 'scroll down a line' },
        { key: 'C-y', glyph: '⇡1', label: 'scroll up a line' },
      ],
      intro: (
        <>
          <p>
            <Code>C-e</Code> scrolls the window down one line: the text moves up and a new line appears at the bottom.{' '}
            <Code>C-y</Code> scrolls up one line. A count scrolls that many: <Code>5C-e</Code>.
          </p>
          <p>
            The cursor stays put, on its line and in its column, until scrolling would take it too close to the edge: then
            it is pushed along. Use them to see a few more lines above or below without losing your place.
          </p>
        </>
      ),
      lazyvim: (
        <p>
          LazyVim pushes the cursor along once it comes within 4 lines of the window's edge (<Code>scrolloff=4</Code>).
          In plain Vim it stays put until its own line would leave the screen.
        </p>
      ),
      practice: total => (
        <p>
          Scroll the window until the line the prompt names is at the top of the screen, or where it asks. When the
          cursor has to move, it ends in the <span className="hl-green">green box</span>. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Your own scrolloff',
        body: (
          <p>
            kickstart sets <Code>scrolloff</Code> to 10, plain Neovim to 0. The bigger it is, the sooner{' '}
            <Code>C-e</Code> and <Code>C-y</Code> start pushing the cursor.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        showGoal: false,
        base: { name: 'queue.ts', text: QUEUE, height: ROWS },
        rounds: [
          {
            prompt: 'Scroll down until "export class Queue" is the top line.',
            setup: { cursor: { line: 30, col: 2 }, init: top(22) },
            goal: { cursor: { line: 30, col: 2 }, check: topIs(24) },
            solution: '2<C-e>',
          },
          {
            prompt: 'Scroll up until "const DEFAULTS" is the top line. Watch the cursor.',
            setup: { cursor: { line: 30, col: 2 }, init: top(24) },
            goal: { cursor: { line: 26, col: 2 }, check: topIs(18) },
            solution: '6<C-y>',
          },
          {
            prompt: 'Scroll down one line. The cursor is 4 lines from the top: watch it.',
            setup: { cursor: { line: 26, col: 2 }, init: top(22) },
            goal: { cursor: { line: 27, col: 2 }, check: topIs(23) },
            solution: '<C-e>',
          },
          {
            prompt: 'Scroll up until "export type QueueOptions" is the top line.',
            setup: { cursor: { line: 27, col: 2 }, init: top(19) },
            goal: { cursor: { line: 20, col: 2 }, check: topIs(12) },
            solution: '7<C-y>',
          },
          {
            prompt: 'Scroll down until "}", the last line of the file, is the bottom line.',
            setup: { cursor: { line: 84, col: 2 }, init: top(76) },
            goal: { cursor: { line: 84, col: 2 }, check: topIs(79) },
            solution: '3<C-e>',
          },
          {
            prompt: 'Scroll up until the first line of the file is the top line.',
            setup: { cursor: { line: 10, col: 0 }, init: top(3) },
            goal: { cursor: { line: 8, col: 0 }, check: topIs(0) },
            solution: '3<C-y>',
          },
        ],
      },
    },
  ],
};
