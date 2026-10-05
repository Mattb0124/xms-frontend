/**
 * A 401 from /portal/me sends an anonymous visitor to the sign-in page.
 * A Clerk session the API refused stays on the page. Sending it back would
 * mount Clerk's sign-in, which redirects to /portal again.
 */
export function returnToPortalSignIn(status: unknown, clerkSignedIn: boolean): boolean {
  return status === 401 && !clerkSignedIn;
}
