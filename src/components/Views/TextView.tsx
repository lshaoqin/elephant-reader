"use client";

import React, { ReactNode, useState, useEffect, useCallback, CSSProperties } from "react";
import {
  FileTextIcon,
  SpeakerLoudIcon,
  Pencil2Icon,
} from "@radix-ui/react-icons";
import { Button, Header, TextViewBox, LoadingSpinner, MediaPlayer, WordDefinitionPopover, GradientReader } from "@/components";
import { buildWordHuntQuestionPool } from "@/components/WordHunt/questionPool";
import WordHuntActions from "@/components/WordHunt/WordHuntActions";
import type { WordHuntData } from "@/components/WordHunt/types";
import type { TextSettings } from "./SettingsView";
import { getQuestionAwareTipMessage, getTapSuccessMessage, WordHuntView } from "./WordHuntView";

interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

interface TextViewProps {
  displayText: string;
  isFormatting: boolean;
  isLoadingAudio: boolean;
  isPlayingAudio: boolean;
  audioRef: React.RefObject<HTMLAudioElement>;
  wordTimestamps: WordTimestamp[];
  currentPlaybackTime: number;
  onBackClick: () => void;
  onSettingsClick: () => void;
  onListen: () => void;
  onPlayPauseAudio: () => void;
  onStopAudio: () => void;
  settings: TextSettings;
  onEditClick: () => void;
}

