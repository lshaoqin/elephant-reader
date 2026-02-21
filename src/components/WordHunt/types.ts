export interface WordHuntData {
  question: string;
  correct_words: string[];
  completion_feedback: string;
  phoneme_audio?: {
    audio: string;
    sample_rate: number;
  };
}
