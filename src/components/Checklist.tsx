import type { SessionView } from '../lessons/runtime';

/** The edits a generated challenge asks for, ticked live as the buffer matches the goal. */
export function Checklist({ items }: { items: SessionView['items'] }) {
  const done = items.filter(i => i.done).length;
  return (
    <aside className="checklist" aria-label="edits to make">
      <div className="checklist-head">
        <span>Edits</span>
        <span className="checklist-count">{done} / {items.length}</span>
      </div>
      <ol className="checklist-list">
        {items.map((it, i) => (
          <li key={i} className={'checklist-item' + (it.done ? ' done' : '')}>
            <span className="checklist-tick" aria-hidden="true">{it.done ? '✓' : ''}</span>
            <span className="checklist-text">{it.text}</span>
            <span className="checklist-line">{it.line}</span>
          </li>
        ))}
      </ol>
    </aside>
  );
}
