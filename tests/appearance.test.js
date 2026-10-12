import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_FONT, DEFAULT_THEME, FONTS, THEMES, migrateAppearance, setAppearance } from '../src/lib/appearance.js';
import { exportData, migrate, parseImport } from '../src/lib/store.js';

const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

describe('appearance defaults and migration', () => {
  it('new learners get the default theme and font, not yet "chosen"', () => {
    const s = migrate(undefined);
    expect(s.settings).toMatchObject({ theme: DEFAULT_THEME, font: DEFAULT_FONT, themeChosen: false, fontChosen: false });
    expect(DEFAULT_THEME).not.toBe('system');
    expect(DEFAULT_FONT).not.toBe('system');
  });

  it('old saves still on the old default move to the new default', () => {
    const s = migrate({ xp: 5, settings: { theme: 'system', font: 'system' } });
    expect(s.settings).toMatchObject({ theme: DEFAULT_THEME, font: DEFAULT_FONT, themeChosen: false, fontChosen: false });
  });

  it('old saves with an explicit pick keep it', () => {
    const s = migrate({ settings: { theme: 'sepia', font: 'lexend' } });
    expect(s.settings).toMatchObject({ theme: 'sepia', font: 'lexend', themeChosen: true, fontChosen: true });
    const mixed = migrate({ settings: { theme: 'system', font: 'dyslexic' } });
    expect(mixed.settings).toMatchObject({ theme: DEFAULT_THEME, font: 'dyslexic', fontChosen: true });
  });

  it('an explicit pick of Classic (system) after the change is kept', () => {
    const s = migrate({ settings: { theme: 'system', themeChosen: true, font: 'system', fontChosen: true } });
    expect(s.settings).toMatchObject({ theme: 'system', font: 'system' });
  });

  it('unchosen settings follow whatever the default is', () => {
    const s = migrate({ settings: { theme: 'ocean', themeChosen: false } });
    expect(s.settings.theme).toBe(DEFAULT_THEME);
  });

  it('setAppearance marks the value as chosen', () => {
    const st = { theme: DEFAULT_THEME, themeChosen: false };
    setAppearance(st, 'theme', 'nord');
    expect(st).toMatchObject({ theme: 'nord', themeChosen: true });
    setAppearance(st, 'dailyGoal', 20);
    expect(st.dailyGoalChosen).toBeUndefined();
  });

  it('migrateAppearance tolerates missing raw settings', () => {
    const st = { theme: 'x', font: 'y' };
    migrateAppearance(st, undefined);
    expect(st).toMatchObject({ theme: DEFAULT_THEME, font: DEFAULT_FONT });
  });

  it('imports old-format backups and round-trips the chosen flags', () => {
    const old = JSON.stringify({ app: 'langto', format: 1, data: { xp: 9, lessons: {}, settings: { theme: 'forest', font: 'system' } } });
    const a = parseImport(old);
    expect(a.settings).toMatchObject({ theme: 'forest', themeChosen: true, font: DEFAULT_FONT, fontChosen: false });
    const legacy = parseImport(JSON.stringify({ app: 'langto', format: 1, data: { xp: 1, lessons: {}, settings: { theme: 'system' } } }));
    expect(legacy.settings.theme).toBe(DEFAULT_THEME);
    expect(typeof exportData()).toBe('string');
  });
});

describe('theme and font definitions', () => {
  it('every theme has a CSS block and every web font a data-font rule', () => {
    for (const t of THEMES) expect(css, t.id).toContain(`[data-theme='${t.id}']`);
    for (const f of FONTS) {
      if (f.id === 'system') continue;
      expect(css, f.id).toContain(`[data-font='${f.id}']`);
      expect(css, f.id).toContain(`[data-font-preview='${f.id}']`);
    }
    expect(THEMES.some((t) => t.id === DEFAULT_THEME)).toBe(true);
    expect(FONTS.some((f) => f.id === DEFAULT_FONT)).toBe(true);
  });

  // WCAG 2.x relative luminance / contrast ratio.
  const lum = (hex) => {
    const h = hex.replace('#', '').slice(0, 6);
    const c = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  const blocks = [];
  const re = /(@media \(prefers-color-scheme: dark\) \{\s*)?((?:\[data-theme='[a-z]+'\],?\s*|:root,\s*)+)\{([^}]*)\}/g;
  for (const m of css.matchAll(re)) {
    const vars = Object.fromEntries([...m[3].matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})\b/gi)].map((x) => [x[1], x[2]]));
    if (!vars.bg) continue;
    const ids = [...m[2].matchAll(/data-theme='([a-z]+)'/g)].map((x) => x[1]);
    blocks.push({ name: ids.join('/') + (m[1] ? ' (dark)' : ''), vars });
  }
  const pairs = [
    ['text', 'bg'], ['text', 'surface'], ['text', 'surface-2'],
    ['muted', 'bg'], ['muted', 'surface'], ['muted', 'surface-2'],
    ['on-primary', 'primary'], ['on-primary', 'primary-2'], ['primary', 'bg'], ['primary', 'surface'],
    ['success', 'success-bg'], ['warn', 'warn-bg'], ['danger', 'danger-bg'],
    ['success', 'surface'], ['warn', 'surface'], ['danger', 'surface'],
  ];

  it('finds a colour block for every theme', () => {
    const covered = new Set(blocks.flatMap((b) => b.name.replace(' (dark)', '').split('/')));
    for (const t of THEMES) expect(covered.has(t.id), t.id).toBe(true);
  });

  it.each(blocks.map((b) => [b.name, b]))('%s meets WCAG AA (4.5:1) for text pairs', (_name, b) => {
    for (const [fg, bg] of pairs) {
      if (!b.vars[fg] || !b.vars[bg]) continue;
      expect(ratio(b.vars[fg], b.vars[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
