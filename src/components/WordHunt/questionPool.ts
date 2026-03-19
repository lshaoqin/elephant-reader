import type { WordHuntData } from "./types";

const WORD_HUNT_DIGRAPHS = ["sh", "ch", "th", "wh", "ph", "ck", "ng", "qu", "wr", "kn", "tch", "dge"];
const WORD_HUNT_BLENDS = ["bl", "br", "cl", "cr", "dr", "fl", "fr", "gl", "gr", "pl", "pr", "sc", "sk", "sl", "sm", "sn", "sp", "st", "sw", "tr", "tw"];

export function buildWordHuntQuestionPool(
  displayText: string,
  normalizeToken: (value: string) => string
): WordHuntData[] {
  const plainText = displayText.replace(/<[^>]*>/g, " ");
  const words = plainText.match(/[A-Za-z][A-Za-z'-]*/g) || [];

  const collectMatches = (pattern: string) => {
    const output: string[] = [];
    const seen = new Set<string>();

    words.forEach((word) => {
      const normalized = normalizeToken(word);
      if (!normalized || seen.has(normalized)) return;
      if (normalized.includes(pattern)) {
        seen.add(normalized);
        output.push(word);
      }
    });

    return output;
  };

  const candidates = [...WORD_HUNT_DIGRAPHS, ...WORD_HUNT_BLENDS]
    .map((pattern) => {
      const allMatches = collectMatches(pattern);
      const startsWith = allMatches.filter((word) => normalizeToken(word).startsWith(pattern));
      const endsWith = allMatches.filter((word) => normalizeToken(word).endsWith(pattern));

      const startScore = startsWith.length;
      const endScore = endsWith.length;

      if (startScore >= endScore && startScore > 0) {
        return {
          question: `Tap words starting with '${pattern}'.`,
          words: startsWith,
        };
      }

      if (endScore > 0) {
        return {
          question: `Tap words ending with '${pattern}'.`,
          words: endsWith,
        };
      }

      return {
        question: `Tap words with '${pattern}'.`,
        words: allMatches,
      };
    })
    .filter((item) => item.words.length > 0)
    .sort((left, right) => right.words.length - left.words.length)
    .map((item) => ({
      mode: "pattern" as const,
      question: item.question,
      correct_words: item.words.slice(0, 8),
      completion_feedback: "Great spotting! You found the pattern words.",
    }));

  if (candidates.length > 0) {
    return candidates;
  }

  return [
    {
      mode: "pattern",
      question: "Tap words with blends or digraphs.",
      correct_words: words.slice(0, 4),
      completion_feedback: "Nice effort! Let's try another word hunt.",
    },
  ];
}
