import React, { useLayoutEffect, useMemo, useRef, useState } from "react";

interface Word {
  text: string;
  isWhitespace: boolean;
  isBold: boolean;
}

interface WordWithColor {
  text: string;
  color: string;
  isWhitespace: boolean;
  isBold: boolean;
}

interface GradientReaderProps {
  text: string;
  onWordClick?: (word: string, wordIndex: number) => void;
  highlightedWordIndex?: number;
}

const BLACK = "#1a1a1a";
const BLUE = "#0066ff";
const RED = "#ff0033";

function getLineGradient(
  lineIndex: number
): { start: string; end: string } {
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

function interpolateColor(
  color1: string,
  color2: string,
  factor: number
): string {
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

export const GradientReader: React.FC<GradientReaderProps> = ({
  text,
  onWordClick,
  highlightedWordIndex,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wordRefsRef = useRef<(HTMLSpanElement | null)[]>([]);
  const [coloredWords, setColoredWords] = useState<WordWithColor[]>([]);

  // Parse text into words, handling bold tags
  const words: Word[] = useMemo(() => {
    // Remove HTML tags to get display text
    const displayText = text.replace(/<b>|<\/b>/g, "");
    
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

    // Split display text into words
    const tokens = displayText
      .split(/(\s+)/)
      .filter((token) => token.length > 0);
    
    return tokens.reduce<{ words: Word[]; pos: number }>(
      (acc, token) => {
        const partStart = acc.pos;
        const partEnd = acc.pos + token.length;
        const shouldBold = isBold(partStart, partEnd);

        return {
          words: [
            ...acc.words,
            {
              text: token,
              isWhitespace: /^\s+$/.test(token),
              isBold: shouldBold,
            },
          ],
          pos: partEnd,
        };
      },
      { words: [], pos: 0 }
    ).words;
  }, [text]);

  useLayoutEffect(() => {
    if (!containerRef.current) return;

    // Get the positions of all words to determine visual lines
    const positions = wordRefsRef.current.map((ref) => {
      if (!ref) return { top: 0 };
      return { top: ref.offsetTop };
    });

    // Group words by their visual line (top position)
    const lines: number[][] = [];
    let currentLine: number[] = [];
    let currentTop = -1;

    positions.forEach((pos, idx) => {
      if (currentTop === -1) {
        currentTop = pos.top;
        currentLine = [idx];
      } else if (pos.top === currentTop) {
        currentLine.push(idx);
      } else {
        if (currentLine.length > 0) {
          lines.push(currentLine);
        }
        currentTop = pos.top;
        currentLine = [idx];
      }
    });

    if (currentLine.length > 0) {
      lines.push(currentLine);
    }

    // Apply gradient colors based on visual lines
    const newColoredWords = words.map((word, idx) => {
      let color = word.isWhitespace ? "inherit" : BLACK;

      // Find which visual line this word belongs to
      for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const lineWordIndices = lines[lineIdx];
        if (lineWordIndices.includes(idx)) {
          // Get non-whitespace words in this line
          const nonWhitespaceIndices = lineWordIndices.filter(
            (i) => words[i] && !words[i].isWhitespace
          );

          if (!word.isWhitespace && nonWhitespaceIndices.length > 0) {
            const { start: startColor, end: endColor } =
              getLineGradient(lineIdx);
            const positionInLine = nonWhitespaceIndices.indexOf(idx);
            const factor =
              nonWhitespaceIndices.length === 1
                ? 0
                : positionInLine / (nonWhitespaceIndices.length - 1);
            color = interpolateColor(startColor, endColor, factor);
          }
          break;
        }
      }

      return {
        text: word.text,
        color,
        isWhitespace: word.isWhitespace,
        isBold: word.isBold,
      };
    });

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setColoredWords(newColoredWords);
  }, [text, words]);

  return (
    <div ref={containerRef}>
      {(coloredWords.length > 0 ? coloredWords : words.map(w => ({ ...w, color: BLACK }))).map((word, idx) => (
        <span
          key={idx}
          ref={(el) => {
            wordRefsRef.current[idx] = el;
          }}
          style={{
            color: word.color,
            fontWeight: word.isBold ? "bold" : "normal",
          }}
          className={[
            !word.isWhitespace && onWordClick ? "cursor-pointer hover:underline" : "",
            idx === highlightedWordIndex ? "bg-yellow-300 dark:bg-yellow-500 rounded-sm" : "",
            "transition-all duration-75 ease-in-out",
          ].filter(Boolean).join(" ")}
          onClick={() => {
            if (!word.isWhitespace && onWordClick) {
              onWordClick(word.text, idx);
            }
          }}
        >
          {word.text}
        </span>
      ))}
    </div>
  );
};
