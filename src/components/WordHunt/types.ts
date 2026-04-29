export interface WordHuntData {
  mode?: "pattern" | "vocabulary";
  question: string;
  correct_words: string[];
  completion_feedback: string;
  hint_line_indexes?: number[];
  word_audio?: Record<
    string,
    {
      audio: string;
      sample_rate: number;
      audio_mime_type?: string;
    }
  >;
  phoneme_audio?: {
    audio: string;
    sample_rate: number;
  };
}
