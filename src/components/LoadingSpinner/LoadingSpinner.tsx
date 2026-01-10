import React from "react";

interface LoadingSpinnerProps {
  label?: string;
  size?: "sm" | "md" | "lg";
  color?: "blue" | "yellow" | "white";
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  label = "Loading...",
  size = "md",
  color = "blue",
}) => {
  const sizeStyles = {
    sm: "w-8 h-8 border-2",
    md: "w-16 h-16 border-4",
    lg: "w-24 h-24 border-4",
  };

  const colorStyles = {
    blue: "border-blue-200 dark:border-blue-900 border-t-blue-600 dark:border-t-blue-400",
    yellow:
      "border-yellow-200 border-t-yellow-500",
    white: "border-white/20 border-t-white",
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="animate-spin">
        <div
          className={`${sizeStyles[size]} ${colorStyles[color]} rounded-full`}
        ></div>
      </div>
      {label && (
        <div className="px-4 py-2 bg-black/70 rounded-lg">
          <p
            className={`text-white font-semibold ${
              size === "lg" ? "text-xl" : size === "sm" ? "text-sm" : "text-base"
            }`}
            style={{ fontFamily: "Verdana, Arial, Helvetica, sans-serif" }}
          >
            {label}
          </p>
        </div>
      )}
    </div>
  );
};

export default LoadingSpinner;
