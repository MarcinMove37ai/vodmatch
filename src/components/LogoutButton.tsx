'use client'

import { LogOut } from 'lucide-react'

interface LogoutButtonProps {
  onLogout: () => void
}

export default function LogoutButton({ onLogout }: LogoutButtonProps) {
  return (
    <button
      onClick={onLogout}
      className="fixed top-4 left-4 z-50 p-3 bg-gradient-to-br from-gray-900/80 to-gray-800/60 border border-gray-700/50 rounded-xl backdrop-blur-sm hover:from-gray-800/90 hover:to-gray-700/70 hover:border-gray-600/70 transition-all duration-300 group"
      title="Logout"
    >
      <LogOut className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors duration-300" />
    </button>
  )
}