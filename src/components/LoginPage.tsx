'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface LoginPageProps {
  onLogin: (password: string) => void
  error?: string
}

export default function LoginPage({ onLogin, error }: LoginPageProps) {
  const [pins, setPins] = useState<string[]>(['', '', '', '', ''])
  const [displayPins, setDisplayPins] = useState<string[]>(['', '', '', '', ''])
  const [isLoading, setIsLoading] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const timeoutRefs = useRef<(NodeJS.Timeout | null)[]>([])

  const clearAllFields = () => {
    setPins(['', '', '', '', ''])
    setDisplayPins(['', '', '', '', ''])
    // Clear all timeouts
    timeoutRefs.current.forEach(timeout => {
      if (timeout) clearTimeout(timeout)
    })
    timeoutRefs.current = [null, null, null, null, null]
    // Focus first input
    inputRefs.current[0]?.focus()
  }

  const handlePinChange = (index: number, value: string) => {
    // Allow only single character or special chars
    const newValue = value.slice(-1)
    const newPins = [...pins]
    const newDisplayPins = [...displayPins]

    newPins[index] = newValue
    newDisplayPins[index] = newValue

    setPins(newPins)
    setDisplayPins(newDisplayPins)

    // Clear existing timeout for this index
    if (timeoutRefs.current[index]) {
      clearTimeout(timeoutRefs.current[index]!)
    }

    // Hide character after 600ms if it's not empty
    if (newValue) {
      timeoutRefs.current[index] = setTimeout(() => {
        setDisplayPins(prev => {
          const updated = [...prev]
          updated[index] = '●'
          return updated
        })
      }, 600)

      // Auto-move to next input
      if (index < 4) {
        inputRefs.current[index + 1]?.focus()
      }
    }

    // Auto-submit when all 5 characters are filled
    const fullPin = newPins.join('')
    if (fullPin.length === 5) {
      // Clear all timeouts before submitting
      timeoutRefs.current.forEach(timeout => {
        if (timeout) clearTimeout(timeout)
      })
      handleSubmit(fullPin)
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    // Handle backspace
    if (e.key === 'Backspace') {
      const newPins = [...pins]
      const newDisplayPins = [...displayPins]

      if (pins[index]) {
        // Clear current field
        newPins[index] = ''
        newDisplayPins[index] = ''
        setPins(newPins)
        setDisplayPins(newDisplayPins)

        // Clear timeout for this index
        if (timeoutRefs.current[index]) {
          clearTimeout(timeoutRefs.current[index]!)
          timeoutRefs.current[index] = null
        }
      } else if (index > 0) {
        // Move to previous input and clear it
        newPins[index - 1] = ''
        newDisplayPins[index - 1] = ''
        setPins(newPins)
        setDisplayPins(newDisplayPins)
        inputRefs.current[index - 1]?.focus()

        // Clear timeout for previous index
        if (timeoutRefs.current[index - 1]) {
          clearTimeout(timeoutRefs.current[index - 1]!)
          timeoutRefs.current[index - 1] = null
        }
      }
    }

    // Handle Escape key to clear all
    if (e.key === 'Escape') {
      clearAllFields()
    }
  }

  const handleSubmit = async (pinValue?: string) => {
    const password = pinValue || pins.join('')
    if (password.length !== 5) return

    setIsLoading(true)
    onLogin(password)

    setTimeout(() => {
      setIsLoading(false)
    }, 500)
  }

  // Clear all fields when error appears
  useEffect(() => {
    if (error) {
      const timeout = setTimeout(() => {
        clearAllFields()
      }, 1000) // Give user time to see the error

      return () => clearTimeout(timeout)
    }
  }, [error])

  // Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach(timeout => {
        if (timeout) clearTimeout(timeout)
      })
    }
  }, [])

  // Animation variants zgodne z wzorcami
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
      {/* Background overlay zgodnie z wzorcami */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-950/10 via-transparent to-violet-950/20"></div>

      {/* Dekoracyjne linie zgodnie z wzorcami */}
      <div className="absolute top-1/4 right-1/4 w-px h-24 bg-gradient-to-b from-transparent via-blue-600/40 to-transparent"></div>
      <div className="absolute bottom-1/3 left-1/3 w-24 h-px bg-gradient-to-r from-transparent via-purple-600/40 to-transparent"></div>

      {/* Blur effects zgodnie z wzorcami QuizScreen */}
      <div className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-gradient-to-br from-blue-600/20 to-purple-600/10 rounded-full animate-pulse blur-3xl"></div>
      <div className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-gradient-to-tl from-purple-600/20 to-pink-600/10 rounded-full animate-pulse blur-3xl"></div>

      {/* Główny container zgodnie z wzorcami */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
        <motion.div
          className="max-w-sm w-full space-y-8"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Header zgodny z wzorcami typography */}
          <motion.div
            variants={itemVariants}
            className="text-center space-y-6"
          >
            {/* Logo i tytuł w układzie poziomym */}
            <div className="group">
              <div className="flex items-center justify-center space-x-4 mb-4">
                {/* Logo container zgodny z wzorcami ale zachowujący oryginalny wygląd */}
                {/* NOWY KOD - bez ramki i tła */}
                <motion.img
                  src="/logo.png"
                  alt="VODmatch Logo"
                  className="w-20 h-20 opacity-90 group-hover:opacity-100 transition-opacity duration-300"
                  whileHover={{ scale: 1.05 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                />

                <div className="flex flex-col">
                  <h1 className="text-3xl font-light bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent tracking-tight">
                    VODmatch
                  </h1>
                  <div className="text-left w-24 h-px bg-gradient-to-r from-transparent via-gray-700/40 to-transparent mb-0 mt-0"></div>
                  <p className="text-gray-400 text-xs text-left font-light tracking-wide mt-1">
                    Stream smarter. Decide faster.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Problem statement - elegancki opis semantyczny */}
          <motion.div
            variants={itemVariants}
            className="text-center space-y-3"
          >
            <div className="w-16 h-px bg-gradient-to-r from-blue-600/60 via-purple-600/60 to-transparent mx-auto"></div>

            <div className="space-y-2">
              <p className="text-gray-300 text-sm font-light leading-relaxed">
                Endless scrolling through streaming catalogs?
              </p>
              <p className="text-gray-400 text-xs font-light tracking-wide">
                We solve decision fatigue with AI-powered psychology and social preferences
              </p>
            </div>

            <div className="w-16 h-px bg-gradient-to-r from-transparent via-gray-700/40 to-transparent mx-auto"></div>
          </motion.div>

          {/* Description Card zgodna z wzorcami */}
          <motion.div
            variants={itemVariants}
            className="w-full p-4 rounded-2xl border border-gray-800/50 bg-gradient-to-br from-gray-900/40 to-gray-800/30 relative overflow-hidden"
          >
            <div className="space-y-3">
              <div className="space-y-2">
                {[
                  { title: "Easy Psychology Mood Quiz", desc: "Reveal what you actually want to feel" },
                  { title: "Social Media Analyzing", desc: "Find what truly entertains you" },
                  { title: "Multi User Sessions", desc: "QR Code Team Experience" }
                ].map((feature, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                    <div className="flex-1">
                      <p className="text-white font-light text-sm">{feature.title}</p>
                      <p className="text-gray-400 text-xs font-light leading-tight">{feature.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-gray-700/30">
                <p className="text-gray-500 text-xs font-light text-center">
                  104,000+ titles • Netflix, HBO, Prime & more
                </p>
              </div>
            </div>
          </motion.div>

          {/* PIN Input Section */}
          <motion.div
            variants={itemVariants}
            className="space-y-6"
          >
            {/* Start here indicator */}
            <div className="text-center">
              <p className="text-white font-light text-lg flex items-center justify-center space-x-2">
                <span>Start here</span>
                <span className="text-blue-400">↓</span>
              </p>
            </div>

            <div className="text-center">
              <p className="text-gray-400 font-light text-sm">
                Enter access code to continue
              </p>
            </div>

            {/* PIN Input Fields zgodne z selection card patterns */}
            <div className="flex justify-center space-x-3">
              {displayPins.map((displayPin, index) => (
                <motion.input
                  key={index}
                  ref={(el) => {
                    inputRefs.current[index] = el
                  }}
                  variants={itemVariants}
                  whileFocus={{ scale: 1.05 }}
                  whileTap={{ scale: 0.97 }}
                  type="text"
                  value={displayPin}
                  onChange={(e) => handlePinChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className="w-12 h-14 text-center text-lg font-light bg-gradient-to-br from-gray-900/40 to-gray-800/30 border border-gray-800/50 hover:border-gray-700/70 focus:border-blue-500/50 focus:bg-gradient-to-br focus:from-gray-800/80 focus:to-gray-900/80 rounded-2xl text-white transition-all duration-300 focus:outline-none focus:scale-105"
                  maxLength={1}
                  disabled={isLoading}
                />
              ))}
            </div>

            {/* Progress indicators zgodne z wzorcami */}
            <div className="flex justify-center space-x-2">
              {pins.map((pin, index) => (
                <motion.div
                  key={index}
                  className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                    pin ? 'bg-blue-500' : 'bg-gray-700'
                  }`}
                  animate={{ scale: pin ? 1.2 : 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                />
              ))}
            </div>

            {/* Error Message */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="text-center"
                >
                  <p className="text-red-400 text-sm font-light">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Loading indicator zgodny z wzorcami */}
            <AnimatePresence>
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center justify-center space-x-2"
                >
                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-gray-400 text-sm font-light">Verifying...</span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Footer zgodny z wzorcami */}
          <motion.div
            variants={itemVariants}
            className="text-center space-y-3"
          >
            <div className="w-24 h-px bg-gradient-to-r from-transparent via-gray-700/40 to-transparent mx-auto"></div>

            <div className="space-y-2">
              <p className="text-gray-500 text-xs font-light">
                AI Creative Challenge 2025 | Open Category
              </p>
              <p className="text-gray-400 text-xs font-light">
                <span className="text-white font-medium">Marcin Lisiak</span> | move37th.ai
              </p>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}