"use client";

import React from "react";
import { LoadingSpinner, MediaPlayer } from "@/components";

interface ListenViewProps {
  isLoadingAudio: boolean;
  isPlayingAudio: boolean;
  audioRef: React.RefObject<HTMLAudioElement>;
  onPlayPauseAudio: () => void;
  playbackSpeed: number;
  onSlowDown: () => void;
  onSpeedUp: () => void;
}

export const ListenView: React.FC<ListenViewProps> = ({
  isLoadingAudio,
  isPlayingAudio,
  audioRef,
  onPlayPauseAudio,
  playbackSpeed,
  onSlowDown,
  onSpeedUp,
}) => {
  return (
    <div className="flex flex-col gap-4 items-center w-full">
      {isLoadingAudio ? (
        <div className="flex items-center gap-2">
          <LoadingSpinner size="sm" color="blue" />
        </div>
      ) : (
        <>
          <div className="flex gap-2 items-center justify-center w-full">
            <button
              onClick={onSlowDown}
              disabled={playbackSpeed <= 0.5}
              className="px-2 py-1 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded transition-colors"
            >
              −
            </button>
            <div className="text-xs font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">
              {playbackSpeed.toFixed(2)}x speed
            </div>
            <button
              onClick={onSpeedUp}
              disabled={playbackSpeed >= 2}
              className="px-2 py-1 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded transition-colors"
            >
              +
            </button>
          </div>

          <MediaPlayer
            audioRef={audioRef}
            isPlaying={isPlayingAudio}
            onPlayPause={onPlayPauseAudio}
          />
        </>
      )}
    </div>
  );
};

export default ListenView;
