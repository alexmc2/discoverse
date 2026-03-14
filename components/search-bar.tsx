// components/search-bar.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { searchArtist, Artist } from '@/lib/lastfm';
import { Input } from '@/components/ui/input';

interface SearchBarProps {
  onSearch: (artist: string) => void;
  isLoading?: boolean;
  resetSignal?: number; 
}

export default function SearchBar({
  onSearch,
  isLoading,
  resetSignal,
}: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Artist[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const requestSeqRef = useRef(0);
  const navigatingRef = useRef(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Clear & collapse on reset
  useEffect(() => {
    if (resetSignal === undefined) return;
    requestSeqRef.current += 1;
    navigatingRef.current = false;
    setQuery('');
    setSuggestions([]);
    setSelectedIndex(-1);
    setShowSuggestions(false);
    inputRef.current?.blur();
  }, [resetSignal]);

  useEffect(() => {
    if (query.length < 2) {
      requestSeqRef.current += 1;
      setSuggestions([]);
      setSelectedIndex(-1);
      setShowSuggestions(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);

    navigatingRef.current = false;
    const requestId = ++requestSeqRef.current;
    const currentQuery = query;

    debounceRef.current = setTimeout(async () => {
      try {
        const results = await searchArtist(currentQuery);
        if (requestSeqRef.current !== requestId || navigatingRef.current) return;
        setSuggestions(results);
        setSelectedIndex(-1);
        setShowSuggestions(results.length > 0);
      } catch {
        if (requestSeqRef.current !== requestId || navigatingRef.current) return;
        setSuggestions([]);
        setSelectedIndex(-1);
        setShowSuggestions(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      requestSeqRef.current += 1;
      navigatingRef.current = true;
      setSuggestions([]);
      setSelectedIndex(-1);
      onSearch(query.trim());
      setShowSuggestions(false);
      inputRef.current?.blur(); // collapse
    }
  };

  const handleSelectSuggestion = (artist: Artist) => {
    requestSeqRef.current += 1;
    navigatingRef.current = true;
    setQuery(artist.name);
    setSuggestions([]);
    setShowSuggestions(false);
    setSelectedIndex(-1);
    onSearch(artist.name);
    inputRef.current?.blur(); // collapse
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case 'Enter':
        if (selectedIndex >= 0) {
          e.preventDefault();
          handleSelectSuggestion(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  return (
    <div ref={searchRef} className="relative w-full">
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative flex items-center">
          <Input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            placeholder="Search for an artist..."
            disabled={isLoading}
            className="w-full sm:h-9 h-9 pl-12 pr-10 bg-slate-800 text-white backdrop-blur-xl border-gray-800 placeholder-gray-500 focus:border-sky-800"
          />

          <Search className="absolute left-4 w-5 h-5 text-gray-500" />

          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setSuggestions([]);
                setSelectedIndex(-1);
                setShowSuggestions(false);
                inputRef.current?.focus();
              }}
              className="absolute right-3 p-1 text-gray-500 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </form>

      <AnimatePresence>
        {showSuggestions && suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full mt-2 w-full bg-gray-900/95 backdrop-blur-xl border border-gray-800 rounded-xl shadow-2xl overflow-hidden z-50"
          >
            <div className="max-h-96 overflow-y-auto">
              {suggestions.map((artist, index) => (
                <button
                  key={artist.id}
                  type="button"
                  onClick={() => handleSelectSuggestion(artist)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full px-4 py-3 transition-colors text-left cursor-pointer ${
                    index === selectedIndex
                      ? 'bg-gradient-to-r from-sky-900/30 via-blue-900/30 to-indigo-900/30 '
                      : 'hover:bg-gradient-to-r hover:from-sky-900/20 hover:via-blue-900/20 hover:to-indigo-900/20'
                  }`}
                >
                  <div className="text-white font-medium cursor-pointer">{artist.name}</div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
