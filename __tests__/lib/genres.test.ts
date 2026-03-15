import { describe, it, expect } from 'vitest';
import {
  getGenreColor,
  GENRE_COLOR_MAP,
  GENRE_MATCH_ORDER,
} from '@/lib/genres';

describe('getGenreColor', () => {
  it('returns unknown color for undefined input', () => {
    expect(getGenreColor(undefined)).toBe(GENRE_COLOR_MAP.unknown);
  });

  it('returns unknown color for empty string', () => {
    expect(getGenreColor('')).toBe(GENRE_COLOR_MAP.unknown);
  });

  it('matches exact genre names', () => {
    expect(getGenreColor('rock')).toBe(GENRE_COLOR_MAP.rock);
    expect(getGenreColor('pop')).toBe(GENRE_COLOR_MAP.pop);
    expect(getGenreColor('jazz')).toBe(GENRE_COLOR_MAP.jazz);
    expect(getGenreColor('electronic')).toBe(GENRE_COLOR_MAP.electronic);
  });

  it('is case-insensitive', () => {
    expect(getGenreColor('Rock')).toBe(GENRE_COLOR_MAP.rock);
    expect(getGenreColor('JAZZ')).toBe(GENRE_COLOR_MAP.jazz);
    expect(getGenreColor('Hip Hop')).toBe(GENRE_COLOR_MAP['hip hop']);
  });

  it('matches subgenres via fuzzy contains', () => {
    // "alternative rock" doesn't literally contain "alt rock",
    // but it does contain "rock" so it matches rock via priority order
    expect(getGenreColor('alternative rock')).toBe(GENRE_COLOR_MAP.rock);
    // "shoegaze revival" contains "shoegaze"
    expect(getGenreColor('shoegaze revival')).toBe(GENRE_COLOR_MAP.shoegaze);
    expect(getGenreColor('deep house music')).toBe(GENRE_COLOR_MAP.house);
  });

  it('prefers more specific genres over parents', () => {
    // "post-punk" should match before "punk"
    expect(getGenreColor('post-punk revival')).toBe(GENRE_COLOR_MAP['post-punk']);
    // "indie rock" should match before "rock" or "indie"
    expect(getGenreColor('indie rock')).toBe(GENRE_COLOR_MAP['indie rock']);
    // "death metal" should match before "metal"
    expect(getGenreColor('death metal')).toBe(GENRE_COLOR_MAP['death metal']);
  });

  it('handles compound genres with separators', () => {
    expect(getGenreColor('rock / pop')).toBe(GENRE_COLOR_MAP.rock);
    expect(getGenreColor('jazz & blues')).toBe(GENRE_COLOR_MAP.jazz);
  });

  it('returns unknown for completely unrecognized genres', () => {
    expect(getGenreColor('underwater basket weaving')).toBe(
      GENRE_COLOR_MAP.unknown
    );
  });
});

describe('GENRE_MATCH_ORDER', () => {
  it('has specific genres before their parents', () => {
    const postPunkIdx = GENRE_MATCH_ORDER.indexOf('post-punk');
    const punkIdx = GENRE_MATCH_ORDER.indexOf('punk');
    expect(postPunkIdx).toBeLessThan(punkIdx);

    const indieRockIdx = GENRE_MATCH_ORDER.indexOf('indie rock');
    const rockIdx = GENRE_MATCH_ORDER.indexOf('rock');
    expect(indieRockIdx).toBeLessThan(rockIdx);

    const deathMetalIdx = GENRE_MATCH_ORDER.indexOf('death metal');
    const metalIdx = GENRE_MATCH_ORDER.indexOf('metal');
    expect(deathMetalIdx).toBeLessThan(metalIdx);
  });

  it('contains all entries that exist in GENRE_COLOR_MAP', () => {
    for (const key of GENRE_MATCH_ORDER) {
      expect(GENRE_COLOR_MAP).toHaveProperty(key);
    }
  });
});
