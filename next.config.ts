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
};

export default nextConfig;
