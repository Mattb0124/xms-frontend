/** A Clerk failure, narrowed to the two strings the sign-in page can show. */
export interface ClerkFailure {
  longMessage?: string | null;
  message?: string | null;
}

export function clerkFailure(error: ClerkFailure | null | undefined, fallback: string): string {
  return error?.longMessage || error?.message || fallback;
}

export function thrownFailure(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = error.message;
    if (typeof message === "string" && message) return message;
  }
  return fallback;
}
