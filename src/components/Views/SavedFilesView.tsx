"use client";

import React from "react";
import { Header, LoadingSpinner } from "@/components";
import type { TextSettings } from "./SettingsView";
import type { SavedDocumentSummary } from "@/utils/firebase-user-files";

interface SavedFilesViewProps {
  files: SavedDocumentSummary[];
  loading: boolean;
  openingDocumentId?: string | null;
  phoneNumber?: string;
  settings: TextSettings;
  onBackClick: () => void;
  onSettingsClick: () => void;
  onOpenFile: (documentId: string) => void;
}

export const SavedFilesView: React.FC<SavedFilesViewProps> = ({
  files,
  loading,
  openingDocumentId,
  phoneNumber,
  settings,
  onBackClick,
  onSettingsClick,
  onOpenFile,
}) => {
  const [brokenPreviewIds, setBrokenPreviewIds] = React.useState<Set<string>>(new Set());
  const [loadedPreviewKeys, setLoadedPreviewKeys] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    const currentFileIds = new Set(files.map((file) => file.id));
    const currentPreviewKeys = new Set(
      files
        .filter((file) => !!file.previewImageUrl)
        .map((file) => `${file.id}:${file.previewImageUrl}`)
    );

    setBrokenPreviewIds((prev) => new Set(Array.from(prev).filter((id) => currentFileIds.has(id))));
    setLoadedPreviewKeys((prev) => new Set(Array.from(prev).filter((key) => currentPreviewKeys.has(key))));
  }, [files]);

  return (
    <div className="flex flex-col h-screen w-screen bg-white dark:bg-slate-950">
      <Header onBackClick={onBackClick} onSettingsClick={onSettingsClick} />

      <div className="flex-1 overflow-auto p-6 sm:p-8">
        <div className="max-w-6xl mx-auto">
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
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
              {files.map((item) => (
                (() => {
                  const previewKey = `${item.id}:${item.previewImageUrl || ""}`;
                  return (
                <button
                  key={item.id}
                  onClick={() => onOpenFile(item.id)}
                  disabled={!!openingDocumentId}
                  className="relative w-full max-w-[220px] mx-auto text-left border border-blue-200 dark:border-blue-800 rounded-xl overflow-hidden hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors disabled:opacity-80 disabled:cursor-not-allowed"
                >
                  <div className="flex flex-col">
                    <div
                      className="relative w-full min-h-[220px] border-b border-blue-200 dark:border-blue-800 overflow-hidden bg-gray-100 dark:bg-slate-800"
                      style={{ aspectRatio: "3 / 4" }}
                    >
                      {item.previewImageUrl && !brokenPreviewIds.has(item.id) ? (
                        <>
                          {!loadedPreviewKeys.has(previewKey) && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <LoadingSpinner label="" size="sm" color="blue" />
                            </div>
                          )}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={item.previewImageUrl}
                            alt="Saved document preview"
                            className={`w-full h-full object-contain transition-opacity duration-200 ${loadedPreviewKeys.has(previewKey) ? "opacity-100" : "opacity-0"}`}
                            onLoad={() => {
                              setLoadedPreviewKeys((prev) => {
                                const next = new Set(prev);
                                next.add(previewKey);
                                return next;
                              });
                            }}
                            onError={() => {
                              setLoadedPreviewKeys((prev) => {
                                const next = new Set(prev);
                                next.delete(previewKey);
                                return next;
                              });
                              setBrokenPreviewIds((prev) => new Set(prev).add(item.id));
                            }}
                          />
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                          No preview
                        </div>
                      )}
                    </div>
                    <div className="p-3 h-14 flex items-center">
                      <p
                        className="text-sm text-gray-600 dark:text-gray-400 truncate w-full"
                        style={{ fontFamily: settings.fontFamily }}
                        title={`${item.pageCount} page${item.pageCount === 1 ? "" : "s"} • Updated ${new Date(item.updatedAtMs).toLocaleString()}`}
                      >
                        {item.pageCount} page{item.pageCount === 1 ? "" : "s"} • Updated {new Date(item.updatedAtMs).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  {openingDocumentId === item.id && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/85 dark:bg-slate-900/85">
                      <LoadingSpinner label="Opening..." size="sm" color="blue" />
                    </div>
                  )}
                </button>
                  );
                })()
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SavedFilesView;
