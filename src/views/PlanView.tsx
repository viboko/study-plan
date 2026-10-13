import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useState } from 'react';
import { AutoScheduleDialog } from '../components/AutoScheduleDialog';
import { Backlog } from '../components/Backlog';
import { CalendarGrid } from '../components/CalendarGrid';
import { ItemCardBody, subjectClass } from '../components/ItemCard';
import { ItemForm, blankItem } from '../components/ItemForm';
import { addMonths, daysBetween, formatDate, formatMonth, monthOf, today } from '../domain/dates';
import { findProblems, toggleUnavailableDate } from '../domain/rules';
import type { Child, Item } from '../domain/types';
import { usePlan } from '../state/PlanContext';

function Progress({ items }: { items: Item[] }) {
  const sessions = items.filter((i) => i.type === 'Session');
  const papers = items.filter((i) => i.type === 'Paper');
  const groups = [
    ...[...new Set(sessions.map((i) => i.subject))].map((subject) => ({
      name: subject,
      className: subjectClass(subject),
      items: sessions.filter((i) => i.subject === subject),
    })),
    ...(papers.length ? [{ name: 'Papers', className: 'subject-papers', items: papers }] : []),
  ];
  return (
    <div className="progress">
      {groups.map((g) => {
        const done = g.items.filter((i) => i.completed).length;
        return (
          <div key={g.name} className={`progress-item ${g.className}`}>
            <span>
              {g.name} {done}/{g.items.length}
            </span>
            <progress value={done} max={g.items.length} />
          </div>
        );
      })}
    </div>
  );
}

function deadline(child: Child): string {
  if (!child.finalDate) return 'No final date set (see Settings)';
  const left = daysBetween(today(), child.finalDate);
  const when =
    left > 0 ? `${left} day${left === 1 ? '' : 's'} left` : left === 0 ? 'today' : 'passed';
  return `Final date: ${formatDate(child.finalDate)} · ${when}`;
}

export function PlanView() {
  const { child, items, apply } = usePlan();
  const [month, setMonth] = useState(() => monthOf(today()));
  const [editing, setEditing] = useState<{ item: Item; isNew: boolean } | null>(null);
  const [scheduling, setScheduling] = useState(false);
  const [dragging, setDragging] = useState<Item | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  if (!child) {
    return <p className="empty">Add a child in Settings to start planning.</p>;
  }

  const problems = findProblems(child, items);
  const problemIds = new Set(problems.flatMap((p) => p.itemIds));
  const unplanned = items.filter((i) => !i.date && !i.completed).length;

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(null);
    const item = items.find((i) => i.id === active.id);
    if (!item || !over) return;
    const target = String(over.id);
    const date = target === 'backlog' ? null : target.replace('day:', '');
    if (date === item.date) return;
    // An item back in the backlog can't still be completed.
    apply({
      kind: 'upsertItems',
      items: [{ ...item, date, completed: date ? item.completed : false }],
    });
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={({ active }) => setDragging(items.find((i) => i.id === active.id) ?? null)}
      onDragCancel={() => setDragging(null)}
      onDragEnd={onDragEnd}
    >
      <section className="summary">
        <strong>{deadline(child)}</strong>
        <Progress items={items} />
      </section>

      <div className="plan">
        <div className="plan-side">
          <Backlog items={items} onOpen={(item) => setEditing({ item, isNew: false })} />
          <button
            type="button"
            onClick={() => setEditing({ item: blankItem(child.name, 'Session'), isNew: true })}
          >
            + Add item
          </button>
        </div>

        <div className="plan-main">
          <div className="toolbar">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setMonth(addMonths(month, -1))}
            >
              ‹
            </button>
            <h2 className="month-title">{formatMonth(month)}</h2>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setMonth(addMonths(month, 1))}
            >
              ›
            </button>
            <button type="button" onClick={() => setMonth(monthOf(today()))}>
              Today
            </button>
            <span className="spacer" />
            <button
              type="button"
              className="primary"
              disabled={unplanned === 0}
              onClick={() => setScheduling(true)}
            >
              Auto-schedule unplanned…
            </button>
          </div>

          <CalendarGrid
            month={month}
            child={child}
            items={items}
            problemIds={problemIds}
            onOpen={(item) => setEditing({ item, isNew: false })}
            onAdd={(date) =>
              setEditing({ item: blankItem(child.name, 'Session', date), isNew: true })
            }
            onToggleUnavailable={(date) =>
              apply({ kind: 'upsertChild', child: toggleUnavailableDate(child, date) })
            }
          />

          <section className="problems">
            <h2>Problems ({problems.length})</h2>
            {problems.length === 0 ? (
              <p className="muted">
                No rule breaks.
                {unplanned > 0 &&
                  ` ${unplanned} item${unplanned === 1 ? ' is' : 's are'} still unplanned.`}
              </p>
            ) : (
              <ul>
                {problems.map((p) => (
                  <li key={p.message}>
                    <button
                      type="button"
                      className="link"
                      onClick={() => {
                        const item = items.find((i) => i.id === p.itemIds[0]);
                        if (item?.date) setMonth(monthOf(item.date));
                      }}
                    >
                      {p.message}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {dragging && <ItemCardBody item={dragging} variant="chip" />}
      </DragOverlay>

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
      {scheduling && (
        <AutoScheduleDialog
          child={child}
          items={items}
          onApply={(scheduled) => apply({ kind: 'upsertItems', items: scheduled })}
          onClose={() => setScheduling(false)}
        />
      )}
    </DndContext>
  );
}
