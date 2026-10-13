import { useState, type FormEvent } from 'react';
import { today } from '../domain/dates';
import { incompleteSessions } from '../domain/rules';
import { SUBJECTS, newId, type Item, type ItemType } from '../domain/types';
import { Modal } from './Modal';

export function blankItem(child: string, type: ItemType, date: string | null = null): Item {
  return {
    id: newId(),
    child,
    type,
    book: '',
    subject: SUBJECTS[0],
    category: '',
    title: '',
    minutes: type === 'Paper' ? 50 : null,
    date,
    completed: false,
  };
}

/**
 * The item with its completed flag flipped, or null if the user backs out.
 * Completing an undated item dates it today; completing a paper early asks first.
 */
export function withCompleted(item: Item, completed: boolean, items: Item[]): Item | null {
  if (completed && item.type === 'Paper') {
    const left = incompleteSessions(items, item);
    const question = `${left} ${item.subject} session${left === 1 ? ' is' : 's are'} not completed yet. Mark this paper as completed anyway?`;
    if (left > 0 && !window.confirm(question)) return null;
  }
  return { ...item, completed, date: completed ? (item.date ?? today()) : item.date };
}

interface Props {
  item: Item;
  isNew: boolean;
  /** The child's items, for autocomplete and the paper check. */
  items: Item[];
  onSave(item: Item): void;
  onDelete(item: Item): void;
  onClose(): void;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}

export function ItemForm({ item, isNew, items, onSave, onDelete, onClose }: Props) {
  const [draft, setDraft] = useState(item);
  const set = (changes: Partial<Item>) => setDraft((d) => ({ ...d, ...changes }));
  const isPaper = draft.type === 'Paper';
  const subjects = unique([...SUBJECTS, draft.subject]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    let saved: Item | null = {
      ...draft,
      book: draft.book.trim(),
      category: isPaper ? '' : draft.category.trim(),
      title: draft.title.trim(),
      minutes: isPaper ? draft.minutes : null,
    };
    if (saved.completed && !item.completed) saved = withCompleted(saved, true, items);
    if (!saved) return;
    onSave(saved);
    onClose();
  };

  return (
    <Modal title={`${isNew ? 'Add' : 'Edit'} ${isPaper ? 'paper' : 'session'}`} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label>
          Type
          <select
            value={draft.type}
            onChange={(e) => {
              const type = e.target.value as ItemType;
              set({ type, minutes: type === 'Paper' ? (draft.minutes ?? 50) : null });
            }}
          >
            <option value="Session">Study session</option>
            <option value="Paper">Example paper</option>
          </select>
        </label>
        <label>
          Subject
          <select value={draft.subject} onChange={(e) => set({ subject: e.target.value })}>
            {subjects.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="wide">
          Book
          <input
            value={draft.book}
            list="book-options"
            placeholder="e.g. Bond 11+ Non-verbal Reasoning 10-11"
            onChange={(e) => set({ book: e.target.value })}
          />
          <datalist id="book-options">
            {unique(items.map((i) => i.book)).map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
        </label>
        {isPaper ? (
          <label>
            Minutes
            <input
              type="number"
              min={1}
              value={draft.minutes ?? ''}
              onChange={(e) => set({ minutes: e.target.value ? Number(e.target.value) : null })}
            />
          </label>
        ) : (
          <label>
            Category
            <input
              value={draft.category}
              list="category-options"
              placeholder="e.g. Grammar"
              onChange={(e) => set({ category: e.target.value })}
            />
            <datalist id="category-options">
              {unique(items.map((i) => i.category)).map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
        )}
        <label>
          Title
          <input
            required
            autoFocus={isNew}
            value={draft.title}
            placeholder={isPaper ? 'e.g. Paper 1' : 'e.g. Parts of Speech'}
            onChange={(e) => set({ title: e.target.value })}
          />
        </label>
        <label>
          Date
          <input
            type="date"
            value={draft.date ?? ''}
            onChange={(e) => set({ date: e.target.value || null })}
          />
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={draft.completed}
            onChange={(e) => set({ completed: e.target.checked })}
          />
          Completed
        </label>
        <footer className="form-actions wide">
          {!isNew && (
            <button
              type="button"
              className="danger"
              onClick={() => {
                if (!window.confirm(`Delete "${item.title}"?`)) return;
                onDelete(item);
                onClose();
              }}
            >
              Delete
            </button>
          )}
          <span className="spacer" />
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary">
            Save
          </button>
        </footer>
      </form>
    </Modal>
  );
}
