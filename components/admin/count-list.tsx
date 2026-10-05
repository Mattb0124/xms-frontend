import Link from "next/link";

export interface CountRow {
  /** Unique within its list, taken from the record or the grouping the row stands for. */
  key: string;
  label: string;
  detail?: string;
  /** A row that names a record rather than counting one carries no number. */
  n?: number;
  /** The screen this row is answered on, where this application serves one. */
  href?: string;
}

/** A dense list of counts with the mono number on the right; a row with a screen behind it links to it. */
export function CountList({ rows, empty }: { rows: CountRow[]; empty: string }) {
  if (rows.length === 0) return <p className="text-xms-label text-body">{empty}</p>;
  return (
    <ul className="flex flex-col">
      {rows.map((row) => (
        <li key={row.key} className="border-xms-line flex items-center gap-3 border-b py-2 text-body last:border-b-0">
          {row.href ? (
            <Link href={row.href} className="xms-mono text-xms-accent truncate hover:underline">
              {row.label}
            </Link>
          ) : (
            <span className="xms-mono text-xms-ink truncate">{row.label}</span>
          )}
          {row.detail ? <span className="xms-mono text-xms-muted text-body">{row.detail}</span> : null}
          {row.n === undefined ? null : <span className="xms-mono text-xms-ink ml-auto font-semibold">{row.n}</span>}
        </li>
      ))}
    </ul>
  );
}
