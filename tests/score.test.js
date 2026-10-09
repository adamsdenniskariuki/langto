import { describe, expect, it } from 'vitest';
import { checkTyped, deNumber, isOpen, normalize, PASS, scoreSpeech, similarity } from '../src/lib/score.js';

describe('normalize', () => {
  it('lowercases, strips punctuation and folds ß', () => {
    expect(normalize('Wie heißt du?')).toBe('wie heisst du');
  });
  it('spells out digits the way speech recognition may return them', () => {
    expect(normalize('Ich bin 25')).toBe(normalize('Ich bin fünfundzwanzig'));
    expect(normalize('Um 8:00 Uhr')).toBe(normalize('um acht Uhr'));
  });
});

describe('deNumber', () => {
  it('handles German compound numbers', () => {
    expect(deNumber(1)).toBe('eins');
    expect(deNumber(21)).toBe('einundzwanzig');
    expect(deNumber(17)).toBe('siebzehn');
    expect(deNumber(100)).toBe('einhundert');
  });
});

describe('scoreSpeech', () => {
  it('gives a perfect score for an exact match regardless of case/punctuation', () => {
    const r = scoreSpeech('Guten Morgen!', ['guten morgen']);
    expect(r.score).toBe(1);
    expect(r.words.every((w) => w.ok)).toBe(true);
  });
  it('picks the best of several recognition alternatives and accepted answers', () => {
    const r = scoreSpeech(['Mir geht es gut.', 'Gut, danke.'], ['gut danke', 'gute dank']);
    expect(r.score).toBe(1);
    expect(r.answer).toBe('Gut, danke.');
  });
  it('passes near misses and fails unrelated speech', () => {
    expect(scoreSpeech('Ich heiße Anna', ['ich heisse anne']).score).toBeGreaterThanOrEqual(PASS);
    expect(scoreSpeech('Ich heiße Anna', ['wo ist der bahnhof']).score).toBeLessThan(PASS);
  });
  it('treats answers ending with … as open-ended', () => {
    expect(isOpen('Ich heiße …')).toBe(true);
    expect(scoreSpeech('Ich heiße …', ['ich heiße maximilian']).score).toBeGreaterThanOrEqual(PASS);
  });
  it('handles empty input safely', () => {
    expect(scoreSpeech('Hallo', []).score).toBe(0);
  });
});

describe('checkTyped', () => {
  it('accepts small typos but not wrong answers', () => {
    expect(checkTyped('Danke schön', 'danke schon')).toBe(true);
    expect(checkTyped('Danke schön', 'bitte')).toBe(false);
  });
  it('similarity is symmetric and bounded', () => {
    expect(similarity('abc', 'abc')).toBe(1);
    expect(similarity('', 'abc')).toBeGreaterThanOrEqual(0);
  });
});
