"use client";

import { useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { SECONDARY_BUTTON } from "@/components/admin/primitives";
import { initials } from "@/components/xms/actor-chip";
import { ClerkPortrait } from "@/components/xms/clerk-portrait";
import { AUTH_DEV_MODE, CLERK_ENABLED } from "@/lib/auth/dev-mode";
import { setDevToken } from "@/lib/auth/token";
import { xmsApi } from "@/redux/api";
import { useAppDispatch } from "@/redux/hooks";
import { useMe } from "@/redux/me";

interface AccountMenuState {
  open: boolean;
  toggle: () => void;
  close: () => void;
}

const AccountMenuContext = createContext<AccountMenuState | null>(null);

/**
 * The account button lives in the finder bar and the menu hangs below it.
 * The bar clips overflow, so the menu cannot be a child of the button.
 */
export function DeskAccountProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((current) => !current), []);
  const value = useMemo(() => ({ open, toggle, close }), [open, toggle, close]);
  return <AccountMenuContext.Provider value={value}>{children}</AccountMenuContext.Provider>;
}

function useAccountMenu(): AccountMenuState {
  const value = useContext(AccountMenuContext);
  if (!value) throw new Error("Desk account menu rendered outside DeskAccountProvider");
  return value;
}

export function DeskAccountButton() {
  const menu = useAccountMenu();
  const me = useMe();
  const letters = me.principal?.displayName ? initials(me.principal.displayName) : "?";
  return (
    <button
      type="button"
      aria-label="Account menu"
      aria-haspopup="menu"
      aria-expanded={menu.open}
      onClick={menu.toggle}
      className="aix-avatar"
    >
      {CLERK_ENABLED ? <ClerkPortrait initials={letters} /> : <span className="aix-avatar-disc">{letters}</span>}
    </button>
  );
}

export function DeskAccountMenu() {
  const menu = useAccountMenu();
  const me = useMe();
  const router = useRouter();
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!menu.open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") menu.close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu]);

  if (!menu.open) return null;

  const name = me.principal?.displayName ?? "Account";
  const email = me.principal?.email;
  const clear = () => {
    if (AUTH_DEV_MODE) setDevToken(null);
    dispatch(xmsApi.util.resetApiState());
    menu.close();
  };

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Close account menu"
        className="fixed inset-0 z-20 cursor-default"
        onClick={menu.close}
      />
      <div
        role="menu"
        aria-label="Account"
        className="xms-card text-xms-ink absolute top-full right-4 z-30 mt-1 w-64 p-2 text-body"
      >
        <p className="text-xms-ink px-2 py-1 font-medium">{name}</p>
        {email && email !== name ? <p className="text-xms-label px-2 pb-2">{email}</p> : null}
        {CLERK_ENABLED ? <ClerkLeave onClear={clear} /> : null}
        {!CLERK_ENABLED ? (
          <button
            type="button"
            role="menuitem"
            className={`${SECONDARY_BUTTON} w-full`}
            onClick={() => {
              clear();
              router.replace("/sign-in");
            }}
          >
            Sign out
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ClerkLeave({ onClear }: { onClear: () => void }) {
  const clerk = useClerk();
  return (
    <button
      type="button"
      role="menuitem"
      className={`${SECONDARY_BUTTON} w-full`}
      onClick={() => {
        onClear();
        void clerk.signOut({ redirectUrl: "/sign-in" });
      }}
    >
      Sign out
    </button>
  );
}
