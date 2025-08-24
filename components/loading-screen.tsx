// components/LoadingScreen.tsx
'use client';

import { motion } from 'framer-motion';
import { Player } from '@lottiefiles/react-lottie-player';

interface LoadingScreenProps {
  message?: string;
}

export default function LoadingScreen({
  message = 'Building your music constellation...',
}: LoadingScreenProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-gray-950/95 backdrop-blur-xl z-50 flex items-center justify-center"
    >
      <div className="text-center -mt-16 sm:-mt-20 md:-mt-24">
        <Player
          autoplay
          loop
          src="/lotties/ripple.json"
          className="w-48 h-48 mx-auto mb-8"
        />

        <motion.h2
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="text-2xl font-bold text-white mb-4"
        >
          {message}
        </motion.h2>

        {/* Uncomment for a branded progress bar
        <div className="w-64 h-1 bg-gray-800 rounded-full mx-auto overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600"
            animate={{ x: ['-100%', '100%'] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            style={{ width: '50%' }}
          />
        </div>
        */}
      </div>
    </motion.div>
  );
}
