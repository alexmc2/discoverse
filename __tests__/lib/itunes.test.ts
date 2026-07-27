/**
 * @jest-environment node
 */
import { matchITunesTracks } from '@/lib/itunes';

describe('matchITunesTracks', () => {
  it('matches punctuation, diacritics, and edition suffix variations', () => {
    const matches = matchITunesTracks(
      'Beyoncé',
      [
        { name: 'Crazy in Love' },
        { name: 'Halo - Live Version' },
      ],
      [
        {
          artistName: 'Beyonce',
          trackName: 'Crazy In Love',
          previewUrl: 'https://audio.example/crazy.m4a',
        },
        {
          artistName: 'Beyoncé',
          trackName: 'Halo (Live)',
          previewUrl: 'https://audio.example/halo.m4a',
        },
      ]
    );

    expect(matches.map((match) => match.previewUrl)).toEqual([
      'https://audio.example/crazy.m4a',
      'https://audio.example/halo.m4a',
    ]);
  });

  it('prefers an exact title over an edition-normalized title', () => {
    const matches = matchITunesTracks(
      'Duran Duran',
      [{ name: 'Rio' }],
      [
        {
          artistName: 'Duran Duran',
          trackName: 'Rio (2009 Remaster)',
          previewUrl: 'https://audio.example/remaster.m4a',
        },
        {
          artistName: 'Duran Duran',
          trackName: 'Rio',
          previewUrl: 'https://audio.example/exact.m4a',
        },
      ]
    );

    expect(matches[0].previewUrl).toBe(
      'https://audio.example/exact.m4a'
    );
  });

  it('accepts a collaboration led by the requested artist', () => {
    const matches = matchITunesTracks(
      'David Bowie',
      [{ name: 'Under Pressure' }],
      [
        {
          artistName: 'David Bowie & Queen',
          trackName: 'Under Pressure',
          previewUrl: 'https://audio.example/pressure.m4a',
        },
      ]
    );

    expect(matches[0].previewUrl).toBe(
      'https://audio.example/pressure.m4a'
    );
  });

  it('never substitutes a similarly named artist or a different title', () => {
    const matches = matchITunesTracks(
      'Japan',
      [{ name: 'Ghosts' }, { name: 'Quiet Life' }],
      [
        {
          artistName: 'The Vapors',
          trackName: 'Turning Japanese',
          previewUrl: 'https://audio.example/wrong-artist.m4a',
        },
        {
          artistName: 'Japan',
          trackName: 'Life in Tokyo',
          previewUrl: 'https://audio.example/wrong-title.m4a',
        },
      ]
    );

    expect(matches).toEqual([
      { previewUrl: null },
      { previewUrl: null },
    ]);
  });
});
