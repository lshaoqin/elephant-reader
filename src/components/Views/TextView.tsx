"use client";

import React, { ReactNode, useState, useEffect, useCallback, CSSProperties } from "react";
import {
  FileTextIcon,
  SpeakerLoudIcon,
  Pencil2Icon,
} from "@radix-ui/react-icons";
import { Button, Header, TextViewBox, LoadingSpinner, WordDefinitionPopover, GradientReader } from "@/components";
import ListenView from "./ListenView";
import { buildWordHuntQuestionPool } from "@/components/WordHunt/questionPool";
import type { WordHuntData } from "@/components/WordHunt/types";
import type { TextSettings } from "./SettingsView";
import { getQuestionAwareTipMessage, getTapSuccessMessage, WordHuntView } from "./WordHuntView";
import { getFirebaseAuth } from "@/utils/firebase-client";
import { getTtsVoiceConfig, type ReaderLanguage } from "@/utils/tts-language";

interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

interface WordHuntWordAudio {
  audio: string;
  sample_rate: number;
  audio_mime_type?: string;
}

interface TextViewProps {
  displayText: string;
  isFormatting: boolean;
  isLoadingAudio: boolean;
  isPlayingAudio: boolean;
  audioRef: React.RefObject<HTMLAudioElement>;
  wordTimestamps: WordTimestamp[];
  currentPlaybackTime: number;
  onBackClick: () => void;
  onSettingsClick: () => void;
  onListen: () => void;
  onPlayPauseAudio: () => void;
  onStopAudio: () => void;
  settings: TextSettings;
  onEditClick: () => void;
  onSavedWordsClick?: () => void;
  onReadingLanguageChange?: (language: ReaderLanguage) => void;
}

