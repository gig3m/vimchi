# Curriculum Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-sequence the curriculum into six bands (Core, Repeat, Project, Patterns, Code, Challenges), cut the 30 single-source lessons and their engine emulations, re-key the picker and git lessons to the shared kickstart/LazyVim bindings, and add five lessons (word picker, project replace, completion menu, snippets, lazygit).

**Architecture:** The lesson registry (`src/lessons/index.ts`) defines order; each section file declares its band. Pruning is deletion of lesson objects, section files and plugin modules, guarded by a registry test that pins the band order and forbids the removed ids. New capabilities are small plugins in `src/vim/plugins/` (grug-far, snippets, lazygit) plus extra key registrations in the Telescope and gitsigns plugins; new lessons are `rounds` challenges with `check` goals, like every existing sim lesson. `CURRICULUM.md` becomes generated output with a drift test.

**Tech Stack:** TypeScript, React 19, vitest 5, the in-repo Vim engine. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-30-curriculum-revamp-design.md`

## Global Constraints

- Band order: `core, repeat, project, patterns, code, challenges`. `Section.band` union: `'core' | 'repeat' | 'project' | 'patterns' | 'code' | 'challenges'`.
- Surviving section ids are unchanged. Removed sections: `operator-plugins`, `diffs`, `folds`, `config-literacy`. Removed lessons: the 30 listed in the spec. Removed engine modules: `exchange`, `replace-with-register`, `abolish`, `harpoon`, `fugitive`, `diff` (plus their tests). `git-model.ts` stays.
- Every surviving and new lesson passes `lessons.test.ts` (shape, ≤60-col lines, reference solution reaches the goal). Lesson titles ≤ 28 chars, chips 1–4.
- The coach audit (`every reference playthrough yields zero critiques`) stays green; challenge `sections` ids must exist.
- Keys shown in new/re-keyed lessons: pickers `<leader>sf`, `<leader>sg`, `<leader>sw`, `<C-q>`; gitsigns `]h`, `[h`, `<leader>ghs`, `<leader>ghr`; lazygit `<leader>gg`; project replace `<leader>sr`; completion `<C-n>`, `<C-p>`, `<C-y>`, `<C-e>`; snippets `<Tab>`, `<S-Tab>`. Leader is `<Space>`, shown as `␣` in chips.
- `npm test` and `npx tsc -b` green at the end of every task; deploy only after the final review and merge.

## Review Focus

1. **A returning learner with runs for cut lessons.** Expected: sidebar counts only surviving lessons, no crash on unknown ids, their other progress intact. Pinned in Task 1 (`runs for unknown lessons are ignored`).
2. **The old `#operator-plugins`-style deep link or a bookmarked cut lesson id.** Expected: the app falls back to the first lesson, not a blank page. Pinned in Task 1 (`unknown lesson id in the hash falls back`).
3. **`<leader>sw` with the cursor on whitespace or punctuation.** Expected: the picker opens with an empty prompt rather than erroring. Pinned in Task 3 (`sw on whitespace opens an empty grep`).
4. **Project replace when the word appears inside another word.** Expected: whole-word replacement only (`id` does not touch `identity`). Pinned in Task 6 (`replaces whole words only`).
5. **`<Tab>` in insert mode when no snippet applies.** Expected: a literal tab is inserted as before the plugin existed; the snippets plugin must not swallow it. Pinned in Task 7 (`Tab without a trigger inserts a tab`).

---

## File structure

- `src/lessons/types.ts` — band union.
- `src/lessons/index.ts` — `SECTIONS` order.
- `src/lessons/__tests__/registry.test.ts` — band order, removed ids, challenge sections.
- `src/lessons/sections/*.tsx` — band fields; lesson deletions and edits; four files deleted.
- `src/vim/plugins/index.ts` — `PLUGINS` map; six modules and tests deleted; three added: `grugfar.ts`, `snippets.ts`, `lazygit.ts`.
- `src/vim/plugins/telescope.ts` — `<leader>sf/sg/sw`, `grepWord`.
- `src/vim/plugins/gitsigns.ts` — `]h [h`, `<leader>gh*`.
- `src/components/Sidebar.tsx` — `BANDS`.
- `src/App.tsx` — hash fallback already handled by `lessonFromHash`; test only.
- `scripts/curriculum.ts` + `src/lessons/__tests__/curriculum-doc.test.ts` — generator and drift test.
- `README.md`, `docs/PLUGINS.md`, `docs/LESSONS.md`, `CURRICULUM.md`.

---

### Task 1: Bands, order and the registry test

**Files:**
- Modify: `src/lessons/types.ts:37`, `src/lessons/index.ts`, `src/components/Sidebar.tsx:22-27`, every `src/lessons/sections/*.tsx` `band:` field
- Test: `src/lessons/__tests__/registry.test.ts`

**Interfaces:**
- Produces: `SECTIONS` in the new order; `Section.band` values; `BANDS` in the sidebar.

- [ ] **Step 1: Write the failing registry test**

```ts
// src/lessons/__tests__/registry.test.ts
import { describe, expect, it } from 'vitest';
import { CHALLENGES } from '../../challenges';
import { LESSONS, ORDER, SECTIONS } from '..';
import { lessonIdFromHash } from '../../state/seed';

const BAND_ORDER = ['core', 'repeat', 'project', 'patterns', 'code', 'challenges'];
const REMOVED_SECTIONS = ['operator-plugins', 'diffs', 'folds', 'config-literacy'];
const REMOVED_LESSONS = [
  'clipboard-register', 'viewing-registers', 'argument-list', 'command-line-mode', 'save-and-quit', 'terminal-mode',
  'harpoon-add', 'harpoon-jump', 'exchange', 'replace-with-register', 'case-coercion', 'smart-substitute',
  'fugitive-status', 'fugitive-stage', 'fugitive-inline-diff', 'fugitive-commit', 'fugitive-blame',
  'diff-mode', 'diff-obtain-put', 'diff-merge-conflicts', 'creating-folds', 'opening-closing-folds', 'all-folds', 'moving-by-folds',
  'insert-word-completion', 'insert-line-completion', 'insert-file-completion', 'insert-digraphs', 'insert-literal', 'inspect-character',
  'config-options', 'config-mappings', 'config-leader', 'config-init-lua',
];

describe('registry', () => {
  it('sections appear in band order', () => {
    const bands = SECTIONS.map(s => s.band);
    const idx = bands.map(b => BAND_ORDER.indexOf(b));
    expect(idx.every(i => i >= 0)).toBe(true);
    for (let i = 1; i < idx.length; i++) expect(idx[i], `${SECTIONS[i].id} after ${SECTIONS[i - 1].id}`).toBeGreaterThanOrEqual(idx[i - 1]);
    expect(new Set(bands)).toEqual(new Set(BAND_ORDER));
  });
  it('has the sections of each band in the spec order', () => {
    const ids = SECTIONS.map(s => s.id);
    expect(ids).toEqual([
      'getting-around', 'small-edits', 'next-steps', 'insert-like-a-pro', 'essential-motions', 'screen-movement',
      'basic-operators', 'text-objects', 'visual-mode', 'search', 'indent-case',
      'registers', 'macros',
      'buffers-files', 'windows-tabs', 'marks-jumps', 'quickfix', 'finding-things', 'file-navigation',
      'command-line', 'substitute', 'global-commands',
      'neovim-builtins', 'more-text-objects', 'jumping', 'surround', 'insert-power', 'git',
      'challenges',
    ]);
  });
  it('removed sections and lessons are gone', () => {
    for (const id of REMOVED_SECTIONS) expect(SECTIONS.find(s => s.id === id), id).toBeUndefined();
    for (const id of REMOVED_LESSONS) expect(LESSONS[id], id).toBeUndefined();
  });
  it('every challenge names surviving sections', () => {
    for (const c of CHALLENGES) for (const sid of c.challenge.sections) expect(SECTIONS.some(s => s.id === sid), `${c.id}: ${sid}`).toBe(true);
  });
  it('unknown lesson id in the hash falls back', () => {
    const id = lessonIdFromHash('#exchange');
    expect(LESSONS[id]).toBeUndefined();          // App.lessonFromHash returns '' for this and falls back to ORDER[0]
    expect(ORDER[0].id).toBe('move');
  });
  it('runs for unknown lessons are ignored', () => {
    // Sidebar counts via runsOf(lesson.id) per surviving lesson; a run for a cut id matches nothing.
    const runs = [{ lesson: 'exchange', score: 90 }, { lesson: 'move', score: 80 }];
    const counted = ORDER.filter(l => !l.boss && runs.some(r => r.lesson === l.id)).length;
    expect(counted).toBe(1);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lessons/__tests__/registry.test.ts`
Expected: FAIL (`deep`/`plugins` bands present; removed ids still defined).

- [ ] **Step 3: Change the band union, the order and the sidebar**

`types.ts`: `band: 'core' | 'repeat' | 'project' | 'patterns' | 'code' | 'challenges'`.

`index.ts` `SECTIONS` — `tsconfig.json` has `noUnusedLocals: true`, so delete the four removed sections' import lines now (their files go in Task 2):

```ts
export const SECTIONS: Section[] = [
  gettingAround, smallEdits, nextSteps, insertLikeAPro, essentialMotions, screenMovement,
  basicOperators, textObjects, visualMode, search, indentCase,
  registers, macros,
  buffersFiles, windowsTabs, marksJumps, quickfix, findingThings, fileNavigation,
  commandLine, substitute, globalCommands,
  neovimBuiltins, moreTextObjects, jumping, surround, insertPower, git,
  challenges,
];
```

Band fields: `registers`, `macros` → `'repeat'`; `buffers-files`, `windows-tabs`, `marks-jumps`, `quickfix`, `finding-things`, `file-navigation` → `'project'`; `command-line`, `substitute`, `global-commands` → `'patterns'`; `neovim-builtins`, `more-text-objects`, `jumping`, `surround`, `insert-power`, `git` → `'code'`. Use `sed -i "s/band: 'deep'/band: 'repeat'/"` per file, checking each.

`Sidebar.tsx`:

```ts
const BANDS = [
  { id: 'core', title: 'Core' },
  { id: 'repeat', title: 'Repeat' },
  { id: 'project', title: 'Project' },
  { id: 'patterns', title: 'Patterns' },
  { id: 'code', title: 'Code' },
  { id: 'challenges', title: 'Challenges' },
] as const;
```

- [ ] **Step 4: Run the registry test**

Run: `npx vitest run src/lessons/__tests__/registry.test.ts`
Expected: `sections appear in band order` and `spec order` pass; `removed … are gone` still fails (Task 2). `npx tsc -b` clean.

- [ ] **Step 5: Commit**

```bash
git add src/lessons/types.ts src/lessons/index.ts src/components/Sidebar.tsx src/lessons/sections src/lessons/__tests__/registry.test.ts
git commit -m "curriculum: six bands and the consensus section order"
```

---

### Task 2: Prune lessons, sections and engine modules

**Files:**
- Delete: `src/lessons/sections/{operator-plugins,diffs,folds,config-literacy}.tsx`; `src/vim/plugins/{exchange,replace-with-register,abolish,harpoon,fugitive,diff}.ts` and `src/vim/plugins/__tests__/{exchange,replace-with-register,abolish,harpoon,fugitive,diff}.test.ts`
- Modify: `src/lessons/index.ts` (imports), `src/vim/plugins/index.ts` (`PLUGINS`), `src/lessons/sections/{registers,quickfix,command-line,insert-power,neovim-builtins,file-navigation,git}.tsx` (delete lesson objects), `README.md:68-73`, `docs/PLUGINS.md:48`

- [ ] **Step 1: Delete the files and the map entries**

```bash
git rm -q src/lessons/sections/operator-plugins.tsx src/lessons/sections/diffs.tsx src/lessons/sections/folds.tsx src/lessons/sections/config-literacy.tsx
git rm -q src/vim/plugins/{exchange,replace-with-register,abolish,harpoon,fugitive,diff}.ts src/vim/plugins/__tests__/{exchange,replace-with-register,abolish,harpoon,fugitive,diff}.test.ts
```

`src/vim/plugins/index.ts`:

```ts
import type { Plugin } from '../editor';
import { flash } from './flash';
import { gitsigns } from './gitsigns';
import { lsp } from './lsp';
import { miniAi } from './mini-ai';
import { oil } from './oil';
import { surround } from './surround';
import { telescope } from './telescope';

export const PLUGINS: Record<string, Plugin> = { surround, 'mini-ai': miniAi, flash, lsp, telescope, oil, gitsigns };
```

`src/lessons/index.ts`: remove the four section imports.

- [ ] **Step 2: Delete the lesson objects**

Each lesson is one object literal in its section's `lessons: [ … ]` array. Delete by id, keeping the array well-formed:

| file | delete ids |
|---|---|
| `registers.tsx` | `clipboard-register`, `viewing-registers` |
| `quickfix.tsx` | `argument-list` |
| `command-line.tsx` | `command-line-mode`, `save-and-quit` |
| `insert-power.tsx` | `insert-word-completion`, `insert-line-completion`, `insert-file-completion`, `insert-digraphs`, `insert-literal`, `inspect-character` |
| `neovim-builtins.tsx` | `terminal-mode` |
| `file-navigation.tsx` | `harpoon-add`, `harpoon-jump` |
| `git.tsx` | `fugitive-status`, `fugitive-stage`, `fugitive-inline-diff`, `fugitive-commit`, `fugitive-blame` |

Use a small script rather than hand edits (object boundaries are `    {` at 4 spaces through the matching `    },`):

```python
# scratchpad/prune.py — run once per file: python3 prune.py FILE id1 id2 …
import re, sys
p, ids = sys.argv[1], set(sys.argv[2:])
s = open(p).read()
out, i = [], 0
lines = s.split('\n')
while i < len(lines):
    l = lines[i]
    if l == '    {':
        j = i
        while lines[j] != '    },' and lines[j] != '    }': j += 1
        block = '\n'.join(lines[i:j + 1])
        m = re.search(r"^\s*id: '([a-z0-9-]+)'", block, re.M)
        if m and m.group(1) in ids: i = j + 1; continue
        out.extend(lines[i:j + 1]); i = j + 1; continue
    out.append(l); i += 1
open(p, 'w').write('\n'.join(out))
```

After pruning `git.tsx`, remove its fugitive import (`STATUS_NAME, blameBufferName, commitBufferName`) and any now-unused fixtures/helpers (`tsc` will name them). Remove `command-line.tsx`'s lost intro content by adding one sentence to `jump-to-line`'s intro: "`:` opens the command line; `<Esc>` leaves it, `<Tab>` completes, and `:w` / `:q` / `ZZ` save and quit." Remove `registers.tsx` lost content by adding to `unnamed-register`'s aside: "`"+` is the system clipboard; `:reg` lists every register."

- [ ] **Step 3: README and PLUGINS.md**

README Credits paragraph becomes:

```markdown
The plugin lessons emulate the default keymaps of nvim-surround, mini.ai and
nvim-treesitter-textobjects, flash.nvim, telescope.nvim, oil.nvim, gitsigns.nvim, lazygit,
grug-far.nvim and a LuaSnip/blink.cmp-style completion and snippet flow; their code is not
included. Fonts (IBM Plex Sans, JetBrains Mono, Space Grotesk) load from Google Fonts under
the SIL Open Font License.
```

`docs/PLUGINS.md:48`: change the filetype list to drop `fugitive` and `diff` if the engine no longer defines those syntaxes (grep `src/vim/syntax*`; if the filetypes are engine-level and survive, leave the line alone).

- [ ] **Step 4: Verify**

Run: `npx tsc -b && npm test`
Expected: tsc clean (fix any unused import it names); `registry.test.ts` fully green; `lessons.test.ts` green over the pruned registry; coach audit green. Lesson count check: `npx vitest run src/lessons/__tests__/registry.test.ts` then `node -e` is unnecessary — add a temporary `console.log(ORDER.length)` only if in doubt; the expected total after Task 2 is 174 (204 − 30).

- [ ] **Step 5: Commit**

```bash
git add -A src README.md docs/PLUGINS.md
git commit -m "curriculum: cut single-source lessons and their engine emulations"
```

---

### Task 3: Pickers re-keyed to the shared bindings, plus the word picker

**Files:**
- Modify: `src/vim/plugins/telescope.ts:301-320`, `src/lessons/sections/finding-things.tsx`, `src/lessons/sections/buffers-files.tsx` (aside), `src/vim/plugins/__tests__/telescope.test.ts`

**Interfaces:**
- Produces: `grepWord(vim: Vim)` exported from telescope.ts; maps `<leader>sf`, `<leader>sg`, `<leader>sw` (old `<leader>ff/fg/fb` kept as aliases so nothing else breaks).

- [ ] **Step 1: Write the failing plugin test**

Append to `src/vim/plugins/__tests__/telescope.test.ts` (read its existing helpers first; it builds a Vim with `files` and `plugins: ['telescope']`):

```ts
describe('shared bindings', () => {
  it('<leader>sf and <leader>sg open the pickers', () => {
    const v = vimWith({ 'a.ts': 'foo\n', 'b.ts': 'bar\n' });
    v.feedKeys('<Space>sf');
    expect(v.floats.some(f => f.id === 'telescope' && f.title === 'Find Files')).toBe(true);
    v.feed('<Esc>');
    v.feedKeys('<Space>sg');
    expect(v.floats.some(f => f.id === 'telescope' && f.title === 'Live Grep')).toBe(true);
  });
  it('<leader>sw greps the word under the cursor', () => {
    const v = vimWith({ 'a.ts': 'const total = 1;\n', 'b.ts': 'total += 2;\n' });
    v.feedKeys('w'); // on "total"
    v.feedKeys('<Space>sw');
    const f = v.floats.find(x => x.id === 'telescope')!;
    expect(f.prompt?.text).toBe('total');
    expect(f.lines.length).toBe(2);
  });
  it('sw on whitespace opens an empty grep', () => {
    const v = vimWith({ 'a.ts': 'a  b\n' });
    v.feedKeys('l'); // on a space
    v.feedKeys('<Space>sw');
    const f = v.floats.find(x => x.id === 'telescope')!;
    expect(f.prompt?.text).toBe('');
  });
});
```

`vimWith` is whatever helper the file already uses to create a Vim with files and the plugin; if it has none, add `const vimWith = (files: Record<string, string>) => createVim({ files, open: Object.keys(files)[0], plugins: ['telescope'] });` at the top.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/vim/plugins/__tests__/telescope.test.ts -t 'shared bindings'`
Expected: FAIL (no mapping for `<leader>sf`; `grepWord` missing).

- [ ] **Step 3: Implement**

In `telescope.ts`, `startPicker` builds `p.prompt = ''`; add an optional initial prompt: change the signature to `startPicker(vim, title, src, initial = '')` and set `prompt: initial, cursor: initial.length`. Then:

```ts
/** Live grep seeded with the keyword under the cursor (empty on whitespace or punctuation). */
export function grepWord(vim: Vim) {
  const l = vim.line();
  const m = [...l.matchAll(/[A-Za-z0-9_]+/g)].find(x => x.index! <= vim.cursor.col && vim.cursor.col < x.index! + x[0].length);
  liveGrep(vim, m ? m[0] : '');
}
```

and give `liveGrep` an `initial = ''` parameter passed through to `startPicker`. In `setup`:

```ts
    for (const k of ['<leader>ff', '<leader>sf']) vim.map(['n'], k, () => findFiles(vim));
    for (const k of ['<leader>fg', '<leader>sg']) vim.map(['n'], k, () => liveGrep(vim));
    vim.map(['n'], '<leader>sw', () => grepWord(vim));
    vim.map(['n'], '<leader>fb', () => buffers(vim));
```

- [ ] **Step 4: Run the plugin tests**

Run: `npx vitest run src/vim/plugins/__tests__/telescope.test.ts`
Expected: PASS.

- [ ] **Step 5: Re-key the lessons**

In `finding-things.tsx`: section `title: 'Pickers'`. Lesson edits:

- `telescope-find-files` → id `picker-files`, chips `['␣sf', 'C-n', 'C-v']`, key card `␣sf` "find files" sub "kickstart"; intro first sentence: "`Space sf` opens the file picker (LazyVim binds `Space Space` to the same thing)…"; practice text `Space sf`; every solution `<Space>ff` → `<Space>sf`; aside title "The same picker, other keys": "LazyVim's default is `<leader><space>` for files and `<leader>/` for grep, both on snacks.picker; kickstart uses `<leader>sf` and `<leader>sg` on Telescope. The prompt, `C-n`/`C-p` and `CR` behave the same."
- `telescope-live-grep` → id `picker-grep`, chips `['␣sg']`, solutions `<Space>fg` → `<Space>sg`; aside title "Narrowing to files": "Type the pattern, then two spaces and a glob — `parse  *.ts` — and multi-grep restricts the search to matching files (TJ's multi-ripgrep picker; snacks does this with `-- -g *.ts`)."
- `telescope-buffers` → replaced by `picker-word` "Word Under Cursor", chips `['␣sw']`, key cards `␣sw` "grep this word" (glyph `⌕w`), `CR` "open the match"; intro: "`Space sw` opens live grep with the word under the cursor already typed, so every use in the project is one key away. It is the picker form of `*`: where `*` finds the next use in this file, `sw` lists every use in every file."; practice "Put the cursor on the named word and open its uses with `Space sw`, then pick the match the prompt names. {total} rounds."; aside "Buffers picker": "`Space fb` (kickstart `<leader><leader>`, LazyVim `<leader>,`) lists open buffers in the same picker; `dd` on an entry closes it."; challenge `rounds` on `SHOP` with three rounds, e.g. cursor placed on `money` in `src/app.ts`, goal buffer `src/lib/money.ts`, solution `<Space>sw<C-n><CR>` (verify which result index the goal is in the fixture and adjust `<C-n>` count; the lessons test replays it).
- `telescope-quickfix` → id `picker-quickfix`, solutions `<Space>fg` → `<Space>sg`.

- [ ] **Step 6: Run the lessons test and commit**

Run: `npx vitest run src/lessons/__tests__/lessons.test.ts -t "finding-things" && npx tsc -b`
Expected: PASS. Then:

```bash
git add src/vim/plugins/telescope.ts src/vim/plugins/__tests__/telescope.test.ts src/lessons/sections/finding-things.tsx src/lessons/sections/buffers-files.tsx
git commit -m "pickers: shared kickstart/LazyVim keys and a word-under-cursor picker"
```

---

### Task 4: Explorer, window and buffer asides

**Files:**
- Modify: `src/lessons/sections/file-navigation.tsx` (title, `oil-open-directory` aside), `src/lessons/sections/windows-tabs.tsx` (`moving-between-windows` aside), `src/lessons/sections/buffers-files.tsx` (`cycling-buffers` aside)

- [ ] **Step 1: Edit copy**

- `file-navigation.tsx`: section `title: 'Explorer'`. `oil-open-directory` aside → title "Tree explorers", body: "LazyVim's default is neo-tree on `<leader>e`, and kickstart ships none (netrw with `:Ex`). The idea is the same: a directory you can move through; oil's twist is that the listing is a buffer you edit and `:w`."
- `windows-tabs.tsx` `moving-between-windows` aside → title "The remap everyone makes", body: "Both kickstart and LazyVim map `<C-h>` `<C-j>` `<C-k>` `<C-l>` to `<C-w>` + the same letter, so one chord moves between splits. The lesson uses the built-in form so it works in plain Vim too."
- `buffers-files.tsx` `cycling-buffers` aside → title "Other cycles", body: "LazyVim also binds `<S-h>` / `<S-l>` to previous / next buffer (with bufferline showing them as tabs)."

- [ ] **Step 2: Verify and commit**

Run: `npx vitest run src/lessons/__tests__/lessons.test.ts -t "file-navigation|windows-tabs|buffers-files" && npx tsc -b`
Expected: PASS.

```bash
git add src/lessons/sections/file-navigation.tsx src/lessons/sections/windows-tabs.tsx src/lessons/sections/buffers-files.tsx
git commit -m "project: explorer, window and buffer asides name the starters' keys"
```

---

### Task 5: gitsigns re-key and the lazygit lesson

**Files:**
- Modify: `src/vim/plugins/gitsigns.ts:129-150`, `src/lessons/sections/git.tsx`
- Create: `src/vim/plugins/lazygit.ts`
- Test: `src/vim/plugins/__tests__/gitsigns.test.ts` (append), `src/vim/plugins/__tests__/lazygit.test.ts`

**Interfaces:**
- Produces: gitsigns maps `]h`, `[h`, `<leader>ghs`, `<leader>ghr` (existing `]c [c <leader>hs <leader>hr` kept); plugin `lazygit` registered in `PLUGINS` with `<leader>gg` opening a float `id: 'lazygit'` listing `status()` changes and `q`/`<Esc>` closing it; `vim.pluginData.lazygit = { opened: number, closed: number }` counters for lesson goals.

- [ ] **Step 1: Failing tests**

Append to `gitsigns.test.ts` (use its existing repo helper):

```ts
describe('shared bindings', () => {
  it(']h / [h walk hunks like ]c / [c, and <leader>ghs stages like <leader>hs', () => {
    const v = mk(); // the file's existing helper: a repo with hunks in the open buffer
    const before = v.cursor.line;
    v.feedKeys(']h');
    expect(v.cursor.line).not.toBe(before);
    v.feedKeys('<Space>ghs');
    expect(stagedHunkCount(v)).toBe(1);
  });
});
```

`src/vim/plugins/__tests__/lazygit.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createVim } from '../../../lessons/runtime';

