// src/components/MovieTinderScreen.tsx
'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence, PanInfo } from 'framer-motion'
import { Star, Eye, Heart, CheckCircle, X, Clock, Shield, Film, Clapperboard, MousePointerClick } from 'lucide-react'

interface MovieResult {
  movieId: string;
  movieTitle: string;
  movieDescription: string;
  movieYear: string;
  movieGenres: string;
  movieImdbRating: string;
  movieImgUrl: string | null;
  moviePlatform?: string[] | string;
  movieRuntime?: string;
  movieDirectors?: string;
  movieImdbId?: string | null;
  movieType?: string | null;
  searchScore?: number;
  hybridScore?: number;
  movieContentRating?: string;
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

const SWIPE_THRESHOLD = 100;

const cardVariants = {
  enter: {
    scale: 0.8,
    opacity: 0,
    rotateZ: 0,
    x: 0,
    y: 50
  },
  center: {
    scale: 1,
    opacity: 1,
    rotateZ: 0,
    x: 0,
    y: 0,
    transition: {
      duration: 0.4
      // Usunięto ease - użyje domyślnego
    }
  },
  exitLeft: {
    x: -400,
    opacity: 0,
    rotateZ: -30,
    transition: {
      duration: 0.3
      // Usunięto ease - użyje domyślnego
    }
  },
  exitRight: {
    x: 400,
    opacity: 0,
    rotateZ: 30,
    transition: {
      duration: 0.3
      // Usunięto ease - użyje domyślnego
    }
  }
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.6,
      staggerChildren: 0.1
    }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6 }
  }
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [exitDirection, setExitDirection] = useState<'left' | 'right' | null>(null);
  const [dragProgress, setDragProgress] = useState(0);
  const [showDescription, setShowDescription] = useState(false);

  // Reset stanu przy zmianie partii lub startIndex
  useEffect(() => {
    setCurrentIndex(startIndexInBatch);
    setPicks([]);
    setIsCompleted(false);
    setExitDirection(null);
    setDragProgress(0);
    setShowDescription(false);
    console.log(`🎬 MovieTinder: Reset to batch ${batchNumber}, starting at index ${startIndexInBatch}, total movies: ${movieBatch.length}`);
  }, [batchNumber, startIndexInBatch, movieBatch.length]);

  const currentMovie = movieBatch[currentIndex];

  // Obliczenia postępu dla paska (na podstawie przegłosowanych filmów) - BEZ ZMIAN
  const progressBasedOnPicks = picks.length;
  const totalMoviesToVote = movieBatch.length - startIndexInBatch;

  const displayProgress = totalMoviesToVote > 0 ?
    (progressBasedOnPicks / totalMoviesToVote) * 100 : 0;


  const handleVote = async (vote: 'watched' | 'not_watched') => {
    if (isSubmitting || !currentMovie) return;

    const direction = vote === 'watched' ? 'left' : 'right';
    setExitDirection(direction);
    setDragProgress(vote === 'watched' ? -1 : 1);
    setShowDescription(false);

    const newPick: MoviePick = { movieId: currentMovie.movieId, vote };
    const updatedPicks = [...picks, newPick];
    setPicks(updatedPicks);

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
      setTimeout(() => {
        setCurrentIndex(prev => prev + 1);
        setExitDirection(null);
        setDragProgress(0);
      }, 300);
    }
  };

  const handleDragEnd = (event: any, info: PanInfo) => {
    const { offset, velocity } = info;
    const swipe = Math.abs(offset.x) * velocity.x;

    if (swipe < -SWIPE_THRESHOLD) {
      handleVote('watched'); // Swipe left = watched
    } else if (swipe > SWIPE_THRESHOLD) {
      handleVote('not_watched'); // Swipe right = want to watch
    } else {
      setDragProgress(0);
    }
  };

  const handleDrag = (event: any, info: PanInfo) => {
    const progress = Math.min(Math.max(info.offset.x / SWIPE_THRESHOLD, -1), 1);
    setDragProgress(progress);
  };

  const toggleDescription = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDescription(prev => !prev);
  };

  if (isCompleted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-purple-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-950/10 via-transparent to-violet-950/20"></div>

        <div className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-gradient-to-br from-blue-600/20 to-purple-600/10 rounded-full animate-pulse blur-3xl"></div>
        <div className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-gradient-to-tl from-emerald-600/20 to-green-600/10 rounded-full animate-pulse blur-3xl animation-delay-4000"></div>

        <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
          <motion.div
            className="max-w-sm w-full text-center space-y-8"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
          >
            <div className="space-y-6">
              <motion.div
                className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center relative"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 1.5, repeat: Infinity, repeatType: "mirror" }}
              >
                <div className="absolute -inset-1 rounded-full bg-emerald-500/20 blur-sm"></div>
                <CheckCircle className="w-12 h-12 text-white relative z-10" />
              </motion.div>

              <div className="space-y-3">
                <h1 className="text-3xl font-light bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent tracking-tight">
                  Voting Complete!
                </h1>
                <div className="w-16 h-px bg-gradient-to-r from-blue-600/60 via-purple-600/60 to-transparent mx-auto"></div>
              </div>

              <p className="text-gray-400 font-light text-sm leading-relaxed max-w-xs mx-auto">
                {isSubmitting ? 'Submitting your votes...' : 'All votes cast! Waiting for others to finish. Results will appear shortly.'}
              </p>
            </div>

            {isSubmitting && (
              <motion.div
                className="flex items-center justify-center space-x-2"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <div className="w-4 h-4 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin"></div>
                <span className="text-emerald-400 text-sm font-light">Processing...</span>
              </motion.div>
            )}
          </motion.div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-purple-900 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-950/10 via-transparent to-violet-950/20"></div>

      <div className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-gradient-to-br from-blue-600/20 to-purple-600/10 rounded-full animate-pulse blur-3xl"></div>
      <div className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-gradient-to-tl from-emerald-600/20 to-green-600/10 rounded-full animate-pulse blur-3xl animation-delay-4000"></div>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
        <motion.div
          className="max-w-sm w-full space-y-8"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Progress Section */}
          <motion.div
            className="text-center space-y-4"
            variants={itemVariants}
          >
            {/* ZMIANA TUTAJ: Wyświetlanie numeru filmu (teraz na podstawie currentIndex) */}
            <p className="text-gray-400 font-light text-sm">
              Movie {currentIndex - startIndexInBatch + 1} of {totalMoviesToVote}
              {startIndexInBatch > 0 && (
                <span className="text-gray-500"> (continuing from #{startIndexInBatch + 1})</span>
              )}
            </p>

            <div className="w-full bg-white/10 rounded-full h-1.5">
              <motion.div
                className="bg-gradient-to-r from-blue-500 to-purple-500 h-1.5 rounded-full"
                animate={{ width: `${displayProgress}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>
          </motion.div>

          {/* Movie Card Stack */}
          <motion.div
            className="relative w-full h-[65vh]"
            variants={itemVariants}
          >
            <AnimatePresence mode="wait">
              {currentMovie && (
                <motion.div
                  key={currentIndex}
                  className="absolute inset-0 cursor-grab active:cursor-grabbing"
                  variants={cardVariants}
                  initial="enter"
                  animate="center"
                  exit={exitDirection === 'left' ? 'exitLeft' : exitDirection === 'right' ? 'exitRight' : 'center'}
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.2}
                  onDragEnd={handleDragEnd}
                  onDrag={handleDrag}
                  whileDrag={{
                    scale: 1.05,
                    rotateZ: 5,
                    zIndex: 10
                  }}
                >
                  <div className="w-full h-full rounded-2xl border border-gray-700/60 bg-gradient-to-br from-gray-900/50 to-gray-800/40 backdrop-blur-md overflow-hidden shadow-2xl relative flex flex-col">
                    {dragProgress < 0 && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: Math.abs(dragProgress) * 2 }}
                        className="absolute inset-0 bg-red-500/30 flex items-center justify-center z-20"
                        style={{ clipPath: `inset(0 ${100 - Math.abs(dragProgress) * 100}% 0 0)`}}
                      >
                        <X className="w-1/4 h-1/4 text-white opacity-70" />
                      </motion.div>
                    )}
                    {dragProgress > 0 && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: Math.abs(dragProgress) * 2 }}
                        className="absolute inset-0 bg-green-500/30 flex items-center justify-center z-20"
                        style={{ clipPath: `inset(0 0 0 ${100 - Math.abs(dragProgress) * 100}%)`}}
                      >
                        <Heart className="w-1/4 h-1/4 text-white opacity-70" />
                      </motion.div>
                    )}

                    {!showDescription && (
                      <div className="relative w-full h-full flex-shrink-0">
                        <img
                          src={currentMovie.movieImgUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentMovie.movieTitle)}&background=2A2E37&color=FFFFFF&size=512`}
                          alt={`Poster for ${currentMovie.movieTitle}`}
                          className="w-full h-full object-cover"
                          draggable={false}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent"></div>

                        <div className="absolute bottom-4 left-4 right-4 z-10">
                          <h2 className="text-white text-3xl font-bold tracking-tight mb-1">
                            {currentMovie.movieTitle}
                          </h2>

                          {currentMovie.movieImdbRating && currentMovie.movieImdbRating !== 'N/A' && (
                            <div className="flex items-center space-x-2 text-gray-300 text-sm mb-1">
                              <Star className="w-4 h-4 text-amber-400 flex-shrink-0" />
                              <span className="font-medium">{currentMovie.movieImdbRating}/10</span>
                              <span className="text-gray-500 text-xs">IMDb</span>
                            </div>
                          )}

                          {(() => {
                            let platforms: string[] = [];
                            if (currentMovie.moviePlatform) {
                              if (Array.isArray(currentMovie.moviePlatform)) {
                                platforms = currentMovie.moviePlatform.filter(p => p && p.trim() !== '');
                              } else if (typeof currentMovie.moviePlatform === 'string') {
                                platforms = currentMovie.moviePlatform
                                  .split(/[,;|]/)
                                  .map(p => p.trim())
                                  .filter(p => p !== '' && p !== 'N/A');
                              }
                            }
                            return platforms.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {platforms.map((platform, index) => (
                                  <span
                                    key={index}
                                    className="px-2 py-0.5 text-xs text-blue-200 bg-blue-900/30 rounded-full font-light"
                                  >
                                    {platform}
                                  </span>
                                ))}
                              </div>
                            ) : null;
                          })()}
                        </div>
                      </div>
                    )}

                    {showDescription && (
                      <div className="p-4 space-y-3 h-full overflow-y-auto custom-scrollbar flex flex-col">
                        <h2 className="text-white text-2xl font-bold tracking-tight mb-2">
                          {currentMovie.movieTitle}
                        </h2>

                        <p className="text-gray-300 text-sm font-light flex items-center gap-2">
                          <span>{currentMovie.movieYear}</span>
                          {currentMovie.movieType && currentMovie.movieType !== 'N/A' && (
                            <span className="px-2 py-0.5 text-xs text-gray-300 bg-white/10 rounded-full capitalize">{currentMovie.movieType}</span>
                          )}
                        </p>

                        {currentMovie.movieDirectors && currentMovie.movieDirectors !== 'N/A' && (
                          <div className="flex items-center gap-2 text-gray-400 text-sm font-light">
                            <Clapperboard className="w-4 h-4 flex-shrink-0" />
                            <span>Directed by {currentMovie.movieDirectors}</span>
                          </div>
                        )}

                        {(currentMovie.movieRuntime || currentMovie.movieContentRating) && (
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-400 font-light">
                            {currentMovie.movieRuntime && currentMovie.movieRuntime !== 'N/A' && (
                              <div className="flex items-center space-x-1">
                                <Clock className="w-4 h-4" />
                                <span>{currentMovie.movieRuntime}</span>
                              </div>
                            )}
                            {currentMovie.movieContentRating && currentMovie.movieContentRating !== 'N/A' && (
                              <div className="flex items-center space-x-1">
                                <Shield className="w-4 h-4" />
                                <span>{currentMovie.movieContentRating}</span>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="flex flex-wrap gap-2">
                          {currentMovie.movieGenres.split(',').map((genre, index) => (
                            <span
                              key={index}
                              className="px-2.5 py-0.5 text-xs text-purple-200 bg-purple-900/30 border border-purple-700/30 rounded-full font-light"
                            >
                              {genre.trim()}
                            </span>
                          ))}
                        </div>

                        <p className="text-gray-400 font-light text-sm leading-relaxed flex-grow pt-2">
                          {currentMovie.movieDescription}
                        </p>
                      </div>
                    )}

                    <motion.button
                      onClick={toggleDescription}
                      className="absolute bottom-4 right-4 z-30 p-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white/60 hover:bg-white/20 transition-colors duration-200 flex items-center justify-center"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      title={showDescription ? "Kliknij, aby zobaczyć grafikę" : "Kliknij, aby zobaczyć opis"}
                      aria-label={showDescription ? "Pokaż grafikę" : "Pokaż opis"}
                    >
                      <MousePointerClick className="w-10 h-10" />
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          <motion.div
            className="flex space-x-4 justify-center"
            variants={itemVariants}
          >
            <motion.button
              onClick={() => handleVote('watched')}
              disabled={isSubmitting}
              className="flex-1 py-3 px-4 rounded-full font-light border border-red-500/30 bg-red-500/10 text-red-200 hover:bg-red-500/20 hover:border-red-500/50 hover:text-red-100 hover:scale-[1.02] transition-all duration-300 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              whileTap={{ scale: isSubmitting ? 1 : 0.95 }}
            >
              <X className="w-5 h-5" />
              <span>Already Watched</span>
            </motion.button>

            <motion.button
              onClick={() => handleVote('not_watched')}
              disabled={isSubmitting}
              className="flex-1 py-3 px-4 rounded-full font-light border border-green-500/30 bg-green-500/10 text-green-200 hover:bg-green-500/20 hover:border-green-500/50 hover:text-green-100 hover:scale-[1.02] transition-all duration-300 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              whileTap={{ scale: isSubmitting ? 1 : 0.95 }}
            >
              <Heart className="w-5 h-5" />
              <span>Want to Watch</span>
            </motion.button>
          </motion.div>

          <motion.p
            className="text-center text-gray-500 text-xs font-light"
            variants={itemVariants}
          >
            Swipe cards or use buttons
          </motion.p>
        </motion.div>
      </div>
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255,255,255,0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.2);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.3);
        }
      `}</style>
    </div>
  )
}