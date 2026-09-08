"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ClerkSignOut } from "@/components/portal/clerk-sign-out";
import { PORTAL_SECONDARY } from "@/components/portal/primitives";
import { Skeleton } from "@/components/xms/skeleton";
import { AUTH_DEV_MODE, CLERK_ENABLED } from "@/lib/auth/dev-mode";
import { setDevToken } from "@/lib/auth/token";
import { isSurveyLink, isSurveyPath } from "@/lib/portal/csat";
import { useSurveyLink } from "@/lib/portal/survey-token";
import { cn } from "@/lib/utils";
import { xmsApi } from "@/redux/api";
import { useAppDispatch } from "@/redux/hooks";
import { usePortalMeQuery, type PortalMe } from "@/redux/portalApi";

/**
 * The portal chrome (User Experience section 4, Client Portal functional
 * 5.8): a light header carrying the account name and its accent, three
 * links, a user menu, and a short footer. Nothing from the internal shell
 * is imported. A 401 from /portal/me sends the visitor to the sign-in page.
 */
const NAV: { href: string; label: string; match: (path: string) => boolean }[] = [
  { href: "/portal", label: "Home", match: (path) => path === "/portal" },
  {
    href: "/portal/requests",
    label: "My requests",
    match: (path) => path.startsWith("/portal/requests") && path !== "/portal/requests/new",
  },
  { href: "/portal/requests/new", label: "New request", match: (path) => path === "/portal/requests/new" },
  { href: "/portal/surveys", label: "Surveys", match: (path) => path.startsWith("/portal/surveys") },
];

function accentOf(me: PortalMe | undefined): string | undefined {
  const accent = me?.account?.branding?.accent;
  return typeof accent === "string" && /^#[0-9a-f]{6}$/i.test(accent) ? accent : undefined;
}

export function PortalChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();
  const isSignIn = pathname === "/portal/sign-in";
  const link = useSurveyLink();
  // A survey email link answers without a session: no header, no nav, no
  // /portal/me. The token may be in the fragment, which the server never
  // sees, so a survey address is treated as a link until the first client
  // effect says otherwise: the alternative is asking /portal/me for a visitor
  // who has no session (security review finding 9).
  const bare = isSurveyLink(pathname, search, link.token) || (isSurveyPath(pathname) && link.pending);
  const me = usePortalMeQuery(undefined, { skip: isSignIn || bare });
  const status = me.error && typeof me.error === "object" && "status" in me.error ? me.error.status : undefined;

  useEffect(() => {
    if (!isSignIn && !bare && status === 401) router.replace("/portal/sign-in");
  }, [isSignIn, bare, status, router]);

  const accent = accentOf(me.data);
  const accountName = me.data?.account?.name;

  if (bare) {
    return (
      <div className="bg-xms-bg flex min-h-full flex-1 flex-col" data-testid="portal-bare">
        <main id="portal-main" className="flex w-full flex-1 flex-col gap-6 px-5 py-8">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="bg-xms-bg flex min-h-full flex-1 flex-col">
      <a
        href="#portal-main"
        className="bg-xms-card text-xms-ink sr-only rounded-[6px] px-3 py-2 focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50"
      >
        Skip to content
      </a>
      <header className="text-white" style={{ background: accent ?? "var(--xms-navy)" }} aria-label="Portal header">
        <div className="flex h-[60px] w-full items-center gap-6 px-5">
          <Link href="/portal" className="flex items-baseline gap-2 outline-none focus-visible:underline">
            <span className="text-[15px] font-semibold">{accountName ?? "Support portal"}</span>
            <span className="xms-mono text-[11px] uppercase tracking-wide opacity-70">XMS</span>
          </Link>
          {!isSignIn ? (
            <nav aria-label="Portal" className="ml-4 hidden items-center gap-1 sm:flex">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={item.match(pathname) ? "page" : undefined}
                  className={cn(
                    "rounded-[6px] px-3 py-1.5 text-[14px] outline-none",
                    item.match(pathname) ? "bg-white/15 font-medium" : "opacity-80 hover:opacity-100",
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          ) : null}
          {!isSignIn ? <UserMenu me={me.data} /> : null}
        </div>
      </header>
      <main id="portal-main" className="flex w-full flex-1 flex-col gap-6 px-5 py-8">
        {isSignIn || me.data ? children : status === 401 ? null : <Skeleton lines={5} className="max-w-md" />}
        {!isSignIn && me.isError && status !== 401 ? (
          <p role="alert" className="text-[14px] text-[color:var(--state-overdue-text)]">
            The portal could not load your account. Try again in a moment.
          </p>
        ) : null}
      </main>
      <footer className="border-xms-line text-xms-label w-full border-t px-5 py-4 text-[13px]">
        Need help? Open a request or reply to any email from your support team. Every message lands on your request.
      </footer>
    </div>
  );
}

function UserMenu({ me }: { me: PortalMe | undefined }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const dispatch = useAppDispatch();
  const name = me?.principal.displayName || me?.principal.email || "Account";

  const signOut = () => {
    if (AUTH_DEV_MODE) setDevToken(null);
    dispatch(xmsApi.util.resetApiState());
    setOpen(false);
    router.replace("/portal/sign-in");
  };

  return (
    <div className="relative ml-auto">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="rounded-[6px] px-3 py-1.5 text-[14px] outline-none"
      >
        {name}
      </button>
      {open ? (
        <div
          role="menu"
          className="xms-card text-xms-body absolute right-0 z-20 mt-2 w-[220px] rounded-[6px] p-2 text-[14px]"
        >
          <p className="text-xms-label px-2 py-1 text-[12px]">{me?.principal.email}</p>
          {CLERK_ENABLED ? <ClerkSignOut onDone={signOut} /> : null}
          <button type="button" role="menuitem" onClick={signOut} className={cn(PORTAL_SECONDARY, "mt-1 w-full")}>
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
