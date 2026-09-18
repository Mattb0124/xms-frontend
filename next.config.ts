import type { NextConfig } from 'next';

/**
 * `standalone` is the only line here that matters operationally: it makes the
 * build emit a self-contained server with just the node_modules it actually
 * uses, which is what the runtime stage of the Dockerfile copies.
 *
 * There is deliberately no `env` block. Every address this service dials is
 * read from the environment at request time, inside server-only code, so that
 * a change of upstream is a Helm value and never a rebuild — and so that no
 * internal hostname is ever baked into a browser bundle.
 */
const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,

  /**
   * Security headers belong to the application, not to the load balancer.
   *
   * They were briefly set on the HTTPRoute instead, which works on the
   * internal gateway and silently does not on the public one: the AWS Load
   * Balancer Controller implements only the RequestRedirect filter, and a
   * ResponseHeaderModifier invalidates the entire Gateway — so the HTTPS
   * listener is never created and the site answers on port 80 alone.
   *
   * Setting them here means they travel with the response regardless of what
   * is in front of it, and they are testable locally with curl.
   */
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'geolocation=(), camera=(), microphone=()' },
          // The public ALB terminates TLS and redirects 80 to 443, so telling
          // browsers to skip the redirect next time is safe.
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        ],
      },
    ];
  },
};

export default nextConfig;
