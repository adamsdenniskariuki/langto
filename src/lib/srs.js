// Leitner-style spaced repetition. Each phrase is a card in a box 0..7; higher box = longer interval.
import { addDays, dateKey } from './date.js';

export const INTERVALS = [0, 1, 2, 4, 7, 15, 30, 60];

export function newCard(today = dateKey()) {
  return { box: 1, due: addDays(today, INTERVALS[1]), seen: 0, lapses: 0 };
}

export function gradeCard(card, correct, today = dateKey()) {
  const c = { ...(card || newCard(today)) };
  c.seen += 1;
  if (correct) {
    c.box = Math.min(c.box + 1, INTERVALS.length - 1);
  } else {
    c.box = 1;
    c.lapses += 1;
  }
  c.due = addDays(today, correct ? INTERVALS[c.box] : 0);
  c.last = today;
  return c;
}

export function isDue(card, today = dateKey()) {
  return card && card.due <= today;
}

export function dueCards(cards, today = dateKey()) {
  return Object.entries(cards || {})
    .filter(([, c]) => isDue(c, today))
    .sort((a, b) => a[1].box - b[1].box || a[1].due.localeCompare(b[1].due))
    .map(([id]) => id);
}

// "Strength" 0..1 for display.
export function strength(card) {
  if (!card) return 0;
  return Math.min(1, card.box / (INTERVALS.length - 1));
}
