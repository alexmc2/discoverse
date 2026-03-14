// components/artist-panel.tsx
'use client';

import { useRef, useState, useEffect } from 'react';
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


export interface ArtistDetails {
  name: string;
  url: string;
  image?: string;
  listeners: number;
  playcount: number;
  bio?: string;
  tags: string[];
  spotifyUrl?: string; // NEW
}

export interface TrackData {
  id: string;
  name: string;
  preview_url: string | null;
  duration_ms: number;
  popularity: number;
  album: {
    name: string;
    images: Array<{ url: string }>;
  };
  artists: Array<{ name: string }>;
}

type TrackSource = 'spotify' | 'lastfm' | null;

interface ArtistPanelProps {
  artistName: string | null;
  artist: ArtistDetails | null;
  tracks: TrackData[];
  trackSource: TrackSource;
  tracksLoading?: boolean;
  onClose: () => void;
  onExpand?: (artist: string) => void;
}

export default function ArtistPanel({
  artistName,
  artist,
  tracks,
  trackSource,
  tracksLoading,
  onClose,
  onExpand,
}: ArtistPanelProps) {
  const isWorkersDev =
    typeof window !== 'undefined' && /\.workers\.dev$/i.test(window.location.hostname);
  // Audio
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.6);

  // Session guard to avoid stale event handlers from previous audio overriding UI
  const sessionRef = useRef(0);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // stop audio on close or artist change
  useEffect(() => {
    const currentSession = sessionRef.current;
    return () => {
      sessionRef.current = currentSession + 1; // invalidate old handlers
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
      setPlayingTrackId(null);
      setIsPlaying(false);
    };
  }, [artistName]);

  const stopAudio = () => {
    sessionRef.current++; // invalidate old handlers
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current.load();
      audioRef.current = null;
    }
    setPlayingTrackId(null);
    setIsPlaying(false);
  };

  const playPreview = async (track: TrackData) => {
    if (!track.preview_url) return;

    // Toggle current
    if (playingTrackId === track.id) {
      if (!audioRef.current) return;
      if (audioRef.current.paused) {
        try {
          await audioRef.current.play();
          setIsPlaying(true);
        } catch {
          // ignore
        }
      } else {
        audioRef.current.pause();
        // isPlaying will flip via onpause (guarded by session)
      }
      return;
    }

    // Switch track
    try {
      // invalidate previous handlers before pausing old audio
      sessionRef.current++;
      const mySession = sessionRef.current;

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
        if (sessionRef.current !== mySession) return;
        setIsPlaying(false);
        setPlayingTrackId(null);
      };
      audio.onpause = () => {
        if (sessionRef.current !== mySession) return;
        setIsPlaying(false);
      };
      audio.onplay = () => {
        if (sessionRef.current !== mySession) return;
        setIsPlaying(true);
      };
      audio.onerror = () => {
        if (sessionRef.current !== mySession) return;
        setIsPlaying(false);
        setPlayingTrackId(null);
      };

      setPlayingTrackId(track.id);
      await audio.play();
      // onplay handler sets isPlaying(true); this set is a safety net
      if (sessionRef.current === mySession) setIsPlaying(true);
    } catch {
      setIsPlaying(false);
      setPlayingTrackId(null);
    }
  };

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

  const topTracks = tracks.slice(0, 10);
  const hasAnyPlayablePreview = topTracks.some((track) => !!track.preview_url);

  return (
    <AnimatePresence>
      {artistName && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-30"
            onClick={() => {
              stopAudio();
              onClose();
            }}
            aria-hidden="true"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-full sm:w-96 bg-gray-900/95 backdrop-blur-xl border-l border-gray-800 shadow-2xl z-40 overflow-y-auto"
          >
            <div className="relative">
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

              {!artist ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-2 border-r-transparent border-b-sky-500 border-l-blue-500 border-t-indigo-500" />
                </div>
              ) : (
                <div className="p-6 space-y-6">
                  <div className="text-center">
                    {artist.image ? (
                      <div className="relative w-32 h-32 mx-auto">
                        <Image
                          src={artist.image}
                          alt={artist.name}
                          fill
                          className="rounded-full object-cover shadow-lg ring-4 ring-sky-500/30"
                          sizes="128px"
                          unoptimized={isWorkersDev}
                          priority
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

                  {artist.tags.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-400 mb-2">
                        Genres & Tags
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {artist.tags.map((tag, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 rounded-full text-sm text-white bg-gradient-to-r from-sky-900/30 via-blue-900/30 to-indigo-900/30 border border-blue-800/40"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {tracksLoading && tracks.length === 0 && (
                    <div className="flex items-center gap-2 text-gray-500 text-sm py-2">
                      <div className="h-3 w-3 rounded-full border border-gray-600 border-t-gray-400 animate-spin" />
                      <span>Loading tracks...</span>
                    </div>
                  )}

                  {tracks.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium text-gray-400">
                          Top Tracks
                        </h4>
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

                      <div className="space-y-2">
                        {topTracks.map((track) => {
                          const canPlay = !!track.preview_url;
                          const isThisPlaying =
                            playingTrackId === track.id && isPlaying;
                          return (
                            <div
                              key={track.id}
                              className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/30 hover:bg-gradient-to-r hover:from-sky-900/20 hover:via-blue-900/20 hover:to-indigo-900/20 transition-all duration-300 group"
                            >
                              {/* Play/Pause — no popup; screen reader labels only */}
                              {canPlay ? (
                                <button
                                  onClick={() => playPreview(track)}
                                  className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer bg-gradient-to-br from-sky-600 via-blue-600 to-indigo-600 hover:brightness-110"
                                  aria-label={
                                    isThisPlaying ? 'Pause preview' : 'Play 30-second preview'
                                  }
                                >
                                  {isThisPlaying ? (
                                    <Pause className="w-4 h-4 text-white" />
                                  ) : (
                                    <Play className="w-4 h-4 text-white ml-0.5" />
                                  )}
                                </button>
                              ) : (
                                <button
                                  disabled
                                  aria-disabled="true"
                                  className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-not-allowed bg-gray-700"
                                  aria-label="Preview unavailable"
                                >
                                  <Play className="w-4 h-4 text-white ml-0.5" />
                                </button>
                              )}

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

                      {trackSource === 'spotify' && !hasAnyPlayablePreview && (
                        <p className="mt-2 text-[11px] text-gray-500">
                          No 30-second previews are currently available for these tracks.
                        </p>
                      )}

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

                  <div className="space-y-3">
                    {onExpand && artist?.name && (
                      <button
                        onClick={() => onExpand(artist.name)}
                        className="cursor-pointer w-full px-4 py-3 bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 text-white rounded-lg font-medium transition-all duration-300 hover:brightness-110 flex items-center justify-center gap-2"
                      >
                        <Maximize2 className="w-4 h-4" />
                        Map Connections
                      </button>
                    )}

   
                    {artist?.spotifyUrl && (
                      <a
                        href={artist.spotifyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="cursor-pointer w-full px-4 py-3 bg-gray-800 text-white rounded-lg font-medium transition-all duration-300 hover:brightness-110 flex items-center justify-center gap-2"
                        aria-label="View artist on Spotify"
                      >
                        <ExternalLink className="w-4 h-4" />
                        View on Spotify
                      </a>
                    )}

                    {artist?.url && (
                      <a
                        href={artist.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="cursor-pointer w-full px-4 py-3 bg-gray-800 text-white rounded-lg font-medium hover:bg-gradient-to-r hover:from-sky-900/30 hover:via-blue-900/30 hover:to-indigo-900/30 transition-colors flex items-center justify-center gap-2"
                      >
                        <ExternalLink className="w-4 h-4" />
                        View on Last.fm
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
