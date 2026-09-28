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
  cursorline: boolean;
  [k: string]: boolean | number | string;
};

export const DEFAULT_OPTIONS: Options = {
  ignorecase: false,
  smartcase: false,
  hlsearch: true,
  incsearch: true,
  wrapscan: true,
  textwidth: 0,
  shiftwidth: 2,
  tabstop: 8,
  expandtab: true,
  number: true,
  relativenumber: false,
  scrolloff: 0,
  autoindent: true,
  wrap: false,
  list: false,
  cursorline: true,
};

export const OPTION_ALIASES: Record<string, string> = {
  ic: 'ignorecase', scs: 'smartcase', hls: 'hlsearch', is: 'incsearch', ws: 'wrapscan', tw: 'textwidth',
  sw: 'shiftwidth', ts: 'tabstop', et: 'expandtab', nu: 'number', rnu: 'relativenumber', so: 'scrolloff',
  ai: 'autoindent', cul: 'cursorline',
};
