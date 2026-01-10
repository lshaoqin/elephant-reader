"use client";

import React from "react";
import {
  CameraIcon,
  UploadIcon,
  Pencil2Icon,
} from "@radix-ui/react-icons";
import { LoadingSpinner, ViewBox, Header } from "@/components";
import type { TextSettings } from "./SettingsView";

interface UploadViewProps {
  loading: boolean;
  error: string | null;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onWriteTextClick: () => void;
  settings?: TextSettings;
  onSettingsClick?: () => void;
}

export const UploadView: React.FC<UploadViewProps> = ({
  loading,
  error,
  onFileChange,
  onWriteTextClick,
  settings,
  onSettingsClick,
}) => {
  const getFontFamily = () => {
    if (!settings) return "var(--font-geist-sans), sans-serif";
    return settings.fontFamily;
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-white dark:bg-slate-950">
      {settings && onSettingsClick && (
        <Header onSettingsClick={onSettingsClick} hideBackButton />
      )}
      <div className="flex-1 flex items-center justify-center">
        <main className="flex flex-col items-center justify-center gap-12 px-6 max-w-2xl">
        <div className="text-center mb-8">
          <h1
            className="text-5xl font-bold mb-4 text-blue-600"
            style={{ fontFamily: getFontFamily() }}
          >
            Make text friendlier
          </h1>
          <p
            className="text-2xl text-gray-700 dark:text-gray-300"
            style={{ fontFamily: getFontFamily() }}
          >
            Take a photo of some text to make it friendlier
          </p>
        </div>

        <div className="grid grid-cols-2 gap-8 w-full max-w-2xl">
          <label className="flex flex-col items-center justify-center p-12 border-4 border-blue-600 rounded-xl cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors group">
            <CameraIcon className="w-24 h-24 mb-4 text-blue-600 transition-colors" />
            <span
              className="font-bold text-lg text-center text-blue-600 dark:text-blue-400"
              style={{ fontFamily: getFontFamily() }}
            >
              Take a photo
            </span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={onFileChange}
              className="hidden"
            />
          </label>

          <label className="flex flex-col items-center justify-center p-12 border-4 border-blue-600 rounded-xl cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors group">
            <UploadIcon className="w-24 h-24 mb-4 text-blue-600 transition-colors" />
            <span
              className="font-bold text-lg text-center text-blue-600 dark:text-blue-400"
              style={{ fontFamily: getFontFamily() }}
            >
              Upload from device
            </span>
            <input
              type="file"
              accept="image/*"
              onChange={onFileChange}
              className="hidden"
            />
          </label>
        </div>

        <div className="flex flex-col items-center gap-2 w-full max-w-2xl">
          <button
            onClick={onWriteTextClick}
            className="flex flex-row items-center justify-center gap-3 px-8 py-4 border-2 border-blue-400 rounded-lg cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors w-full max-w-md"
          >
            <Pencil2Icon className="w-6 h-6 text-blue-600 transition-colors" />
            <span
              className="font-semibold text-base text-blue-600 dark:text-blue-400"
              style={{ fontFamily: getFontFamily() }}
            >
              Write text instead
            </span>
          </button>
        </div>
        {loading && (
          <LoadingSpinner
            label="Extracting and formatting text…"
            size="md"
            color="blue"
          />
        )}
        {error && (
          <ViewBox variant="error" className="w-full max-w-xl">
            <p
              className="text-lg text-red-700 dark:text-red-300"
              style={{ fontFamily: getFontFamily() }}
            >
              Error: {error}
            </p>
          </ViewBox>
        )}
      </main>
      </div>
    </div>
  );
};

export default UploadView;
