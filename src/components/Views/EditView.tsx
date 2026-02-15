"use client";

import React, { useState, useRef, useEffect } from "react";
import { CheckIcon } from "@radix-ui/react-icons";
import { Header, Button, TextViewBox } from "@/components";
import type { TextSettings } from "./SettingsView";

interface EditViewProps {
  initialText: string;
  onBackClick: () => void;
  onSave: (text: string) => void;
  onSettingsClick: () => void;
  settings: TextSettings;
}

export const EditView: React.FC<EditViewProps> = ({
  initialText,
  onBackClick,
  onSave,
  onSettingsClick,
  settings,
}) => {
  const [htmlContent, setHtmlContent] = useState(initialText);
  const [selectedRange, setSelectedRange] = useState<{ start: number; end: number } | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  // Initialize editor with content and focus
  useEffect(() => {
    if (editorRef.current && !editorRef.current.innerHTML) {
      editorRef.current.innerHTML = initialText;
    }
    // Focus the editor to trigger mobile keyboard
    if (editorRef.current) {
      editorRef.current.focus();
    }
  }, [initialText]);

  const handleInputChange = () => {
    if (editorRef.current) {
      const newContent = editorRef.current.innerHTML;
      setHtmlContent(newContent);
      setHasUnsavedChanges(newContent !== initialText);
    }
  };

  const updateSelectionRange = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) {
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
  const handleSelect = updateSelectionRange;
  const handleTouchEnd = updateSelectionRange;

  const handleBold = () => {
    document.execCommand("bold", false);
    if (editorRef.current) {
      editorRef.current.focus();
      setHtmlContent(editorRef.current.innerHTML);
    }
  };

  const handleSave = () => {
    onSave(htmlContent);
    setHasUnsavedChanges(false);
  };

  const handleBackClick = () => {
    if (hasUnsavedChanges) {
      const confirmMessage = "You have unsaved changes. Do you want to save before leaving?";
      if (window.confirm(confirmMessage)) {
        handleSave();
      }
    }
    onBackClick();
  };

  return (
    <div 
      className="flex flex-col h-dvh w-screen"
      style={{ backgroundColor: settings.backgroundColor }}
    >
      <div className="lg:border-b-4 lg:border-yellow-500 sticky top-0 z-10">
        <Header onBackClick={handleBackClick} onSettingsClick={onSettingsClick} borderColor="none" />
      </div>

      {/* Formatting toolbar - sticky at top on mobile and tablets */}
      <div className="sticky top-[64px] z-10 flex gap-4 p-6 bg-white dark:bg-slate-900 border-b-4 border-yellow-500 flex-wrap justify-center lg:hidden">
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

      {/* Content area with editable TextViewBox */}
      <div className="flex-1 overflow-auto p-6 lg:p-8 xl:p-12 flex flex-col items-start justify-start">
        <TextViewBox
          className="outline-none"
          style={{
            fontFamily: settings.fontFamily,
            fontSize: `${settings.fontSize}px`,
            color: settings.fontColor === "gradient" ? "#1a1a1a" : settings.fontColor,
            lineHeight: settings.lineSpacing,
            cursor: "text",
            backgroundColor: settings.backgroundColor,
          }}
        >
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleInputChange}
            onMouseUp={handleMouseUp}
            onKeyUp={handleKeyUp}
            onSelect={handleSelect}
            onTouchEnd={handleTouchEnd}
            className="focus:outline-none focus:ring-0"
            style={{
              whiteSpace: "pre-wrap",
              wordWrap: "break-word",
              overflowWrap: "break-word",
            }}
          />
        </TextViewBox>
      </div>

      {/* Formatting toolbar - at bottom on large desktop screens only */}
      <div 
        className="hidden lg:flex gap-4 p-6 bg-white dark:bg-slate-900 border-t-4 border-yellow-500 flex-wrap justify-center transition-all duration-300"
      >
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
