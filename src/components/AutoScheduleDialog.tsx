import { formatDate, today } from '../domain/dates';
import { autoSchedule } from '../domain/schedule';
import type { Child, Item } from '../domain/types';
import { Modal } from './Modal';

interface Props {
  child: Child;
  items: Item[];
  onApply(items: Item[]): void;
  onClose(): void;
}

/** Preview of where auto-scheduling would put the unplanned items. */
export function AutoScheduleDialog({ child, items, onApply, onClose }: Props) {
  const schedule = autoSchedule(child, items, today());
  const byId = new Map(items.map((i) => [i.id, i]));
  const placed = schedule.assignments
    .map(({ id, date }) => ({ ...(byId.get(id) as Item), date }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const unplaced = schedule.unplaced.map((id) => byId.get(id) as Item);
  const total = placed.length + unplaced.length;

  return (
    <Modal title="Auto-schedule" onClose={onClose}>
      <div className="modal-body">
        {!child.finalDate ? (
          <p>Set a final date for {child.name} in Settings first.</p>
        ) : total === 0 ? (
          <p>There is nothing unplanned to schedule.</p>
        ) : (
          <p>
            {placed.length} of {total} unplanned item{total === 1 ? '' : 's'} can be placed between
            today and {formatDate(child.finalDate)}, avoiding unavailable days and keeping to{' '}
            {child.maxPerDay} per day.
          </p>
        )}
        {unplaced.length > 0 && child.finalDate && (
          <p className="warning">
            {unplaced.length} could not be fitted in and will stay unplanned:{' '}
            {unplaced.map((i) => `${i.subject}: ${i.title}`).join('; ')}
          </p>
        )}
        {placed.length > 0 && (
          <ul className="schedule-preview">
            {placed.map((item) => (
              <li key={item.id}>
                <span>{formatDate(item.date)}</span>
                {item.type === 'Paper' && '📝 '}
                {item.subject}: {item.title}
              </li>
            ))}
          </ul>
        )}
      </div>
      <footer className="form-actions">
        <span className="spacer" />
        <button type="button" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="primary"
          disabled={placed.length === 0}
          onClick={() => {
            onApply(placed);
            onClose();
          }}
        >
          Apply
        </button>
      </footer>
    </Modal>
  );
}
