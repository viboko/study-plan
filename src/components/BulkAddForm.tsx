import { useState, type FormEvent } from 'react';
import { SUBJECTS, type Item } from '../domain/types';
import { blankItem } from './ItemForm';
import { Modal } from './Modal';

interface Props {
  child: string;
  onSave(items: Item[]): void;
  onClose(): void;
}

/** Add many sessions that share a book, subject and category: one title per line. */
export function BulkAddForm({ child, onSave, onClose }: Props) {
  const [book, setBook] = useState('');
  const [subject, setSubject] = useState<string>(SUBJECTS[0]);
  const [category, setCategory] = useState('');
  const [titles, setTitles] = useState('');
  const lines = titles
    .split('\n')
    .map((t) => t.trim())
    .filter(Boolean);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSave(
      lines.map((title) => ({
        ...blankItem(child, 'Session'),
        book: book.trim(),
        subject,
        category: category.trim(),
        title,
      })),
    );
    onClose();
  };

  return (
    <Modal title="Add several sessions" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label className="wide">
          Book
          <input value={book} onChange={(e) => setBook(e.target.value)} />
        </label>
        <label>
          Subject
          <select value={subject} onChange={(e) => setSubject(e.target.value)}>
            {SUBJECTS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          Category
          <input value={category} onChange={(e) => setCategory(e.target.value)} />
        </label>
        <label className="wide">
          Titles, one per line
          <textarea
            rows={8}
            required
            autoFocus
            value={titles}
            placeholder={'Parts of Speech\nTenses\nPunctuation'}
            onChange={(e) => setTitles(e.target.value)}
          />
        </label>
        <footer className="form-actions wide">
          <span className="spacer" />
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary" disabled={lines.length === 0}>
            Add {lines.length || ''} session{lines.length === 1 ? '' : 's'}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
