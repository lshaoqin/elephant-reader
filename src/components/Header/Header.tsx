import React, { ReactNode } from "react";
import { ArrowLeftIcon, GearIcon, PersonIcon } from "@radix-ui/react-icons";

interface HeaderProps {
  onBackClick?: () => void;
  onSettingsClick?: () => void;
  showBackButton?: boolean;
  showSettings?: boolean;
  showProfile?: boolean;
  title?: string;
  borderColor?: "yellow" | "blue" | "none";
  position?: "top" | "bottom";
  children?: ReactNode;
}

export const Header: React.FC<HeaderProps> = ({
  onBackClick,
  onSettingsClick,
  showBackButton = true,
  showSettings = true,
  showProfile = false,
  title,
  borderColor = "yellow",
  position = "top",
  children,
}) => {
  const borderClass = {
    yellow: "border-yellow-500",
    blue: "border-blue-500",
    none: "",
  };

  const borderPosition = position === "top" ? "border-b-4" : "border-t-4";

  return (
    <div
      className={`flex items-center justify-between p-6 bg-white dark:bg-slate-900 ${borderPosition} ${borderClass[borderColor]}`}
    >
      {/* Left: Back Button */}
      {showBackButton && (
        <button
          onClick={onBackClick}
          className="flex items-center gap-3 text-blue-600 dark:text-blue-400 hover:text-yellow-500 transition-colors"
        >
          <ArrowLeftIcon className="w-7 h-7" />
          <span
            className="text-lg font-bold"
            style={{ fontFamily: "Verdana, Arial, Helvetica, sans-serif" }}
          >
            Back
          </span>
        </button>
      )}

      {/* Center: Title (if provided) */}
      {title && !showBackButton && (
        <h2
          className="text-2xl font-bold text-gray-800 dark:text-gray-200"
          style={{ fontFamily: "Verdana, Arial, Helvetica, sans-serif" }}
        >
          {title}
        </h2>
      )}

      {/* Custom children */}
      {children}

      {/* Right: Settings & Profile Icons */}
      <div className="flex gap-6">
        {showSettings && (
          <button onClick={onSettingsClick} className="text-gray-600 dark:text-gray-400 hover:text-yellow-500 transition-colors">
            <GearIcon className="w-7 h-7" />
          </button>
        )}
        {showProfile && (
          <button className="text-gray-600 dark:text-gray-400 hover:text-yellow-500 transition-colors">
            <PersonIcon className="w-7 h-7" />
          </button>
        )}
      </div>
    </div>
  );
};

export default Header;
