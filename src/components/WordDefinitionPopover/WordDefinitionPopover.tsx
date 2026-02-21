"use client";

import React, { useState, useEffect, useRef } from "react";
import { SpeakerLoudIcon, Cross2Icon } from "@radix-ui/react-icons";

interface AudioReading {
  audio: string;
  sample_rate: number;
}

interface ReaderTextSettings {
  fontFamily: string;
  fontSize: number;
  fontColor: string;
  lineSpacing: number;
}

interface WordDefinitionData {
  word: string;
  definition: string;
  part_of_speech?: string;
  example_sentence?: string;
  syllables?: string[];
  audio?: {
    full_word?: AudioReading;
  };
}

interface WordDefinitionPopoverProps {
  word: string;
  contextSentence?: string;
  textSettings: ReaderTextSettings;
  isOpen: boolean;
  onClose: () => void;
}

export const WordDefinitionPopover: React.FC<WordDefinitionPopoverProps> = ({
  word,
  contextSentence,
  textSettings,
  isOpen,
  onClose,
}) => {
  const [data, setData] = useState<WordDefinitionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playingAudio, setPlayingAudio] = useState(false);

  const fullWordAudioRef = useRef<HTMLAudioElement | null>(null);

  const stopAllAudio = () => {
    if (fullWordAudioRef.current) {
      fullWordAudioRef.current.pause();
      fullWordAudioRef.current.currentTime = 0;
    }
    setPlayingAudio(false);
  };

  useEffect(() => {
    if (!isOpen || !word) return;

    const fetchDefinition = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/define-word", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            word,
            contextSentence: contextSentence || "",
          }),
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
  }, [isOpen, word, contextSentence]);

  useEffect(() => {
    if (!isOpen) {
      stopAllAudio();
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      stopAllAudio();
    };
  }, []);

  const getAudioSrc = (audioBase64?: string): string | undefined => {
    if (!audioBase64) return undefined;
    return `data:audio/wav;base64,${audioBase64}`;
  };

  const playFullWordAudio = () => {
    const audioSrc = getAudioSrc(data?.audio?.full_word?.audio);
    if (!audioSrc) return;

    stopAllAudio();
    const audio = new Audio(audioSrc);
    fullWordAudioRef.current = audio;
    setPlayingAudio(true);

    audio.onended = () => {
      setPlayingAudio(false);
    };

    void audio.play();
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            stopAllAudio();
            onClose();
          }}
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
              <div className="space-y-4 py-8">
                <div className="text-center">
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    Word not found
                  </h3>
                  <p className="text-base text-gray-600 dark:text-gray-400 mb-6">
                    We couldn&apos;t find a definition for &quot;{word}&quot; in our dictionary.
                  </p>
                  <button
                    onClick={() => {
                      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(word)}`;
                      window.open(searchUrl, "_blank");
                    }}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
                  >
                    Search on Google
                  </button>
                </div>
              </div>
            ) : data ? (
              <div className="space-y-5">
                {/* Word and Audio Button */}
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-3xl font-bold text-gray-900 dark:text-white">
                    {data.word}
                  </h3>
                  <div className="flex gap-2 shrink-0">
                    {data.audio?.full_word?.audio && (
                      <button
                        onClick={playFullWordAudio}
                        disabled={playingAudio}
                        className="px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                        title="Play full word"
                      >
                        <SpeakerLoudIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Word</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Syllables */}
                {data.syllables &&
                  data.syllables.length > 0 &&
                  !(
                    data.syllables.length === 1 &&
                    data.syllables[0].toLowerCase() === data.word.toLowerCase()
                  ) && (
                  <div className="flex flex-wrap gap-2">
                    {data.syllables.map((syllable, idx) => (
                      <div
                        key={idx}
                        className="px-4 py-2 border-2 rounded-lg font-semibold text-base transition-colors border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-200"
                      >
                        {syllable}
                      </div>
                    ))}
                  </div>
                )}

                {data.part_of_speech && (
                  <p className="text-base italic text-gray-600 dark:text-gray-400">
                    {data.part_of_speech}
                  </p>
                )}

                <p
                  className="text-lg"
                  style={{
                    fontFamily: textSettings.fontFamily,
                    fontSize: `${textSettings.fontSize}px`,
                    color: textSettings.fontColor === "gradient" ? "#1a1a1a" : textSettings.fontColor,
                    lineHeight: textSettings.lineSpacing,
                  }}
                >
                  {data.definition}
                </p>

                {data.example_sentence && (
                  <p className="text-base text-gray-600 dark:text-gray-400 italic">
                    Example: &quot;{data.example_sentence}&quot;
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-4 py-8 text-center">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Word not found
                </h3>
                <p className="text-base text-gray-600 dark:text-gray-400 mb-6">
                  We couldn&apos;t find a definition for &quot;{word}&quot;.
                </p>
                <button
                  onClick={() => {
                    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(word)}`;
                    window.open(searchUrl, "_blank");
                  }}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
                >
                  Search on Google
                </button>
              </div>
            )}

            <button
              className="absolute top-2 right-2 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
              aria-label="Close"
              onClick={() => {
                stopAllAudio();
                onClose();
              }}
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
