import type { ClerkFailure } from "@/lib/auth/clerk-failure";

/** The slice of Clerk's sign-in the desk form actually calls. */
export interface DeskSignInClient {
  status: string | null;
  password: (params: { identifier: string; password: string }) => Promise<{ error: ClerkFailure | null }>;
  finalize: () => Promise<{ error: ClerkFailure | null }>;
  create: (params: { identifier: string }) => Promise<{ error: ClerkFailure | null }>;
  resetPasswordEmailCode: {
    sendCode: () => Promise<{ error: ClerkFailure | null }>;
    verifyCode: (params: { code: string }) => Promise<{ error: ClerkFailure | null }>;
    submitPassword: (params: { password: string }) => Promise<{ error: ClerkFailure | null }>;
  };
}

export const INVALID_CREDENTIALS = "Invalid email or password";
export const RESET_FAILED = "Could not send reset code. Please check your email and try again.";
export const RESET_CODE_FAILED = "Invalid code or password. Please try again.";
