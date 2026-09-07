import { cn } from "@/lib/utils";

export type TicketType = "incident" | "service_request" | "change" | "problem" | "project_task";

const TYPE_SLUG: Record<TicketType, string> = {
  incident: "incident",
  service_request: "request",
  change: "change",
  problem: "problem",
  project_task: "project-task",
};

export const TYPE_LABEL: Record<TicketType, string> = {
  incident: "Incident",
  service_request: "Request",
  change: "Change",
  problem: "Problem",
  project_task: "Project task",
};

export interface TypeBarProps {
  type: TicketType;
  label?: string;
  className?: string;
}

/** The 3px type bar beside the type label (Wireframes section 8.2). */
export function TypeBar({ type, label, className }: TypeBarProps) {
  return (
    <span className={cn("xms-type text-[13px]", className)} data-type={TYPE_SLUG[type]}>
      {label ?? TYPE_LABEL[type]}
    </span>
  );
}
