import { useState } from 'react';
import { WEEKDAYS, formatDate } from '../domain/dates';
import { newChild, type Child } from '../domain/types';
import { calendarName } from '../google/calendarSync';
import { usePlan } from '../state/PlanContext';
import { childNameError } from '../storage/rows';

interface ChildProps {
  child: Child;
  otherNames: string[];
}

function ChildSettings({ child, otherNames }: ChildProps) {
  const { plan, apply, selectChild } = usePlan();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const save = (changes: Partial<Child>) =>
    apply({ kind: 'upsertChild', child: { ...child, ...changes } });

  const rename = () => {
    const name = window.prompt('New name', child.name)?.trim();
    if (!name || name === child.name) return;
    const error = childNameError(name, otherNames);
    if (error) return window.alert(error);
    apply({ kind: 'upsertChild', child: { ...child, name }, previousName: child.name });
    selectChild(name);
  };

  const remove = () => {
    const count = plan.items.filter((i) => i.child === child.name).length;
    const message = `Remove ${child.name}? This deletes their worksheet (${count} item${count === 1 ? '' : 's'}) and their calendar. It cannot be undone.`;
    if (window.confirm(message)) apply({ kind: 'deleteChild', name: child.name });
  };

  const addRange = () => {
    if (!from) return;
    const range = { from, to: to && to >= from ? to : from };
    const unavailableDates = [...child.unavailableDates, range].sort((a, b) =>
      a.from.localeCompare(b.from),
    );
    save({ unavailableDates });
    setFrom('');
    setTo('');
  };

  return (
    <section className="card">
      <header className="card-header">
        <h3>{child.name}</h3>
        <span className="spacer" />
        <button type="button" onClick={rename}>
          Rename
        </button>
        <button type="button" className="danger" onClick={remove}>
          Remove
        </button>
      </header>
      <div className="settings-grid">
        <label>
          Final date
          <input
            type="date"
            value={child.finalDate ?? ''}
            onChange={(e) => save({ finalDate: e.target.value || null })}
          />
        </label>
        <label>
          Max items per day
          <input
            type="number"
            min={1}
            max={10}
            value={child.maxPerDay}
            onChange={(e) => save({ maxPerDay: Math.max(1, Math.floor(Number(e.target.value))) })}
          />
        </label>
        <fieldset>
          <legend>Unavailable every</legend>
          {WEEKDAYS.map((name, day) => (
            <label key={name} className="check">
              <input
                type="checkbox"
                checked={child.unavailableWeekdays.includes(day)}
                onChange={(e) =>
                  save({
                    unavailableWeekdays: e.target.checked
                      ? [...child.unavailableWeekdays, day].sort()
                      : child.unavailableWeekdays.filter((d) => d !== day),
                  })
                }
              />
              {name}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>Unavailable dates</legend>
          {child.unavailableDates.length === 0 && <span className="muted">None</span>}
          <ul className="ranges">
            {child.unavailableDates.map((r, index) => (
              <li key={`${r.from}-${r.to}-${index}`}>
                {r.from === r.to
                  ? formatDate(r.from)
                  : `${formatDate(r.from)} – ${formatDate(r.to)}`}
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Remove these dates"
                  onClick={() =>
                    save({ unavailableDates: child.unavailableDates.filter((_, i) => i !== index) })
                  }
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          <div className="toolbar">
            <input
              type="date"
              aria-label="From"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
            <span>to</span>
            <input
              type="date"
              aria-label="To (optional)"
              min={from}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
            <button type="button" disabled={!from} onClick={addRange}>
              Add
            </button>
          </div>
        </fieldset>
      </div>
    </section>
  );
}

interface Props {
  clientId: string | null;
  onSignOut(): void;
}

export function SettingsView({ clientId, onSignOut }: Props) {
  const { plan, apply, selectChild, store, demo, resyncCalendar, refreshing, status } = usePlan();
  const names = plan.children.map((c) => c.name);
  const url = store.spreadsheetUrl?.();

  const addChild = () => {
    const name = window.prompt("Child's name")?.trim();
    if (!name) return;
    const error = childNameError(name, names);
    if (error) return window.alert(error);
    apply({ kind: 'upsertChild', child: newChild(name) });
    selectChild(name);
  };

  return (
    <>
      <div className="toolbar">
        <h2>Children</h2>
        <span className="spacer" />
        <button type="button" className="primary" onClick={addChild}>
          + Add child
        </button>
      </div>
      {plan.children.length === 0 && <p className="empty">No children yet.</p>}
      {plan.children.map((child) => (
        <ChildSettings
          key={child.name}
          child={child}
          otherNames={names.filter((n) => n !== child.name)}
        />
      ))}

      <h2>Google</h2>
      <section className="card">
        {demo ? (
          <p>
            This is the demo: changes stay in this browser tab and are lost when you leave.{' '}
            <button type="button" className="link" onClick={onSignOut}>
              Exit the demo
            </button>{' '}
            to connect your own Google account.
          </p>
        ) : (
          <dl className="facts">
            <dt>Spreadsheet</dt>
            <dd>
              {url ? (
                <a href={url} target="_blank" rel="noreferrer">
                  Open “Study Plan” in Google Sheets
                </a>
              ) : (
                '—'
              )}
            </dd>
            <dt>Calendars</dt>
            <dd>
              {names.map(calendarName).join(', ') || '—'}{' '}
              <button
                type="button"
                disabled={refreshing || status.state !== 'saved'}
                title="Make the calendars match the plan exactly"
                onClick={() => void resyncCalendar()}
              >
                Resync calendar
              </button>
            </dd>
            <dt>Client ID</dt>
            <dd>
              <code>{clientId}</code>{' '}
              <button type="button" onClick={onSignOut}>
                Sign out
              </button>
            </dd>
          </dl>
        )}
      </section>
    </>
  );
}
