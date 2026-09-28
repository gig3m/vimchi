// Plugins a lesson can enable with setup.plugins = ['surround', …].

import type { Plugin } from '../editor';
import { abolish } from './abolish';
import { diff } from './diff';
import { exchange } from './exchange';
import { flash } from './flash';
import { fugitive } from './fugitive';
import { gitsigns } from './gitsigns';
import { harpoon } from './harpoon';
import { lsp } from './lsp';
import { miniAi } from './mini-ai';
import { oil } from './oil';
import { replaceWithRegister } from './replace-with-register';
import { surround } from './surround';
import { telescope } from './telescope';

export const PLUGINS: Record<string, Plugin> = {
  surround, 'mini-ai': miniAi, exchange, 'replace-with-register': replaceWithRegister, abolish, flash,
  lsp, telescope, oil, harpoon, fugitive, gitsigns, diff,
};
