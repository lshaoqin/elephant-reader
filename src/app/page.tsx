"use client";

import React, { useState, useEffect } from "react";
import { UploadView, SavedFilesView, ImageView, TextView, SettingsView, EditView } from "@/components/Views";
import type { TextSettings } from "@/components/Views/SettingsView";
import PhoneAuthView from "@/components/Auth/PhoneAuthView";
import { getFirebaseAuth } from "@/utils/firebase-client";
import { onIdTokenChanged } from "firebase/auth";
import type { User } from "firebase/auth";
import {
  listUserDocuments,
  loadUserDocument,
  saveUserDocument,
  deleteUserDocument,
  type SavedAudioEntry,
  type SavedDocumentSummary,
} from "@/utils/firebase-user-files";

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

type ViewMode = "upload" | "saved-files" | "image" | "text" | "settings" | "edit";

const DEFAULT_SETTINGS: TextSettings = {
  fontFamily: "var(--font-geist-sans), sans-serif",
  fontSize: 20,
  fontColor: "#1a1a1a",
  lineSpacing: 1.5,
  backgroundColor: "#fffef5",
};

function loadSettingsFromCookie(): TextSettings {
  if (typeof document === "undefined") return DEFAULT_SETTINGS;
  
  const cookie = document.cookie
    .split("; ")
    .find((row) => row.startsWith("textSettings="));
  
  if (!cookie) return DEFAULT_SETTINGS;
  
  try {
    const decoded = decodeURIComponent(cookie.substring("textSettings=".length));
    return JSON.parse(decoded);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettingsToCookie(settings: TextSettings) {
  if (typeof document === "undefined") return;
  
  const encoded = encodeURIComponent(JSON.stringify(settings));
  document.cookie = `textSettings=${encoded}; max-age=${60 * 60 * 24 * 365}; path=/`;
}

export default function Page() {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [savedFiles, setSavedFiles] = useState<SavedDocumentSummary[]>([]);
  const [savedFilesLoading, setSavedFilesLoading] = useState(false);
  const [openingSavedDocumentId, setOpeningSavedDocumentId] = useState<string | null>(null);
  const [activeSavedDocumentId, setActiveSavedDocumentId] = useState<string | null>(null);
  const [autosaveRetryTick, setAutosaveRetryTick] = useState(0);
  const [audioCacheStore, setAudioCacheStore] = useState<Record<string, SavedAudioEntry>>({});
  const [results, setResults] = useState<ExtractionResult[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [loadingFileCount, setLoadingFileCount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedBlockIndex, setSelectedBlockIndex] = useState<number | null>(
    null
  );
  const [imageScale, setImageScale] = useState<ImageScale>({ width: 0, height: 0 });
  const [viewMode, setViewMode] = useState<ViewMode>("upload");
  const [formattingBlockIndex, setFormattingBlockIndex] = useState<number | null>(null);
  const [formattedCache, setFormattedCache] = useState<Record<string, string>>({});
  const [formattedState, setFormattedState] = useState<Record<string, boolean>>({});
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [cachedAudioUrl, setCachedAudioUrl] = useState<string | null>(null);
  const [cachedAudioKey, setCachedAudioKey] = useState<string | null>(null);
  const [wordTimestamps, setWordTimestamps] = useState<WordTimestamp[]>([]);
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState(0);
  const [settings, setSettings] = useState<TextSettings>(DEFAULT_SETTINGS);
  const lastHighlightedWordRef = React.useRef<number>(-1);
  const [previousViewMode, setPreviousViewMode] = useState<ViewMode>("upload");
  const autosaveInFlightRef = React.useRef(false);
  const autosavePendingRef = React.useRef(false);
  const activeSavedDocumentIdRef = React.useRef<string | null>(null);
  const audioRef = React.useRef<HTMLAudioElement>(null!);
  const ttsAbortControllerRef = React.useRef<AbortController | null>(null);
  const extractionAbortControllerRef = React.useRef<AbortController | null>(null);
  const formattingAbortControllerRef = React.useRef<AbortController | null>(null);

  const safePlay = React.useCallback(async (audioElement: HTMLAudioElement): Promise<boolean> => {
    try {
      await audioElement.play();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message.toLowerCase() : String(err || "").toLowerCase();
      const isInterruptedPlay =
        message.includes("the play() request was interrupted") ||
        message.includes("interrupted by a call to pause");

      if (!isInterruptedPlay) {
        console.warn("Audio play failed:", err);
      }

      return false;
    }
  }, []);
  
  // Get current result based on page index
  const result = results[currentPageIndex] || null;

  // Load settings from cookie on mount
  useEffect(() => {
    const savedSettings = loadSettingsFromCookie();
    setSettings(savedSettings);
  }, []);

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      setError("Firebase Auth is not configured. Please set Firebase environment variables.");
      setAuthLoading(false);
      return;
    }

    const unsubscribe = onIdTokenChanged(auth, async (user: User | null) => {
      if (!user) {
        setFirebaseUser(null);
        setIsAuthenticated(false);
        await fetch("/api/auth/session", { method: "DELETE" });
        setAuthLoading(false);
        return;
      }

      try {
        const idToken = await user.getIdToken();
        const response = await fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        });

        if (!response.ok) {
          throw new Error("Failed to establish authenticated session");
        }
        setFirebaseUser(user);
        setIsAuthenticated(true);
      } catch (authErr) {
        const message = authErr instanceof Error ? authErr.message : String(authErr);
        setError(message);
        setIsAuthenticated(false);
      } finally {
        setAuthLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Save settings to cookie whenever they change
  useEffect(() => {
    saveSettingsToCookie(settings);
  }, [settings]);

  const isAuthError = React.useCallback((value: unknown) => {
    const message = value instanceof Error ? value.message : String(value || "");
    const normalized = message.toLowerCase();
    return (
      normalized.includes("invalid or expired token") ||
      normalized.includes("unauthorized") ||
      normalized.includes("401")
    );
  }, []);

  const refreshAuthSession = React.useCallback(async () => {
    const auth = getFirebaseAuth();
    const user = auth?.currentUser;
    if (!user) return false;

    try {
      const idToken = await user.getIdToken(true);
      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      return response.ok;
    } catch {
      return false;
    }
  }, []);

  const handleAuthExpired = React.useCallback(async () => {
    const auth = getFirebaseAuth();
    try {
      await fetch("/api/auth/session", { method: "DELETE" });
      await auth?.signOut();
    } catch {
      // ignore cleanup failures
    }

    setFirebaseUser(null);
    setIsAuthenticated(false);
    setActiveSavedDocumentId(null);
    setAudioCacheStore({});
    setFormattedCache({});
    setFormattedState({});
    setResults([]);
    setSavedFiles([]);
    setViewMode("upload");
    setError("Session expired. Please sign in again.");
  }, []);

  const withAuthRetry = React.useCallback(async <T,>(action: () => Promise<T>): Promise<T> => {
    try {
      return await action();
    } catch (err) {
      if (!isAuthError(err)) throw err;

      const refreshed = await refreshAuthSession();
      if (refreshed) {
        return await action();
      }

      await handleAuthExpired();
      throw new Error("Session expired. Please sign in again.");
    }
  }, [isAuthError, refreshAuthSession, handleAuthExpired]);

  // Upload files directly to the Python backend to bypass Vercel's 4.5 MB body limit.
  const uploadFileDirect = React.useCallback(async (
    path: string,
    formData: FormData,
    signal?: AbortSignal
  ): Promise<Response> => {
    const backendUrl = process.env.NEXT_PUBLIC_PYTHON_BACKEND_URL || "";
    const token = await firebaseUser!.getIdToken();
    let res = await fetch(`${backendUrl}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
      signal,
    });
    if (res.status === 401) {
      const freshToken = await firebaseUser!.getIdToken(true);
      res = await fetch(`${backendUrl}${path}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${freshToken}` },
        body: formData,
        signal,
      });
    }
    return res;
  }, [firebaseUser]);

  const handleOpenSavedFiles = async () => {
    if (!firebaseUser) return;

    setViewMode("saved-files");
    setSavedFilesLoading(true);
    setError(null);

    try {
      const items = await withAuthRetry(() => listUserDocuments());
      setSavedFiles(items);
    } catch (loadErr) {
      const message = loadErr instanceof Error ? loadErr.message : String(loadErr);
      setError(message);
    } finally {
      setSavedFilesLoading(false);
    }
  };

  const handleDeleteSavedFile = async (documentId: string) => {
    try {
      await withAuthRetry(() => deleteUserDocument({ documentId }));
      setSavedFiles((prev) => prev.filter((f) => f.id !== documentId));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    }
  };

  const handleLoadSavedFile = async (documentId: string) => {
    if (!firebaseUser || openingSavedDocumentId) return;

    setOpeningSavedDocumentId(documentId);
    setError(null);

    try {
      const payload = await withAuthRetry(() =>
        loadUserDocument({
          documentId,
        })
      );

      setResults(payload.results);
      setFormattedCache(payload.formattedCache || {});
      setFormattedState(
        payload.formattedState ||
          Object.keys(payload.formattedCache || {}).reduce((acc, key) => {
            acc[key] = true;
            return acc;
          }, {} as Record<string, boolean>)
      );
      setAudioCacheStore(payload.audioCache || {});
      setCurrentPageIndex(payload.currentPageIndex || 0);
      setSelectedBlockIndex(payload.selectedBlockIndex ?? null);
      setCachedAudioUrl(null);
      setCachedAudioKey(null);
      setWordTimestamps([]);
      setCurrentPlaybackTime(0);
      setImageScale({ width: 0, height: 0 });
      setActiveSavedDocumentId(documentId);
      setViewMode("image");
    } catch (loadErr) {
      const message = loadErr instanceof Error ? loadErr.message : String(loadErr);
      setError(message);
    } finally {
      setOpeningSavedDocumentId(null);
    }
  };

  useEffect(() => {
    activeSavedDocumentIdRef.current = activeSavedDocumentId;
  }, [activeSavedDocumentId]);

  useEffect(() => {
    if (!isAuthenticated || !firebaseUser || results.length === 0) {
      return;
    }

    const autosaveTimeout = window.setTimeout(async () => {
      if (autosaveInFlightRef.current) {
        autosavePendingRef.current = true;
        return;
      }

      autosaveInFlightRef.current = true;

      try {
        const documentId = await withAuthRetry(() =>
          saveUserDocument({
            existingDocumentId: activeSavedDocumentIdRef.current,
            title: results[0]?.full_text?.slice(0, 50)?.trim() || "Saved file",
            payload: {
              results,
              formattedCache,
              formattedState,
              audioCache: audioCacheStore,
              currentPageIndex,
              selectedBlockIndex,
              savedAt: new Date().toISOString(),
            },
          })
        );

        activeSavedDocumentIdRef.current = documentId;
        setActiveSavedDocumentId(documentId);
      } catch (saveErr) {
        console.error("Auto-save failed:", saveErr);
      } finally {
        autosaveInFlightRef.current = false;

        if (autosavePendingRef.current) {
          autosavePendingRef.current = false;
          setAutosaveRetryTick((prev) => prev + 1);
        }
      }
    }, 1200);

    return () => window.clearTimeout(autosaveTimeout);
  }, [
    isAuthenticated,
    firebaseUser,
    results,
    formattedCache,
    formattedState,
    audioCacheStore,
    currentPageIndex,
    selectedBlockIndex,
    activeSavedDocumentId,
    autosaveRetryTick,
    withAuthRetry,
  ]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Enforce maximum of 20 files
    if (files.length > 20) {
      setError("You can only upload up to 20 images at once");
      return;
    }

    setLoading(true);
    setLoadingFileCount(files.length);
    setError(null);
    setResults([]);
    setCurrentPageIndex(0);
    setSelectedBlockIndex(null);
    setViewMode("upload");
    setActiveSavedDocumentId(null);
    setAudioCacheStore({});
    setFormattedState({});

    // Abort any previous extraction request
    if (extractionAbortControllerRef.current) {
      extractionAbortControllerRef.current.abort();
    }
    extractionAbortControllerRef.current = new AbortController();

    try {
      // Use batch processing for multiple image files
      if (files.length > 1) {
        // Multiple files - check if all are images (not PDFs)
        const allImages = Array.from(files).every(f => 
          !f.name.toLowerCase().endsWith('.pdf')
        );
        
        if (!allImages) {
          throw new Error("When uploading multiple files, all must be images (no PDFs)");
        }
        
        const formData = new FormData();
        
        // Append all files
        for (let i = 0; i < files.length; i++) {
          formData.append("files", files[i]);
        }

        const extractionSignal = extractionAbortControllerRef.current?.signal;
        const res = await uploadFileDirect("/extract-batch", formData, extractionSignal);

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || res.statusText);
        }

        const data = await res.json();
        
        if (data.error) throw new Error(data.error);
        
        if (data.results && data.results.length > 0) {
          setResults(data.results);
          setCurrentPageIndex(0);
          
          // Show warning if there were any errors
          if (data.errors && data.errors.length > 0) {
            console.warn("Some files failed to process:", data.errors);
            setError(`Processed ${data.total} of ${files.length} images. ${data.errors.length} failed.`);
          }
        } else {
          throw new Error("No results returned from batch processing");
        }
      } else {
        // Single file - determine type and use appropriate endpoint
        const file = files[0];
        const isPdf = file.name.toLowerCase().endsWith('.pdf');
        const form = new FormData();
        form.append("file", file);

        const backendPath = isPdf ? "/extract-pdf" : "/extract";

        const extractionSignal = extractionAbortControllerRef.current?.signal;
        const res = await uploadFileDirect(backendPath, form, extractionSignal);

        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || res.statusText);
        }

        const data = await res.json();
        if (data.error) throw new Error(data.error);
        
        // PDF endpoint returns an array of results (one per page)
        // Regular image endpoint returns a single result
        if (isPdf) {
          if (data.results && data.results.length > 0) {
            setResults(data.results);
          } else {
            throw new Error("No pages extracted from PDF");
          }
        } else {
          setResults([data]);
        }
        setCurrentPageIndex(0);
      }
      
      // Clear audio cache when uploading new files
      setCachedAudioUrl(null);
      setCachedAudioKey(null);
      setViewMode("image");
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        console.log("Extraction was cancelled");
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
      setLoadingFileCount(0);
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

  const formatText = async (blockIndex: number | null) => {
    if (!result) return;
    
    const isFullText = blockIndex === null;
    const cacheKey = isFullText 
      ? `page-${currentPageIndex}-full-text`
      : `page-${currentPageIndex}-block-${blockIndex}`;
    
    // Check if already formatted - can go directly to text view
    if (formattedState[cacheKey] && formattedCache[cacheKey]) {
      setSelectedBlockIndex(blockIndex);
      setCachedAudioUrl(null);
      setCachedAudioKey(null);
      setViewMode("text");
      return;
    }
    
    // Start formatting - stay on image view with loading overlay
    setFormattingBlockIndex(isFullText ? -1 : blockIndex);
    
    // Abort any previous formatting request
    if (formattingAbortControllerRef.current) {
      formattingAbortControllerRef.current.abort();
    }
    formattingAbortControllerRef.current = new AbortController();
    
    try {
      const rawText = isFullText ? result.full_text : result.blocks[blockIndex].text;
      
      const formattingSignal = formattingAbortControllerRef.current?.signal;
      const response = await withAuthRetry(() =>
        fetch("/api/format-text", {
          signal: formattingSignal,
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: rawText }),
        })
      );
      
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
      setFormattedState((prev) => ({
        ...prev,
        [cacheKey]: true,
      }));
      
      // Clear formatting state and transition to text view only after success
      setFormattingBlockIndex(null);
      setSelectedBlockIndex(blockIndex);
      setCachedAudioUrl(null);
      setCachedAudioKey(null);
      setViewMode("text");
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        console.log("Formatting was cancelled");
        setFormattingBlockIndex(null);
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setFormattingBlockIndex(null);
    }
  };

  const formatBlockText = (blockIndex: number) => formatText(blockIndex);
  const formatFullText = () => formatText(null);

  const handleListen = async () => {
    const audioCacheKey = selectedBlockIndex !== null ? `page-${currentPageIndex}-block-${selectedBlockIndex}` : `page-${currentPageIndex}-full-text`;
    const displayText = selectedBlockIndex !== null 
      ? formattedCache[`page-${currentPageIndex}-block-${selectedBlockIndex}`] || result?.blocks[selectedBlockIndex]?.text 
      : result?.full_text;

    if (!displayText) {
      setError("No text to listen to");
      return;
    }

    // If matching cached audio exists, re-attach to current audio element and toggle play/pause
    if (cachedAudioUrl && cachedAudioKey === audioCacheKey && audioRef.current) {
      if (audioRef.current.src !== cachedAudioUrl) {
        audioRef.current.src = cachedAudioUrl;
      }
      if (isPlayingAudio) {
        audioRef.current.pause();
        setIsPlayingAudio(false);
      } else {
        const didPlay = await safePlay(audioRef.current);
        setIsPlayingAudio(didPlay);
      }
      return;
    }

    const cachedEntry = audioCacheStore[audioCacheKey];
    if (cachedEntry && cachedEntry.audioBase64) {
      const binaryString = atob(cachedEntry.audioBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const audioBlob = new Blob([bytes], { type: cachedEntry.audioMimeType || "audio/wav" });
      const audioUrl = URL.createObjectURL(audioBlob);

      setCachedAudioUrl(audioUrl);
      setCachedAudioKey(audioCacheKey);
      setWordTimestamps(cachedEntry.timestamps || []);

      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        const didPlay = await safePlay(audioRef.current);
        setIsPlayingAudio(didPlay);
      }
      return;
    }

    // Load audio from API
    setIsLoadingAudio(true);
    setError(null);

    // Abort any previous TTS request
    if (ttsAbortControllerRef.current) {
      ttsAbortControllerRef.current.abort();
    }
    ttsAbortControllerRef.current = new AbortController();

    try {
      // Remove HTML tags before sending to TTS
      const plainText = displayText.replace(/<[^>]*>/g, "");
      
      const ttsSignal = ttsAbortControllerRef.current?.signal;
      const response = await withAuthRetry(() =>
        fetch("/api/tts/google", {
          signal: ttsSignal,
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: plainText }),
        })
      );

      if (!response.ok) {
        throw new Error("Failed to generate audio");
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }

      if (data.status !== "complete" || !data.audio) {
        throw new Error("No audio returned from TTS service");
      }

      const audioMimeType = typeof data.audio_mime_type === "string" ? data.audio_mime_type : "audio/wav";

      const binaryString = atob(data.audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const audioBlob = new Blob([bytes], { type: audioMimeType });
      const audioUrl = URL.createObjectURL(audioBlob);

      // Cache the audio URL
      setCachedAudioUrl(audioUrl);
      setCachedAudioKey(audioCacheKey);

      setAudioCacheStore((prev) => ({
        ...prev,
        [audioCacheKey]: {
          audioBase64: data.audio,
          audioMimeType,
          timestamps: data.timestamps || [],
          sampleRate: data.sample_rate,
        },
      }));

      // Store word timestamps if available
      if (data.timestamps) {
        setWordTimestamps(data.timestamps);
      } else {
        setWordTimestamps([]);
      }

      // Play audio
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        const didPlay = await safePlay(audioRef.current);
        setIsPlayingAudio(didPlay);
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        console.log("TTS request was cancelled");
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setIsLoadingAudio(false);
    }
  };

  const handlePlayPauseAudio = async () => {
    if (audioRef.current) {
      if (isPlayingAudio) {
        audioRef.current.pause();
        setIsPlayingAudio(false);
      } else {
        const didPlay = await safePlay(audioRef.current);
        setIsPlayingAudio(didPlay);
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

  const handleCancelLoading = () => {
    if (extractionAbortControllerRef.current) {
      extractionAbortControllerRef.current.abort();
    }
    setLoading(false);
    setLoadingFileCount(0);
  };

  const handleCancelFormatting = () => {
    if (formattingAbortControllerRef.current) {
      formattingAbortControllerRef.current.abort();
    }
    setFormattingBlockIndex(null);
  };

  const getSettingsBackView = (): ViewMode => {
    if ((previousViewMode === "image" || previousViewMode === "text" || previousViewMode === "edit") && !result) {
      return "upload";
    }
    return previousViewMode;
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen w-screen items-center justify-center bg-white dark:bg-slate-950">
        <p className="text-lg font-semibold text-blue-600">Checking authentication...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <PhoneAuthView onAuthenticated={() => setIsAuthenticated(true)} />;
  }

  // Upload View
  if (viewMode === "upload") {
    return (
      <UploadView
        loading={loading}
        error={error}
        onFileChange={handleFileChange}
        loadingFileCount={loadingFileCount}
        onMyFilesClick={handleOpenSavedFiles}
        onWriteTextClick={() => {
          // Set up a minimal result structure to enable EditView
          setResults([{
            blocks: [{ text: "", vertices: [] }],
            full_text: "",
            image_base64: "",
          }]);
          setCurrentPageIndex(0);
          setSelectedBlockIndex(0);
          setActiveSavedDocumentId(null);
          setAudioCacheStore({});
          setFormattedCache({ "page-0-block-0": "" });
          setFormattedState({ "page-0-block-0": true });
          setViewMode("edit");
        }}
        settings={settings}
        onSettingsClick={() => {
          setPreviousViewMode("upload");
          setViewMode("settings");
        }}
        onCancelLoading={handleCancelLoading}
        authSection={
          firebaseUser?.phoneNumber ? (
            <p className="text-sm text-blue-700 dark:text-blue-300 text-center font-semibold">
              Signed in as {firebaseUser.phoneNumber}
            </p>
          ) : null
        }
      />
    );
  }

  if (viewMode === "saved-files") {
    return (
      <SavedFilesView
        files={savedFiles}
        loading={savedFilesLoading}
        openingDocumentId={openingSavedDocumentId}
        phoneNumber={firebaseUser?.phoneNumber || undefined}
        settings={settings}
        onBackClick={() => setViewMode("upload")}
        onSettingsClick={() => {
          setPreviousViewMode("saved-files");
          setViewMode("settings");
        }}
        onOpenFile={handleLoadSavedFile}
        onDeleteFile={handleDeleteSavedFile}
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
        settings={settings}
        currentPage={currentPageIndex + 1}
        totalPages={results.length}
        onNextPage={() => {
          if (currentPageIndex < results.length - 1) {
            setCurrentPageIndex(currentPageIndex + 1);
            setSelectedBlockIndex(null);
            setImageScale({ width: 0, height: 0 });
          }
        }}
        onPrevPage={() => {
          if (currentPageIndex > 0) {
            setCurrentPageIndex(currentPageIndex - 1);
            setSelectedBlockIndex(null);
            setImageScale({ width: 0, height: 0 });
          }
        }}
        onBackClick={() => {
          // Abort any ongoing requests
          if (ttsAbortControllerRef.current) {
            ttsAbortControllerRef.current.abort();
          }
          if (formattingAbortControllerRef.current) {
            formattingAbortControllerRef.current.abort();
          }
          
          // Clear ALL state to prevent caching issues
          setResults([]);
          setCurrentPageIndex(0);
          setSelectedBlockIndex(null);
          setImageScale({ width: 0, height: 0 });
          setFormattedCache({});
          setFormattedState({});
          setAudioCacheStore({});
          setActiveSavedDocumentId(null);
          setFormattingBlockIndex(null);
          setCachedAudioUrl(null);
          setCachedAudioKey(null);
          setWordTimestamps([]);
          setCurrentPlaybackTime(0);
          setIsLoadingAudio(false);
          setIsPlayingAudio(false);
          setError(null);
          
          // Stop and clear audio
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            audioRef.current.src = '';
          }
          
          setViewMode("upload");
        }}
        onSettingsClick={() => {
          setPreviousViewMode("image");
          setViewMode("settings");
        }}
        onImageLoad={handleImageLoad}
        onBlockClick={formatBlockText}
        onUseFullText={formatFullText}
        onCancelFormatting={handleCancelFormatting}
      />
    );
  }

  // Text View
  if (viewMode === "text" && result) {
    const cacheKey = selectedBlockIndex !== null 
      ? `page-${currentPageIndex}-block-${selectedBlockIndex}` 
      : `page-${currentPageIndex}-full-text`;
    const displayText = selectedBlockIndex !== null 
      ? formattedCache[cacheKey] || result.blocks[selectedBlockIndex]?.text 
      : formattedCache[cacheKey] || result.full_text;

    return (
      <div>
        <TextView
          displayText={displayText}
          isFormatting={false}
          isLoadingAudio={isLoadingAudio}
          isPlayingAudio={isPlayingAudio}
          audioRef={audioRef}
          wordTimestamps={wordTimestamps}
          currentPlaybackTime={currentPlaybackTime}
          settings={settings}
          onBackClick={() => {
            // Only warn if going back to upload view (no image means it's a written document)
            const goingToUpload = !result?.image_base64;
            if (goingToUpload) {
              const confirmed = window.confirm(
                "You will lose your document if you go back. Are you sure you want to continue?"
              );
              if (!confirmed) return;
            }
            
            // Abort any ongoing TTS request
            if (ttsAbortControllerRef.current) {
              ttsAbortControllerRef.current.abort();
            }
            // Stop and clear cached audio
            if (audioRef.current) {
              audioRef.current.pause();
              audioRef.current.currentTime = 0;
              audioRef.current.src = '';
            }
            setIsPlayingAudio(false);
            setIsLoadingAudio(false);
            setCachedAudioUrl(null);
            setCachedAudioKey(null);
            if (goingToUpload) {
              setFormattedState({});
              setAudioCacheStore({});
              setActiveSavedDocumentId(null);
            }
            // If there's no image (user wrote text directly), go to upload view
            setViewMode(result?.image_base64 ? "image" : "upload");
            setWordTimestamps([]);
            setCurrentPlaybackTime(0);
          }}
          onSettingsClick={() => {
            setPreviousViewMode("text");
            setViewMode("settings");
          }}
          onListen={handleListen}
          onPlayPauseAudio={handlePlayPauseAudio}
          onStopAudio={handleStopAudio}
          onEditClick={() => {
            setPreviousViewMode("text");
            setViewMode("edit");
          }}
        />
        <audio 
          ref={audioRef} 
          onEnded={() => setIsPlayingAudio(false)}
          onTimeUpdate={(e) => {
            const time = e.currentTarget.currentTime;
            // Only update if the highlighted word has changed
            const currentWordIdx = wordTimestamps.findIndex(
              (ts) => time >= ts.start && time < ts.end
            );
            if (currentWordIdx !== lastHighlightedWordRef.current) {
              lastHighlightedWordRef.current = currentWordIdx;
              setCurrentPlaybackTime(time);
            }
          }}
        />
      </div>
    );
  }

  // Settings View
  if (viewMode === "settings") {
    return (
      <SettingsView
        settings={settings}
        onSettingsChange={setSettings}
        onBackClick={() => setViewMode(getSettingsBackView())}
      />
    );
  }

  // Edit View
  if (viewMode === "edit" && result) {
    const cacheKey = selectedBlockIndex !== null ? `page-${currentPageIndex}-block-${selectedBlockIndex}` : null;
    const displayText = selectedBlockIndex !== null 
      ? formattedCache[cacheKey!] || result.blocks[selectedBlockIndex]?.text 
      : result.full_text;

    const handleEditSave = (editedText: string) => {
      const editedAudioCacheKey = selectedBlockIndex !== null
        ? `page-${currentPageIndex}-block-${selectedBlockIndex}`
        : `page-${currentPageIndex}-full-text`;

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current.src = "";
      }
      setIsPlayingAudio(false);
      setIsLoadingAudio(false);
      setCachedAudioUrl(null);
      setCachedAudioKey(null);
      setWordTimestamps([]);
      setCurrentPlaybackTime(0);
      lastHighlightedWordRef.current = -1;
      setAudioCacheStore((prev) => {
        if (!prev[editedAudioCacheKey]) return prev;
        const next = { ...prev };
        delete next[editedAudioCacheKey];
        return next;
      });

      // Update the formatted cache with the edited text
      if (selectedBlockIndex !== null) {
        const editedCacheKey = `page-${currentPageIndex}-block-${selectedBlockIndex}`;
        setFormattedCache((prev) => ({
          ...prev,
          [editedCacheKey]: editedText,
        }));
        setFormattedState((prev) => ({
          ...prev,
          [editedCacheKey]: true,
        }));
      } else {
        // For full text, we need to update the result's full_text
        const editedCacheKey = `page-${currentPageIndex}-full-text`;
        setFormattedCache((prev) => ({
          ...prev,
          [editedCacheKey]: editedText,
        }));
        setFormattedState((prev) => ({
          ...prev,
          [editedCacheKey]: true,
        }));
        setResults((prev) => {
          if (!prev || prev.length === 0) return prev;
          const updated = [...prev];
          updated[currentPageIndex] = {
            ...updated[currentPageIndex],
            full_text: editedText,
          };
          return updated;
        });
      }
      // Go back to text view
      setViewMode("text");
    };

    return (
      <EditView
        initialText={displayText}
        onBackClick={() => setViewMode("text")}
        onSave={handleEditSave}
        onSettingsClick={() => {
          setPreviousViewMode("edit");
          setViewMode("settings");
        }}
        settings={settings}
      />
    );
  }

}
