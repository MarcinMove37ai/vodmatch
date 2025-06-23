'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, ArrowRight, CheckCircle } from 'lucide-react'

// --- TYPY ---
interface QuizQuestion {
  id: number
  title: string
  text: string
  options: {
    letter: 'A' | 'B' | 'C' | 'D'
    text: string
  }[]
}

interface QuizAnswer {
  questionId: number
  selectedOption: 'A' | 'B' | 'C' | 'D'
  answeredAt: Date
  timeSpent: number // in seconds
}

interface QuizScreenProps {
  sessionId: string
  session: any
  isAdmin: boolean
  // Real-time props (dodane z drugiej wersji)
  realTimeConnected?: boolean
  realTimeConnectionState?: string
  realTimeEventCount?: number
  realTimeLastUpdate?: Date | null
  realTimeReconnect?: () => void
  // Callback functions
  onQuizComplete: (answers: QuizAnswer[]) => Promise<void>
  onRefreshSession: () => Promise<void>
}

// --- PYTANIA ---
const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    title: "Your Energy Right Now",
    text: "Your energy at this moment feels like:",
    options: [
      { letter: 'A', text: 'A calm lake at dawn' },
      { letter: 'B', text: 'A river meandering through the forest' },
      { letter: 'C', text: 'A stream after rain - fast but muddy' },
      { letter: 'D', text: 'A waterfall in the mountains' }
    ]
  },
  {
    id: 2,
    title: "Your Mental State",
    text: "Your mind right now is like:",
    options: [
      { letter: 'A', text: 'A library after closing - quiet and orderly' },
      { letter: 'B', text: 'A cozy café with friendly atmosphere' },
      { letter: 'C', text: 'A train station during rush hour' },
      { letter: 'D', "text": "An artist's studio in the middle of creating" }
    ]
  },
  {
    id: 3,
    title: "Your Emotional Landscape",
    text: "Your feelings today resemble:",
    options: [
        { letter: 'A', text: 'A foggy morning - everything unclear' },
        { letter: 'B', text: 'Sunshine breaking through clouds' },
        { letter: 'C', text: 'A thunderstorm - intense but changing' },
        { letter: 'D', text: 'A peaceful, cloudless sky' }
    ]
  },
  {
    id: 4,
    title: "Your Social Dynamic",
    text: "In a group right now, you feel like:",
    options: [
        { letter: 'A', text: 'A koala in a eucalyptus tree - observing from a safe place' },
        { letter: 'B', text: 'A dolphin in a pod - naturally cooperating' },
        { letter: 'C', text: 'An eagle above the mountains - with broad perspective and direction' },
        { letter: 'D', text: 'A house cat - independent, might leave when you want' }
    ]
  },
  {
    id: 5,
    title: "Your Energy Rhythm",
    text: "Your energy is flowing now like:",
    options: [
        { letter: 'A', text: 'The last drops from an hourglass' },
        { letter: 'B', text: 'Waves on a calm lake' },
        { letter: 'C', text: 'A tsunami wave - building force' },
        { letter: 'D', text: 'Lightning - explosive, instant' }
    ]
  },
  {
    id: 6,
    title: "Your Physical Tension",
    text: "Your body right now feels like:",
    options: [
        { letter: 'A', text: 'A drawn bow - ready to shoot' },
        { letter: 'B', text: 'A kitten stretching in the sun' },
        { letter: 'C', text: 'A clenched fist underwater' },
        { letter: 'D', text: 'A balloon floating in the air' }
    ]
  },
  {
    id: 7,
    title: "Your Mental Processing",
    text: "Your thoughts today are like:",
    options: [
        { letter: 'A', text: 'A puzzle waiting to be solved' },
        { letter: 'B', text: 'Background music - pleasant but not demanding attention' },
        { letter: 'C', text: 'A radio with static - need to find a clear signal' },
        { letter: 'D', text: 'A blank canvas - ready for writing' }
    ]
  },
  {
    id: 8,
    title: "Your Motivation",
    text: "The perfect experience right now would be:",
    options: [
        { letter: 'A', text: 'A warm bath with your favorite music' },
        { letter: 'B', text: 'A conversation with a close friend' },
        { letter: 'C', text: 'Climbing a challenging mountain - effort and achievement' },
        { letter: 'D', text: 'Discovering a mysterious cave' }
    ]
  },
  {
    id: 9,
    title: "Your Sense of Control",
    text: "Right now you feel like:",
    options: [
        { letter: 'A', text: 'A ship captain in a storm' },
        { letter: 'B', 'text': 'A passenger on a comfortable train' },
        { letter: 'C', text: "A driver stuck in traffic - steering but can't move" },
        { letter: 'D', text: 'A pilot in open skies' }
    ]
  },
  {
    id: 10,
    title: "Your Time Perception",
    text: "Time is flowing for you now like:",
    options: [
        { letter: 'A', text: 'Drops of resin - each second getting thicker' },
        { letter: 'B', text: 'Ocean waves - rhythmic and predictable' },
        { letter: 'C', text: 'A stopwatch before the start - each second loaded with tension' },
        { letter: 'D', text: 'A stream in the forest - flowing smoothly, unhurried' }
    ]
  }
];

