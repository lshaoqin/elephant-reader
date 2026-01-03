/**
 * Applies Beeline Reader-style gradient coloring to text
 * Creates a 4-line cycle of gradients to aid reading fluency
 * Line 1: Black -> Blue
 * Line 2: Blue -> Black
 * Line 3: Black -> Red
 * Line 4: Red -> Black
 */

export interface ColoredWord {
  text: string;
  color: string;
}

export interface ColoredLine {
  words: ColoredWord[];
}

const BLACK = "#000000";
const BLUE = "#0066ff";
const RED = "#ff0033";

/**
 * Interpolate between two hex colors
 */
function interpolateColor(color1: string, color2: string, factor: number): string {
  const c1 = parseInt(color1.slice(1), 16);
  const c2 = parseInt(color2.slice(1), 16);

  const r1 = (c1 >> 16) & 255;
  const g1 = (c1 >> 8) & 255;
  const b1 = c1 & 255;

  const r2 = (c2 >> 16) & 255;
  const g2 = (c2 >> 8) & 255;
  const b2 = c2 & 255;

  const r = Math.round(r1 + (r2 - r1) * factor);
  const g = Math.round(g1 + (g2 - g1) * factor);
  const b = Math.round(b1 + (b2 - b1) * factor);

  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/**
 * Get the gradient colors for a given line number
 * Follows a 4-line cycle pattern
 */
function getLineGradient(lineIndex: number): { start: string; end: string } {
  const cycle = lineIndex % 4;

  switch (cycle) {
    case 0:
      return { start: BLACK, end: BLUE };
    case 1:
      return { start: BLUE, end: BLACK };
    case 2:
      return { start: BLACK, end: RED };
    case 3:
      return { start: RED, end: BLACK };
    default:
      return { start: BLACK, end: BLUE };
  }
}

/**
 * Apply bionic reading gradient to text
 * Splits text into lines and words, applying a 4-line gradient cycle
 */
export function applyBionicReading(text: string): ColoredLine[] {
  const lines = text.split("\n");
  const result: ColoredLine[] = [];

  lines.forEach((line, lineIndex) => {
    // Split by whitespace while preserving spaces
    const tokens = line.split(/(\s+)/);

    // Filter only non-whitespace words for gradient calculation
    const words = tokens.filter((token) => token.trim().length > 0);

    if (words.length === 0) {
      result.push({ words: [] });
      return;
    }

    // Get gradient colors for this line
    const { start: startColor, end: endColor } = getLineGradient(lineIndex);

    // Create a color map for actual words
    const wordColorMap = new Map<number, string>();
    words.forEach((word, wordIndex) => {
      const factor = words.length === 1 ? 0 : wordIndex / (words.length - 1);
      const color = interpolateColor(startColor, endColor, factor);
      wordColorMap.set(wordIndex, color);
    });

    // Apply colors to all tokens, preserving spaces
    let wordCounter = 0;
    const coloredWords: ColoredWord[] = tokens.map((token) => {
      if (token.trim().length === 0) {
        // Preserve spaces and whitespace
        return {
          text: token,
          color: "inherit",
        };
      }
      const color = wordColorMap.get(wordCounter) || startColor;
      wordCounter++;
      return {
        text: token,
        color,
      };
    });

    result.push({ words: coloredWords });
  });

  return result;
}
