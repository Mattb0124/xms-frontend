import { cn } from "@/lib/utils";

export interface AccountDotProps {
  name: string;
  /** Identity hue 1 to 6 stored on the account record; anything else is grey. */
  hue?: number | null;
  className?: string;
}

/** 8px identity dot before the account name (Wireframes section 8.3). Dots never replace the name. */
export function AccountDot({ name, hue, className }: AccountDotProps) {
  const safeHue = hue && hue >= 1 && hue <= 6 ? String(hue) : undefined;
  return (
    <span className={cn("xms-account text-[13px]", className)} data-hue={safeHue}>
      {name}
    </span>
  );
}
