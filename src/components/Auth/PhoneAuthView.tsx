"use client";

import React, { useState } from "react";
import { Cross2Icon } from "@radix-ui/react-icons";

interface PhoneAuthViewProps {
  onAuthenticated?: (username?: string) => void;
  embedded?: boolean;
  onClose?: () => void;
}

const normalizeUsername = (value: string) => value.trim();

export const PhoneAuthView: React.FC<PhoneAuthViewProps> = ({
  onAuthenticated,
  embedded = false,
  onClose,
}) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setError(null);
    setLoading(true);

    try {
      const nextUsername = normalizeUsername(username);
      const nextPassword = password.trim();

      if (!nextUsername || !nextPassword) {
        throw new Error("Please enter both your username and password.");
      }

      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: nextUsername, password: nextPassword }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Invalid username or password");
      }

      onAuthenticated?.(nextUsername);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to sign in";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = () => {
    onAuthenticated?.();
  };

  const card = (
    <div className="w-full max-w-md rounded-xl border-2 border-blue-500 bg-white dark:bg-slate-900 p-6 sm:p-8 relative">
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-800"
          aria-label="Close sign in"
        >
          <Cross2Icon className="w-4 h-4" />
        </button>
      )}
      <h1 className="text-2xl font-bold text-blue-600 mb-2 pr-8">Sign in</h1>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
        Use your configured username and password. Existing phone-number accounts can keep the phone number as the username.
      </p>

      <div className="space-y-4">
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username or phone number"
          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-3 text-base bg-white dark:bg-slate-800"
          disabled={loading}
        />

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-3 text-base bg-white dark:bg-slate-800"
          disabled={loading}
        />

        <button
          onClick={handleSignIn}
          disabled={loading || !username.trim() || !password.trim()}
          className="w-full rounded-lg bg-blue-600 px-4 py-3 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </div>

      {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="mt-6 flex items-center justify-center">
        <div className="h-px w-full bg-gray-300 dark:bg-gray-700"></div>
        <span className="px-3 text-sm text-gray-500">OR</span>
        <div className="h-px w-full bg-gray-300 dark:bg-gray-700"></div>
      </div>

      <button
        onClick={handleGuestLogin}
        disabled={loading}
        className="mt-6 w-full rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-3 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Signing in..." : "Continue as Guest"}
      </button>
    </div>
  );

  if (embedded) {
    return card;
  }

  return (
    <div className="flex min-h-screen w-screen items-center justify-center bg-white dark:bg-slate-950 p-6">
      {card}
    </div>
  );
};

export default PhoneAuthView;