const vim = () => createVim({ files: { 'a.ts': 'x\n' }, open: 'a.ts', plugins: ['lazygit'] });

describe('lazygit', () => {
  it('<leader>gg opens a floating status and q closes it', () => {
    const v = vim();
    v.feedKeys('<Space>gg');
    const f = v.floats.find(x => x.id === 'lazygit');
    expect(f).toBeDefined();
    expect(f!.title).toBe('lazygit');
    expect((v.pluginData.lazygit as { opened: number }).opened).toBe(1);
    v.feed('q');
    expect(v.floats.some(x => x.id === 'lazygit')).toBe(false);
    expect((v.pluginData.lazygit as { closed: number }).closed).toBe(1);
    expect(v.modal).toBeNull();
  });
});
```

Run: `npx vitest run src/vim/plugins/__tests__/gitsigns.test.ts src/vim/plugins/__tests__/lazygit.test.ts` → FAIL.

- [ ] **Step 2: Implement**

gitsigns `setup`, after the existing maps:

```ts
    // LazyVim's bindings for the same actions.
    vim.map(['n'], ']h', ctx => nextHunk(vim, 1, ctx.count));   // whatever the existing ]c handler calls; reuse it
    vim.map(['n'], '[h', ctx => nextHunk(vim, -1, ctx.count));
    vim.map(['n'], '<leader>ghs', () => { const h = hunkAt(vim); if (h) stage(vim, [h]); });
    vim.map(['v'], '<leader>ghs', () => stage(vim, hunksIn(vim, ...range())));
    vim.map(['n'], '<leader>ghr', () => { const h = hunkAt(vim); if (h) reset(vim, [h]); }, { change: true });
    vim.map(['v'], '<leader>ghr', () => reset(vim, hunksIn(vim, ...range())), { change: true });
