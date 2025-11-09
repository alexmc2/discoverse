'use client';

import { useEffect, useState } from 'react';
import CoffeeButton from './coffee-button';

export default function FloatingCoffee() {
  const [show, setShow] = useState(false);
  
  useEffect(() => {
    // Show after a short delay to not be too intrusive
    const timer = setTimeout(() => setShow(true), 2000);
    return () => clearTimeout(timer);
  }, []);
  
  if (!show) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-5 duration-500">
      <CoffeeButton />
    </div>
  );
}