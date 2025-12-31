"use client";

import React, { useState, ReactNode } from "react";
import { UploadView, ImageView, TextView, SettingsView } from "@/components/Views";
import type { TextSettings } from "@/components/Views/SettingsView";

interface TextBlock {
  text: string;
  vertices: { x: number; y: number }[];
}

interface ExtractionResult {
  full_text: string;
  blocks: TextBlock[];
  image_base64: string;
}

interface ImageScale {
  width: number;
  height: number;
  naturalWidth?: number;
  naturalHeight?: number;
}

interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

type ViewMode = "upload" | "image" | "text" | "settings";

// Function to parse markdown formatting (**text** -> bold)
function parseMarkdownText(text: string): ReactNode {
  const parts: ReactNode[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add text before the bold part
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    // Add bold text
    parts.push(
      <strong key={`bold-${match.index}`}>{match[1]}</strong>
    );
    lastIndex = regex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

export default function Page() {
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBlockIndex, setSelectedBlockIndex] = useState<number | null>(
    null
  );
  const [imageScale, setImageScale] = useState<ImageScale>({ width: 0, height: 0 });
  const [viewMode, setViewMode] = useState<ViewMode>("upload");
  const [formattingBlockIndex, setFormattingBlockIndex] = useState<number | null>(null);
  const [formattedCache, setFormattedCache] = useState<Record<string, string>>({});
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [cachedAudioUrl, setCachedAudioUrl] = useState<string | null>(null);
  const [cachedAudioKey, setCachedAudioKey] = useState<string | null>(null);
  const [wordTimestamps, setWordTimestamps] = useState<WordTimestamp[]>([]);
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState(0);
  const [settings, setSettings] = useState<TextSettings>({
    fontFamily: "Verdana, Arial, Helvetica, sans-serif",
    fontSize: 20,
    fontColor: "#000000",
    lineSpacing: 1.5,
    backgroundColor: "#fffbeb",
  });
  const [previousViewMode, setPreviousViewMode] = useState<ViewMode>("upload");
  const audioRef = React.useRef<HTMLAudioElement>(null!);
  const ttsAbortControllerRef = React.useRef<AbortController | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setSelectedBlockIndex(null);
    setViewMode("upload");

    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch("/api/extract", {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }

      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
      // Clear audio cache when uploading new file
      setCachedAudioUrl(null);
      setCachedAudioKey(null);
      setViewMode("image");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    
    setImageScale({
      width: img.offsetWidth,
      height: img.offsetHeight,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
    });
  };

  const formatBlockText = async (blockIndex: number) => {
    if (!result) return;
    
    const cacheKey = `block-${blockIndex}`;
    
    // Check if already formatted
    if (formattedCache[cacheKey]) {
      setSelectedBlockIndex(blockIndex);
      // Clear audio cache when selecting new text block
      setCachedAudioUrl(null);
      setCachedAudioKey(null);
      setViewMode("text");
      return;
    }
    
    // Start formatting
    setFormattingBlockIndex(blockIndex);
    
    try {
      const rawText = result.blocks[blockIndex].text;
      
      const response = await fetch("/api/format-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: rawText }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to format text");
      }
      
      const data = await response.json();
      
      // Cache the formatted text
      setFormattedCache((prev) => ({
        ...prev,
        [cacheKey]: data.formatted_text,
      }));
      
      setSelectedBlockIndex(blockIndex);
      // Clear audio cache when selecting new text block
      setCachedAudioUrl(null);
      setCachedAudioKey(null);
      setViewMode("text");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setFormattingBlockIndex(null);
    }
  };

  const handleListen = async () => {
    const audioCacheKey = selectedBlockIndex !== null ? `block-${selectedBlockIndex}` : "full-text";
    const displayText = selectedBlockIndex !== null 
      ? formattedCache[`block-${selectedBlockIndex}`] || result?.blocks[selectedBlockIndex]?.text 
      : result?.full_text;

    if (!displayText) {
      setError("No text to listen to");
      return;
    }

    // If audio is already playing, toggle play/pause
    if (cachedAudioUrl && cachedAudioKey === audioCacheKey && audioRef.current) {
      if (isPlayingAudio) {
        audioRef.current.pause();
        setIsPlayingAudio(false);
      } else {
        audioRef.current.play();
        setIsPlayingAudio(true);
      }
      return;
    }

    // Load audio from API with streaming
    setIsLoadingAudio(true);
    setError(null);

    // Abort any previous TTS request
    if (ttsAbortControllerRef.current) {
      ttsAbortControllerRef.current.abort();
    }
    ttsAbortControllerRef.current = new AbortController();

    try {
      const response = await fetch("/api/tts", {
        signal: ttsAbortControllerRef.current.signal,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: displayText }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate audio");
      }

      // Handle streaming response with Server-Sent Events
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
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6);
            try {
              const data = JSON.parse(dataStr);

              if (data.error) {
                throw new Error(data.error);
              }

              if (data.status === "complete") {
                // Final response received
                // Decode base64 audio and create blob
                const binaryString = atob(data.audio);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                  bytes[i] = binaryString.charCodeAt(i);
                }
                const audioBlob = new Blob([bytes], { type: "audio/wav" });
                const audioUrl = URL.createObjectURL(audioBlob);

                // Cache the audio URL
                setCachedAudioUrl(audioUrl);
                setCachedAudioKey(audioCacheKey);

                // Store word timestamps if available
                if (data.timestamps) {
                  setWordTimestamps(data.timestamps);
                } else {
                  setWordTimestamps([]);
                }

                // Play audio
                if (audioRef.current) {
                  audioRef.current.src = audioUrl;
                  audioRef.current.play();
                  setIsPlayingAudio(true);
                }
              }
              // Otherwise, just a progress update - can be used for UI later
            } catch (parseErr) {
              console.error("Failed to parse SSE data:", parseErr);
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        console.log("TTS request was cancelled");
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setIsLoadingAudio(false);
    }
  };

  const handlePlayPauseAudio = () => {
    if (audioRef.current) {
      if (isPlayingAudio) {
        audioRef.current.pause();
        setIsPlayingAudio(false);
      } else {
        audioRef.current.play();
        setIsPlayingAudio(true);
      }
    }
  };

  const handleStopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlayingAudio(false);
      setCurrentPlaybackTime(0);
    }
  };

  // Upload View
  if (viewMode === "upload") {
    return (
      <UploadView
        loading={loading}
        error={error}
        onFileChange={handleFileChange}
      />
    );
  }

  // Image View
  if (viewMode === "image" && result) {
    return (
      <ImageView
        result={result}
        imageScale={imageScale}
        selectedBlockIndex={selectedBlockIndex}
        formattingBlockIndex={formattingBlockIndex}
        onBackClick={() => {
          // Abort any ongoing TTS request
          if (ttsAbortControllerRef.current) {
            ttsAbortControllerRef.current.abort();
          }
          setIsLoadingAudio(false);
          setViewMode("upload");
          // Clear audio cache when going back to upload
          setCachedAudioUrl(null);
          setCachedAudioKey(null);
        }}
        onImageLoad={handleImageLoad}
        onBlockClick={formatBlockText}
      />
    );
  }

  // Text View
  if (viewMode === "text" && result) {
    const cacheKey = selectedBlockIndex !== null ? `block-${selectedBlockIndex}` : null;
    const displayText = selectedBlockIndex !== null 
      ? formattedCache[cacheKey!] || result.blocks[selectedBlockIndex]?.text 
      : result.full_text;
    const isFormatting = formattingBlockIndex === selectedBlockIndex;

    return (
      <div>
        <TextView
          displayText={displayText}
          isFormatting={isFormatting}
          isLoadingAudio={isLoadingAudio}
          isPlayingAudio={isPlayingAudio}
          audioRef={audioRef}
          wordTimestamps={wordTimestamps}
          currentPlaybackTime={currentPlaybackTime}
          settings={settings}
          onBackClick={() => {
            // Abort any ongoing TTS request
            if (ttsAbortControllerRef.current) {
              ttsAbortControllerRef.current.abort();
            }
            // Stop and clear cached audio
            if (audioRef.current) {
              audioRef.current.pause();
              audioRef.current.currentTime = 0;
              audioRef.current.src = '';
            }
            setIsPlayingAudio(false);
            setIsLoadingAudio(false);
            setCachedAudioUrl(null);
            setCachedAudioKey(null);
            setViewMode("image");
            setWordTimestamps([]);
            setCurrentPlaybackTime(0);
          }}
          onSettingsClick={() => {
            setPreviousViewMode("text");
            setViewMode("settings");
          }}
          onListen={handleListen}
          onPlayPauseAudio={handlePlayPauseAudio}
          onStopAudio={handleStopAudio}
          parseMarkdownText={parseMarkdownText}
        />
        <audio 
          ref={audioRef} 
          onEnded={() => setIsPlayingAudio(false)}
          onTimeUpdate={(e) => setCurrentPlaybackTime(e.currentTarget.currentTime)}
        />
      </div>
    );
  }

  // Settings View
  if (viewMode === "settings") {
    return (
      <SettingsView
        settings={settings}
        onSettingsChange={setSettings}
        onBackClick={() => setViewMode(previousViewMode)}
      />
    );
  }

  return null;
}