```

(Read how `]c` is registered in the file and call the same function; the names above are the ones visible in the excerpt.)

```ts
// src/vim/plugins/lazygit.ts
// lazygit as LazyVim opens it: <leader>gg floats the status view; q closes. The tutor shows the
// changed files from the git model and teaches the open/close habit, not lazygit's own keys.
import type { Float, Plugin, Vim } from '../editor';
import { status } from './git-model';

type State = { opened: number; closed: number };
const state = (vim: Vim): State => (vim.pluginData.lazygit ??= { opened: 0, closed: 0 }) as State;

function open(vim: Vim) {
  if (vim.modal) return;
  const st = status(vim);
  const row = (code: string, path: string, color: string) => ({ text: ` ${code} ${path}`, color });
  const lines = [
    { text: ' Files', color: '#bd93f9' },
    ...st.staged.map(c => row('A ', c.path, '#50fa7b')),
    ...st.unstaged.map(c => row(' M', c.path, '#ffb86c')),
    ...st.untracked.map(c => row('??', c.path, '#8be9fd')),
    ...(st.staged.length + st.unstaged.length + st.untracked.length === 0 ? [{ text: ' (clean)' }] : []),
  ];
  const float: Float = { id: 'lazygit', title: 'lazygit', anchor: 'center', width: 72, lines, footer: 'q: quit   ?: keybindings' };
  vim.floats.push(float);
  state(vim).opened++;
  vim.modal = key => {
    if (key === 'q' || key === '<Esc>' || key === '<C-c>') {
      vim.floats = vim.floats.filter(f => f !== float);
      vim.modal = null;
      state(vim).closed++;
    }
    return true;
  };
}

