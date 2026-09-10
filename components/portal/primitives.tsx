import { StatePill } from "@/components/xms/state-pill";
import { clientStatus } from "@/lib/portal/client-language";
import { cn } from "@/lib/utils";

/** Buttons and inputs for the portal: the house tokens, larger targets, visible focus. */
export const PORTAL_PRIMARY =
  "bg-xms-accent hover:bg-xms-accent-hover inline-flex h-[40px] items-center justify-center rounded-[6px] px-4 text-[14px] font-medium text-white outline-none disabled:opacity-50";
export const PORTAL_SECONDARY =
  "border-xms-line text-xms-body hover:bg-xms-control-hover inline-flex h-[40px] items-center justify-center rounded-[6px] border px-4 text-[14px] outline-none disabled:opacity-50";
export const PORTAL_DANGER =
  "border-[color:var(--state-overdue-border)] text-[color:var(--state-overdue-text)] inline-flex h-[40px] items-center justify-center rounded-[6px] border px-4 text-[14px] outline-none disabled:opacity-50";
export const PORTAL_INPUT =
  "border-xms-line bg-xms-card text-xms-ink h-[40px] w-full rounded-[6px] border px-3 text-[14px] outline-none disabled:opacity-60";
export const PORTAL_TEXTAREA =
  "border-xms-line bg-xms-card text-xms-ink w-full rounded-[6px] border p-3 text-[14px] outline-none disabled:opacity-60";

/** Client status pill: the internal state chooses the ramp step, the label is client language. */
export function ClientStatusPill({ state, className }: { state: string; className?: string }) {
  return <StatePill state={state} label={clientStatus(state)} className={className} />;
}

export function PortalCard({
  title,
  children,
  className,
  actions,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}) {
  return (
    <section className={cn("xms-card flex flex-col gap-3 p-5", className)} aria-label={title}>
      {title ? (
        <header className="flex items-center gap-3">
          <h2 className="text-xms-ink text-[16px] font-semibold">{title}</h2>
          {actions ? <div className="ml-auto flex items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-[14px] text-[color:var(--state-overdue-text)]">
      {message}
    </p>
  );
}

export function PortalNotice({ children, tone = "info" }: { children: React.ReactNode; tone?: "info" | "error" }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-[6px] border px-4 py-3 text-[14px]",
        tone === "error"
          ? "border-[color:var(--state-overdue-border)] text-[color:var(--state-overdue-text)]"
          : "border-xms-line bg-xms-tint text-xms-body",
      )}
    >
      {children}
    </div>
  );
}
