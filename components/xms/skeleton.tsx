import { cn } from "@/lib/utils";

export interface SkeletonProps {
  className?: string;
  /** Renders N stacked lines for list placeholders. */
  lines?: number;
}

/**
 * Loading placeholder on the tint; never animates colour outside the tokens.
 *
 * The last line is short. Every line running the full width reads as a block
 * of something rather than as the text it stands in for, and the moment the
 * real content lands the ragged last line makes the swap look like the same
 * object resolving rather than one thing being replaced by another
 * (2026-09-13 motion pass).
 */
export function Skeleton({ className, lines = 1 }: SkeletonProps) {
  return (
    <div aria-hidden data-skeleton className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className={cn(
            "bg-xms-tint h-3 animate-pulse rounded-control",
            lines > 1 && index === lines - 1 ? "w-3/5" : "w-full",
          )}
        />
      ))}
    </div>
  );
}
