/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useRef, ReactNode } from "react";
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
  results: any;
  isFinal?: boolean;
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

  // Extract words from HTML text
  const getWords = (): string[] => {
    // Remove HTML tags
    const plainText = displayText.replace(/<[^>]*>/g, "");
    // Split into words, keeping track of whitespace
    return plainText.split(/\s+/).filter((word) => word.length > 0);
  };

  const words = getWords();

  const handleRecognizedText = (text: string) => {
    const lowerText = text.toLowerCase();
    const currentWord = words[currentWordIndex]?.toLowerCase();

    setRecognizedText(text);

    if (currentWord && lowerText.includes(currentWord)) {
      // Word recognized, move to next
      setCurrentWordIndex((prev) => Math.min(prev + 1, words.length - 1));
      setStatus(`Recognized: "${currentWord}". Next word...`);
    }
  };

  const startListening = () => {
    if (!recognitionRef.current) {
      setStatus("Speech Recognition not available");
      return;
    }

    setCurrentWordIndex(0);
    setStatus("Listening...");
    setIsListening(true);

    recognitionRef.current.onstart = () => {
      setStatus("Listening...");
    };

    recognitionRef.current.onresult = (event: any) => {
      let interimTranscript = "";

      for (let i = event.results.length - 1; i >= 0; i--) {
        const transcript = event.results[i][0].transcript;

        if (event.results[i].isFinal) {
          handleRecognizedText(transcript);
        } else {
          interimTranscript += transcript;
        }
      }

      if (interimTranscript) {
        setRecognizedText(interimTranscript);
      }
    };

    recognitionRef.current.onerror = (event: any) => {
      setStatus(`Error: ${event.error}`);
      setIsListening(false);
    };

    recognitionRef.current.onend = () => {
      setStatus("Stopped");
      setIsListening(false);
    };

    recognitionRef.current.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
    setStatus("Stopped");
  };

  // Highlight current word in the text
  const renderTextWithHighlight = (): ReactNode => {
    const plainText = displayText.replace(/<[^>]*>/g, "");
    const wordList = plainText.split(/(\s+)/);

    let wordCounter = 0;

    return (
      <>
        {wordList.map((part, idx) => {
          if (/^\s+$/.test(part)) {
            return <span key={idx}>{part}</span>;
          }

          const isCurrentWord = wordCounter === currentWordIndex;
          const isReadWord = wordCounter < currentWordIndex;
          wordCounter++;

          const className = [
            isCurrentWord && "bg-yellow-300 font-bold",
            isReadWord && "opacity-50",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <span
              key={idx}
              className={className}
              style={{
                backgroundColor: isCurrentWord ? "#fbbf24" : "transparent",
                fontWeight: isCurrentWord ? "bold" : "normal",
                opacity: isReadWord ? 0.5 : 1,
              }}
            >
              {part}
            </span>
          );
        })}
      </>
    );
  };

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
          <Button
            onClick={stopListening}
            icon={<StopIcon className="w-6 h-6" />}
          >
            Stop
          </Button>
        )}
      </div>
    </div>
  );
};
