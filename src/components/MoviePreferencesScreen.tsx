// src/components/MoviePreferencesScreen.tsx - WERSJA DWUETAPOWA
'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Star, ArrowRight, ArrowLeft, Film } from 'lucide-react'

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
  // NOWY STAN: Zarządzanie aktualnym krokiem (genres lub rating)
  const [step, setStep] = useState<'genres' | 'rating'>('genres')

  // Stany przechowujące wybory użytkownika pozostają bez zmian
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

  // Warunek przejścia do kroku z oceną
  const canContinueToRating = excludedGenres.length === 3

  // Zaktualizowana funkcja obsługująca przycisk - teraz zarządza przejściami
  const handleNextStep = () => {
    if (step === 'genres' && canContinueToRating) {
      setStep('rating')
    } else if (step === 'rating') {
      onContinue({
        excludedGenres,
        minImdbRating
      })
    }
  }

  // Warianty animacji dla płynnego przejścia - POPRAWKA: uproszczenie bez custom transition
  const stepVariants = {
    hidden: (direction: number) => ({
      opacity: 0,
      x: direction > 0 ? '50%' : '-50%',
    }),
    visible: {
      opacity: 1,
      x: '0%',
    },
    exit: (direction: number) => ({
      opacity: 0,
      x: direction < 0 ? '50%' : '-50%',
    }),
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-purple-900 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-950/10 via-transparent to-violet-950/20"></div>

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-6">
        {/* Nagłówek pozostaje ten sam dla obu kroków */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center space-y-3 mb-8"
        >
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-r from-yellow-500 to-amber-600 flex items-center justify-center shadow-lg shadow-yellow-500/25">
            <Film className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-light bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent tracking-tight">
            Winner's Choice
          </h1>
          <div className="w-16 h-px bg-gradient-to-r from-yellow-600/60 via-amber-600/60 to-transparent mx-auto"></div>
        </motion.div>

        {/* Kontener dla animowanych kroków */}
        <div className="max-w-lg w-full">
          <AnimatePresence mode="wait" custom={step === 'genres' ? 1 : -1}>
            {step === 'genres' && (
              <motion.div
                key="genres-step"
                custom={1}
                variants={stepVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="space-y-8"
              >
                <div className="space-y-4">
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
                        <button key={genre.id} onClick={() => toggleGenre(genre.id)} disabled={isDisabled} className={`w-full p-4 rounded-xl border transition-all duration-300 group relative overflow-hidden ${ isSelected ? 'border-red-500/50 bg-gradient-to-br from-red-900/30 to-red-800/20 scale-[0.98]' : isDisabled ? 'border-gray-700/30 bg-gray-800/20 opacity-50 cursor-not-allowed' : 'border-gray-700/50 bg-gradient-to-br from-gray-900/40 to-gray-800/30 hover:border-gray-600/70 hover:from-gray-900/60 hover:to-gray-800/50 hover:scale-[1.02]'}`}>
                          <div className="relative flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              <div className="text-2xl">{genre.emoji}</div>
                              <div className="text-left">
                                <p className="text-white font-light text-lg">{genre.name}</p>
                                <p className="text-gray-500 text-xs font-light">{genre.description}</p>
                              </div>
                            </div>
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${isSelected ? 'border-red-400 bg-red-500 scale-110' : isDisabled ? 'border-gray-600' : 'border-gray-600 group-hover:border-gray-400'}`}>
                              {isSelected && <X className="w-4 h-4 text-white animate-in zoom-in duration-200" />}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </motion.div>
            )}

            {step === 'rating' && (
              <motion.div
                key="rating-step"
                custom={-1}
                variants={stepVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="space-y-8"
              >
                <div className="space-y-4">
                  <div className="text-center space-y-2">
                    <h2 className="text-xl text-white font-light">Minimum IMDB Rating</h2>
                    <p className="text-gray-500 text-sm">Only movies rated {minImdbRating}+ will be considered</p>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {RATING_OPTIONS.map((rating) => (
                      <button key={rating.value} onClick={() => setMinImdbRating(rating.value)} className={`p-3 rounded-lg border transition-all duration-300 group ${minImdbRating === rating.value ? 'border-yellow-500/50 bg-gradient-to-br from-yellow-900/30 to-yellow-800/20 scale-105' : 'border-gray-700/50 bg-gradient-to-br from-gray-900/40 to-gray-800/30 hover:border-gray-600/70 hover:scale-102'}`}>
                        <div className="flex flex-col items-center space-y-1">
                          <Star className={`w-4 h-4 ${minImdbRating === rating.value ? 'text-yellow-400' : 'text-gray-400'}`} />
                          <span className={`text-sm font-medium ${minImdbRating === rating.value ? 'text-yellow-300' : 'text-gray-300'}`}>{rating.label}</span>
                          <span className="text-xs text-gray-500 text-center leading-tight">{rating.description}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Przyciski nawigacyjne */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="flex items-center space-x-4 mt-8"
          >
            {step === 'rating' && (
              <button onClick={() => setStep('genres')} className="h-14 px-6 rounded-xl font-light text-gray-300 border border-gray-700 hover:bg-gray-800 transition-colors duration-300 flex items-center space-x-2">
                <ArrowLeft className="w-5 h-5" />
                <span>Back</span>
              </button>
            )}
            <button onClick={handleNextStep} disabled={step === 'genres' && !canContinueToRating} className={`w-full h-14 px-6 rounded-xl font-light transition-all duration-300 flex items-center justify-center space-x-3 ${step === 'genres' ? (canContinueToRating ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-700 text-gray-400 cursor-not-allowed') : 'bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 text-black shadow-lg shadow-yellow-500/20'}`}>
              <span>
                {step === 'genres' ? (canContinueToRating ? 'Continue' : `Select ${3 - excludedGenres.length} more`) : 'Set Preferences'}
              </span>
              {(step === 'genres' ? canContinueToRating : true) && <ArrowRight className="w-5 h-5" />}
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  )
}