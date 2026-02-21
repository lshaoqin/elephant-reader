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
  const [viewMode, setViewMode] = useState<"definition" | "practice">("definition");
  const [practiceStep, setPracticeStep] = useState<"look" | "hear" | "write">("look");
  const [spellingInput, setSpellingInput] = useState("");
  const [spellingFeedback, setSpellingFeedback] = useState<"correct" | "incorrect" | null>(null);
  const [spellingAudioLoading, setSpellingAudioLoading] = useState(false);
  const [spellingAudioPlaying, setSpellingAudioPlaying] = useState(false);
  const [practiceError, setPracticeError] = useState<string | null>(null);

  const fullWordAudioRef = useRef<HTMLAudioElement | null>(null);
  const spellingAudioRef = useRef<HTMLAudioElement | null>(null);

  const stopAllAudio = () => {
    if (fullWordAudioRef.current) {
      fullWordAudioRef.current.pause();
      fullWordAudioRef.current.currentTime = 0;
    }
    if (spellingAudioRef.current) {
      spellingAudioRef.current.pause();
      spellingAudioRef.current.currentTime = 0;
    }
    setPlayingAudio(false);
    setSpellingAudioPlaying(false);
  };

  const getPracticeSyllables = (): string[] => {
    if (!data) return [];
    if (
      data.syllables &&
      data.syllables.length > 0 &&
      !(data.syllables.length === 1 && data.syllables[0].toLowerCase() === data.word.toLowerCase())
    ) {
      return data.syllables;
    }
    return [data.word];
  };

  const getSpellingPrompt = (value: string): string => {
    const lettersOnly = value.replace(/[^\p{L}]/gu, "");
    const source = lettersOnly || value;
    return Array.from(source.toUpperCase()).join("-");
  };

  const normalizeSpellingValue = (value: string): string => {
    const lettersOnly = value.toLowerCase().replace(/[^\p{L}]/gu, "");
    return lettersOnly || value.trim().toLowerCase();
  };

  const parseTtsSseAudio = async (response: Response): Promise<string> => {
    if (!response.body) {
      throw new Error("No response body");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const dataStr = line.slice(6);
        const parsed = JSON.parse(dataStr);

        if (parsed.error) {
          throw new Error(parsed.error);
        }

        if (parsed.status === "complete" && parsed.audio) {
          return parsed.audio as string;
        }
      }
    }

    throw new Error("No audio returned from TTS service");
  };

  const playSpellingAudio = async () => {
    if (!data?.word || spellingAudioLoading || spellingAudioPlaying) return;

    setSpellingAudioLoading(true);
    setPracticeError(null);

    try {
      const spellingPrompt = getSpellingPrompt(data.word);
      const response = await fetch("/api/tts/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: spellingPrompt }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate spelling audio");
      }

      const audioBase64 = await parseTtsSseAudio(response);
      const audioSrc = getAudioSrc(audioBase64);
      if (!audioSrc) {
        throw new Error("Invalid spelling audio");
      }

      stopAllAudio();
      const audio = new Audio(audioSrc);
      spellingAudioRef.current = audio;
      audio.playbackRate = 0.75;
      setSpellingAudioPlaying(true);

      audio.onended = () => {
        setSpellingAudioPlaying(false);
      };

      await audio.play();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to play spelling audio";
      setPracticeError(message);
    } finally {
      setSpellingAudioLoading(false);
    }
  };

  const resetPractice = () => {
    setPracticeStep("look");
    setSpellingInput("");
    setSpellingFeedback(null);
    setPracticeError(null);
  };

  const openPractice = () => {
    stopAllAudio();
    resetPractice();
    setViewMode("practice");
  };

  const backToDefinition = () => {
    stopAllAudio();
    resetPractice();
    setViewMode("definition");
  };

  const handleCheckSpelling = () => {
    if (!data?.word) return;

    const expected = normalizeSpellingValue(data.word);
    const actual = normalizeSpellingValue(spellingInput);
    const isCorrect = actual.length > 0 && actual === expected;

    setSpellingFeedback(isCorrect ? "correct" : "incorrect");
  };

  useEffect(() => {
    if (!isOpen || !word) return;

    setViewMode("definition");
    resetPractice();

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

  const stepOrder: Array<"look" | "hear" | "write"> = ["look", "hear", "write"];
  const stepLabelMap: Record<"look" | "hear" | "write", string> = {
    look: "Look",
    hear: "Say",
    write: "Check",
  };
  const currentStepIndex = stepOrder.indexOf(practiceStep);

  const goToPracticeStep = (step: "look" | "hear" | "write") => {
    setPracticeStep(step);
    setPracticeError(null);
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="relative w-full max-w-2xl rounded-lg bg-white dark:bg-slate-800 p-8 shadow-lg border border-gray-200 dark:border-gray-700 max-h-[calc(100vh-2rem)] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
              </div>
            ) : data ? (
              <div className="space-y-5">
                {/* Word and Audio Button */}
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-3xl font-bold text-gray-900 dark:text-white">
                    {viewMode === "practice" ? "Practice spelling" : data.word}
                  </h3>
                  <div className="flex gap-2 shrink-0">
                    {viewMode === "definition" && data.audio?.full_word?.audio && (
                      <button
                        onClick={playFullWordAudio}
                        disabled={playingAudio}
                        className="px-2 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                        title="Play full word"
                      >
                        <SpeakerLoudIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </button>
                    )}
                    {viewMode === "practice" && (
                      <button
                        onClick={backToDefinition}
                        className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        title="Back to definition"
                      >
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Back</span>
                      </button>
                    )}
                  </div>
                </div>

                {viewMode === "definition" ? (
                  <>
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

                    <div className="flex justify-center pt-2">
                      <button
                        onClick={openPractice}
                        className="px-4 py-2 rounded-lg border border-blue-200 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900 transition-colors"
                        title="Practice spelling"
                      >
                        <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">Practice spelling this word</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-start justify-center gap-2 sm:gap-4">
                      {stepOrder.map((step, index) => {
                        const isActive = index === currentStepIndex;
                        const isDone = index < currentStepIndex;

                        return (
                          <React.Fragment key={step}>
                            <div className="flex flex-col items-center gap-2 min-w-20">
                              <button
                                type="button"
                                onClick={() => goToPracticeStep(step)}
                                aria-label={`Go to step ${index + 1}: ${stepLabelMap[step]}`}
                                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold ${
                                  isActive
                                    ? "bg-blue-600 border-blue-600 text-white"
                                    : isDone
                                      ? "bg-blue-100 dark:bg-blue-900 border-blue-400 dark:border-blue-700 text-blue-700 dark:text-blue-200"
                                      : "bg-white dark:bg-slate-800 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400"
                                }`}
                              >
                                {index + 1}
                              </button>
                              <span
                                className={`text-xs font-semibold text-center ${
                                  isActive
                                    ? "text-blue-700 dark:text-blue-300"
                                    : "text-gray-600 dark:text-gray-400"
                                }`}
                              >
                                {stepLabelMap[step]}
                              </span>
                            </div>
                            {index < stepOrder.length - 1 && (
                              <div
                                className={`h-0.5 w-8 sm:w-10 rounded mt-4 ${
                                  index < currentStepIndex
                                    ? "bg-blue-400 dark:bg-blue-700"
                                    : "bg-gray-300 dark:bg-gray-600"
                                }`}
                              />
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                    <p className="text-sm font-semibold text-center text-gray-600 dark:text-gray-400">
                      Step {currentStepIndex + 1} of {stepOrder.length}
                    </p>

                    {practiceStep === "look" && (
                      <div className="space-y-4 flex flex-col items-center text-center">
                        <p className="text-base text-gray-700 dark:text-gray-300">
                          Study the word.
                        </p>
                        <div className="text-2xl font-bold tracking-wide text-gray-900 dark:text-white">
                          {getPracticeSyllables().join("·")}
                        </div>
                        <button
                          onClick={() => setPracticeStep("hear")}
                          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors"
                        >
                          Next
                        </button>
                      </div>
                    )}

                    {practiceStep === "hear" && (
                      <div className="space-y-4 flex flex-col items-center text-center">
                        <p className="text-base text-gray-700 dark:text-gray-300">
                          Hear the letters and say them aloud.
                        </p>
                        <div className="text-xl font-bold tracking-widest text-gray-900 dark:text-white">
                          {getSpellingPrompt(data.word)}
                        </div>
                        <div className="flex flex-wrap justify-center gap-3">
                          <button
                            onClick={() => void playSpellingAudio()}
                            disabled={spellingAudioLoading || spellingAudioPlaying}
                            className="px-4 py-2 rounded-lg border border-blue-200 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900 transition-colors disabled:opacity-50"
                          >
                            <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                              {spellingAudioLoading ? "Loading audio..." : spellingAudioPlaying ? "Playing..." : "Read letters"}
                            </span>
                          </button>
                          <button
                            onClick={() => {
                              setPracticeStep("write");
                              setSpellingInput("");
                              setSpellingFeedback(null);
                              setPracticeError(null);
                            }}
                            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors"
                          >
                            Next
                          </button>
                        </div>
                        {practiceError && (
                          <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                            {practiceError}
                          </p>
                        )}
                      </div>
                    )}

                    {practiceStep === "write" && (
                      <div className="space-y-4">
                        <p className="text-base text-gray-700 dark:text-gray-300 text-center">
                          Type the spelling from memory and check your answer.
                        </p>

                        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-900/50 p-4 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                              Definition
                            </p>
                            {data.audio?.full_word?.audio && (
                              <button
                                onClick={playFullWordAudio}
                                disabled={playingAudio}
                                className="px-2 py-2 rounded-lg border border-blue-200 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900 transition-colors disabled:opacity-50 flex items-center gap-2"
                                title="Play word audio"
                              >
                                <SpeakerLoudIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">Audio</span>
                              </button>
                            )}
                          </div>
                          <p
                            className="text-base text-gray-800 dark:text-gray-200"
                            style={{
                              fontFamily: textSettings.fontFamily,
                              lineHeight: textSettings.lineSpacing,
                            }}
                          >
                            {data.definition}
                          </p>
                        </div>

                        <input
                          type="text"
                          value={spellingInput}
                          onChange={(event) => {
                            setSpellingInput(event.target.value);
                            if (spellingFeedback) {
                              setSpellingFeedback(null);
                            }
                          }}
                          placeholder="Type the word"
                          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-900 px-4 py-2 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <div className="flex flex-wrap gap-3 justify-center sm:justify-start">
                          <button
                            onClick={handleCheckSpelling}
                            disabled={!spellingInput.trim()}
                            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors disabled:opacity-50"
                          >
                            Check
                          </button>
                          <button
                            onClick={() => {
                              setSpellingInput("");
                              setSpellingFeedback(null);
                            }}
                            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold transition-colors"
                          >
                            Clear
                          </button>
                        </div>

                        {spellingFeedback === "correct" && (
                          <div className="rounded-lg border border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900/20 px-3 py-2">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-green-700 dark:text-green-400 font-semibold">
                                Great job! You spelled it correctly.
                              </p>
                              <button
                                onClick={resetPractice}
                                className="px-3 py-1.5 rounded-lg bg-green-700 hover:bg-green-800 text-white text-sm font-semibold transition-colors shrink-0"
                              >
                                Practice again
                              </button>
                            </div>
                          </div>
                        )}

                        {spellingFeedback === "incorrect" && (
                          <p className="text-red-700 dark:text-red-400 font-semibold rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3">
                            Try again! You can tap on a previous step to review the word.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
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
