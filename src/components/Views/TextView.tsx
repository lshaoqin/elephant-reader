"use client";

import React, { ReactNode, useState, useEffect } from "react";
import {
  FileTextIcon,
  Share1Icon,
  SpeakerLoudIcon,
  Pencil2Icon,
  BookmarkIcon,
} from "@radix-ui/react-icons";
import { Button, Header, TextViewBox, LoadingSpinner, MediaPlayer } from "@/components";

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
  onListen: () => void;
  onPlayPauseAudio: () => void;
  onStopAudio: () => void;
  parseMarkdownText: (text: string) => ReactNode;
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
  onListen,
  onPlayPauseAudio,
  onStopAudio,
  parseMarkdownText,
}) => {
  const [hasAudioLoaded, setHasAudioLoaded] = useState(false);

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

  // Create a function to parse text with word highlighting
  const parseTextWithHighlight = (text: string): ReactNode => {
    if (!wordTimestamps || wordTimestamps.length === 0) {
      // If no timestamps, just use the markdown parser
      return parseMarkdownText(text);
    }

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

  const showMediaPlayer = isLoadingAudio || isPlayingAudio || hasAudioLoaded;

  return (
    <div className="flex flex-col h-screen w-screen bg-white dark:bg-slate-950">
      <Header onBackClick={onBackClick} />

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
        ) : (
          <TextViewBox className="text-base sm:text-lg lg:text-xl leading-relaxed">
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
            <Button icon={<FileTextIcon className="w-6 h-6" />}>
              Text-only mode
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
  );
};

export default TextView;
