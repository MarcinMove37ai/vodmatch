'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, Check, Star, ArrowRight, Film } from 'lucide-react'

interface MoviePreferencesScreenProps {
  onContinue: (preferences: { excludedGenres: string[], minImdbRating: number }) => void
}

const AVAILABLE_GENRES = [
  { id: 'horror', name: 'Horror', emoji: '🔪', description: 'Scary and suspenseful films' },
  { id: 'thriller', name: 'Thriller', emoji: '🎭', description: 'Edge-of-your-seat excitement' },
  { id: 'sci-fi', name: 'Sci-Fi', emoji: '🚀', description: 'Science fiction adventures' },
  { id: 'mystery', name: 'Mystery', emoji: '🔍', description: 'Puzzling whodunits' },
  { id: 'crime', name: 'Crime', emoji: '🚔', description: 'Criminal underworld stories' }
]

const RATING_OPTIONS = [
  { value: 1, label: '1+', description: 'Any movie' },
  { value: 2, label: '2+', description: 'Avoid the worst' },
  { value: 3, label: '3+', description: 'Decent quality' },
  { value: 4, label: '4+', description: 'Good movies' },
  { value: 5, label: '5+', description: 'Above average' },
  { value: 6, label: '6+', description: 'High quality' },
  { value: 7, label: '7+', description: 'Excellent films' },
  { value: 8, label: '8+', description: 'Masterpieces only' }
]

