// src/components/ParticipantInsightCard.tsx - WERSJA Z GROUP INFO
'use client'

import { useState } from 'react'
import { motion, AnimatePresence, Variants } from 'framer-motion'
import { Film, Check, Sparkles, FileText, Quote, Users } from 'lucide-react'

interface ParticipantInsightCardProps {
  analysis: {
    displayName: string;
    profileType: string;
    filmPreferences: Record<string, string>;
    engagingFeedback: string;
    discussionStarters?: string[];
  };
  pic_url: string | null;
  llm_characterization: string | null;
  group_analysis?: {
    semanticDescription?: string;
  } | null;
  isGroupMode?: boolean;
}

export default function ParticipantInsightCard({
  analysis,
  pic_url,
  llm_characterization,
  group_analysis,
  isGroupMode = false
}: ParticipantInsightCardProps) {
  const [activeView, setActiveView] = useState<'insight' | 'details' | 'group'>('insight');

  if (!analysis) return null;

  // Logika parsowania bez zmian
  const feedbackLines = analysis.engagingFeedback.split('\n').filter(line => line.trim() !== '');
  const title = feedbackLines[0] || '';
  const iconDetails = feedbackLines.filter(line => ['🎬', '✨', '📊'].some(icon => line.startsWith(icon)));
  let specialConsideration = '';
  const mainDescriptionLines = [];
  for (const line of feedbackLines) {
    if (line !== title && !iconDetails.includes(line)) {
      if (line.includes('Special consideration:')) {
        specialConsideration = line.replace('Special consideration:', '').replace('💭', '').trim();
      } else {
        mainDescriptionLines.push(line);
      }
    }
  }
  const mainDescription = mainDescriptionLines.join(' ');

  const contentVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.3,
        ease: 'easeOut'
      }
    }
  };

  return (
    <motion.div
      layout
      transition={{
        layout: { duration: 0.4, ease: [0.43, 0.13, 0.23, 0.96] }
      }}
      className="border border-purple-700/30 bg-gray-900/40 backdrop-blur-sm rounded-xl p-6 space-y-6"
    >
      {/* Header */}
      <div className="flex items-center space-x-4">
        <div className="w-12 h-12 rounded-full p-0.5 bg-gradient-to-tr from-purple-500 to-pink-500 flex-shrink-0">
          {pic_url ? (
            <img src={pic_url} alt={analysis.displayName} className="w-full h-full rounded-full object-cover" />
          ) : (
            <div className="w-full h-full rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
              <span className="text-white text-lg font-medium">
                {analysis.displayName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>
        <div>
          <p className="text-white font-medium">@{analysis.displayName}</p>
          <p className="text-purple-300 text-sm">{title}</p>
        </div>
      </div>

      {/* Navigation tabs - dostosowana szerokość dla 3 opcji */}
      <div className="p-1 bg-gray-800/60 rounded-lg flex items-center space-x-1">
        <button
          onClick={() => setActiveView('insight')}
          className={`relative ${isGroupMode ? 'w-1/3' : 'w-1/2'} py-1.5 text-xs font-medium text-white transition-colors duration-300`}
        >
          {activeView === 'insight' && (
            <motion.div
              layoutId="active-pill"
              className="absolute inset-0 bg-purple-600/50 rounded-md"
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            />
          )}
          <span className="relative z-10 flex items-center justify-center">
            <Sparkles className="w-3 h-3 mr-1.5" />
            Social Insight
          </span>
        </button>

        <button
          onClick={() => setActiveView('details')}
          className={`relative ${isGroupMode ? 'w-1/3' : 'w-1/2'} py-1.5 text-xs font-medium text-white transition-colors duration-300`}
        >
          {activeView === 'details' && (
            <motion.div
              layoutId="active-pill"
              className="absolute inset-0 bg-purple-600/50 rounded-md"
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            />
          )}
          <span className="relative z-10 flex items-center justify-center">
            <FileText className="w-3 h-3 mr-1.5" />
            Quiz Analysis
          </span>
        </button>

        {/* Group Info tab - tylko dla trybu grupowego */}
        {isGroupMode && (
          <button
            onClick={() => setActiveView('group')}
            className="relative w-1/3 py-1.5 text-xs font-medium text-white transition-colors duration-300"
          >
            {activeView === 'group' && (
              <motion.div
                layoutId="active-pill"
                className="absolute inset-0 bg-purple-600/50 rounded-md"
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              />
            )}
            <span className="relative z-10 flex items-center justify-center">
              <Users className="w-3 h-3 mr-1.5" />
              Group Info
            </span>
          </button>
        )}
      </div>

      {/* Content area */}
      <motion.div layout className="relative">
        <AnimatePresence mode="wait" initial={false}>
          {activeView === 'insight' && (
            <motion.div
              key="insight"
              layout
              variants={contentVariants}
              initial="hidden"
              animate="visible"
              className="space-y-4 text-center flex flex-col justify-center items-center h-full min-h-[150px]"
            >
              <Quote className="w-8 h-8 text-purple-700/50" />
              <p className="text-gray-300 text-sm font-light leading-relaxed italic max-w-md">
                {llm_characterization || "No AI characterization available."}
              </p>
            </motion.div>
          )}

          {activeView === 'details' && (
            <motion.div
              key="details"
              layout
              variants={contentVariants}
              initial="hidden"
              animate="visible"
              className="space-y-4"
            >
              <div className="bg-purple-950/30 rounded-lg p-4">
                <p className="text-gray-300 text-sm font-light leading-relaxed text-center italic">
                  "{mainDescription}"
                </p>
              </div>

              <div className="space-y-3">
                {iconDetails.map((line, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <span className="text-xl">{line.slice(0, 2)}</span>
                    <p className="text-gray-400 text-sm pt-0.5">{line.slice(2).trim()}</p>
                  </div>
                ))}
              </div>

              {specialConsideration && (
                <div className="border border-dashed border-gray-600/70 rounded-lg p-3 flex items-start space-x-3">
                  <span className="text-xl mt-0.5">💭</span>
                  <p className="text-gray-400 text-xs">
                    <span className="font-semibold text-gray-300">Special Consideration:</span> {specialConsideration}
                  </p>
                </div>
              )}

              <div className="space-y-3 pt-2">
                <h3 className="text-sm font-semibold text-white flex items-center">
                  <Film className="w-4 h-4 mr-2 text-purple-400" />
                  Film Preferences
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  {Object.entries(analysis.filmPreferences)
                    .filter(([key]) => key !== 'idealLength')
                    .map(([key, value]) => (
                      <div key={key} className="flex items-center space-x-2">
                        <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <p className="text-gray-300">{value}</p>
                      </div>
                    ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeView === 'group' && isGroupMode && (
            <motion.div
              key="group"
              layout
              variants={contentVariants}
              initial="hidden"
              animate="visible"
              className="space-y-4"
            >
              <div className="text-center space-y-4">
                <Users className="w-8 h-8 text-blue-500/50 mx-auto" />

                <div className="bg-blue-950/30 rounded-lg p-4">
                  <p className="text-gray-300 text-sm font-light leading-relaxed">
                    {group_analysis?.semanticDescription
                      ? group_analysis.semanticDescription.split('\n').map((line, index) => (
                          <span key={index}>
                            {line}
                            {index < group_analysis.semanticDescription!.split('\n').length - 1 && <br />}
                          </span>
                        ))
                      : "No group analysis available."
                    }
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}