"use client";

import React, { ReactNode, useState, useEffect } from "react";
import {
  FileTextIcon,
  Share1Icon,
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
  parseMarkdownText: (text: string) => ReactNode;
  settings: TextSettings;
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
  parseMarkdownText,
  settings,
}) => {
  const [hasAudioLoaded, setHasAudioLoaded] = useState(false);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isParagraphMode, setIsParagraphMode] = useState(false);
  const [currentParagraphIndex, setCurrentParagraphIndex] = useState(0);

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

  // Build a mapping of timestamp index to word index at the start
  const buildTimestampWordMap = (text: string): Map<number, number> => {
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
  };

  const textContainerRef = React.useRef<HTMLDivElement>(null);

  // Create a function to parse text with word highlighting
  const parseTextWithHighlight = (text: string): ReactNode => {
    if (!wordTimestamps || wordTimestamps.length === 0) {
      // Default mode: Parse markdown and make words clickable for definitions
      const displayText = text.replace(/\*\*/g, "");

      if (settings.fontColor === "gradient") {
        // Apply gradient reading mode based on visual lines
        return (
          <GradientReader
            text={displayText}
            onWordClick={(word) => {
              setSelectedWord(word);
              setIsPopoverOpen(true);
            }}
          />
        );
      }

      // Standard mode without gradient reading
      const words = displayText.split(/(\s+)/);
      
      // Build a map of which character ranges are bold (from markdown)
      const boldRanges: Array<{ start: number; end: number }> = [];
      const regex = /\*\*(.+?)\*\*/g;
      let match;
      while ((match = regex.exec(text)) !== null) {
        const starsBeforeBold = (text.substring(0, match.index).match(/\*\*/g) || []).length * 2;
        const displayStart = match.index - starsBeforeBold;
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
    // Remove ** markers to get display text
    const displayText = text.replace(/\*\*/g, "");

    // Build a map of which character ranges are bold (from markdown)
    const boldRanges: Array<{ start: number; end: number }> = [];
    const regex = /\*\*(.+?)\*\*/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      // Calculate the start and end positions in the display text (without **)
      const starsBeforeBold = (text.substring(0, match.index).match(/\*\*/g) || []).length * 2;
      const displayStart = match.index - starsBeforeBold;
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

    // Find the current timestamp index
    const currentTimestampIdx = wordTimestamps.findIndex(
      (ts) => currentPlaybackTime >= ts.start && currentPlaybackTime < ts.end
    );
    
    // Get the word index to highlight from our pre-built map
    const highlightWordIdx = timestampWordMap.get(currentTimestampIdx) ?? -1;

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
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <span key={idx} className={classes}>
              {part}
            </span>
          );
        })}
      </>
    );
  };

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
        isOpen={isPopoverOpen}
        onClose={() => setIsPopoverOpen(false)}
      />
      <div
        className="flex flex-col h-screen w-screen"
        style={{ backgroundColor: settings.backgroundColor }}
      >
        <Header onBackClick={onBackClick} onSettingsClick={onSettingsClick} />

      {/* Text Content */}
      <div className="flex-1 overflow-hidden p-6 sm:p-8 lg:p-12 flex flex-col items-start justify-start">
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
              className="text-base sm:text-lg lg:text-xl leading-relaxed flex-1 overflow-hidden"
            >
              {parseTextWithHighlight(currentParagraph)}
            </TextViewBox>
            {/* Paragraph Navigation */}
            <div className="flex items-center justify-between gap-4 mt-6">
              <button
                onClick={handlePreviousParagraph}
                disabled={currentParagraphIndex === 0}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors"
              >
                ← Previous
              </button>
              <span
                className="text-sm font-medium"
                style={{ color: settings.fontColor === "gradient" ? "#1a1a1a" : settings.fontColor }}
              >
                Paragraph {currentParagraphIndex + 1} of {paragraphs.length}
              </span>
              <button
                onClick={handleNextParagraph}
                disabled={currentParagraphIndex === paragraphs.length - 1}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors"
              >
                Next →
              </button>
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
            className="text-base sm:text-lg lg:text-xl leading-relaxed"
          >
            {parseTextWithHighlight(displayText)}
          </TextViewBox>
        )}
      </div>

      {/* Footer Actions */}
      <div className="flex gap-4 p-6 bg-white dark:bg-slate-900 border-t-4 border-yellow-500 flex-wrap justify-center">
        {showMediaPlayer && !isFormatting ? (
          <>
            {isLoadingAudio ? (
              <div className="flex items-center gap-2">
                <LoadingSpinner size="sm" color="blue" />
              </div>
            ) : (
              <MediaPlayer
                audioRef={audioRef}
                isPlaying={isPlayingAudio}
                onPlayPause={onPlayPauseAudio}
                onStop={onStopAudio}
              />
            )}
          </>
        ) : (
          <>
            <Button 
              onClick={() => {
                setIsParagraphMode(!isParagraphMode);
                setCurrentParagraphIndex(0);
              }}
              icon={<FileTextIcon className="w-6 h-6" />}
            >
              {isParagraphMode ? "Full text mode" : "Paragraph mode"}
            </Button>
            <Button icon={<Share1Icon className="w-6 h-6" />}>
              Share with others
            </Button>
            <Button
              onClick={onListen}
              disabled={isFormatting}
              icon={<SpeakerLoudIcon className="w-6 h-6" />}
            >
              Listen
            </Button>
            <Button
              icon={
                <img
                  src="/mic.svg"
                  alt="Read"
                  className="w-6 h-6"
                  suppressHydrationWarning
                />
              }
            >
              Read
            </Button>
            <Button icon={<Pencil2Icon className="w-6 h-6" />}>
              Edit
            </Button>
            <Button icon={<BookmarkIcon className="w-6 h-6" />}>
              Notes
            </Button>
          </>
        )}
      </div>
    </div>
    </>
  );
};

export default TextView;
