// Windows doesn't render regional-indicator flag emoji, so draw flags as SVG.
// Each flag is a list of stripes (h/v) plus an optional central emblem dot; unknown codes fall back to a code badge.
const FLAGS = {
  de: { dir: 'h', stripes: ['#000000', '#DD0000', '#FFCE00'] },
  fr: { dir: 'v', stripes: ['#0055A4', '#FFFFFF', '#EF4135'] },
  it: { dir: 'v', stripes: ['#009246', '#FFFFFF', '#CE2B37'] },
  nl: { dir: 'h', stripes: ['#AE1C28', '#FFFFFF', '#21468B'] },
  es: { dir: 'h', stripes: ['#AA151B', '#F1BF00', '#F1BF00', '#AA151B'] },
  at: { dir: 'h', stripes: ['#ED2939', '#FFFFFF', '#ED2939'] },
  mx: { dir: 'v', stripes: ['#006847', '#FFFFFF', '#CE1126'], dot: '#8C5A2B' },
  ar: { dir: 'h', stripes: ['#74ACDF', '#FFFFFF', '#74ACDF'], dot: '#F6B40E' },
  co: { dir: 'h', stripes: ['#FCD116', '#FCD116', '#003893', '#CE1126'] },
  pe: { dir: 'v', stripes: ['#D91023', '#FFFFFF', '#D91023'] },
  be: { dir: 'v', stripes: ['#000000', '#FDDA24', '#EF3340'] },
};

export function Flag({ code, size = '1em', label }) {
  const f = FLAGS[code];
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': 'true' };
  if (!f) {
    return (
      <span class="flag-badge" {...a11y}>
        {String(code || '?').toUpperCase()}
      </span>
    );
  }
  const n = f.stripes.length;
  return (
    <svg class="flag-svg" viewBox="0 0 30 20" style={{ height: size, width: 'auto' }} {...a11y}>
      {f.stripes.map((c, i) =>
        f.dir === 'h' ? (
          <rect key={i} x="0" y={(20 / n) * i} width="30" height={20 / n + 0.01} fill={c} />
        ) : (
          <rect key={i} x={(30 / n) * i} y="0" width={30 / n + 0.01} height="20" fill={c} />
        ),
      )}
      {f.dot && <circle cx="15" cy="10" r="2.6" fill={f.dot} />}
    </svg>
  );
}
