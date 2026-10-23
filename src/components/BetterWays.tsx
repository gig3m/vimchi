// "Better ways": what a better Vim user would have typed, from the learner's own keys.
import { type ReactNode, useLayoutEffect, useRef, useState } from 'react';
import { type Chip, type Report, type Summary, gain, keysN } from '../coach';
import { PATTERNS } from '../coach/patterns';
import { LESSONS } from '../lessons';
import { Kbd } from './Kbd';

/** Keys as chips: command keys one by one, typed text as one literal chip. Computed by the coach from the engine. */
function Keys({ chips }: { chips: Chip[] }) {
  return <span className="bw-keys">{chips.map((c, i) => (c.kind === 'text' ? <span key={i} className="bw-text">{c.v}</span> : <Kbd key={i} k={c.v} />))}</span>;
}

/** "You pressed 235 keys: 172 moving the cursor, 38 typing text and 25 on commands. Par, the key count of a clean solution, is 64." */
export function summaryText(s: Summary): string {
  const par = s.par !== null ? ` Par, the key count of a clean solution, is ${s.par}.` : '';
  return `You pressed ${keysN(s.keys)}: ${s.moving} moving the cursor, ${s.typing} typing text and ${s.editing} on commands.${par}`;
}

/** "a", "a and b", "a, b and c", for JSX pieces. */
function list(parts: ReactNode[]): ReactNode {
  return parts.map((p, i) => <span key={i}>{i === 0 ? '' : i === parts.length - 1 ? ' and ' : ', '}{p}</span>);
}

export function BetterWays({ report, unitLabel }: { report: Report; unitLabel: (u: number) => string }) {
  const { summary } = report;
  // The list scrolls inside a capped box: say so while there is more below, and let Tab reach it
  // (arrow keys then scroll it; from the editor, j / k do).
  const box = useRef<HTMLElement>(null);
  const [more, setMore] = useState(false);
  const [scrolls, setScrolls] = useState(false);
  const measure = () => {
    const el = box.current;
    if (!el) return;
    setScrolls(el.scrollHeight > el.clientHeight + 1);
    setMore(el.scrollTop + el.clientHeight < el.scrollHeight - 4);
  };
  useLayoutEffect(measure, [report]);
  if (!report.critiques.length && !report.reference.length && !summary.keys) return null;
  const others = report.otherWays ?? [];
  const items = report.reference.some(r => r.kind === 'item');
  const typed = [...report.critiques.slice(0, 5).flatMap(c => [c.youChips, ...c.better.map(b => b.chips)]), ...report.reference.map(r => r.chips ?? []), ...(report.otherWays ?? []).flatMap(o => o.used)].some(ch => ch.some(x => x.kind === 'text'));
  return (
    <div className={'bw-wrap' + (more ? ' more' : '')}>
    <section ref={box} className="better-ways" aria-label="better ways" tabIndex={scrolls ? 0 : undefined} onScroll={measure}>
      <h3 className="bw-title">Better ways</h3>
      {summary.keys > 0 && <p className="bw-summary">{summaryText(summary)}</p>}
      {typed && <p className="bw-legend">Keys in a dashed box are text you typed.</p>}
      {report.critiques.length > 0 && (
        <ol className="bw-list">
          {report.critiques.slice(0, 5).map((c, i) => (
            <li key={i} className="bw-item">
              <span className="bw-unit">{unitLabel(c.unit)}</span>
              <span className="bw-you">You pressed <Keys chips={c.youChips} /> ({keysN(c.keys)}).</span>
              {c.better.map((b, j) => {
                const p = PATTERNS[b.pattern];
                const lesson = p && LESSONS[p.lesson];
                return (
                  <span key={j} className="bw-better">
                    <Keys chips={b.chips} /> does the same {gain(c.keys, c.keys - b.saves)}.
                    {p && (
                      <span className="bw-why">
                        <span className="bw-pattern">{p.name}.</span> {p.principle}
                        {lesson && <> <a className="bw-review" href={`#${lesson.id}`}>Practice it in {lesson.title} →</a></>}
                      </span>
                    )}
                  </span>
                );
              })}
            </li>
          ))}
        </ol>
      )}
      {others.length > 0 && (
        <ul className="bw-ref">
          {others.map(o => (
            <li key={o.unit}>
              {unitLabel(o.unit)}: this lesson is about {list(o.lessonKeys.map((k, i) => <Kbd key={i} k={k} />))}. You used{' '}
              {list(o.used.map((chips, i) => <Keys key={i} chips={chips} />))} to the same effect, which is fine.
            </li>
          ))}
        </ul>
      )}
      {report.reference.length > 0 && (
        <ul className="bw-ref">
          <li className="bw-ref-note">{items ? 'The edits that took you the most extra keys:' : "Rounds where you pressed more keys than the lesson's own solution:"}</li>
          {report.reference.map((r, i) => (
            <li key={i}>
              {r.kind === 'item'
                ? <>{unitLabel(r.unit)}: you pressed {keysN(r.you)} where {r.par} would do.</>
                : r.chips
                  ? <>{unitLabel(r.unit)}: <Keys chips={r.chips} /> does it in {keysN(r.par)}. You pressed {r.you}.</>
                  : <>{unitLabel(r.unit)}: the solution takes {keysN(r.par)}, but it uses a key from a later lesson. You pressed {r.you}.</>}
            </li>
          ))}
        </ul>
      )}
    </section>
    {more && <div className="bw-more" aria-hidden="true">more below · j / k to scroll</div>}
    </div>
  );
}
