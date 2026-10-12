// Themes & fonts. Applied as data attributes on <html>; CSS variables do the rest.

// Defaults for anyone who hasn't picked a theme/font themselves (settings.themeChosen / fontChosen).
export const DEFAULT_THEME = 'atlas';
export const DEFAULT_FONT = 'andika';
// The defaults before themeChosen/fontChosen existed; saves still on these are treated as "never changed".
export const LEGACY_DEFAULT_THEME = 'system';
export const LEGACY_DEFAULT_FONT = 'system';
export const CHOSEN_FLAG = { theme: 'themeChosen', font: 'fontChosen' };

export const THEMES = [
  { id: 'atlas', name: 'Atlas', hint: 'Default · teal on warm paper, follows your device light/dark setting', swatch: ['#f5f2ec', '#0d655d'], adaptive: true },
  { id: 'system', name: 'Classic', hint: 'The original indigo look, follows your device light/dark setting', swatch: ['#f7f7fb', '#0f1222'], adaptive: true },
  { id: 'light', name: 'Light', swatch: ['#f7f7fb', '#4f46e5'] },
  { id: 'dark', name: 'Dark', swatch: ['#0f1222', '#8b8cf8'] },
  { id: 'midnight', name: 'Midnight', hint: 'True black, easy on OLED screens', swatch: ['#000000', '#8aa4ff'] },
  { id: 'nord', name: 'Nord', hint: 'Cool arctic blue-grey', swatch: ['#2e3440', '#88c0d0'] },
  { id: 'cafe', name: 'Café', hint: 'Warm espresso and caramel', swatch: ['#1f1712', '#e0a96d'] },
  { id: 'lavender', name: 'Lavender', swatch: ['#f6f3fc', '#6d3fc0'] },
  { id: 'desert', name: 'Desert', hint: 'Sand and terracotta', swatch: ['#f8efe2', '#9c4221'] },
  { id: 'sepia', name: 'Sepia', swatch: ['#f4ecd8', '#9a5b13'] },
  { id: 'ocean', name: 'Ocean', swatch: ['#0b2530', '#2dd4bf'] },
  { id: 'forest', name: 'Forest', swatch: ['#eef5ec', '#2f7d4f'] },
  { id: 'sunset', name: 'Sunset', swatch: ['#fff4ee', '#c2441b'] },
  { id: 'contrast', name: 'High contrast', hint: 'Maximum legibility', swatch: ['#000000', '#ffd400'] },
];

const GF = (family) => `https://fonts.googleapis.com/css2?family=${family}&display=swap`;

export const FONTS = [
  { id: 'andika', name: 'Andika', hint: 'Default · clear letterforms designed for language learners', href: GF('Andika:wght@400;700') },
  { id: 'system', name: 'System default' },
  { id: 'inter', name: 'Inter', hint: 'Crisp and neutral', href: GF('Inter:wght@400;600;800') },
  { id: 'outfit', name: 'Outfit', hint: 'Modern geometric', href: GF('Outfit:wght@400;600;800') },
  { id: 'nunito', name: 'Nunito (rounded)', href: GF('Nunito:wght@400;600;800') },
  { id: 'merriweather', name: 'Merriweather (serif)', hint: 'Sturdy serif for screens', href: GF('Merriweather:wght@400;700;900') },
  { id: 'literata', name: 'Literata (serif)', href: GF('Literata:wght@400;600;800') },
  { id: 'atkinson', name: 'Atkinson Hyperlegible', hint: 'Designed for low vision', href: GF('Atkinson+Hyperlegible+Next:wght@400;700') },
  { id: 'lexend', name: 'Lexend', hint: 'Designed to reduce reading strain', href: GF('Lexend:wght@400;600;800') },
  { id: 'dyslexic', name: 'OpenDyslexic', hint: 'Dyslexia-friendly', href: 'https://fonts.cdnfonts.com/css/opendyslexic' },
  { id: 'mono', name: 'JetBrains Mono', href: GF('JetBrains+Mono:wght@400;700') },
];

export function loadFont(id) {
  const f = FONTS.find((x) => x.id === id);
  if (!f?.href || document.querySelector(`link[data-font="${id}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = f.href;
  link.dataset.font = id;
  document.head.appendChild(link);
}

/** Load every web font, so the Settings font list can preview each one. */
export function loadAllFonts() {
  FONTS.forEach((f) => loadFont(f.id));
}

/** Record a theme/font picked by the user, so later default changes leave it alone. */
export function setAppearance(settings, key, value) {
  settings[key] = value;
  if (CHOSEN_FLAG[key]) settings[CHOSEN_FLAG[key]] = true;
}

/**
 * Bring appearance settings up to date. Saves made before the *Chosen flags existed count the old
 * default ('system') as "never changed"; anything never changed follows the current default.
 * `raw` is the settings object as stored/imported (may be undefined), `settings` the merged result.
 */
export function migrateAppearance(settings, raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const rows = [
    ['theme', LEGACY_DEFAULT_THEME, DEFAULT_THEME],
    ['font', LEGACY_DEFAULT_FONT, DEFAULT_FONT],
  ];
  for (const [key, legacy, current] of rows) {
    const flag = CHOSEN_FLAG[key];
    if (typeof src[flag] !== 'boolean') settings[flag] = src[key] != null && src[key] !== legacy;
    if (!settings[flag]) settings[key] = current;
  }
  return settings;
}

function syncThemeColor() {
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg || '#f5f2ec');
}

let schemeQuery;

export function applyAppearance(settings) {
  const d = document.documentElement;
  d.dataset.theme = settings.theme || DEFAULT_THEME;
  d.dataset.font = settings.font || DEFAULT_FONT;
  d.style.setProperty('--font-scale', String(settings.fontScale || 1));
  loadFont(d.dataset.font);
  syncThemeColor();
  // Adaptive themes change colour with the device setting; keep the browser chrome in step.
  if (!schemeQuery && typeof matchMedia === 'function') {
    schemeQuery = matchMedia('(prefers-color-scheme: dark)');
    schemeQuery.addEventListener?.('change', syncThemeColor);
  }
}
