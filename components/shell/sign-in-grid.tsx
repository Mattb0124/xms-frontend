"use client";

import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from "react";
import {
  GRID_BURST,
  GRID_CELL,
  GRID_COLUMNS,
  GRID_RIPPLE,
  GRID_ROWS,
  clickChips,
  squareDistance,
  binaryRipple,
  type GridChip,
} from "@/lib/auth/sign-in-grid";
import { useMediaQuery } from "@/lib/use-media-query";

interface Burst {
  id: number;
  origin: number;
  at: number;
  chips: Map<number, GridChip>;
}

const BURST_MS = 1500;
const STILL = "(prefers-reduced-motion: reduce)";

/**
 * The sign-in grid from the web UI. A pointer paints 0 and 1 in a ring, and
 * a click throws coloured words outward. Someone who asked the system to
 * keep motion still gets the resting grid only.
 */
export function SignInGrid() {
  const id = useId();
  const still = useMediaQuery(STILL);
  const [hovered, setHovered] = useState<number | null>(null);
  const [binary, setBinary] = useState<Map<number, string>>(new Map());
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [radii, setRadii] = useState<Map<number, number>>(new Map());
  const last = useRef<number | null>(null);
  const nextId = useRef(0);

  const live = useRef<Burst[]>([]);

  useEffect(() => {
    live.current = bursts;
    if (bursts.length === 0) return;
    const timer = window.setInterval(() => {
      const now = Date.now();
      const current = live.current.filter((burst) => now - burst.at < BURST_MS);
      setRadii(() => {
        const next = new Map<number, number>();
        for (const burst of current) next.set(burst.id, Math.min((now - burst.at) / 80, GRID_BURST));
        return next;
      });
      if (current.length !== live.current.length) setBursts(current);
    }, 30);
    return () => window.clearInterval(timer);
  }, [bursts]);

  const enter = useCallback(
    (index: number) => {
      if (still) return;
      if (last.current !== index) {
        last.current = index;
        setBinary(binaryRipple(index, GRID_COLUMNS, GRID_ROWS, GRID_RIPPLE));
      }
      setHovered(index);
    },
    [still],
  );

  const leave = useCallback(() => {
    setHovered(null);
    last.current = null;
    setBinary(new Map());
  }, []);

  const press = useCallback(
    (index: number) => {
      if (still) return;
      setBursts((current) => [
        ...current,
        {
          id: nextId.current,
          origin: index,
          at: Date.now(),
          chips: clickChips(index, GRID_COLUMNS, GRID_ROWS, GRID_BURST),
        },
      ]);
      nextId.current += 1;
    },
    [still],
  );

  const total = GRID_COLUMNS * GRID_ROWS;
  const cells = [];
  for (let index = 0; index < total; index += 1) {
    const column = index % GRID_COLUMNS;
    const row = Math.floor(index / GRID_COLUMNS);
    cells.push(
      <GridCell
        key={`${id}-${column}-${row}`}
        index={index}
        hovered={hovered}
        binary={binary.get(index)}
        bursts={bursts}
        radii={radii}
        onEnter={enter}
        onLeave={leave}
        onPress={press}
      />,
    );
  }

  return (
    <svg className="xms-sign-in-grid-svg" width={GRID_COLUMNS * GRID_CELL} height={GRID_ROWS * GRID_CELL} aria-hidden>
      {cells}
    </svg>
  );
}

function chipAt(index: number, bursts: Burst[], radii: Map<number, number>): (GridChip & { opacity: number }) | null {
  const now = Date.now();
  for (const burst of bursts) {
    const distance = squareDistance(index, burst.origin, GRID_COLUMNS);
    const radius = radii.get(burst.id) ?? 0;
    const chip = burst.chips.get(index);
    if (!chip || distance > radius || distance < radius - 2.5) continue;
    return { ...chip, opacity: Math.max(0, 1 - (now - burst.at) / BURST_MS) };
  }
  return null;
}

function GridCell({
  index,
  hovered,
  binary,
  bursts,
  radii,
  onEnter,
  onLeave,
  onPress,
}: {
  index: number;
  hovered: number | null;
  binary: string | undefined;
  bursts: Burst[];
  radii: Map<number, number>;
  onEnter: (index: number) => void;
  onLeave: () => void;
  onPress: (index: number) => void;
}) {
  const x = (index % GRID_COLUMNS) * GRID_CELL;
  const y = Math.floor(index / GRID_COLUMNS) * GRID_CELL;
  const distance = hovered === null ? null : squareDistance(index, hovered, GRID_COLUMNS);
  const inRipple = distance !== null && distance <= GRID_RIPPLE;
  const chip = chipAt(index, bursts, radii);
  const wash = inRipple && distance !== null ? Math.max(0, 1 - distance / GRID_RIPPLE) : 0;
  const hot = cellHot(chip !== null, hovered === index, inRipple);
  const style = cellStyle(chip, hot, wash, distance);

  return (
    <g className={chip ? `xms-sign-in-tone-${chip.tone}` : undefined} style={style} data-hot={hot}>
      <rect
        className="xms-sign-in-cell"
        x={x}
        y={y}
        width={GRID_CELL}
        height={GRID_CELL}
        onMouseEnter={() => onEnter(index)}
        onMouseLeave={onLeave}
        onClick={() => onPress(index)}
      />
      {binary && inRipple && !chip ? (
        <text
          className="xms-sign-in-binary"
          x={x + GRID_CELL / 2}
          y={y + GRID_CELL / 2}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {binary}
        </text>
      ) : null}
      {chip ? (
        <g className="xms-sign-in-chip-wrap">
          <rect
            className="xms-sign-in-chip"
            x={x + 2}
            y={y + GRID_CELL / 2 - 8}
            width={GRID_CELL - 4}
            height={16}
            rx={3}
          />
          <text
            className="xms-sign-in-chip-label"
            x={x + GRID_CELL / 2}
            y={y + GRID_CELL / 2}
            textAnchor="middle"
            dominantBaseline="central"
          >
            {chip.word}
          </text>
        </g>
      ) : null}
    </g>
  );
}

function cellHot(token: boolean, hoveredHere: boolean, inRipple: boolean): "token" | "hover" | "ripple" | undefined {
  if (token) return "token";
  if (hoveredHere) return "hover";
  if (inRipple) return "ripple";
  return undefined;
}

function cellStyle(
  chip: { opacity: number } | null,
  hot: string | undefined,
  wash: number,
  distance: number | null,
): CSSProperties | undefined {
  const delay = hot === "ripple" && distance !== null ? `${Math.floor(distance * 50)}ms` : "0ms";
  if (chip) {
    return {
      ["--sign-in-alpha" as string]: String(chip.opacity * 0.15),
      ["--sign-in-edge" as string]: String(chip.opacity * 0.4),
      ["--sign-in-chip" as string]: String(chip.opacity * 0.85),
      ["--sign-in-opacity" as string]: String(chip.opacity),
      ["--sign-in-delay" as string]: delay,
    };
  }
  if (hot === "ripple") {
    return {
      ["--sign-in-alpha" as string]: String(wash * 0.06),
      ["--sign-in-edge" as string]: String(0.015 + wash * 0.04),
      ["--sign-in-ink" as string]: String(wash * 0.5),
      ["--sign-in-delay" as string]: delay,
    };
  }
  if (hot === "hover") {
    return { ["--sign-in-ink" as string]: "0.8", ["--sign-in-delay" as string]: delay };
  }
  return undefined;
}