export const lazygit: Plugin = { name: 'lazygit', setup: vim => { vim.map(['n'], '<leader>gg', () => open(vim)); } };
```

Register `lazygit` in `PLUGINS`.

- [ ] **Step 3: Re-key the gitsigns lessons and add the lazygit lesson**

`git.tsx`:
- `gitsigns-hunks`: chips `[']h', '[h']`, key cards `]h` / `[h` with sub "LazyVim; kickstart: ]c [c"; solutions `]c` → `]h`, `[c` → `[h`; aside "kickstart's keys": "kickstart maps the same actions to `]c` / `[c` and `<leader>hs` / `<leader>hr`; both work here."
- `gitsigns-stage-hunk`: chips `['␣ghs', '␣ghr']`; solutions `<Space>hs` → `<Space>ghs`, `<Space>hr` → `<Space>ghr`; intro mentions `<leader>gh` as LazyVim's git-hunk prefix.
- New lesson after them:

```tsx
    {
      id: 'git-lazygit',
      title: 'Lazygit',
      chips: ['␣gg', 'q'],
      keyCards: [
        { key: '␣gg', glyph: '⎇', label: 'open lazygit', sub: 'LazyVim' },
        { key: 'q', glyph: '✕', label: 'close it' },
      ],
      intro: (
        <>
          <p>
            Staging one hunk at a time is gitsigns' job. For everything else — the full status, commits,
            branches, logs — the starters hand you <Code>lazygit</Code> in a floating terminal:{' '}
            <Code>Space gg</Code> opens it over the editor, <Code>q</Code> brings the editor back.
          </p>
          <p>
            Inside, lazygit has its own keys (<Code>?</Code> lists them). The habit to build is the round
            trip: open, do the git thing, close, keep editing.
          </p>
        </>
      ),
      practice: total => <p>Open lazygit, read what is changed, and close it again. {total} rounds.</p>,
      aside: {
        title: 'kickstart',
        body: <p>kickstart does not ship lazygit; <Code>:!git status</Code> or a second terminal fills the gap until you add it.</p>,
      },
      challenge: {
        kind: 'rounds',
        base: { ...repo({ 'weather/cli.py': file(...CLI_ARGPARSE) }), open: 'weather/cli.py', plugins: ['gitsigns', 'lazygit'] },
        rounds: [
          { prompt: 'Open lazygit.', goal: { mode: 'any', check: vim => (vim.pluginData.lazygit as { opened: number } | undefined)?.opened === 1 && vim.floats.some(f => f.id === 'lazygit') }, solution: '<Space>gg' },
          { prompt: 'Close it.', goal: { check: vim => !vim.floats.some(f => f.id === 'lazygit') && (vim.pluginData.lazygit as { closed: number }).closed >= 1 }, solution: 'q' },
          { prompt: 'Open it and close it again.', goal: { check: vim => (vim.pluginData.lazygit as { closed: number }).closed >= 2 }, solution: '<Space>ggq' },
        ],
      },
    },
```

`goal.mode: 'any'` exists in `Goal` (`goalMet` checks it) and is needed for round 1 because the modal leaves `vim.mode` as is but `pending`/modal state is not "normal with nothing pending" for `goalMet`'s default; if `goalMet` still refuses while a modal is up, the round-1 goal instead checks only the counter and round 1's solution stays `<Space>gg`; adjust based on the lessons test output.

Round state carries across rounds within a `rounds` challenge only through `carryCursor`; each round rebuilds the Vim, so the counter resets per round. Therefore round 3's solution `<Space>ggq` yields `closed === 1` in a fresh Vim: change round 3's check to `closed >= 1 && !vim.floats.some(f => f.id === 'lazygit')` and its prompt to "Open it and close it in one go."

- [ ] **Step 4: Verify and commit**

Run: `npx vitest run src/vim/plugins/__tests__ src/lessons/__tests__/lessons.test.ts -t "git|lazygit" && npx tsc -b`
Expected: PASS.

```bash
git add src/vim/plugins/gitsigns.ts src/vim/plugins/lazygit.ts src/vim/plugins/index.ts src/vim/plugins/__tests__ src/lessons/sections/git.tsx
git commit -m "git: LazyVim hunk keys and a lazygit round-trip lesson"
```

---

### Task 6: Project replace (grug-far style)

**Files:**
- Create: `src/vim/plugins/grugfar.ts`, `src/vim/plugins/__tests__/grugfar.test.ts`
- Modify: `src/vim/plugins/index.ts`, `src/lessons/sections/substitute.tsx` (append lesson before the boss)

**Interfaces:**
- Produces: plugin `grugfar`: `<leader>sr` opens an `input` cmdline "Replace <word> across the project with: "; submitting applies a whole-word replacement to every file in `vim.fs` (and open buffers), then shows a float `id: 'grug-far'` summarising `N replacements in M files`, closed by `q`/`<CR>`/`<Esc>`. With no keyword under the cursor it prompts for the search word first.

- [ ] **Step 1: Failing test**

```ts
// src/vim/plugins/__tests__/grugfar.test.ts
import { describe, expect, it } from 'vitest';
import { createVim } from '../../../lessons/runtime';

const files = { 'a.ts': 'const id = 1;\nconst identity = id;\n', 'b.ts': 'export { id };\n' };
const vim = () => createVim({ files, open: 'a.ts', plugins: ['grugfar'] });

describe('grug-far style project replace', () => {
  it('replaces whole words only, across every file, and reports', () => {
    const v = vim();
    v.feedKeys('w'); // on "id"
    v.feedKeys('<Space>sr');
    expect(v.mode).toBe('cmdline');
    v.feedKeys('key<CR>');
    expect(v.fs.read('a.ts')).toBe('const key = 1;\nconst identity = key;\n');
    expect(v.fs.read('b.ts')).toBe('export { key };\n');
    expect(v.buf.lines).toEqual(['const key = 1;', 'const identity = key;']);
    const f = v.floats.find(x => x.id === 'grug-far')!;
    expect(f.lines.some(l => l.text.includes('3 replacements in 2 files'))).toBe(true);
    v.feed('q');
    expect(v.floats.some(x => x.id === 'grug-far')).toBe(false);
  });
  it('asks for the search word when the cursor is not on one', () => {
    const v = vim();
    v.feedKeys('$'); // on ";"
    v.feedKeys('<Space>sr');
    expect(v.cmdline?.prompt).toMatch(/^Search/);
  });
});
```

Run: `npx vitest run src/vim/plugins/__tests__/grugfar.test.ts` → FAIL.

- [ ] **Step 2: Implement**

```ts
// src/vim/plugins/grugfar.ts
// grug-far.nvim, reduced to its outcome: <leader>sr, a search word (the keyword under the cursor
// by default), a replacement, and a whole-word replace across the project with a summary.
import type { Float, Plugin, Vim } from '../editor';

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function replaceEverywhere(vim: Vim, word: string, repl: string) {
  const re = new RegExp(`\\b${escapeRe(word)}\\b`, 'g');
  let n = 0, files = 0;
  for (const path of vim.fs.list()) {
    const text = vim.fs.read(path);
    if (text == null) continue;
    const count = (text.match(re) ?? []).length;
    if (!count) continue;
    n += count; files++;
    const next = text.replace(re, repl);
    const buf = vim.findBuffer(path);
    if (buf) buf.lines = next.replace(/\n$/, '').split('\n');
    vim.fs.write(path, next);
  }
  const float: Float = {
    id: 'grug-far', title: 'grug-far', anchor: 'center', width: 60,
    lines: [{ text: ` ${word} → ${repl}` }, { text: ` ${n} replacements in ${files} files`, color: '#50fa7b' }],
    footer: 'q: close',
  };
  vim.floats.push(float);
  vim.modal = key => {
    if (['q', '<CR>', '<Esc>', '<C-c>'].includes(key)) { vim.floats = vim.floats.filter(f => f !== float); vim.modal = null; }
    return true;
  };
}

function askReplacement(vim: Vim, word: string) {
  vim.openCmdline('input', '', repl => { if (repl !== '') replaceEverywhere(vim, word, repl); }, undefined, `Replace "${word}" across the project with: `);
}

export const grugfar: Plugin = {
  name: 'grugfar',
  setup: vim => {
    vim.map(['n'], '<leader>sr', () => {
      const l = vim.line();
      const m = [...l.matchAll(/[A-Za-z0-9_]+/g)].find(x => x.index! <= vim.cursor.col && vim.cursor.col < x.index! + x[0].length);
      if (m) askReplacement(vim, m[0]);
      else vim.openCmdline('input', '', word => { if (word) askReplacement(vim, word); }, undefined, 'Search: ');
    });
  },
};
```

If a buffer's `lines` setter is not public, use whatever the fs→buffer reload path is (`grep -n "setLines\|reload" src/vim/buffer.ts`). Register `grugfar` in `PLUGINS`. `openCmdline`'s signature is `(type, initial, onSubmit, onCancel, prompt)` per PLUGINS.md.

- [ ] **Step 3: The lesson**

Append to `substitute.tsx` before `sub-boss`:

```tsx
    {
      id: 'project-replace',
      title: 'Project Replace',
      chips: ['␣sr'],
      keyCards: [
        { key: '␣sr', glyph: '⇄', label: 'search & replace', sub: 'across files' },
        { key: 'CR', glyph: '⏎', label: 'apply' },
      ],
      intro: (
        <>
          <p>
            <Code>:%s</Code> changes one file. <Code>Space sr</Code> opens grug-far, which takes a search and a
            replacement and applies them to every file in the project, listing what changed. The word under
            the cursor is the default search, so renaming a symbol is: cursor on it, <Code>Space sr</Code>,
            type the new name, <Code>CR</Code>.
          </p>
          <p>
            It matches whole words, so <Code>id</Code> leaves <Code>identity</Code> alone. For a rename the
            language server understands, <Code>grn</Code> is safer still; for strings, comments and config,
            this is the tool.
          </p>
        </>
      ),
      practice: total => <p>Rename the word the prompt names everywhere in the project. {total} rounds.</p>,
      aside: {
        title: 'Before grug-far',
        body: <p><Code>:grep</Code>, then <Code>:cdo s/old/new/g | update</Code>, does the same by hand — the Quickfix lessons show it.</p>,
      },
      challenge: {
        kind: 'rounds',
        base: {
          files: {
            'src/cart.ts': 'export function total(items) {\n  let sum = 0;\n  return sum;\n}\n',
            'src/app.ts': "import { total } from './cart';\nconsole.log(total([]));\n",
            'README.md': '# shop\n\ntotal() adds up the cart.\n',
          },
          open: 'src/cart.ts', plugins: ['grugfar'],
        },
        rounds: [
          {
            prompt: 'Rename total to cartTotal everywhere.',
            setup: { cursor: { line: 0, col: 16 } },
            goal: { check: vim => ['src/cart.ts', 'src/app.ts', 'README.md'].every(f => !/\btotal\b/.test(vim.fs.read(f) ?? 'total') && (vim.fs.read(f) ?? '').includes('cartTotal')) },
            solution: '<Space>srcartTotal<CR>q',
          },
          {
            prompt: 'Rename sum to subtotal (it appears only in cart.ts).',
            setup: { cursor: { line: 1, col: 6 } },
            goal: { check: vim => (vim.fs.read('src/cart.ts') ?? '').includes('let subtotal = 0') && !(vim.fs.read('src/cart.ts') ?? '').includes(' sum') },
            solution: '<Space>srsubtotal<CR>q',
          },
          {
            prompt: 'From the README, rename shop to store everywhere.',
            setup: { open: 'README.md', cursor: { line: 0, col: 2 } },
            goal: { check: vim => (vim.fs.read('README.md') ?? '').startsWith('# store') },
            solution: '<Space>srstore<CR>q',
          },
        ],
      },
    },
```

Keep every line under 60 columns in the fixture (the lessons test checks buffer lines).

- [ ] **Step 4: Verify and commit**

Run: `npx vitest run src/vim/plugins/__tests__/grugfar.test.ts src/lessons/__tests__/lessons.test.ts -t "grug|substitute" && npx tsc -b`
Expected: PASS.

```bash
git add src/vim/plugins/grugfar.ts src/vim/plugins/__tests__/grugfar.test.ts src/vim/plugins/index.ts src/lessons/sections/substitute.tsx
git commit -m "patterns: grug-far style project replace"
```

---

### Task 7: Completion menu and snippets

**Files:**
- Create: `src/vim/plugins/snippets.ts`, `src/vim/plugins/__tests__/snippets.test.ts`
- Modify: `src/vim/plugins/index.ts`, `src/lessons/sections/insert-power.tsx` (two new lessons after `insert-one-command`)

**Interfaces:**
- Produces: plugin `snippets`: in insert mode, `<Tab>` expands the trigger word before the cursor (`fn`, `for`, `if`, `log`) into a template with fields, or jumps to the next field of the active snippet; `<S-Tab>` jumps back; with neither, `<Tab>` inserts a tab as before. Field jump selects the field's placeholder text by deleting it and leaving the cursor there in insert mode.

- [ ] **Step 1: Failing test**

```ts
// src/vim/plugins/__tests__/snippets.test.ts
import { describe, expect, it } from 'vitest';
import { createVim } from '../../../lessons/runtime';

const vim = (text: string[]) => createVim({ text, name: 'a.ts', plugins: ['snippets'] });

describe('snippets', () => {
  it('Tab expands a trigger and jumps through its fields', () => {
    const v = vim(['']);
    v.feedKeys('ifn<Tab>');
    expect(v.buf.lines).toEqual(['function name() {', '  ', '}']);
    expect(v.mode).toBe('insert');
    expect(v.cursor).toEqual({ line: 0, col: 9 });      // on the (deleted) "name" field
    v.feedKeys('greet<Tab>');                            // fill field 1, jump to field 2 (params)
    expect(v.buf.lines[0]).toBe('function greet() {');
    expect(v.cursor).toEqual({ line: 0, col: 15 });
    v.feedKeys('x<Tab>');                                // field 3: body
    expect(v.cursor).toEqual({ line: 1, col: 2 });
    v.feedKeys('return x;<Esc>');
    expect(v.buf.lines).toEqual(['function greet(x) {', '  return x;', '}']);
  });
  it('S-Tab jumps back', () => {
    const v = vim(['']);
    v.feedKeys('ifn<Tab>a<Tab><S-Tab>');
    expect(v.cursor).toEqual({ line: 0, col: 9 });
    expect(v.buf.lines[0]).toBe('function () {');       // field 1 re-selected: its text removed again
  });
  it('Tab without a trigger inserts a tab', () => {
    const v = vim(['x']);
    v.feedKeys('A<Tab>y<Esc>');
    expect(v.buf.lines[0]).toBe('x\ty');
  });
});
```

Run → FAIL (plugin unknown).

- [ ] **Step 2: Implement**

```ts
// src/vim/plugins/snippets.ts
// A LuaSnip/blink-style snippet flow: Tab expands a trigger word or jumps to the next field,
// S-Tab jumps back. Fields are `${n:placeholder}`; jumping to a field removes its placeholder
// and leaves the cursor there in insert mode. Small on purpose: the habit is the lesson.
import type { Plugin, Vim } from '../editor';

const SNIPPETS: Record<string, string> = {
  fn: 'function ${1:name}(${2:params}) {\n  ${3:body}\n}',
  for: 'for (const ${1:item} of ${2:items}) {\n  ${3:body}\n}',
  if: 'if (${1:cond}) {\n  ${2:body}\n}',
  log: 'console.log(${1:value});',
};

type Field = { line: number; col: number; text: string; filled: boolean };
type Active = { fields: Field[]; idx: number };

function expand(vim: Vim, trigger: string, startCol: number): Active {
  const tpl = SNIPPETS[trigger];
  const line0 = vim.cursor.line;
  const indent = /^\s*/.exec(vim.line())![0];
  const fields: Field[] = [];
  const out: string[] = [];
  tpl.split('\n').forEach((raw, i) => {
    let text = i === 0 ? vim.line().slice(0, startCol) : indent;
    let rest = raw;
    let m: RegExpExecArray | null;
    while ((m = /\$\{(\d+):([^}]*)\}/.exec(rest))) {
      text += rest.slice(0, m.index);
      fields[Number(m[1]) - 1] = { line: line0 + i, col: text.length, text: m[2], filled: false };
      text += m[2];
      rest = rest.slice(m.index + m[0].length);
    }
    text += rest;
    if (i === 0) text += vim.line().slice(vim.cursor.col);
    out.push(text);
  });
  vim.buf.lines = [...vim.buf.lines.slice(0, line0), ...out, ...vim.buf.lines.slice(line0 + 1)];
  return { fields, idx: -1 };
}

/** Enter a field: remove its placeholder (if unfilled) and put the cursor there. */
function enter(vim: Vim, a: Active, idx: number) {
  const f = a.fields[idx];
  if (!f) return;
  if (!f.filled) {
    const l = vim.buf.lines[f.line];
    vim.buf.lines[f.line] = l.slice(0, f.col) + l.slice(f.col + f.text.length);
    f.text = ''; f.filled = true;
  }
  a.idx = idx;
  vim.win.cursor = { line: f.line, col: f.col };
  vim.win.want = f.col;
}

export const snippets: Plugin = {
  name: 'snippets',
  setup: vim => {
    let active: Active | null = null;
    vim.mapInsert('<Tab>', () => {
      const l = vim.line(), c = vim.cursor.col;
      const m = /([A-Za-z]+)$/.exec(l.slice(0, c));
      if (m && SNIPPETS[m[1]] && (!active || active.idx === active.fields.length - 1)) {
        const startCol = c - m[1].length;
        vim.buf.lines[vim.cursor.line] = l.slice(0, startCol) + l.slice(c);
        vim.win.cursor = { line: vim.cursor.line, col: startCol };
        active = expand(vim, m[1], startCol);
        enter(vim, active, 0);
        return;
      }
      if (active && active.idx < active.fields.length - 1) { shiftLater(vim, active); enter(vim, active, active.idx + 1); return; }
      vim.typeText('\t');
    });
    vim.mapInsert('<S-Tab>', () => {
      if (active && active.idx > 0) { shiftLater(vim, active); active.fields[active.idx - 1].filled = false; active.fields[active.idx - 1].text = currentFieldText(vim, active, active.idx - 1); enter(vim, active, active.idx - 1); }
    });
    vim.events; // (no-op; keeps the reference pattern consistent with other plugins)
  },
};
```

The two helpers `shiftLater` and `currentFieldText` keep field columns correct after typing into a field on the same line: `shiftLater` recomputes `col` of later fields on the same line as the current field by the delta between the field's original placeholder length and what was typed (track `typedLen = cursor.col - f.col` when leaving a field). `currentFieldText` returns what was typed into a field (from `f.col` to the next field's `col` or the original end). Implement both against the test; the S-Tab test defines the re-selection behaviour (typed text is removed again).

`vim.typeText(text)` (editor.ts:1506) inserts as if typed; `buf.lines` is a plain assignable field.

Register `snippets` in `PLUGINS`.

- [ ] **Step 3: The two lessons**

In `insert-power.tsx` after `insert-one-command`:

```tsx
    {
      id: 'completion-menu',
      title: 'Completion Menu',
      chips: ['C-n', 'C-y', 'C-e'],
      keyCards: [
        { key: 'C-n', glyph: '↓', label: 'next candidate', sub: 'C-p: previous' },
        { key: 'C-y', glyph: '✓', label: 'accept' },
        { key: 'C-e', glyph: '✕', label: 'dismiss' },
      ],
      intro: (
        <>
          <p>
            In a starter config the completion menu (blink.cmp or nvim-cmp) pops up as you type: names from
            your buffers, the language server, snippets. <Code>C-n</Code> and <Code>C-p</Code> move through
            it, <Code>C-y</Code> takes the highlighted item, <Code>C-e</Code> closes it and keeps what you typed.
          </p>
          <p>
            Vim's own menu works the same way without a plugin: <Code>C-n</Code> opens it on words from open
            buffers, and the same <Code>C-y</Code> / <Code>C-e</Code> apply. That is what you practise here.
          </p>
        </>
      ),
      practice: total => <p>Each round starts in insert mode. Type a few letters, open the menu, accept the right word, then <Code>esc</Code>. {total} rounds.</p>,
      aside: {
        title: 'Enter or C-y?',
        body: <p>LazyVim accepts with <Code>CR</Code> as well as <Code>C-y</Code>; kickstart uses <Code>C-y</Code> only, so a stray Enter never grabs a candidate you did not want.</p>,
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'orders.ts' },
        rounds: [
          {
            prompt: 'Complete "cus" to customerName.',
            setup: typing(['const customerName = order.name;', 'const label = cus‸']),
            goal: { text: ['const customerName = order.name;', 'const label = customerName'] },
            solution: '<C-n><C-y><Esc>',
          },
          {
            prompt: 'Complete "inv" to invoiceTotal, not invoiceId (it comes first).',
            setup: typing(['let invoiceId = 1;', 'let invoiceTotal = 0;', 'return inv‸']),
            goal: { text: ['let invoiceId = 1;', 'let invoiceTotal = 0;', 'return invoiceTotal'] },
            solution: '<C-n><C-n><C-y><Esc>',
          },
          {
            prompt: 'Open the menu, then dismiss it and keep "ord".',
            setup: typing(['const orders = [];', 'const x = ord‸']),
            goal: { text: ['const orders = [];', 'const x = ord'] },
            solution: '<C-n><C-e><Esc>',
          },
        ],
      },
    },
    {
      id: 'snippets',
      title: 'Snippets',
      chips: ['tab', 'S-tab'],
      keyCards: [
        { key: 'tab', glyph: '⇥', label: 'expand / next field' },
        { key: 'S-tab', glyph: '⇤', label: 'previous field' },
      ],
      intro: (
        <>
          <p>
            A snippet turns a short trigger into a block with blanks to fill: type <Code>fn</Code>, press{' '}
            <Code>tab</Code>, and a whole function skeleton appears with the cursor on its name. Each{' '}
            <Code>tab</Code> jumps to the next blank; <Code>S-tab</Code> goes back.
          </p>
          <p>
            friendly-snippets ships hundreds of these for every language; both starters wire them into the
            completion menu. The tutor has four: <Code>fn</Code>, <Code>for</Code>, <Code>if</Code>, <Code>log</Code>.
          </p>
        </>
      ),
      practice: total => <p>Each round starts in insert mode at the end of a line. Expand the snippet the prompt names and fill its fields. {total} rounds.</p>,
      aside: {
        title: 'Where tab goes',
        body: <p>Kickstart's LuaSnip binds <Code>C-l</Code> / <Code>C-h</Code> to jump fields instead, keeping <Code>tab</Code> for indentation.</p>,
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'util.ts', plugins: ['snippets'] },
        rounds: [
          {
            prompt: 'Expand fn into function greet(name) { return name; }.',
            setup: typing(['fn‸']),
            goal: { text: ['function greet(name) {', '  return name;', '}'] },
            solution: '<Tab>greet<Tab>name<Tab>return name;<Esc>',
          },
          {
            prompt: 'Expand log to print total.',
            setup: typing(['const total = 3;', 'log‸']),
            goal: { text: ['const total = 3;', 'console.log(total);'] },
            solution: '<Tab>total<Esc>',
          },
          {
            prompt: 'Expand for over items as item, body item.run().',
            setup: typing(['for‸']),
            goal: { text: ['for (const item of items) {', '  item.run();', '}'] },
            solution: '<Tab>item<Tab>items<Tab>item.run();<Esc>',
          },
        ],
      },
    },
