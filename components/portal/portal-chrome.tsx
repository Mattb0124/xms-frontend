"use client";

import Image from "next/image";
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
 * 5.8): the account's name and accent, the nav, a user menu and a short
 * footer. A 401 from /portal/me sends the visitor to the sign-in page.
 *
 * The bar wears the same chrome as the internal one as of 2026-09-12, at
 * Matt's request. It looked like a different product: a 60px band of flat
 * navy with text links and the user's name as bare text, beside an internal
 * bar that had the wordmark, drawn controls and an avatar.
 *
 * Nothing from the internal shell is imported, and that rule is not bent
 * here: the look comes from the recipes in the vendored `aix-tokens.css`
 * (`aix-app-header`, `aix-header-row`, `aix-nav-pill`, `aix-avatar`), which
 * are CSS and carry no view model. The portal still renders portal view
 * models only, so no internal field can reach a client through it.
 *
 * What the accent does changed with it. Design System 4 had the account's
 * accent paint the whole header band, to keep per-account colour out of the
 * working UI. Painting the band is what made the portal read as a different
 * product, so the accent is now the identity dot beside the account name,
 * which is the pattern the internal lists already use for the same job
 * (Wireframes 8.3). Per-account colour is still confined to this header.
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
      <header className="aix-app-header text-white" aria-label="Portal header" role="banner">
        <span aria-hidden className="aix-header-glow" />
        <div className="aix-header-row">
          {/* The Hackett logo, as on the internal bar: the portal is a service
              Hackett provides, and the client is told whose it is. It is the
              way back to the portal home. */}
          <Link href="/portal" className="flex shrink-0 items-center" aria-label="The Hackett Group, portal home">
            <Image
              src="/thehackettgroup_logo.svg"
              alt="The Hackett Group"
              width={148}
              height={18}
              priority
              unoptimized
            />
          </Link>
          {/* Whose portal this is, with the account's own accent as the dot.
              The name is never replaced by the colour: a client reading a
              support portal should see their name, not a hue they have to
              learn. */}
          {accountName ? (
            <span className="flex min-w-0 shrink items-center gap-2 pl-1" data-testid="portal-account">
              <span
                aria-hidden
                className="h-[8px] w-[8px] shrink-0 rounded-full"
                style={{ background: accent ?? "var(--xms-accent)" }}
              />
              <span className="truncate text-[14px] font-medium text-white/90">{accountName}</span>
            </span>
          ) : null}
          {!isSignIn ? (
            <nav aria-label="Portal" className="aix-header-nav hidden sm:flex">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={item.match(pathname) ? "page" : undefined}
                  aria-pressed={item.match(pathname)}
                  className="aix-nav-pill inline-flex items-center no-underline"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          ) : null}
          {!isSignIn ? (
            <div className="aix-header-right">
              <UserMenu me={me.data} />
            </div>
          ) : null}
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
      <footer className="border-xms-line text-xms-label w-full border-t px-5 py-4 text-[14px]">
        Need help? Open a request or reply to any email from your support team. Every message lands on your request.
      </footer>
    </div>
  );
}

/**
 * Initials for the avatar disc. Two letters where there are two words, one
 * where there is one, and the first letter of an address where the name is an
 * address, which is what the portal has for a user who has not been given a
 * display name.
 */
function initialsOf(name: string): string {
  const words = name
    .replace(/@.*$/, "")
    .split(/[\s._-]+/)
    .filter(Boolean);
  if (words.length === 0) return "?";
  const letters =
    words.length === 1 ? words[0].slice(0, 1) : words[0].slice(0, 1) + words[words.length - 1].slice(0, 1);
  return letters.toUpperCase();
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
    <div className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${name}`}
        onClick={() => setOpen((value) => !value)}
        className="aix-avatar"
      >
        <span className="aix-avatar-disc">{initialsOf(name)}</span>
      </button>
      {open ? (
        <div
          role="menu"
          className="xms-card text-xms-body absolute right-0 z-20 mt-2 w-[220px] rounded-[6px] p-2 text-[14px]"
        >
          {/* The name moved in here when the bar took the avatar: an avatar
              alone says who you are only to someone who already knows. */}
          <p className="text-xms-ink px-2 py-1 text-[14px] font-medium">{name}</p>
          <p className="text-xms-label px-2 pb-1 text-[14px]">{me?.principal.email}</p>
          {CLERK_ENABLED ? <ClerkSignOut onDone={signOut} /> : null}
          <button type="button" role="menuitem" onClick={signOut} className={cn(PORTAL_SECONDARY, "mt-1 w-full")}>
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
