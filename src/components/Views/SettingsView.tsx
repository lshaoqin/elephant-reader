"use client";

import React, { useState, useEffect } from "react";
import { Header, GradientReader } from "@/components";

export interface TextSettings {
  fontFamily: string;
  fontSize: number;
  fontColor: string;
  lineSpacing: number;
  backgroundColor: string;
}

interface SettingsViewProps {
  settings: TextSettings;
  onSettingsChange: (settings: TextSettings) => void;
  onBackClick: () => void;
}

interface FontOption {
  name: string;
  value: string;
  checkFont?: string; // The actual font name to check for availability
}

const ALL_FONTS: FontOption[] = [
  { name: "Geist", value: "var(--font-geist-sans), sans-serif", checkFont: "Geist" },
  { name: "Verdana", value: "Verdana, sans-serif", checkFont: "Verdana" },
  { name: "Arial", value: "Arial, sans-serif", checkFont: "Arial" },
  { name: "Tahoma", value: "Tahoma, sans-serif", checkFont: "Tahoma" },
  { name: "Trebuchet MS", value: "Trebuchet MS, sans-serif", checkFont: "Trebuchet MS" },
  { name: "Segoe UI", value: "Segoe UI, sans-serif", checkFont: "Segoe UI" },
];

// Function to check if a font is available
const checkFontAvailability = (fontName: string): boolean => {
  if (typeof document === "undefined") return true; // SSR fallback
  
  // Use a test string with unique width characteristics
  const testString = "mmmmmmmmmmlli";
  const fontSize = "72px";
  
  // Create a canvas to measure text width
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  
  if (!context) return true; // Fallback if canvas not supported
  
  // Measure with a baseline font
  context.font = `${fontSize} monospace`;
  const baselineWidth = context.measureText(testString).width;
  
  // Measure with the test font
  context.font = `${fontSize} "${fontName}", monospace`;
  const testWidth = context.measureText(testString).width;
  
  // If widths differ, the font is available
  return baselineWidth !== testWidth;
};

const FONT_SIZES = [14, 16, 18, 20, 22, 24, 28, 32];

const LINE_SPACINGS = [1, 1.2, 1.5, 1.8, 2];

const BACKGROUND_COLORS = [
  { name: "Light Yellow", value: "#fffef5" },
  { name: "Light Green", value: "#f9fcfb" },
  { name: "Light Blue", value: "#f5fcff" },
  { name: "Light Gray", value: "#f7f8f9" },
  { name: "Beige", value: "#fef9ed" },
  { name: "Light Pink", value: "#fefbfb" },
  { name: "White", value: "#ffffff" },
];

