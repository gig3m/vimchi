// "Better ways": what a better Vim user would have typed, from the learner's own keys.
import type { Chip, Report, Summary } from '../coach';
import { PATTERNS } from '../coach/patterns';
import { LESSONS } from '../lessons';
import { Kbd } from './Kbd';

/** Keys as chips: command keys one by one, typed text as one literal chip. Computed by the coach from the engine. */
function Keys({ chips }: { chips: Chip[] }) {
  return <span className="bw-keys">{chips.map((c, i) => (c.kind === 'text' ? <span key={i} className="bw-text">{c.v}</span> : <Kbd key={i} k={c.v} />))}</span>;
}

/** "You used 235 keys: 172 moving, 38 typing, 25 editing. Par 64." */
export function summaryText(s: Summary): string {
  return `You used ${s.keys} keys: ${s.moving} moving, ${s.typing} typing, ${s.editing} editing.${s.par !== null ? ` Par ${s.par}.` : ''}`;
}

export function BetterWays({ report, unitLabel }: { report: Report; unitLabel: (u: number) => string }) {
  const { summary } = report;
  if (!report.critiques.length && !report.reference.length && !summary.keys) return null;
  const items = report.reference.some(r => r.kind === 'item');
  return (
    <section className="better-ways" aria-label="better ways">
      <h3 className="bw-title">Better ways</h3>
      {summary.keys > 0 && <p className="bw-summary">{summaryText(summary)}</p>}
      {report.critiques.length > 0 && (
        <ol className="bw-list">
          {report.critiques.slice(0, 5).map((c, i) => (
            <li key={i} className="bw-item">
              <span className="bw-unit">{unitLabel(c.unit)}</span>
              <span className="bw-you">you <Keys chips={c.youChips} /></span>
              {c.better.map((b, j) => {
                const p = PATTERNS[b.pattern];
                const lesson = p && LESSONS[p.lesson];
                return (
                  <span key={j} className="bw-better">
                    → <Keys chips={b.chips} /> <span className="bw-saves">saves {b.saves}</span>
                    {p && (
                      <span className="bw-why">
                        <span className="bw-pattern">{p.name}</span> — {p.principle}
                        {lesson && <> <a className="bw-review" href={`#${lesson.id}`}>Review: {lesson.title} →</a></>}
                      </span>
                    )}
                  </span>
                );
              })}
            </li>
          ))}
        </ol>
      )}
      {report.reference.length > 0 && (
        <ul className="bw-ref">
          <li className="bw-ref-note">{items ? 'The edits that took the most keys over par:' : "The lesson's own solution for rounds where you used well over par:"}</li>
          {report.reference.map((r, i) => (
            <li key={i}>
              {r.kind === 'item'
                ? <>{unitLabel(r.unit)}: <span className="bw-saves">par {r.par}, you {r.you}</span></>
                : <>{unitLabel(r.unit)}: {r.chips ? <Keys chips={r.chips} /> : <span className="bw-text">(uses a key from a later lesson)</span>}{' '}
                  <span className="bw-saves">par {r.par}, you used {r.you}</span></>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
