/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useRef, ReactNode, useMemo, useCallback, useEffect } from "react";
import { StopIcon, PlayIcon } from "@radix-ui/react-icons";
import { Header, Button, TextViewBox } from "@/components";
import type { TextSettings } from "./SettingsView";
import { io, Socket } from "socket.io-client";

interface ReadingViewProps {
  displayText: string;
  onBackClick: () => void;
  onSettingsClick: () => void;
  settings: TextSettings;
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
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const currentWordIndexRef = useRef<number>(0);
  const isListeningRef = useRef<boolean>(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const socketRef = useRef<Socket | null>(null);

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

  // Cleanup audio URL, audio element, and socket on unmount
  React.useEffect(() => {
    return () => {
      if (audioURL) {
        URL.revokeObjectURL(audioURL);
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [audioURL]);

  // Start audio recording with streaming speech recognition via WebSocket
  const startRecording = useCallback(async (): Promise<MediaStream | null> => {
    try {
      // Stop any existing stream first
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      
      // Check for supported MIME types
      let mimeType = 'audio/webm;codecs=opus';
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

      // Send audio chunks to WebSocket as they become available
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          
          // Send to WebSocket for streaming recognition
          if (socketRef.current && socketRef.current.connected) {
            event.data.arrayBuffer().then(buffer => {
              socketRef.current?.emit('audio_chunk', { audio: buffer });
            });
          }
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

      // Collect data every 250ms for low-latency streaming
      mediaRecorder.start(250);
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

  const stopListening = useCallback(() => {
    setIsListening(false);
    isListeningRef.current = false;
    
    // Stop WebSocket streaming
    if (socketRef.current) {
      socketRef.current.emit('stop_streaming');
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    
    // Stop recording
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    
    setStatus("Stopped - Recording saved!");
  }, []);

  // Process recognition results from WebSocket
  const processRecognitionResult = useCallback((result: any) => {
    if (!isListeningRef.current) return;

    if (result.error) {
      console.error('Speech recognition error:', result.error);
      return;
    }

    if (result.transcript) {
      // Try matching with all alternatives for better accuracy
      let bestMatchCount = 0;
      let bestNewIndex = currentWordIndexRef.current;
      let bestTranscript = result.transcript;
      const isFinal = result.is_final || false;

      // Try primary transcript first
      const primaryWords = result.transcript.split(/\s+/).filter((w: string) => w.length > 0);
      const currentIdx = currentWordIndexRef.current;
      const primaryMatchCount = findMatchingWords(primaryWords, currentIdx);
      
      if (primaryMatchCount > 0) {
        bestMatchCount = primaryMatchCount;
        bestNewIndex = Math.min(currentIdx + primaryMatchCount, words.length - 1);
      }

      // Try all alternative transcriptions to find the best match
      if (result.alternatives && result.alternatives.length > 0) {
        for (const alt of result.alternatives) {
          if (!alt.transcript) continue;
          
          const altWords = alt.transcript.split(/\s+/).filter((w: string) => w.length > 0);
          const altMatchCount = findMatchingWords(altWords, currentIdx);
          
          // Use this alternative if it matches more words
          if (altMatchCount > bestMatchCount) {
            bestMatchCount = altMatchCount;
            bestNewIndex = Math.min(currentIdx + altMatchCount, words.length - 1);
            bestTranscript = alt.transcript;
            console.log(`Better match found in alternative (confidence: ${alt.confidence}): ${altMatchCount} words`);
          }
        }
      }

      // Update with the best match found (only update position on final results)
      if (isFinal) {
        setRecognizedText(bestTranscript);
        
        if (bestMatchCount > 0) {
          setCurrentWordIndex(bestNewIndex);
          setStatus(`Reading... (${bestNewIndex + 1}/${words.length} words)`);
          
          // Auto-stop when finished
          if (bestNewIndex >= words.length - 1) {
            stopListening();
            setStatus("Finished reading! Recording saved.");
          }
        }
      } else {
        // Show interim results without updating position
        setRecognizedText(`${bestTranscript} [interim]`);
      }
    }
  }, [findMatchingWords, words.length, stopListening]);

  const startListening = useCallback(async () => {
    // Reset state
    setCurrentWordIndex(0);
    currentWordIndexRef.current = 0;
    setRecognizedText("");
    setStatus("Connecting...");
    setIsListening(true);
    isListeningRef.current = true;
    
    // Clear previous recording
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (audioURL) {
      URL.revokeObjectURL(audioURL);
    }
    setAudioURL(null);
    setIsPlaying(false);
    
    // Connect to WebSocket
    const backendUrl = process.env.NEXT_PUBLIC_PYTHON_BACKEND_URL || 'http://localhost:8080';
    const socket = io(backendUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
    });
    
    socketRef.current = socket;
    
    socket.on('connect', () => {
      console.log('WebSocket connected');
      setStatus("Starting...");
      
      // Start streaming session
      socket.emit('start_streaming', { sample_rate: 48000 });
    });
    
    socket.on('streaming_started', () => {
      console.log('Streaming started');
      setStatus("Listening... Start reading!");
    });
    
    socket.on('recognition_result', processRecognitionResult);
    
    socket.on('error', (error: any) => {
      console.error('WebSocket error:', error);
      setStatus(`Error: ${error.error || 'Unknown error'}`);
    });
    
    socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
    });
    
    // Wait for connection before starting recording
    socket.on('streaming_started', async () => {
      const stream = await startRecording();
      if (!stream) {
        setIsListening(false);
        isListeningRef.current = false;
        socket.disconnect();
      }
    });
    
  }, [startRecording, processRecognitionResult, audioURL]);

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
