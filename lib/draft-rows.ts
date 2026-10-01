/**
 * A row of an editable list as a form holds it. Rows are added, removed and
 * reordered, so each one carries an id given once, when it is created, and
 * used as its React key. The id belongs to the form alone: every body builder
 * picks its fields by name, so it never reaches a request.
 */
export type Keyed<T> = T & { id: number };

let lastId = 0;

export function keyed<T extends object>(row: T): Keyed<T> {
  lastId += 1;
  return { ...row, id: lastId };
}
