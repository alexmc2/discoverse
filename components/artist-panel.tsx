// components/artist-panel.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import {
  X,
  ExternalLink,
  Music,
  Users,
  Play,
  Pause,
  Maximize2,
  Volume2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getArtistInfo,
  getTopTracks as getLastFmTopTracks,
} from '@/lib/lastfm';
import {
  getArtistImage,
  getArtistTopTracks,
  type SpotifyTrack,
} from '@/lib/spotify';

interface ArtistPanelProps {
  artistName: string | null;
  onClose: () => void;
  onExpand?: (artist: string) => void;
}

interface ArtistDetails {
  name: string;
  url: string;
  image?: string;
  listeners: number;
  playcount: number;
  bio?: string;
  tags: string[];
}

type TrackSource = 'spotify' | 'lastfm' | null;

export default function ArtistPanel({
  artistName,
  onClose,
  onExpand,
}: ArtistPanelProps) {
  const [artist, setArtist] = useState<ArtistDetails | null>(null);
  const [loading, setLoading] = useState(false);

  const [tracks, setTracks] = useState<SpotifyTrack[]>([]);
  const [loadingTracks, setLoadingTracks] = useState(false);
  const [trackSource, setTrackSource] = useState<TrackSource>(null);

  // Audio
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.6); // 0..1

  // -- Helpers ---------------------------------------------------------------

  const formatNumber = (num: number) => {
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return num.toString();
  };

  const formatMs = (ms?: number) => {
    if (!ms || ms <= 0) return '–:–';
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  // const playableTracks = useMemo(
  //   () => tracks.filter((t) => !!t.preview_url),
  //   [tracks]
  // );

  // -- Fetch artist ----------------------------------------------------------

  useEffect(() => {
    if (!artistName) {
      setArtist(null);
      setTracks([]);
      setTrackSource(null);
      // stop any audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      setPlayingTrackId(null);
      setIsPlaying(false);
      return;
    }

    const fetchArtistInfo = async () => {
      setLoading(true);
      try {
        const [info, spotifyImage] = await Promise.all([
          getArtistInfo(artistName),
          getArtistImage(artistName),
        ]);

        if (info) {
          setArtist({
            ...info,
            image: spotifyImage || info.image,
          });
        } else {
          setArtist(null);
        }
      } catch (error) {
        console.error('Failed to fetch artist info:', error);
        setArtist(null);
      } finally {
        setLoading(false);
      }
    };

    fetchArtistInfo();
  }, [artistName]);

  // -- Fetch tracks with fallback -------------------------------------------

  useEffect(() => {
    if (!artistName) return;

    const fetchTracks = async () => {
      setLoadingTracks(true);
      setTracks([]);
      setTrackSource(null);

      try {
        // 1) Try Spotify (preferred, supports previews)
        const spotifyTop = await getArtistTopTracks(artistName);
        if (spotifyTop && spotifyTop.length > 0) {
          setTracks(spotifyTop.slice(0, 10));
          setTrackSource('spotify');
          return;
        }

        // 2) Fallback to Last.fm (display only)
        const last = await getLastFmTopTracks(artistName, 10);
        if (last.length > 0) {
          // Map Last.fm to SpotifyTrack-like for display purposes
          const mapped: SpotifyTrack[] = last.map((t, idx) => ({
            id: `${artistName}-${t.name}-${idx}`,
            name: t.name,
            preview_url: null, // Last.fm has no preview
            duration_ms: 0,
            popularity: 0,
            album: {
              name: '—',
              images: [],
            },
            artists: [{ name: t.artist }],
          }));
          setTracks(mapped);
          setTrackSource('lastfm');
        }
      } catch (e) {
        console.error('Failed to fetch tracks:', e);
        setTracks([]);
        setTrackSource(null);
      } finally {
        setLoadingTracks(false);
      }
    };

    fetchTracks();
  }, [artistName]);

  // -- Audio controls --------------------------------------------------------

  // keep audio volume in sync
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current.load();
    }
    setPlayingTrackId(null);
    setIsPlaying(false);
  };

  const playPreview = async (track: SpotifyTrack) => {
    if (!track.preview_url) return;

    // If clicking the same track, toggle play/pause
    if (playingTrackId === track.id) {
      if (!audioRef.current) return;
      if (audioRef.current.paused) {
        await audioRef.current.play();
        setIsPlaying(true);
      } else {
        audioRef.current.pause();
        setIsPlaying(false);
      }
      return;
    }

    // Switching to a different track
    try {
      // ensure any existing audio is stopped
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current.load();
      }

      const audio = new Audio(track.preview_url);
      audioRef.current = audio;
      audio.preload = 'auto';
      audio.volume = volume;

      audio.onended = () => {
        setIsPlaying(false);
        setPlayingTrackId(null);
      };
      audio.onpause = () => setIsPlaying(false);
      audio.onplay = () => setIsPlaying(true);
      audio.onerror = () => {
        console.warn('Audio playback error');
        setIsPlaying(false);
        setPlayingTrackId(null);
      };

      setPlayingTrackId(track.id);
      await audio.play(); // user gesture: clicking the button should allow autoplay
      setIsPlaying(true);
    } catch (err) {
      console.error('Failed to play preview:', err);
      setIsPlaying(false);
      setPlayingTrackId(null);
    }
  };

  // cleanup on unmount or artist change
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
    };
  }, [artistName]);

  // -- UI --------------------------------------------------------------------

  return (
    <AnimatePresence>
      {artistName && (
        <>
          {/* Backdrop overlay to capture clicks outside */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-30"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-96 bg-gray-900/95 backdrop-blur-xl border-l border-gray-800 shadow-2xl z-40 overflow-y-auto"
          >
            <div className="relative">
              {/* Header */}
              <div className="sticky top-0 bg-gray-900/95 backdrop-blur-xl border-b border-gray-800 p-4 z-10">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-white">
                    Artist Details
                  </h2>
                  <button
                    onClick={() => {
                      stopAudio();
                      onClose();
                    }}
                    className="cursor-pointer p-2 rounded-lg transition-colors hover:bg-gradient-to-r hover:from-sky-900/30 hover:via-blue-900/30 hover:to-indigo-900/30"
                  >
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-2 border-r-transparent border-b-sky-500 border-l-blue-500 border-t-indigo-500" />
                </div>
              ) : artist ? (
                <div className="p-6 space-y-6">
                  {/* Artist Image & Name */}
                  <div className="text-center">
                    {artist.image ? (
                      <div className="relative w-32 h-32 mx-auto">
                        <Image
                          src={artist.image}
                          alt={artist.name}
                          fill
                          className="rounded-full object-cover shadow-lg ring-4 ring-sky-500/30"
                          sizes="128px"
                        />
                      </div>
                    ) : (
                      <div className="w-32 h-32 mx-auto rounded-full bg-gradient-to-br from-sky-600 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg">
                        <Music className="w-12 h-12 text-white" />
                      </div>
                    )}
                    <h3 className="mt-4 text-2xl font-bold text-white">
                      {artist.name}
                    </h3>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-800/50 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                        <Users className="w-4 h-4" />
                        Listeners
                      </div>
                      <div className="text-xl font-bold text-white">
                        {formatNumber(artist.listeners)}
                      </div>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                        <Play className="w-4 h-4" />
                        Plays
                      </div>
                      <div className="text-xl font-bold text-white">
                        {formatNumber(artist.playcount)}
                      </div>
                    </div>
                  </div>

                  {/* Tags */}
                  {artist.tags.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-400 mb-2">
                        Genres & Tags
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {artist.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="px-3 py-1 rounded-full text-sm text-white bg-gradient-to-r from-sky-900/30 via-blue-900/30 to-indigo-900/30 border border-blue-800/40"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Top Tracks */}
                  {(tracks.length > 0 || loadingTracks) && (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium text-gray-400">
                          Top Tracks
                        </h4>

                        {/* Volume control (only meaningful if previews exist) */}
                        <div className="flex items-center gap-2">
                          <Volume2 className="w-4 h-4 text-gray-500" />
                          <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.01}
                            value={volume}
                            onChange={(e) =>
                              setVolume(parseFloat(e.target.value))
                            }
                            className="accent-sky-500 h-1 w-24"
                            aria-label="Preview volume"
                          />
                        </div>
                      </div>

                      {loadingTracks && (
                        <div className="flex items-center justify-center py-2">
                          <div className="animate-spin rounded-full h-4 w-4 border border-r-transparent border-b-sky-500 border-l-blue-500 border-t-indigo-500" />
                        </div>
                      )}

                      <div className="space-y-2">
                        {tracks.slice(0, 10).map((track) => {
                          const canPlay = !!track.preview_url;
                          const isThisPlaying =
                            playingTrackId === track.id && isPlaying;

                          return (
                            <div
                              key={track.id}
                              className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/30 hover:bg-gradient-to-r hover:from-sky-900/20 hover:via-blue-900/20 hover:to-indigo-900/20 transition-all duration-300 group"
                            >
                              <button
                                onClick={() =>
                                  canPlay ? playPreview(track) : undefined
                                }
                                disabled={!canPlay}
                                className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                                  canPlay
                                    ? 'cursor-pointer bg-gradient-to-br from-sky-600 via-blue-600 to-indigo-600 hover:brightness-110'
                                    : 'cursor-not-allowed bg-gray-700'
                                }`}
                                title={
                                  canPlay
                                    ? isThisPlaying
                                      ? 'Pause preview'
                                      : track.preview_url?.includes(
                                          'deezer.com'
                                        )
                                      ? 'Play 30s preview (Deezer)'
                                      : 'Play 30s preview (Spotify)'
                                    : trackSource === 'lastfm'
                                    ? 'Preview unavailable (Last.fm)'
                                    : 'Preview unavailable'
                                }
                                aria-label={
                                  canPlay
                                    ? isThisPlaying
                                      ? 'Pause preview'
                                      : 'Play preview'
                                    : 'Preview unavailable'
                                }
                              >
                                {isThisPlaying ? (
                                  <Pause className="w-4 h-4 text-white" />
                                ) : (
                                  <Play className="w-4 h-4 text-white ml-0.5" />
                                )}
                              </button>

                              <div className="flex-1 min-w-0">
                                <h5 className="text-sm font-medium text-white truncate">
                                  {track.name}
                                </h5>
                                <p className="text-xs text-gray-400 truncate">
                                  {track.album?.name || '—'}
                                </p>
                              </div>

                              <span className="text-xs text-gray-500">
                                {formatMs(track.duration_ms)}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Source caption */}
                      <p className="mt-2 text-[11px] text-gray-500">
                        Source:{' '}
                        {trackSource === 'spotify'
                          ? 'Spotify Top Tracks (30s previews where available)'
                          : trackSource === 'lastfm'
                          ? 'Last.fm Top Tracks (no previews available)'
                          : '—'}
                      </p>
                    </div>
                  )}

                  {/* Bio */}
                  {artist.bio && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-400 mb-2">
                        About
                      </h4>
                      <p className="text-gray-300 text-sm leading-relaxed ">
                        {artist.bio}
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="space-y-3">
                    {onExpand && (
                      <button
                        onClick={() => onExpand(artist.name)}
                        className="cursor-pointer w-full px-4 py-3 bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 text-white rounded-lg font-medium transition-all duration-300 hover:brightness-110 flex items-center justify-center gap-2"
                      >
                        <Maximize2 className="w-4 h-4" />
                        Map Connections
                      </button>
                    )}

                    <a
                      href={artist.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="cursor-pointer w-full px-4 py-3 bg-gray-800 text-white rounded-lg font-medium hover:bg-gradient-to-r hover:from-sky-900/30 hover:via-blue-900/30 hover:to-indigo-900/30 transition-colors flex items-center justify-center gap-2"
                    >
                      <ExternalLink className="w-4 h-4" />
                      View on Last.fm
                    </a>
                  </div>
                </div>
              ) : null}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
