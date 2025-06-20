'use client'

import { useState, useEffect, useRef } from 'react' // Dodano useRef
import { ArrowRight, Instagram, Linkedin } from 'lucide-react'
import { SocialProfile } from '@/types/social'
import { motion, AnimatePresence } from 'framer-motion'

interface SocialProfileInputProps {
  onContinue: (profile: SocialProfile) => void
  showContent?: boolean
}

export default function SocialProfileInput({ onContinue, showContent = true }: SocialProfileInputProps) {
  const [socialLink, setSocialLink] = useState('')
  const [socialProfile, setSocialProfile] = useState<SocialProfile | null>(null)
  const [checkingProfile, setCheckingProfile] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [platformType, setPlatformType] = useState<'instagram' | 'linkedin' | null>(null)
  const [showProfile, setShowProfile] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

  // [ZMIANA] Ref do śledzenia, czy API zakończyło pracę. To pozwoli przerwać powolną animację.
  const apiCallCompleted = useRef(false);

  const detectPlatform = (url: string): 'instagram' | 'linkedin' | null => {
    if (url.includes('instagram.com') && url.includes('/')) return 'instagram'
    if (url.includes('linkedin.com/in/') && url.includes('/')) return 'linkedin'
    return null
  }

  const formatNumber = (num: number | null): string => {
    if (num === null) return 'N/A'
    if (num < 1000) return num.toString()
    if (num >= 1000000) {
      const millions = num / 1000000
      return `${millions % 1 === 0 ? millions.toFixed(0) : millions.toFixed(1)}M`
    }
    if (num >= 1000) {
      const thousands = num / 1000
      return `${thousands % 1 === 0 ? thousands.toFixed(0) : thousands.toFixed(1)}K`
    }
    return num.toLocaleString()
  }

  // [ZMIANA] Funkcja teraz sprawdza, czy API już się zakończyło. Jeśli tak, nie aktualizuje paska.
  const simulateProgress = () => {
    setLoadingProgress(0)
    const intervals = [
      { time: 500, progress: 5 }, { time: 1000, progress: 15 },
      { time: 2000, progress: 30 }, { time: 4000, progress: 50 },
      { time: 8000, progress: 70 }, { time: 12000, progress: 85 },
      { time: 15000, progress: 95 }, { time: 18000, progress: 100 }
    ]
    intervals.forEach(({ time, progress }) => {
      setTimeout(() => {
        // Aktualizuj progress tylko jeśli API wciąż pracuje
        if (!apiCallCompleted.current) {
          setLoadingProgress(progress)
        }
      }, time)
    })
  }

  const checkProfile = async (url: string, platform: 'instagram' | 'linkedin') => {
    try {
      const endpoint = platform === 'instagram' ? '/api/instagram-profile' : '/api/linkedin-profile'
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await response.json()
      if (response.ok && data.exist) {
        return {
          exist: true, profilepic_url: data.profilepic_url, username: data.username,
          platform, followers_count: data.followers_count, full_name: data.full_name,
          followers: data.followers
        }
      }
      return { exist: false }
    } catch (error) {
      console.error('Profile check error:', error)
      return { exist: false }
    }
  }

  // [ZMIANA] Główna logika sterująca. Bez sztucznych opóźnień.
  const handleProfileCheck = async (url: string) => {
    const platform = detectPlatform(url)

    if (!platform) {
      setSocialProfile(null); setShowProfile(false); setLoadingProgress(0);
      return
    }

    apiCallCompleted.current = false; // Reset flagi
    setPlatformType(platform)
    setCheckingProfile(true)
    simulateProgress() // Start powolnej animacji

    try {
      // Czekaj na prawdziwą odpowiedź z API
      const profileData = await checkProfile(url, platform)

      // API zakończyło pracę, ustawiamy flagę, aby zatrzymać powolną symulację
      apiCallCompleted.current = true;

      if (profileData.exist) {
        // Natychmiast ustaw 100%
        setLoadingProgress(100);

        // Daj 200ms na to, by użytkownik zobaczył 100%, a potem pokaż profil
        setTimeout(() => {
          setSocialProfile(profileData as SocialProfile)
          setShowProfile(true)
          setCheckingProfile(false);
        }, 200);

      } else {
        // Jeśli profil nie istnieje, resetuj od razu
        setSocialProfile(null); setShowProfile(false);
        setCheckingProfile(false);
      }
    } catch (error) {
      console.error('Profile check error:', error)
      setSocialProfile(null); setShowProfile(false);
      setCheckingProfile(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      if (socialLink) {
        handleProfileCheck(socialLink)
      } else {
        setSocialProfile(null); setShowProfile(false);
        setLoadingProgress(0); apiCallCompleted.current = false;
      }
    }, 1000)
    return () => clearTimeout(timer)
  }, [socialLink])

  const handleConfirmYes = () => {
    if (!socialProfile) return
    setIsAnimating(true)
    setTimeout(() => { onContinue(socialProfile) }, 300)
  }

  const handleConfirmNo = () => {
    setSocialLink(''); setSocialProfile(null);
    setShowProfile(false);
  }

  const viewVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
    exit: { opacity: 0, y: -20, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
  }

  const profileContainerVariants = {
    animate: { transition: { staggerChildren: 0.1 } }
  }

  const profileItemVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0, transition: { ease: [0.22, 1, 0.36, 1] } },
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-purple-900 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-950/10 via-transparent to-violet-950/20"></div>
      <div className="absolute top-1/4 right-1/4 w-px h-24 bg-gradient-to-b from-transparent via-blue-600/40 to-transparent"></div>
      <div className="absolute bottom-1/3 left-1/3 w-24 h-px bg-gradient-to-r from-transparent via-purple-600/40 to-transparent"></div>
      <div className="relative z-10 min-h-screen flex items-center justify-center p-6">

        <div className="max-w-sm w-full">

          <AnimatePresence mode="wait">
            {!socialProfile ? (
              <motion.div
                key="input-view"
                className="space-y-8"
                variants={viewVariants}
                initial="initial"
                animate="animate"
                exit="exit"
              >
                <div className={`text-center space-y-6 transition-opacity duration-700 ${showContent ? 'opacity-100' : 'opacity-0'}`}>
                  <div className="space-y-3">
                    <h1 className="text-3xl font-light bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent tracking-tight">Your Profile</h1>
                    <div className="w-16 h-px bg-gradient-to-r from-blue-600/60 via-purple-600/60 to-transparent mx-auto"></div>
                    <p className="text-gray-400 font-light text-sm leading-relaxed">Connect your social profile for personalized recommendations</p>
                  </div>
                </div>
                <div className={`space-y-6 transition-opacity duration-700 delay-200 ${showContent ? 'opacity-100' : 'opacity-0'}`}>
                  <div className="relative">
                    <input type="url" value={socialLink} onChange={(e) => setSocialLink(e.target.value)} placeholder="Instagram or LinkedIn profile URL" className={`w-full px-6 py-4 bg-gradient-to-br from-gray-900/80 to-gray-800/50 border border-gray-800 rounded-xl text-white placeholder-gray-500 backdrop-blur-sm focus:outline-none focus:border-blue-600/50 focus:from-gray-900 focus:to-gray-800/70 transition-all duration-300 ${checkingProfile ? 'text-gray-400' : 'text-white'}`} />
                    {checkingProfile && (
                      <>
                        <div className={`absolute inset-0 ${platformType === 'instagram' ? 'border-pink-300' : 'border-blue-300'} border rounded-xl transition-all duration-300 ease-out pointer-events-none`} style={{ clipPath: `inset(0 ${100 - loadingProgress}% 0 0)`, background: platformType === 'instagram' ? 'rgba(236, 72, 153, 0.1)' : 'rgba(59, 130, 246, 0.1)' }}></div>
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className={`px-3 py-1 rounded-lg text-xs font-medium backdrop-blur-sm border ${platformType === 'instagram' ? 'bg-pink-50/90 text-pink-700 border-pink-200/50' : 'bg-blue-50/90 text-blue-700 border-blue-200/50'} shadow-sm`}>{loadingProgress}%</div>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex justify-center space-x-6">
                    <div className="flex items-center space-x-2 text-gray-500"><Instagram className="w-5 h-5" /> <span className="text-sm font-light">Instagram</span></div>
                    <div className="w-px h-12 bg-gradient-to-b from-transparent via-gray-600/50 to-transparent"></div>
                    <div className="flex items-center space-x-2 text-gray-500"><Linkedin className="w-5 h-5" /> <span className="text-sm font-light">LinkedIn</span></div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="profile-view"
                className="text-center space-y-8"
                variants={profileContainerVariants}
                initial="initial"
                animate="animate"
                exit="exit"
              >
                <motion.div variants={profileItemVariants}>
                  <div className="space-y-4">
                    <h2 className="text-2xl font-light bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">Is that you?</h2>
                  </div>
                </motion.div>
                <motion.div variants={profileItemVariants}>
                  <div className={`rounded-2xl p-6 backdrop-blur-sm border ${platformType === 'instagram' ? 'bg-gradient-to-r from-pink-950/20 to-purple-950/20 border-pink-800/30' : 'bg-gradient-to-r from-blue-950/20 to-cyan-950/20 border-blue-800/30'}`}>
                    {socialProfile.platform === 'instagram' && (
                      <div className="space-y-6">
                        <div className="flex items-center justify-center space-x-6">
                          <div className="w-20 h-20 rounded-full p-0.5 bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500"><img src={socialProfile.profilepic_url!} alt="Profile" className="w-full h-full rounded-full object-cover border-2 border-white" /></div>
                          <div className="w-px h-16 bg-gradient-to-b from-transparent via-gray-600 to-transparent"></div>
                          <div className="text-center">
                            <div className="text-2xl font-medium text-pink-400">{formatNumber(socialProfile.followers_count)}</div>
                            <div className="text-sm text-gray-500">Followers</div>
                          </div>
                        </div>
                        <div className="text-center space-y-1">
                          <h3 className="text-white font-light text-xl">@{socialProfile.username}</h3>
                          <p className="text-gray-400 text-sm">Instagram Profile</p>
                        </div>
                      </div>
                    )}
                    {socialProfile.platform === 'linkedin' && (
                      <div className="space-y-6">
                        <div className="flex items-center justify-center space-x-6">
                          <div className="w-20 h-20 rounded-full p-0.5 bg-gradient-to-tr from-blue-500 to-cyan-500"><img src={socialProfile.profilepic_url!} alt="Profile" className="w-full h-full rounded-full object-cover border-2 border-white" /></div>
                          <div className="w-px h-16 bg-gradient-to-b from-transparent via-gray-600 to-transparent"></div>
                          <div className="text-center">
                            <div className="text-2xl font-medium text-blue-400">{formatNumber(socialProfile.followers)}</div>
                            <div className="text-sm text-gray-500">Followers</div>
                          </div>
                        </div>
                        <div className="text-center space-y-1">
                          <h3 className="text-white font-light text-xl">{socialProfile.full_name || `@${socialProfile.username}`}</h3>
                          <p className="text-gray-400 text-sm">LinkedIn Profile</p>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
                <motion.div variants={profileItemVariants}>
                  <p className="text-gray-400 font-light">We'll use this to personalize your movie recommendations</p>
                </motion.div>
                <motion.div variants={profileItemVariants} className="flex space-x-3">
                  <button onClick={handleConfirmNo} className="flex-1 py-3 px-6 border border-gray-700 text-gray-300 font-light rounded-xl hover:border-gray-600 hover:text-white transition-all duration-300 hover:scale-[1.02]">No</button>
                  <button onClick={handleConfirmYes} disabled={isAnimating} className="flex-1 py-3 px-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-light rounded-xl transition-all duration-300 hover:scale-[1.02] flex items-center justify-center space-x-2">
                    {isAnimating ? (<><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div><span>Loading...</span></>) : (<><span>Yes, Continue</span><ArrowRight className="w-4 h-4" /></>)}
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}