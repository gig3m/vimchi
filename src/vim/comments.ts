// Comment leaders, as Vim's 'comments' option describes them, for 'formatoptions' r/o (a new line
// continues the comment) and j (J drops the joined line's leader). The values are what Neovim's
// own ftplugins set (0.12), checked with :set comments? in each filetype.

/** 'comments' per filetype; others take Neovim's global default. */
export const FT_COMMENTS: Record<string, string> = {
  typescript: 's1:/*,mb:*,ex:*/,://',
  javascript: 's1:/*,mb:*,ex:*/,://',
  go: 's1:/*,mb:*,ex:*/,://',
  rust: 's1:/*,mb:*,ex:*/,:///,://',
  c: 's1:/*,mb:*,ex:*/,:///,://',
  css: 's1:/*,mb:*,ex:*/',
  json: '',
  lua: ':---,:--',
  python: 'b:#,fb:-',
  sh: 'b:#',
  ruby: 'b:#',
  yaml: ':#',
  toml: ':#',
  vim: ':"\\ ,:"',
  markdown: 'fb:*,fb:-,fb:+,n:>',
  text: 'fb:-,fb:*,n:>',
};
/**
 * 'formatoptions' in plain Neovim (its own ftplugins over the default tcqj), to tell where a
 * continued comment is LazyVim's doing: Neovim already continues // and -- in code files.
 */
export const PLAIN_FO: Record<string, string> = {
  typescript: 'jcroql', javascript: 'jcroql', lua: 'jcroql', sh: 'jcroql', c: 'jcroql', css: 'jcroql',
  yaml: 'jcroql', ruby: 'jcroql', vim: 'jcroql', rust: 'croqnlj', go: 'cqj', json: 'cqj', markdown: 'jtcqln',
};
export const plainFo = (filetype: string) => PLAIN_FO[filetype] ?? 'tcqj';

export const DEFAULT_COMMENTS = 's1:/*,mb:*,ex:*/,://,b:#,:%,:XCOMM,n:>,fb:-';

type Part = { flags: string; str: string; offset: number };

function parse(comments: string): Part[] {
  const out: Part[] = [];
  // Items are comma-separated; a backslash escapes a comma or space in the string.
  for (const item of comments.match(/(?:\\.|[^,])+/g) ?? []) {
    const i = item.indexOf(':');
    if (i < 0) continue;
    const flags = item.slice(0, i), str = item.slice(i + 1).replace(/\\(.)/g, '$1');
    if (!str) continue;
    out.push({ flags, str, offset: Number(/\d+/.exec(flags)?.[0] ?? 0) });
  }
  return out;
}

export type Leader = {
  /** Indent before the leader. */
  indent: string;
  /** The leader as the line has it, and the blanks after it. */
  str: string;
  ws: string;
  /** Start, middle or end of a three-part comment, or '' for a plain one. */
  part: 's' | 'm' | 'e' | '';
  /** 'f': only the first line has it; the next is indented to line up instead. */
  first: boolean;
};

/** The comment leader at the start of `line` (after its indent), or null. */
export function leaderOf(line: string, comments: string): Leader | null {
  const indent = /^[ \t]*/.exec(line)![0];
  const rest = line.slice(indent.length);
  for (const p of parse(comments)) {
    if (!rest.startsWith(p.str)) continue;
    const after = rest.slice(p.str.length);
    // 'b': the leader needs a blank (or the line's end) after it ("#" but not "#include").
    if (p.flags.includes('b') && after && !/^[ \t]/.test(after)) continue;
    const ws = /^[ \t]*/.exec(after)![0];
    const part = p.flags.includes('s') ? 's' : p.flags.includes('m') ? 'm' : p.flags.includes('e') ? 'e' : '';
    return { indent, str: p.str, ws, part, first: p.flags.includes('f') };
  }
  return null;
}

/**
 * What a new line opened from `line` starts with, to continue its comment ('formatoptions' r, o),
 * or null when it doesn't continue one: no leader, an end part, or a /* comment closed on the line.
 */
export function continuation(line: string, comments: string): string | null {
  const l = leaderOf(line, comments);
  if (!l || l.part === 'e') return null;
  if (l.first) return l.indent + ' '.repeat(l.str.length + l.ws.length);
  if (l.part === 's') {
    const parts = parse(comments);
    const at = parts.findIndex(p => p.str === l.str && p.flags.includes('s'));
    const mid = parts[at + 1];
    const end = parts[at + 2];
    if (!mid || !mid.flags.includes('m')) return null;
    if (end && line.slice(l.indent.length + l.str.length).includes(end.str)) return null;
    return l.indent + ' '.repeat(parts[at].offset) + mid.str + ' ';
  }
  return l.indent + l.str + l.ws;
}

/**
 * A line joined onto a comment line, without its leader ('formatoptions' j): J drops the leader
 * and the blanks around it, gJ only the leader. Lines that aren't comments are left alone.
 */
export function dropLeader(line: string, comments: string, spaces: boolean): string {
  const l = leaderOf(line, comments);
  if (!l || l.part === 'e' || l.part === 's') return line;
  const after = line.slice(l.indent.length + l.str.length);
  return spaces ? after.replace(/^[ \t]+/, '') : after;
}
