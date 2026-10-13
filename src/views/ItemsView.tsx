import { useState } from 'react';
import { BulkAddForm } from '../components/BulkAddForm';
import { subjectClass } from '../components/ItemCard';
import { ItemForm, blankItem, withCompleted } from '../components/ItemForm';
import { formatDate } from '../domain/dates';
import type { Item } from '../domain/types';
import { usePlan } from '../state/PlanContext';

type StatusFilter = 'all' | 'unplanned' | 'planned' | 'completed';

function matchesStatus(item: Item, status: StatusFilter): boolean {
  switch (status) {
    case 'all':
      return true;
    case 'unplanned':
      return !item.date && !item.completed;
    case 'planned':
      return !!item.date && !item.completed;
    case 'completed':
      return item.completed;
  }
}

export function ItemsView() {
  const { child, items, apply } = usePlan();
  const [subject, setSubject] = useState('');
  const [book, setBook] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<{ item: Item; isNew: boolean } | null>(null);
  const [bulk, setBulk] = useState(false);

  if (!child) {
    return <p className="empty">Add a child in Settings to start planning.</p>;
  }

  const subjects = [...new Set(items.map((i) => i.subject))].sort();
  const books = [...new Set(items.map((i) => i.book).filter(Boolean))].sort();
  const needle = search.trim().toLowerCase();
  const shown = items.filter(
    (i) =>
      (!subject || i.subject === subject) &&
      (!book || i.book === book) &&
      matchesStatus(i, status) &&
      (!needle || `${i.title} ${i.category} ${i.book}`.toLowerCase().includes(needle)),
  );

  return (
    <>
      <div className="toolbar">
        <button
          type="button"
          className="primary"
          onClick={() => setEditing({ item: blankItem(child.name, 'Session'), isNew: true })}
        >
          + Add session
        </button>
        <button
          type="button"
          onClick={() => setEditing({ item: blankItem(child.name, 'Paper'), isNew: true })}
        >
          + Add paper
        </button>
        <button type="button" onClick={() => setBulk(true)}>
          + Add several
        </button>
      </div>
      <div className="toolbar">
        <select
          aria-label="Subject"
          value={subjects.includes(subject) ? subject : ''}
          onChange={(e) => setSubject(e.target.value)}
        >
          <option value="">All subjects</option>
          {subjects.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          aria-label="Book"
          value={books.includes(book) ? book : ''}
          onChange={(e) => setBook(e.target.value)}
        >
          <option value="">All books</option>
          {books.map((b) => (
            <option key={b}>{b}</option>
          ))}
        </select>
        <select
          aria-label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
        >
          <option value="all">Any status</option>
          <option value="unplanned">Unplanned</option>
          <option value="planned">Planned</option>
          <option value="completed">Completed</option>
        </select>
        <input
          type="search"
          aria-label="Search"
          placeholder="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="spacer" />
        <span className="muted">
          {shown.length} of {items.length}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="empty">No sessions or papers for {child.name} yet.</p>
      ) : (
        <div className="table-wrap">
          <table className="items-table">
            <thead>
              <tr>
                <th>Done</th>
                <th>Type</th>
                <th>Subject</th>
                <th>Book</th>
                <th>Category</th>
                <th>Title</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((item) => (
                <tr key={item.id} className={item.completed ? 'row-done' : ''}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`${item.title} completed`}
                      checked={item.completed}
                      onChange={(e) => {
                        const next = withCompleted(item, e.target.checked, items);
                        if (next) apply({ kind: 'upsertItems', items: [next] });
                      }}
                    />
                  </td>
                  <td>{item.type}</td>
                  <td>
                    <span className={`subject-tag ${subjectClass(item.subject)}`}>
                      {item.subject}
                    </span>
                  </td>
                  <td>{item.book}</td>
                  <td>
                    {item.type === 'Paper' ? item.minutes && `${item.minutes} min` : item.category}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="link"
                      onClick={() => setEditing({ item, isNew: false })}
                    >
                      {item.title || '(untitled)'}
                    </button>
                  </td>
                  <td>{item.date ? formatDate(item.date) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <ItemForm
          key={editing.item.id}
          item={editing.item}
          isNew={editing.isNew}
          items={items}
          onSave={(item) => apply({ kind: 'upsertItems', items: [item] })}
          onDelete={(item) => apply({ kind: 'deleteItems', items: [item] })}
          onClose={() => setEditing(null)}
        />
      )}
      {bulk && (
        <BulkAddForm
          child={child.name}
          onSave={(added) => apply({ kind: 'upsertItems', items: added })}
          onClose={() => setBulk(false)}
        />
      )}
    </>
  );
}
