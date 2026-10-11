import { describe, expect, it } from 'vitest';
import { checkFree, frNumber, normalize, PASS, scoreSpeech } from '../src/lib/score.js';

describe('French scoring', () => {
  it('spells out French numbers', () => {
    expect(frNumber(1)).toBe('un');
    expect(frNumber(17)).toBe('dix-sept');
    expect(frNumber(21)).toBe('vingt et un');
    expect(frNumber(71)).toBe('soixante et onze');
    expect(frNumber(75)).toBe('soixante-quinze');
    expect(frNumber(80)).toBe('quatre-vingts');
    expect(frNumber(81)).toBe('quatre-vingt-un');
    expect(frNumber(99)).toBe('quatre-vingt-dix-neuf');
    expect(frNumber(200)).toBe('deux cents');
    expect(frNumber(342)).toBe('trois cent quarante-deux');
  });
  it('matches digits and times returned by the recogniser', () => {
    expect(normalize("J'ai 25 ans", 'fr')).toBe(normalize("J'ai vingt-cinq ans", 'fr'));
    expect(normalize('à 15h30', 'fr')).toBe(normalize('à quinze heures trente', 'fr'));
    expect(normalize('à 1h', 'fr')).toBe(normalize('à une heure', 'fr'));
    expect(normalize('à 8 h', 'fr')).toBe(normalize('à huit heures', 'fr'));
  });
  it('folds œ and apostrophes', () => {
    expect(normalize("Un œuf, s'il vous plaît !", 'fr')).toBe('un oeuf s il vous plaît');
    expect(scoreSpeech("C'est l'heure.", ['c est l heure'], 'fr').score).toBe(1);
  });
  it('scores French answers', () => {
    expect(scoreSpeech('Je m’appelle Claire.', ["je m'appelle claire"], 'fr').score).toBe(1);
    expect(scoreSpeech('Je voudrais un café.', ['je voudrais un cafe'], 'fr').score).toBeGreaterThanOrEqual(PASS);
    expect(scoreSpeech('Je voudrais un café.', ['où est la gare'], 'fr').score).toBeLessThan(PASS);
  });
  it('checks French free speaking with elided words', () => {
    const task = { targets: [{ label: 'likes', any: ["j'aime", 'j adore'] }, { label: 'sport', any: ['foot*', 'tennis'] }] };
    const r = checkFree("Moi, j'aime beaucoup le football.", task, { code: 'fr', commonWords: ['le'] });
    expect(r.hits).toEqual(['likes', 'sport']);
  });
});
