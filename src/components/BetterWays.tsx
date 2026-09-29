// "Better ways": what a better Vim user would have typed, from the learner's own keys.
import type { Report } from '../coach';
import { parseKeys } from '../vim/keys';
import { Kbd } from './Kbd';

/** Keys as chips; text typed inside an insert (i…<Esc>, cw…<Esc>) collapses to one literal chip. */
function Keys({ s }: { s: string }) {
  const m = /^(.*?)([iaAIoOsSC]|c[wWe]|cc)(.+?)(<Esc>)(.*)$/.exec(s);
  const parts = m ? [...parseKeys(m[1] + m[2]), `‹${m[3]}›`, '<Esc>', ...parseKeys(m[5])] : parseKeys(s);
  return <span className="bw-keys">{parts.map((k, i) => (k.startsWith('‹') ? <span key={i} className="bw-text">{k.slice(1, -1)}</span> : <Kbd key={i} k={k} />))}</span>;
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
            <span className="bw-you">you <Keys s={c.you} /></span>
            {c.better.map((b, j) => (
              <span key={j} className="bw-better">
                → <Keys s={b.keys} /> <span className="bw-saves">saves {b.saves}</span>
                <span className="bw-why">{b.why}</span>
              </span>
            ))}
          </li>
        ))}
      </ol>
      {report.reference.length > 0 && (
        <ul className="bw-ref">
          {report.reference.map((r, i) => (
            <li key={i}>
              {unitLabel(r.unit)} reference: {r.ref ? <Keys s={r.ref} /> : <span className="bw-text">par {r.par} keys</span>}{' '}
              <span className="bw-saves">you used {r.you}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
