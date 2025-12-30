import React from "react";
import { LoadingSpinner } from "@/components";

interface TTSLoaderProps {
  status: "generating" | "aligning" | null;
  progress: number;
}

export const TTSLoader: React.FC<TTSLoaderProps> = ({ status, progress }) => {
  if (!status) return null;

  const statusLabel =
    status === "generating" ? "Generating audio..." : "Aligning timestamps...";

  return (
    <div className="flex flex-col items-center gap-4">
      <LoadingSpinner label={statusLabel} size="md" color="blue" />
      <div className="w-48 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 dark:bg-blue-400 transition-all duration-300"
          style={{ width: `${Math.min(progress * 10, 100)}%` }}
        />
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        {status === "aligning" ? "Processing word timings..." : "Processing audio..."}
      </p>
    </div>
  );
};

export default TTSLoader;