export const TextView: React.FC<TextViewProps> = ({
  displayText,
  isFormatting,
  isLoadingAudio,
  isPlayingAudio,
  audioRef,
  wordTimestamps,
  currentPlaybackTime,
  onBackClick,
  onSettingsClick,
  onListen,
  onPlayPauseAudio,
  onStopAudio,
  settings,
  onEditClick,
  onSavedWordsClick,
  onReadingLanguageChange,
}) => {
  type WordHuntMode = "pattern" | "vocabulary";

  const [hasAudioLoaded, setHasAudioLoaded] = useState(false);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [selectedWordContext, setSelectedWordContext] = useState<string>("");
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isParagraphMode, setIsParagraphMode] = useState(false);
  const [isListeningMode, setIsListeningMode] = useState(false);
  const [currentParagraphIndex, setCurrentParagraphIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [wordHuntData, setWordHuntData] = useState<WordHuntData | null>(null);
  const [wordHuntLoading, setWordHuntLoading] = useState(false);
  const [wordHuntFeedback, setWordHuntFeedback] = useState<string | null>(null);
  const [foundWordKeys, setFoundWordKeys] = useState<Set<string>>(new Set());
  const [revealedAnswers, setRevealedAnswers] = useState(false);
  const [showWordList, setShowWordList] = useState(false);
  const [currentWordHuntQuestionIndex, setCurrentWordHuntQuestionIndex] = useState(0);
  const [activeWordHuntQuestions, setActiveWordHuntQuestions] = useState<WordHuntData[]>([]);
  const [selectedWordHuntMode, setSelectedWordHuntMode] = useState<WordHuntMode>("pattern");
  const [isPhonemeAudioPlaying, setIsPhonemeAudioPlaying] = useState(false);
  const [wordHuntWordAudioCache, setWordHuntWordAudioCache] = useState<Record<string, WordHuntWordAudio>>({});
  const wordHuntAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const textContentRef = React.useRef<HTMLDivElement | null>(null);
  const vocabularyExcludedWordsRef = React.useRef<Set<string>>(new Set());

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const syncLoadedState = () => {
      const hasSrc = Boolean(audio.src);
      const hasDuration = Number.isFinite(audio.duration) && audio.duration > 0;
      const hasReadyState = audio.readyState > 0;
      const hasProgress = audio.currentTime > 0;
      setHasAudioLoaded(hasSrc && (hasDuration || hasReadyState || hasProgress));
    };

    const handleEmptied = () => {
      setHasAudioLoaded(false);
    };

    syncLoadedState();

    audio.addEventListener("loadedmetadata", syncLoadedState);
    audio.addEventListener("durationchange", syncLoadedState);
    audio.addEventListener("canplay", syncLoadedState);
    audio.addEventListener("play", syncLoadedState);
    audio.addEventListener("pause", syncLoadedState);
    audio.addEventListener("timeupdate", syncLoadedState);
    audio.addEventListener("emptied", handleEmptied);

    return () => {
      audio.removeEventListener("loadedmetadata", syncLoadedState);
      audio.removeEventListener("durationchange", syncLoadedState);
      audio.removeEventListener("canplay", syncLoadedState);
      audio.removeEventListener("play", syncLoadedState);
      audio.removeEventListener("pause", syncLoadedState);
      audio.removeEventListener("timeupdate", syncLoadedState);
      audio.removeEventListener("emptied", handleEmptied);
    };
  }, [audioRef]);

  const handleSpeedUp = () => {
    const newSpeed = Math.min(playbackSpeed + 0.25, 2);
    setPlaybackSpeed(newSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = newSpeed;
    }
  };

  const handleSlowDown = () => {
    const newSpeed = Math.max(playbackSpeed - 0.25, 0.5);
    setPlaybackSpeed(newSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = newSpeed;
    }
  };

  const handleListen = useCallback(() => {
    setIsListeningMode(true);
    onListen();
  }, [onListen]);

  const normalizeToken = useCallback((value: string): string =>
    value.toLowerCase().replace(/[^\w']/g, ""), []);

  const getWordHuntHighlightStyle = useCallback((
    isSuccess: boolean,
    isReveal: boolean,
    isHint: boolean,
    isHintStart = false,
    isHintEnd = false
  ): CSSProperties | undefined => {
    if (isSuccess) {
      return {
        backgroundColor: "#86efac",
        boxShadow: "inset 0 0 0 2px #16a34a",
        borderRadius: "0.2rem",
      };
    }

    if (isReveal) {
      return {
        backgroundColor: "#c7d2fe",
        boxShadow: "inset 0 0 0 1px #6366f1",
        borderRadius: "0.2rem",
      };
    }

    if (isHint) {
      return {
        backgroundColor: "#bfdbfe",
        borderTopLeftRadius: isHintStart ? "0.2rem" : 0,
        borderBottomLeftRadius: isHintStart ? "0.2rem" : 0,
        borderTopRightRadius: isHintEnd ? "0.2rem" : 0,
        borderBottomRightRadius: isHintEnd ? "0.2rem" : 0,
      };
    }

    return undefined;
  }, []);

  const correctWordKeySet = React.useMemo(() => {
    if (!wordHuntData?.correct_words?.length) return new Set<string>();
    return new Set(wordHuntData.correct_words.map((word) => normalizeToken(word)).filter(Boolean));
  }, [wordHuntData, normalizeToken]);

  const wordHuntQuestionPool = React.useMemo<WordHuntData[]>(() => {
    return buildWordHuntQuestionPool(displayText, normalizeToken);
  }, [displayText, normalizeToken]);

  const getPatternHintLineIndexes = useCallback((text: string, correctWords: string[]): number[] => {
    const normalizedTargets = new Set(
      correctWords.map((word) => normalizeToken(word)).filter((word) => word.length > 0)
    );
    if (!normalizedTargets.size) return [];

    const lines = text.replace(/<b>|<\/b>/g, "").split(/\n/);
    const lineIndexes = new Set<number>();

    lines.forEach((line, lineIndex) => {
      const tokens = line.split(/(\s+)/);
      for (const token of tokens) {
        if (/^\s+$/.test(token) || !token.trim()) continue;
        if (normalizedTargets.has(normalizeToken(token))) {
          lineIndexes.add(lineIndex);
        }
      }
    });

    return Array.from(lineIndexes);
  }, [normalizeToken]);

  const wordHuntHintLineIndexSet = React.useMemo(() => {
    if (!wordHuntData) return new Set<number>();
    const hintLineIndexes = wordHuntData.hint_line_indexes?.length
      ? wordHuntData.hint_line_indexes
      : wordHuntData.mode === "pattern"
        ? getPatternHintLineIndexes(displayText, wordHuntData.correct_words)
        : [];

    return new Set(hintLineIndexes.filter((value) => Number.isInteger(value) && value >= 0));
  }, [displayText, getPatternHintLineIndexes, wordHuntData]);

  const disableWordTap = Boolean(wordHuntData) && revealedAnswers;

  const wordHuntMarkedIndexes = useCallback((plainText: string) => {
    const successIndexes = new Set<number>();
    const revealIndexes = new Set<number>();
    const hintIndexes = new Set<number>();
    let currentLineIndex = 0;

    const tokens = plainText.split(/(\s+)/).filter((token) => token.length > 0);
    tokens.forEach((token, index) => {
      if (/^\s+$/.test(token)) {
        const hasLineBreak = token.includes("\n");
        if (wordHuntHintLineIndexSet.has(currentLineIndex) && !hasLineBreak) {
          hintIndexes.add(index);
        }
        currentLineIndex += (token.match(/\n/g) || []).length;
        return;
      }

      const normalized = normalizeToken(token);
      if (!normalized) return;

      if (foundWordKeys.has(normalized)) {
        successIndexes.add(index);
      }

      if (revealedAnswers && correctWordKeySet.has(normalized)) {
        revealIndexes.add(index);
      }

      if (
        wordHuntHintLineIndexSet.has(currentLineIndex) &&
        !successIndexes.has(index) &&
        !revealIndexes.has(index)
      ) {
        hintIndexes.add(index);
      }
    });

    return { successIndexes, revealIndexes, hintIndexes };
  }, [correctWordKeySet, foundWordKeys, normalizeToken, revealedAnswers, wordHuntHintLineIndexSet]);

  const getRandomVocabularyChunk = useCallback((text: string): { chunkText: string; hintLineIndexes: number[] } => {
    const plainText = text.replace(/<b>|<\/b>/g, "");
    if (!plainText.trim()) {
      return { chunkText: plainText, hintLineIndexes: [] };
    }

    const sentenceRegex = /[^.!?\n]+[.!?]?/g;
    const sentences: Array<{ text: string; start: number; end: number; wordCount: number }> = [];
    let match: RegExpExecArray | null;

    while ((match = sentenceRegex.exec(plainText)) !== null) {
      const raw = match[0];
      const trimmed = raw.trim();
      if (!trimmed) continue;
      const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
      sentences.push({
        text: trimmed,
        start: match.index,
        end: match.index + raw.length,
        wordCount,
      });
    }

    if (sentences.length === 0) {
      const words = plainText.split(/\s+/).filter(Boolean);
      const chunkText = words.slice(0, 20).join(" ").trim() || plainText;
      return { chunkText, hintLineIndexes: [0] };
    }

    const targetWords = 20;
    const randomIndex = Math.floor(Math.random() * sentences.length);
    let startSentence = randomIndex;
    let endSentence = randomIndex;
    let totalWords = sentences[randomIndex].wordCount;

    while (totalWords < targetWords && (startSentence > 0 || endSentence < sentences.length - 1)) {
      const canExpandLeft = startSentence > 0;
      const canExpandRight = endSentence < sentences.length - 1;

      if (canExpandLeft && canExpandRight) {
        const chooseLeft = Math.random() < 0.5;
        if (chooseLeft) {
          startSentence -= 1;
          totalWords += sentences[startSentence].wordCount;
        } else {
          endSentence += 1;
          totalWords += sentences[endSentence].wordCount;
        }
      } else if (canExpandLeft) {
        startSentence -= 1;
        totalWords += sentences[startSentence].wordCount;
      } else if (canExpandRight) {
        endSentence += 1;
        totalWords += sentences[endSentence].wordCount;
      }
    }

    const startChar = sentences[startSentence].start;
    const endChar = sentences[endSentence].end;
    const chunkText = plainText.slice(startChar, endChar).trim() || plainText;

    const prefix = plainText.slice(0, startChar);
    const chunk = plainText.slice(startChar, endChar);
    const startLine = (prefix.match(/\n/g) || []).length;
    const lineSpan = (chunk.match(/\n/g) || []).length + 1;
    const hintLineIndexes = Array.from({ length: lineSpan }, (_, offset) => startLine + offset);

    return { chunkText, hintLineIndexes };
  }, []);

  const fetchWordHuntQuestion = useCallback(async (mode: "vocabulary" | "pattern"): Promise<WordHuntData | null> => {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    const auth = getFirebaseAuth();
    const currentUser = auth?.currentUser ?? null;
    if (currentUser) {
      const token = await currentUser.getIdToken();
      headers.Authorization = `Bearer ${token}`;
    }

    const ttsConfig = getTtsVoiceConfig(settings.readingLanguage);
    const body: Record<string, string | string[] | number[] | undefined> = {
      mode,
      language_code: ttsConfig.languageCode,
      voice_name: ttsConfig.voiceName,
    };

    if (mode === "vocabulary") {
      const { chunkText, hintLineIndexes } = getRandomVocabularyChunk(displayText);
      const excludedWords = Array.from(vocabularyExcludedWordsRef.current);
      body.text = chunkText;
      body.excluded_words = excludedWords;
      body.hint_line_indexes = hintLineIndexes;
    } else {
      body.text = displayText;
    }

    const response = await fetch("/api/word-hunt", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const correctWords = Array.isArray(data?.correct_words)
      ? data.correct_words.map((word: unknown) => String(word).trim()).filter(Boolean)
      : [];

    const wordAudioRaw = data?.word_audio;
    const wordAudio: WordHuntData["word_audio"] =
      wordAudioRaw && typeof wordAudioRaw === "object" && !Array.isArray(wordAudioRaw)
        ? Object.entries(wordAudioRaw).reduce<NonNullable<WordHuntData["word_audio"]>>((acc, [word, payload]) => {
            if (
              typeof payload === "object" &&
              payload !== null &&
              typeof (payload as { audio?: unknown }).audio === "string"
            ) {
              acc[word] = {
                audio: (payload as { audio: string }).audio,
                sample_rate:
                  typeof (payload as { sample_rate?: unknown }).sample_rate === "number"
                    ? (payload as { sample_rate: number }).sample_rate
                    : 24000,
                audio_mime_type:
                  typeof (payload as { audio_mime_type?: unknown }).audio_mime_type === "string"
                    ? (payload as { audio_mime_type: string }).audio_mime_type
                    : "audio/wav",
              };
            }
            return acc;
          }, {})
        : undefined;

    if (!data?.question || correctWords.length === 0) {
      return null;
    }

    const patternHintLineIndexes =
      mode === "pattern" ? getPatternHintLineIndexes(displayText, correctWords) : undefined;

    const questionData: WordHuntData = {
      mode,
      question: String(data.question).trim(),
      correct_words: correctWords,
      completion_feedback: String(data.completion_feedback || (mode === "vocabulary" ? "Great vocabulary spotting!" : "Great phonics spotting!")).trim(),
      encouragement_prompt: String(data.encouragement_prompt || data.completion_feedback || (mode === "vocabulary" ? "Great vocabulary spotting!" : "Great phonics spotting!")).trim(),
      tip: String(data.tip || (mode === "vocabulary" ? "Keep looking for the meaning in the text." : "Look for the shared sound in each word.")).trim(),
      hint_line_indexes:
        mode === "vocabulary"
          ? (Array.isArray((body as { hint_line_indexes?: number[] }).hint_line_indexes)
              ? (body as { hint_line_indexes: number[] }).hint_line_indexes
              : undefined)
          : patternHintLineIndexes && patternHintLineIndexes.length > 0
            ? patternHintLineIndexes
            : undefined,
      word_audio: wordAudio,
    };

    if (mode === "vocabulary") {
      questionData.correct_words
        .map((word) => normalizeToken(word))
        .filter(Boolean)
        .forEach((word) => vocabularyExcludedWordsRef.current.add(word));
    }

    return questionData;
  }, [displayText, getPatternHintLineIndexes, getRandomVocabularyChunk, normalizeToken, settings.readingLanguage]);

  const fetchVocabularyWordHuntQuestion = useCallback(async (): Promise<WordHuntData | null> => {
    return fetchWordHuntQuestion("vocabulary");
  }, [fetchWordHuntQuestion]);

  const fetchPatternWordHuntQuestion = useCallback(async (): Promise<WordHuntData | null> => {
    return fetchWordHuntQuestion("pattern");
  }, [fetchWordHuntQuestion]);

  const stopWordHuntAudio = useCallback(() => {
    if (wordHuntAudioRef.current) {
      wordHuntAudioRef.current.pause();
      wordHuntAudioRef.current.currentTime = 0;
      wordHuntAudioRef.current = null;
    }
    setIsPhonemeAudioPlaying(false);
  }, []);

  useEffect(() => {
    return () => {
      stopWordHuntAudio();
    };
  }, [stopWordHuntAudio]);

  useEffect(() => {
    if ((wordHuntData?.hint_line_indexes?.length || (wordHuntData?.mode === "pattern" && wordHuntHintLineIndexSet.size > 0))) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const container = textContentRef.current;
          if (!container) return;
          const hintEl = container.querySelector<HTMLElement>('[data-hint="true"]');
          if (hintEl) {
            hintEl.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        });
      });
    }
  }, [wordHuntData, wordHuntHintLineIndexSet]);

  const playWordHuntWordAudioFromPayload = useCallback(async (audioPayload: WordHuntWordAudio) => {
    stopWordHuntAudio();

    const mimeType = audioPayload.audio_mime_type || "audio/wav";
    const audio = new Audio(`data:${mimeType};base64,${audioPayload.audio}`);
    wordHuntAudioRef.current = audio;
    audio.onended = () => setIsPhonemeAudioPlaying(false);

    try {
      await audio.play();
      setIsPhonemeAudioPlaying(true);
    } catch {
      setIsPhonemeAudioPlaying(false);
    }
  }, [stopWordHuntAudio]);

  const resolveEmbeddedWordAudio = useCallback((rawWord: string, normalizedKey: string): WordHuntWordAudio | null => {
    const audioMap = wordHuntData?.word_audio;
    if (!audioMap) return null;

    const direct = audioMap[rawWord] || audioMap[normalizedKey];
    if (direct?.audio) {
      return direct;
    }

    for (const [candidateWord, payload] of Object.entries(audioMap)) {
      if (normalizeToken(candidateWord) === normalizedKey && payload?.audio) {
        return payload;
      }
    }

    return null;
  }, [normalizeToken, wordHuntData?.word_audio]);

  const fetchWordTapAudio = useCallback(async (rawWord: string, normalizedKey: string): Promise<WordHuntWordAudio | null> => {
    const cached = wordHuntWordAudioCache[normalizedKey];
    if (cached?.audio) {
      return cached;
    }

    const cleanWord = rawWord.trim().replace(/^[^\w']+|[^\w']+$/g, "");
    if (!cleanWord) {
      return null;
    }

    try {
      const ttsConfig = getTtsVoiceConfig(settings.readingLanguage);
      const response = await fetch("/api/tts/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: cleanWord,
          provider: "google",
          language_code: ttsConfig.languageCode,
          voice_name: ttsConfig.voiceName,
        }),
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      if (data?.status !== "complete" || typeof data?.audio !== "string") {
        return null;
      }

      const payload: WordHuntWordAudio = {
        audio: data.audio,
        sample_rate: typeof data?.sample_rate === "number" ? data.sample_rate : 24000,
        audio_mime_type: typeof data?.audio_mime_type === "string" ? data.audio_mime_type : "audio/wav",
      };

      setWordHuntWordAudioCache((prev) => ({
        ...prev,
        [normalizedKey]: payload,
      }));

      return payload;
    } catch {
      return null;
    }
  }, [settings.readingLanguage, wordHuntWordAudioCache]);

  const playWordHuntAudio = async () => {
    const base64Audio = wordHuntData?.phoneme_audio?.audio;
    if (!base64Audio) return;

    stopWordHuntAudio();
    const audio = new Audio(`data:audio/wav;base64,${base64Audio}`);
    wordHuntAudioRef.current = audio;
    audio.onended = () => setIsPhonemeAudioPlaying(false);

    try {
      await audio.play();
      setIsPhonemeAudioPlaying(true);
    } catch {
      setIsPhonemeAudioPlaying(false);
    }
  };

  const startWordHunt = useCallback(async (modeOverride?: WordHuntMode) => {
    if (settings.readingLanguage !== "english" && settings.readingLanguage !== "malay") {
      setWordHuntFeedback("Word hunt is only available in English and Malay.");
      return;
    }

    const isMalay = settings.readingLanguage === "malay";
    const activeMode = isMalay ? "vocabulary" : (modeOverride ?? selectedWordHuntMode);
    if (modeOverride) {
      setSelectedWordHuntMode(modeOverride);
    }

    setWordHuntLoading(true);
    setWordHuntFeedback(null);
    setFoundWordKeys(new Set());
    setRevealedAnswers(false);
    setShowWordList(false);

    try {
      let questionPool: WordHuntData[] = [];

      if (activeMode === "vocabulary") {
        if (!wordHuntData) {
          vocabularyExcludedWordsRef.current.clear();
        }

        const vocabularyQuestion = await fetchVocabularyWordHuntQuestion().catch(() => null);
        if (vocabularyQuestion) {
          questionPool = [vocabularyQuestion];
        }
      } else {
        vocabularyExcludedWordsRef.current.clear();
        const patternQuestion = await fetchPatternWordHuntQuestion().catch(() => null);
        if (patternQuestion) {
          questionPool = [patternQuestion];
        } else {
          questionPool = wordHuntQuestionPool;
        }
      }

      if (questionPool.length === 0) {
        setWordHuntData(null);
        setActiveWordHuntQuestions([]);
        setWordHuntFeedback(
          activeMode === "vocabulary"
            ? "Could not create a vocabulary word hunt right now."
            : "Could not create a phonetics word hunt right now."
        );
        return;
      }

      const firstIndex = 0;
      setCurrentWordHuntQuestionIndex(firstIndex);
      setActiveWordHuntQuestions(questionPool);
      setWordHuntData(questionPool[firstIndex]);
      setWordHuntFeedback(null);
    } catch {
      setActiveWordHuntQuestions([]);
      setWordHuntFeedback("Could not create a word hunt right now.");
    } finally {
      setWordHuntLoading(false);
    }
  }, [fetchPatternWordHuntQuestion, fetchVocabularyWordHuntQuestion, selectedWordHuntMode, wordHuntData, wordHuntQuestionPool, settings.readingLanguage]);

  const loadNextVocabularyQuestion = useCallback(async () => {
    setWordHuntLoading(true);
    setWordHuntFeedback(null);

    try {
      const nextQuestion = await fetchVocabularyWordHuntQuestion().catch(() => null);
      if (!nextQuestion) {
        setWordHuntFeedback("No new vocabulary question available right now.");
        return;
      }

      setSelectedWordHuntMode("vocabulary");
      setCurrentWordHuntQuestionIndex(0);
      setActiveWordHuntQuestions([nextQuestion]);
      setWordHuntData(nextQuestion);
      setFoundWordKeys(new Set());
      setRevealedAnswers(false);
      setShowWordList(false);
      setWordHuntFeedback(null);
    } finally {
      setWordHuntLoading(false);
    }
  }, [fetchVocabularyWordHuntQuestion]);

  const loadNextPatternQuestion = useCallback(async () => {
    setWordHuntLoading(true);
    setWordHuntFeedback(null);

    try {
      const nextQuestion = await fetchPatternWordHuntQuestion().catch(() => null);
      if (!nextQuestion) {
        setWordHuntFeedback("No new phonics question available right now.");
        return;
      }

      setSelectedWordHuntMode("pattern");
      setCurrentWordHuntQuestionIndex(0);
      setActiveWordHuntQuestions([nextQuestion]);
      setWordHuntData(nextQuestion);
      setFoundWordKeys(new Set());
      setRevealedAnswers(false);
      setShowWordList(false);
      setWordHuntFeedback(null);
    } finally {
      setWordHuntLoading(false);
    }
  }, [fetchPatternWordHuntQuestion]);

  const handleWordHuntModeSwitch = useCallback((mode: WordHuntMode) => {
    if (mode === selectedWordHuntMode && wordHuntData?.mode === mode) {
      return;
    }

    void startWordHunt(mode);
  }, [selectedWordHuntMode, startWordHunt, wordHuntData?.mode]);

  const revealAnswers = useCallback(() => {
    setRevealedAnswers(true);
    const wordCount = correctWordKeySet.size;
    setWordHuntFeedback(
      wordCount > 0
        ? `Answers revealed. There ${wordCount === 1 ? "is" : "are"} ${wordCount} correct ${wordCount === 1 ? "word" : "words"}.`
        : "Answers revealed."
    );
  }, [correctWordKeySet]);

  const skipQuestion = useCallback(() => {
    if (wordHuntData?.mode === "vocabulary") {
      void loadNextVocabularyQuestion();
      return;
    }

    if (wordHuntData?.mode === "pattern") {
      void loadNextPatternQuestion();
      return;
    }

    if (activeWordHuntQuestions.length <= 1) {
      setWordHuntFeedback("No other question available for this text.");
      return;
    }

    const nextIndex = (currentWordHuntQuestionIndex + 1) % activeWordHuntQuestions.length;
    setCurrentWordHuntQuestionIndex(nextIndex);
    setWordHuntData(activeWordHuntQuestions[nextIndex]);
    setFoundWordKeys(new Set());
    setRevealedAnswers(false);
    setShowWordList(false);
    setWordHuntFeedback(null);
  }, [activeWordHuntQuestions, currentWordHuntQuestionIndex, loadNextPatternQuestion, loadNextVocabularyQuestion, wordHuntData?.mode]);

  const nextQuestion = useCallback(() => {
    skipQuestion();
  }, [skipQuestion]);

  const handleWordTapForWordHunt = useCallback((rawWord: string): boolean => {
    if (!wordHuntData) return false;

    const key = normalizeToken(rawWord);
    if (!key) return true;

    if (!correctWordKeySet.has(key)) {
      setWordHuntFeedback("Nice try. Keep looking!");
      return true;
    }

    const embeddedAudio = resolveEmbeddedWordAudio(rawWord, key);
    if (embeddedAudio) {
      void playWordHuntWordAudioFromPayload(embeddedAudio);
    } else {
      void (async () => {
        const fetchedAudio = await fetchWordTapAudio(rawWord, key);
        if (fetchedAudio) {
          await playWordHuntWordAudioFromPayload(fetchedAudio);
        }
      })();
    }

    if (!foundWordKeys.has(key)) {
      const nextFound = new Set(foundWordKeys);
      nextFound.add(key);
      setFoundWordKeys(nextFound);
      setWordHuntFeedback(getTapSuccessMessage());

      if (nextFound.size >= correctWordKeySet.size && correctWordKeySet.size > 0) {
        const finalFeedback = [
          wordHuntData.encouragement_prompt || wordHuntData.completion_feedback,
          wordHuntData.tip || getQuestionAwareTipMessage(wordHuntData.question),
        ].filter(Boolean).join(" ");
        setWordHuntFeedback(finalFeedback);
      }
    }

    return true;
  }, [wordHuntData, correctWordKeySet, foundWordKeys, normalizeToken, resolveEmbeddedWordAudio, fetchWordTapAudio, playWordHuntWordAudioFromPayload]);

  const handleWordTapForDefinition = useCallback((word: string, sentenceContext: string) => {
    if (handleWordTapForWordHunt(word)) return;
    if (settings.readingLanguage !== "english" && settings.readingLanguage !== "malay") return;
    setSelectedWord(word);
    setSelectedWordContext(sentenceContext);
    setIsPopoverOpen(true);
  }, [handleWordTapForWordHunt, settings.readingLanguage]);

  const getSentenceFromCharRange = (plainText: string, start: number, end: number): string => {
    if (!plainText.trim()) return "";

    const left = plainText.slice(0, start);
    const right = plainText.slice(end);

    const prevBoundaryIndex = Math.max(
      left.lastIndexOf("."),
      left.lastIndexOf("!"),
      left.lastIndexOf("?"),
      left.lastIndexOf("\n")
    );

    const nextBoundaryCandidates = [
      right.indexOf("."),
      right.indexOf("!"),
      right.indexOf("?"),
      right.indexOf("\n"),
    ].filter((value) => value >= 0);

    const nextBoundaryOffset =
      nextBoundaryCandidates.length > 0
        ? Math.min(...nextBoundaryCandidates)
        : right.length;

    const sentenceStart = prevBoundaryIndex >= 0 ? prevBoundaryIndex + 1 : 0;
    const sentenceEnd = end + nextBoundaryOffset + 1;

    return plainText.slice(sentenceStart, sentenceEnd).trim();
  };

  const getSentenceForWordFallback = (plainText: string, rawWord: string): string => {
    if (!plainText.trim()) return "";

    const normalizedWord = rawWord.toLowerCase().replace(/[^\w-]/g, "");
    if (!normalizedWord) return "";

    const sentences = plainText.match(/[^.!?\n]+[.!?]?/g) || [plainText];
    const matchingSentence = sentences.find((sentence) => {
      const normalizedSentence = sentence.toLowerCase().replace(/[^\w\s-]/g, " ");
      const parts = normalizedSentence.split(/\s+/).filter(Boolean);
      return parts.includes(normalizedWord);
    });

    return (matchingSentence || sentences[0] || "").trim();
  };

  // Build a mapping of timestamp index to word index at the start (memoized)
  const buildTimestampWordMap = React.useMemo(() => (text: string): Map<number, number> => {
    const map = new Map<number, number>();
    if (!wordTimestamps || wordTimestamps.length === 0) {
      return map;
    }

    const words = text.split(/(\s+)/);
    const compareWord = (w: string) => w.toLowerCase().replace(/[^\w-]/g, '');
    
    let lastFoundWordIdx = -1;
    let lastValidWordIdx = -1; // Track the last actual word highlighted

    wordTimestamps.forEach((ts, tsIdx) => {
      // Handle special tokens
      if (ts.word === '<eps>') {
        // For <eps> (silence), keep the previous word highlighted
        if (lastValidWordIdx >= 0) {
          map.set(tsIdx, lastValidWordIdx);
        }
        return;
      } else if (ts.word === '<unk>') {
        // For <unk> (unknown), highlight the next word
        // Find the next non-whitespace word
        for (let i = lastFoundWordIdx + 1; i < words.length; i++) {
          if (!/^\s+$/.test(words[i])) {
            map.set(tsIdx, i);
            // lastFoundWordIdx = i;
            lastValidWordIdx = i;
            return;
          }
        }
        return;
      }

      const targetWord = compareWord(ts.word);

      // Search for the word starting from where we left off
      for (let i = lastFoundWordIdx + 1; i < words.length; i++) {
        if (!/^\s+$/.test(words[i]) && compareWord(words[i]) === targetWord) {
          map.set(tsIdx, i);
          lastFoundWordIdx = i;
          lastValidWordIdx = i;
          break;
        }
      }
    });

    return map;
  }, [wordTimestamps]);

  // Create a function to parse text with word highlighting
  // eslint-disable-next-line react/display-name
  const parseTextWithHighlight = React.useMemo(() => (text: string): ReactNode => {
    if (!isListeningMode || !wordTimestamps || wordTimestamps.length === 0) {
      // Default mode: Parse HTML and make words clickable for definitions
      const plainText = text.replace(/<b>|<\/b>/g, "");

      if (settings.fontColor === "gradient") {
        const { successIndexes, revealIndexes, hintIndexes } = wordHuntMarkedIndexes(plainText);
        // Apply gradient reading mode based on visual lines
        return (
          <GradientReader
            text={text}
            successWordIndexes={successIndexes}
            revealWordIndexes={revealIndexes}
            hintWordIndexes={hintIndexes}
            onWordClick={(word) => {
              if (disableWordTap) return;
              handleWordTapForDefinition(word, getSentenceForWordFallback(plainText, word));
            }}
          />
        );
      }

      // Standard mode without gradient reading
      const words = plainText.split(/(\s+)/);
      const { hintIndexes } = wordHuntMarkedIndexes(plainText);
      
      // Build a map of which character ranges are bold (from HTML)
      const boldRanges: Array<{ start: number; end: number }> = [];
      const regex = /<b>(.+?)<\/b>/g;
      let match;
      while ((match = regex.exec(text)) !== null) {
        const tagsBeforeBold = (text.substring(0, match.index).match(/<b>|<\/b>/g) || []).length;
        const charsBeforeBold = tagsBeforeBold * 3; // Each tag is 3 chars (<b> or </b>)
        const displayStart = match.index - charsBeforeBold;
        const innerLength = match[1].length;
        boldRanges.push({
          start: displayStart,
          end: displayStart + innerLength,
        });
      }

      const isBold = (start: number, end: number) => {
        return boldRanges.some(
          (range) => start < range.end && end > range.start
        );
      };

      let displayCharPos = 0;

      return (
        <>
          {words.map((part, idx) => {
            const partStart = displayCharPos;
            const partEnd = displayCharPos + part.length;
            const shouldBold = isBold(partStart, partEnd);
            const normalizedPart = normalizeToken(part);
            const isSuccess = foundWordKeys.has(normalizedPart);
            const isReveal = revealedAnswers && correctWordKeySet.has(normalizedPart);
            const isHint = hintIndexes.has(idx);
            const isHintStart = isHint && !hintIndexes.has(idx - 1);
            const isHintEnd = isHint && !hintIndexes.has(idx + 1);
            displayCharPos = partEnd;

            // If it's just whitespace, return as-is
            if (/^\s+$/.test(part)) {
              return (
                <span
                  key={idx}
                  data-hint={isHint ? "true" : undefined}
                  className={isHint ? "bg-blue-100 dark:bg-blue-800/60" : undefined}
                  style={getWordHuntHighlightStyle(false, false, isHint, isHintStart, isHintEnd)}
                >
                  {part}
                </span>
              );
            }

            const classes = [
              shouldBold && "font-semibold",
              isSuccess && "bg-green-200/80 dark:bg-green-700/70 ring-2 ring-green-500 rounded-sm px-0.5 underline decoration-2 decoration-green-700 dark:decoration-green-200",
              isReveal && !isSuccess && "bg-indigo-200 dark:bg-indigo-700 ring-1 ring-indigo-400 rounded-sm px-0.5",
              isHint && !isSuccess && !isReveal && "bg-blue-100 dark:bg-blue-800/60",
              !disableWordTap && "cursor-pointer hover:underline",
              "transition-all duration-150",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <span
                key={idx}
                data-hint={isHint ? "true" : undefined}
                className={classes}
                style={getWordHuntHighlightStyle(isSuccess, isReveal, isHint, isHintStart, isHintEnd)}
                onClick={() => {
                  if (disableWordTap) return;
                  handleWordTapForDefinition(
                    part,
                    getSentenceFromCharRange(plainText, partStart, partEnd)
                  );
                }}
              >
                {part}
              </span>
            );
          })}
        </>
      );
    }

    // Listening mode: Parse with highlighting, no clickable definitions
    // Remove <b></b> tags to get display text
    const displayText = text.replace(/<b>|<\/b>/g, "");

    // Build a map of which character ranges are bold (from HTML)
    const boldRanges: Array<{ start: number; end: number }> = [];
    const regex = /<b>(.+?)<\/b>/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      // Calculate the start and end positions in the display text (without HTML tags)
      const tagsBeforeBold = (text.substring(0, match.index).match(/<b>|<\/b>/g) || []).length;
      const charsBeforeBold = tagsBeforeBold * 3; // Each tag is 3 chars (<b> or </b>)
      const displayStart = match.index - charsBeforeBold;
      const innerLength = match[1].length;
      boldRanges.push({
        start: displayStart,
        end: displayStart + innerLength,
      });
    }

    // Helper to check if a character range overlaps with a bold range
    const isBold = (start: number, end: number) => {
      return boldRanges.some(
        (range) => start < range.end && end > range.start
      );
    };

    // Split text into words while preserving original formatting
    const words = displayText.split(/(\s+)/);
    const { successIndexes, revealIndexes, hintIndexes } = wordHuntMarkedIndexes(displayText);
    
    // Build the timestamp to word index mapping (using displayText)
    const timestampWordMap = buildTimestampWordMap(displayText);
    
    // Build reverse map for faster lookup (word index -> timestamp index)
    const wordToTimestampMap = new Map<number, number>();
    timestampWordMap.forEach((wordIdx, tsIdx) => {
      if (!wordToTimestampMap.has(wordIdx)) {
        wordToTimestampMap.set(wordIdx, tsIdx);
      }
    });

    // Find the current timestamp index
    const currentTimestampIdx = wordTimestamps.findIndex(
      (ts) => currentPlaybackTime >= ts.start && currentPlaybackTime < ts.end
    );
    
    // Get the word index to highlight from our pre-built map
    const highlightWordIdx = timestampWordMap.get(currentTimestampIdx) ?? -1;

    if (settings.fontColor === "gradient") {
      return (
        <GradientReader
          text={text}
          highlightedWordIndex={highlightWordIdx}
          successWordIndexes={successIndexes}
          revealWordIndexes={revealIndexes}
          hintWordIndexes={hintIndexes}
          onWordClick={(_, wordIdx) => {
            if (disableWordTap) return;
            const tappedWord = words[wordIdx] ?? "";
            if (handleWordTapForWordHunt(tappedWord)) {
              return;
            }
            const timestampIdx = wordToTimestampMap.get(wordIdx);
            if (timestampIdx !== undefined && wordTimestamps[timestampIdx]) {
              const audio = audioRef.current;
              if (audio) {
                audio.currentTime = wordTimestamps[timestampIdx].start;
                if (!isPlayingAudio) {
                  onPlayPauseAudio();
                }
              }
            }
          }}
        />
      );
    }

    // Track character position in display text
    let displayCharPos = 0;

    return (
      <>
        {words.map((part, idx) => {
          const partStart = displayCharPos;
          const partEnd = displayCharPos + part.length;
          const shouldHighlight = idx === highlightWordIdx;
          const shouldBold = isBold(partStart, partEnd);
          const normalizedPart = normalizeToken(part);
          const isSuccess = foundWordKeys.has(normalizedPart);
          const isReveal = revealedAnswers && correctWordKeySet.has(normalizedPart);
          const isHint = hintIndexes.has(idx);
          const isHintStart = isHint && !hintIndexes.has(idx - 1);
          const isHintEnd = isHint && !hintIndexes.has(idx + 1);
          displayCharPos = partEnd;

          // If it's just whitespace, return as-is
          if (/^\s+$/.test(part)) {
            return (
              <span
                key={idx}
                data-hint={isHint ? "true" : undefined}
                className={isHint ? "bg-blue-100 dark:bg-blue-800/60" : undefined}
                style={getWordHuntHighlightStyle(false, false, isHint, isHintStart, isHintEnd)}
              >
                {part}
              </span>
            );
          }

          const classes = [
            shouldHighlight && "bg-yellow-300 dark:bg-yellow-500",
            shouldBold && "font-semibold",
            isSuccess && "bg-green-200/80 dark:bg-green-700/70 ring-2 ring-green-500 rounded-sm px-0.5 underline decoration-2 decoration-green-700 dark:decoration-green-200",
            isReveal && !isSuccess && "bg-indigo-200 dark:bg-indigo-700 ring-1 ring-indigo-400 rounded-sm px-0.5",
            isHint && !isSuccess && !isReveal && "bg-blue-100 dark:bg-blue-800/60",
            !disableWordTap && "cursor-pointer hover:opacity-70",
            "transition-all duration-75 ease-in-out",
          ]
            .filter(Boolean)
            .join(" ");

          // Get the timestamp index for this word from reverse map
          const timestampIdx = wordToTimestampMap.get(idx);

          return (
            <span 
              key={idx}
              data-hint={isHint ? "true" : undefined}
              className={classes}
              style={getWordHuntHighlightStyle(isSuccess, isReveal, isHint, isHintStart, isHintEnd)}
              onClick={() => {
                if (disableWordTap) return;
                if (handleWordTapForWordHunt(part)) {
                  return;
                }
                if (timestampIdx !== undefined && wordTimestamps[timestampIdx]) {
                  const audio = audioRef.current;
                  if (audio) {
                    audio.currentTime = wordTimestamps[timestampIdx].start;
                    // If not playing, start playback
                    if (!isPlayingAudio) {
                      onPlayPauseAudio();
                    }
                  }
                }
              }}
            >
              {part}
            </span>
          );
        })}
      </>
    );
  }, [isListeningMode, wordTimestamps, currentPlaybackTime, settings.fontColor, isPlayingAudio, audioRef, onPlayPauseAudio, buildTimestampWordMap, handleWordTapForDefinition, handleWordTapForWordHunt, wordHuntMarkedIndexes, normalizeToken, foundWordKeys, revealedAnswers, correctWordKeySet, getWordHuntHighlightStyle, disableWordTap]);

  // Split text into paragraphs, breaking long ones if needed
  const splitIntoParagraphs = (text: string): string[] => {
    const MAX_CHARS_PER_PARAGRAPH = 1500;
    const paragraphs = text.split(/\n\n+/);
    const result: string[] = [];

    for (const para of paragraphs) {
      if (para.length <= MAX_CHARS_PER_PARAGRAPH) {
        result.push(para);
      } else {
        // Split long paragraphs by sentences
        const sentences = para.match(/[^.!?]+[.!?]+/g) || [para];
        let currentChunk = "";

        for (const sentence of sentences) {
          if ((currentChunk + sentence).length <= MAX_CHARS_PER_PARAGRAPH) {
            currentChunk += sentence;
          } else {
            if (currentChunk) result.push(currentChunk);
            currentChunk = sentence;
          }
        }
        if (currentChunk) result.push(currentChunk);
      }
    }

    return result.filter((p) => p.trim().length > 0);
  };

  const paragraphs = splitIntoParagraphs(displayText);
  const currentParagraph = paragraphs[currentParagraphIndex] || displayText;

  const handlePreviousParagraph = () => {
    setCurrentParagraphIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNextParagraph = () => {
    setCurrentParagraphIndex((prev) => Math.min(paragraphs.length - 1, prev + 1));
  };

  const showMediaPlayer = isListeningMode && (isLoadingAudio || isPlayingAudio || hasAudioLoaded);
  const isWordHuntMode = Boolean(wordHuntData);
  const currentWordHuntMode: WordHuntMode = wordHuntData?.mode === "vocabulary" ? "vocabulary" : "pattern";
  const isWordHuntComplete = correctWordKeySet.size > 0 && foundWordKeys.size >= correctWordKeySet.size;
  const shouldShowWordList = showWordList || revealedAnswers || isWordHuntComplete;

  const handleTextViewBack = useCallback(() => {
    if (isParagraphMode) {
      setIsParagraphMode(false);
      setCurrentParagraphIndex(0);
      return;
    }

    if (isWordHuntMode) {
      stopWordHuntAudio();
      setWordHuntData(null);
      setWordHuntFeedback(null);
      setFoundWordKeys(new Set());
      setRevealedAnswers(false);
      setShowWordList(false);
      setCurrentWordHuntQuestionIndex(0);
      setActiveWordHuntQuestions([]);
      vocabularyExcludedWordsRef.current.clear();
      return;
    }

    if (showMediaPlayer) {
      onStopAudio();
      setHasAudioLoaded(false);
      setIsListeningMode(false);
      return;
    }

    onBackClick();
  }, [isParagraphMode, isWordHuntMode, showMediaPlayer, onStopAudio, onBackClick, stopWordHuntAudio]);

  return (
    <>
      <WordDefinitionPopover
        word={selectedWord || ""}
        contextSentence={selectedWordContext}
        textSettings={settings}
        isOpen={isPopoverOpen}
        onClose={() => {
          setIsPopoverOpen(false);
          setSelectedWordContext("");
        }}
      />
      <div
        className="flex flex-col h-screen w-screen"
        style={{ backgroundColor: settings.backgroundColor }}
      >
        <Header onBackClick={handleTextViewBack} onSettingsClick={onSettingsClick} onSavedWordsClick={onSavedWordsClick} showSavedWords borderColor="blue" fontFamily={settings.fontFamily} readingLanguage={settings.readingLanguage} onReadingLanguageChange={onReadingLanguageChange} />

      {/* Content area — side-by-side on large screens in word hunt mode */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
        {wordHuntData && (
          <div className="lg:w-80 xl:w-96 lg:flex-shrink-0 lg:overflow-y-auto p-4 lg:border-r border-blue-200 dark:border-blue-700">
            <WordHuntView
              wordHuntData={wordHuntData}
              foundCount={foundWordKeys.size}
              totalCount={correctWordKeySet.size}
              isPhonemeAudioPlaying={isPhonemeAudioPlaying}
              onPlaySound={playWordHuntAudio}
              shouldShowWordList={shouldShowWordList}
              onToggleWordList={() => setShowWordList((prev) => !prev)}
              foundWordKeys={foundWordKeys}
              revealedAnswers={revealedAnswers}
              correctWordKeySet={correctWordKeySet}
              normalizeToken={normalizeToken}
              feedback={wordHuntFeedback}
              loading={wordHuntLoading}
              isComplete={isWordHuntComplete}
              onRevealAnswers={revealAnswers}
              onSkipQuestion={skipQuestion}
              onNextQuestion={nextQuestion}
            />
          </div>
        )}

        <div className="flex-1 overflow-auto p-6 sm:p-8 lg:p-12 flex flex-col items-start justify-start" ref={textContentRef}>
          {isFormatting ? (
            <div className="flex items-center justify-center w-full h-full">
              <LoadingSpinner
                label="Formatting text…"
                size="md"
                color="blue"
                fontFamily={settings.fontFamily}
              />
            </div>
          ) : isParagraphMode ? (
            <div className="w-full h-full flex flex-col">
              <TextViewBox
                style={{
                  fontFamily: settings.fontFamily,
                  fontSize: `${settings.fontSize}px`,
                  color: settings.fontColor === "gradient" ? "#1a1a1a" : settings.fontColor,
                  lineHeight: settings.lineSpacing,
                  backgroundColor: settings.backgroundColor,
                }}
                className="text-base sm:text-lg lg:text-xl leading-relaxed flex-1 overflow-auto"
              >
                {parseTextWithHighlight(currentParagraph)}
              </TextViewBox>
              <div className="mt-6 text-sm font-medium" style={{ color: settings.fontColor === "gradient" ? "#1a1a1a" : settings.fontColor }}>
                Paragraph {currentParagraphIndex + 1} of {paragraphs.length}
              </div>
            </div>
          ) : (
            <TextViewBox
              style={{
                fontFamily: settings.fontFamily,
                fontSize: `${settings.fontSize}px`,
                color: settings.fontColor === "gradient" ? "#1a1a1a" : settings.fontColor,
                lineHeight: settings.lineSpacing,
                backgroundColor: settings.backgroundColor,
              }}
              className="text-base sm:text-lg lg:text-xl leading-relaxed overflow-auto"
            >
              {parseTextWithHighlight(displayText)}
            </TextViewBox>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex gap-3 p-3 bg-white dark:bg-slate-900 border-t border-blue-400 dark:border-blue-700 flex-wrap justify-center items-center">
        {isWordHuntMode ? (
          <div className="flex items-center gap-2">
            {settings.readingLanguage !== "malay" && (
              <>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Mode:</span>
                <button
                  type="button"
                  onClick={() => handleWordHuntModeSwitch("pattern")}
                  disabled={wordHuntLoading}
                  aria-pressed={currentWordHuntMode === "pattern"}
                  className={[
                    "px-3 py-1 rounded-md text-sm font-semibold border transition-colors disabled:opacity-60",
                    currentWordHuntMode === "pattern"
                      ? "bg-blue-600 text-white border-blue-600 ring-2 ring-blue-300 dark:ring-blue-500 shadow-sm"
                      : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100 dark:bg-slate-700 dark:text-slate-100 dark:border-slate-500 dark:hover:bg-slate-600",
                  ].join(" ")}
                >
                  Phonetics
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => handleWordHuntModeSwitch("vocabulary")}
              disabled={wordHuntLoading}
              aria-pressed={currentWordHuntMode === "vocabulary"}
              className={[
                "px-3 py-1 rounded-md text-sm font-semibold border transition-colors disabled:opacity-60",
                currentWordHuntMode === "vocabulary"
                  ? "bg-blue-600 text-white border-blue-600 ring-2 ring-blue-300 dark:ring-blue-500 shadow-sm"
                  : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100 dark:bg-slate-700 dark:text-slate-100 dark:border-slate-500 dark:hover:bg-slate-600",
              ].join(" ")}
            >
              Vocabulary
            </button>
          </div>
        ) : showMediaPlayer && !isFormatting ? (
          <ListenView
            isLoadingAudio={isLoadingAudio}
            isPlayingAudio={isPlayingAudio}
            audioRef={audioRef}
            onPlayPauseAudio={onPlayPauseAudio}
            playbackSpeed={playbackSpeed}
            onSlowDown={handleSlowDown}
            onSpeedUp={handleSpeedUp}
          />
        ) : isParagraphMode ? (
          <>
            <Button fontFamily={settings.fontFamily} 
              onClick={() => {
                setIsParagraphMode(false);
                setCurrentParagraphIndex(0);
              }}
              icon={<FileTextIcon className="w-6 h-6" />}
            >
              Full text mode
            </Button>
            <Button
              onClick={handlePreviousParagraph}
              disabled={currentParagraphIndex === 0}
            >
              ← Previous
            </Button>
            <Button
              onClick={handleNextParagraph}
              disabled={currentParagraphIndex === paragraphs.length - 1}
            >
              Next →
            </Button>
          </>
        ) : (
          <>
            <Button fontFamily={settings.fontFamily} 
              onClick={() => {
                setIsParagraphMode(true);
                setCurrentParagraphIndex(0);
              }}
              icon={<FileTextIcon className="w-6 h-6" />}
            >
              Paragraph mode
            </Button>
            <Button
              onClick={handleListen}
              disabled={isFormatting}
              icon={<SpeakerLoudIcon className="w-6 h-6" />}
            >
              Listen
            </Button>
            <Button
              onClick={startWordHunt}
              disabled={wordHuntLoading || isFormatting || (settings.readingLanguage !== "english" && settings.readingLanguage !== "malay")}
              icon={<FileTextIcon className="w-6 h-6" />}
            >
              {wordHuntLoading ? "Preparing..." : "Word hunt"}
            </Button>
            <Button fontFamily={settings.fontFamily} 
              onClick={onEditClick}
              icon={<Pencil2Icon className="w-6 h-6" />}
            >
              Edit
            </Button>
            {/* <Button fontFamily={settings.fontFamily} icon={<BookmarkIcon className="w-6 h-6" />}>
              Notes
            </Button> */}
          </>
        )}
      </div>
    </div>
    </>
  );
};

export default TextView;
