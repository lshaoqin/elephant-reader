"use client";

import React, { useId, useRef, useState } from "react";
import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import { getFirebaseAuth } from "@/utils/firebase-client";
import { Cross2Icon } from "@radix-ui/react-icons";

interface PhoneAuthViewProps {
  onAuthenticated?: (phoneNumber?: string) => void;
  embedded?: boolean;
  onClose?: () => void;
}

export const PhoneAuthView: React.FC<PhoneAuthViewProps> = ({
  onAuthenticated,
  embedded = false,
  onClose,
}) => {
  const [phoneNumber, setPhoneNumber] = useState("+65 ");
  const [otpCode, setOtpCode] = useState("");
  const [confirmationResult, setConfirmationResult] = useState<Awaited<
    ReturnType<typeof signInWithPhoneNumber>
  > | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
  const recaptchaContainerId = useId().replace(/:/g, "-");
  const normalizedPhone = phoneNumber.replace(/\s+/g, "").trim();

  const getOrCreateRecaptchaVerifier = () => {
    const auth = getFirebaseAuth();
    if (!auth) {
      throw new Error("Firebase is not configured. Please set Firebase env variables.");
    }

    if (recaptchaVerifierRef.current) {
      return recaptchaVerifierRef.current;
    }

    const verifier = new RecaptchaVerifier(auth, recaptchaContainerId, {
      size: "invisible",
    });

    recaptchaVerifierRef.current = verifier;
    return verifier;
  };

  const handleSendCode = async () => {
    setError(null);
    setLoading(true);

    try {
      if (!/^\+65\d{8}$/.test(normalizedPhone)) {
        throw new Error("Please enter a valid Singapore number with 8 digits.");
      }

      const auth = getFirebaseAuth();
      if (!auth) {
        throw new Error("Firebase is not configured. Please set Firebase env variables.");
      }

      const verifier = getOrCreateRecaptchaVerifier();
      const confirmation = await signInWithPhoneNumber(auth, normalizedPhone, verifier);
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

      onAuthenticated?.(result.user.phoneNumber || undefined);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid OTP";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const card = (
    <div className="w-full max-w-md rounded-xl border-2 border-blue-500 bg-white dark:bg-slate-900 p-6 sm:p-8 relative">
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-800"
          aria-label="Close phone login"
        >
          <Cross2Icon className="w-4 h-4" />
        </button>
      )}
      <h1 className="text-2xl font-bold text-blue-600 mb-2 pr-8">Sign in with phone</h1>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
        A new account will be created if the phone number is not registered.
      </p>

      <div className="space-y-4">
        <input
          type="tel"
          value={phoneNumber}
          onChange={(e) => {
            const input = e.target.value;

            if (!input.startsWith("+65")) {
              setPhoneNumber("+65 ");
              return;
            }

            const localDigits = input.slice(3).replace(/\D/g, "").slice(0, 8);
            setPhoneNumber(`+65 ${localDigits}`);
          }}
          placeholder="+6581234567"
          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-3 text-base bg-white dark:bg-slate-800"
          disabled={loading || !!confirmationResult}
        />

        {!confirmationResult ? (
          <button
            onClick={handleSendCode}
            disabled={loading || !/^\+65\d{8}$/.test(normalizedPhone)}
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

      <div id={recaptchaContainerId} className="mt-5" />
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
