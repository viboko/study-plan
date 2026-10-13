import { newChild, type Child, type Item } from '../src/domain/types';

let counter = 0;

export function item(rest: Partial<Item> = {}): Item {
  counter += 1;
  return {
    id: `i${counter}`,
    child: 'Alice',
    type: 'Session',
    book: 'Book',
    subject: 'Maths',
    category: 'Number',
    title: `Item ${counter}`,
    minutes: null,
    date: null,
    completed: false,
    ...rest,
  };
}

export function paper(rest: Partial<Item> = {}): Item {
  return item({ type: 'Paper', category: '', minutes: 50, ...rest });
}

export function child(rest: Partial<Child> = {}): Child {
  return { ...newChild('Alice'), finalDate: '2026-10-31', ...rest };
}
