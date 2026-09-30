// "Better ways": what a better Vim user would have typed, from the learner's own keys.
import type { Chip, Report } from '../coach';
import { Kbd } from './Kbd';

/** Keys as chips: command keys one by one, typed text as one literal chip. Computed by the coach from the engine. */
function Keys({ chips }: { chips: Chip[] }) {
  return <span className="bw-keys">{chips.map((c, i) => (c.kind === 'text' ? <span key={i} className="bw-text">{c.v}</span> : <Kbd key={i} k={c.v} />))}</span>;
}

export function BetterWays({ report, unitLabel }: { report: Report; unitLabel: (u: number) => string }) {
  if (!report.critiques.length && !report.reference.length) return null;
  return (
    <section className="better-ways" aria-label="better ways">
      <h3 className="bw-title">Better ways</h3>
      <ol className="bw-list">
        {report.critiques.slice(0, 5).map((c, i) => (
          <li key={i} className="bw-item">
            <span className="bw-unit">{unitLabel(c.unit)}</span>
            <span className="bw-you">you <Keys chips={c.youChips} /></span>
            {c.better.map((b, j) => (
              <span key={j} className="bw-better">
                → <Keys chips={b.chips} /> <span className="bw-saves">saves {b.saves}</span>
                <span className="bw-why">{b.why}</span>
              </span>
            ))}
          </li>
        ))}
      </ol>
      {report.reference.length > 0 && (
        <ul className="bw-ref">
          <li className="bw-ref-note">The lesson's own solution for rounds where you used well over par:</li>
          {report.reference.map((r, i) => (
            <li key={i}>
              {unitLabel(r.unit)}: {r.chips ? <Keys chips={r.chips} /> : <span className="bw-text">(uses a key from a later lesson)</span>}{' '}
              <span className="bw-saves">par {r.par}, you used {r.you}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
