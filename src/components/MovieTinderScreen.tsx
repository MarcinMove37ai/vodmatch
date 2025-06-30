// src/components/MovieTinderScreen.tsx
'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Film, Star, ThumbsUp, Eye, CheckCircle } from 'lucide-react'

interface MovieResult {
  movieId: string;
  movieTitle: string;
  movieDescription: string;
  movieYear: string;
  movieGenres: string;
  movieImdbRating: string;
  movieImgUrl: string | null;
}

interface MoviePick {
    movieId: string;
    vote: 'watched' | 'not_watched';
}

interface MovieTinderScreenProps {
  sessionId: string;
  movieBatch: MovieResult[];
  batchNumber: number;
  startIndexInBatch: number;
  onSubmitBatch: (batchNumber: number, picks: MoviePick[]) => Promise<boolean>;
  onFinish: () => void;
}

const BATCH_SIZE = 10;

const variants = {
  enter: (direction: number) => ({ x: direction > 0 ? '100%' : '-100%', opacity: 0, scale: 0.8 }),
  center: { zIndex: 1, x: 0, opacity: 1, scale: 1 },
  exit: (direction: number) => ({ zIndex: 0, x: direction < 0 ? '100%' : '-100%', opacity: 0, scale: 0.8 })
}

export default function MovieTinderScreen({
  sessionId,
  movieBatch,
  batchNumber,
  startIndexInBatch,
  onSubmitBatch,
  onFinish
}: MovieTinderScreenProps) {

  const [currentIndex, setCurrentIndex] = useState(startIndexInBatch);
  const [picks, setPicks] = useState<MoviePick[]>([]);
  const [direction, setDirection] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  // Reset stanu przy zmianie partii lub startIndex
  // ✅ POPRAWKA: Usunięto movieBatch.length z dependency array
  useEffect(() => {
    setCurrentIndex(startIndexInBatch);
    setPicks([]);
    setIsCompleted(false);
    console.log(`🎬 MovieTinder: Reset to batch ${batchNumber}, starting at index ${startIndexInBatch}, total movies: ${movieBatch.length}`);
  }, [batchNumber, startIndexInBatch]);

  const currentMovie = movieBatch[currentIndex];

  // Progress uwzględniający startIndexInBatch
  const progress = movieBatch.length > 0 ?
    ((currentIndex - startIndexInBatch + 1) / (movieBatch.length - startIndexInBatch)) * 100 : 0;

  const handleVote = async (vote: 'watched' | 'not_watched') => {
    if (isSubmitting || !currentMovie) return;

    const newPick: MoviePick = { movieId: currentMovie.movieId, vote };
    const updatedPicks = [...picks, newPick];
    setPicks(updatedPicks);

    const nextDirection = vote === 'watched' ? -1 : 1;
    setDirection(nextDirection);

    // Sprawdzamy, czy obecny indeks jest ostatnim w partii
    const isLastInBatch = currentIndex === movieBatch.length - 1;
    console.log(`🗳️ Vote: ${vote} for ${currentMovie.movieTitle} (${currentIndex + 1}/${movieBatch.length}) - Last in batch: ${isLastInBatch}`);

    if (isLastInBatch) {
      setIsCompleted(true);
      setIsSubmitting(true);
      console.log(`📤 Submitting batch ${batchNumber} with ${updatedPicks.length} picks`);

      try {
        const success = await onSubmitBatch(batchNumber, updatedPicks);
        if (success) {
          console.log(`✅ Batch ${batchNumber} submitted successfully`);
          onFinish(); // Przejdź do stanu oczekiwania
        } else {
          console.error(`❌ Failed to submit batch ${batchNumber}`);
          alert('There was an error submitting your choices. Please try again.');
          setIsCompleted(false);
        }
      } catch (error) {
        console.error('❌ Failed to submit voting results:', error);
        setIsCompleted(false);
      } finally {
        setIsSubmitting(false);
      }
    } else {
      setCurrentIndex(prev => prev + 1);
    }
  };

  // Ekran oczekiwania (analogiczny do QuizScreen)
  if (isCompleted) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-6 relative overflow-hidden">
         <div className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-gradient-to-br from-blue-600/20 to-purple-600/10 rounded-full animate-pulse blur-3xl"></div>
         <div className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-gradient-to-tl from-emerald-600/20 to-green-600/10 rounded-full animate-pulse blur-3xl animation-delay-4000"></div>

        <motion.div
          className="max-w-md w-full text-center space-y-8 z-10"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
        >
          <div className="space-y-4">
            <motion.div
              className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center shadow-[0_0_30px_rgba(5,150,105,0.5)]"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, repeatType: "mirror" }}
            >
              <CheckCircle className="w-12 h-12 text-white" />
            </motion.div>
            <h1 className="text-4xl font-light text-transparent bg-clip-text bg-gradient-to-r from-gray-100 to-gray-300">
              Voting Complete!
            </h1>
            <p className="text-gray-400 font-light max-w-xs mx-auto">
              {isSubmitting ? 'Submitting your votes...' : 'Waiting for others to finish voting. The results will appear soon!'}
            </p>
          </div>
          {isSubmitting && (
            <div className="flex items-center justify-center space-x-2">
              <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-emerald-400 text-sm">Processing...</span>
            </div>
          )}
        </motion.div>
      </div>
    )
  }

  if (!movieBatch || movieBatch.length === 0) {
    return (
       <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-purple-900 flex flex-col items-center justify-center text-center p-4">
        <div className="w-8 h-8 border-4 border-blue-400/30 border-t-blue-400 rounded-full animate-spin"></div>
        <p className="text-gray-400 text-lg mt-4">Preparing the next batch of movies...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-purple-900 relative overflow-hidden flex flex-col items-center justify-center p-4">
      <div className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-gradient-to-br from-blue-600/20 to-purple-600/10 rounded-full animate-pulse blur-3xl"></div>
      <div className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-gradient-to-tl from-emerald-600/20 to-green-600/10 rounded-full animate-pulse blur-3xl animation-delay-4000"></div>

      <div className="w-full max-w-sm z-10 space-y-4">
        <div className="text-center space-y-2">
            <p className="text-sm text-gray-400">
              Movie {currentIndex - startIndexInBatch + 1} of {movieBatch.length - startIndexInBatch}
              {startIndexInBatch > 0 && <span className="text-gray-500"> (continuing from #{startIndexInBatch + 1})</span>}
            </p>
            <div className="w-full bg-white/10 rounded-full h-1.5">
                <motion.div
                    className="bg-gradient-to-r from-emerald-500 to-cyan-500 h-1.5 rounded-full"
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                />
            </div>
        </div>

        <div className="relative w-full h-[65vh] flex items-center justify-center">
          <AnimatePresence initial={false} custom={direction}>
            {currentMovie &&
              <motion.div
                key={currentIndex}
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{
                  x: { type: "spring", stiffness: 300, damping: 30 },
                  opacity: { duration: 0.4 }
                }}
                className="absolute w-full h-full p-4"
              >
                <div className="w-full h-full bg-gray-800/40 border border-gray-700/60 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden flex flex-col backdrop-blur-lg">
                  <div className="relative w-full h-3/5 flex-shrink-0">
                    <img
                      src={currentMovie.movieImgUrl || `https://ui-avatars.com/api/?name=${currentMovie.movieTitle}&background=2A2E37&color=FFFFFF&size=512`}
                      alt={`Poster for ${currentMovie.movieTitle}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                    <div className="absolute bottom-3 left-4 right-4">
                      <h2 className="text-white text-2xl font-bold tracking-tight">{currentMovie.movieTitle}</h2>
                      <p className="text-gray-400 text-sm font-light">{currentMovie.movieYear}</p>
                    </div>
                  </div>
                  <div className="p-4 space-y-3 overflow-y-auto text-sm">
                    <div className="flex items-center space-x-2">
                      <Star className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                      <span className="font-bold text-white">{currentMovie.movieImdbRating}/10</span>
                      <span className="text-gray-500">IMDb Rating</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {currentMovie.movieGenres.split(',').map(genre => (
                        <span key={genre} className="px-2 py-1 text-xs text-purple-200 bg-purple-900/50 rounded-full">{genre.trim()}</span>
                      ))}
                    </div>
                    <p className="text-gray-400 font-light leading-relaxed">
                      {currentMovie.movieDescription}
                    </p>
                  </div>
                </div>
              </motion.div>
            }
          </AnimatePresence>
        </div>

        <div className="relative z-10 pt-2 flex items-center justify-center w-full space-x-4">
          <motion.button
            onClick={() => handleVote('watched')}
            disabled={isSubmitting}
            className="h-16 w-full rounded-xl font-light text-gray-300 border border-gray-700 bg-gray-900/40 backdrop-blur-sm hover:bg-gray-800/60 hover:border-gray-600 transition-all duration-300 flex items-center justify-center space-x-2 disabled:opacity-50"
            whileTap={{ scale: isSubmitting ? 1 : 0.95 }}
          >
            <Eye className="w-5 h-5 text-gray-400" />
            <span>Oglądałem/am</span>
          </motion.button>

          <motion.button
            onClick={() => handleVote('not_watched')}
            disabled={isSubmitting}
            className="h-16 w-full rounded-xl font-medium text-white bg-gradient-to-r from-emerald-600 to-cyan-600 shadow-lg shadow-emerald-500/20 hover:from-emerald-500 hover:to-cyan-500 hover:brightness-110 transition-all duration-300 flex items-center justify-center space-x-2 disabled:opacity-50"
            whileTap={{ scale: isSubmitting ? 1 : 0.95 }}
          >
            <ThumbsUp className="w-5 h-5" />
            <span>Obejrzę!</span>
          </motion.button>
        </div>
      </div>
    </div>
  )
}