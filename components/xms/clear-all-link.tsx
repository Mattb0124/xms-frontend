import { cn } from "@/lib/utils";

export interface ClearAllLinkProps {
  onClick: () => void;
  className?: string;
}

/**
 * "Clear all" (v3 renders 01 and 08): returns the list to the screen default.
 * The render draws it as quiet label text that inks to the action blue on
 * hover, not as a standing blue link, so it does not compete with the pills.
 */
export function ClearAllLink({ onClick, className }: ClearAllLinkProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("text-xms-label hover:text-xms-accent shrink-0 px-1 text-[13px] font-medium", className)}
    >
      Clear all
    </button>
  );
}
