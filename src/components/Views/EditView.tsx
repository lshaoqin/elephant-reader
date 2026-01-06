"use client";

import React, { useState, ReactNode } from "react";
import { CheckIcon } from "@radix-ui/react-icons";
import { Header, Button } from "@/components";
import type { TextSettings } from "./SettingsView";

interface EditViewProps {
  initialText: string;
  onBackClick: () => void;
  onSave: (text: string) => void;
  onSettingsClick: () => void;
  settings: TextSettings;
  parseMarkdownText: (text: string) => ReactNode;
}

export const EditView: React.FC<EditViewProps> = ({
  initialText,
  onBackClick,
  onSave,
  onSettingsClick,
  settings,
  parseMarkdownText,
}) => {
  const [text, setText] = useState(initialText);
  const [selectedRange, setSelectedRange] = useState<{ start: number; end: number } | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
  };

  const updateSelectionRange = () => {
    if (textareaRef.current) {
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      if (start !== end) {
        setSelectedRange({ start, end });
      } else {
        setSelectedRange(null);
      }
    }
  };

  const handleMouseUp = updateSelectionRange;
  const handleKeyUp = updateSelectionRange;

  const applyFormatting = (beforeFormat: string, afterFormat: string) => {
    if (!selectedRange || textareaRef.current === null) return;

    const { start, end } = selectedRange;
    const selectedText = text.substring(start, end);
    const newText =
      text.substring(0, start) +
      beforeFormat +
      selectedText +
      afterFormat +
      text.substring(end);

    setText(newText);
    setSelectedRange(null);

    // Reset selection in textarea
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }, 0);
  };

  const handleBold = () => {
    applyFormatting("**", "**");
  };

  const handleSave = () => {
    onSave(text);
  };

  return (
    <div 
      className="flex flex-col h-screen w-screen"
      style={{ backgroundColor: settings.backgroundColor }}
    >
      <Header onBackClick={onBackClick} onSettingsClick={onSettingsClick} />

      {/* Content area styled like TextView */}
      <div className="flex-1 overflow-auto p-6 sm:p-8 lg:p-12 flex flex-col items-start justify-start">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          onMouseUp={handleMouseUp}
          onKeyUp={handleKeyUp}
          className="w-full h-full p-0 bg-transparent border-none focus:outline-none resize-none text-base sm:text-lg leading-relaxed"
          style={{
            fontFamily: settings.fontFamily,
            fontSize: `${settings.fontSize}px`,
            color: settings.fontColor === "gradient" ? "#1a1a1a" : settings.fontColor,
            lineHeight: settings.lineSpacing,
            backgroundColor: "transparent",
          }}
        />
      </div>

      {/* Tablet-optimized footer with formatting buttons */}
      <div className="flex gap-4 p-6 bg-white dark:bg-slate-900 border-t-4 border-yellow-500 flex-wrap justify-center">
        <Button
          onClick={handleBold}
          disabled={!selectedRange}
          icon={
            <span style={{ fontSize: "16px", fontWeight: "bold" }}>B</span>
          }
        >
          Bold
        </Button>
        <Button
          onClick={handleSave}
          icon={<CheckIcon className="w-6 h-6" />}
        >
          Save
        </Button>
      </div>
    </div>
  );
};
