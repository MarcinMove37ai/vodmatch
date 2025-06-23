'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, ArrowRight, Timer } from 'lucide-react'

// Typy dla quizu
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
  timeSpent: number // czas w sekundach
}

interface QuizScreenProps {
  sessionId: string
  session: any // Real-time session data
  isAdmin: boolean
  // Real-time props (analogiczne do innych komponentów)
  realTimeConnected?: boolean
  realTimeConnectionState?: string
  realTimeEventCount?: number
  realTimeLastUpdate?: Date | null
  realTimeReconnect?: () => void
  // Callback functions
  onQuizComplete: (answers: QuizAnswer[]) => Promise<void>
  onRefreshSession: () => Promise<void>
}

// Pytania quizu
const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    title: "Energia Bazowa",
    text: "Twoja energia w tym momencie przypomina:",
    options: [
      { letter: 'A', text: 'Spokojne jezioro o świcie' },
      { letter: 'B', text: 'Rzeka meandrująca przez las' },
      { letter: 'C', text: 'Strumień po deszczu - szybki ale mętny' },
      { letter: 'D', text: 'Wodospad w górach' }
    ]
  },
  {
    id: 2,
    title: "Stan Kognitywny",
    text: "Twój umysł teraz to:",
    options: [
      { letter: 'A', text: 'Biblioteka po zamknięciu - cisza i porządek' },
      { letter: 'B', text: 'Kawiarnia w przyjaznej atmosferze' },
      { letter: 'C', text: 'Dworzec kolejowy w godzinach szczytu' },
      { letter: 'D', text: 'Pracownia artysty w trakcie tworzenia' }
    ]
  },
  {
    id: 3,
    title: "Krajobraz Emocjonalny",
    text: "Twoje uczucia dziś przypominają:",
    options: [
      { letter: 'A', text: 'Mglisty poranek - wszystko niewyraźne' },
      { letter: 'B', text: 'Słońce przebijające przez chmury' },
      { letter: 'C', text: 'Burza z piorunami - intensywna ale przemienna' },
      { letter: 'D', text: 'Spokojne, bezchmurne niebo' }
    ]
  },
  {
    id: 4,
    title: "Dynamika Społeczna",
    text: "W grupie teraz czujesz się jak:",
    options: [
      { letter: 'A', text: 'Koala na eukaliptusie - obserwujesz z bezpiecznego miejsca' },
      { letter: 'B', text: 'Delfin w stadzie - współpracujesz naturalnie' },
      { letter: 'C', text: 'Orzeł nad górami - masz szeroki widok i kierunek' },
      { letter: 'D', text: 'Kot domowy - niezależny, może odejść gdy zechce' }
    ]
  },
  {
    id: 5,
    title: "Rytm Energetyczny",
    text: "Twoja energia płynie teraz jak:",
    options: [
      { letter: 'A', text: 'Ostatnie krople z klepsydry' },
      { letter: 'B', text: 'Fale na spokojnym jeziorze' },
      { letter: 'C', text: 'Fala tsunami - narastająca siła' },
      { letter: 'D', text: 'Błyskawica - wybuchowa, natychmiastowa' }
    ]
  },
  {
    id: 6,
    title: "Napięcie Somatyczne",
    text: "Twoje ciało teraz przypomina:",
    options: [
      { letter: 'A', text: 'Naciągnięty łuk - gotowy do strzału' },
      { letter: 'B', text: 'Kotka przeciągająca się w słońcu' },
      { letter: 'C', text: 'Zaciśnięta pięść pod wodą' },
      { letter: 'D', text: 'Balon unoszący się w powietrzu' }
    ]
  },
  {
    id: 7,
    title: "Przetwarzanie Mentalne",
    text: "Twoje myśli dziś to:",
    options: [
      { letter: 'A', text: 'Puzzle czekające na ułożenie' },
      { letter: 'B', text: 'Muzyka w tle - przyjemna ale nie dominująca' },
      { letter: 'C', text: 'Radio z zakłóceniami - trzeba znaleźć czysty sygnał' },
      { letter: 'D', text: 'Biała kartka - gotowa na napis' }
    ]
  },
  {
    id: 8,
    title: "Motywacja",
    text: "Idealne doświadczenie teraz to:",
    options: [
      { letter: 'A', text: 'Ciepła kąpiel w wannie z ulubioną muzyką' },
      { letter: 'B', text: 'Rozmowa z bliskim przyjacielem' },
      { letter: 'C', text: 'Zdobycie trudnej góry - wysiłek i osiągnięcie' },
      { letter: 'D', text: 'Odkrycie tajemniczej jaskini' }
    ]
  },
  {
    id: 9,
    title: "Kontrola i Agency",
    text: "W tej chwili czujesz się jak:",
    options: [
      { letter: 'A', text: 'Kapitan statku w sztormie' },
      { letter: 'B', text: 'Pasażer w komfortowym pociągu' },
      { letter: 'C', text: 'Kierowca w korku - steruje ale nie może jechać' },
      { letter: 'D', text: 'Pilot na otwartym niebie' }
    ]
  },
  {
    id: 10,
    title: "Percepcja Temporalna",
    text: "Czas teraz płynie dla ciebie jak:",
    options: [
      { letter: 'A', text: 'Krople żywicy - każda sekunda gęstnieje' },
      { letter: 'B', text: 'Fale oceanu - rytmicznie i przewidywalnie' },
      { letter: 'C', text: 'Stoper przed startem - każda sekunda naładowana' },
      { letter: 'D', text: 'Strumień w lesie - płynnie, bez pośpiechu' }
    ]
  }
]

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

  // Stan quizu
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<QuizAnswer[]>([])
  const [selectedOption, setSelectedOption] = useState<'A' | 'B' | 'C' | 'D' | null>(null)
  const [questionStartTime, setQuestionStartTime] = useState<Date>(new Date())
  const [totalStartTime] = useState<Date>(new Date())
  const [isCompleted, setIsCompleted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Real-time status
  const isConnected = realTimeConnected
  const connectionState = realTimeConnectionState

  const currentQuestion = QUIZ_QUESTIONS[currentQuestionIndex]
  const isLastQuestion = currentQuestionIndex === QUIZ_QUESTIONS.length - 1
  const progress = ((currentQuestionIndex + 1) / QUIZ_QUESTIONS.length) * 100

  // Reset question timer when moving to next question
  useEffect(() => {
    setQuestionStartTime(new Date())
    setSelectedOption(null)
  }, [currentQuestionIndex])

  // Handle answer selection
  const handleAnswerSelect = useCallback((option: 'A' | 'B' | 'C' | 'D') => {
    setSelectedOption(option)
  }, [])

  // Handle moving to next question or completing quiz
  const handleNext = useCallback(async () => {
    if (!selectedOption) return

    const now = new Date()
    const timeSpent = (now.getTime() - questionStartTime.getTime()) / 1000

    // Save answer
    const newAnswer: QuizAnswer = {
      questionId: currentQuestion.id,
      selectedOption,
      answeredAt: now,
      timeSpent
    }

    const newAnswers = [...answers, newAnswer]
    setAnswers(newAnswers)

    if (isLastQuestion) {
      // Complete quiz
      setIsCompleted(true)
      setIsSubmitting(true)

      try {
        await onQuizComplete(newAnswers)
        console.log(`✅ Quiz completed successfully`)
      } catch (error) {
        console.error('❌ Failed to submit quiz:', error)
        // TODO: Handle error state
      } finally {
        setIsSubmitting(false)
      }
    } else {
      // Move to next question
      setCurrentQuestionIndex(prev => prev + 1)
    }
  }, [selectedOption, currentQuestion.id, questionStartTime, answers, isLastQuestion, onQuizComplete])

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
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

  const optionVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: {
      opacity: 1,
      x: 0,
      transition: {
        duration: 0.4,
      },
    },
  }

  if (isCompleted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-purple-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-950/10 via-transparent to-violet-950/20"></div>

        <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
          <motion.div
            className="max-w-md w-full text-center space-y-8"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
          >
            <div className="space-y-4">
              <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-white" />
              </div>

              <h1 className="text-3xl font-light bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent tracking-tight">
                Quiz Completed!
              </h1>

              <div className="w-16 h-px bg-gradient-to-r from-green-600/60 via-emerald-600/60 to-transparent mx-auto"></div>

              <p className="text-gray-400 font-light">
                {isSubmitting ? 'Submitting your answers...' : 'Waiting for other participants to finish'}
              </p>
            </div>

            {isSubmitting && (
              <div className="flex items-center justify-center space-x-2">
                <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-green-400 text-sm">Processing...</span>
              </div>
            )}

            {/* Session info */}
            <div className="inline-flex items-center space-x-4 px-4 py-2 rounded-full bg-gray-900/40 border border-gray-700/40 backdrop-blur-sm">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full animate-pulse ${
                  isConnected ? 'bg-green-400' : 'bg-blue-400'
                }`}></div>
                <span className="text-gray-400 text-xs font-medium">Session {sessionId}</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-purple-900 relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-950/10 via-transparent to-violet-950/20"></div>
      <div className="absolute top-1/4 right-1/4 w-px h-24 bg-gradient-to-b from-transparent via-blue-600/40 to-transparent"></div>
      <div className="absolute bottom-1/3 left-1/3 w-24 h-px bg-gradient-to-r from-transparent via-purple-600/40 to-transparent"></div>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
        <motion.div
          className="max-w-lg w-full space-y-8"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Header with progress */}
          <motion.div variants={itemVariants} className="text-center space-y-4">
            <div className="flex items-center justify-between text-sm text-gray-400">
              <span>Question {currentQuestionIndex + 1}/{QUIZ_QUESTIONS.length}</span>
              <div className="flex items-center space-x-2">
                <Timer className="w-4 h-4" />
                <span>Quiz in progress</span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-gray-800 rounded-full h-2">
              <motion.div
                className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </motion.div>

          {/* Question */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestionIndex}
              className="space-y-6"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.5 }}
            >
              {/* Question text */}
              <div className="text-center space-y-3">
                <h2 className="text-2xl font-light text-white">
                  {currentQuestion.title}
                </h2>
                <p className="text-gray-300 italic text-lg leading-relaxed">
                  {currentQuestion.text}
                </p>
              </div>

              {/* Options */}
              <div className="space-y-3">
                {currentQuestion.options.map((option, index) => (
                  <motion.button
                    key={option.letter}
                    variants={optionVariants}
                    initial="hidden"
                    animate="visible"
                    transition={{ delay: index * 0.1 }}
                    onClick={() => handleAnswerSelect(option.letter)}
                    className={`w-full p-4 rounded-xl border transition-all duration-300 text-left group ${
                      selectedOption === option.letter
                        ? 'border-blue-500/50 bg-gradient-to-r from-blue-900/40 to-blue-800/30 scale-[1.02]'
                        : 'border-gray-700/50 bg-gradient-to-r from-gray-900/40 to-gray-800/30 hover:border-gray-600/70 hover:from-gray-900/60 hover:to-gray-800/50 hover:scale-[1.01]'
                    }`}
                  >
                    <div className="flex items-center space-x-4">
                      <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center font-medium transition-all duration-300 ${
                        selectedOption === option.letter
                          ? 'border-blue-400 bg-blue-500 text-white'
                          : 'border-gray-600 text-gray-400 group-hover:border-gray-400'
                      }`}>
                        {option.letter}
                      </div>
                      <p className="flex-1 text-gray-300 group-hover:text-white transition-colors duration-300">
                        {option.text}
                      </p>
                      {selectedOption === option.letter && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-5 h-5"
                        >
                          <CheckCircle className="w-5 h-5 text-blue-400" />
                        </motion.div>
                      )}
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Continue button */}
          <motion.div variants={itemVariants}>
            <button
              onClick={handleNext}
              disabled={!selectedOption}
              className={`w-full py-4 px-6 font-light rounded-xl transition-all duration-300 flex items-center justify-center space-x-3 ${
                selectedOption
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border border-blue-600/20 hover:border-blue-500/40 hover:scale-[1.02]'
                  : 'bg-gradient-to-r from-gray-700 to-gray-600 text-gray-400 border border-gray-600/20 cursor-not-allowed opacity-50'
              }`}
            >
              <span>{isLastQuestion ? 'Complete Quiz' : 'Next Question'}</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </motion.div>

          {/* Session info */}
          <motion.div variants={itemVariants} className="text-center">
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
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}