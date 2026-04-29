"use client";

import React from "react";
import {
  CameraIcon,
  UploadIcon,
  FileTextIcon,
  Pencil2Icon,
  GearIcon,
  QuestionMarkCircledIcon,
} from "@radix-ui/react-icons";
import { LoadingSpinner, ViewBox, HelpPopover } from "@/components";
import type { TextSettings } from "./SettingsView";

interface UploadViewProps {
  loading: boolean;
  error: string | null;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onWriteTextClick: () => void;
  onMyFilesClick?: () => void;
  settings?: TextSettings;
  onSettingsClick?: () => void;
  loadingFileCount?: number;
  onCancelLoading?: () => void;
  authSection?: React.ReactNode;
}

export const UploadView: React.FC<UploadViewProps> = ({
  loading,
  error,
  onFileChange,
  onWriteTextClick,
  onMyFilesClick,
  settings,
  onSettingsClick,
  loadingFileCount = 0,
  onCancelLoading,
  authSection,
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
          <p
            className="text-sm md:text-base text-gray-500 dark:text-gray-400 mt-2"
            style={{ fontFamily: getFontFamily() }}
          >
            Upload up to 20 images or 1 PDF file
          </p>
        </div>

        <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 w-full max-w-2xl ${loading ? 'pointer-events-none opacity-50' : ''}`}>
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
              multiple
              onChange={onFileChange}
              className="hidden"
              max="20"
              disabled={loading}
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
              accept="image/*,.pdf"
              multiple
              onChange={onFileChange}
              className="hidden"
              max="20"
              disabled={loading}
            />
          </label>
        </div>

        <div className={`flex flex-col items-center gap-4 w-full max-w-2xl ${loading ? 'pointer-events-none opacity-50' : ''}`}>
          <button
            onClick={onWriteTextClick}
            disabled={loading}
            className="flex flex-row items-center justify-center gap-3 px-8 py-4 border-2 border-blue-400 rounded-lg cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors w-full max-w-md disabled:cursor-not-allowed"
          >
            <Pencil2Icon className="w-6 h-6 text-blue-600 transition-colors" />
            <span
              className="font-semibold text-base text-blue-600 dark:text-blue-400"
              style={{ fontFamily: getFontFamily() }}
            >
              Write text instead
            </span>
          </button>
          {onMyFilesClick && (
            <button
              onClick={onMyFilesClick}
              disabled={loading}
              className="flex flex-row items-center justify-center gap-3 px-8 py-4 border-2 border-blue-400 rounded-lg cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors w-full max-w-md disabled:cursor-not-allowed"
            >
              <FileTextIcon className="w-6 h-6 text-blue-600 transition-colors" />
              <span
                className="font-semibold text-base text-blue-600 dark:text-blue-400"
                style={{ fontFamily: getFontFamily() }}
              >
                My Files
              </span>
            </button>
          )}
          <div className="grid grid-cols-2 gap-4 w-full max-w-md">
            {onSettingsClick && (
              <button
                onClick={onSettingsClick}
                disabled={loading}
                className="flex flex-row items-center justify-center gap-2 md:gap-3 px-4 py-4 border-2 border-gray-400 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors w-full disabled:cursor-not-allowed"
              >
                <GearIcon className="w-5 h-5 md:w-6 md:h-6 text-gray-600 dark:text-gray-400 transition-colors" />
                <span
                  className="font-semibold text-sm md:text-base text-gray-600 dark:text-gray-400"
                  style={{ fontFamily: getFontFamily() }}
                >
                  Settings
                </span>
              </button>
            )}

            <HelpPopover>
              <button
                disabled={loading}
                className="flex flex-row items-center justify-center gap-2 md:gap-3 px-4 py-4 border-2 border-gray-400 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors w-full disabled:cursor-not-allowed"
              >
                <QuestionMarkCircledIcon className="w-5 h-5 md:w-6 md:h-6 text-gray-600 dark:text-gray-400 transition-colors" />
                <span
                  className="font-semibold text-sm md:text-base text-gray-600 dark:text-gray-400"
                  style={{ fontFamily: getFontFamily() }}
                >
                  Help
                </span>
              </button>
            </HelpPopover>
          </div>
        </div>
        {authSection && (
          <div className="w-full max-w-2xl">
            {authSection}
          </div>
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
      
      {/* Overlay Loading Spinner */}
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-6">
            <LoadingSpinner
              label={loadingFileCount > 1 
                ? `Processing ${loadingFileCount} images…` 
                : "Extracting and formatting text…"}
              size="lg"
              color="white"
            />
            {onCancelLoading && (
              <button
                onClick={onCancelLoading}
                className="px-6 py-3 border-2 border-blue-400 rounded-lg hover:bg-blue-400/10 text-white font-semibold transition-colors"
                style={{ fontFamily: getFontFamily() }}
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default UploadView;
