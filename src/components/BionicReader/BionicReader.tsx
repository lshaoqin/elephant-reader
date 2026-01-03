import React, { useEffect, useRef, useState } from "react";

interface Word {
  text: string;
  isWhitespace: boolean;
}

interface WordWithColor {
  text: string;
  color: string;
  isWhitespace: boolean;
}

interface BionicReaderProps {
  text: string;
  onWordClick: (word: string) => void;
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

export const BionicReader: React.FC<BionicReaderProps> = ({
  text,
  onWordClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wordRefsRef = useRef<(HTMLSpanElement | null)[]>([]);
  const [coloredWords, setColoredWords] = useState<WordWithColor[]>([]);

  // Parse text into words
  const words: Word[] = text.split(/(\s+)/).map((token) => ({
    text: token,
    isWhitespace: /^\s+$/.test(token),
  }));

  useEffect(() => {
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
            (i) => !words[i].isWhitespace
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
      };
    });

    setColoredWords(newColoredWords);
  }, [text, words]);

  return (
    <div ref={containerRef}>
      {coloredWords.map((word, idx) => (
        <span
          key={idx}
          ref={(el) => {
            wordRefsRef.current[idx] = el;
          }}
          style={{
            color: word.color,
          }}
          className={!word.isWhitespace ? "cursor-pointer hover:underline" : ""}
          onClick={() => {
            if (!word.isWhitespace) {
              onWordClick(word.text);
            }
          }}
        >
          {word.text}
        </span>
      ))}
    </div>
  );
};
