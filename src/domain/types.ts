export const SUBJECTS = [
  'English',
  'Maths',
  'Verbal Reasoning',
  'Non-verbal Reasoning',
  'English Comprehension',
] as const;

export type ItemType = 'Session' | 'Paper';

/** A study session or an example paper. Dates are ISO `YYYY-MM-DD` strings. */
export interface Item {
  id: string;
  child: string;
  type: ItemType;
  book: string;
  /** Normally one of SUBJECTS, but hand-edited sheets may hold anything. */
  subject: string;
  /** Sessions only; blank for papers. */
  category: string;
  title: string;
  /** Papers only. */
  minutes: number | null;
  /** Planned or completed date; null means not yet planned. */
  date: string | null;
  completed: boolean;
}

/** An inclusive range of dates; a single day has `from === to`. */
export interface DateRange {
  from: string;
  to: string;
}

export interface Child {
  name: string;
  /** The date by which everything must be completed. */
  finalDate: string | null;
  maxPerDay: number;
  /** 0 = Monday … 6 = Sunday. */
  unavailableWeekdays: number[];
  unavailableDates: DateRange[];
}

export interface Plan {
  children: Child[];
  items: Item[];
}

/** A change to the plan, applied optimistically in the UI and then persisted. */
export type Op =
  | { kind: 'upsertItems'; items: Item[] }
  | { kind: 'deleteItems'; items: Item[] }
  | { kind: 'upsertChild'; child: Child; previousName?: string }
  | { kind: 'deleteChild'; name: string };

export function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function newChild(name: string): Child {
  return { name, finalDate: null, maxPerDay: 1, unavailableWeekdays: [], unavailableDates: [] };
}

export function applyOp(plan: Plan, op: Op): Plan {
  switch (op.kind) {
    case 'upsertItems': {
      const incoming = new Map(op.items.map((i) => [i.id, i]));
      const items = plan.items.map((i) => {
        const next = incoming.get(i.id);
        if (next) incoming.delete(i.id);
        return next ?? i;
      });
      return { ...plan, items: [...items, ...incoming.values()] };
    }
    case 'deleteItems': {
      const ids = new Set(op.items.map((i) => i.id));
      return { ...plan, items: plan.items.filter((i) => !ids.has(i.id)) };
    }
    case 'upsertChild': {
      const oldName = op.previousName ?? op.child.name;
      const exists = plan.children.some((c) => c.name === oldName);
      const children = exists
        ? plan.children.map((c) => (c.name === oldName ? op.child : c))
        : [...plan.children, op.child];
      const items =
        oldName === op.child.name
          ? plan.items
          : plan.items.map((i) => (i.child === oldName ? { ...i, child: op.child.name } : i));
      return { children, items };
    }
    case 'deleteChild':
      return {
        children: plan.children.filter((c) => c.name !== op.name),
        items: plan.items.filter((i) => i.child !== op.name),
      };
  }
}
