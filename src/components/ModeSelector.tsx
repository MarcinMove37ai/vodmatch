'use client'

import { useState } from 'react'
import { motion } from 'framer-motion' // [ZMIANA] Dodano import
import { User, Users2, Users, ArrowRight } from 'lucide-react'
import { ViewingMode, VIEWING_MODES } from '@/types/mode'

interface ModeSelectorProps {
  onContinue: (selectedMode: ViewingMode) => void
  // [ZMIANA] Prop `showContent` został usunięty
}

const getIcon = (iconName: string) => {
  switch (iconName) {
    case 'user': return User
    case 'users-2': return Users2
    case 'users': return Users
    default: return User
  }
}

export default function ModeSelector({ onContinue }: ModeSelectorProps) {
  const [modes, setModes] = useState<ViewingMode[]>(VIEWING_MODES)
  // [ZMIANA] Usunięto stan `isAnimating`

  const selectMode = (modeId: string) => {
    setModes(prev =>
      prev.map(mode => ({
        ...mode,
        selected: mode.id === modeId
      }))
    )
  }

  const selectedMode = modes.find(m => m.selected)

  // [ZMIANA] Uproszczona funkcja, bez opóźnień
  const handleContinue = () => {
    if (!selectedMode) return
    onContinue(selectedMode)
  }

  // [ZMIANA] Definicje wariantów animacji, spójne z resztą aplikacji
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
        {/* [ZMIANA] Główny kontener animacji z wariantami */}
        <motion.div
          className="max-w-sm w-full space-y-8"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Header */}
          <motion.div variants={itemVariants} className="text-center space-y-3">
            <h1 className="text-3xl font-light bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent tracking-tight">
              Choose Mode
            </h1>
            <div className="w-16 h-px bg-gradient-to-r from-blue-600/60 via-purple-600/60 to-transparent mx-auto"></div>
            <p className="text-gray-400 font-light text-sm leading-relaxed">
              How many people will be watching?
            </p>
          </motion.div>

          {/* Mode Grid */}
          <div className="space-y-4">
            {modes.map((mode) => {
              const IconComponent = getIcon(mode.icon)
              return (
                // [ZMIANA] Każdy element listy jest teraz animowany indywidualnie
                <motion.div
                  key={mode.id}
                  variants={itemVariants}
                >
                  <button
                    onClick={() => selectMode(mode.id)}
                    className={`w-full p-6 rounded-2xl border transition-all duration-300 group relative overflow-hidden ${
                      mode.selected
                        ? 'border-blue-500/50 bg-gradient-to-br from-gray-800/80 to-gray-900/80 scale-[1.02]'
                        : 'border-gray-800/50 bg-gradient-to-br from-gray-900/40 to-gray-800/30 hover:border-gray-700/70 hover:from-gray-900/60 hover:to-gray-800/50 hover:scale-[1.01]'
                    }`}
                  >
                    {mode.selected && (
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/15 to-cyan-600/15 rounded-2xl transition-opacity duration-300"></div>
                    )}
                    <div className="relative text-center space-y-4">
                      <div className={`mx-auto w-16 h-16 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-all duration-300 ${
                        mode.selected ? 'scale-110 shadow-blue-500/25' : ''
                      }`}>
                        <IconComponent className="w-8 h-8 text-white" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-white font-light text-xl">{mode.displayName}</h3>
                        <p className="text-gray-400 text-sm font-light leading-relaxed">
                          {mode.description}
                        </p>
                      </div>
                      <div className={`mx-auto w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                        mode.selected
                          ? 'border-blue-400 bg-blue-500 scale-110'
                          : 'border-gray-600 group-hover:border-gray-400'
                      }`}>
                        {mode.selected && (
                          <div className="w-2 h-2 bg-white rounded-full animate-in zoom-in duration-200"></div>
                        )}
                      </div>
                    </div>
                  </button>
                </motion.div>
              )
            })}
          </div>

          {/* Continue button */}
          <motion.div variants={itemVariants}>
            <button
              onClick={handleContinue}
              disabled={!selectedMode}
              className={`w-full py-4 px-6 rounded-2xl font-light transition-all duration-300 flex items-center justify-center space-x-3 ${
                selectedMode
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border border-blue-600/20 hover:border-blue-500/40 hover:scale-[1.02]'
                  : 'bg-gradient-to-r from-gray-700 to-gray-600 text-gray-400 border border-gray-600/20 cursor-not-allowed'
              }`}
            >
              <span>Continue</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
            </button>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}