import { describe, it, expect } from 'vitest';
import { getRandomArtists } from '@/lib/server/random-artists';
import { POPULAR_ARTISTS_POOL } from '@/lib/popular-artists';

describe('getRandomArtists', () => {
  it('returns the requested number of artists', () => {
    const result = getRandomArtists(4);
    expect(result).toHaveLength(4);
  });

  it('defaults to 4 artists', () => {
    const result = getRandomArtists();
    expect(result).toHaveLength(4);
  });

  it('returns artists from the pool', () => {
    const result = getRandomArtists(10);
    for (const artist of result) {
      expect(POPULAR_ARTISTS_POOL).toContain(artist);
    }
  });

  it('returns unique artists (no duplicates)', () => {
    const result = getRandomArtists(10);
    const unique = new Set(result);
    expect(unique.size).toBe(result.length);
  });

  it('handles count of 1', () => {
    const result = getRandomArtists(1);
    expect(result).toHaveLength(1);
  });

  it('handles count of 0', () => {
    const result = getRandomArtists(0);
    expect(result).toHaveLength(0);
  });
});
