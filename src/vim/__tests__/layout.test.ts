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
