"use client";

import React from "react";
import type { WordHuntData } from "@/components/WordHunt/types";

interface WordHuntViewProps {
  wordHuntData: WordHuntData;
  foundCount: number;
  totalCount: number;
  isPhonemeAudioPlaying: boolean;
  onPlaySound: () => void;
  shouldShowWordList: boolean;
  onToggleWordList: () => void;
  foundWordKeys: Set<string>;
  revealedAnswers: boolean;
  correctWordKeySet: Set<string>;
  normalizeToken: (value: string) => string;
  feedback: string | null;
}

export const WordHuntView: React.FC<WordHuntViewProps> = ({
  wordHuntData,
  foundCount,
  totalCount,
  isPhonemeAudioPlaying,
  onPlaySound,
  shouldShowWordList,
  onToggleWordList,
  foundWordKeys,
  revealedAnswers,
  correctWordKeySet,
  normalizeToken,
  feedback,
}) => {
  const displayQuestion = wordHuntData.question.replace(/^Find words/i, "Tap words");
  const shouldShowFeedback = Boolean(feedback && feedback !== "Tap words in the text to find matches.");

  return (
    <div className="w-full mb-4 p-3 sm:p-4 rounded-xl border-2 border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-slate-800">
      <div className="flex items-start justify-between gap-3">
        <p className="text-base sm:text-lg lg:text-xl font-bold text-gray-900 dark:text-white leading-snug pr-2">
          {displayQuestion}
        </p>
        <span className="shrink-0 px-2 py-1 rounded-full bg-blue-100 text-blue-800 border border-blue-300 text-xs sm:text-sm font-bold dark:bg-blue-900 dark:text-blue-100 dark:border-blue-700">
          {foundCount}/{totalCount}
        </span>
      </div>

      {wordHuntData.phoneme_audio?.audio && (
        <button
          onClick={onPlaySound}
          disabled={isPhonemeAudioPlaying}
          className="mt-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-50"
        >
          Play sound
        </button>
      )}

      {wordHuntData.correct_words.length > 0 && (
        <div className="mt-4">
          <button
            onClick={onToggleWordList}
            className="inline-flex items-center px-4 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-800 text-sm font-semibold border border-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-100 dark:border-slate-500"
          >
            {shouldShowWordList ? "Hide words" : "Show words"}
          </button>

          {shouldShowWordList && (
            <div className="mt-3 pt-1 flex flex-wrap gap-2">
                {wordHuntData.correct_words.map((word, index) => {
                  const key = normalizeToken(word);
                  const found = foundWordKeys.has(key);
                  const revealed = revealedAnswers && correctWordKeySet.has(key);

                  return (
                    <span
                      key={`${word}-${index}`}
                      className={[
                        "px-4 py-1 rounded-full text-sm font-semibold border shadow-sm",
                        found
                          ? "bg-emerald-200 text-emerald-900 border-emerald-500 dark:bg-emerald-700 dark:text-emerald-100 dark:border-emerald-300"
                          : revealed
                            ? "bg-amber-100 text-amber-900 border-amber-500 dark:bg-amber-700 dark:text-amber-100 dark:border-amber-300"
                            : "bg-white text-slate-700 border-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-500",
                      ].join(" ")}
                    >
                      {word}
                    </span>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {shouldShowFeedback && (
        <p className="mt-3 text-sm sm:text-base text-gray-700 dark:text-gray-200 font-medium">
          {feedback}
        </p>
      )}
    </div>
  );
};

export default WordHuntView;
