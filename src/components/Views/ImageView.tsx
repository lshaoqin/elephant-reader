"use client";

import React, { useEffect } from "react";
import { Header, LoadingSpinner } from "@/components";
import type { TextSettings } from "./SettingsView";

interface TextBlock {
  text: string;
  vertices: { x: number; y: number }[];
}

interface ExtractionResult {
  full_text: string;
  blocks: TextBlock[];
  image_base64: string;
}

interface ImageScale {
  width: number;
  height: number;
  naturalWidth?: number;
  naturalHeight?: number;
}

interface ImageViewProps {
  result: ExtractionResult;
  imageScale: ImageScale;
  selectedBlockIndex: number | null;
  formattingBlockIndex: number | null;
  onBackClick: () => void;
  onSettingsClick: () => void;
  onImageLoad: (e: React.SyntheticEvent<HTMLImageElement>) => void;
  onBlockClick: (blockIndex: number) => void;
  settings: TextSettings;
  currentPage?: number;
  totalPages?: number;
  onNextPage?: () => void;
  onPrevPage?: () => void;
}

export const ImageView: React.FC<ImageViewProps> = ({
  result,
  imageScale,
  selectedBlockIndex,
  formattingBlockIndex,
  onBackClick,
  onSettingsClick,
  onImageLoad,
  onBlockClick,
  settings,
  currentPage = 1,
  totalPages = 1,
  onNextPage,
  onPrevPage,
}) => {
  // Add keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle arrow keys if we have multiple pages
      if (totalPages <= 1) return;
      
      if (e.key === 'ArrowLeft' && currentPage > 1 && onPrevPage) {
        e.preventDefault();
        onPrevPage();
      } else if (e.key === 'ArrowRight' && currentPage < totalPages && onNextPage) {
        e.preventDefault();
        onNextPage();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, totalPages, onNextPage, onPrevPage]);

  const renderBoundingBoxes = () => {
    if (!result || !imageScale.width || !imageScale.naturalWidth) return null;

    return (
      <svg
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: imageScale.width,
          height: imageScale.height,
          cursor: "pointer",
        }}
        width={imageScale.width}
        height={imageScale.height}
      >
        {result.blocks.map((block, index) => {
          const vertices = block.vertices;
          if (vertices.length < 2) return null;

          const scaleX = imageScale.width / (imageScale.naturalWidth || 1);
          const scaleY = imageScale.height / (imageScale.naturalHeight || 1);

          const points = vertices
            .map((v) => `${v.x * scaleX},${v.y * scaleY}`)
            .join(" ");

          const isSelected = selectedBlockIndex === index;

          return (
            <g key={index}>
              <polygon
                points={points}
                fill={
                  isSelected
                    ? "rgba(37, 99, 235, 0.3)"
                    : "rgba(255, 193, 7, 0.15)"
                }
                stroke={isSelected ? "#2563eb" : "#ffc107"}
                strokeWidth="3"
                onClick={() => onBlockClick(index)}
                style={{ transition: "all 0.2s" }}
              />
            </g>
          );
        })}
      </svg>
    );
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-black">
      <Header onBackClick={onBackClick} onSettingsClick={onSettingsClick} />

      {/* Image Container */}
      <div className="flex-1 flex items-center justify-center relative bg-black overflow-hidden">
        <div className="relative w-full h-full flex items-center justify-center">
          <div className="relative" style={{ width: "fit-content", height: "fit-content" }}>
            <img
              src={`data:image/jpeg;base64,${result.image_base64}`}
              alt="Uploaded document"
              onLoad={onImageLoad}
              className="max-w-full max-h-[calc(100vh-120px)] object-contain"
              suppressHydrationWarning
            />
            {renderBoundingBoxes()}
          </div>
        </div>

        {/* Loading Overlay */}
        {formattingBlockIndex !== null && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <LoadingSpinner
              label="Formatting text…"
              size="md"
              color="yellow"
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-6 bg-white dark:bg-slate-900 border-t-4 border-yellow-500">
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mb-4">
            <button
              onClick={onPrevPage}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors font-semibold"
            >
              ← Previous
            </button>
            <span className="text-lg font-semibold text-gray-700 dark:text-gray-300">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={onNextPage}
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors font-semibold"
            >
              Next →
            </button>
          </div>
        )}
        <p
          className="text-base text-gray-600 dark:text-gray-400 text-center font-semibold"
          style={{ fontFamily: "Verdana, Arial, Helvetica, sans-serif" }}
        >
          Click on a text box to view its content
        </p>
      </div>
    </div>
  );
};

export default ImageView;
