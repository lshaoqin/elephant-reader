"use client";

import React from "react";
import { FileTextIcon } from "@radix-ui/react-icons";
import { Button } from "@/components";

interface WordHuntActionsProps {
  revealLabel?: "singular" | "plural";
  isComplete: boolean;
  hasRevealedAnswers: boolean;
  loading: boolean;
  isFormatting: boolean;
  hasData: boolean;
  onRevealAnswers: () => void;
  onSkipQuestion: () => void;
  onNextQuestion: () => void;
}

export const WordHuntActions: React.FC<WordHuntActionsProps> = ({
  revealLabel = "plural",
  isComplete,
  hasRevealedAnswers,
  loading,
  isFormatting,
  hasData,
  onRevealAnswers,
  onSkipQuestion,
  onNextQuestion,
}) => {
  const showNextQuestion = isComplete || hasRevealedAnswers;

  return (
    <>
      {!showNextQuestion && (
        <Button
          onClick={onRevealAnswers}
          disabled={loading || isFormatting || !hasData}
          icon={<FileTextIcon className="w-6 h-6" />}
        >
          {revealLabel === "singular" ? "Reveal answer" : "Reveal answers"}
        </Button>
      )}
      <Button
        onClick={showNextQuestion ? onNextQuestion : onSkipQuestion}
        disabled={loading || isFormatting}
        icon={<FileTextIcon className="w-6 h-6" />}
      >
        {loading ? "Preparing..." : showNextQuestion ? "Next question" : "Skip question"}
      </Button>
    </>
  );
};

export default WordHuntActions;