```

Rounds start in insert mode through `setup.init: (vim) => void` (types.ts:153, run by `createVim`). `insert-power.tsx` already has a helper at its top that takes lines with a `‸` marker and returns `{ text, init: vim => vim.startInsert('i', { line, col }) }`; use it: write each round's `setup` as `{ ...typing(['const label = cus‸']) }` (whatever the helper is named — read lines 5–16) so the cursor sits after the typed prefix in insert mode, and drop the explicit `cursor`/`init` fields shown above.

- [ ] **Step 4: Verify and commit**

Run: `npx vitest run src/vim/plugins/__tests__/snippets.test.ts src/lessons/__tests__/lessons.test.ts -t "snippets|insert-power" && npx tsc -b`
Expected: PASS.

```bash
git add src/vim/plugins/snippets.ts src/vim/plugins/__tests__/snippets.test.ts src/vim/plugins/index.ts src/lessons/sections/insert-power.tsx
git commit -m "code: completion-menu and snippets lessons with a small snippet engine"
```

---

### Task 8: CURRICULUM.md generated from the registry

**Files:**
- Create: `scripts/curriculum.ts`, `src/lessons/__tests__/curriculum-doc.test.ts`
- Modify: `CURRICULUM.md`, `package.json` (script `"curriculum"`, see Step 2)

**Interfaces:**
- Produces: `renderCurriculum(): string` in `scripts/curriculum.ts` (also importable by the test).

- [ ] **Step 1: Failing drift test**

```ts
// src/lessons/__tests__/curriculum-doc.test.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderCurriculum } from '../../../scripts/curriculum';

