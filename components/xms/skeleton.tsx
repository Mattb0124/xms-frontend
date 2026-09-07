import { cn } from "@/lib/utils";

export interface SkeletonProps {
  className?: string;
  /** Renders N stacked lines for list placeholders. */
  lines?: number;
}

/** Loading placeholder on the tint; never animates colour outside the tokens. */
export function Skeleton({ className, lines = 1 }: SkeletonProps) {
  return (
    <div aria-hidden data-skeleton className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: lines }).map((_, index) => (
        <div key={index} className="bg-xms-tint h-3 w-full animate-pulse rounded-[4px]" />
      ))}
    </div>
  );
}
