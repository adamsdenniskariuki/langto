import { describe, expect, it } from 'vitest';
import { finishOnboarding, welcomeReturn } from '../src/views/Onboarding.jsx';
import { parseHash } from '../src/router.js';

describe('replaying the welcome tour', () => {
  it('routes #/welcome and returns to where it was opened', () => {
    expect(parseHash('#/welcome/settings')).toEqual({ name: 'welcome', params: ['settings'] });
    expect(welcomeReturn('settings')).toBe('#/settings');
    expect(welcomeReturn(undefined)).toBe('#/');
  });

  it('finishing a replay leaves progress and onboarding state untouched', () => {
    const state = { onboarded: true, xp: 120, streak: { count: 4 }, badges: ['first'], settings: { lang: 'de', dailyGoal: 30 } };
    const before = JSON.stringify(state);
    finishOnboarding(state, true);
    expect(JSON.stringify(state)).toBe(before);
    const fresh = { onboarded: false };
    finishOnboarding(fresh, false);
    expect(fresh.onboarded).toBe(true);
  });
});
