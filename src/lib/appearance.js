// Themes & fonts. Applied as data attributes on <html>; CSS variables do the rest.

export const THEMES = [
  { id: 'system', name: 'System', hint: 'Follows your device light/dark setting', swatch: ['#f7f7fb', '#0f1222'] },
  { id: 'light', name: 'Light', swatch: ['#f7f7fb', '#4f46e5'] },
  { id: 'dark', name: 'Dark', swatch: ['#0f1222', '#8b8cf8'] },
  { id: 'sepia', name: 'Sepia', swatch: ['#f4ecd8', '#9a5b13'] },
  { id: 'ocean', name: 'Ocean', swatch: ['#0b2530', '#2dd4bf'] },
  { id: 'forest', name: 'Forest', swatch: ['#eef5ec', '#2f7d4f'] },
  { id: 'sunset', name: 'Sunset', swatch: ['#fff4ee', '#e4572e'] },
  { id: 'contrast', name: 'High contrast', hint: 'Maximum legibility', swatch: ['#000000', '#ffd400'] },
];

const GF = (family) => `https://fonts.googleapis.com/css2?family=${family}&display=swap`;

export const FONTS = [
  { id: 'system', name: 'System default', sample: 'Guten Tag!' },
  { id: 'nunito', name: 'Nunito (rounded)', href: GF('Nunito:wght@400;600;800') },
  { id: 'literata', name: 'Literata (serif)', href: GF('Literata:wght@400;600;800') },
  { id: 'atkinson', name: 'Atkinson Hyperlegible', hint: 'Designed for low vision', href: GF('Atkinson+Hyperlegible:wght@400;700') },
  { id: 'lexend', name: 'Lexend', hint: 'Designed to reduce reading strain', href: GF('Lexend:wght@400;600;800') },
  { id: 'dyslexic', name: 'OpenDyslexic', hint: 'Dyslexia-friendly', href: 'https://fonts.cdnfonts.com/css/opendyslexic' },
  { id: 'mono', name: 'JetBrains Mono', href: GF('JetBrains+Mono:wght@400;700') },
];

function loadFont(id) {
  const f = FONTS.find((x) => x.id === id);
  if (!f?.href || document.querySelector(`link[data-font="${id}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = f.href;
  link.dataset.font = id;
  document.head.appendChild(link);
}

export function applyAppearance(settings) {
  const d = document.documentElement;
  d.dataset.theme = settings.theme || 'system';
  d.dataset.font = settings.font || 'system';
  d.style.setProperty('--font-scale', String(settings.fontScale || 1));
  loadFont(settings.font);
  const bg = getComputedStyle(d).getPropertyValue('--bg').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg || '#4f46e5');
}
