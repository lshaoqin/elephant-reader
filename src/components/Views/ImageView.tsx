"use client";

import React, { useEffect, useRef } from "react";
import { ZoomInIcon, ZoomOutIcon } from "@radix-ui/react-icons";
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
  onUseFullText?: () => void;
  settings: TextSettings;
  currentPage?: number;
  totalPages?: number;
  onNextPage?: () => void;
  onPrevPage?: () => void;
  onCancelFormatting?: () => void;
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
  onUseFullText,
  settings,
  currentPage = 1,
  totalPages = 1,
  onNextPage,
  onPrevPage,
  onCancelFormatting,
}) => {
  const MIN_ZOOM = 1;
  const MAX_ZOOM = 3;
  const ZOOM_STEP = 0.3;
  const IMAGE_CONTAINER_PADDING = 16;

  const imageKey = `${currentPage}:${result.image_base64.slice(0, 48)}`;
  const [zoomByImageKey, setZoomByImageKey] = React.useState<Record<string, number>>({});
  const zoom = zoomByImageKey[imageKey] ?? 1;
  const [containerSize, setContainerSize] = React.useState({ width: 0, height: 0 });
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef({
    isDragging: false,
    hasMoved: false,
    startX: 0,
    startY: 0,
    startScrollLeft: 0,
    startScrollTop: 0,
  });
  const suppressBlockClickRef = useRef(false);

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

  const updateContainerSize = React.useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const nextWidth = container.clientWidth;
    const nextHeight = container.clientHeight;

    setContainerSize((prev) => {
      if (prev.width === nextWidth && prev.height === nextHeight) {
        return prev;
      }
      return { width: nextWidth, height: nextHeight };
    });
  }, []);

  useEffect(() => {
    updateContainerSize();
    window.addEventListener("resize", updateContainerSize);
    return () => {
      window.removeEventListener("resize", updateContainerSize);
    };
  }, [updateContainerSize]);

  useEffect(() => {
    updateContainerSize();
  }, [result.image_base64, currentPage, updateContainerSize]);

  const naturalWidth = imageScale.naturalWidth || 0;
  const naturalHeight = imageScale.naturalHeight || 0;
  const availableWidth = Math.max(containerSize.width - IMAGE_CONTAINER_PADDING, 1);
  const availableHeight = Math.max(containerSize.height - IMAGE_CONTAINER_PADDING, 1);

  const fitScale =
    naturalWidth > 0 && naturalHeight > 0
      ? Math.min(availableWidth / naturalWidth, availableHeight / naturalHeight)
      : 1;

  const baseWidth = naturalWidth > 0 ? naturalWidth * fitScale : imageScale.width || 0;
  const baseHeight = naturalHeight > 0 ? naturalHeight * fitScale : imageScale.height || 0;
  const renderedWidth = baseWidth > 0 ? baseWidth * zoom : 0;
  const renderedHeight = baseHeight > 0 ? baseHeight * zoom : 0;
  const canPanOrScroll = renderedWidth > availableWidth + 1 || renderedHeight > availableHeight + 1;
  const zoomInDisabled = zoom >= MAX_ZOOM - 0.001;
  const zoomOutDisabled = zoom <= MIN_ZOOM + 0.001;

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || canPanOrScroll) return;

    container.scrollLeft = 0;
    container.scrollTop = 0;
  }, [canPanOrScroll, renderedWidth, renderedHeight]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!canPanOrScroll) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;

    const container = scrollContainerRef.current;
    if (!container) return;

    dragStateRef.current.isDragging = true;
    dragStateRef.current.hasMoved = false;
    dragStateRef.current.startX = e.clientX;
    dragStateRef.current.startY = e.clientY;
    dragStateRef.current.startScrollLeft = container.scrollLeft;
    dragStateRef.current.startScrollTop = container.scrollTop;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const container = scrollContainerRef.current;
    const dragState = dragStateRef.current;

    if (!container || !dragState.isDragging) return;

    const deltaX = e.clientX - dragState.startX;
    const deltaY = e.clientY - dragState.startY;

    if (!dragState.hasMoved && (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4)) {
      dragState.hasMoved = true;
      suppressBlockClickRef.current = true;
    }

    if (!dragState.hasMoved) return;

    e.preventDefault();
    container.scrollLeft = dragState.startScrollLeft - deltaX;
    container.scrollTop = dragState.startScrollTop - deltaY;
  };

  const handlePointerEnd = () => {
    const dragState = dragStateRef.current;

    if (!dragState.isDragging) return;
    dragState.isDragging = false;

    const hadMoved = dragState.hasMoved;
    dragState.hasMoved = false;

    if (hadMoved) {
      window.setTimeout(() => {
        suppressBlockClickRef.current = false;
      }, 0);
    }
  };

  const handleBlockClick = (blockIndex: number) => {
    if (suppressBlockClickRef.current) return;
    onBlockClick(blockIndex);
  };

  const renderBoundingBoxes = () => {
    if (!result || !renderedWidth || !naturalWidth || !naturalHeight) return null;

    return (
      <svg
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          cursor: "pointer",
        }}
        viewBox={`0 0 ${renderedWidth} ${renderedHeight}`}
        preserveAspectRatio="none"
      >
        {result.blocks.map((block, index) => {
          const vertices = block.vertices;
          if (vertices.length < 2) return null;

          const scaleX = renderedWidth / naturalWidth;
          const scaleY = renderedHeight / naturalHeight;

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
                onClick={() => handleBlockClick(index)}
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
      <div className="flex-1 relative bg-black overflow-hidden">
        <div
          className="absolute z-40 flex flex-col gap-3 sm:gap-4"
          style={{
            right: "clamp(12px, 3vw, 40px)",
            bottom: "clamp(12px, 2.5vw, 20px)",
          }}
        >
          <button
            onClick={() => {
              setZoomByImageKey((prev) => ({
                ...prev,
                [imageKey]: Math.min(MAX_ZOOM, zoom + ZOOM_STEP),
              }));
            }}
            disabled={zoomInDisabled}
            className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 rounded-full border-2 flex items-center justify-center transition-colors bg-white hover:bg-blue-50 text-blue-700 shadow-lg border-blue-600 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
            aria-label="Zoom in"
            title="Zoom in"
          >
            <ZoomInIcon className="w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 lg:w-10 lg:h-10" />
          </button>
          <button
            onClick={() => {
              setZoomByImageKey((prev) => ({
                ...prev,
                [imageKey]: Math.max(MIN_ZOOM, zoom - ZOOM_STEP),
              }));
            }}
            disabled={zoomOutDisabled}
            className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 rounded-full border-2 flex items-center justify-center transition-colors bg-white hover:bg-blue-50 text-blue-700 shadow-lg border-blue-600 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
            aria-label="Zoom out"
            title="Zoom out"
          >
            <ZoomOutIcon className="w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 lg:w-10 lg:h-10" />
          </button>
        </div>

        <div
          ref={scrollContainerRef}
          className={`w-full h-full ${canPanOrScroll ? "overflow-auto cursor-grab active:cursor-grabbing touch-none" : "overflow-hidden cursor-default"}`}
          style={{ WebkitOverflowScrolling: "touch" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
        >
          <div className="min-w-full min-h-full flex items-center justify-center p-2">
            <div
              className="relative inline-block"
              style={{
                width: renderedWidth > 0 ? `${renderedWidth}px` : undefined,
                height: renderedHeight > 0 ? `${renderedHeight}px` : undefined,
              }}
            >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:image/jpeg;base64,${result.image_base64}`}
              alt="Uploaded document"
              onLoad={onImageLoad}
              className="block w-full h-full"
              suppressHydrationWarning
            />
            {renderBoundingBoxes()}
            </div>
          </div>
        </div>

        {/* Loading Overlay */}
        {formattingBlockIndex !== null && (
          <div className="absolute inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center">
            <div className="flex flex-col items-center gap-6">
              <LoadingSpinner
                label="Formatting text…"
                size="lg"
                color="white"
              />
              {onCancelFormatting && (
                <button
                  onClick={onCancelFormatting}
                  className="px-6 py-3 border-2 border-blue-400 rounded-lg hover:bg-blue-400/10 text-white font-semibold transition-colors"
                  style={{ fontFamily: settings.fontFamily }}
                >
                  Cancel
                </button>
              )}
            </div>
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
          <span>Click on a text box to view its content or </span>
          {onUseFullText && (
            <span className="inline-flex items-center whitespace-nowrap">
              <button
                onClick={onUseFullText}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold align-middle"
              >
                Use Full Text
              </button>
            </span>
          )}
        </p>
      </div>
    </div>
  );
};

export default ImageView;
