// lib/genres.ts
// High-contrast palette for a dark UI. Hues are spaced to avoid lookalikes.
// Metal & heavy styles skew darker; pop/electronic keep brighter mids.
// No "lime-500 vs lime-600" nonsense here.

export const GENRE_COLOR_MAP: Record<string, string> = {
  // Core families
  rock: '#ef4444', // red-500
  pop: '#f59e0b', // amber-500
  electronic: '#06b6d4', // cyan-500
  'hip hop': '#16a34a', // green-600
  jazz: '#14b8a6', // teal-500
  blues: '#60a5fa', // blue-400
  classical: '#4f46e5', // indigo-600
  metal: '#1f1b2e', // deep indigo-black (high contrast)
  country: '#e879f9', // fuchsia-400
  folk: '#22d3ee', // cyan-400
  soul: '#fb7185', // rose-400
  funk: '#a3e635', // lime-400 (bright, but not pairing with another lime)
  rnb: '#f43f5e', // rose-500
  reggae: '#10b981', // emerald-500
  dub: '#065f46', // emerald-900 (darker for bass-heavy)
  ska: '#34d399', // emerald-400
  disco: '#fde047', // yellow-400
  soundtrack: '#93c5fd', // blue-300
  ambient: '#38bdf8', // sky-400
  experimental: '#f97316', // orange-500
  industrial: '#7f1d1d', // red-900 (dark, gritty)
  world: '#22c55e', // green-500
  latin: '#fb923c', // orange-400
  afrobeat: '#65a30d', // lime-600 (unique here; no neighbouring lime tone in map)

  // Rock branches
  punk: '#ef4444', // red-500 bold & angry
  'post-punk': '#e11d48', // rose-600
  hardcore: '#991b1b', // red-800
  emo: '#be185d', // fuchsia-700
  grunge: '#b45309', // amber-700
  'garage rock': '#f59e0b', // amber-500
  'indie rock': '#7c3aed', // violet-600
  'alt rock': '#8b5cf6', // violet-500
  'post-rock': '#0ea5e9', // sky-500
  'prog rock': '#312e81', // indigo-900 (dark, proggy)
  'psychedelic rock': '#f43f5e', // rose-500
  'math rock': '#2563eb', // blue-600
  shoegaze: '#a78bfa', // violet-400
  'new wave': '#06b6d4', // cyan-500
  britpop: '#3b82f6', // blue-500

  // Metal branches (dark & distinct)
  'heavy metal': '#2a243a', // deep violet-black
  'thrash metal': '#422006', // stone/dark-amber 950-ish
  'death metal': '#1e293b', // slate-800
  'black metal': '#0b0b0d', // near-black
  metalcore: '#3b0764', // violet-950

  // Electronic branches (separate sky/cyan/blue by weight)
  house: '#22c55e', // green-500
  techno: '#0ea5e9', // sky-500
  trance: '#38bdf8', // sky-400
  'drum and bass': '#0284c7', // sky-600
  dubstep: '#2563eb', // blue-600
  idm: '#0891b2', // cyan-600
  breaks: '#60a5fa', // blue-400
  electro: '#06b6d4', // cyan-500
  'synth pop': '#8b5cf6', // violet-500
  chillout: '#67e8f9', // cyan-300
  'lo-fi': '#93c5fd', // blue-300

  // Hip hop/R&B branches
  rap: '#16a34a', // green-600
  trap: '#15803d', // green-700

  // Singer/songwriter & acoustic
  'singer-songwriter': '#22d3ee', // cyan-400
  acoustic: '#93c5fd', // blue-300

  // Regional / scenes
  'k-pop': '#f472b6', // pink-400
  'j-pop': '#fb7185', // rose-400
  'c-pop': '#f43f5e', // rose-500

  // Periods & classical substyles
  baroque: '#4f46e5', // indigo-600
  romantic: '#3730a3', // indigo-800
  opera: '#1e1b4b', // indigo-950

  // Safety net
  alternative: '#f43f5e', // rose-500
  indie: '#7c3aed', // violet-600
  unknown: '#71717a', // zinc-500
};

// Match order: more specific first, then parents.
// Ensures "post-punk" matches before "punk", etc.
export const GENRE_MATCH_ORDER: string[] = [
  // Specific first
  'post-punk',
  'hardcore',
  'emo',
  'shoegaze',
  'grunge',
  'garage rock',
  'indie rock',
  'alt rock',
  'post-rock',
  'prog rock',
  'psychedelic rock',
  'math rock',
  'new wave',
  'britpop',
  'heavy metal',
  'thrash metal',
  'death metal',
  'black metal',
  'metalcore',
  'drum and bass',
  'dubstep',
  'synth pop',
  'lo-fi',
  'chillout',
  'idm',
  'breaks',
  'trap',
  'rap',
  'singer-songwriter',
  'baroque',
  'romantic',
  'opera',
  'k-pop',
  'j-pop',
  'c-pop',
  // Parents
  'punk',
  'rock',
  'metal',
  'electronic',
  'house',
  'techno',
  'trance',
  'ambient',
  'electro',
  'hip hop',
  'rnb',
  'soul',
  'funk',
  'jazz',
  'blues',
  'classical',
  'country',
  'folk',
  'acoustic',
  'reggae',
  'dub',
  'ska',
  'disco',
  'latin',
  'afrobeat',
  'world',
  'experimental',
  'industrial',
  'soundtrack',
  'pop',
  'indie',
  'alternative',
];

export function getGenreColor(rawGenre?: string): string {
  if (!rawGenre) return GENRE_COLOR_MAP.unknown;
  const g = rawGenre.toLowerCase();

  // Exact hit
  if (GENRE_COLOR_MAP[g]) return GENRE_COLOR_MAP[g];

  // Priority fuzzy contains
  for (const key of GENRE_MATCH_ORDER) {
    if (g.includes(key)) return GENRE_COLOR_MAP[key] || GENRE_COLOR_MAP.unknown;
  }

  // Tokenised last chance (handles "x / y", "x & y", etc.)
  for (const token of g.split(/[\/,&]| and | \/ /g).map((s) => s.trim())) {
    if (GENRE_COLOR_MAP[token]) return GENRE_COLOR_MAP[token];
  }

  return GENRE_COLOR_MAP.unknown;
}
