import { TablePager } from "@/components/xms/table-pager";
import { cn } from "@/lib/utils";

export const ROWS_PER_PAGE_OPTIONS = [10, 25, 50, 100] as const;
export type RowsPerPageOption = (typeof ROWS_PER_PAGE_OPTIONS)[number];

export interface RowsPerPageProps {
  value: number;
  onChange: (value: RowsPerPageOption) => void;
}

export function RowsPerPage({ value, onChange }: RowsPerPageProps) {
  return (
    <label className="text-xms-label flex items-center gap-2 text-[14px]">
      Rows per page
      <select
        value={value}
        onChange={(event) => onChange(Number(event.target.value) as RowsPerPageOption)}
        className="border-xms-line bg-xms-card text-xms-ink h-[28px] rounded-[4px] border px-2 text-[14px]"
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

/**
 * The pager, with Rows per page beside it (Wireframes section 8.4). The
 * count is the server's, so this one can jump to a page and to the end.
 */
export function TableFooter({ page, pageSize, total, onPageChange, onPageSizeChange, className }: TableFooterProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const rows = Math.max(0, Math.min(total, page * pageSize) - (page - 1) * pageSize);
  return (
    <div className={cn("relative", className)}>
      <TablePager
        page={page}
        pageSize={pageSize}
        total={total}
        rows={rows}
        onPage={(wanted) => onPageChange(wanted)}
        onFirst={() => onPageChange(1)}
        onPrevious={() => onPageChange(page - 1)}
        onNext={() => onPageChange(page + 1)}
        onLast={() => onPageChange(pages)}
        hasPrevious={page > 1}
        hasNext={page < pages}
      />
      <div className="absolute inset-y-0 right-4 flex items-center">
        <RowsPerPage value={pageSize} onChange={onPageSizeChange} />
      </div>
    </div>
  );
}
