/**
 * How often an open screen reads the API again. The desk's lists, counts and
 * open record move at the pace people work them; integration health and
 * migration batches move with the worker, so they are read twice as often.
 */
export const LIVE_REFRESH_MS = 60_000;
export const WORKER_REFRESH_MS = 30_000;
