'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Lock } from 'lucide-react'

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

  return (
    <div className="min-h-screen bg-gray-900 text-white relative overflow-hidden">
      {/* Background gradients matching other components */}
      <div className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-gradient-to-br from-blue-600/20 to-purple-600/10 rounded-full blur-3xl"></div>
      <div className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-gradient-to-tl from-purple-600/20 to-pink-600/10 rounded-full blur-3xl animation-delay-4000"></div>

      {/* Geometric accents matching PlatformSelector */}
      <div className="absolute top-1/4 right-1/4 w-px h-24 bg-gradient-to-b from-transparent via-blue-600/40 to-transparent"></div>
      <div className="absolute bottom-1/3 left-1/3 w-24 h-px bg-gradient-to-r from-transparent via-purple-600/40 to-transparent"></div>

      <div className="relative z-10 flex items-center justify-center min-h-screen p-4 sm:p-6 py-8 sm:py-12">
        <motion.div
          className="max-w-md w-full space-y-8 sm:space-y-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            staggerChildren: 0.1,
            delayChildren: 0.2,
          }}
        >
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center space-y-6 sm:space-y-8"
          >
            <div className="group">
              {/* Logo and title in horizontal layout */}
              <div className="flex items-center justify-center space-x-4 mb-4">
                {/* Logo container with enhanced gradients */}
                <motion.div
                  className="p-0.5 rounded-2xl bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 group-hover:from-blue-400 group-hover:via-purple-400 group-hover:to-pink-400 transition-all duration-500"
                  whileHover={{ scale: 1.05 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                >
                  <div className="relative p-1.5 rounded-[15px] bg-gradient-to-br from-gray-900/95 to-gray-800/95 backdrop-blur-sm">
                    <img
                      src="/logo.png"
                      alt="VODmatch Logo"
                      className="w-16 h-16 opacity-90 group-hover:opacity-100 transition-opacity duration-300 filter brightness-0 invert group-hover:brightness-100 group-hover:invert-0"
                    />
                  </div>
                </motion.div>

                <div className="flex flex-col">
                  <h1 className="text-4xl font-light bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent tracking-tight">
                    VODmatch
                  </h1>
                  <div className="text-left w-24 h-px bg-gradient-to-r from-transparent via-gray-700/40 to-transparent mb-1 mt-3 sm:mb-6"></div>
                  <p className="text-gray-400 text-xs text-left font-light tracking-wide mt-1">
                    Stream smarter. Decide faster.
                  </p>
                </div>
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="space-y-6 sm:space-y-8"
            >
              {/* Floating geometric elements */}
              <div className="relative">
                <div className="absolute -top-8 left-1/4 w-1 h-12 bg-gradient-to-b from-blue-500/30 via-transparent to-transparent"></div>
                <div className="absolute -top-6 right-1/3 w-8 h-px bg-gradient-to-r from-transparent via-purple-500/40 to-transparent"></div>

                <div className="w-24 h-px bg-gradient-to-r from-transparent via-blue-600/60 via-purple-600/60 to-transparent mx-auto"></div>
              </div>

              {/* Spectacular Description Card */}
              <div className="max-w-lg mx-auto">
                <motion.div
                  className="relative group"
                  whileHover={{ scale: 1.03, rotateX: 2 }}
                  transition={{ type: "spring", stiffness: 200, damping: 20 }}
                >
                  {/* Animated border gradient */}
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-3xl opacity-5 group-hover:opacity-10 transition-opacity duration-700"></div>

                  {/* Outer glow layers - maximum transparency */}
                  <div className="absolute -inset-8 bg-gradient-to-r from-blue-500/2 via-purple-500/2 to-pink-500/2 rounded-[2rem] blur-2xl group-hover:from-blue-500/5 group-hover:via-purple-500/5 group-hover:to-pink-500/5 transition-all duration-1000"></div>
                  <div className="absolute -inset-12 bg-gradient-to-br from-cyan-500/1 via-violet-500/1 to-fuchsia-500/1 rounded-[2.5rem] blur-3xl group-hover:blur-2xl transition-all duration-1000"></div>

                  {/* Main container - maximum transparency */}
                  <div className="relative bg-transparent rounded-3xl border border-gray-700/5 backdrop-blur-none shadow-none overflow-hidden">

                    {/* Inner glass reflection - maximum transparency */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.001] via-blue-400/[0.001] to-purple-400/[0.001] rounded-3xl"></div>

                    {/* Top accent line - maximum transparency */}
                    <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-32 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent"></div>

                    {/* Content */}
                    <div className="relative p-4 sm:p-6 space-y-3">

                      {/* Hero section */}
                      <div className="text-center space-y-1">
                        <motion.h2
                          className="text-lg sm:text-xl font-light text-transparent bg-clip-text bg-gradient-to-r from-gray-100 via-blue-200 to-purple-200 leading-tight"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.5, duration: 0.8 }}
                        >
                        </motion.h2>
                      </div>

                      {/* Feature cards grid */}
                      <div className="space-y-5">
                        {[
                      {
                          title: "Easy Psychology Quiz",
                          description: "Reveal what you actually want to feel",
                          color: "from-blue-500/5 to-cyan-500/8",
                          border: "border-blue-500/8",
                          glow: "blue-500"
                        },
                        {
                          title: "Social Media Analyzing",
                          description: "Find what truly entertains you",
                          color: "from-purple-500/5 to-violet-500/8",
                          border: "border-purple-500/8",
                          glow: "purple-500"
                        },
                        {
                          title: "Exciting Multi Users Sessions",
                          description: "QR Code Team Experience",
                          color: "from-pink-500/5 to-rose-500/8",
                          border: "border-pink-500/8",
                          glow: "pink-500"
                        }
                        ].map((feature, index) => (
                          <motion.div
                            key={feature.title}
                            className="group/feature relative"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.9 + index * 0.1, duration: 0.6 }}
                            whileHover={{ x: 6, scale: 1.02 }}
                          >
                            {/* Feature card - reduced background opacity */}
                            <div className={`relative p-2.5 rounded-2xl bg-gradient-to-r ${feature.color} border ${feature.border} backdrop-blur-none transition-all duration-300 group-hover/feature:shadow-lg`}>

                              {/* Hover glow - maximum transparency */}
                              <div className={`absolute -inset-0.5 bg-gradient-to-r ${feature.color} rounded-2xl opacity-0 group-hover/feature:opacity-15 transition-opacity duration-300 blur-sm`}></div>

                              {/* Content */}
                              <div className="relative flex items-center">
                                <div className="flex-1 min-w-0">
                                  <h3 className="text-gray-200 font-light text-xs group-hover/feature:text-white transition-colors duration-300">
                                    {feature.title}
                                  </h3>
                                  <p className="text-gray-400 text-xs font-light mt-0.5 group-hover/feature:text-gray-300 transition-colors duration-300">
                                    {feature.description}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>

                      {/* Bottom stats section */}
                      <motion.div
                        className="text-center pt-0.5 space-y-0.5"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 1.3, duration: 0.8 }}
                      >
                        <div className="flex items-center justify-center space-x-3 text-xs">
                          <div className="flex items-center space-x-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                            <span className="text-gray-400 font-light">104,000+ titles</span>
                          </div>
                          <div className="w-px h-3 bg-gray-600"></div>
                          <div className="flex items-center space-x-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-400"></div>
                            <span className="text-gray-400 font-light">Netflix, HBO, Prime & more</span>
                          </div>
                        </div>
                      </motion.div>
                    </div>

                    {/* Bottom accent line - maximum transparency */}
                    <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-24 h-px bg-gradient-to-r from-transparent via-white/3 to-transparent"></div>
                  </div>

                  {/* Floating corner elements - maximum transparency */}
                  <div className="absolute -top-2 -left-2 w-4 h-4 border-l border-t border-blue-500/8 rounded-tl-lg"></div>
                  <div className="absolute -bottom-2 -right-2 w-4 h-4 border-r border-b border-purple-500/8 rounded-br-lg"></div>
                </motion.div>
              </div>

              {/* Bottom floating elements */}
              <div className="relative">
                <div className="absolute -bottom-4 left-1/3 w-px h-8 bg-gradient-to-b from-purple-500/20 via-transparent to-transparent"></div>
                <div className="absolute -bottom-2 right-1/4 w-6 h-px bg-gradient-to-r from-transparent via-pink-500/30 to-transparent"></div>
              </div>
            </motion.div>
          </motion.div>

          {/* PIN Input Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="space-y-6 sm:space-y-8"
          >
            {/* Instruction */}
            <div className="text-center">
              <p className="text-gray-400 font-light text-sm">
                Enter access code to continue
              </p>
            </div>

            {/* PIN Input Fields */}
            <motion.div
              className="flex justify-center space-x-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ staggerChildren: 0.1, delayChildren: 0.6 }}
            >
              {displayPins.map((displayPin, index) => (
                <motion.input
                  key={index}
                  ref={(el) => {
                    inputRefs.current[index] = el
                  }}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6 }}
                  whileFocus={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  type="text"
                  value={displayPin}
                  onChange={(e) => handlePinChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className="w-14 h-16 text-center text-xl font-medium bg-gray-800/50 border border-gray-600/40 rounded-xl text-gray-100 backdrop-blur-sm focus:outline-none focus:border-blue-500/60 focus:bg-gray-700/60 focus:ring-1 focus:ring-blue-500/30 transition-all duration-300 shadow-lg hover:border-gray-500/60"
                  style={{
                    lineHeight: '1',
                    paddingTop: '0',
                    paddingBottom: '0'
                  }}
                  maxLength={1}
                  disabled={isLoading}
                />
              ))}
            </motion.div>

            {/* Error Message */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="text-red-400 text-sm text-center font-light"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Progress indicator */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="flex justify-center space-x-2 pt-2"
            >
              {pins.map((pin, index) => (
                <motion.div
                  key={index}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    pin
                      ? 'bg-blue-500 scale-125'
                      : 'bg-gray-700'
                  }`}
                  animate={{ scale: pin ? 1.25 : 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                />
              ))}
            </motion.div>

            {/* Loading indicator */}
            <AnimatePresence>
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center justify-center space-x-2 text-gray-400"
                >
                  <div className="w-4 h-4 border-2 border-gray-600 border-t-blue-500 rounded-full animate-spin"></div>
                  <span className="text-sm font-light">Verifying...</span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Footer */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="text-center space-y-3 pt-6 sm:pt-12"
          >
            <div className="space-y-3">
              <p className="text-gray-400 text-xs font-light">
                AI Creative Challenge 2025 | Open Category
              </p>

              <div className="w-16 h-px bg-gradient-to-r from-transparent via-gray-600/30 to-transparent mx-auto"></div>

              <p className="text-gray-500 text-xs">
                <span className="text-gray-200 font-medium">Marcin Lisiak | move37th.ai</span>
              </p>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}