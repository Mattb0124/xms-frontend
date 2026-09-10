/**
 * The line icons the v3 renders use, drawn inline so no icon package and no
 * remote font is needed and every glyph inherits `currentColor`: Lucide
 * geometry, 1.5px strokes on a 24 unit canvas, never filled (hand-off
 * section 6, `xms-ui.css` `.xms-icon`). Decorative by default: a caller that
 * needs a name passes one and the icon stops being hidden.
 */
import type { ComponentType, SVGProps } from "react";

/**
 * The one icon scale, named by the job rather than by the number, so a size
 * is chosen by asking what the glyph is doing and not by eye. Every value is
 * measured off the prototype's own markup for renders 01 and 08.
 *
 * `components/xms/surfaces.test.tsx` fails on a raw `size={13}` anywhere in
 * `components/` or `app/`: the scale is the only way to size an icon.
 */
export const ICON = {
  /** Inside a dense cell: the sort glyph on a column header, a chip's cross. */
  glyph: 14,
  /** Inside a control, beside words: a pill's chevron, a button's plus. */
  control: 15,
  /** A control's own mark: the strip's chevron, the finder star, the sparkle. */
  action: 16,
  /** A field's adornment: the magnifier in a search field. */
  field: 17,
  /** A row's leading mark: the sidebar rows, a card header's funnel. */
  row: 18,
  /** A standing tool on the strip: the gear. */
  tool: 20,
  /** The largest in the system: the hamburger, the funnel, the gear, the bell. */
  bar: 22,
} as const;

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
  size?: number;
  title?: string;
}

function Icon({ size = ICON.field, title, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      focusable="false"
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

/** My work. */
export function GridIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </Icon>
  );
}

/** Queue. */
export function InboxIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 12h5l1.5 2.5h5L16 12h5" />
      <path d="M4.5 6.5 3 12v5.5A1.5 1.5 0 0 0 4.5 19h15a1.5 1.5 0 0 0 1.5-1.5V12l-1.5-5.5A1.5 1.5 0 0 0 18 5H6a1.5 1.5 0 0 0-1.5 1.5Z" />
    </Icon>
  );
}

/** Dispatch. */
export function ShuffleIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 6h3.5L17 18h4" />
      <path d="M3 18h3.5L17 6h4" />
      <path d="m18.5 3.5 2.5 2.5-2.5 2.5" />
      <path d="m18.5 15.5 2.5 2.5-2.5 2.5" />
    </Icon>
  );
}

/** Quarantine. */
export function ShieldIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3 5 6v6c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6l-7-3Z" />
    </Icon>
  );
}

/** My timesheet. */
export function ClockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 1.8" />
    </Icon>
  );
}

/** Operations. */
export function ChartIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-7" />
      <path d="M21 20H3" />
    </Icon>
  );
}

/** Knowledge and solutions. */
export function BookIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5Z" />
      <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5Z" />
    </Icon>
  );
}

/** Accounts and people. */
export function PeopleIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.5a3.2 3.2 0 0 1 0 6" />
      <path d="M17.5 14.2A5.5 5.5 0 0 1 20.5 19" />
    </Icon>
  );
}

export function StarIcon({ filled, ...props }: IconProps & { filled?: boolean }) {
  return (
    <Icon {...props} fill={filled ? "currentColor" : "none"}>
      <path d="m12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 9.7l5.4-.8Z" />
    </Icon>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </Icon>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M18 15.5V11a6 6 0 1 0-12 0v4.5L4.5 18h15Z" />
      <path d="M10 21h4" />
    </Icon>
  );
}

/** The Axel sparkle: AI-origin content and the Axel controls only. */
export function SparkleIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3.5 13.6 8l4.4 1.6L13.6 11 12 15.5 10.4 11 6 9.6 10.4 8Z" />
      <path d="M18.5 15.5l.7 1.9 1.8.7-1.8.7-.7 1.9-.7-1.9-1.8-.7 1.8-.7Z" />
    </Icon>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m6 9.5 6 5.5 6-5.5" />
    </Icon>
  );
}

/** A pager's step back and forward, and its jump to either end. */
export function ChevronLeftIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m15 5-7 7 7 7" />
    </Icon>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m9 5 7 7-7 7" />
    </Icon>
  );
}

export function ChevronFirstIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m17 5-7 7 7 7" />
      <path d="m10 5-7 7 7 7" />
    </Icon>
  );
}

export function ChevronLastIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m7 5 7 7-7 7" />
      <path d="m14 5 7 7-7 7" />
    </Icon>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </Icon>
  );
}

export function FunnelIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 5h16l-6.2 7.4V19l-3.6-2v-4.6Z" />
    </Icon>
  );
}

export function GearIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="3.1" />
      <path d="M19.1 14.4a1.5 1.5 0 0 0 .3 1.65l.05.06a1.8 1.8 0 1 1-2.55 2.55l-.06-.05a1.5 1.5 0 0 0-1.65-.3 1.5 1.5 0 0 0-.9 1.37V20a1.8 1.8 0 0 1-3.6 0v-.1a1.5 1.5 0 0 0-.98-1.37 1.5 1.5 0 0 0-1.65.3l-.06.05A1.8 1.8 0 1 1 4.45 16.1l.05-.06a1.5 1.5 0 0 0 .3-1.65 1.5 1.5 0 0 0-1.37-.9H3.3a1.8 1.8 0 0 1 0-3.6h.1a1.5 1.5 0 0 0 1.37-.98 1.5 1.5 0 0 0-.3-1.65l-.05-.06A1.8 1.8 0 1 1 7 4.65l.06.05a1.5 1.5 0 0 0 1.65.3h.07a1.5 1.5 0 0 0 .9-1.37V3.5a1.8 1.8 0 0 1 3.6 0v.1a1.5 1.5 0 0 0 .9 1.37 1.5 1.5 0 0 0 1.65-.3l.06-.05a1.8 1.8 0 1 1 2.55 2.55l-.05.06a1.5 1.5 0 0 0-.3 1.65v.07a1.5 1.5 0 0 0 1.37.9h.14a1.8 1.8 0 0 1 0 3.6h-.1a1.5 1.5 0 0 0-1.37.9Z" />
    </Icon>
  );
}

