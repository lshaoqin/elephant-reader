"use client";

import React, { useState, useRef, ReactNode, useMemo, useCallback } from "react";
import { StopIcon } from "@radix-ui/react-icons";
import { Header, Button, TextViewBox } from "@/components";
import type { TextSettings } from "./SettingsView";

interface ReadingViewProps {
  displayText: string;
  onBackClick: () => void;
  onSettingsClick: () => void;
  settings: TextSettings;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition: new () => SpeechRecognitionInstance;
  }
  interface SpeechRecognitionInstance {
    continuous: boolean;
    interimResults: boolean;
    language: string;
    start(): void;
    stop(): void;
    abort(): void;
    onstart: ((event: Event) => void) | null;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
    onend: ((event: Event) => void) | null;
  }
}

// Helper function to normalize a word for comparison (remove punctuation, lowercase)
const normalizeWord = (word: string): string => {
  return word.toLowerCase().replace(/[^\w']/g, "");
};

export const ReadingView: React.FC<ReadingViewProps> = ({
  displayText,
  onBackClick,
  onSettingsClick,
  settings,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [recognizedText, setRecognizedText] = useState("");
  const [status, setStatus] = useState("Ready to read");
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const processedResultsRef = useRef<number>(0); // Track which results we've already processed
  const currentWordIndexRef = useRef<number>(0); // Ref to track current word index in callbacks

  // Keep the ref in sync with state
  React.useEffect(() => {
    currentWordIndexRef.current = currentWordIndex;
  }, [currentWordIndex]);

  // Extract plain text and word list (memoized for consistency)
  const { plainText, words } = useMemo(() => {
    const text = displayText.replace(/<[^>]*>/g, "");
    const wordList = text.split(/\s+/).filter((word) => word.length > 0);
    return { plainText: text, words: wordList };
  }, [displayText]);

  // Initialize Web Speech API
  React.useEffect(() => {
    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        setStatus("Speech Recognition not supported in this browser");
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.language = "en-US";
      
      recognitionRef.current = recognition;
      setStatus("Ready to read");
    } catch (error) {
      setStatus("Failed to initialize speech recognition");
      console.error(error);
    }
  }, []);

  // Find matching words from speech in the text, starting from current position
  const findMatchingWords = useCallback((spokenWords: string[], startIndex: number): number => {
    let matchedCount = 0;
    
    for (const spokenWord of spokenWords) {
      const normalizedSpoken = normalizeWord(spokenWord);
      if (!normalizedSpoken) continue;
      
      const targetIndex = startIndex + matchedCount;
      if (targetIndex >= words.length) break;
      
      const normalizedTarget = normalizeWord(words[targetIndex]);
      
      // Check if the spoken word matches the expected word
      if (normalizedSpoken === normalizedTarget) {
        matchedCount++;
      } else {
        // Also check if it's a close match (for speech recognition errors)
        // Allow matching if the spoken word is very similar
        const isSimilar = 
          normalizedTarget.startsWith(normalizedSpoken) ||
          normalizedSpoken.startsWith(normalizedTarget) ||
          (normalizedSpoken.length > 2 && normalizedTarget.includes(normalizedSpoken));
        
        if (isSimilar) {
          matchedCount++;
        }
      }
    }
    
    return matchedCount;
  }, [words]);

  const handleRecognitionResult = useCallback((event: SpeechRecognitionEvent) => {
    const results = event.results;
    
    // Process only new results
    for (let i = processedResultsRef.current; i < results.length; i++) {
      const result = results[i];
      const transcript = result[0].transcript.trim();
      
      if (result.isFinal) {
        // Final result - update word position
        const spokenWords = transcript.split(/\s+/).filter(w => w.length > 0);
        const currentIdx = currentWordIndexRef.current;
        const matchedCount = findMatchingWords(spokenWords, currentIdx);
        
        if (matchedCount > 0) {
          const newIndex = Math.min(currentIdx + matchedCount, words.length - 1);
          setCurrentWordIndex(newIndex);
          setStatus(`Recognized ${matchedCount} word(s). Now at word ${newIndex + 1}`);
        }
        
        setRecognizedText(transcript);
        processedResultsRef.current = i + 1;
      } else {
        // Interim result - just display it
        setRecognizedText(transcript);
      }
    }
  }, [findMatchingWords, words.length]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) {
      setStatus("Speech Recognition not available");
      return;
    }

    // Reset state
    setCurrentWordIndex(0);
    currentWordIndexRef.current = 0;
    processedResultsRef.current = 0;
    setRecognizedText("");
    setStatus("Listening...");
    setIsListening(true);

    recognitionRef.current.onstart = () => {
      setStatus("Listening... Start reading!");
    };

    recognitionRef.current.onresult = handleRecognitionResult;

    recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
      setStatus(`Error: ${event.error}`);
      if (event.error !== 'no-speech') {
        setIsListening(false);
      }
    };

    recognitionRef.current.onend = () => {
      // Auto-restart if still supposed to be listening (browser may stop after silence)
      if (isListening) {
        setStatus("Restarting...");
        try {
          recognitionRef.current?.start();
        } catch {
          setStatus("Stopped");
          setIsListening(false);
        }
      } else {
        setStatus("Stopped");
      }
    };

    try {
      recognitionRef.current.start();
    } catch (error) {
      setStatus("Failed to start recognition");
      setIsListening(false);
      console.error(error);
    }
  }, [handleRecognitionResult, isListening]);

  const stopListening = useCallback(() => {
    setIsListening(false);
    if (recognitionRef.current) {
      recognitionRef.current.onend = null; // Prevent auto-restart
      recognitionRef.current.stop();
    }
    setStatus("Stopped");
  }, []);

  // Highlight current word in the text - using consistent word splitting
  const renderTextWithHighlight = useCallback((): ReactNode => {
    // Split text preserving whitespace for rendering
    const parts = plainText.split(/(\s+)/);
    
    let wordIndex = 0;

    return (
      <>
        {parts.map((part, idx) => {
          // If it's whitespace, render as-is
          if (/^\s+$/.test(part)) {
            return <span key={idx}>{part}</span>;
          }
          
          // Skip empty parts
          if (part.length === 0) {
            return null;
          }

          const thisWordIndex = wordIndex;
          wordIndex++;
          
          const isCurrentWord = thisWordIndex === currentWordIndex;
          const isReadWord = thisWordIndex < currentWordIndex;

          return (
            <span
              key={idx}
              onClick={() => {
                setCurrentWordIndex(thisWordIndex);
                setStatus(`Jumped to word ${thisWordIndex + 1}`);
              }}
              style={{
                backgroundColor: isCurrentWord ? "#fbbf24" : "transparent",
                opacity: isReadWord ? 0.5 : 1,
                transition: "all 0.15s ease-in-out",
                cursor: "pointer",
              }}
            >
              {part}
            </span>
          );
        })}
      </>
    );
  }, [plainText, currentWordIndex]);

  return (
    <div
      className="flex flex-col h-screen w-screen"
      style={{ backgroundColor: settings.backgroundColor }}
    >
      <Header onBackClick={onBackClick} onSettingsClick={onSettingsClick} />

      {/* Status display */}
      <div className="bg-blue-100 border-l-4 border-blue-500 p-4 text-blue-700">
        <p className="font-semibold">Status: {status}</p>
        {recognizedText && (
          <p className="text-sm mt-1">Recognized: &quot;{recognizedText}&quot;</p>
        )}
        <p className="text-sm mt-1">
          Word {currentWordIndex + 1} of {words.length}
        </p>
      </div>

      {/* Main text display with highlighting */}
      <div className="flex-1 overflow-auto p-6 sm:p-8 lg:p-12 flex flex-col items-start justify-start">
        <TextViewBox
          style={{
            fontFamily: settings.fontFamily,
            fontSize: `${settings.fontSize}px`,
            color: settings.fontColor === "gradient" ? "#1a1a1a" : settings.fontColor,
            lineHeight: settings.lineSpacing,
            backgroundColor: settings.backgroundColor,
          }}
        >
          {renderTextWithHighlight()}
        </TextViewBox>
      </div>

      {/* Control buttons */}
      <div className="flex gap-4 p-6 bg-white dark:bg-slate-900 border-t-4 border-blue-500 flex-wrap justify-center">
        {!isListening ? (
          <Button
            onClick={startListening}
            icon={
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 1a3 3 0 0 0-3 3v12a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12" y1="19" x2="12" y2="23"></line>
                <line x1="8" y1="23" x2="16" y2="23"></line>
              </svg>
            }
          >
            Start Reading
          </Button>
        ) : (
          <>
            <Button
              onClick={stopListening}
              icon={<StopIcon className="w-6 h-6" />}
            >
              Stop
            </Button>
            <Button
              onClick={() => {
                setCurrentWordIndex((prev) => Math.min(prev + 1, words.length - 1));
                setStatus(`Skipped word. Now at word ${currentWordIndex + 2}`);
              }}
              icon={
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="5 4 15 12 5 20 5 4"></polygon>
                  <line x1="19" y1="5" x2="19" y2="19"></line>
                </svg>
              }
            >
              Skip Word
            </Button>
          </>
        )}
      </div>
    </div>
  );
};
