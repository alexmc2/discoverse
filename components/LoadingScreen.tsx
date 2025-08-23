'use client';

import { motion } from 'framer-motion';
import { Music } from 'lucide-react';

interface LoadingScreenProps {
  message?: string;
}

export default function LoadingScreen({ message = 'Building your music constellation...' }: LoadingScreenProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-gray-900/95 backdrop-blur-xl z-50 flex items-center justify-center"
    >
      <div className="text-center">
        {/* Animated logo */}
        <div className="relative mb-8">
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              rotate: [0, 180, 360],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="w-24 h-24 mx-auto"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full blur-xl opacity-50" />
            <div className="relative w-full h-full bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center">
              <Music className="w-12 h-12 text-white" />
            </div>
          </motion.div>
          
          {/* Orbiting dots */}
          {[0, 1, 2].map((index) => (
            <motion.div
              key={index}
              className="absolute w-3 h-3 bg-white rounded-full"
              style={{
                top: '50%',
                left: '50%',
                marginTop: '-6px',
                marginLeft: '-6px',
              }}
              animate={{
                rotate: 360,
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "linear",
                delay: index * 0.66,
              }}
            >
              <div 
                className="w-3 h-3 bg-white rounded-full"
                style={{
                  transform: `translateX(${40}px)`,
                  opacity: 0.6 - index * 0.2,
                }}
              />
            </motion.div>
          ))}
        </div>

        {/* Loading text */}
        <motion.h2
          animate={{
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="text-2xl font-bold text-white mb-4"
        >
          {message}
        </motion.h2>
        
        {/* Progress bar */}
        <div className="w-64 h-1 bg-gray-800 rounded-full mx-auto overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-purple-600 to-blue-600"
            animate={{
              x: ['-100%', '100%'],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            style={{ width: '50%' }}
          />
        </div>
        
        <p className="mt-4 text-gray-400 text-sm">
          Mapping musical connections across the universe
        </p>
      </div>
    </motion.div>
  );
}