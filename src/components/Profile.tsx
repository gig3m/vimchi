import { COUNTED, LESSONS, ORDER } from '../lessons';
import { fmtMin, fmtS } from '../state/format';
import type { Run } from '../state/store';
import { Avatar, type Who } from './Avatar';
import { Bars } from './Bars';

type Props = { who: Who; sub: string; runs: Run[]; onGo: (id: string) => void; onSignIn: () => void };

export function Profile({ who, sub, runs, onGo, onSignIn }: Props) {
  const runsOf = (id: string) => runs.filter(r => r.lesson === id);
  const done = COUNTED.filter(l => runsOf(l.id).length).length;
  const last10 = runs.slice(-10);
  const avg = last10.length ? Math.round(last10.reduce((a, r) => a + r.score, 0) / last10.length) : '–';
  const recent = runs.slice(-8).reverse();

  return (
    <>
      <div className="prof-head">
        <Avatar who={who} large />
        <div>
          <h1 className="prof-name">{who.name}</h1>
          <div className="prof-sub">{sub}</div>
        </div>
        {who.isGuest && <button className="btn-primary lg" onClick={onSignIn}>Sign in</button>}
      </div>
      <div className="tiles">
        <Tile label="Lessons" value={`${done} / ${COUNTED.length}`} />
        <Tile label="Runs" value={runs.length} />
        <Tile label="Avg score" value={avg} accent />
        <Tile label="Practice time" value={fmtMin(runs.reduce((a, r) => a + r.time, 0))} />
      </div>

      <h2 className="h2 prof">Lessons</h2>
      <div className="ls-grid ls-head">
        <span>Lesson</span><span>Runs</span><span>Best</span><span>Best time</span><span>Last 12</span>
      </div>
      <div className="ls-rows">
        {!done && <p className="empty">No lessons finished yet.</p>}
        {ORDER.filter(l => runsOf(l.id).length).map(l => {
          const rs = runsOf(l.id);
          return (
            <button key={l.id} className="ls-grid ls-row" onClick={() => onGo(l.id)}>
              <span className="t">{l.title}</span>
              <span>{rs.length}</span>
              <span className="b">{rs.length ? Math.max(...rs.map(r => r.score)) : '–'}</span>
              <span>{rs.length ? fmtS(Math.min(...rs.map(r => r.time))) : '–'}</span>
              <Bars runs={rs} />
            </button>
          );
        })}
      </div>

      <h2 className="h2 prof">Recent runs</h2>
      {recent.length ? (
        <div>
          {recent.map(r => {
            const d = new Date(r.at);
            return (
              <div key={r.at} className="recent-row">
                <span className="when">
                  {d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })},{' '}
                  {d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                </span>
                <span className="t">{LESSONS[r.lesson]?.title ?? r.lesson}</span>
                <span className="tm">{fmtS(r.time)}</span>
                <span className="s">{r.score}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="empty">No runs yet. Finish a lesson challenge and it will show up here.</p>
      )}
    </>
  );
}

function Tile({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="tile">
      <div className="tile-label">{label}</div>
      <div className={'tile-val' + (accent ? ' accent' : '')}>{value}</div>
    </div>
  );
}
