import { describe, expect, it } from 'vitest';
import { acceptedStrings, matchKeysForQuiz, normalize } from './normalize';

describe('normalize', () => {
  it('strips accents', () => {
    expect(normalize('Curaçao')).toBe('curacao');
    expect(normalize('São Tomé and Príncipe')).toBe('sao tome and principe');
    expect(normalize('Côte d’Ivoire')).toBe('cote divoire');
  });

  it('lowercases', () => {
    expect(normalize('FRANCE')).toBe('france');
  });

  it('replaces & with and', () => {
    expect(normalize('Trinidad & Tobago')).toBe('trinidad and tobago');
    expect(normalize('Trinidad&Tobago')).toBe('trinidad and tobago');
  });

  it('removes punctuation', () => {
    expect(normalize('St. Kitts')).toBe('st kitts');
    expect(normalize('Guinea-Bissau')).toBe('guineabissau');
    expect(normalize('U.K.')).toBe('uk');
    expect(normalize("Hawai'i!?")).toBe('hawaii');
  });

  it('collapses whitespace and trims', () => {
    expect(normalize('  new    zealand \t')).toBe('new zealand');
    expect(normalize('new\nzealand')).toBe('new zealand');
  });

  it('strips a leading "the"', () => {
    expect(normalize('The Netherlands')).toBe('netherlands');
    expect(normalize('  THE  Gambia')).toBe('gambia');
    expect(normalize('Theodore')).toBe('theodore');
    expect(normalize('the')).toBe('the');
    expect(normalize('Of the Rings')).toBe('of the rings');
  });

  it('keeps digits and non-Latin letters', () => {
    expect(normalize('Apollo 11')).toBe('apollo 11');
    expect(normalize('Ελλάδα')).toBe('ελλαδα');
  });

  it('returns empty for punctuation-only input', () => {
    expect(normalize('...')).toBe('');
    expect(normalize('   ')).toBe('');
  });
});

describe('acceptedStrings', () => {
  it('includes display and aliases, deduped', () => {
    expect(acceptedStrings({ display: 'United Kingdom', aliases: ['UK', 'U.K.', 'united kingdom'] })).toEqual([
      'united kingdom',
      'uk',
    ]);
  });
});

describe('matchKeysForQuiz', () => {
  it('adds punctuation-as-space variants', () => {
    const [keys] = matchKeysForQuiz([{ display: 'Guinea-Bissau', aliases: [] }]);
    expect(keys).toEqual(['guineabissau', 'guinea bissau']);
  });

  it('drops a variant that would collide with another answer', () => {
    const keys = matchKeysForQuiz([
      { display: 'Foo-Bar', aliases: [] },
      { display: 'Foo Bar', aliases: [] },
    ]);
    expect(keys[0]).toEqual(['foobar']);
    expect(keys[1]).toEqual(['foo bar']);
  });
});
