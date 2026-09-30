import { lessonOfRepsRun, repsRunId } from '../challenges/reps';
import { COUNTED, LESSONS, ORDER } from '../lessons';
import { fmtMin, fmtS } from '../state/format';
import type { Run } from '../state/store';
import { Avatar, type Who } from './Avatar';
import { Bars } from './Bars';
import { PATTERNS } from '../coach/patterns';
import { type CoachProfile, mixShare, topRecurring, useCoachProfile } from '../state/coach';

type Props = { who: Who; sub: string; runs: Run[]; onGo: (id: string) => void; onReps: (id: string) => void; onSignIn: () => void };

/** A run's title: the lesson's, or "<Title> reps" for a Reps run (saved as `<id>-reps`). */
export function runTitle(runId: string): string {
  if (LESSONS[runId]) return LESSONS[runId].title;
  const of = lessonOfRepsRun(runId);
  return of && LESSONS[of] ? `${LESSONS[of].title} reps` : runId;
}

export function Profile({ who, sub, runs, onGo, onReps, onSignIn }: Props) {
  const runsOf = (id: string) => runs.filter(r => r.lesson === id);
  const done = COUNTED.filter(l => runsOf(l.id).length).length;
  const last10 = runs.slice(-10);
  const avg = last10.length ? Math.round(last10.reduce((a, r) => a + r.score, 0) / last10.length) : '–';
  const recent = runs.slice(-8).reverse();
  const coachProfile = useCoachProfile();

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

      <Coach profile={coachProfile} />

      <h2 className="h2 prof">Lessons</h2>
      <div className="ls-grid ls-head">
        <span>Lesson</span><span>Runs</span><span>Best</span><span>Best time</span><span>Last 12</span>
      </div>
      <div className="ls-rows">
        {!done && <p className="empty">No lessons finished yet.</p>}
        {ORDER.flatMap(l => [
          { id: l.id, title: l.title, open: () => onGo(l.id) },
          { id: repsRunId(l.id), title: `${l.title} reps`, open: () => onReps(l.id) },
        ]).filter(r => runsOf(r.id).length).map(l => {
          const rs = runsOf(l.id);
          return (
            <button key={l.id} className="ls-grid ls-row" onClick={l.open}>
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
                <span className="t">{runTitle(r.lesson)}</span>
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

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** What the coach remembers: the ideas that keep coming back, and where the keys go lately. */
export function Coach({ profile }: { profile: CoachProfile }) {
  const top = topRecurring(profile);
  const mix = mixShare(profile);
  if (!top.length && !mix) return null;
  return (
    <section className="cp" aria-label="coach">
      <h2 className="h2 prof">Coach</h2>
      {top.length > 0 ? (
        <ol className="cp-top">
          {top.map(s => {
            const p = PATTERNS[s.id];
            const lesson = p && LESSONS[p.lesson];
            return (
              <li key={s.id} className="cp-pattern">
                <span className="cp-name">{p?.name ?? s.id}</span>
                <span className="cp-count">{s.runs} {s.runs === 1 ? 'run' : 'runs'}</span>
                {p && <span className="cp-principle">{p.principle}</span>}
                {lesson && <a className="cp-review" href={`#${lesson.id}`}>Review: {lesson.title} →</a>}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="empty">Nothing keeps coming back. The coach has retired every hint it gave you.</p>
      )}
      {mix && (
        <div className="cp-mix">
          <div className="cp-mix-head">
            Last {mix.runs} {mix.runs === 1 ? 'run' : 'runs'}: <span className="cp-mv">{pct(mix.moving)} moving</span>,{' '}
            <span className="cp-ty">{pct(mix.typing)} typing</span>, <span className="cp-ed">{pct(mix.editing)} editing</span>
          </div>
          <div className="cp-bars" role="img" aria-label="moving, typing and editing share per run, oldest first">
            {profile.keyMix.map(m => {
              const all = m.moving + m.typing + m.editing || 1;
              return (
                <span key={m.at} className="cp-bar" title={`${runTitle(m.lesson)}: ${m.moving} moving, ${m.typing} typing, ${m.editing} editing`}>
                  <span className="cp-mv-bg" style={{ height: pct(m.moving / all) }} />
                  <span className="cp-ty-bg" style={{ height: pct(m.typing / all) }} />
                  <span className="cp-ed-bg" style={{ height: pct(m.editing / all) }} />
                </span>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
