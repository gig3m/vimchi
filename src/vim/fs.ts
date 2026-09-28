// A tiny in-memory file system for lesson projects.

export class VirtualFS {
  private files = new Map<string, string>();

  constructor(files: Record<string, string> = {}) {
    for (const [p, t] of Object.entries(files)) this.files.set(norm(p), t);
  }

  read(path: string): string | null {
    return this.files.get(norm(path)) ?? null;
  }

  write(path: string, text: string) {
    this.files.set(norm(path), text);
  }

  exists(path: string) {
    return this.files.has(norm(path)) || this.isDir(path);
  }

  remove(path: string) {
    const p = norm(path);
    this.files.delete(p);
    for (const k of [...this.files.keys()]) if (k.startsWith(p + '/')) this.files.delete(k);
  }

  rename(from: string, to: string) {
    const a = norm(from), b = norm(to);
    if (this.files.has(a)) {
      this.files.set(b, this.files.get(a)!);
      this.files.delete(a);
      return;
    }
    for (const k of [...this.files.keys()]) {
      if (k.startsWith(a + '/')) {
        this.files.set(b + k.slice(a.length), this.files.get(k)!);
        this.files.delete(k);
      }
    }
  }

  isDir(path: string) {
    const p = norm(path);
    if (p === '') return true;
    for (const k of this.files.keys()) if (k.startsWith(p + '/')) return true;
    return false;
  }

  /** All file paths, sorted. */
  list(): string[] {
    return [...this.files.keys()].sort();
  }

  /** Direct children of a directory: names, with "/" suffix for directories. */
  readdir(dir: string): string[] {
    const d = norm(dir);
    const prefix = d ? d + '/' : '';
    const out = new Set<string>();
    for (const k of this.files.keys()) {
      if (!k.startsWith(prefix)) continue;
      const rest = k.slice(prefix.length);
      const slash = rest.indexOf('/');
      out.add(slash < 0 ? rest : rest.slice(0, slash + 1));
    }
    return [...out].sort((a, b) => (a.endsWith('/') === b.endsWith('/') ? a.localeCompare(b) : a.endsWith('/') ? -1 : 1));
  }

  snapshot(): Record<string, string> {
    return Object.fromEntries(this.files);
  }
}

export function norm(p: string) {
  const parts: string[] = [];
  for (const seg of p.replace(/\\/g, '/').split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') parts.pop();
    else parts.push(seg);
  }
  return parts.join('/');
}

export const dirname = (p: string) => {
  const n = norm(p);
  const i = n.lastIndexOf('/');
  return i < 0 ? '' : n.slice(0, i);
};

export const basename = (p: string) => {
  const n = norm(p);
  return n.slice(n.lastIndexOf('/') + 1);
};