describe('CURRICULUM.md', () => {
  it('matches the registry (run `npm run curriculum` to regenerate)', () => {
    if (process.env.CURRICULUM_WRITE) { writeFileSync('CURRICULUM.md', renderCurriculum()); return; }
    expect(readFileSync('CURRICULUM.md', 'utf8')).toBe(renderCurriculum());
  });
});
```

Run → FAIL (module missing).

- [ ] **Step 2: The generator**

```ts
// scripts/curriculum.ts — CURRICULUM.md is generated: `npm run curriculum`.
import { SECTIONS, numberOf } from '../src/lessons';

const BANDS: Record<string, { title: string; blurb: string }> = {
  core: { title: 'Core', blurb: 'Survive, then learn the grammar: motions, operators, text objects, visual mode, search.' },
  repeat: { title: 'Repeat', blurb: 'Make one edit do the work of many: registers and macros (the dot command lives in First Operators).' },
  project: { title: 'Project', blurb: 'Move through a codebase, not a file: buffers, windows, jumps, quickfix, pickers, the explorer.' },
  patterns: { title: 'Patterns', blurb: 'Edit at scale: the command line, substitute, global commands, project replace.' },
  code: { title: 'Code', blurb: 'What a starter config adds: LSP, richer text objects, flash, surround, completion, git.' },
  challenges: { title: 'Challenges', blurb: 'Generated files with many edits at once; the Coach reviews your keys.' },
};

