"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { SignInGrid } from "@/components/shell/sign-in-grid";

/**
 * The sign-in stage from the AI Innovation Platforms web UI: a dark field,
 * two washes of colour, a grid, and one card. The desk shell is not around
 * it, because this is what an unsigned visitor sees.
 */
export function SignInStage({ children }: { children: ReactNode }) {
  return (
    <main className="xms-sign-in">
      <div className="xms-sign-in-wash" aria-hidden />
      <div className="xms-sign-in-glow xms-sign-in-glow-left" aria-hidden />
      <div className="xms-sign-in-glow xms-sign-in-glow-right" aria-hidden />
      <div className="xms-sign-in-grid" aria-hidden />
      <div className="xms-sign-in-grid-live">
        <SignInGrid />
      </div>
      <div className="xms-sign-in-center">
        <div className="xms-sign-in-card">
          <div className="xms-sign-in-brand">
            <Image
              src="/thehackettgroup_logo.svg"
              alt="The Hackett Group"
              width={180}
              height={22}
              priority
              unoptimized
            />
            <span className="xms-sign-in-brand-name">X Managed Services</span>
          </div>
          {children}
        </div>
        <p className="xms-sign-in-footer">© {new Date().getFullYear()} The Hackett Group. All rights reserved.</p>
      </div>
    </main>
  );
}
