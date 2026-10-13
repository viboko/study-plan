import { useDroppable } from '@dnd-kit/core';
import { useState } from 'react';
import { incompleteSessions } from '../domain/rules';
import type { Item } from '../domain/types';
import { ItemCard } from './ItemCard';

interface Props {
  /** All of the child's items. */
  items: Item[];
  onOpen(item: Item): void;
}

/** Items with no date yet. Dropping an item here clears its date. */
export function Backlog({ items, onOpen }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: 'backlog' });
  const [subject, setSubject] = useState('');
  const unplanned = items.filter((i) => !i.date && !i.completed);
  const subjects = [...new Set(unplanned.map((i) => i.subject))];
  const shown = unplanned.filter((i) => !subject || i.subject === subject);
  const sessions = shown.filter((i) => i.type === 'Session');
  const papers = shown.filter((i) => i.type === 'Paper');

  return (
    <aside ref={setNodeRef} className={`backlog${isOver ? ' backlog-over' : ''}`}>
      <h2>Unplanned ({unplanned.length})</h2>
      {subjects.length > 1 && (
        <select
          aria-label="Filter by subject"
          value={subjects.includes(subject) ? subject : ''}
          onChange={(e) => setSubject(e.target.value)}
        >
          <option value="">All subjects</option>
          {subjects.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      )}
      {unplanned.length === 0 && (
        <p className="muted">Everything is planned. Drag an item here to unplan it.</p>
      )}
      {sessions.length > 0 && <h3>Sessions</h3>}
      {sessions.map((item) => (
        <ItemCard key={item.id} item={item} variant="card" onOpen={onOpen} />
      ))}
      {papers.length > 0 && <h3>Papers</h3>}
      {papers.map((item) => (
        <ItemCard
          key={item.id}
          item={item}
          variant="card"
          locked={incompleteSessions(items, item)}
          onOpen={onOpen}
        />
      ))}
    </aside>
  );
}
