import type { ReactNode } from "react";
import { Shell } from "@/components/shell/shell";

/** Every internal screen renders inside the shell (Wireframes v2 section 2). */
export default function InternalLayout({ children }: { children: ReactNode }) {
  return <Shell>{children}</Shell>;
}
