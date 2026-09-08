import { Suspense, type ReactNode } from "react";
import { PortalChrome } from "@/components/portal/portal-chrome";
import { Skeleton } from "@/components/xms/skeleton";

/**
 * Every portal page renders inside the light portal chrome, never the
 * internal shell. The chrome reads the query string to recognize a survey
 * email link, hence the Suspense boundary.
 */
export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<Skeleton lines={5} className="m-8 max-w-md" />}>
      <PortalChrome>{children}</PortalChrome>
    </Suspense>
  );
}
