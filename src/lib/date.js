// Local-date helpers. Dates are stored as YYYY-MM-DD in the learner's own time zone.

export function dateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key, n) {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

export function daysBetween(fromKey, toKey) {
  return Math.round((parseKey(toKey) - parseKey(fromKey)) / 86400000);
}

export function lastNDays(n, today = dateKey()) {
  return Array.from({ length: n }, (_, i) => addDays(today, i - (n - 1)));
}
