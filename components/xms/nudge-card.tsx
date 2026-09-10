import { cn } from "@/lib/utils";

export interface NudgeCardProps {
  title: string;
  detail: string;
  actionLabel: string;
  onAction: () => void;
  /** AI-origin nudges (time suggestions) take the violet family; system nudges the tint. */
  origin?: "ai" | "system";
  className?: string;
}

export function NudgeCard({ title, detail, actionLabel, onAction, origin = "system", className }: NudgeCardProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-[6px] px-4 py-3 text-[14px]",
        origin === "ai" ? "xms-ai" : "bg-xms-tint border-xms-accent-border border",
        className,
      )}
      data-origin={origin}
    >
      <div>
        <p className="text-xms-ink font-medium">{title}</p>
        <p className="text-xms-label text-[14px]">{detail}</p>
      </div>
      <button
        type="button"
        onClick={onAction}
        className="bg-xms-accent hover:bg-xms-accent-hover ml-auto h-[28px] rounded-[4px] px-3 text-[14px] font-medium text-white"
      >
        {actionLabel}
      </button>
    </div>
  );
}
