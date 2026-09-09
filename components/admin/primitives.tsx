"use client";

import { KeyText } from "@/components/xms/key-link";
import { useState, type ReactNode } from "react";
import { EmptyBanner } from "@/components/xms/empty-banner";
import { Skeleton } from "@/components/xms/skeleton";
import { StatePill } from "@/components/xms/state-pill";
import { cn } from "@/lib/utils";
import { useMe } from "@/redux/me";

/**
 * The content header bar's primary action (Design System section 4). Worn by
 * both a button and a Link, so it states its own foreground and hover
 * foreground: the element link rule in app/globals.css would otherwise colour
 * a link-styled action accent on accent. `hover:no-underline` keeps it from
 * underlining like body copy.
 */
export const PRIMARY_BUTTON =
  "bg-xms-accent hover:bg-xms-accent-hover h-[32px] rounded-[4px] px-3 text-[13px] font-medium text-white hover:text-white hover:no-underline disabled:opacity-50";
export const SECONDARY_BUTTON =
  "border-xms-line text-xms-body hover:text-xms-ink hover:bg-xms-tint hover:no-underline h-[32px] rounded-[4px] border px-3 text-[13px] disabled:opacity-50";
export const DANGER_BUTTON =
  "border-[color:var(--state-overdue-border)] text-[color:var(--state-overdue-text)] h-[32px] rounded-[4px] border px-3 text-[13px] disabled:opacity-50";
/**
 * A field control. The 420px cap is on the control, never on the page: every
 * screen is full width, so a form on a 2560px window keeps its fields at a
 * length a person can read across instead of the page narrowing to suit the
 * longest form standing on it.
 */
export const INPUT =
  "border-xms-line bg-xms-card text-xms-ink h-[34px] w-full max-w-[420px] rounded-[4px] border px-2 text-[13px] outline-none disabled:opacity-60";

/**
 * Display gating for an admin screen. Nothing renders until `me` has loaded
 * (fail closed); without the permission a notice replaces the screen. The
 * API is the authority either way.
 */
export function AdminGate({ permission, children }: { permission: string; children: ReactNode }) {
  const me = useMe();
  if (!me.permissions) return <Skeleton lines={4} className="max-w-md" />;
  if (!me.hasPermission(permission)) {
    return <EmptyBanner title="Not permitted" detail={`This screen needs the ${permission} permission.`} />;
  }
  return <>{children}</>;
}

/** Account status on the ramp: onboarding is New, active is Resolved green, suspended amber, offboarded grey. */
export function AccountStatusPill({ status }: { status: string }) {
  const ramp: Record<string, string> = {
    onboarding: "new",
    active: "resolved",
    suspended: "awaiting-client",
    offboarding: "awaiting-approval",
    offboarded: "closed",
  };
  return <StatePill state={ramp[status] ?? "closed"} label={status.charAt(0).toUpperCase() + status.slice(1)} />;
}

export function UserStatusPill({ status }: { status: string }) {
  const ramp: Record<string, string> = { invited: "new", active: "resolved", deactivated: "closed" };
  return <StatePill state={ramp[status] ?? "closed"} label={status.charAt(0).toUpperCase() + status.slice(1)} />;
}

/** Two-step action: the first click arms, the second confirms, anything else disarms. */
export function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  danger,
  disabled,
  className,
}: {
  label: string;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
  danger?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={disabled}
        aria-pressed={armed}
        onClick={() => {
          if (!armed) {
            setArmed(true);
            return;
          }
          setArmed(false);
          void onConfirm();
        }}
        onBlur={() => setArmed(false)}
        className={cn(danger ? DANGER_BUTTON : SECONDARY_BUTTON, armed && "ring-xms-accent ring-2", className)}
      >
        {armed ? (confirmLabel ?? `Confirm ${label.toLowerCase()}`) : label}
      </button>
      {armed ? <span className="text-xms-label text-[12px]">Click again to confirm</span> : null}
    </span>
  );
}

/** Record bar: a mono key, the title, a pill and the actions on the right. */
/**
 * A record screen's own heading: its key, its name and its pills, with the
 * screen's actions on the right.
 *
 * It carried a "← Roster", "← Migration", "← Report packs" link on the left.
 * The ticket record dropped its own "← Queue" in pass two and nothing missed
 * it: every screen is a row in the sidebar or in the All overlay, the browser
 * has a back button, and one of these links did not even go where it said
 * (Report review's went to the account's reports tab).
 */
export function RecordBar({
  keyText,
  title,
  pill,
  actions,
}: {
  keyText?: string;
  title: string;
  pill?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      {keyText ? <KeyText ticketKey={keyText} /> : null}
      <h1 className="text-xms-ink text-[18px] font-semibold">{title}</h1>
      {pill}
      {actions ? <div className="ml-auto flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Label-left switch row used by the settings and profile screens. */
export function SwitchRow({
  id,
  label,
  detail,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  detail?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      htmlFor={id}
      className={cn("border-xms-line flex items-center gap-3 border-b py-3 last:border-b-0", disabled && "opacity-60")}
    >
      <input
        id={id}
        type="checkbox"
        role="switch"
        aria-checked={checked}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4"
      />
      <span className="text-xms-ink text-[13px]">{label}</span>
      {detail ? <span className="text-xms-label ml-auto text-[12px]">{detail}</span> : null}
    </label>
  );
}

export function FieldRow({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-center gap-3">
      <label htmlFor={htmlFor} className="text-xms-label text-[12px]">
        {label}
      </label>
      {children}
    </div>
  );
}

export function InlineError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-[12px] text-[color:var(--state-overdue-text)]">
      {message}
    </p>
  );
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 16).replace("T", " ");
}

export function fullName(user: { first_name: string; last_name: string; email: string }): string {
  const name = `${user.first_name} ${user.last_name}`.trim();
  return name || user.email;
}
