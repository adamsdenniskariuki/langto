import { describe, expect, it } from 'vitest';
import { Ring } from '../src/components/Ring.jsx';
import { Flag } from '../src/components/Flag.jsx';

// Preact 11 no longer appends "px" to numeric style values, so sizes must be strings.
describe('UI components', () => {
  it('Ring sizes itself with explicit px units', () => {
    const v = Ring({ value: 5, max: 20, size: 92, label: 'x' });
    expect(v.props.style).toEqual({ width: '92px', height: '92px' });
  });

  it('Flag draws an SVG for known languages and a text badge otherwise', () => {
    const de = Flag({ code: 'de' });
    expect(de.type).toBe('svg');
    expect(de.props.children).toHaveLength(3);
    const xx = Flag({ code: 'xx' });
    expect(xx.type).toBe('span');
    expect(xx.props.children).toBe('XX');
  });
});
