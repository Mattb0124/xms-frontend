import { cn } from "@/lib/utils";

export const ROWS_PER_PAGE_OPTIONS = [10, 25, 50, 100] as const;
export type RowsPerPageOption = (typeof ROWS_PER_PAGE_OPTIONS)[number];

export interface RowsPerPageProps {
  value: number;
  onChange: (value: RowsPerPageOption) => void;
}

export function RowsPerPage({ value, onChange }: RowsPerPageProps) {
  return (
    <label className="text-xms-label flex items-center gap-2 text-[12px]">
      Rows per page
      <select
        value={value}
        onChange={(event) => onChange(Number(event.target.value) as RowsPerPageOption)}
        className="border-xms-line bg-xms-card text-xms-ink h-[28px] rounded-[4px] border px-2 text-[12px]"
        aria-label="Rows per page"
      >
        {ROWS_PER_PAGE_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

export interface TableFooterProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: RowsPerPageOption) => void;
  className?: string;
}

/** "Showing 1 to 10 of 42", the pager and Rows per page (Wireframes section 8.4). */
export function TableFooter({ page, pageSize, total, onPageChange, onPageSizeChange, className }: TableFooterProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);
  const pagerButton =
    "border-xms-line text-xms-body h-[28px] rounded-[4px] border px-2 text-[12px] disabled:opacity-40";
  return (
    <div className={cn("border-xms-line flex items-center gap-4 border-t px-4 py-2", className)}>
      <span className="xms-mono text-xms-label text-[12px]">
        Showing {first} to {last} of {total}
      </span>
      <div className="ml-auto flex items-center gap-1">
        <button type="button" onClick={() => onPageChange(page - 1)} disabled={page <= 1} className={pagerButton}>
          Previous
        </button>
        <span className="xms-mono text-xms-label px-2 text-[12px]">
          {page} / {pages}
        </span>
        <button type="button" onClick={() => onPageChange(page + 1)} disabled={page >= pages} className={pagerButton}>
          Next
        </button>
      </div>
      <RowsPerPage value={pageSize} onChange={onPageSizeChange} />
    </div>
  );
}