export default function QuizScreen({
  sessionId,
  session,
  isAdmin,
  realTimeConnected = false,
  realTimeConnectionState = 'disconnected',
  realTimeEventCount = 0,
  realTimeLastUpdate = null,
  realTimeReconnect,
  onQuizComplete,
  onRefreshSession
}: QuizScreenProps) {
  // --- LOGIKA STANU ---
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<QuizAnswer[]>([])
  const [selectedOption, setSelectedOption] = useState<'A' | 'B' | 'C' | 'D' | null>(null)
  const [questionStartTime, setQuestionStartTime] = useState(new Date())
  const [isCompleted, setIsCompleted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Real-time status (dodane z drugiej wersji)
  const isConnected = realTimeConnected
  const connectionState = realTimeConnectionState

  const currentQuestion = QUIZ_QUESTIONS[currentQuestionIndex]
  const isLastQuestion = currentQuestionIndex === QUIZ_QUESTIONS.length - 1
  const progress = (answers.length / QUIZ_QUESTIONS.length) * 100

  useEffect(() => {
    setQuestionStartTime(new Date())
    setSelectedOption(null)
  }, [currentQuestionIndex])

  const handleAnswerSelect = useCallback((option: 'A' | 'B' | 'C' | 'D') => {
    setSelectedOption(option)
  }, [])

  const handleNext = useCallback(async () => {
    if (!selectedOption) return;
    const now = new Date();
    const timeSpent = (now.getTime() - questionStartTime.getTime()) / 1000;
    const newAnswer: QuizAnswer = {
      questionId: currentQuestion.id,
      selectedOption,
      answeredAt: now,
      timeSpent
    };
    const newAnswers = [...answers, newAnswer];
    setAnswers(newAnswers);

    if (isLastQuestion) {
      setIsCompleted(true);
      setIsSubmitting(true);
      try {
        await onQuizComplete(newAnswers);
        console.log(`✅ Quiz completed successfully`);
      } catch (error) {
        console.error('❌ Failed to submit quiz:', error);
      } finally {
        setIsSubmitting(false);
      }
    } else {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  }, [selectedOption, currentQuestion.id, questionStartTime, answers, isLastQuestion, onQuizComplete]);

  // --- EKRAN ZAKOŃCZENIA ---
  if (isCompleted) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-6 relative overflow-hidden">
         <div className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-gradient-to-br from-blue-600/20 to-purple-600/10 rounded-full animate-pulse blur-3xl"></div>
         <div className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-gradient-to-tl from-emerald-600/20 to-green-600/10 rounded-full animate-pulse blur-3xl animation-delay-4000"></div>

        <motion.div
          className="max-w-md w-full text-center space-y-8 z-10"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
        >
          <div className="space-y-4">
            <motion.div
              className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center shadow-[0_0_30px_rgba(5,150,105,0.5)]"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, repeatType: "mirror" }}
            >
              <CheckCircle className="w-12 h-12 text-white" />
            </motion.div>
            <h1 className="text-4xl font-light text-transparent bg-clip-text bg-gradient-to-r from-gray-100 to-gray-300">
              Quiz Completed!
            </h1>
            <p className="text-gray-400 font-light max-w-xs mx-auto">
              {isSubmitting ? 'Submitting your results...' : 'Waiting for others to finish. The results will appear soon!'}
            </p>
          </div>
          {isSubmitting && (
            <div className="flex items-center justify-center space-x-2">
              <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-emerald-400 text-sm">Processing...</span>
            </div>
          )}

          {/* Session info z real-time status - fixed at bottom */}
          <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-20">
            <div className="inline-flex items-center space-x-4 px-4 py-2 rounded-full bg-gray-900/40 border border-gray-700/40 backdrop-blur-sm">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full animate-pulse ${
                  isConnected ? 'bg-green-400' : 'bg-blue-400'
                }`}></div>
                <span className="text-gray-400 text-xs font-medium">Session {sessionId}</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    )
  }

  // --- GŁÓWNY EKRAN QUIZU (zachowana estetyka z pierwszej wersji) ---
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col p-4 sm:p-6 md:p-8 relative overflow-hidden">
        <div className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-gradient-to-br from-blue-600/20 to-purple-600/10 rounded-full animate-pulse blur-3xl"></div>
        <div className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-gradient-to-tl from-purple-600/20 to-pink-600/10 rounded-full animate-pulse blur-3xl animation-delay-4000"></div>

        <div className="w-full max-w-3xl mx-auto z-10 min-h-screen flex flex-col justify-center py-8 pb-20">

            {/* Header z progress bar */}
            <div className="text-center space-y-4 mb-8">
                <div className="flex items-center justify-between text-sm text-gray-400">
                    <span>Question {currentQuestionIndex + 1}/{QUIZ_QUESTIONS.length}</span>
                    <span>{answers.length}/{QUIZ_QUESTIONS.length} ANSWERED</span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-white/10 rounded-full h-1.5">
                    <motion.div
                        className="bg-gradient-to-r from-blue-500 to-purple-500 h-1.5 rounded-full"
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                </div>
            </div>

            <main className="w-full">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentQuestionIndex}
                        initial={{ opacity: 0, y: -30 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 30 }}
                        transition={{ duration: 0.8 }}
                        className="w-full text-center space-y-8"
                    >
                        <div>
                            <h1 className="text-xl md:text-2xl font-medium text-blue-300/80 mb-4">
                                Question {currentQuestion.id}: {currentQuestion.title}
                            </h1>

                            <h2 className="text-3xl md:text-4xl lg:text-5xl font-light text-transparent bg-clip-text bg-gradient-to-r from-gray-100 to-gray-400 mb-12 leading-tight">
                                {currentQuestion.text}
                            </h2>
                        </div>

                        <motion.div
                            className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4"
                        >
                            {currentQuestion.options.map((option, index) => (
                                <motion.button
                                    key={option.letter}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ duration: 0.6, delay: index * 0.08 }}
                                    onClick={() => handleAnswerSelect(option.letter)}
                                    className={`relative w-full p-5 rounded-xl border text-left transition-all duration-300 group
                                        ${selectedOption === option.letter
                                            ? 'border-blue-500/50 bg-blue-900/30'
                                            : 'border-gray-700/50 bg-gray-900/30 hover:bg-gray-800/50 hover:border-gray-600'
                                        }`}
                                    whileTap={{ scale: 0.97 }}
                                >
                                    {selectedOption === option.letter && (
                                        <motion.div
                                            layoutId="glow"
                                            className="absolute -inset-px rounded-xl bg-blue-500/20 blur-md"
                                            transition={{ type: "spring", stiffness: 400, damping: 25 }}
                                        />
                                    )}

                                    <div className="relative flex items-center space-x-4">
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-mono text-lg transition-all duration-300
                                            ${selectedOption === option.letter
                                                ? 'bg-blue-500 text-white'
                                                : 'bg-gray-800 text-gray-400 group-hover:bg-gray-700 group-hover:text-gray-300'
                                        }`}>
                                            {option.letter}
                                        </div>
                                        <p className="flex-1 text-base md:text-lg text-gray-300 group-hover:text-white transition-colors duration-200">
                                            {option.text}
                                        </p>
                                        <AnimatePresence>
                                        {selectedOption === option.letter && (
                                            <motion.div
                                                initial={{ scale: 0, opacity: 0 }}
                                                animate={{ scale: 1, opacity: 1, transition: { type: "spring", stiffness: 400, damping: 25 } }}
                                                exit={{ scale: 0, opacity: 0 }}
                                            >
                                                <Check className="w-6 h-6 text-blue-400" />
                                            </motion.div>
                                        )}
                                        </AnimatePresence>
                                    </div>
                                </motion.button>
                            ))}
                        </motion.div>

                        {/* Przycisk Next bezpośrednio po opcjach */}
                        <div className="pt-8 h-20 flex items-center justify-center">
                            <AnimatePresence>
                            {selectedOption && (
                                <motion.div
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    transition={{ duration: 0.5 }}
                                    className="w-full max-w-sm"
                                >
                                    <motion.button
                                        onClick={handleNext}
                                        className="w-full py-4 px-6 font-medium text-lg rounded-xl transition-all duration-300 flex items-center justify-center space-x-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white shadow-[0_0_20px_rgba(80,70,229,0.4)] hover:shadow-[0_0_30px_rgba(80,70,229,0.6)]"
                                        whileTap={{ scale: 0.98 }}
                                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                                    >
                                        <span>{isLastQuestion ? 'Complete Quiz' : 'Next Question'}</span>
                                        <ArrowRight className="w-5 h-5" />
                                    </motion.button>
                                </motion.div>
                            )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                </AnimatePresence>
            </main>

            {/* Real-time connection status - fixed at bottom */}
            <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-20">
                <div className="inline-flex items-center space-x-4 px-4 py-2 rounded-full bg-gray-900/40 border border-gray-700/40 backdrop-blur-sm">
                    <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full animate-pulse ${
                            isConnected ? 'bg-green-400' : 'bg-blue-400'
                        }`}></div>
                        <span className="text-gray-400 text-xs font-medium">Session {sessionId}</span>
                    </div>
                    <div className="w-px h-4 bg-gray-600/50"></div>
                    <span className="text-gray-500 text-xs font-light">
                        {isAdmin ? 'Host' : 'Participant'}
                    </span>
                </div>
            </div>
        </div>
    </div>
  )
}