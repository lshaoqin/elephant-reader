"use client";

import React, { useState, useEffect } from "react";
import { PlayIcon, PauseIcon } from "@radix-ui/react-icons";
import { Button } from "@/components";

interface MediaPlayerProps {
  audioRef: React.RefObject<HTMLAudioElement>;
  isPlaying: boolean;
  onPlayPause: () => void;
}

export const MediaPlayer: React.FC<MediaPlayerProps> = ({
  audioRef,
  isPlaying,
  onPlayPause,
}) => {
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const syncFromAudio = () => {
      const safeDuration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
      setDuration(safeDuration);
      setCurrentTime(audio.currentTime || 0);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleLoadedMetadata = () => {
      syncFromAudio();
    };

    const handleDurationChange = () => {
      syncFromAudio();
    };

    const handleCanPlay = () => {
      syncFromAudio();
    };

    syncFromAudio();

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("durationchange", handleDurationChange);
    audio.addEventListener("canplay", handleCanPlay);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("canplay", handleCanPlay);
    };
  }, [audioRef]);

  const formatTime = (time: number) => {
    if (!isFinite(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || duration === 0) return;

    const progressBar = e.currentTarget;
    const rect = progressBar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * duration;

    audio.currentTime = newTime;
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex flex-col gap-4 w-full max-w-md">
      {/* Progress Bar */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-400 min-w-10">
          {formatTime(currentTime)}
        </span>
        <div 
          className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden cursor-pointer hover:h-3 transition-all"
          onClick={handleProgressBarClick}
        >
          <div
            className="h-full bg-blue-500 transition-all pointer-events-none"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        <span className="text-xs font-medium text-slate-600 dark:text-slate-400 min-w-10 text-right">
          {formatTime(duration)}
        </span>
      </div>

      {/* Controls */}
      <div className="flex gap-2 justify-center items-center">
        <Button
          onClick={onPlayPause}
          icon={isPlaying ? <PauseIcon className="w-6 h-6" /> : <PlayIcon className="w-6 h-6" />}
        >
          {isPlaying ? "Pause" : "Play"}
        </Button>
      </div>
    </div>
  );
};

export default MediaPlayer;