export default function MoviePreferencesScreen({ onContinue }: MoviePreferencesScreenProps) {
  const [excludedGenres, setExcludedGenres] = useState<string[]>([])
  const [minImdbRating, setMinImdbRating] = useState<number>(6)

  const toggleGenre = (genreId: string) => {
    setExcludedGenres(prev => {
      if (prev.includes(genreId)) {
        return prev.filter(id => id !== genreId)
      } else if (prev.length < 3) {
        return [...prev, genreId]
      }
      return prev
    })
  }

  const canContinue = excludedGenres.length === 3

  const handleContinue = () => {
    if (!canContinue) return
    onContinue({
      excludedGenres,
      minImdbRating
    })
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.07,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
      },
    },
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-purple-900 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-950/10 via-transparent to-violet-950/20"></div>
      <div className="absolute top-1/4 right-1/4 w-px h-24 bg-gradient-to-b from-transparent via-blue-600/40 to-transparent"></div>
      <div className="absolute bottom-1/3 left-1/3 w-24 h-px bg-gradient-to-r from-transparent via-purple-600/40 to-transparent"></div>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
        <motion.div
          className="max-w-lg w-full space-y-8"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Header */}
          <motion.div variants={itemVariants} className="text-center space-y-3">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-r from-yellow-500 to-amber-600 flex items-center justify-center shadow-lg shadow-yellow-500/25">
              <Film className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-light bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent tracking-tight">
              Winner's Choice
            </h1>
            <div className="w-16 h-px bg-gradient-to-r from-yellow-600/60 via-amber-600/60 to-transparent mx-auto"></div>
            <p className="text-gray-400 font-light text-sm leading-relaxed">
              Set movie preferences for your group
            </p>
          </motion.div>

          {/* Exclude Genres Section */}
          <motion.div variants={itemVariants} className="space-y-4">
            <div className="text-center space-y-2">
              <h2 className="text-xl text-white font-light">Exclude 3 Genres</h2>
              <p className="text-gray-500 text-sm">
                Choose {3 - excludedGenres.length} more genre{3 - excludedGenres.length !== 1 ? 's' : ''} to avoid
              </p>
            </div>

            <div className="space-y-3">
              {AVAILABLE_GENRES.map((genre) => {
                const isSelected = excludedGenres.includes(genre.id)
                const isDisabled = !isSelected && excludedGenres.length >= 3

                return (
                  <motion.div
                    key={genre.id}
                    variants={itemVariants}
                  >
                    <button
                      onClick={() => toggleGenre(genre.id)}
                      disabled={isDisabled}
                      className={`w-full p-4 rounded-xl border transition-all duration-300 group relative overflow-hidden ${
                        isSelected
                          ? 'border-red-500/50 bg-gradient-to-br from-red-900/30 to-red-800/20 scale-[0.98]'
                          : isDisabled
                          ? 'border-gray-700/30 bg-gray-800/20 opacity-50 cursor-not-allowed'
                          : 'border-gray-700/50 bg-gradient-to-br from-gray-900/40 to-gray-800/30 hover:border-gray-600/70 hover:from-gray-900/60 hover:to-gray-800/50 hover:scale-[1.02]'
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute inset-0 bg-gradient-to-r from-red-500/15 to-pink-600/15 rounded-xl transition-opacity duration-300"></div>
                      )}

                      <div className="relative flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="text-2xl">{genre.emoji}</div>
                          <div className="text-left">
                            <p className="text-white font-light text-lg">{genre.name}</p>
                            <p className="text-gray-500 text-xs font-light">{genre.description}</p>
                          </div>
                        </div>

                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                          isSelected
                            ? 'border-red-400 bg-red-500 scale-110'
                            : isDisabled
                            ? 'border-gray-600'
                            : 'border-gray-600 group-hover:border-gray-400'
                        }`}>
                          {isSelected ? (
                            <X className="w-4 h-4 text-white animate-in zoom-in duration-200" />
                          ) : !isDisabled && (
                            <div className="w-2 h-2 bg-gray-600 rounded-full group-hover:bg-gray-400 transition-colors duration-300"></div>
                          )}
                        </div>
                      </div>
                    </button>
                  </motion.div>
                )
              })}
            </div>
          </motion.div>

          {/* IMDB Rating Section */}
          <motion.div variants={itemVariants} className="space-y-4">
            <div className="text-center space-y-2">
              <h2 className="text-xl text-white font-light">Minimum IMDB Rating</h2>
              <p className="text-gray-500 text-sm">
                Only movies rated {minImdbRating}+ will be considered
              </p>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {RATING_OPTIONS.map((rating) => (
                <button
                  key={rating.value}
                  onClick={() => setMinImdbRating(rating.value)}
                  className={`p-3 rounded-lg border transition-all duration-300 group ${
                    minImdbRating === rating.value
                      ? 'border-yellow-500/50 bg-gradient-to-br from-yellow-900/30 to-yellow-800/20 scale-105'
                      : 'border-gray-700/50 bg-gradient-to-br from-gray-900/40 to-gray-800/30 hover:border-gray-600/70 hover:scale-102'
                  }`}
                >
                  <div className="flex flex-col items-center space-y-1">
                    <Star className={`w-4 h-4 ${
                      minImdbRating === rating.value ? 'text-yellow-400' : 'text-gray-400'
                    }`} />
                    <span className={`text-sm font-medium ${
                      minImdbRating === rating.value ? 'text-yellow-300' : 'text-gray-300'
                    }`}>
                      {rating.label}
                    </span>
                    <span className="text-xs text-gray-500 text-center leading-tight">
                      {rating.description}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>

          {/* Selection Summary */}
          <motion.div variants={itemVariants}>
            {excludedGenres.length > 0 && (
              <div className="p-4 rounded-xl bg-gray-900/40 border border-gray-700/40 backdrop-blur-sm">
                <h3 className="text-sm text-gray-300 mb-2">Your preferences:</h3>
                <div className="space-y-1 text-xs text-gray-400">
                  <p>• Excluding: {excludedGenres.map(id => AVAILABLE_GENRES.find(g => g.id === id)?.name).join(', ')}</p>
                  <p>• Minimum rating: {minImdbRating}/10 on IMDB</p>
                </div>
              </div>
            )}
          </motion.div>

          {/* Continue Button */}
          <motion.div variants={itemVariants}>
            <button
              onClick={handleContinue}
              disabled={!canContinue}
              className={`w-full py-4 px-6 rounded-xl font-light transition-all duration-300 flex items-center justify-center space-x-3 ${
                canContinue
                  ? 'bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 text-black border border-yellow-600/20 hover:border-yellow-500/40 hover:scale-[1.02] shadow-lg shadow-yellow-500/20'
                  : 'bg-gradient-to-r from-gray-700 to-gray-600 text-gray-400 border border-gray-600/20 cursor-not-allowed'
              }`}
            >
              <span>
                {canContinue
                  ? 'Set Preferences'
                  : `Select ${3 - excludedGenres.length} more genre${3 - excludedGenres.length !== 1 ? 's' : ''}`
                }
              </span>
              {canContinue && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />}
            </button>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}