import { describe, expect, it } from 'vitest';
import { Buffer } from '../buffer';
import { Tab, Window } from '../layout';

const win = () => new Window(new Buffer('a.txt', 'x\n'.repeat(80)));

describe('window layout heights', () => {
  it('a lone window keeps every screen row: its status line is drawn outside the pane', () => {
    const w = win();
    const tab = new Tab(w);
    tab.layoutFor(13, 120);
    expect(w.height).toBe(13);
  });

  it('split windows share the screen rows, each losing one row to its own status line', () => {
    const a = win(), b = win();
    const tab = new Tab(a);
    tab.split(a, b, 'col');
    const rects = tab.layoutFor(13, 120);
    const ra = rects.get(a)!, rb = rects.get(b)!;
    expect([a.height, b.height]).toEqual([ra.height - 1, rb.height - 1]);
  });

  it('finding a neighbour never resizes a window', () => {
    const a = win(), b = win();
    const tab = new Tab(a);
    tab.split(a, b, 'col');
    tab.layoutFor(13, 120);
    const before = [a.height, b.height];
    tab.neighbour(a, 'j');
    expect([a.height, b.height]).toEqual(before);
  });
});

describe('window sizes match Neovim (13 rows, nvim --clean with lines=14)', () => {
  const stack = (n: number) => {
    const ws = [win()];
    const tab = new Tab(ws[0]);
    for (let i = 1; i < n; i++) { const w = win(); tab.split(ws[ws.length - 1], w, 'col'); ws.push(w); }
    return { tab, ws };
  };
  it('stacked windows have no gap: text rows plus status lines fill the screen', () => {
    for (const [n, want] of [[2, [6, 5]], [3, [4, 3, 3]], [4, [3, 2, 2, 2]]] as const) {
      const { tab, ws } = stack(n);
      const rects = tab.layoutFor(13, 120);
      const hs = ws.map(w => w.height);
      expect(hs.slice().sort((a, b) => b - a), `${n} windows`).toEqual([...want]);
      const rs = ws.map(w => rects.get(w)!).sort((a, b) => a.top - b.top);
      rs.forEach((r, i) => { if (i) expect(r.top).toBe(rs[i - 1].top + rs[i - 1].height); });
      expect(rs[rs.length - 1].top + rs[rs.length - 1].height).toBe(13);
    }
  });
  it('one maximized window leaves the others one text row and a status line', () => {
    const { tab, ws } = stack(4);
    tab.maximize(ws[0], 'col');
    tab.layoutFor(13, 120);
    expect(ws.map(w => w.height).sort((a, b) => b - a)).toEqual([6, 1, 1, 1]);
  });
});
