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

describe('matchITunesTracks duplicate handling', () => {
  it('does not give two distinct tracks the same Apple recording', () => {
    // A title and its remaster both canonicalise to the same name, so before
    // this guard they both resolved to the single best result and the panel
    // showed one preview twice.
    const results = [
      {
        artistName: 'Duran Duran',
        trackName: 'Ordinary World',
        previewUrl: 'https://audio.example/ordinary.m4a',
        collectionName: 'Duran Duran (The Wedding Album)',
        trackTimeMillis: 340200,
      },
      {
        artistName: 'Duran Duran',
        trackName: 'Ordinary World (Live)',
        previewUrl: 'https://audio.example/ordinary-live.m4a',
        collectionName: 'Live 2005',
        trackTimeMillis: 267000,
      },
    ];

    // Both requests canonicalise to "ordinary world" and score identically
    // against the first result, so without the claim guard they both take it.
    const matches = matchITunesTracks(
      'Duran Duran',
      [
        { name: 'Ordinary World - 2010 Remaster', artist: 'Duran Duran' },
        { name: 'Ordinary World - Live Version', artist: 'Duran Duran' },
      ],
      results
    );

    expect(matches[0].previewUrl).toBe('https://audio.example/ordinary.m4a');
    expect(matches[1].previewUrl).toBe(
      'https://audio.example/ordinary-live.m4a'
    );
    expect(matches[1].previewUrl).not.toBe(matches[0].previewUrl);
  });

  it('still matches when the same title is genuinely requested twice', () => {
    const results = [
      {
        artistName: 'Radiohead',
        trackName: 'Creep',
        previewUrl: 'https://audio.example/creep.m4a',
      },
    ];

    const matches = matchITunesTracks(
      'Radiohead',
      [
        { name: 'Creep', artist: 'Radiohead' },
        { name: 'Creep', artist: 'Radiohead' },
      ],
      results
    );

    expect(matches[0].previewUrl).toBe('https://audio.example/creep.m4a');
    expect(matches[1].previewUrl).toBe('https://audio.example/creep.m4a');
  });
});
