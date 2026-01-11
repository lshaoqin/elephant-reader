"use client";

import React from "react";
import {
  CameraIcon,
  UploadIcon,
  Pencil2Icon,
  GearIcon,
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
      <div className="flex-1 flex items-center justify-center">
        <main className="flex flex-col items-center justify-center gap-6 md:gap-12 px-6 max-w-2xl">
        <div className="text-center mb-2 md:mb-8">
          <h1
            className="text-3xl md:text-5xl font-bold mb-2 md:mb-4 text-blue-600"
            style={{ fontFamily: getFontFamily() }}
          >
            Make text friendlier
          </h1>
          <p
            className="text-base md:text-2xl text-gray-700 dark:text-gray-300"
            style={{ fontFamily: getFontFamily() }}
          >
            Take a photo of some text to make it friendlier
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 w-full max-w-2xl">
          <label className="flex flex-col items-center justify-center p-6 md:p-12 border-4 border-blue-600 rounded-xl cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors group">
            <CameraIcon className="w-16 md:w-24 h-16 md:h-24 mb-2 md:mb-4 text-blue-600 transition-colors" />
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

          <label className="flex flex-col items-center justify-center p-6 md:p-12 border-4 border-blue-600 rounded-xl cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors group">
            <UploadIcon className="w-16 md:w-24 h-16 md:h-24 mb-2 md:mb-4 text-blue-600 transition-colors" />
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

        <div className="flex flex-col items-center gap-4 w-full max-w-2xl">
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
          {onSettingsClick && (
            <button
              onClick={onSettingsClick}
              className="flex flex-row items-center justify-center gap-3 px-8 py-4 border-2 border-gray-400 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors w-full max-w-md"
            >
              <GearIcon className="w-6 h-6 text-gray-600 dark:text-gray-400 transition-colors" />
              <span
                className="font-semibold text-base text-gray-600 dark:text-gray-400"
                style={{ fontFamily: getFontFamily() }}
              >
                Settings
              </span>
            </button>
          )}
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
