"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronLeftIcon, ICON } from "@/components/xms/icons";
import { clerkFailure, thrownFailure } from "@/lib/auth/clerk-failure";
import { PasswordField } from "@/components/shell/password-field";
import { RESET_CODE_FAILED, RESET_FAILED, type DeskSignInClient } from "@/components/shell/desk-sign-in-client";

/**
 * Forgot-password and the code that follows it, the same two steps the web
 * UI sign-in uses. A finished reset activates the session and reloads.
 */
export function PasswordReset({
  signIn,
  initialEmail,
  onBack,
}: {
  signIn: DeskSignInClient;
  initialEmail: string;
  onBack: () => void;
}) {
  const [step, setStep] = useState<"forgot" | "code">("forgot");
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const sendCode = async () => {
    setBusy(true);
    setError("");
    try {
      const created = await signIn.create({ identifier: email });
      if (created.error) {
        setError(clerkFailure(created.error, RESET_FAILED));
        return;
      }
      const sent = await signIn.resetPasswordEmailCode.sendCode();
      if (sent.error) {
        setError(clerkFailure(sent.error, RESET_FAILED));
        return;
      }
      setStep("code");
    } catch (caught) {
      setError(thrownFailure(caught, RESET_FAILED));
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const verified = await signIn.resetPasswordEmailCode.verifyCode({ code });
      if (verified.error) {
        setError(clerkFailure(verified.error, RESET_CODE_FAILED));
        return;
      }
      const submitted = await signIn.resetPasswordEmailCode.submitPassword({ password });
      if (submitted.error) {
        setError(clerkFailure(submitted.error, RESET_CODE_FAILED));
        return;
      }
      if (signIn.status !== "complete") {
        setError("Something went wrong. Please try again.");
        return;
      }
      const finalized = await signIn.finalize();
      if (finalized.error) {
        setError(clerkFailure(finalized.error, RESET_CODE_FAILED));
        return;
      }
      setNotice("Password changed successfully. Redirecting...");
      window.setTimeout(() => router.replace("/"), 1500);
    } catch (caught) {
      setError(thrownFailure(caught, RESET_CODE_FAILED));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className="xms-sign-in-back" onClick={step === "code" ? () => setStep("forgot") : onBack}>
        <ChevronLeftIcon size={ICON.action} />
        {step === "code" ? "Back" : "Back to sign in"}
      </button>
      {error ? <p className="xms-sign-in-alert xms-sign-in-alert-error">{error}</p> : null}
      {notice ? <p className="xms-sign-in-alert xms-sign-in-alert-ok">{notice}</p> : null}
      {step === "forgot" ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void sendCode();
          }}
        >
          <h1 className="xms-sign-in-title">Reset password</h1>
          <p className="xms-sign-in-lead">
            Enter your email and we&apos;ll send you a verification code to reset your password.
          </p>
          <label className="xms-sign-in-label" htmlFor="reset-email">
            Email address
          </label>
          <input
            id="reset-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="xms-sign-in-field"
            required
            autoFocus
          />
          <button type="submit" className="xms-sign-in-submit" disabled={busy}>
            {busy ? "Sending..." : "Send reset code"}
          </button>
        </form>
      ) : (
        <ResetCode
          email={email}
          code={code}
          password={password}
          confirm={confirm}
          busy={busy}
          onCode={setCode}
          onPassword={setPassword}
          onConfirm={setConfirm}
          onSubmit={() => void reset()}
          onResend={() => void sendCode()}
        />
      )}
    </>
  );
}

function ResetCode({
  email,
  code,
  password,
  confirm,
  busy,
  onCode,
  onPassword,
  onConfirm,
  onSubmit,
  onResend,
}: {
  email: string;
  code: string;
  password: string;
  confirm: string;
  busy: boolean;
  onCode: (value: string) => void;
  onPassword: (value: string) => void;
  onConfirm: (value: string) => void;
  onSubmit: () => void;
  onResend: () => void;
}) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <h1 className="xms-sign-in-title">Enter code</h1>
      <p className="xms-sign-in-lead">
        We sent a verification code to <strong>{email}</strong>. Enter it below along with your new password.
      </p>
      <div className="xms-sign-in-stack">
        <div>
          <label className="xms-sign-in-label" htmlFor="reset-code">
            Verification code
          </label>
          <input
            id="reset-code"
            value={code}
            onChange={(event) => onCode(event.target.value)}
            className="xms-sign-in-field"
            placeholder="Enter code"
            autoComplete="one-time-code"
            required
            autoFocus
          />
        </div>
        <div>
          <label className="xms-sign-in-label" htmlFor="reset-password">
            New password
          </label>
          <PasswordField
            id="reset-password"
            value={password}
            onChange={onPassword}
            autoComplete="new-password"
            placeholder="At least 8 characters"
          />
        </div>
        <div>
          <label className="xms-sign-in-label" htmlFor="reset-confirm">
            Confirm new password
          </label>
          <input
            id="reset-confirm"
            type="password"
            value={confirm}
            onChange={(event) => onConfirm(event.target.value)}
            className="xms-sign-in-field"
            placeholder="Re-enter your new password"
            autoComplete="new-password"
            required
            minLength={8}
          />
        </div>
      </div>
      <button type="submit" className="xms-sign-in-submit" disabled={busy}>
        {busy ? "Resetting..." : "Reset password"}
      </button>
      <button type="button" className="xms-sign-in-link" disabled={busy} onClick={onResend}>
        Didn&apos;t receive a code? Resend
      </button>
    </form>
  );
}
