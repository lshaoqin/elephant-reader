"use client";

import React, { useState, useRef, ReactNode, useMemo, useCallback } from "react";
import { StopIcon, PlayIcon } from "@radix-ui/react-icons";
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

// Detect iOS devices for speech recognition workarounds
const isIOS = (): boolean => {
  if (typeof window === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

// Detect Android devices
const isAndroid = (): boolean => {
  if (typeof window === 'undefined') return false;
  return /Android/i.test(navigator.userAgent);
};

// Detect mobile devices
const isMobile = (): boolean => {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
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
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const processedResultsRef = useRef<number>(0); // Track which results we've already processed
  const currentWordIndexRef = useRef<number>(0); // Ref to track current word index in callbacks
  const isListeningRef = useRef<boolean>(false); // Ref to track listening state in callbacks
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const [isMobileDevice] = useState(() => isMobile());
  const [isIOSDevice] = useState(() => isIOS());
  const [isAndroidDevice] = useState(() => isAndroid());

  // Keep the refs in sync with state
  React.useEffect(() => {
    currentWordIndexRef.current = currentWordIndex;
  }, [currentWordIndex]);

  React.useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

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
        setStatus("Speech Recognition not supported - Recording only mode");
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.language = "en-US";
      
      recognitionRef.current = recognition;
      setStatus("Ready to read");
    } catch (error) {
      setStatus("Speech recognition unavailable - Recording only mode");
      console.error(error);
    }
  }, []);

  // Cleanup audio URL and audio element on unmount
  React.useEffect(() => {
    return () => {
      if (audioURL) {
        URL.revokeObjectURL(audioURL);
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [audioURL]);

  // Start audio recording - returns the stream for use with speech recognition
  // Note: Recording is disabled on Android to avoid conflicts with speech recognition
  const startRecording = useCallback(async (): Promise<MediaStream | null> => {
    try {
      // Stop any existing stream first
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      
      // Skip recording on Android - only request permission
      if (isAndroid()) {
        console.log('Android detected - skipping audio recording to allow speech recognition');
        return stream;
      }
      
      // Check for supported MIME types on mobile
      let mimeType = 'audio/webm';
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
          mimeType = 'audio/ogg';
        }
      }
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(audioBlob);
        
        // Revoke old URL if exists
        if (audioURL) {
          URL.revokeObjectURL(audioURL);
        }
        
        setAudioURL(url);
        
        // Stop all tracks to release microphone
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach(track => track.stop());
          mediaStreamRef.current = null;
        }
      };

      mediaRecorder.start(1000); // Collect data every second for more reliable recording
      return stream;
    } catch (error) {
      console.error("Failed to start recording:", error);
      setStatus("Failed to access microphone");
      return null;
    }
  }, [audioURL]);

  // Stop audio recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  // Play recorded audio
  const playRecording = useCallback(() => {
    if (!audioURL) return;

    if (audioRef.current) {
      audioRef.current.pause();
    }

    const audio = new Audio(audioURL);
    audioRef.current = audio;
    
    audio.onplay = () => setIsPlaying(true);
    audio.onended = () => setIsPlaying(false);
    audio.onpause = () => setIsPlaying(false);
    
    audio.play();
  }, [audioURL]);

  // Stop playing recorded audio
  const stopPlayback = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
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

  // Ref to track if we should auto-stop (to avoid stopping multiple times)
  const shouldAutoStopRef = useRef<boolean>(false);

  const handleRecognitionResult = useCallback((event: SpeechRecognitionEvent) => {
    const results = event.results;
    console.log('Speech recognition result received:', results.length, 'results');
    
    // Process only new results
    for (let i = processedResultsRef.current; i < results.length; i++) {
      const result = results[i];
      const transcript = result[0].transcript.trim();
      console.log(`Result ${i}: "${transcript}" (final: ${result.isFinal})`);
      
      // Always update the recognized text to show what's being heard
      setRecognizedText(transcript);
      
      if (result.isFinal) {
        // Final result - update word position
        const spokenWords = transcript.split(/\s+/).filter(w => w.length > 0);
        const currentIdx = currentWordIndexRef.current;
        const matchedCount = findMatchingWords(spokenWords, currentIdx);
        console.log(`Matched ${matchedCount} words from position ${currentIdx}`);
        
        if (matchedCount > 0) {
          const newIndex = Math.min(currentIdx + matchedCount, words.length - 1);
          setCurrentWordIndex(newIndex);
          setStatus(`Recognized ${matchedCount} word(s). Now at word ${newIndex + 1}`);
          
          // Auto-stop when the last word is reached
          if (newIndex >= words.length - 1 && !shouldAutoStopRef.current) {
            shouldAutoStopRef.current = true;
            setStatus("Finished reading! Stopping...");
            // Use setTimeout to allow state updates to complete
            setTimeout(() => {
              setIsListening(false);
              isListeningRef.current = false;
              if (recognitionRef.current) {
                recognitionRef.current.onend = null;
                recognitionRef.current.onerror = null;
                recognitionRef.current.onresult = null;
                try {
                  recognitionRef.current.stop();
                } catch {
                  // Ignore errors when stopping
                }
              }
              if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
                mediaRecorderRef.current.stop();
              }
              setStatus("Finished reading! Recording saved.");
            }, 500);
          }
        }
        
        processedResultsRef.current = i + 1;
      }
    }
  }, [findMatchingWords, words.length]);

  const startListening = useCallback(async () => {
    // Check if speech recognition is available
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const hasSpeechRecognition = !!SpeechRecognition;
    
    // Stop any existing recognition if available
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.onerror = null;
      recognitionRef.current.onresult = null;
      try {
        recognitionRef.current.abort();
      } catch {
        // Ignore errors when aborting
      }
    }
    
    // Clear any pending restart timeout
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }

    // Reset state
    setCurrentWordIndex(0);
    currentWordIndexRef.current = 0;
    processedResultsRef.current = 0;
    setRecognizedText("");
    setStatus("Starting...");
    setIsListening(true);
    isListeningRef.current = true;
    
    // Clear previous recording and start new one
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (audioURL) {
      URL.revokeObjectURL(audioURL);
    }
    setAudioURL(null);
    setIsPlaying(false);
    shouldAutoStopRef.current = false;
    
    // Only create recognition instance if speech recognition is available
    let recognition: SpeechRecognitionInstance | null = null;
    if (hasSpeechRecognition) {
      recognition = new SpeechRecognition();
      // iOS Safari has issues with continuous mode - use non-continuous and restart manually
      // Android Chrome works fine with continuous mode
      recognition.continuous = !isIOSDevice;
      recognition.interimResults = true;
      recognition.language = "en-US";
      recognitionRef.current = recognition;
    }
    
    // On Android with speech recognition, start speech recognition FIRST before recording
    // This gives speech recognition priority access to the microphone
    if (isAndroidDevice && hasSpeechRecognition) {
      // On Android, just request permission without recording to avoid conflicts
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
        console.log('Android: Microphone permission granted, speech recognition will use it');
      } catch (error) {
        console.error("Failed to get microphone permission:", error);
        setStatus("Failed to access microphone");
        setIsListening(false);
        isListeningRef.current = false;
        return;
      }
      
      // Small delay to ensure microphone is fully initialized
      await new Promise(resolve => setTimeout(resolve, 200));
    } else {
      // On other platforms (or no speech recognition), start recording first
      const stream = await startRecording();
      
      if (!stream) {
        setIsListening(false);
        isListeningRef.current = false;
        return;
      }
      
      // Small delay to ensure microphone is fully initialized
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    // If no speech recognition, we're in recording-only mode
    if (!hasSpeechRecognition) {
      setStatus("Recording... (Speech recognition not available)");
      return;
    }

    recognition!.onstart = () => {
      console.log('Speech recognition started');
      if (isAndroidDevice) {
        setStatus("Listening... Start reading! (Recording disabled on Android)");
      } else {
        setStatus("Listening... Start reading!");
      }
    };

    recognition!.onresult = handleRecognitionResult;

    recognition!.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.log('Speech recognition error:', event.error);
      
      // Handle different error types
      switch (event.error) {
        case 'no-speech':
          // No speech detected - restart on mobile since it stops more frequently
          if (isMobileDevice && isListeningRef.current) {
            setStatus("No speech detected, still listening...");
            // Don't restart immediately, let onend handle it
          }
          break;
        case 'aborted':
          // User or system aborted - try to restart if still listening
          if (isListeningRef.current) {
            setStatus("Restarting...");
          }
          break;
        case 'audio-capture':
          setStatus("Microphone error - please check permissions");
          setIsListening(false);
          isListeningRef.current = false;
          break;
        case 'not-allowed':
          setStatus("Microphone access denied");
          setIsListening(false);
          isListeningRef.current = false;
          break;
        case 'network':
          setStatus("Network error - check your connection");
          // Try to restart after network error on mobile
          if (isMobileDevice && isListeningRef.current) {
            restartTimeoutRef.current = setTimeout(() => {
              if (isListeningRef.current && recognitionRef.current) {
                try {
                  recognitionRef.current.start();
                } catch {
                  // Ignore
                }
              }
            }, 1000);
          }
          break;
        default:
          setStatus(`Error: ${event.error}`);
          if (!isMobileDevice) {
            setIsListening(false);
            isListeningRef.current = false;
          }
      }
    };

    recognition!.onend = () => {
      // Auto-restart if still supposed to be listening (browser may stop after silence)
      // Use ref to get current value, not stale closure value
      if (isListeningRef.current && !shouldAutoStopRef.current) {
        // Add a small delay before restarting on mobile to avoid rapid restart loops
        const restartDelay = isMobileDevice ? 100 : 0;
        
        restartTimeoutRef.current = setTimeout(() => {
          if (isListeningRef.current && !shouldAutoStopRef.current) {
            setStatus("Listening... Continue reading!");
            try {
              // Create a new recognition instance for mobile to avoid stale state issues
              if (isMobileDevice) {
                const newRecognition = new SpeechRecognition();
                newRecognition.continuous = !isIOSDevice;
                newRecognition.interimResults = true;
                newRecognition.language = "en-US";
                newRecognition.onstart = recognition!.onstart;
                newRecognition.onresult = recognition!.onresult;
                newRecognition.onerror = recognition!.onerror;
                newRecognition.onend = recognition!.onend;
                recognitionRef.current = newRecognition;
                newRecognition.start();
              } else {
                recognition!.start();
              }
            } catch (e) {
              console.error('Failed to restart recognition:', e);
              setStatus("Tap to restart listening");
              setIsListening(false);
              isListeningRef.current = false;
            }
          }
        }, restartDelay);
      } else {
        setStatus(audioURL ? "Stopped - Recording saved!" : "Stopped");
      }
    };

    try {
      recognition!.start();
    } catch (error) {
      setStatus("Failed to start recognition");
      setIsListening(false);
      isListeningRef.current = false;
      console.error(error);
    }
  }, [handleRecognitionResult, audioURL, startRecording, isMobileDevice, isIOSDevice, isAndroidDevice]);

  const stopListening = useCallback(() => {
    setIsListening(false);
    isListeningRef.current = false;
    
    // Clear any pending restart timeout
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
    
    if (recognitionRef.current) {
      recognitionRef.current.onend = null; // Prevent auto-restart
      recognitionRef.current.onerror = null;
      recognitionRef.current.onresult = null;
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore errors when stopping
      }
    }
    
    // On Android, stop the media stream manually since we didn't use MediaRecorder
    if (isAndroidDevice && mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
      setStatus("Stopped!");
    } else {
      stopRecording();
      setStatus("Stopped - Recording saved!");
    }
  }, [stopRecording, isAndroidDevice]);

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
          
          // Check if reading is complete (at the last word and not listening)
          const isReadingComplete = currentWordIndex >= words.length - 1 && !isListening;
          const isCurrentWord = !isReadingComplete && thisWordIndex === currentWordIndex;
          const isReadWord = !isReadingComplete && thisWordIndex < currentWordIndex;

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
  }, [plainText, currentWordIndex, words.length, isListening]);

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
          <>
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
            
            {/* Playback controls - show when there's a recording */}
            {audioURL && (
              <>
                {!isPlaying ? (
                  <Button
                    onClick={playRecording}
                    icon={<PlayIcon className="w-6 h-6" />}
                  >
                    Play Recording
                  </Button>
                ) : (
                  <Button
                    onClick={stopPlayback}
                    icon={<StopIcon className="w-6 h-6" />}
                  >
                    Stop Playback
                  </Button>
                )}
              </>
            )}
          </>
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
