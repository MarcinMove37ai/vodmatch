'use client'

import { useState, useRef, useEffect } from 'react'
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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-purple-900 relative overflow-hidden">
      {/* Enhanced gradient accents */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-950/10 via-transparent to-violet-950/20"></div>

      {/* Geometric accents */}
      <div className="absolute top-1/4 left-1/4 w-px h-24 bg-gradient-to-b from-transparent via-blue-600/40 to-transparent"></div>
      <div className="absolute bottom-1/3 right-1/3 w-24 h-px bg-gradient-to-r from-transparent via-purple-600/40 to-transparent"></div>

      <div className="relative z-10 flex items-center justify-center min-h-screen p-4">
        <div className="max-w-md w-full space-y-8">

          {/* Header with premium styling */}
          <div className="text-center space-y-6">
            <div className="group">
              <div className="relative p-6 rounded-2xl border border-gray-800 bg-gradient-to-br from-gray-900/80 to-gray-800/50 backdrop-blur-sm group-hover:border-gray-700 transition-all duration-500 inline-block">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-purple-600/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <Lock className="relative w-8 h-8 text-gray-300 group-hover:text-white transition-colors duration-300" />
              </div>
            </div>

            <div className="space-y-3">
              <h1 className="text-4xl font-light bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent tracking-tight">
                VodMatch
              </h1>
              <div className="w-12 h-px bg-gradient-to-r from-blue-600/60 via-purple-600/60 to-transparent mx-auto"></div>
              <p className="text-gray-400 font-light">
                Enter access code
              </p>
            </div>
          </div>

          {/* PIN Input with premium styling */}
          <div className="space-y-6">
            <div className="flex justify-center space-x-3">
              {displayPins.map((displayPin, index) => (
                <input
                  key={index}
                  ref={(el) => (inputRefs.current[index] = el)}
                  type="text"
                  value={displayPin}
                  onChange={(e) => handlePinChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className="w-14 h-16 text-center text-xl font-medium bg-gradient-to-br from-gray-900/80 to-gray-800/50 border border-gray-800 rounded-xl text-white backdrop-blur-sm focus:outline-none focus:border-blue-600/50 focus:from-gray-900 focus:to-gray-800/70 transition-all duration-300 focus:scale-105 flex items-center justify-center"
                  style={{
                    lineHeight: '1',
                    paddingTop: '0',
                    paddingBottom: '0'
                  }}
                  maxLength={1}
                  disabled={isLoading}
                />
              ))}
            </div>

            {error && (
              <div className="text-red-400 text-sm text-center font-light animate-in slide-in-from-top duration-300">
                {error}
              </div>
            )}

            {/* Progress indicator */}
            <div className="flex justify-center space-x-2">
              {pins.map((pin, index) => (
                <div
                  key={index}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    pin
                      ? 'bg-blue-500 scale-125'
                      : 'bg-gray-700'
                  }`}
                />
              ))}
            </div>

            {isLoading && (
              <div className="flex items-center justify-center space-x-2 text-gray-400">
                <div className="w-4 h-4 border-2 border-gray-600 border-t-blue-500 rounded-full animate-spin"></div>
                <span className="text-sm font-light">Verifying...</span>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="text-center space-y-2">
            <p className="text-gray-500 text-xs font-light">
              {pins.join('').length}/5 characters
            </p>
            <p className="text-gray-600 text-xs font-light">
              Press ESC to clear all
            </p>
          </div>

          {/* Quick clear button */}
          <div className="flex justify-center">
            <button
              onClick={clearAllFields}
              className="px-4 py-2 text-gray-500 hover:text-gray-300 text-sm font-light transition-colors duration-300 hover:bg-gray-800/30 rounded-lg"
            >
              Clear all
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}