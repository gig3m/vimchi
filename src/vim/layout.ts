// Windows, tab pages and the split layout tree.

import type { Buffer } from './buffer';
import type { Pos } from './types';

export type Fold = { start: number; end: number; closed: boolean };

let nextWinId = 1000;

export class Window {
  readonly id = nextWinId++;
  buf: Buffer;
  cursor: Pos = { line: 0, col: 0 };
  /** Column j/k aim for; Infinity after $. */
  want = 0;
  /** First visible buffer line. */
  top = 0;
  /** Laid-out size in rows/cols, set by the layout pass. */
  height = 20;
  width = 80;
  folds: Fold[] = [];
  jumplist: { buf: Buffer; pos: Pos }[] = [];
  jumpIdx = 0;
  /** Alternate buffer for <C-^>. */
  alt: Buffer | null = null;
  /** Per-window location list. */
  loclist: { items: QfItem[]; idx: number } | null = null;
  /** Per-window options overriding the globals. */
  opts: Record<string, boolean | number> = {};
  /** Remembered cursor per buffer, restored when switching back. */
  lastPos = new Map<number, Pos>();

  constructor(buf: Buffer) {
    this.buf = buf;
  }
}

export type QfItem = { file: string; line: number; col: number; text: string };

export type LayoutNode =
  | { type: 'leaf'; win: Window; size: number }
  | { type: 'row' | 'col'; children: LayoutNode[]; size: number };

export class Tab {
  root: LayoutNode;
  cur: Window;
  prev: Window | null = null;

  constructor(win: Window) {
    this.root = { type: 'leaf', win, size: 1 };
    this.cur = win;
  }

  windows(): Window[] {
    const out: Window[] = [];
    const walk = (n: LayoutNode) => (n.type === 'leaf' ? out.push(n.win) : n.children.forEach(walk));
    walk(this.root);
    return out;
  }

  private parentOf(win: Window): { parent: Extract<LayoutNode, { type: 'row' | 'col' }> | null; node: LayoutNode; index: number } | null {
    const find = (n: LayoutNode, parent: Extract<LayoutNode, { type: 'row' | 'col' }> | null, index: number): ReturnType<Tab['parentOf']> => {
      if (n.type === 'leaf') return n.win === win ? { parent, node: n, index } : null;
      for (let i = 0; i < n.children.length; i++) {
        const r = find(n.children[i], n, i);
        if (r) return r;
      }
      return null;
    };
    return find(this.root, null, 0);
  }

  /** Split `win`. 'col' stacks windows vertically (:split), 'row' side by side (:vsplit). */
  split(win: Window, newWin: Window, dir: 'row' | 'col', after = false) {
    const loc = this.parentOf(win)!;
    const leaf: LayoutNode = { type: 'leaf', win: newWin, size: 1 };
    if (loc.parent && loc.parent.type === dir) {
      loc.parent.children.splice(loc.index + (after ? 1 : 0), 0, leaf);
      equalize(loc.parent);
    } else {
      const old = loc.node;
      const container: LayoutNode = { type: dir, children: after ? [old, leaf] : [leaf, old], size: old.size };
      old.size = 1;
      if (!loc.parent) this.root = container;
      else loc.parent.children[loc.index] = container;
    }
  }

  close(win: Window): boolean {
    const loc = this.parentOf(win);
    if (!loc || !loc.parent) return false;
    loc.parent.children.splice(loc.index, 1);
    if (loc.parent.children.length === 1) {
      const only = loc.parent.children[0];
      only.size = loc.parent.size;
      const up = this.parentOfNode(loc.parent);
      if (!up) this.root = only;
      else up.parent.children[up.index] = only;
    } else equalize(loc.parent);
    return true;
  }

  private parentOfNode(target: LayoutNode): { parent: Extract<LayoutNode, { type: 'row' | 'col' }>; index: number } | null {
    const find = (n: LayoutNode): ReturnType<Tab['parentOfNode']> => {
      if (n.type === 'leaf') return null;
      for (let i = 0; i < n.children.length; i++) {
        if (n.children[i] === target) return { parent: n, index: i };
        const r = find(n.children[i]);
        if (r) return r;
      }
      return null;
    };
    return find(this.root);
  }

