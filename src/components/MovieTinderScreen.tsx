// src/components/MovieTinderScreen.tsx
'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Film, Star, ThumbsUp, Eye } from 'lucide-react'

interface MovieResult {
  movieTitle: string
  movieDescription: string
  movieYear: string
  movieGenres: string
  movieImdbRating: string
  movieImgUrl: string | null
}

interface MovieTinderScreenProps {
  sessionId: string
  onFinish: () => void
}

const variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? '100%' : '-100%',
    opacity: 0,
    scale: 0.8
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1,
    scale: 1
  },
  exit: (direction: number) => ({
    zIndex: 0,
    x: direction < 0 ? '100%' : '-100%',
    opacity: 0,
    scale: 0.8
  })
}

export default function MovieTinderScreen({ sessionId, onFinish }: MovieTinderScreenProps) {
  const [movies, setMovies] = useState<MovieResult[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [[direction], setDirection] = useState([0])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchMovies = async () => {
      setIsLoading(true)
      try {
        const response = await fetch(`/api/session/${sessionId}/movies`)
        if (!response.ok) {
          throw new Error('Failed to fetch movies for the session.')
        }
        const data = await response.json()
        if (!data || data.length === 0) {
          throw new Error('No movies found for this session.')
        }
        setMovies(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred.')
      } finally {
        setIsLoading(false)
      }
    }
    if (sessionId) {
      fetchMovies()
    }
  }, [sessionId])

  const handleVote = (vote: 'watched' | 'not_watched') => {
    console.log(`Voted on movie "${movies[currentIndex].movieTitle}": ${vote}`);
    const nextDirection = vote === 'watched' ? -1 : 1;
    setDirection([nextDirection]);
    setCurrentIndex(prevIndex => (prevIndex + 1) % movies.length);
  };

  const currentMovie = movies[currentIndex]

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-purple-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="ml-4 text-white">Loading Movies...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-purple-900 flex flex-col items-center justify-center text-center p-4">
        <p className="text-red-400 text-lg mb-4">{error}</p>
        <button onClick={onFinish} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Go Back</button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-purple-900 relative overflow-hidden flex flex-col items-center justify-center p-4">
      <div className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-gradient-to-br from-blue-600/20 to-purple-600/10 rounded-full animate-pulse blur-3xl"></div>
      <div className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-gradient-to-tl from-emerald-600/20 to-green-600/10 rounded-full animate-pulse blur-3xl animation-delay-4000"></div>

      <div className="text-center mb-4 z-10">
        <div className="inline-flex items-center space-x-3 bg-gray-900/50 border border-gray-700/50 backdrop-blur-sm px-4 py-2 rounded-full">
          <Film className="w-5 h-5 text-purple-400" />
          <h1 className="text-xl font-light text-white">Movie Night Picks</h1>
        </div>
      </div>

      <div className="relative w-full max-w-sm h-[65vh] flex items-center justify-center">
        <AnimatePresence initial={false} custom={direction}>
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
        </AnimatePresence>
      </div>

      {/* ✅ PRZEBUDOWANE PRZYCISKI AKCJI */}
      <div className="relative z-10 mt-6 flex items-center justify-center w-full max-w-sm space-x-4">
        <motion.button
          onClick={() => handleVote('watched')}
          className="h-16 w-full rounded-xl font-light text-gray-300 border border-gray-700 bg-gray-900/40 backdrop-blur-sm hover:bg-gray-800/60 hover:border-gray-600 transition-all duration-300 flex items-center justify-center space-x-2"
          whileTap={{ scale: 0.95 }}
        >
          <Eye className="w-5 h-5 text-gray-400" />
          <span>Oglądałem/am</span>
        </motion.button>

        <motion.button
          onClick={() => handleVote('not_watched')}
          className="h-16 w-full rounded-xl font-medium text-white bg-gradient-to-r from-emerald-600 to-cyan-600 shadow-lg shadow-emerald-500/20 hover:from-emerald-500 hover:to-cyan-500 hover:brightness-110 transition-all duration-300 flex items-center justify-center space-x-2"
          whileTap={{ scale: 0.95 }}
        >
          <ThumbsUp className="w-5 h-5" />
          <span>Obejrzę!</span>
        </motion.button>
      </div>
    </div>
  )
}