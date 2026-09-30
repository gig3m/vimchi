// Plugins a lesson can enable with setup.plugins = ['surround', …].

import type { Plugin } from '../editor';
import { flash } from './flash';
import { gitsigns } from './gitsigns';
import { grugfar } from './grugfar';
import { snippets } from './snippets';
import { lazygit } from './lazygit';
import { lsp } from './lsp';
import { miniAi } from './mini-ai';
import { oil } from './oil';
import { surround } from './surround';
import { telescope } from './telescope';
import { conform } from './conform';
import { whichKey } from './which-key';

export const PLUGINS: Record<string, Plugin> = { surround, 'mini-ai': miniAi, flash, lsp, telescope, oil, gitsigns, lazygit, grugfar, snippets, conform, 'which-key': whichKey };
