import { CreateItemInput } from './types';

/**
 * Validation at the boundary, shared by the route handler and the server
 * action so that the two cannot drift apart.
 *
 * The backend validates again — it has to, it is the owner of the table and
 * it does not get to assume who called it. Validating here as well is not
 * duplication for its own sake: it keeps a malformed request from consuming a
 * cluster round trip, and it puts the error next to the form that caused it.
 *
 * Returns the parsed value or throws. There is no third "close enough" case.
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function parseCreateItemInput(body: unknown): CreateItemInput {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ValidationError('body must be a JSON object');
  }

  const { name, note } = body as { name?: unknown; note?: unknown };

  if (typeof name !== 'string' || name.trim() === '') {
    throw new ValidationError('name is required and must be a non-empty string');
  }
  if (name.length > 200) {
    throw new ValidationError('name must be 200 characters or fewer');
  }
  if (note !== undefined && note !== null && typeof note !== 'string') {
    throw new ValidationError('note must be a string when present');
  }
  if (typeof note === 'string' && note.length > 2_000) {
    throw new ValidationError('note must be 2000 characters or fewer');
  }

  const trimmedNote = typeof note === 'string' ? note.trim() : null;

  return {
    name: name.trim(),
    note: trimmedNote === '' ? null : trimmedNote,
  };
}
