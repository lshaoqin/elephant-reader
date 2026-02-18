"use client";

import React from "react";
import { Header } from "@/components";
import type { TextSettings } from "./SettingsView";
import type { SavedDocumentSummary } from "@/utils/firebase-user-files";

interface SavedFilesViewProps {
  files: SavedDocumentSummary[];
  loading: boolean;
  phoneNumber?: string;
  settings: TextSettings;
  onBackClick: () => void;
  onSettingsClick: () => void;
  onOpenFile: (documentId: string) => void;
}

export const SavedFilesView: React.FC<SavedFilesViewProps> = ({
  files,
  loading,
  phoneNumber,
  settings,
  onBackClick,
  onSettingsClick,
  onOpenFile,
}) => {
  return (
    <div className="flex flex-col h-screen w-screen bg-white dark:bg-slate-950">
      <Header onBackClick={onBackClick} onSettingsClick={onSettingsClick} />

      <div className="flex-1 overflow-auto p-6 sm:p-8">
        <div className="max-w-3xl mx-auto">
          <h1
            className="text-3xl font-bold text-blue-600 mb-2"
            style={{ fontFamily: settings.fontFamily }}
          >
            My Files
          </h1>
          {phoneNumber && (
            <p
              className="text-sm text-gray-600 dark:text-gray-300 mb-6"
              style={{ fontFamily: settings.fontFamily }}
            >
              Signed in as {phoneNumber}
            </p>
          )}

          {loading ? (
            <p
              className="text-base text-gray-600 dark:text-gray-300"
              style={{ fontFamily: settings.fontFamily }}
            >
              Loading saved files...
            </p>
          ) : files.length === 0 ? (
            <p
              className="text-base text-gray-600 dark:text-gray-300"
              style={{ fontFamily: settings.fontFamily }}
            >
              No saved files yet.
            </p>
          ) : (
            <div className="space-y-3">
              {files.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onOpenFile(item.id)}
                  className="w-full text-left border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-28 h-20 rounded-md border border-blue-200 dark:border-blue-800 overflow-hidden bg-gray-100 dark:bg-slate-800 shrink-0">
                      {item.previewImageUrl ? (
                        <div
                          className="w-full h-full bg-cover bg-center"
                          style={{ backgroundImage: `url(${item.previewImageUrl})` }}
                          aria-label="Saved document preview"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-gray-500 dark:text-gray-400">
                          No preview
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p
                        className="font-semibold text-blue-700 dark:text-blue-300 truncate"
                        style={{ fontFamily: settings.fontFamily }}
                      >
                        {item.title}
                      </p>
                      <p
                        className="text-sm text-gray-600 dark:text-gray-400"
                        style={{ fontFamily: settings.fontFamily }}
                      >
                        {item.pageCount} page{item.pageCount === 1 ? "" : "s"} • Updated {new Date(item.updatedAtMs).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SavedFilesView;
