import type { ReactNode } from "react";
import { DeskSession } from "@/components/shell/desk-session";

/** Every internal screen renders inside the shell once a session exists. */
export default function InternalLayout({ children }: { children: ReactNode }) {
  return <DeskSession>{children}</DeskSession>;
}
