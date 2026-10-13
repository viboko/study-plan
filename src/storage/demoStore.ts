import { addDays, today, weekday } from '../domain/dates';
import { applyOp, newChild, newId, type Item, type Op, type Plan } from '../domain/types';
import type { Store } from './Store';

function samplePlan(): Plan {
  const start = today();
  const alice = {
    ...newChild('Alice'),
    finalDate: addDays(start, 70),
    unavailableWeekdays: [1],
    unavailableDates: [{ from: addDays(start, 20), to: addDays(start, 24) }],
  };
  const ben = { ...newChild('Ben'), finalDate: addDays(start, 120), maxPerDay: 2 };

  const item = (child: string, type: Item['type'], rest: Partial<Item>): Item => ({
    id: newId(),
    child,
    type,
    book: '',
    subject: 'English',
    category: '',
    title: '',
    minutes: null,
    date: null,
    completed: false,
    ...rest,
  });
  const sessions = (child: string, book: string, subject: string, topics: [string, string][]) =>
    topics.map(([category, title]) => item(child, 'Session', { book, subject, category, title }));

  const items = [
    ...sessions('Alice', 'Bond 11+ English 10-11', 'English', [
      ['Grammar', 'Parts of Speech'],
      ['Grammar', 'Tenses'],
      ['Punctuation', 'Commas and Apostrophes'],
      ['Spelling', 'Homophones'],
    ]),
    ...sessions('Alice', 'Bond 11+ Maths 10-11', 'Maths', [
      ['Number', 'Fractions'],
      ['Number', 'Percentages'],
      ['Geometry', 'Angles'],
      ['Algebra', 'Simple Equations'],
    ]),
    ...sessions('Alice', 'Bond 11+ Non-verbal Reasoning 10-11', 'Non-verbal Reasoning', [
      ['Shapes', 'Odd One Out'],
      ['Shapes', 'Rotations and Reflections'],
    ]),
    item('Alice', 'Paper', {
      book: 'Bond 11+ Maths Papers',
      subject: 'Maths',
      title: 'Paper 1',
      minutes: 50,
    }),
    item('Alice', 'Paper', {
      book: 'Bond 11+ English Papers',
      subject: 'English',
      title: 'Paper 1',
      minutes: 45,
    }),
    ...sessions('Ben', 'Bond 11+ Verbal Reasoning 9-10', 'Verbal Reasoning', [
      ['Codes', 'Letter Codes'],
      ['Words', 'Synonyms and Antonyms'],
      ['Words', 'Hidden Words'],
    ]),
  ];

  // Pre-plan a few of Alice's sessions on available days.
  const free = Array.from({ length: 14 }, (_, i) => addDays(start, i - 3)).filter(
    (d) => weekday(d) !== 1,
  );
  [0, 4, 1, 5].forEach((index, n) => {
    const planned = items[index];
    const date = free[n];
    if (planned && date) Object.assign(planned, { date, completed: date < start });
  });

  return { children: [alice, ben], items };
}

/** In-memory sample data; nothing leaves the browser. */
export class DemoStore implements Store {
  private plan = samplePlan();

  async load(): Promise<Plan> {
    return this.plan;
  }

  async apply(op: Op): Promise<void> {
    this.plan = applyOp(this.plan, op);
  }
}
