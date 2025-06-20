'use client'

import { useState, useEffect } from 'react'
import { Smartphone, ArrowDown } from 'lucide-react'

export default function DesktopBlocker() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-purple-900 relative overflow-hidden">
      {/* Enhanced gradient accents */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-950/10 via-transparent to-violet-950/20"></div>

      {/* Minimal geometric accents with gradient */}
      <div className="absolute top-1/4 right-1/4 w-px h-32 bg-gradient-to-b from-transparent via-blue-600/50 to-transparent opacity-40"></div>
      <div className="absolute bottom-1/3 left-1/3 w-32 h-px bg-gradient-to-r from-transparent via-purple-600/50 to-transparent opacity-40"></div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-8 text-center">

        {/* Clean icon with gradient accent */}
        <div className="mb-12 group">
          <div className="relative p-6 rounded-2xl border border-gray-800 bg-gradient-to-br from-gray-900/80 to-gray-800/50 backdrop-blur-sm group-hover:border-gray-700 group-hover:from-gray-900 group-hover:to-gray-800/70 transition-all duration-500">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-purple-600/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <Smartphone className="relative w-12 h-12 text-gray-300 group-hover:text-white transition-colors duration-300" />
          </div>
        </div>

        {/* Premium typography with gradient accent */}
        <div className="space-y-8 max-w-lg">
          <div className="space-y-4">
            <h1 className="text-5xl font-light bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent tracking-tight">
              VodMatch
            </h1>
            <div className="w-12 h-px bg-gradient-to-r from-blue-600/60 via-purple-600/60 to-transparent mx-auto"></div>
          </div>

          <p className="text-xl text-gray-300 font-light leading-relaxed">
            Designed for mobile
          </p>

          <p className="text-gray-500 leading-relaxed max-w-md">
            This experience is optimized exclusively for mobile devices.
            Please access from your smartphone for the full experience.
          </p>
        </div>

        {/* Subtle call-to-action with gradient */}
        <div className="mt-16 space-y-8">
          <div className="flex items-center justify-center space-x-4 text-gray-500">
            <div className="w-8 h-px bg-gradient-to-r from-transparent to-gray-700"></div>
            <ArrowDown className="w-4 h-4 animate-pulse" />
            <div className="w-8 h-px bg-gradient-to-r from-gray-700 to-transparent"></div>
          </div>

          {/* QR with gradient border */}
          <div className="inline-block p-4 border border-gray-800 rounded-xl bg-gradient-to-br from-gray-900/40 to-gray-800/30 hover:from-gray-900/60 hover:to-gray-800/50 backdrop-blur-sm transition-all duration-300">
            <div className="w-24 h-24 border border-gray-700 rounded-lg flex items-center justify-center bg-gradient-to-br from-gray-800/60 to-gray-900/60">
              <div className="grid grid-cols-3 gap-1">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="w-1.5 h-1.5 bg-gray-600 rounded-sm"></div>
                ))}
              </div>
            </div>
            <p className="text-gray-500 text-xs mt-3 font-light">Access on mobile</p>
          </div>
        </div>

        {/* Footer with gradient */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
          <p className="text-gray-700 text-xs tracking-wider bg-gradient-to-r from-gray-700 to-gray-600 bg-clip-text">MOBILE OPTIMIZED</p>
        </div>
      </div>
    </div>
  )
}