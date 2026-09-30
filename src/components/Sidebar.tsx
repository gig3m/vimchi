import { useEffect, useState } from 'react';
import { SECTIONS } from '../lessons';
import type { Run } from '../state/store';
import { Avatar, type Who } from './Avatar';
import { Kbd } from './Kbd';

type Props = {
  activeLesson: string | null;
  runsOf: (id: string) => Run[];
  completedText: string;
  /** The Warm-up entry above the bands: its subtitle, whether it is open, and how to open it. */
  warmUp: { sub: string; on: boolean; onOpen: () => void };
  profileOn: boolean;
  who: Who;
  userSub: string;
  onLesson: (id: string) => void;
  /** The logo: the first lesson (a real link, so it leaves Profile and the Warm-up). */
  homeHref: string;
  onProfile: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
  coachLive: boolean;
  onCoachLive: (v: boolean) => void;
};

const BANDS = [
  { id: 'core', title: 'Core' },
  { id: 'repeat', title: 'Repeat' },
  { id: 'project', title: 'Project' },
  { id: 'patterns', title: 'Patterns' },
  { id: 'code', title: 'Code' },
  { id: 'challenges', title: 'Challenges' },
] as const;

const OPEN_KEY = 'vimchi.sidebar.open';

function loadOpen(): Set<string> {
  try {
    const v = JSON.parse(localStorage.getItem(OPEN_KEY) ?? 'null');
    if (Array.isArray(v)) return new Set(v);
  } catch {
    /* ignore */
  }
  return new Set(['getting-around', 'small-edits', 'next-steps']);
}

export function Sidebar(p: Props) {
  const [open, setOpen] = useState(loadOpen);
  const activeSection = SECTIONS.find(s => s.lessons.some(l => l.id === p.activeLesson))?.id;

  // Always show the section holding the current lesson.
  useEffect(() => {
    if (activeSection && !open.has(activeSection)) setOpen(o => new Set(o).add(activeSection));
  }, [activeSection]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    try {
      localStorage.setItem(OPEN_KEY, JSON.stringify([...open]));
    } catch {
      /* ignore */
    }
  }, [open]);

  const toggle = (id: string) => setOpen(o => {
    const n = new Set(o);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });

  return (
    <aside className="side">
      <div className="side-scroll">
        <div className="side-head">
          <a className="brand" href={p.homeHref} aria-label="vimchi home"><img src="/logo/vimchi-lockup.svg" alt="vimchi" /></a>
          <span className="side-count">{p.completedText}</span>
        </div>
        <div className="wu-side">
          <button className={'nav-item wu-nav' + (p.warmUp.on ? ' on' : '')} onClick={p.warmUp.onOpen} aria-current={p.warmUp.on ? 'page' : undefined}>
            <span className="wu-nav-mark" aria-hidden="true">↻</span>
            <span className="wu-nav-text">
              <span className="nav-title">Warm-up</span>
              <span className="wu-nav-sub">{p.warmUp.sub}</span>
            </span>
          </button>
        </div>
        {BANDS.map(band => {
          const sections = SECTIONS.filter(s => s.band === band.id && s.lessons.length);
          if (!sections.length) return null;
          return (
            <div key={band.id} className="side-band">
              <div className="side-band-title">{band.title}</div>
              {sections.map(sec => {
                const isOpen = open.has(sec.id);
                const done = sec.lessons.filter(l => !l.boss && p.runsOf(l.id).length).length;
                const total = sec.lessons.filter(l => !l.boss).length;
                return (
                  <div key={sec.id}>
                    <button className={'side-section' + (isOpen ? ' open' : '')} onClick={() => toggle(sec.id)} aria-expanded={isOpen}>
                      <span className="caret">{isOpen ? '▾' : '▸'}</span>
                      <span className="side-section-title">{sec.title}</span>
                      <span className={'side-section-count' + (done === total ? ' all' : '')}>{done}/{total}</span>
                    </button>
                    {isOpen && (
                      <div className="side-list">
                        {sec.lessons.map(l => {
                          const runs = p.runsOf(l.id);
                          const best = runs.length ? Math.max(...runs.map(r => r.score)) : null;
                          return (
                            <button
                              key={l.id}
                              className={'nav-item' + (p.activeLesson === l.id ? ' on' : '') + (l.boss ? ' boss' : '')}
                              onClick={() => p.onLesson(l.id)}
                            >
                              <span className="nav-best">{best ?? ''}</span>
                              <span className="nav-title">{l.boss ? '★ ' : ''}{l.title}</span>
                              <span className="nav-chips">{l.chips.map(k => <Kbd key={k} k={k} />)}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      <div className="side-tools">
        <label className="side-toggle" title="Show a hint under the editor as you type">
          <input type="checkbox" checked={p.coachLive} onChange={e => p.onCoachLive(e.target.checked)} />
          <span>Live hints</span>
          <span className="side-toggle-sub">coach as you type</span>
        </label>
      </div>
      <div className="side-foot">
        <button className={'me' + (p.profileOn ? ' on' : '')} onClick={p.onProfile}>
          <Avatar who={p.who} />
          <span className="me-text">
            <span className="me-name">{p.who.name}</span>
            <span className="me-sub">{p.userSub}</span>
          </span>
        </button>
        {p.who.isGuest
          ? <button className="btn-primary" onClick={p.onSignIn}>Sign in</button>
          : <button className="btn-ghost" onClick={p.onSignOut}>Sign out</button>}
      </div>
    </aside>
  );
}
