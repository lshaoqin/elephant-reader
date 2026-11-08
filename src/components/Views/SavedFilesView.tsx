"use client";

import React from "react";
import { Header, LoadingSpinner } from "@/components";
import type { TextSettings } from "./SettingsView";
import type { ReaderLanguage } from "@/utils/tts-language";
import type { SavedDocumentSummary } from "@/utils/firebase-user-files";

interface SavedFilesViewProps {
  files: SavedDocumentSummary[];
  loading: boolean;
  openingDocumentId?: string | null;
  phoneNumber?: string;
  onSignOut?: () => void;
  settings: TextSettings;
  onBackClick: () => void;
  onSettingsClick: () => void;
  onOpenFile: (documentId: string) => void;
  onDeleteFile: (documentId: string) => void;
  onDeleteFiles: (documentIds: string[]) => void;
  onReadingLanguageChange?: (language: ReaderLanguage) => void;
}

export const SavedFilesView: React.FC<SavedFilesViewProps> = ({
  files,
  loading,
  openingDocumentId,
  phoneNumber,
  onSignOut,
  settings,
  onBackClick,
  onSettingsClick,
  onOpenFile,
  onDeleteFile,
  onDeleteFiles,
  onReadingLanguageChange,
}) => {
  const [brokenPreviewIds, setBrokenPreviewIds] = React.useState<Set<string>>(new Set());
  const [loadedPreviewKeys, setLoadedPreviewKeys] = React.useState<Set<string>>(new Set());
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);
  const [sortBy, setSortBy] = React.useState<"updatedAtMs" | "createdAtMs">("updatedAtMs");
  const [isSelectionMode, setIsSelectionMode] = React.useState(false);
  const [selectedFileIds, setSelectedFileIds] = React.useState<Set<string>>(new Set());
  const [confirmDeleteIds, setConfirmDeleteIds] = React.useState<string[] | null>(null);

  const sortedFiles = React.useMemo(
    () => [...files].sort((a, b) => b[sortBy] - a[sortBy]),
    [files, sortBy]
  );

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

  const toggleSelectionMode = () => {
    setIsSelectionMode((prev) => !prev);
    setSelectedFileIds(new Set());
  };

  const toggleFileSelection = (id: string) => {
    setSelectedFileIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const exitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedFileIds(new Set());
  };

  React.useEffect(() => {
    if (files.length === 0 && isSelectionMode) {
      setIsSelectionMode(false);
      setSelectedFileIds(new Set());
    }
  }, [files.length, isSelectionMode]);

  return (
    <div className="flex flex-col h-screen w-screen bg-white dark:bg-slate-950">
      <Header onBackClick={onBackClick} onSettingsClick={onSettingsClick} fontFamily={settings.fontFamily} readingLanguage={settings.readingLanguage} onReadingLanguageChange={onReadingLanguageChange} />

      {/* Delete confirmation modal */}
      {confirmDeleteId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
          onClick={() => setConfirmDeleteId(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-8 max-w-sm w-full flex flex-col gap-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col gap-2">
              <h2
                className="text-2xl font-bold text-gray-900 dark:text-gray-100"
                style={{ fontFamily: settings.fontFamily }}
              >
                Delete file?
              </h2>
              <p
                className="text-base text-gray-600 dark:text-gray-400"
                style={{ fontFamily: settings.fontFamily }}
              >
                This cannot be undone.
              </p>
            </div>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 py-3 px-4 rounded-xl text-lg font-semibold bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                style={{ fontFamily: settings.fontFamily }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { onDeleteFile(confirmDeleteId); setConfirmDeleteId(null); }}
                className="flex-1 py-3 px-4 rounded-xl text-lg font-semibold bg-red-500 text-white hover:bg-red-600 transition-colors"
                style={{ fontFamily: settings.fontFamily }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch delete confirmation modal */}
      {confirmDeleteIds && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
          onClick={() => setConfirmDeleteIds(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-8 max-w-sm w-full flex flex-col gap-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col gap-2">
              <h2
                className="text-2xl font-bold text-gray-900 dark:text-gray-100"
                style={{ fontFamily: settings.fontFamily }}
              >
                Delete {confirmDeleteIds.length} file{confirmDeleteIds.length === 1 ? "" : "s"}?
              </h2>
              <p
                className="text-base text-gray-600 dark:text-gray-400"
                style={{ fontFamily: settings.fontFamily }}
              >
                This cannot be undone.
              </p>
            </div>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setConfirmDeleteIds(null)}
                className="flex-1 py-3 px-4 rounded-xl text-lg font-semibold bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                style={{ fontFamily: settings.fontFamily }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { onDeleteFiles(confirmDeleteIds); setConfirmDeleteIds(null); }}
                className="flex-1 py-3 px-4 rounded-xl text-lg font-semibold bg-red-500 text-white hover:bg-red-600 transition-colors"
                style={{ fontFamily: settings.fontFamily }}
              >
                Delete {confirmDeleteIds.length > 1 ? "all" : ""}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto p-6 sm:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <h1
              className="text-3xl font-bold text-blue-600"
              style={{ fontFamily: settings.fontFamily }}
            >
              My Files
            </h1>
            <button
              type="button"
              onClick={toggleSelectionMode}
              title={isSelectionMode ? "Done" : "Delete multiple"}
              aria-label={isSelectionMode ? "Done" : "Delete multiple"}
              className={`p-2 rounded-lg transition-colors ${
                isSelectionMode
                  ? "bg-blue-600 text-white"
                  : "bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-800"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <span className="text-sm text-gray-500 dark:text-gray-400" style={{ fontFamily: settings.fontFamily }}>Sort by:</span>
            <button
              type="button"
              onClick={() => setSortBy("updatedAtMs")}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                sortBy === "updatedAtMs"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600"
              }`}
              style={{ fontFamily: settings.fontFamily }}
            >
              Last modified
            </button>
            <button
              type="button"
              onClick={() => setSortBy("createdAtMs")}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                sortBy === "createdAtMs"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600"
              }`}
              style={{ fontFamily: settings.fontFamily }}
            >
              Date added
            </button>
          </div>
          {phoneNumber && (
            <button
              type="button"
              onClick={onSignOut}
              className="text-left text-sm text-gray-600 dark:text-gray-300 mb-6 hover:text-gray-900 dark:hover:text-gray-100"
              style={{ fontFamily: settings.fontFamily }}
            >
              Signed in as {phoneNumber} - 
              <span className="ml-1 underline decoration-2 underline-offset-4">Sign out</span>
            </button>
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
              {sortedFiles.map((item) => (
                (() => {
                  const previewKey = `${item.id}:${item.previewImageUrl || ""}`;
                  return (
                <div
                  key={item.id}
                  role={isSelectionMode ? "checkbox" : "button"}
                  aria-checked={isSelectionMode ? selectedFileIds.has(item.id) : undefined}
                  tabIndex={openingDocumentId ? -1 : 0}
                  onClick={() => {
                    if (openingDocumentId) return;
                    if (isSelectionMode) {
                      toggleFileSelection(item.id);
                    } else {
                      onOpenFile(item.id);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (openingDocumentId) return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (isSelectionMode) {
                        toggleFileSelection(item.id);
                      } else {
                        onOpenFile(item.id);
                      }
                    }
                  }}
                  className={`relative w-full max-w-[220px] mx-auto text-left border rounded-xl overflow-hidden transition-colors cursor-pointer select-none ${
                    openingDocumentId
                      ? "opacity-80 cursor-not-allowed border-blue-200 dark:border-blue-800"
                      : isSelectionMode
                        ? selectedFileIds.has(item.id)
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                          : "border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950"
                        : "border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950"
                  }`}
                >
                  <div className="flex flex-col">
                    <div
                      className={`relative w-full min-h-[220px] border-b overflow-hidden bg-gray-100 dark:bg-slate-800 ${
                        isSelectionMode ? "border-blue-300 dark:border-blue-700" : "border-blue-200 dark:border-blue-800"
                      }`}
                      style={{ aspectRatio: "3 / 4" }}
                    >
                      {isSelectionMode && (
                        <div className={`absolute top-2 left-2 z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors bg-white dark:bg-slate-900 ${
                          selectedFileIds.has(item.id)
                            ? "border-blue-500 bg-blue-500"
                            : "border-gray-400"
                        }`}>
                          {selectedFileIds.has(item.id) && (
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </div>
                      )}
                      {item.previewImageUrl && !brokenPreviewIds.has(item.id) ? (
                        <>
                          {!loadedPreviewKeys.has(previewKey) && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <LoadingSpinner label="" size="sm" color="blue" fontFamily={settings.fontFamily} />
                            </div>
                          )}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={item.previewImageUrl}
                            alt="Saved document preview"
                            loading="lazy"
                            decoding="async"
                            sizes="(max-width: 639px) 50vw, (max-width: 1023px) 33vw, (max-width: 1279px) 25vw, 16vw"
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
                      ) : item.previewText ? (
                        <div className="w-full h-full flex items-center justify-center p-3">
                          <p
                            className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-6"
                            style={{ fontFamily: settings.fontFamily }}
                          >
                            {item.previewText}
                          </p>
                        </div>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                          No preview
                        </div>
                      )}
                    </div>
                    <div className="p-2 flex items-start justify-between gap-1">
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <p
                          className="text-sm text-gray-600 dark:text-gray-400 truncate"
                          style={{ fontFamily: settings.fontFamily }}
                        >
                          {item.pageCount} page{item.pageCount === 1 ? "" : "s"}
                        </p>
                        <p
                          className="text-xs text-gray-500 dark:text-gray-500 truncate"
                          style={{ fontFamily: settings.fontFamily }}
                        >
                          {new Date(item[sortBy]).toLocaleString("en-GB", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      {isSelectionMode || confirmDeleteId === item.id ? null : (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(item.id); }}
                          disabled={!!openingDocumentId}
                          className="shrink-0 p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors disabled:opacity-50"
                          title="Delete file"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                            <path d="M10 11v6" />
                            <path d="M14 11v6" />
                            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                  {openingDocumentId === item.id && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/85 dark:bg-slate-900/85">
                      <LoadingSpinner label="Opening..." size="sm" color="blue" fontFamily={settings.fontFamily} />
                    </div>
                  )}
                </div>
                  );
                })()
              ))}
            </div>
          )}
          {isSelectionMode && selectedFileIds.size > 0 && (
            <div className="sticky bottom-0 mt-6 -mx-6 sm:-mx-8 px-6 sm:px-8 py-4 bg-white/95 dark:bg-slate-950/95 backdrop-blur-sm border-t border-gray-200 dark:border-gray-800 flex items-center justify-between gap-4">
              <span
                className="text-sm text-gray-600 dark:text-gray-400"
                style={{ fontFamily: settings.fontFamily }}
              >
                {selectedFileIds.size} file{selectedFileIds.size === 1 ? "" : "s"} selected
              </span>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={exitSelectionMode}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                  style={{ fontFamily: settings.fontFamily }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteIds(Array.from(selectedFileIds))}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-500 text-white hover:bg-red-600 transition-colors"
                  style={{ fontFamily: settings.fontFamily }}
                >
                  Delete ({selectedFileIds.size})
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SavedFilesView;
