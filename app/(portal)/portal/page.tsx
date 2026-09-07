/**
 * Client portal root (portal.<domain>). Search-first home lands in P2.16.3;
 * this placeholder fixes the route group and the light-only theme.
 * Reference: 01-architecture/USER-EXPERIENCE.md section 4.2.
 */
export default function PortalHomePage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
      <p className="xms-caption">Client portal</p>
      <h1 className="text-xms-ink text-[22px] font-semibold">What do you need help with?</h1>
      <p className="text-xms-body text-[14px]">
        Search published solutions first; open a request only when you still need help.
      </p>
    </main>
  );
}
