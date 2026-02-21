"use client";

import React, { ReactNode, useState, useEffect } from "react";
import {
  FileTextIcon,
  SpeakerLoudIcon,
  Pencil2Icon,
  BookmarkIcon,
} from "@radix-ui/react-icons";
import { Button, Header, TextViewBox, LoadingSpinner, MediaPlayer, WordDefinitionPopover, GradientReader } from "@/components";
import type { TextSettings } from "./SettingsView";

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
  onReadClick: () => void;
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
  onReadClick,
}) => {
  const [hasAudioLoaded, setHasAudioLoaded] = useState(false);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [selectedWordContext, setSelectedWordContext] = useState<string>("");
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isParagraphMode, setIsParagraphMode] = useState(false);
  const [currentParagraphIndex, setCurrentParagraphIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

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
        // Apply gradient reading mode based on visual lines
        return (
          <GradientReader
            text={text}
            onWordClick={(word) => {
              setSelectedWord(word);
              setSelectedWordContext(getSentenceForWordFallback(plainText, word));
              setIsPopoverOpen(true);
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
            displayCharPos = partEnd;

            // If it's just whitespace, return as-is
            if (/^\s+$/.test(part)) {
              return <span key={idx}>{part}</span>;
            }

            const classes = [
              shouldBold && "font-semibold",
              "cursor-pointer hover:underline",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <span
                key={idx}
                className={classes}
                onClick={() => {
                  setSelectedWord(part);
                  setSelectedWordContext(getSentenceFromCharRange(plainText, partStart, partEnd));
                  setIsPopoverOpen(true);
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
          onWordClick={(_, wordIdx) => {
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
          displayCharPos = partEnd;

          // If it's just whitespace, return as-is
          if (/^\s+$/.test(part)) {
            return <span key={idx}>{part}</span>;
          }

          const classes = [
            shouldHighlight && "bg-yellow-300 dark:bg-yellow-500",
            shouldBold && "font-semibold",
            "cursor-pointer hover:opacity-70",
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
              onClick={() => {
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
  }, [wordTimestamps, currentPlaybackTime, settings.fontColor, isPlayingAudio, audioRef, onPlayPauseAudio, buildTimestampWordMap]);

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
        {showMediaPlayer && !isFormatting ? (
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
              onClick={onReadClick}
              icon={
                <img
                  src="/mic.svg"
                  alt="Read"
                  className="w-6 h-6"
                  style={{ filter: 'invert(38%) sepia(96%) saturate(2948%) hue-rotate(200deg) brightness(98%) contrast(101%)' }}
                  suppressHydrationWarning
                />
              }
            >
              Read
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
