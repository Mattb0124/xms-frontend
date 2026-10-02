"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PasswordField } from "@/components/shell/password-field";
import { PasswordReset } from "@/components/shell/password-reset";
import { INVALID_CREDENTIALS, type DeskSignInClient } from "@/components/shell/desk-sign-in-client";
import { clerkFailure, thrownFailure } from "@/lib/auth/clerk-failure";

/** Email and password, then the reset flow, laid out as the web UI sign-in. */
export function PasswordSignIn({ signIn }: { signIn: DeskSignInClient }) {
  const [mode, setMode] = useState<"sign-in" | "reset">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  if (mode === "reset") {
    return <PasswordReset signIn={signIn} initialEmail={email} onBack={() => setMode("sign-in")} />;
  }

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await signIn.password({ identifier: email, password });
      if (result.error) {
        setError(clerkFailure(result.error, INVALID_CREDENTIALS));
        return;
      }
      if (signIn.status !== "complete") {
        setError(INVALID_CREDENTIALS);
        return;
      }
      const finalized = await signIn.finalize();
      if (finalized.error) {
        setError(clerkFailure(finalized.error, INVALID_CREDENTIALS));
        return;
      }
      router.replace("/");
    } catch (caught) {
      setError(thrownFailure(caught, INVALID_CREDENTIALS));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <h1 className="xms-sign-in-title">Sign in</h1>
      <p className="xms-sign-in-lead">to continue to X Managed Services</p>
      {error ? <p className="xms-sign-in-alert xms-sign-in-alert-error">{error}</p> : null}
      <div className="xms-sign-in-stack">
        <div>
          <label className="xms-sign-in-label" htmlFor="sign-in-email">
            Email address
          </label>
          <input
            id="sign-in-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="xms-sign-in-field"
            autoComplete="email"
            required
          />
        </div>
        <div>
          <div className="xms-sign-in-row">
            <label className="xms-sign-in-label" htmlFor="sign-in-password">
              Password
            </label>
            <button
              type="button"
              className="xms-sign-in-link"
              onClick={() => {
                setError("");
                setMode("reset");
              }}
            >
              Forgot password?
            </button>
          </div>
          <PasswordField
            id="sign-in-password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
          />
        </div>
      </div>
      <button type="submit" className="xms-sign-in-submit" disabled={busy}>
        {busy ? "Loading..." : "Continue"}
      </button>
      <p className="xms-sign-in-note">No account? Ask an administrator for an invite.</p>
    </form>
  );
}
