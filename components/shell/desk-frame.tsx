import Image from "next/image";
import type { ReactNode } from "react";

/**
 * The sign-in and the refused-session screens. They sit outside the desk
 * shell, on the same dark bar the desk uses, so the logo is the white one
 * the bar already carries.
 */
export function DeskFrame({ children }: { children: ReactNode }) {
  return (
    <main className="bg-xms-bg flex min-h-0 flex-1 flex-col">
      <header className="aix-app-header text-white" style={{ height: "var(--xms-finder-bar-h)" }}>
        <span aria-hidden className="aix-header-glow" />
        <div className="aix-header-row">
          <Image src="/thehackettgroup_logo.svg" alt="The Hackett Group" width={172} height={21} priority unoptimized />
        </div>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-5 py-10">{children}</div>
    </main>
  );
}
