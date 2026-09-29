/**
 * Readiness is the same claim as liveness for this service: see
 * app/healthz/route.ts for why it deliberately does not check its upstreams.
 */
export const dynamic = 'force-dynamic';

export { GET } from '../healthz/route';
