import { cn } from "@/lib/utils";

export type ActorKind = "user" | "portal_user" | "system" | "ai" | "api_client" | "sync";

export interface ActorChipProps {
  name: string;
  kind?: ActorKind;
  className?: string;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * "Matt Brown" as "M. Brown": the list form the v3 renders use in the Assignee
 * cell, where an avatar circle per row would put ten coloured discs down a
 * column that is read by exception. A single-word name is left whole.
 */
export function shortName(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return name;
  return `${parts[0][0].toUpperCase()}. ${parts[parts.length - 1]}`;
}

/** Avatar initials plus name. AI actors take the violet family; everyone else the tint. */
export function ActorChip({ name, kind = "user", className }: ActorChipProps) {
  const isAi = kind === "ai";
  return (
    <span className={cn("inline-flex items-center gap-2 text-[14px]", className)} data-kind={kind}>
      <span
        className={cn(
          "xms-mono flex h-6 w-6 items-center justify-center rounded-[999px] text-[14px] font-semibold",
          isAi ? "bg-xms-ai-bg text-xms-ai-accent border-xms-ai-border border" : "bg-xms-tint text-xms-accent",
        )}
        aria-hidden
      >
        {isAi ? "AX" : initials(name)}
      </span>
      <span className="text-xms-ink">{name}</span>
    </span>
  );
}
