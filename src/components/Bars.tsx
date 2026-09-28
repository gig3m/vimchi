import type { Run } from '../state/store';

/** Last-12 score sparkline; the newest bar is pink. */
export function Bars({ runs }: { runs: Run[] }) {
  const last = runs.slice(-12);
  return (
    <span className="bars">
      {last.map((r, i) => (
        <span
          key={r.at}
          style={{ height: Math.max(8, r.score) + '%', background: i === last.length - 1 ? 'var(--pink)' : 'var(--purple)' }}
        />
      ))}
    </span>
  );
}