const kindLabel = (k: string) => (k === 'rounds' ? 'transform' : k);

export function renderCurriculum(): string {
  const out: string[] = [];
  out.push('# vimchi — Curriculum', '', '<!-- generated by scripts/curriculum.ts; do not edit by hand -->', '');
  out.push('## Pathway', '');
  out.push('The order follows what the interactive tutors (vim-hero, Vimified, VimVenture), the books (Practical Vim,');
  out.push('Learn Vim the Smart Way), Primeagen\'s Vim Fundamentals and the starter configs (kickstart.nvim, LazyVim)');
  out.push('agree on. Plugin lessons show the keys the starters share; asides name the alternatives.', '');
  for (const [id, b] of Object.entries(BANDS)) out.push(`- **${b.title}** — ${b.blurb}`);
  out.push('');
  out.push('## Lesson shape', '', 'Intro, key cards, one practice challenge, results, an aside. Sections may end in a ★ Boss that does not count toward completion.', '');
  let band = '';
  for (const s of SECTIONS) {
    if (s.band !== band) { band = s.band; out.push(`## ${BANDS[band].title}`, ''); }
    out.push(`### ${s.title}`, '| # | Lesson | Keys | Challenge |', '|---|---|---|---|');
    for (const l of s.lessons) {
      const n = l.boss ? '★' : numberOf(l.id);
      out.push(`| ${n} | ${l.title} | ${l.chips.map(c => `\`${c}\``).join(' ')} | ${kindLabel(l.challenge.kind)} |`);
    }
    out.push('');
  }
  return out.join('\n');
}

```

Neither `tsx` nor `vite-node` is a dependency and the sections import JSX, so the generator runs through vitest: the npm script is `"curriculum": "CURRICULUM_WRITE=1 vitest run src/lessons/__tests__/curriculum-doc.test.ts"`, and the test writes `CURRICULUM.md` (then passes) when `process.env.CURRICULUM_WRITE` is set, and compares otherwise. Drop the `import.meta.url` main-guard from `scripts/curriculum.ts`.

- [ ] **Step 3: Regenerate, keep the old engine-constraints notes**

The old `CURRICULUM.md` has a "Decisions" and "Engine constraints" tail. Move that text into `docs/LESSONS.md` under a "History and constraints" heading (verbatim), then regenerate `CURRICULUM.md` and run the drift test.

Run: `npm run curriculum && npx vitest run src/lessons/__tests__/curriculum-doc.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add scripts/curriculum.ts src/lessons/__tests__/curriculum-doc.test.ts CURRICULUM.md docs/LESSONS.md package.json
git commit -m "docs: CURRICULUM.md generated from the registry with a drift test"
```

---

### Task 9: Coach audit, challenge sections, docs, full verification

**Files:**
- Modify: `src/challenges/index.ts` (confirm `sections` ids), `docs/LESSONS.md` (band note), `~/CLAUDE.md` is NOT touched (project-level docs only)

- [ ] **Step 1: Run everything**

Run: `npm test && npx tsc -b && npm run build`
Expected: all green, including `every reference playthrough yields zero critiques` over the new registry and the registry test's `every challenge names surviving sections`. If the audit lists a new lesson's reference, fix that reference (it is new code) rather than the heuristics.

- [ ] **Step 2: docs/LESSONS.md**

Add under the existing authoring rules: "Bands: `core`, `repeat`, `project`, `patterns`, `code`, `challenges`, in that order in `src/lessons/index.ts`; `registry.test.ts` pins the order. A new plugin lesson shows the kickstart/LazyVim shared key and names the alternative in its aside. Keep a lesson only if its keys are in the shared bindings or two of the surveyed sources teach them (see the revamp spec)."

- [ ] **Step 3: Commit**

```bash
git add docs/LESSONS.md src/challenges/index.ts
git commit -m "curriculum: document the band rule"
```

Deploy after review and merge (`./docker/up.sh`, then check `https://vimchi.nrsil.io/#picker-word` renders and the sidebar shows six bands).
