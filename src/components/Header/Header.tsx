import React, { ReactNode } from "react";
import { ArrowLeftIcon, GearIcon, PersonIcon } from "@radix-ui/react-icons";
import { HelpPopover } from "../HelpPopover/HelpPopover";

interface HeaderProps {
  onBackClick?: () => void;
  onSettingsClick?: () => void;
  showBackButton?: boolean;
  hideBackButton?: boolean;
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
  hideBackButton = false,
  showSettings = true,
  showProfile = false,
  title,
  borderColor = "yellow",
  position = "top",
  children,
}) => {
  const shouldShowBackButton = hideBackButton ? false : showBackButton;
  const borderClass = {
    yellow: "border-b-4 border-yellow-500",
    blue: "border-b-4 border-blue-500",
    none: "",
  };

  return (
    <div
      className={`flex items-center p-6 bg-white dark:bg-slate-900 ${borderClass[borderColor]}`}
    >
      {/* Left: Back Button or Spacer */}
      <div className="flex-1">
        {shouldShowBackButton && (
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
      </div>

      {/* Center: Title (if provided) */}
      {title && (
        <h2
          className="text-2xl font-bold text-gray-800 dark:text-gray-200 flex-1 text-center"
          style={{ fontFamily: "Verdana, Arial, Helvetica, sans-serif" }}
        >
          {title}
        </h2>
      )}

      {/* Custom children */}
      {children}

      {/* Right: Settings & Profile Icons */}
      <div className="flex-1 flex justify-end gap-6 items-center">
        <HelpPopover />
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
