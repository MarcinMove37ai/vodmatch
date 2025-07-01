// src/components/MoviePreferencesScreen.tsx - Z DELIKATNYM EFEKTEM GLOW
'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Star, ArrowRight, ArrowLeft } from 'lucide-react'

interface MoviePreferencesScreenProps {
  onContinue: (preferences: {
    excludedGenres: string[]
    minImdbRating?: number
    maxImdbRating?: number
    onlyUnrated?: boolean
    minYear?: number
    maxYear?: number
  }) => void
}

// ✅ GATUNKI - na podstawie rzeczywistych danych z Pinecone
const AVAILABLE_GENRES = [
  { id: 'Horror', name: 'Horror', emoji: '🔪', description: 'Scary and suspenseful films' },
  { id: 'Documentary', name: 'Documentary', emoji: '📚', description: 'Real-life stories and factual content' },
  { id: 'Animation', name: 'Animation', emoji: '🎬', description: 'Animated films and cartoons' },
  { id: 'Music', name: 'Music', emoji: '🎵', description: 'Musical films and concerts' },
  { id: 'Biography', name: 'Biography', emoji: '👤', description: 'Life stories of real people' },
  { id: 'Sci-Fi', name: 'Sci-Fi', emoji: '🚀', description: 'Science fiction adventures' },
  { id: 'Western', name: 'Western', emoji: '🤠', description: 'Wild West and cowboy films' },
  { id: 'Reality-TV', name: 'Reality-TV', emoji: '📺', description: 'Reality shows and unscripted content' }
]

const CUSTOM_RATING_OPTIONS = [
  { value: 0, label: '"Eyes Bleed" Mode', emoji: '🩸', description: 'Score 4 and less' },
  { value: -1, label: 'Unrated only', emoji: '❓', description: 'No ratings available' }
]

const STANDARD_RATING_OPTIONS = [
  { value: 5, label: '5+', emoji: '✨', description: 'Above average' },
  { value: 6, label: '6+', emoji: '🔥', description: 'High quality' },
  { value: 7, label: '7+', emoji: '💎', description: 'Excellent films' },
  { value: 8, label: '8+', emoji: '🏆', description: 'Masterpieces only' }
]

const YEAR_OPTIONS = [
  { type: 'under_2000', label: 'Under 2000', emoji: '📼', description: 'Classic cinema era' },
  { type: 'above_2000', label: 'Above 2000', emoji: '🎬', description: 'Modern films' },
  { type: 'past_5_years', label: 'Only past 5 years', emoji: '🔥', description: 'Latest releases' },
  { type: 'older_than', label: 'Older than', emoji: '⏰', description: 'Custom year filter' }
]

