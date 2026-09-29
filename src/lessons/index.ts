// Every section, in curriculum order.

import { gettingAround } from './sections/getting-around';
import { smallEdits } from './sections/small-edits';
import { nextSteps } from './sections/next-steps';
import { insertLikeAPro } from './sections/insert-like-a-pro';
import { essentialMotions } from './sections/essential-motions';
import { screenMovement } from './sections/screen-movement';
import { basicOperators } from './sections/basic-operators';
import { textObjects } from './sections/text-objects';
import { visualMode } from './sections/visual-mode';
import { search } from './sections/search';
import { indentCase } from './sections/indent-case';
import { registers } from './sections/registers';
import { marksJumps } from './sections/marks-jumps';
import { macros } from './sections/macros';
import { commandLine } from './sections/command-line';
import { globalCommands } from './sections/global-commands';
import { substitute } from './sections/substitute';
import { buffersFiles } from './sections/buffers-files';
import { windowsTabs } from './sections/windows-tabs';
import { quickfix } from './sections/quickfix';
import { folds } from './sections/folds';
import { insertPower } from './sections/insert-power';
import { neovimBuiltins } from './sections/neovim-builtins';
import { configLiteracy } from './sections/config-literacy';
import { surround } from './sections/surround';
import { moreTextObjects } from './sections/more-text-objects';
import { operatorPlugins } from './sections/operator-plugins';
import { jumping } from './sections/jumping';
import { findingThings } from './sections/finding-things';
import { fileNavigation } from './sections/file-navigation';
import { git } from './sections/git';
import { diffs } from './sections/diffs';
import { challenges } from './sections/challenges';
import type { Lesson, Section } from './types';

export const SECTIONS: Section[] = [
  gettingAround,
  smallEdits,
  nextSteps,
  insertLikeAPro,
  essentialMotions,
  screenMovement,
  basicOperators,
  textObjects,
  visualMode,
  search,
  indentCase,
  registers,
  marksJumps,
  macros,
  commandLine,
  globalCommands,
  substitute,
  buffersFiles,
  windowsTabs,
  quickfix,
  folds,
  insertPower,
  neovimBuiltins,
  configLiteracy,
  surround,
  moreTextObjects,
  operatorPlugins,
  jumping,
  findingThings,
  fileNavigation,
  git,
  diffs,
  challenges,
];

export const ORDER: Lesson[] = SECTIONS.flatMap(s => s.lessons);
export const LESSONS: Record<string, Lesson> = Object.fromEntries(ORDER.map(l => [l.id, l]));

/** Lessons that count toward completion (bosses are optional). */
export const COUNTED: Lesson[] = ORDER.filter(l => !l.boss);

export const sectionOf = (id: string) => SECTIONS.find(s => s.lessons.some(l => l.id === id))!;
export const numberOf = (id: string) => String(ORDER.filter(l => !l.boss).findIndex(l => l.id === id) + 1).padStart(2, '0');
export const nextOf = (id: string): Lesson | undefined => ORDER[ORDER.findIndex(l => l.id === id) + 1];
