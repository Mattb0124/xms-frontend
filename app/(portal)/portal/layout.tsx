import type { ReactNode } from "react";
import { PortalChrome } from "@/components/portal/portal-chrome";

/** Every portal page renders inside the light portal chrome, never the internal shell. */
export default function PortalLayout({ children }: { children: ReactNode }) {
  return <PortalChrome>{children}</PortalChrome>;
}
