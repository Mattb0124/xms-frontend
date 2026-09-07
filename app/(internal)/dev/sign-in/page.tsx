"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Panel } from "@/components/xms/panel";
import { AUTH_DEV_MODE, CLERK_ENABLED } from "@/lib/auth/dev-mode";
import { setDevToken } from "@/lib/auth/token";
import { xmsApi } from "@/redux/api";
import { useAppDispatch } from "@/redux/hooks";

/**
 * Development sign-in: paste a token minted by the backend's `pnpm dev:token`
 * (a locally signed dev JWT the API accepts only when its own dev-mode flag is
 * set). Rendered only when NEXT_PUBLIC_AUTH_DEV_MODE=true; the module that
 * defines that flag refuses production builds.
 */
export default function DevSignInPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [token, setToken] = useState("");

  if (!AUTH_DEV_MODE) {
    return (
      <Panel title="Development sign-in" caption="Not available">
        <p className="text-xms-body text-[13px]">
          {CLERK_ENABLED
            ? "Sign in through Clerk."
            : "Set NEXT_PUBLIC_AUTH_DEV_MODE=true in .env.local to use a pasted token."}
        </p>
      </Panel>
    );
  }

  return (
    <Panel title="Development sign-in" caption="Local only">
      <form
        className="flex max-w-xl flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          setDevToken(token.trim() || null);
          dispatch(xmsApi.util.invalidateTags(["Me"]));
          router.push("/");
        }}
      >
        <label htmlFor="dev-token" className="text-xms-label text-[12px]">
          Bearer token from <code className="xms-mono">pnpm dev:token</code> in the backend
        </label>
        <textarea
          id="dev-token"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          rows={5}
          className="border-xms-line bg-xms-card text-xms-ink xms-mono rounded-[4px] border p-2 text-[12px]"
          placeholder="eyJhbGciOi..."
        />
        <div className="flex gap-2">
          <button
            type="submit"
            className="bg-xms-accent hover:bg-xms-accent-hover h-[32px] rounded-[4px] px-3 text-[13px] font-medium text-white"
          >
            Use token
          </button>
          <button
            type="button"
            onClick={() => {
              setDevToken(null);
              dispatch(xmsApi.util.resetApiState());
              setToken("");
            }}
            className="border-xms-line text-xms-body h-[32px] rounded-[4px] border px-3 text-[13px]"
          >
            Clear
          </button>
        </div>
      </form>
    </Panel>
  );
}
