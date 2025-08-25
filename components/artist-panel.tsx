// components/artist-panel.tsx
'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { X, ExternalLink, Music, Users, Play, Maximize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getArtistInfo } from '@/lib/lastfm';
import { getArtistImage } from '@/lib/spotify';

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

export default function ArtistPanel({
  artistName,
  onClose,
  onExpand,
}: ArtistPanelProps) {
  const [artist, setArtist] = useState<ArtistDetails | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!artistName) {
      setArtist(null);
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
        }
      } catch (error) {
        console.error('Failed to fetch artist info:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchArtistInfo();
  }, [artistName]);


  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

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
                <h2 className="text-xl font-bold text-white">Artist Details</h2>
                <button
                  onClick={onClose}
                  className="cursor-pointer p-2 rounded-lg transition-colors hover:bg-gradient-to-r hover:from-sky-900/30 hover:via-blue-900/30 hover:to-indigo-900/30"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-64">
                {/* spinner with brand tri-shade */}
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