export const TextView: React.FC<TextViewProps> = ({
  displayText,
  isFormatting,
  isLoadingAudio,
  isPlayingAudio,
  audioRef,
  wordTimestamps,
  currentPlaybackTime,
  onBackClick,
  onSettingsClick,
  onListen,
  onPlayPauseAudio,
  onStopAudio,
  settings,
  onEditClick,
}) => {
  const [hasAudioLoaded, setHasAudioLoaded] = useState(false);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [selectedWordContext, setSelectedWordContext] = useState<string>("");
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isParagraphMode, setIsParagraphMode] = useState(false);
  const [currentParagraphIndex, setCurrentParagraphIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [wordHuntData, setWordHuntData] = useState<WordHuntData | null>(null);
  const [wordHuntLoading, setWordHuntLoading] = useState(false);
  const [wordHuntFeedback, setWordHuntFeedback] = useState<string | null>(null);
  const [foundWordKeys, setFoundWordKeys] = useState<Set<string>>(new Set());
  const [revealedAnswers, setRevealedAnswers] = useState(false);
  const [showWordList, setShowWordList] = useState(false);
  const [currentWordHuntQuestionIndex, setCurrentWordHuntQuestionIndex] = useState(0);
  const [isPhonemeAudioPlaying, setIsPhonemeAudioPlaying] = useState(false);
  const wordHuntAudioRef = React.useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadStart = () => {
      setHasAudioLoaded(true);
    };

    audio.addEventListener("loadstart", handleLoadStart);

    return () => {
      audio.removeEventListener("loadstart", handleLoadStart);
    };
  }, [audioRef]);

  const handleSpeedUp = () => {
    const newSpeed = Math.min(playbackSpeed + 0.25, 2);
    setPlaybackSpeed(newSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = newSpeed;
    }
  };

  const handleSlowDown = () => {
    const newSpeed = Math.max(playbackSpeed - 0.25, 0.5);
    setPlaybackSpeed(newSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = newSpeed;
    }
  };

  const handleStop = () => {
    onStopAudio();
    setHasAudioLoaded(false);
  };

  const normalizeToken = useCallback((value: string): string =>
    value.toLowerCase().replace(/[^\w']/g, ""), []);

  const getWordHuntHighlightStyle = useCallback((isSuccess: boolean, isReveal: boolean): CSSProperties | undefined => {
    if (isSuccess) {
      return {
        backgroundColor: "#86efac",
        boxShadow: "inset 0 0 0 2px #16a34a",
        borderRadius: "0.2rem",
      };
    }

    if (isReveal) {
      return {
        backgroundColor: "#fde68a",
        boxShadow: "inset 0 0 0 1px #d97706",
        borderRadius: "0.2rem",
      };
    }

    return undefined;
  }, []);

  const correctWordKeySet = React.useMemo(() => {
    if (!wordHuntData?.correct_words?.length) return new Set<string>();
    return new Set(wordHuntData.correct_words.map((word) => normalizeToken(word)).filter(Boolean));
  }, [wordHuntData, normalizeToken]);

  const wordHuntQuestionPool = React.useMemo<WordHuntData[]>(() => {
    return buildWordHuntQuestionPool(displayText, normalizeToken);
  }, [displayText, normalizeToken]);

  const disableWordTap = Boolean(wordHuntData) && revealedAnswers;

  const wordHuntMarkedIndexes = useCallback((plainText: string) => {
    const successIndexes = new Set<number>();
    const revealIndexes = new Set<number>();

    const tokens = plainText.split(/(\s+)/).filter((token) => token.length > 0);
    tokens.forEach((token, index) => {
      if (/^\s+$/.test(token)) return;
      const normalized = normalizeToken(token);
      if (!normalized) return;
      if (foundWordKeys.has(normalized)) {
        successIndexes.add(index);
      }
      if (revealedAnswers && correctWordKeySet.has(normalized)) {
        revealIndexes.add(index);
      }
    });

    return { successIndexes, revealIndexes };
  }, [correctWordKeySet, foundWordKeys, normalizeToken, revealedAnswers]);

  const stopWordHuntAudio = () => {
    if (wordHuntAudioRef.current) {
      wordHuntAudioRef.current.pause();
      wordHuntAudioRef.current.currentTime = 0;
      wordHuntAudioRef.current = null;
    }
    setIsPhonemeAudioPlaying(false);
  };

  useEffect(() => {
    return () => {
      stopWordHuntAudio();
    };
  }, []);

  const playWordHuntAudio = async () => {
    const base64Audio = wordHuntData?.phoneme_audio?.audio;
    if (!base64Audio) return;

    stopWordHuntAudio();
    const audio = new Audio(`data:audio/wav;base64,${base64Audio}`);
    wordHuntAudioRef.current = audio;
    audio.onended = () => setIsPhonemeAudioPlaying(false);

    try {
      await audio.play();
      setIsPhonemeAudioPlaying(true);
    } catch {
      setIsPhonemeAudioPlaying(false);
    }
  };

  const startWordHunt = useCallback(async () => {
    setWordHuntLoading(true);
    setWordHuntFeedback(null);
    setFoundWordKeys(new Set());
    setRevealedAnswers(false);
    setShowWordList(false);

    try {
      if (wordHuntQuestionPool.length === 0) {
        setWordHuntData(null);
        setWordHuntFeedback("Could not create a word hunt right now.");
        return;
      }

      const firstIndex = 0;
      setCurrentWordHuntQuestionIndex(firstIndex);
      setWordHuntData(wordHuntQuestionPool[firstIndex]);
      setWordHuntFeedback(null);
    } catch {
      setWordHuntFeedback("Could not create a word hunt right now.");
    } finally {
      setWordHuntLoading(false);
    }
  }, [wordHuntQuestionPool]);

  const revealAnswers = useCallback(() => {
    setRevealedAnswers(true);
    const wordCount = correctWordKeySet.size;
    setWordHuntFeedback(
      wordCount > 0
        ? `Answers revealed. There ${wordCount === 1 ? "is" : "are"} ${wordCount} correct ${wordCount === 1 ? "word" : "words"}.`
        : "Answers revealed."
    );
  }, [correctWordKeySet]);

  const skipQuestion = useCallback(() => {
    if (wordHuntQuestionPool.length <= 1) {
      setWordHuntFeedback("No other question available for this text.");
      return;
    }

    const nextIndex = (currentWordHuntQuestionIndex + 1) % wordHuntQuestionPool.length;
    setCurrentWordHuntQuestionIndex(nextIndex);
    setWordHuntData(wordHuntQuestionPool[nextIndex]);
    setFoundWordKeys(new Set());
    setRevealedAnswers(false);
    setShowWordList(false);
    setWordHuntFeedback(null);
  }, [currentWordHuntQuestionIndex, wordHuntQuestionPool]);

  const nextQuestion = useCallback(() => {
    skipQuestion();
  }, [skipQuestion]);

  const handleWordTapForWordHunt = useCallback((rawWord: string): boolean => {
    if (!wordHuntData) return false;

    const key = normalizeToken(rawWord);
    if (!key) return true;

    if (!correctWordKeySet.has(key)) {
      setWordHuntFeedback("Nice try. Keep looking!");
      return true;
    }

    if (!foundWordKeys.has(key)) {
      const nextFound = new Set(foundWordKeys);
      nextFound.add(key);
      setFoundWordKeys(nextFound);
      setWordHuntFeedback(getTapSuccessMessage());

      if (nextFound.size >= correctWordKeySet.size && correctWordKeySet.size > 0) {
        const finalFeedback = `${wordHuntData.completion_feedback} ${getQuestionAwareTipMessage(wordHuntData.question)}`;
        setWordHuntFeedback(finalFeedback);
      }
    }

    return true;
  }, [wordHuntData, correctWordKeySet, foundWordKeys, normalizeToken]);

  const handleWordTapForDefinition = useCallback((word: string, sentenceContext: string) => {
    if (handleWordTapForWordHunt(word)) return;
    setSelectedWord(word);
    setSelectedWordContext(sentenceContext);
    setIsPopoverOpen(true);
  }, [handleWordTapForWordHunt]);

  const getSentenceFromCharRange = (plainText: string, start: number, end: number): string => {
    if (!plainText.trim()) return "";

    const left = plainText.slice(0, start);
    const right = plainText.slice(end);

    const prevBoundaryIndex = Math.max(
      left.lastIndexOf("."),
      left.lastIndexOf("!"),
      left.lastIndexOf("?"),
      left.lastIndexOf("\n")
    );

    const nextBoundaryCandidates = [
      right.indexOf("."),
      right.indexOf("!"),
      right.indexOf("?"),
      right.indexOf("\n"),
    ].filter((value) => value >= 0);

    const nextBoundaryOffset =
      nextBoundaryCandidates.length > 0
        ? Math.min(...nextBoundaryCandidates)
        : right.length;

    const sentenceStart = prevBoundaryIndex >= 0 ? prevBoundaryIndex + 1 : 0;
    const sentenceEnd = end + nextBoundaryOffset + 1;

    return plainText.slice(sentenceStart, sentenceEnd).trim();
  };

  const getSentenceForWordFallback = (plainText: string, rawWord: string): string => {
    if (!plainText.trim()) return "";

    const normalizedWord = rawWord.toLowerCase().replace(/[^\w-]/g, "");
    if (!normalizedWord) return "";

    const sentences = plainText.match(/[^.!?\n]+[.!?]?/g) || [plainText];
    const matchingSentence = sentences.find((sentence) => {
      const normalizedSentence = sentence.toLowerCase().replace(/[^\w\s-]/g, " ");
      const parts = normalizedSentence.split(/\s+/).filter(Boolean);
      return parts.includes(normalizedWord);
    });

    return (matchingSentence || sentences[0] || "").trim();
  };

  // Build a mapping of timestamp index to word index at the start (memoized)
  const buildTimestampWordMap = React.useMemo(() => (text: string): Map<number, number> => {
    const map = new Map<number, number>();
    if (!wordTimestamps || wordTimestamps.length === 0) {
      return map;
    }

    const words = text.split(/(\s+)/);
    const compareWord = (w: string) => w.toLowerCase().replace(/[^\w-]/g, '');
    
    let lastFoundWordIdx = -1;
    let lastValidWordIdx = -1; // Track the last actual word highlighted

    wordTimestamps.forEach((ts, tsIdx) => {
      // Handle special tokens
      if (ts.word === '<eps>') {
        // For <eps> (silence), keep the previous word highlighted
        if (lastValidWordIdx >= 0) {
          map.set(tsIdx, lastValidWordIdx);
        }
        return;
      } else if (ts.word === '<unk>') {
        // For <unk> (unknown), highlight the next word
        // Find the next non-whitespace word
        for (let i = lastFoundWordIdx + 1; i < words.length; i++) {
          if (!/^\s+$/.test(words[i])) {
            map.set(tsIdx, i);
            // lastFoundWordIdx = i;
            lastValidWordIdx = i;
            return;
          }
        }
        return;
      }

      const targetWord = compareWord(ts.word);

      // Search for the word starting from where we left off
      for (let i = lastFoundWordIdx + 1; i < words.length; i++) {
        if (!/^\s+$/.test(words[i]) && compareWord(words[i]) === targetWord) {
          map.set(tsIdx, i);
          lastFoundWordIdx = i;
          lastValidWordIdx = i;
          break;
        }
      }
    });

    return map;
  }, [wordTimestamps]);

  // Create a function to parse text with word highlighting
  // eslint-disable-next-line react/display-name
  const parseTextWithHighlight = React.useMemo(() => (text: string): ReactNode => {
    if (!wordTimestamps || wordTimestamps.length === 0) {
      // Default mode: Parse HTML and make words clickable for definitions
      const plainText = text.replace(/<b>|<\/b>/g, "");

      if (settings.fontColor === "gradient") {
        const { successIndexes, revealIndexes } = wordHuntMarkedIndexes(plainText);
        // Apply gradient reading mode based on visual lines
        return (
          <GradientReader
            text={text}
            successWordIndexes={successIndexes}
            revealWordIndexes={revealIndexes}
            onWordClick={(word) => {
              if (disableWordTap) return;
              handleWordTapForDefinition(word, getSentenceForWordFallback(plainText, word));
            }}
          />
        );
      }

      // Standard mode without gradient reading
      const words = plainText.split(/(\s+)/);
      
      // Build a map of which character ranges are bold (from HTML)
      const boldRanges: Array<{ start: number; end: number }> = [];
      const regex = /<b>(.+?)<\/b>/g;
      let match;
      while ((match = regex.exec(text)) !== null) {
        const tagsBeforeBold = (text.substring(0, match.index).match(/<b>|<\/b>/g) || []).length;
        const charsBeforeBold = tagsBeforeBold * 3; // Each tag is 3 chars (<b> or </b>)
        const displayStart = match.index - charsBeforeBold;
        const innerLength = match[1].length;
        boldRanges.push({
          start: displayStart,
          end: displayStart + innerLength,
        });
      }

      const isBold = (start: number, end: number) => {
        return boldRanges.some(
          (range) => start < range.end && end > range.start
        );
      };

      let displayCharPos = 0;

      return (
        <>
          {words.map((part, idx) => {
            const partStart = displayCharPos;
            const partEnd = displayCharPos + part.length;
            const shouldBold = isBold(partStart, partEnd);
            const normalizedPart = normalizeToken(part);
            const isSuccess = foundWordKeys.has(normalizedPart);
            const isReveal = revealedAnswers && correctWordKeySet.has(normalizedPart);
            displayCharPos = partEnd;

            // If it's just whitespace, return as-is
            if (/^\s+$/.test(part)) {
              return <span key={idx}>{part}</span>;
            }

            const classes = [
              shouldBold && "font-semibold",
              isSuccess && "bg-yellow-200/90 dark:bg-yellow-700/70 ring-2 ring-yellow-500 rounded-sm px-0.5 underline decoration-2 decoration-yellow-700 dark:decoration-yellow-200",
              isReveal && !isSuccess && "bg-amber-200 dark:bg-amber-700 ring-1 ring-amber-500 rounded-sm px-0.5",
              !disableWordTap && "cursor-pointer hover:underline",
              "transition-all duration-150",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <span
                key={idx}
                className={classes}
                style={getWordHuntHighlightStyle(isSuccess, isReveal)}
                onClick={() => {
                  if (disableWordTap) return;
                  handleWordTapForDefinition(
                    part,
                    getSentenceFromCharRange(plainText, partStart, partEnd)
                  );
                }}
              >
                {part}
              </span>
            );
          })}
        </>
      );
    }

    // Listening mode: Parse with highlighting, no clickable definitions
    // Remove <b></b> tags to get display text
    const displayText = text.replace(/<b>|<\/b>/g, "");

    // Build a map of which character ranges are bold (from HTML)
    const boldRanges: Array<{ start: number; end: number }> = [];
    const regex = /<b>(.+?)<\/b>/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      // Calculate the start and end positions in the display text (without HTML tags)
      const tagsBeforeBold = (text.substring(0, match.index).match(/<b>|<\/b>/g) || []).length;
      const charsBeforeBold = tagsBeforeBold * 3; // Each tag is 3 chars (<b> or </b>)
      const displayStart = match.index - charsBeforeBold;
      const innerLength = match[1].length;
      boldRanges.push({
        start: displayStart,
        end: displayStart + innerLength,
      });
    }

    // Helper to check if a character range overlaps with a bold range
    const isBold = (start: number, end: number) => {
      return boldRanges.some(
        (range) => start < range.end && end > range.start
      );
    };

    // Split text into words while preserving original formatting
    const words = displayText.split(/(\s+)/);
    const { successIndexes, revealIndexes } = wordHuntMarkedIndexes(displayText);
    
    // Build the timestamp to word index mapping (using displayText)
    const timestampWordMap = buildTimestampWordMap(displayText);
    
    // Build reverse map for faster lookup (word index -> timestamp index)
    const wordToTimestampMap = new Map<number, number>();
    timestampWordMap.forEach((wordIdx, tsIdx) => {
      if (!wordToTimestampMap.has(wordIdx)) {
        wordToTimestampMap.set(wordIdx, tsIdx);
      }
    });

    // Find the current timestamp index
    const currentTimestampIdx = wordTimestamps.findIndex(
      (ts) => currentPlaybackTime >= ts.start && currentPlaybackTime < ts.end
    );
    
    // Get the word index to highlight from our pre-built map
    const highlightWordIdx = timestampWordMap.get(currentTimestampIdx) ?? -1;

    if (settings.fontColor === "gradient") {
      return (
        <GradientReader
          text={text}
          highlightedWordIndex={highlightWordIdx}
          successWordIndexes={successIndexes}
          revealWordIndexes={revealIndexes}
          onWordClick={(_, wordIdx) => {
            if (disableWordTap) return;
            const tappedWord = words[wordIdx] ?? "";
            if (handleWordTapForWordHunt(tappedWord)) {
              return;
            }
            const timestampIdx = wordToTimestampMap.get(wordIdx);
            if (timestampIdx !== undefined && wordTimestamps[timestampIdx]) {
              const audio = audioRef.current;
              if (audio) {
                audio.currentTime = wordTimestamps[timestampIdx].start;
                if (!isPlayingAudio) {
                  onPlayPauseAudio();
                }
              }
            }
          }}
        />
      );
    }

    // Track character position in display text
    let displayCharPos = 0;

    return (
      <>
        {words.map((part, idx) => {
          const partStart = displayCharPos;
          const partEnd = displayCharPos + part.length;
          const shouldHighlight = idx === highlightWordIdx;
          const shouldBold = isBold(partStart, partEnd);
          const normalizedPart = normalizeToken(part);
          const isSuccess = foundWordKeys.has(normalizedPart);
          const isReveal = revealedAnswers && correctWordKeySet.has(normalizedPart);
          displayCharPos = partEnd;

          // If it's just whitespace, return as-is
          if (/^\s+$/.test(part)) {
            return <span key={idx}>{part}</span>;
          }

          const classes = [
            shouldHighlight && "bg-yellow-300 dark:bg-yellow-500",
            shouldBold && "font-semibold",
            isSuccess && "bg-yellow-200/90 dark:bg-yellow-700/70 ring-2 ring-yellow-500 rounded-sm px-0.5 underline decoration-2 decoration-yellow-700 dark:decoration-yellow-200",
            isReveal && !isSuccess && "bg-amber-200 dark:bg-amber-700 ring-1 ring-amber-500 rounded-sm px-0.5",
            !disableWordTap && "cursor-pointer hover:opacity-70",
            "transition-all duration-75 ease-in-out",
          ]
            .filter(Boolean)
            .join(" ");

          // Get the timestamp index for this word from reverse map
          const timestampIdx = wordToTimestampMap.get(idx);

          return (
            <span 
              key={idx} 
              className={classes}
              style={getWordHuntHighlightStyle(isSuccess, isReveal)}
              onClick={() => {
                if (disableWordTap) return;
                if (handleWordTapForWordHunt(part)) {
                  return;
                }
                if (timestampIdx !== undefined && wordTimestamps[timestampIdx]) {
                  const audio = audioRef.current;
                  if (audio) {
                    audio.currentTime = wordTimestamps[timestampIdx].start;
                    // If not playing, start playback
                    if (!isPlayingAudio) {
                      onPlayPauseAudio();
                    }
                  }
                }
              }}
            >
              {part}
            </span>
          );
        })}
      </>
    );
  }, [wordTimestamps, currentPlaybackTime, settings.fontColor, isPlayingAudio, audioRef, onPlayPauseAudio, buildTimestampWordMap, handleWordTapForDefinition, handleWordTapForWordHunt, wordHuntMarkedIndexes, normalizeToken, foundWordKeys, revealedAnswers, correctWordKeySet, getWordHuntHighlightStyle, disableWordTap]);

  // Split text into paragraphs, breaking long ones if needed
  const splitIntoParagraphs = (text: string): string[] => {
    const MAX_CHARS_PER_PARAGRAPH = 1500;
    const paragraphs = text.split(/\n\n+/);
    const result: string[] = [];

    for (const para of paragraphs) {
      if (para.length <= MAX_CHARS_PER_PARAGRAPH) {
        result.push(para);
      } else {
        // Split long paragraphs by sentences
        const sentences = para.match(/[^.!?]+[.!?]+/g) || [para];
        let currentChunk = "";

        for (const sentence of sentences) {
          if ((currentChunk + sentence).length <= MAX_CHARS_PER_PARAGRAPH) {
            currentChunk += sentence;
          } else {
            if (currentChunk) result.push(currentChunk);
            currentChunk = sentence;
          }
        }
        if (currentChunk) result.push(currentChunk);
      }
    }

    return result.filter((p) => p.trim().length > 0);
  };

  const paragraphs = splitIntoParagraphs(displayText);
  const currentParagraph = paragraphs[currentParagraphIndex] || displayText;

  const handlePreviousParagraph = () => {
    setCurrentParagraphIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNextParagraph = () => {
    setCurrentParagraphIndex((prev) => Math.min(paragraphs.length - 1, prev + 1));
  };

  const showMediaPlayer = isLoadingAudio || isPlayingAudio || hasAudioLoaded;
  const isWordHuntMode = Boolean(wordHuntData);
  const isWordHuntComplete = correctWordKeySet.size > 0 && foundWordKeys.size >= correctWordKeySet.size;
  const shouldShowWordList = showWordList || revealedAnswers || isWordHuntComplete;

  return (
    <>
      <WordDefinitionPopover
        word={selectedWord || ""}
        contextSentence={selectedWordContext}
        textSettings={settings}
        isOpen={isPopoverOpen}
        onClose={() => {
          setIsPopoverOpen(false);
          setSelectedWordContext("");
        }}
      />
      <div
        className="flex flex-col h-screen w-screen"
        style={{ backgroundColor: settings.backgroundColor }}
      >
        <Header onBackClick={onBackClick} onSettingsClick={onSettingsClick} />

      {/* Text Content */}
      <div className="flex-1 overflow-auto p-6 sm:p-8 lg:p-12 flex flex-col items-start justify-start">
        {wordHuntData && (
          <WordHuntView
            wordHuntData={wordHuntData}
            foundCount={foundWordKeys.size}
            totalCount={correctWordKeySet.size}
            isPhonemeAudioPlaying={isPhonemeAudioPlaying}
            onPlaySound={playWordHuntAudio}
            shouldShowWordList={shouldShowWordList}
            onToggleWordList={() => setShowWordList((prev) => !prev)}
            foundWordKeys={foundWordKeys}
            revealedAnswers={revealedAnswers}
            correctWordKeySet={correctWordKeySet}
            normalizeToken={normalizeToken}
            feedback={wordHuntFeedback}
          />
        )}

        {isFormatting ? (
          <div className="flex items-center justify-center w-full h-full">
            <LoadingSpinner
              label="Formatting text…"
              size="md"
              color="blue"
            />
          </div>
        ) : isParagraphMode ? (
          <div className="w-full h-full flex flex-col">
            <TextViewBox
              style={{
                fontFamily: settings.fontFamily,
                fontSize: `${settings.fontSize}px`,
                color: settings.fontColor === "gradient" ? "#1a1a1a" : settings.fontColor,
                lineHeight: settings.lineSpacing,
                backgroundColor: settings.backgroundColor,
              }}
              className="text-base sm:text-lg lg:text-xl leading-relaxed flex-1 overflow-auto"
            >
              {parseTextWithHighlight(currentParagraph)}
            </TextViewBox>
            <div className="mt-6 text-sm font-medium" style={{ color: settings.fontColor === "gradient" ? "#1a1a1a" : settings.fontColor }}>
              Paragraph {currentParagraphIndex + 1} of {paragraphs.length}
            </div>
          </div>
        ) : (
          <TextViewBox
            style={{
              fontFamily: settings.fontFamily,
              fontSize: `${settings.fontSize}px`,
              color: settings.fontColor === "gradient" ? "#1a1a1a" : settings.fontColor,
              lineHeight: settings.lineSpacing,
              backgroundColor: settings.backgroundColor,
            }}
            className="text-base sm:text-lg lg:text-xl leading-relaxed overflow-auto"
          >
            {parseTextWithHighlight(displayText)}
          </TextViewBox>
        )}
      </div>

      {/* Footer Actions */}
      <div className="flex gap-4 p-6 bg-white dark:bg-slate-900 border-t-4 border-yellow-500 flex-wrap justify-center">
        {isWordHuntMode ? (
          <WordHuntActions
            isComplete={isWordHuntComplete}
            hasRevealedAnswers={revealedAnswers}
            loading={wordHuntLoading}
            isFormatting={isFormatting}
            hasData={Boolean(wordHuntData)}
            onRevealAnswers={revealAnswers}
            onSkipQuestion={skipQuestion}
            onNextQuestion={nextQuestion}
          />
        ) : showMediaPlayer && !isFormatting ? (
          <div className="flex gap-4 items-center flex-wrap justify-center">
            {isLoadingAudio ? (
              <div className="flex items-center gap-2">
                <LoadingSpinner size="sm" color="blue" />
              </div>
            ) : (
              <>
                <MediaPlayer
                  audioRef={audioRef}
                  isPlaying={isPlayingAudio}
                  onPlayPause={onPlayPauseAudio}
                  onStop={handleStop}
                />
                <div className="flex gap-2 items-center">
                  <button
                    onClick={handleSlowDown}
                    disabled={playbackSpeed <= 0.5}
                    className="px-2 py-1 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded transition-colors"
                  >
                    −
                  </button>
                  <div className="text-xs font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    {playbackSpeed.toFixed(2)}x speed
                  </div>
                  <button
                    onClick={handleSpeedUp}
                    disabled={playbackSpeed >= 2}
                    className="px-2 py-1 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded transition-colors"
                  >
                    +
                  </button>
                </div>
              </>
            )}
          </div>
        ) : isParagraphMode ? (
          <>
            <Button 
              onClick={() => {
                setIsParagraphMode(false);
                setCurrentParagraphIndex(0);
              }}
              icon={<FileTextIcon className="w-6 h-6" />}
            >
              Full text mode
            </Button>
            <Button
              onClick={handlePreviousParagraph}
              disabled={currentParagraphIndex === 0}
            >
              ← Previous
            </Button>
            <Button
              onClick={handleNextParagraph}
              disabled={currentParagraphIndex === paragraphs.length - 1}
            >
              Next →
            </Button>
          </>
        ) : (
          <>
            <Button 
              onClick={() => {
                setIsParagraphMode(true);
                setCurrentParagraphIndex(0);
              }}
              icon={<FileTextIcon className="w-6 h-6" />}
            >
              Paragraph mode
            </Button>
            <Button
              onClick={onListen}
              disabled={isFormatting}
              icon={<SpeakerLoudIcon className="w-6 h-6" />}
            >
              Listen
            </Button>
            <Button
              onClick={startWordHunt}
              disabled={wordHuntLoading || isFormatting}
              icon={<FileTextIcon className="w-6 h-6" />}
            >
              {wordHuntLoading ? "Preparing..." : "Word hunt"}
            </Button>
            <Button 
              onClick={onEditClick}
              icon={<Pencil2Icon className="w-6 h-6" />}
            >
              Edit
            </Button>
            {/* <Button icon={<BookmarkIcon className="w-6 h-6" />}>
              Notes
            </Button> */}
          </>
        )}
      </div>
    </div>
    </>
  );
};

export default TextView;
