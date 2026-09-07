import { cn } from "@/lib/utils";

export interface ClearAllLinkProps {
  onClick: () => void;
  className?: string;
}

/** "Clear all" (v3): returns the list to the screen default. */
export function ClearAllLink({ onClick, className }: ClearAllLinkProps) {
  return (
    <button type="button" onClick={onClick} className={cn("text-xms-accent text-[12px] hover:underline", className)}>
      Clear all
    </button>
  );
}
