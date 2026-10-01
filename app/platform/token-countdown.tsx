"use client";

import { useEffect, useState } from "react";

/** The class the clock and its bar carry: expired, under two minutes left, or neither. */
function countdownState(remainingMs: number): string {
  if (remainingMs <= 0) return "is-expired";
  if (remainingMs < 120_000) return "is-soon";
  return "";
}

/**
 * The clock on the proof page.
 *
 * Everything else on that page is finished HTML from the server. This one
 * ticks, because a timestamp that says "expires at 15:42:07Z" is easy to
 * read past, and a number counting down in front of you is not. The point it
 * makes is that the database credential is minted per connection and dies in
 * minutes, it is not a password sitting in a secret store.
 *
 * It receives two ISO strings and nothing else. No URL, no service name, no
 * configuration: this is the boundary where server-only data stops, and it
 * carries across only what a clock needs.
 *
 * The first render deliberately shows nothing but a placeholder. The server
 * and the browser have different clocks, and rendering "13m 58s" on one and
 * "13m 51s" on the other is a hydration mismatch. The real value appears on
 * the first timer tick, a few milliseconds later.
 */
export function TokenCountdown({ issuedAt, expiresAt }: { issuedAt: string; expiresAt: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const kick = setTimeout(() => setNow(Date.now()), 0);
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => {
      clearTimeout(kick);
      clearInterval(id);
    };
  }, []);

  const expiry = new Date(expiresAt).getTime();
  const issued = new Date(issuedAt).getTime();

  if (now === null || Number.isNaN(expiry)) {
    return (
      <div>
        <span className="countdown-label">Expires in</span>
        <div className="countdown" suppressHydrationWarning>
          --m --s
        </div>
      </div>
    );
  }

  const remainingMs = expiry - now;
  const remaining = Math.max(0, Math.floor(remainingMs / 1_000));
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  const total = Number.isNaN(issued) ? 0 : expiry - issued;
  const fraction = total > 0 ? Math.max(0, Math.min(1, remainingMs / total)) : 0;

  const state = countdownState(remainingMs);

  return (
    <div>
      <span className="countdown-label">{remainingMs <= 0 ? "Expired" : "Expires in"}</span>
      <div className={`countdown ${state}`} suppressHydrationWarning>
        {remainingMs <= 0 ? (
          <span>00m 00s</span>
        ) : (
          <span>
            {String(minutes).padStart(2, "0")}m {String(seconds).padStart(2, "0")}s
          </span>
        )}
      </div>
      <div className={`countdown-bar ${state}`} aria-hidden="true">
        <span style={{ width: `${(fraction * 100).toFixed(1)}%` }} />
      </div>
    </div>
  );
}
