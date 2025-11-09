'use client';

import { Coffee } from 'lucide-react';

type Props = {
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
};

export default function CoffeeButton({
  label = 'Buy me a coffee',
  size = 'md',
  className = '',
}: Props) {
  const href = 'https://buymeacoffee.com/alexlande'; // Update this to your username
  const base =
    'group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 backdrop-blur px-4 py-2 text-sm text-white/90 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 transition-all duration-200';
  const sm = 'px-3 py-1.5 text-xs';
  
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Support this project"
      className={`${base} ${size === 'sm' ? sm : ''} ${className}`}
    >
      <Coffee className="h-4 w-4 opacity-90 group-hover:scale-110 transition-transform" />
      <span>{label}</span>
    </a>
  );
}