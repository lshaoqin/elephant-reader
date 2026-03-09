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
  onDeleteFile: (documentId: string) => void;
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
  onDeleteFile,
}) => {
  const [brokenPreviewIds, setBrokenPreviewIds] = React.useState<Set<string>>(new Set());
  const [loadedPreviewKeys, setLoadedPreviewKeys] = React.useState<Set<string>>(new Set());
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);

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
                <div
                  key={item.id}
                  role="button"
                  tabIndex={openingDocumentId ? -1 : 0}
                  onClick={() => { if (!openingDocumentId) onOpenFile(item.id); }}
                  onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !openingDocumentId) onOpenFile(item.id); }}
                  className={`relative w-full max-w-[220px] mx-auto text-left border border-blue-200 dark:border-blue-800 rounded-xl overflow-hidden transition-colors cursor-pointer select-none ${openingDocumentId ? "opacity-80 cursor-not-allowed" : "hover:bg-blue-50 dark:hover:bg-blue-950"}`}
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
                          {new Date(item.updatedAtMs).toLocaleString("en-GB", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      {confirmDeleteId === item.id ? null : (
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
                      <LoadingSpinner label="Opening..." size="sm" color="blue" />
                    </div>
                  )}
                </div>
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
