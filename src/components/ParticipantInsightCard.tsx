// src/components/ParticipantInsightCard.tsx - WERSJA FINALNA Z IKONĄ MYŚLI
'use client'

import { motion } from 'framer-motion'
import { Film, Check } from 'lucide-react'

interface ParticipantInsightCardProps {
  analysis: {
    displayName: string;
    profileType: string;
    filmPreferences: Record<string, string>;
    engagingFeedback: string;
    discussionStarters?: string[];
  };
  pic_url: string | null;
}

export default function ParticipantInsightCard({ analysis, pic_url }: ParticipantInsightCardProps) {
  if (!analysis) return null;

  const feedbackLines = analysis.engagingFeedback.split('\n').filter(line => line.trim() !== '');

  const title = feedbackLines[0] || '';
  const iconDetails = feedbackLines.filter(line => ['🎬', '✨', '📊'].some(icon => line.startsWith(icon)));

  let specialConsideration = '';
  const mainDescriptionLines = [];

  for (const line of feedbackLines) {
    if (line !== title && !iconDetails.includes(line)) {
      if (line.includes('Special consideration:')) {
        // ZMIANA 2: Usuwamy emoji z treści, jeśli istnieje
        specialConsideration = line.replace('Special consideration:', '').replace('💭', '').trim();
      } else {
        mainDescriptionLines.push(line);
      }
    }
  }
  const mainDescription = mainDescriptionLines.join(' ');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="border border-purple-700/30 bg-gray-900/40 backdrop-blur-sm rounded-xl p-6 space-y-6"
    >
      <div className="flex items-center space-x-4">
        <div className="w-12 h-12 rounded-full p-0.5 bg-gradient-to-tr from-purple-500 to-pink-500 flex-shrink-0">
          {pic_url ? (
            <img src={pic_url} alt="Participant" className="w-full h-full rounded-full object-cover"/>
          ) : (
            <div className="w-full h-full rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
              <span className="text-white text-lg font-medium">{analysis.displayName.charAt(0).toUpperCase()}</span>
            </div>
          )}
        </div>
        <div className="flex-1">
          <p className="text-white font-medium">@{analysis.displayName}</p>
          <p className="text-purple-300 text-sm">{title}</p>
        </div>
      </div>

      <div className="bg-purple-950/30 rounded-lg p-4">
        <p className="text-gray-300 text-sm font-light leading-relaxed text-center italic">
          "{mainDescription}"
        </p>
      </div>

      <div className="space-y-3">
        {iconDetails.map((line, index) => {
          const icon = line.slice(0, 2);
          let text = line.slice(2).trim();

          if (icon === '📊') {
            text = text.replace('Quiz insight:', '').trim();
            const timeRegex = /(in \d+ seconds)$/;
            const match = text.match(timeRegex);

            if (match) {
              const mainText = text.replace(timeRegex, '').trim();
              const finalText = mainText.replace('this', 'Quiz');
              const timeText = match[1];
              return (
                <div key={index} className="flex items-start space-x-3">
                  <span className="text-xl">{icon}</span>
                  <p className="text-gray-400 text-sm pt-0.5">
                    {finalText}{' '}
                    <span className="text-purple-300 font-medium">{timeText}</span>
                  </p>
                </div>
              );
            }
          }

          return (
            <div key={index} className="flex items-start space-x-3">
              <span className="text-xl">{icon}</span>
              <p className="text-gray-400 text-sm pt-0.5">{text}</p>
            </div>
          );
        })}
      </div>

      {specialConsideration && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="border border-dashed border-gray-600/70 rounded-lg p-3 flex items-start space-x-3"
        >
            {/* ZMIANA 1: Zastąpienie ikony emoji */}
            <span className="text-xl mt-0.5">💭</span>
            <p className="text-gray-400 text-xs">
              <span className="font-semibold text-gray-300">Special Consideration:</span> {specialConsideration}
            </p>
        </motion.div>
      )}

      <div className="space-y-3 pt-2">
        <h3 className="text-sm font-semibold text-white flex items-center">
          <Film className="w-4 h-4 mr-2 text-purple-400"/>
          Your Film Preferences
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
  );
}