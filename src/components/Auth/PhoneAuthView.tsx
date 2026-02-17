"use client";

import React, { useRef, useState } from "react";
import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import { getFirebaseAuth } from "@/utils/firebase-client";

interface PhoneAuthViewProps {
  onAuthenticated?: () => void;
}

export const PhoneAuthView: React.FC<PhoneAuthViewProps> = ({ onAuthenticated }) => {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [confirmationResult, setConfirmationResult] = useState<Awaited<
    ReturnType<typeof signInWithPhoneNumber>
  > | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

  const getOrCreateRecaptchaVerifier = () => {
    const auth = getFirebaseAuth();
    if (!auth) {
      throw new Error("Firebase is not configured. Please set Firebase env variables.");
    }

    if (recaptchaVerifierRef.current) {
      return recaptchaVerifierRef.current;
    }

    const verifier = new RecaptchaVerifier(auth, "firebase-recaptcha", {
      size: "normal",
    });

    recaptchaVerifierRef.current = verifier;
    return verifier;
  };

  const handleSendCode = async () => {
    setError(null);
    setLoading(true);

    try {
      const auth = getFirebaseAuth();
      if (!auth) {
        throw new Error("Firebase is not configured. Please set Firebase env variables.");
      }

      const verifier = getOrCreateRecaptchaVerifier();
      const confirmation = await signInWithPhoneNumber(auth, phoneNumber.trim(), verifier);
      setConfirmationResult(confirmation);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send OTP";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!confirmationResult) return;

    setError(null);
    setLoading(true);

    try {
      const result = await confirmationResult.confirm(otpCode.trim());
      const idToken = await result.user.getIdToken(true);

      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: "Failed to create session" }));
        throw new Error(data.error || "Failed to create session");
      }

      onAuthenticated?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid OTP";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-screen items-center justify-center bg-white dark:bg-slate-950 p-6">
      <div className="w-full max-w-md rounded-xl border-2 border-blue-500 bg-white dark:bg-slate-900 p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-blue-600 mb-2">Sign in with phone</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
          Enter your phone number in E.164 format (for example, +60123456789).
        </p>

        <div className="space-y-4">
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="+60123456789"
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-3 text-base bg-white dark:bg-slate-800"
            disabled={loading || !!confirmationResult}
          />

          {!confirmationResult ? (
            <button
              onClick={handleSendCode}
              disabled={loading || !phoneNumber.trim()}
              className="w-full rounded-lg bg-blue-600 px-4 py-3 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Sending code..." : "Send OTP"}
            </button>
          ) : (
            <>
              <input
                type="text"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                placeholder="Enter 6-digit OTP"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-3 text-base bg-white dark:bg-slate-800"
                disabled={loading}
              />
              <button
                onClick={handleVerifyCode}
                disabled={loading || !otpCode.trim()}
                className="w-full rounded-lg bg-blue-600 px-4 py-3 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Verifying..." : "Verify OTP"}
              </button>
            </>
          )}
        </div>

        {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div id="firebase-recaptcha" className="mt-5" />
      </div>
    </div>
  );
};

export default PhoneAuthView;