const FONT_COLORS = [
  { name: "Black", value: "#1a1a1a" },
  { name: "Dark Gray", value: "#6b7280" },
  { name: "Blue", value: "#1e40af" },
  { name: "Gradient Reading", value: "gradient" },
];

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSettingsChange,
  onBackClick,
}) => {
  const [availableFonts, setAvailableFonts] = useState<FontOption[]>(ALL_FONTS);

  // Check font availability on mount
  useEffect(() => {
    const checkFonts = async () => {
      const available = ALL_FONTS.filter((font) => {
        if (!font.checkFont) return true; // Keep fonts without check requirement
        return checkFontAvailability(font.checkFont);
      });
      setAvailableFonts(available);
    };

    checkFonts();
  }, []);

  // Helper to get display color (gradient mode defaults to black for labels)
  const getDisplayColor = () => settings.fontColor === "gradient" ? "#1a1a1a" : settings.fontColor;

  const handleFontChange = (fontFamily: string) => {
    onSettingsChange({ ...settings, fontFamily });
  };

  const handleFontSizeChange = (fontSize: number) => {
    onSettingsChange({ ...settings, fontSize });
  };

  const handleFontColorChange = (fontColor: string) => {
    onSettingsChange({ ...settings, fontColor });
  };

  const handleLineSpacingChange = (lineSpacing: number) => {
    onSettingsChange({ ...settings, lineSpacing });
  };

  const handleBackgroundColorChange = (backgroundColor: string) => {
    onSettingsChange({ ...settings, backgroundColor });
  };

  const handleRestoreDefaults = () => {
    onSettingsChange({
      fontFamily: "var(--font-geist-sans), sans-serif",
      fontSize: 20,
      fontColor: "#1a1a1a",
      lineSpacing: 1.5,
      backgroundColor: "#fffef5",
    });
  };

  return (
    <div
      className="flex flex-col h-screen w-screen"
      style={{ backgroundColor: settings.backgroundColor }}
    >
      <Header onBackClick={onBackClick} showSettings={false} />

      <div className="flex-1 overflow-auto p-6 sm:p-8 lg:p-12">
        <div className="max-w-2xl mx-auto">
          <h1
            className="text-3xl font-bold mb-8"
            style={{
              fontFamily: settings.fontFamily,
              color: getDisplayColor(),
            }}
          >
            Text Settings
          </h1>

          {/* Font Selection */}
          <div className="mb-8">
            <label
              className="block text-lg font-semibold mb-4"
              style={{
                fontFamily: settings.fontFamily,
                color: getDisplayColor(),
              }}
            >
              Font Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              {availableFonts.map((font) => (
                <button
                  key={font.value}
                  onClick={() => handleFontChange(font.value)}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    settings.fontFamily === font.value
                      ? "border-blue-600 bg-blue-100 dark:bg-blue-900"
                      : "border-gray-300 dark:border-gray-600 hover:border-blue-400"
                  }`}
                >
                  <span style={{ fontFamily: font.value }}>
                    {font.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Font Size Selection */}
          <div className="mb-8">
            <label
              className="block text-lg font-semibold mb-4"
              style={{
                fontFamily: settings.fontFamily,
                color: getDisplayColor(),
              }}
            >
              Font Size: {settings.fontSize}px
            </label>
            <input
              type="range"
              min="12"
              max="40"
              step="2"
              value={settings.fontSize}
              onChange={(e) => handleFontSizeChange(Number(e.target.value))}
              className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Font Color Selection */}
          <div className="mb-8">
            <label
              className="block text-lg font-semibold mb-4"
              style={{
                fontFamily: settings.fontFamily,
                color: getDisplayColor(),
              }}
            >
              Font Colour
            </label>
            <div className="grid grid-cols-3 gap-3">
              {FONT_COLORS.map((color) => (
                <button
                  key={color.value}
                  onClick={() => handleFontColorChange(color.value)}
                  className={`p-4 rounded-lg border-2 transition-all flex items-center gap-2 ${
                    settings.fontColor === color.value
                      ? "border-blue-600 bg-blue-100 dark:bg-blue-900"
                      : "border-gray-300 dark:border-gray-600 hover:border-blue-400"
                  }`}
                >
                  <div
                    className="w-6 h-6 rounded"
                    style={{
                      backgroundColor: color.value === "gradient" ? "#f0f0f0" : color.value,
                      backgroundImage: color.value === "gradient" 
                        ? "linear-gradient(90deg, #1a1a1a, #0066ff, #ff0033)" 
                        : undefined,
                    }}
                  />
                  <span style={{ fontFamily: settings.fontFamily }}>
                    {color.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Line Spacing Selection */}
          <div className="mb-8">
            <label
              className="block text-lg font-semibold mb-4"
              style={{
                fontFamily: settings.fontFamily,
                color: getDisplayColor(),
              }}
            >
              Line Spacing: {settings.lineSpacing}x
            </label>
            <div className="grid grid-cols-5 gap-3">
              {LINE_SPACINGS.map((spacing) => (
                <button
                  key={spacing}
                  onClick={() => handleLineSpacingChange(spacing)}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    settings.lineSpacing === spacing
                      ? "border-blue-600 bg-blue-100 dark:bg-blue-900"
                      : "border-gray-300 dark:border-gray-600 hover:border-blue-400"
                  }`}
                  style={{
                    fontFamily: settings.fontFamily,
                    color: getDisplayColor(),
                  }}
                >
                  {spacing}x
                </button>
              ))}
            </div>
          </div>

          {/* Background Color Selection */}
          <div className="mb-8">
            <label
              className="block text-lg font-semibold mb-4"
              style={{
                fontFamily: settings.fontFamily,
                color: getDisplayColor(),
              }}
            >
              Background Colour
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {BACKGROUND_COLORS.map((color) => (
                <button
                  key={color.value}
                  onClick={() => handleBackgroundColorChange(color.value)}
                  className={`p-6 rounded-lg border-3 transition-all flex flex-col items-center gap-2 ${
                    settings.backgroundColor === color.value
                      ? "border-blue-600"
                      : "border-gray-300 dark:border-gray-600 hover:border-blue-400"
                  }`}
                  style={{ backgroundColor: color.value }}
                >
                  <span
                    className="text-sm font-medium"
                    style={{
                      fontFamily: settings.fontFamily,
                      color: getDisplayColor(),
                    }}
                  >
                    {color.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Restore Defaults Button */}
          <div className="mb-8 flex justify-center">
            <button
              onClick={handleRestoreDefaults}
              className="px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
              style={{ fontFamily: settings.fontFamily }}
            >
              Restore Defaults
            </button>
          </div>

          {/* Preview */}
          <div className="mt-12 p-6 border-2 border-gray-300 dark:border-gray-600 rounded-lg">
            <label
              className="block text-lg font-semibold mb-4"
              style={{
                fontFamily: settings.fontFamily,
                color: getDisplayColor(),
              }}
            >
              Preview
            </label>
            <div
              style={{
                fontFamily: settings.fontFamily,
                fontSize: `${settings.fontSize}px`,
                lineHeight: settings.lineSpacing,
                backgroundColor: settings.backgroundColor,
              }}
            >
              {settings.fontColor === "gradient" ? (
                <GradientReader
                  text="This is a preview of your text settings. You can see how the font, size, and line spacing look with your current selections."
                  onWordClick={() => {}}
                />
              ) : (
                <p
                  style={{
                    color: settings.fontColor,
                  }}
                >
                  This is a preview of your text settings. You can see how the font,
                  size, color, and line spacing look with your current selections.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsView;
