"use client";

import React, { useState, ReactNode, useRef } from "react";
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
  const editorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleInputChange = () => {
    if (editorRef.current) {
      setText(editorRef.current.textContent || "");
    }
  };

  const updateSelectionRange = () => {
    const selection = window.getSelection();
    if (selection && selection.toString()) {
      setSelectedRange({
        start: 0,
        end: selection.toString().length,
      });
    } else {
      setSelectedRange(null);
    }
  };

  const handleMouseUp = updateSelectionRange;
  const handleKeyUp = updateSelectionRange;

  const applyFormatting = (beforeFormat: string, afterFormat: string) => {
    const selection = window.getSelection();
    if (!selection || !selection.toString()) return;

    const selectedText = selection.toString();
    const newText =
      text.substring(0, text.indexOf(selectedText)) +
      beforeFormat +
      selectedText +
      afterFormat +
      text.substring(text.indexOf(selectedText) + selectedText.length);

    setText(newText);
    
    // Update the contenteditable div
    if (editorRef.current) {
      editorRef.current.textContent = newText;
      editorRef.current.focus();
    }
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

      {/* Content area with contenteditable div */}
      <div className="flex-1 overflow-auto p-6 sm:p-8 lg:p-12 flex flex-col items-start justify-start">
        {/* Contenteditable div showing formatted markdown */}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInputChange}
          onMouseUp={handleMouseUp}
          onKeyUp={handleKeyUp}
          className="w-full h-full outline-none text-base sm:text-lg leading-relaxed"
          style={{
            fontFamily: settings.fontFamily,
            fontSize: `${settings.fontSize}px`,
            color: settings.fontColor === "gradient" ? "#1a1a1a" : settings.fontColor,
            lineHeight: settings.lineSpacing,
            whiteSpace: "pre-wrap",
            wordWrap: "break-word",
            overflowWrap: "break-word",
          }}
        >
          {parseMarkdownText(initialText)}
        </div>
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
