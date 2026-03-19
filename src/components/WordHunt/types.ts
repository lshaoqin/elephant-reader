export interface WordHuntData {
  mode?: "pattern" | "vocabulary";
  question: string;
  correct_words: string[];
  completion_feedback: string;
  hint_line_indexes?: number[];
  phoneme_audio?: {
    audio: string;
    sample_rate: number;
  };
}
