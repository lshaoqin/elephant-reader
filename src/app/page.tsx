"use client";

import React, { useState, ReactNode } from "react";
import { UploadView, ImageView, TextView } from "@/components/Views";

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

type ViewMode = "upload" | "image" | "text";

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
  const audioRef = React.useRef<HTMLAudioElement>(null!);

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

    // Load audio from API
    setIsLoadingAudio(true);
    setError(null);

    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: displayText }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate audio");
      }

      const data = await response.json();
      
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
    } catch (err) {
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
          onBackClick={() => {
            setViewMode("image");
            setWordTimestamps([]);
            setCurrentPlaybackTime(0);
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

  return null;
}
