import { useDraggable } from '@dnd-kit/core';
import { SUBJECTS, type Item } from '../domain/types';

const SHORT_SUBJECT: Record<string, string> = {
  English: 'Eng',
  Maths: 'Maths',
  'Verbal Reasoning': 'VR',
  'Non-verbal Reasoning': 'NVR',
  'English Comprehension': 'Comp',
};

export function subjectClass(subject: string): string {
  const index = (SUBJECTS as readonly string[]).indexOf(subject);
  return index >= 0 ? `subject-${index}` : 'subject-other';
}

interface Props {
  item: Item;
  /** `chip` is the compact form used inside calendar days. */
  variant: 'card' | 'chip';
  problem?: boolean;
  /** For papers: sessions of the subject still to be completed. */
  locked?: number;
  onOpen?(item: Item): void;
}

export function ItemCardBody({ item, variant, problem, locked }: Props) {
  const classes = [
    'item',
    `item-${variant}`,
    subjectClass(item.subject),
    item.type === 'Paper' ? 'item-paper' : '',
    item.completed ? 'item-done' : '',
    problem ? 'item-problem' : '',
  ];
  const short = SHORT_SUBJECT[item.subject] ?? item.subject;
  const paper = item.type === 'Paper';
  return (
    <span className={classes.filter(Boolean).join(' ')}>
      {variant === 'chip' ? (
        <span className="item-title">
          {item.completed && '✓ '}
          <strong>{short}</strong> {paper && '📝 '}
          {item.title}
        </span>
      ) : (
        <>
          <span className="item-title">
            <strong>{item.subject}</strong>
            {item.category && ` · ${item.category}`}
            {paper && item.minutes ? ` · ${item.minutes} min paper` : paper ? ' · paper' : ''}
          </span>
          <span className="item-title">{item.title}</span>
          <span className="item-meta">{item.book}</span>
          {!!locked && (
            <span className="item-meta">
              🔒 after {locked} {item.subject} session{locked === 1 ? '' : 's'}
            </span>
          )}
        </>
      )}
    </span>
  );
}

/** A draggable item; a click (rather than a drag) opens it for editing. */
export function ItemCard(props: Props) {
  const { item, onOpen } = props;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: item.id });
  return (
    <button
      type="button"
      ref={setNodeRef}
      className={`item-button${isDragging ? ' dragging' : ''}`}
      title={`${item.subject}: ${item.title}`}
      onClick={() => onOpen?.(item)}
      {...listeners}
      {...attributes}
    >
      <ItemCardBody {...props} />
    </button>
  );
}
