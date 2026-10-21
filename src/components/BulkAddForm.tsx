import { useState, type FormEvent } from 'react';
import { SUBJECTS, type Item, type ItemType } from '../domain/types';
import { BookInput, blankItem } from './ItemForm';
import { Modal } from './Modal';

interface Props {
  child: string;
  type: ItemType;
  /** The child's items, for book autocomplete. */
  items: Item[];
  onSave(items: Item[]): void;
  onClose(): void;
}

/**
 * Add many sessions or papers that share a book and subject, plus a category
 * (sessions) or a number of minutes (papers): one title per line.
 */
export function BulkAddForm({ child, type, items, onSave, onClose }: Props) {
  const isPaper = type === 'Paper';
  const noun = isPaper ? 'paper' : 'session';
  const [book, setBook] = useState('');
  const [subject, setSubject] = useState<string>(SUBJECTS[0]);
  const [category, setCategory] = useState('');
  const [minutes, setMinutes] = useState<number | null>(blankItem(child, type).minutes);
  const [titles, setTitles] = useState('');
  const lines = titles
    .split('\n')
    .map((t) => t.trim())
    .filter(Boolean);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSave(
      lines.map((title) => ({
        ...blankItem(child, type),
        book: book.trim(),
        subject,
        category: isPaper ? '' : category.trim(),
        minutes: isPaper ? minutes : null,
        title,
      })),
    );
    onClose();
  };

  return (
    <Modal title={`Add several ${noun}s`} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label className="wide">
          Book
          <BookInput value={book} items={items} onChange={setBook} />
        </label>
        <label>
          Subject
          <select value={subject} onChange={(e) => setSubject(e.target.value)}>
            {SUBJECTS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        {isPaper ? (
          <label>
            Minutes
            <input
              type="number"
              min={1}
              value={minutes ?? ''}
              onChange={(e) => setMinutes(e.target.value ? Number(e.target.value) : null)}
            />
          </label>
        ) : (
          <label>
            Category
            <input value={category} onChange={(e) => setCategory(e.target.value)} />
          </label>
        )}
        <label className="wide">
          Titles, one per line
          <textarea
            rows={8}
            required
            autoFocus
            value={titles}
            placeholder={
              isPaper ? 'Paper 1\nPaper 2\nPaper 3' : 'Parts of Speech\nTenses\nPunctuation'
            }
            onChange={(e) => setTitles(e.target.value)}
          />
        </label>
        <footer className="form-actions wide">
          <span className="spacer" />
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary" disabled={lines.length === 0}>
            Add {lines.length || ''} {noun}
            {lines.length === 1 ? '' : 's'}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