  only(win: Window) {
    this.root = { type: 'leaf', win, size: 1 };
    this.cur = win;
  }

  equalizeAll() {
    const walk = (n: LayoutNode) => {
      if (n.type === 'leaf') return;
      equalize(n);
      n.children.forEach(walk);
    };
    walk(this.root);
  }

  /** Give `win` as much room as possible in the given direction. */
  maximize(win: Window, dir: 'row' | 'col') {
    let node: LayoutNode = this.parentOf(win)!.node;
    for (;;) {
      const up = this.parentOfNode(node);
      if (!up) break;
      if (up.parent.type === dir) {
        up.parent.children.forEach(c => (c.size = c === node ? 1000 : 1));
      }
      node = up.parent;
    }
  }

  resize(win: Window, dir: 'row' | 'col', delta: number) {
    let node: LayoutNode = this.parentOf(win)!.node;
    for (;;) {
      const up = this.parentOfNode(node);
      if (!up) return;
      if (up.parent.type === dir) {
        node.size = Math.max(0.2, node.size * (1 + delta * 0.15));
        return;
      }
      node = up.parent;
    }
  }

  /** Move `win` to the far edge: H J K L. */
  moveToEdge(win: Window, edge: 'H' | 'J' | 'K' | 'L') {
    if (this.windows().length < 2) return;
    this.close(win);
    const dir = edge === 'H' || edge === 'L' ? 'row' : 'col';
    const leaf: LayoutNode = { type: 'leaf', win, size: 1 };
    const first = edge === 'H' || edge === 'K';
    if (this.root.type === dir) {
      if (first) this.root.children.unshift(leaf);
      else this.root.children.push(leaf);
      equalize(this.root);
    } else {
      const old = this.root;
      old.size = 1;
      this.root = { type: dir, children: first ? [leaf, old] : [old, leaf], size: 1 };
    }
  }

  /** Rectangles for every window, in abstract units (rows × cols). */
  rects(rows: number, cols: number): Map<Window, { top: number; left: number; height: number; width: number }> {
    const out = new Map<Window, { top: number; left: number; height: number; width: number }>();
    const walk = (n: LayoutNode, top: number, left: number, h: number, w: number) => {
      if (n.type === 'leaf') {
        out.set(n.win, { top, left, height: h, width: w });
        n.win.height = Math.max(1, h - 1); // minus the status line
        n.win.width = w;
        return;
      }
      const total = n.children.reduce((a, c) => a + c.size, 0);
      const span = n.type === 'col' ? h : w;
      const gaps = n.children.length - 1;
      let off = 0;
      n.children.forEach((c, i) => {
        const isLast = i === n.children.length - 1;
        const len = isLast ? span - gaps - off : Math.max(1, Math.round(((span - gaps) * c.size) / total));
        if (n.type === 'col') walk(c, top + off, left, len, w);
        else walk(c, top, left + off, h, len);
        off += len + 1;
      });
    };
    walk(this.root, 0, 0, rows, cols);
    return out;
  }

  /** Neighbouring window in a direction, using laid-out rectangles. */
  neighbour(win: Window, dir: 'h' | 'j' | 'k' | 'l', rows = 40, cols = 120): Window | null {
    const r = this.rects(rows, cols);
    const me = r.get(win)!;
    const cy = me.top + me.height / 2, cx = me.left + me.width / 2;
    let best: Window | null = null, bestD = Infinity;
    for (const [w, q] of r) {
      if (w === win) continue;
      const ok = dir === 'h' ? q.left + q.width <= me.left : dir === 'l' ? q.left >= me.left + me.width
        : dir === 'k' ? q.top + q.height <= me.top : q.top >= me.top + me.height;
      if (!ok) continue;
      const overlap = dir === 'h' || dir === 'l'
        ? q.top < me.top + me.height && q.top + q.height > me.top
        : q.left < me.left + me.width && q.left + q.width > me.left;
      if (!overlap) continue;
      const d = Math.abs(q.top + q.height / 2 - cy) + Math.abs(q.left + q.width / 2 - cx);
      if (d < bestD) { bestD = d; best = w; }
    }
    return best;
  }
}

function equalize(n: LayoutNode) {
  if (n.type !== 'leaf') n.children.forEach(c => (c.size = 1));
}