/** The column chooser beside the in-card funnel. */
export function ColumnsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7h6M4 12h10M4 17h6" />
      <circle cx="14" cy="7" r="1.6" />
      <circle cx="18" cy="12" r="1.6" />
      <circle cx="14" cy="17" r="1.6" />
    </Icon>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m6 6 12 12M18 6 6 18" />
    </Icon>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  );
}

export function MoreIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="5.5" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="18.5" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function PencilIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17Z" />
    </Icon>
  );
}

export function TagIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 4h7l9 9-7 7-9-9Z" />
      <circle cx="8.5" cy="8.5" r="1.4" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function DownloadIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 4v10" />
      <path d="m8 11 4 4 4-4" />
      <path d="M5 19h14" />
    </Icon>
  );
}

/**
 * The glyph beside a sortable column title (hand-off section 5): Lucide's
 * `chevrons-up-down` while the column is idle, swapped for `arrow-up` (turned
 * over for a descending sort) once the column carries the sort. Both are the
 * Lucide geometry on the same 24 unit canvas at 1.5px, drawn here rather than
 * pulled from `lucide-react` so the whole icon set stays one module and no
 * package is added for two paths.
 *
 * The arms were 12px at 2.2px stroke and read as a smudge; the hand-off
 * states 13px, and the caller inks the idle glyph with --xms-quiet-line and
 * the sorted one with the link colour.
 */
export function SortCaret({ direction, ...props }: IconProps & { direction?: "asc" | "desc" }) {
  if (!direction) {
    return (
      <Icon size={ICON.glyph} {...props} strokeWidth={1.5}>
        <path d="m7 15 5 5 5-5" />
        <path d="m7 9 5-5 5 5" />
      </Icon>
    );
  }
  return (
    <Icon
      size={13}
      {...props}
      strokeWidth={1.5}
      style={{ ...props.style, transform: direction === "desc" ? "rotate(180deg)" : undefined }}
    >
      <path d="m5 12 7-7 7 7" />
      <path d="M12 19V5" />
    </Icon>
  );
}

/** The pin toggle in the All overlay. */
export function PinIcon({ filled, ...props }: IconProps & { filled?: boolean }) {
  return (
    <Icon {...props} fill={filled ? "currentColor" : "none"}>
      <path d="M9 3h6l-1 5 3 3v2H7v-2l3-3Z" />
      <path d="M12 13v8" />
    </Icon>
  );
}

/**
 * The empty slot beside an unpinned screen in the All overlay. Render 12
 * draws a pin on a pinned row and a plain circle on every other one, so the
 * six that are pinned are read at a glance instead of by comparing the
 * opacity of one glyph against the next.
 */
export function CircleIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8" />
    </Icon>
  );
}

/**
 * One icon per screen id (v3 renders 01, 08, 09, 12). The sidebar row and the
 * All overlay row draw the same mark for the same screen, so the map lives
 * here rather than in either of them. Anything without an entry falls back to
 * the neutral book, so a newly registered route is never drawn without a mark.
 */
const SCREEN_ICON: Record<string, ComponentType<IconProps>> = {
  "my-work": GridIcon,
  cases: InboxIcon,
  dispatch: ShuffleIcon,
  quarantine: ShieldIcon,
  my_time: ClockIcon,
  timesheet: ClockIcon,
  time: ClockIcon,
  operations: ChartIcon,
  solutions: BookIcon,
  knowledge: BookIcon,
  accounts: PeopleIcon,
  roster: PeopleIcon,
  ticket_groups: PeopleIcon,
  // The admin tree, which the All overlay and the admin console both draw.
  // Without these, every one of its thirteen rows took the fallback book, so
  // a column of thirteen identical glyphs said nothing at all.
  admin: GearIcon,
  "admin.accounts": PeopleIcon,
  "admin.users": PeopleIcon,
  "admin.groups": PeopleIcon,
  "admin.roles": ShieldIcon,
  "admin.security": ShieldIcon,
  "admin.api_clients": SwitchIcon,
  "admin.connectors": SwitchIcon,
  "admin.config": GearIcon,
  "admin.holiday_calendars": ClockIcon,
  "admin.migration": DownloadIcon,
  "admin.audit": SearchIcon,
  "admin.usage": ChartIcon,
};

export function screenIcon(screen: string | undefined): ComponentType<IconProps> {
  return (screen && SCREEN_ICON[screen]) || BookIcon;
}

export function SwitchIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 8h13l-3-3" />
      <path d="M20 16H7l3 3" />
    </Icon>
  );
}

/** A preview: read one row without leaving the list, ServiceNow's circled i. */
export function InfoIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5" />
      <path d="M12 7.75v.5" />
    </Icon>
  );
}

/** A preview: read one row without leaving the list. */
export function EyeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  );
}
