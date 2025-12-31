"use client";

import React, { useState, useEffect } from "react";
import { SpeakerLoudIcon, Cross2Icon } from "@radix-ui/react-icons";

interface Definition {
  definition: string;
  example?: string;
  synonyms?: string[];
}

interface Meaning {
  partOfSpeech: string;
  definitions: Definition[];
}

interface WordDefinitionData {
  word: string;
  phonetic?: string;
  phonetics?: Array<{
    text: string;
    audio?: string;
  }>;
  meanings?: Meaning[];
  origin?: string;
}

interface WordDefinitionPopoverProps {
  word: string;
  isOpen: boolean;
  onClose: () => void;
}

export const WordDefinitionPopover: React.FC<WordDefinitionPopoverProps> = ({
  word,
  isOpen,
  onClose,
}) => {
  const [data, setData] = useState<WordDefinitionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playingAudio, setPlayingAudio] = useState(false);

  useEffect(() => {
    if (!isOpen || !word) return;

    const fetchDefinition = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/define-word", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ word }),
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch definition: ${response.statusText}`);
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch definition");
      } finally {
        setLoading(false);
      }
    };

    fetchDefinition();
  }, [isOpen, word]);

  const getAudioUrl = (): string | undefined => {
    if (!data?.phonetics) return undefined;
    for (const phonetic of data.phonetics) {
      if (phonetic.audio) return phonetic.audio;
    }
    return undefined;
  };

  const playAudio = () => {
    const audioUrl = getAudioUrl();
    if (!audioUrl) return;

    setPlayingAudio(true);
    const audio = new Audio(audioUrl);
    audio.play();
    audio.onended = () => setPlayingAudio(false);
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => onClose()}
        />
      )}
      {isOpen && (
        <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl mx-4">
          <div className="relative rounded-lg bg-white dark:bg-slate-800 p-8 shadow-lg border border-gray-200 dark:border-gray-700 max-h-screen overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
              </div>
            ) : error ? (
              <div className="text-red-500 text-base">{error}</div>
            ) : data ? (
              <div className="space-y-5">
                {/* Word and Audio Button */}
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-3xl font-bold text-gray-900 dark:text-white">
                    {data.word}
                  </h3>
                  {getAudioUrl() && (
                    <button
                      onClick={playAudio}
                      disabled={playingAudio}
                      className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 flex-shrink-0"
                      title="Play pronunciation"
                    >
                      <SpeakerLoudIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </button>
                  )}
                </div>

                {/* Meanings */}
                {data.meanings && data.meanings.length > 0 && (
                  <div className="space-y-5">
                    {data.meanings.map((meaning, idx) => (
                      <div key={idx}>
                        <p className="text-lg font-semibold text-gray-700 dark:text-gray-300 italic mb-2">
                          {meaning.partOfSpeech}
                        </p>
                        <div className="mt-2">
                          {meaning.definitions.length > 0 && (
                            <div>
                              <p className="text-lg text-gray-800 dark:text-gray-200">
                                {meaning.definitions[0].definition}
                              </p>
                              {meaning.definitions[0].example && (
                                <p className="text-base text-gray-600 dark:text-gray-400 mt-3 italic">
                                  &quot;{meaning.definitions[0].example}&quot;
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Origin */}
                {data.origin && (
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <p className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Origin
                    </p>
                    <p className="text-base text-gray-600 dark:text-gray-400">
                      {data.origin}
                    </p>
                  </div>
                )}
              </div>
          ) : (
            <div className="text-gray-500 text-sm">No definition found</div>
          )}

            <button
              className="absolute top-2 right-2 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
              aria-label="Close"
              onClick={() => onClose()}
            >
              <Cross2Icon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default WordDefinitionPopover;