export default function MoviePreferencesScreen({ onContinue }: MoviePreferencesScreenProps) {
  // Zarządzanie aktualnym krokiem
  const [step, setStep] = useState<'genres' | 'rating' | 'year'>('genres')

  // Stany przechowujące wybory użytkownika
  const [excludedGenres, setExcludedGenres] = useState<string[]>([])
  const [minImdbRating, setMinImdbRating] = useState<number>(6)
  const [yearFilter, setYearFilter] = useState<{ type: string, value?: number }>({ type: 'above_2000' })
  const [customYear, setCustomYear] = useState<string>('')

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

  // Walidacja dla year step
  const canContinueFromYear = () => {
    if (yearFilter.type === 'older_than') {
      return customYear.trim() !== '' && !isNaN(parseInt(customYear)) && parseInt(customYear) > 1800 && parseInt(customYear) < 2030
    }
    return true
  }

  // Handler dla opcji roku
  const handleYearOption = (type: string) => {
    if (type === 'older_than') {
      setYearFilter({ type, value: customYear ? parseInt(customYear) : undefined })
    } else {
      setYearFilter({ type })
    }
  }

  // Konwersja danych UI → Database format
  const convertToDbFormat = () => {
    const currentYear = new Date().getFullYear()
    const result: any = { excludedGenres }

    // Rating conversion
    if (minImdbRating === 0) {
      result.maxImdbRating = 4  // Eyes bleed mode: max 4 rating
    } else if (minImdbRating === -1) {
      result.onlyUnrated = true  // Unrated only: special flag
    } else {
      result.minImdbRating = minImdbRating  // Standard cases: 5+, 6+, 7+, 8+
    }

    // Year conversion
    switch(yearFilter.type) {
      case 'under_2000':
        result.maxYear = 1999
        break
      case 'above_2000':
        result.minYear = 2000
        break
      case 'past_5_years':
        result.minYear = currentYear - 5
        break
      case 'older_than':
        if (yearFilter.value && !isNaN(yearFilter.value)) {
          result.maxYear = yearFilter.value
        }
        break
    }

    return result
  }

  // Obsługa przejścia do następnego kroku
  const handleNextStep = () => {
    if (step === 'genres' && canContinueToRating) {
      setStep('rating')
    } else if (step === 'rating') {
      setStep('year')
    } else if (step === 'year' && canContinueFromYear()) {
      onContinue(convertToDbFormat())
    }
  }

  // Handler cofania
  const handleBackStep = () => {
    if (step === 'rating') {
      setStep('genres')
    } else if (step === 'year') {
      setStep('rating')
    }
  }

  // Warianty animacji dla płynnego przejścia
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
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center space-y-6 sm:space-y-8 mb-8"
        >
          <div className="space-y-3">
            <h1 className="text-4xl font-light bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent tracking-tight">
              Set your preferences
            </h1>
            <div className="w-24 h-px bg-gradient-to-r from-transparent via-gray-700/40 to-transparent mx-auto"></div>
            <p className="text-gray-400 text-sm font-light tracking-wide">
              {step === 'genres'
                ? <>Exclude genres you <span className="font-bold underline decoration-1 underline-offset-2">don't want</span> today</>
                : step === 'rating'
                ? <>Set your <span className="font-bold underline decoration-1 underline-offset-2">IMDB rating</span> expectations</>
                : <>Choose your preferred <span className="font-bold underline decoration-1 underline-offset-2">movie era</span></>}
            </p>
          </div>

          {/* Progress Bar */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-3"
          >
            {/* Step counter */}
            <div className="text-center">
              <span className="text-gray-400 text-sm font-light">
                Step {step === 'genres' ? '1' : step === 'rating' ? '2' : '3'} of 3
              </span>
            </div>

            {/* Progress bar */}
            <div className="max-w-xs mx-auto">
              <div className="w-full bg-white/10 rounded-full h-1.5">
                <motion.div
                  className="bg-gradient-to-r from-blue-500 to-purple-500 h-1.5 rounded-full"
                  animate={{
                    width: step === 'genres' ? '0%' : step === 'rating' ? '33%' : '66%'
                  }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Kontener dla animowanych kroków */}
        <div className="max-w-lg w-full">
          <AnimatePresence mode="wait" custom={step === 'genres' ? 1 : step === 'rating' ? 0 : -1}>
            {step === 'genres' && (
              <motion.div
                key="genres-step"
                custom={1}
                variants={stepVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="space-y-6"
              >
                <div className="space-y-4">
                  <div className="text-center space-y-2">
                    <p className="text-gray-500 text-sm">
                      Choose {3 - excludedGenres.length} more genre{3 - excludedGenres.length !== 1 ? 's' : ''} to avoid
                    </p>
                  </div>

                  {/* Gatunki z efektem glow */}
                  <div className="grid grid-cols-2 gap-3">
                    {AVAILABLE_GENRES.map((genre) => {
                      const isSelected = excludedGenres.includes(genre.id)
                      const isDisabled = !isSelected && excludedGenres.length >= 3
                      return (
                        <button
                          key={genre.id}
                          onClick={() => toggleGenre(genre.id)}
                          disabled={isDisabled}
                          className={`p-3 rounded-xl border transition-all duration-300 group relative overflow-hidden ${
                            isSelected
                              ? 'border-red-500/50 bg-gradient-to-br from-red-900/30 to-red-800/20 scale-[0.98]'
                              : isDisabled
                                ? 'border-gray-700/30 bg-gray-800/20 opacity-50 cursor-not-allowed'
                                : 'border-gray-700/50 bg-gradient-to-br from-gray-900/40 to-gray-800/30 hover:border-gray-600/70 hover:from-gray-900/60 hover:to-gray-800/50 hover:scale-[1.02]'
                          }`}
                        >
                          {/* ✅ EFEKT GLOW - delikatny czerwony dla excluded genres */}
                          {isSelected && (
                            <div className="absolute -inset-1 rounded-xl bg-red-500/10 blur-sm" />
                          )}

                          <div className="relative flex flex-col items-center space-y-2">
                            <div className="text-2xl">{genre.emoji}</div>
                            <div className="text-center">
                              <p className="text-white font-light text-sm">{genre.name}</p>
                              <p className="text-gray-500 text-xs font-light leading-tight">{genre.description}</p>
                            </div>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                              isSelected
                                ? 'border-red-400 bg-red-500 scale-110'
                                : isDisabled
                                  ? 'border-gray-600'
                                  : 'border-gray-600 group-hover:border-gray-400'
                            }`}>
                              {isSelected && <X className="w-3 h-3 text-white animate-in zoom-in duration-200" />}
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
                    <p className="text-gray-500 text-sm">
                      {minImdbRating === -1
                        ? 'Unrated movies only'
                        : minImdbRating === 0
                        ? 'Movies rated 4 and below'
                        : `Only movies rated ${minImdbRating}+ will be considered`}
                    </p>
                  </div>
                  <div className="space-y-4">
                    {/* Opcje standardowe z efektem glow */}
                    <div className="grid grid-cols-2 gap-3">
                      {STANDARD_RATING_OPTIONS.map((rating) => {
                        const isSelected = minImdbRating === rating.value
                        return (
                          <button
                            key={rating.value}
                            onClick={() => setMinImdbRating(rating.value)}
                            className={`p-3 rounded-xl border transition-all duration-300 group relative overflow-hidden ${
                              isSelected
                                ? 'border-yellow-500/50 bg-gradient-to-br from-yellow-900/30 to-yellow-800/20 scale-105'
                                : 'border-gray-700/50 bg-gradient-to-br from-gray-900/40 to-gray-800/30 hover:border-gray-600/70 hover:scale-[1.02]'
                            }`}
                          >
                            {/* ✅ EFEKT GLOW - delikatny żółty dla rating options */}
                            {isSelected && (
                              <div className="absolute -inset-1 rounded-xl bg-yellow-500/10 blur-sm" />
                            )}

                            <div className="relative flex flex-col items-center space-y-2">
                              <div className="text-2xl">{rating.emoji}</div>
                              <div className="text-center">
                                <p className="text-white font-light text-sm">{rating.label}</p>
                                <p className="text-gray-500 text-xs font-light leading-tight">{rating.description}</p>
                              </div>
                              <Star className={`w-4 h-4 transition-colors duration-300 ${
                                isSelected ? 'text-yellow-400' : 'text-gray-400'
                              }`} />
                            </div>
                          </button>
                        )
                      })}
                    </div>

                    {/* Delikatna linia podziału */}
                    <div className="flex justify-center">
                      <div className="w-24 h-px bg-gradient-to-r from-transparent via-gray-700/40 to-transparent"></div>
                    </div>

                    {/* Opcje niestandardowe z efektem glow */}
                    <div className="grid grid-cols-2 gap-3">
                      {CUSTOM_RATING_OPTIONS.map((rating) => {
                        const isSelected = minImdbRating === rating.value
                        return (
                          <button
                            key={rating.value}
                            onClick={() => setMinImdbRating(rating.value)}
                            className={`p-3 rounded-xl border transition-all duration-300 group relative overflow-hidden ${
                              isSelected
                                ? 'border-yellow-500/50 bg-gradient-to-br from-yellow-900/30 to-yellow-800/20 scale-105'
                                : 'border-gray-700/50 bg-gradient-to-br from-gray-900/40 to-gray-800/30 hover:border-gray-600/70 hover:scale-[1.02]'
                            }`}
                          >
                            {/* ✅ EFEKT GLOW - delikatny żółty dla custom rating options */}
                            {isSelected && (
                              <div className="absolute -inset-1 rounded-xl bg-yellow-500/10 blur-sm" />
                            )}

                            <div className="relative flex flex-col items-center space-y-2">
                              <div className="text-2xl">{rating.emoji}</div>
                              <div className="text-center">
                                <p className="text-white font-light text-sm">{rating.label}</p>
                                <p className="text-gray-500 text-xs font-light leading-tight">{rating.description}</p>
                              </div>
                              <Star className={`w-4 h-4 transition-colors duration-300 ${
                                isSelected ? 'text-yellow-400' : 'text-gray-400'
                              }`} />
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 'year' && (
              <motion.div
                key="year-step"
                custom={-1}
                variants={stepVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="space-y-6"
              >
                <div className="space-y-4">
                  <div className="text-center space-y-2">
                    <p className="text-gray-500 text-sm">
                      Select your preferred movie timeline
                    </p>
                  </div>

                  {/* Opcje roku z efektem glow */}
                  <div className="grid grid-cols-2 gap-3">
                    {YEAR_OPTIONS.map((option) => {
                      const isSelected = yearFilter.type === option.type
                      return (
                        <button
                          key={option.type}
                          onClick={() => handleYearOption(option.type)}
                          className={`p-3 rounded-xl border transition-all duration-300 group relative overflow-hidden ${
                            isSelected
                              ? 'border-blue-500/50 bg-gradient-to-br from-blue-900/30 to-blue-800/20 scale-105'
                              : 'border-gray-700/50 bg-gradient-to-br from-gray-900/40 to-gray-800/30 hover:border-gray-600/70 hover:scale-[1.02]'
                          }`}
                        >
                          {/* ✅ EFEKT GLOW - delikatny niebieski dla year options */}
                          {isSelected && (
                            <div className="absolute -inset-1 rounded-xl bg-blue-500/10 blur-sm" />
                          )}

                          <div className="relative flex flex-col items-center space-y-2">
                            <div className="text-2xl">{option.emoji}</div>
                            <div className="text-center">
                              <p className="text-white font-light text-sm">{option.label}</p>
                              <p className="text-gray-500 text-xs font-light leading-tight">{option.description}</p>
                            </div>
                            <div className={`w-4 h-4 transition-colors duration-300 ${
                              isSelected ? 'text-blue-400' : 'text-gray-400'
                            }`}>
                              📅
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>

                  {/* Input dla "Older than" */}
                  {yearFilter.type === 'older_than' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex justify-center"
                    >
                      <input
                        type="number"
                        placeholder="Enter year (e.g. 1995)"
                        value={customYear}
                        onChange={(e) => {
                          setCustomYear(e.target.value)
                          if (e.target.value) {
                            setYearFilter({ type: 'older_than', value: parseInt(e.target.value) })
                          }
                        }}
                        className="px-4 py-2 rounded-lg bg-gray-800/50 border border-gray-600 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none transition-colors duration-300"
                      />
                    </motion.div>
                  )}
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
            {/* Back Button */}
            {(step === 'rating' || step === 'year') && (
              <motion.button
                onClick={handleBackStep}
                whileTap={{ scale: 0.97 }}
                className="bg-gradient-to-r from-gray-700/50 to-gray-600/50 hover:from-gray-600/70 hover:to-gray-500/70 text-white font-light rounded-2xl transition-all duration-300 hover:scale-[1.02] py-4 px-6 flex items-center justify-center space-x-3"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Back</span>
              </motion.button>
            )}

            {/* Primary Action Button */}
            <motion.button
              onClick={handleNextStep}
              whileTap={{ scale: 0.97 }}
              disabled={
                (step === 'genres' && !canContinueToRating) ||
                (step === 'year' && !canContinueFromYear())
              }
              className={`w-full py-4 px-6 rounded-2xl font-light transition-all duration-300 flex items-center justify-center space-x-3 ${
                step === 'genres'
                  ? (canContinueToRating
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border border-blue-600/20 hover:border-blue-500/40 hover:scale-[1.02]'
                      : 'bg-gradient-to-r from-gray-700 to-gray-600 text-gray-400 border border-gray-600/20 cursor-not-allowed')
                  : step === 'rating'
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border border-blue-600/20 hover:border-blue-500/40 hover:scale-[1.02]'
                  : (canContinueFromYear()
                      ? 'bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 text-black shadow-lg shadow-yellow-500/20 hover:scale-[1.02]'
                      : 'bg-gradient-to-r from-gray-700 to-gray-600 text-gray-400 border border-gray-600/20 cursor-not-allowed')
              }`}
            >
              <span>
                {step === 'genres'
                  ? (canContinueToRating ? 'Continue' : `Select ${3 - excludedGenres.length} more`)
                  : step === 'rating'
                  ? 'Continue'
                  : (canContinueFromYear() ? 'Set Preferences' : 'Enter valid year')}
              </span>
              {((step === 'genres' && canContinueToRating) || (step === 'rating') || (step === 'year' && canContinueFromYear())) && <ArrowRight className="w-5 h-5" />}
            </motion.button>
          </motion.div>
        </div>
      </div>
    </div>
  )
}