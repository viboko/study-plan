import { useDroppable } from '@dnd-kit/core';
import { WEEKDAYS, monthGrid, monthOf, today, weekday } from '../domain/dates';
import { isUnavailable, isUnavailableWeekday } from '../domain/rules';
import type { Child, Item } from '../domain/types';
import { ItemCard } from './ItemCard';

interface Props {
  /** `YYYY-MM`. */
  month: string;
  child: Child;
  items: Item[];
  problemIds: Set<string>;
  onOpen(item: Item): void;
  onAdd(date: string): void;
  onToggleUnavailable(date: string): void;
}

interface DayProps extends Omit<Props, 'items'> {
  date: string;
  items: Item[];
}

function DayCell({
  date,
  month,
  child,
  items,
  problemIds,
  onOpen,
  onAdd,
  onToggleUnavailable,
}: DayProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${date}` });
  const unavailable = isUnavailable(child, date);
  const byWeekday = isUnavailableWeekday(child, date);
  const classes = [
    'day',
    monthOf(date) === month ? '' : 'day-outside',
    date === today() ? 'day-today' : '',
    unavailable ? 'day-unavailable' : '',
    date === child.finalDate ? 'day-final' : '',
    child.finalDate && date > child.finalDate ? 'day-late' : '',
    isOver ? 'day-over' : '',
  ];
  return (
    <div ref={setNodeRef} className={classes.filter(Boolean).join(' ')}>
      <div className="day-head">
        <span className="day-number">{Number(date.slice(8))}</span>
        {date === child.finalDate && <span className="day-flag">Final date</span>}
        <span className="spacer" />
        <button
          type="button"
          className="day-action"
          title="Add an item on this day"
          aria-label={`Add an item on ${date}`}
          onClick={() => onAdd(date)}
        >
          +
        </button>
        <button
          type="button"
          className="day-action"
          disabled={byWeekday}
          title={
            byWeekday
              ? `${WEEKDAYS[weekday(date)]}s are unavailable (change in Settings)`
              : unavailable
                ? 'Mark as available'
                : 'Mark as unavailable'
          }
          aria-label={`Toggle availability of ${date}`}
          onClick={() => onToggleUnavailable(date)}
        >
          {unavailable ? '⊘' : '○'}
        </button>
      </div>
      {items.map((item) => (
        <ItemCard
          key={item.id}
          item={item}
          variant="chip"
          problem={problemIds.has(item.id)}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}

export function CalendarGrid(props: Props) {
  const byDate = new Map<string, Item[]>();
  for (const item of props.items) {
    if (item.date) byDate.set(item.date, [...(byDate.get(item.date) ?? []), item]);
  }
  return (
    <div className="calendar">
      {WEEKDAYS.map((d) => (
        <div key={d} className="calendar-weekday">
          {d}
        </div>
      ))}
      {monthGrid(props.month)
        .flat()
        .map((date) => (
          <DayCell key={date} {...props} date={date} items={byDate.get(date) ?? []} />
        ))}
    </div>
  );
}
