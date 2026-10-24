// Shared engine types.

export type Pos = { line: number; col: number };

export const pos = (line: number, col: number): Pos => ({ line, col });
export const cmpPos = (a: Pos, b: Pos) => a.line - b.line || a.col - b.col;
export const eqPos = (a: Pos, b: Pos) => a.line === b.line && a.col === b.col;
export const minPos = (a: Pos, b: Pos) => (cmpPos(a, b) <= 0 ? a : b);
export const maxPos = (a: Pos, b: Pos) => (cmpPos(a, b) >= 0 ? a : b);

/** Inclusive range. For 'line' ranges only the line numbers matter. */
export type Range = { start: Pos; end: Pos; kind: 'char' | 'line' | 'block'; /** block: extend each line to its end */ toEol?: boolean };

export type Mode = 'normal' | 'insert' | 'replace' | 'visual' | 'cmdline' | 'confirm' | 'prompt';
export type VisualKind = 'v' | 'V' | '<C-v>';

export class VimError extends Error {
  constructor(msg = '', public readonly silent = false) {
    super(msg);
  }
}

/** Throw to abort the current command (and any running macro) with a message. */
export function fail(msg = ''): never {
  throw new VimError(msg, !msg);
}

export type Message = { text: string; kind: 'info' | 'error' | 'warn' | 'more' };

export type Options = {
  ignorecase: boolean;
  smartcase: boolean;
  hlsearch: boolean;
  incsearch: boolean;
  wrapscan: boolean;
  textwidth: number;
  shiftwidth: number;
  tabstop: number;
  expandtab: boolean;
  number: boolean;
  relativenumber: boolean;
  scrolloff: number;
  autoindent: boolean;
  wrap: boolean;
  list: boolean;
  listchars: string;
  cursorline: boolean;
  /** Vim's default is on (line jumps go to the first non-blank); Neovim's is off (keep the column). */
  startofline: boolean;
  [k: string]: boolean | number | string;
};

/**
 * The tutor's defaults: Neovim's, with LazyVim's options.lua on top (lua/lazyvim/config/options.lua),
 * since that is the editor learners go on to use. Where LazyVim differs from plain Vim the lessons
 * say so, and `lazyNote` flags the first time such a behaviour fires.
 */
export const DEFAULT_OPTIONS: Options = {
  ignorecase: true,
  smartcase: true,
  hlsearch: true,
  incsearch: true,
  wrapscan: true,
  textwidth: 0,
  shiftwidth: 2,
  tabstop: 2,
  expandtab: true,
  shiftround: true,
  smartindent: true,
  number: true,
  relativenumber: true,
  scrolloff: 4,
  sidescrolloff: 8,
  autoindent: true,
  wrap: false,
  // LazyVim turns 'list' on, so tabs and trailing spaces show (Neovim's default listchars).
  list: true,
  listchars: 'tab:> ,trail:-,nbsp:+',
  // eob: no ~ on the rows past the end of the file.
  fillchars: 'eob: ',
  cursorline: true,
  startofline: false,
  confirm: true,
  formatoptions: 'jcroqlnt',
  comments: 's1:/*,mb:*,ex:*/,://,b:#,:%,:XCOMM,n:>,fb:-',
  virtualedit: 'block',
  splitbelow: true,
  splitright: true,
  laststatus: 3,
  showmode: false,
  foldmethod: 'indent',
  foldlevel: 99,
  foldtext: '',
  jumpoptions: 'view',
  inccommand: 'nosplit',
  winminwidth: 5,
  signcolumn: 'yes',
  timeoutlen: 300,
};

/** Neovim's built-in defaults (not the tutor's LazyVim ones): `:set` lists what differs from these,
 * and `:set opt&` resets to them, as in LazyVim. */
export const NVIM_DEFAULTS: Options = {
  ...DEFAULT_OPTIONS,
  ignorecase: false, smartcase: false, tabstop: 8, shiftround: false, smartindent: false, relativenumber: false,
  scrolloff: 0, sidescrolloff: 0, fillchars: '', confirm: false, formatoptions: 'tcqj', virtualedit: '',
  splitbelow: false, splitright: false, laststatus: 2, showmode: true, foldmethod: 'manual', foldlevel: 0, foldtext: 'foldtext()',
  jumpoptions: 'clean', inccommand: 'nosplit', winminwidth: 1, signcolumn: 'auto', timeoutlen: 1000,
  shiftwidth: 8, expandtab: false, number: false, wrap: true, list: false, cursorline: false,
};

/** Options each buffer has its own copy of (Neovim's buffer-local ones); the rest are global or
 * window-local (a :setlocal goes to the window). */
export const BUFFER_LOCAL = new Set(['shiftwidth', 'tabstop', 'expandtab', 'autoindent', 'textwidth', 'smartindent', 'formatoptions', 'comments']);
/** Options each window has its own copy of: a split copies them, :set changes only this window's
 * (and the global value new windows start from). */
export const WINDOW_LOCAL = new Set(['list', 'number', 'relativenumber', 'wrap', 'cursorline', 'foldmethod', 'foldlevel', 'foldtext', 'signcolumn']);
/** Comma-separated list options: += adds an item with a comma, -= removes one. */
export const COMMA_LIST = new Set(['listchars', 'fillchars', 'virtualedit', 'jumpoptions', 'comments']);

export const OPTION_ALIASES: Record<string, string> = {
  ic: 'ignorecase', scs: 'smartcase', hls: 'hlsearch', is: 'incsearch', ws: 'wrapscan', tw: 'textwidth',
  sw: 'shiftwidth', ts: 'tabstop', et: 'expandtab', nu: 'number', rnu: 'relativenumber', so: 'scrolloff',
  ai: 'autoindent', cul: 'cursorline', sol: 'startofline', lcs: 'listchars', sr: 'shiftround', si: 'smartindent',
  siso: 'sidescrolloff', fcs: 'fillchars', cf: 'confirm', fo: 'formatoptions', ve: 'virtualedit', sb: 'splitbelow',
  spr: 'splitright', ls: 'laststatus', smd: 'showmode', fdm: 'foldmethod', fdl: 'foldlevel', jop: 'jumpoptions',
  icm: 'inccommand', fdt: 'foldtext', wmw: 'winminwidth', scl: 'signcolumn', tm: 'timeoutlen', com: 'comments',
};
