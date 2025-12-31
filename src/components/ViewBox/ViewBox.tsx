import React, { ReactNode } from "react";

interface ViewBoxProps {
  children: ReactNode;
  variant?: "primary" | "error" | "success" | "warning";
  className?: string;
  padding?: "sm" | "md" | "lg";
}

export const ViewBox: React.FC<ViewBoxProps> = ({
  children,
  variant = "primary",
  className = "",
  padding = "md",
}) => {
  const paddingStyles = {
    sm: "p-4",
    md: "p-6",
    lg: "p-8",
  };

  const variantStyles = {
    primary: "bg-white dark:bg-slate-900 border-2 border-blue-200 dark:border-blue-900 rounded-lg",
    error:
      "bg-red-100 dark:bg-red-950 border-2 border-red-300 dark:border-red-800 rounded-lg",
    success:
      "bg-green-100 dark:bg-green-950 border-2 border-green-300 dark:border-green-800 rounded-lg",
    warning:
      "bg-yellow-100 dark:bg-yellow-950 border-2 border-yellow-300 dark:border-yellow-800 rounded-lg",
  };

  return (
    <div
      className={`${variantStyles[variant]} ${paddingStyles[padding]} ${className}`}
    >
      {children}
    </div>
  );
};

interface TextViewBoxProps {
  children: ReactNode;
  className?: string;
}

export const TextViewBox: React.FC<TextViewBoxProps> = ({
  children,
  className = "",
}) => {
  const dyslexiaStyles: React.CSSProperties = {
    fontFamily: "Verdana, Arial, Helvetica, sans-serif",
    fontSize: "clamp(18px, 2.5vw, 24px)",
    lineHeight: 1.8,
    letterSpacing: "0.03em",
    wordSpacing: "0.12em",
    backgroundColor: "#f7fbf6",
    color: "#0f172a",
    padding: "2rem",
    borderRadius: 8,
    textAlign: "left",
    whiteSpace: "pre-wrap",
    overflowWrap: "break-word",
  };

  return (
    <div style={dyslexiaStyles} className={`mx-auto max-w-4xl w-full ${className}`}>
      {children}
    </div>
  );
};

export default ViewBox;
