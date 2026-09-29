export type SignalTone = "complete" | "needs-input" | "overdue" | "blocked" | "ready";

/**
 * A pill on the `--state-*` signal trios for things that are not ticket
 * states: expiry, health, active flags. Text carries the meaning; colour
 * only reinforces it.
 */
export function SignalPill({ tone, label, title }: { tone: SignalTone; label: string; title?: string }) {
  return (
    <span className="aix-state-pill" data-state={tone} title={title}>
      {label}
    </span>
  );
}
