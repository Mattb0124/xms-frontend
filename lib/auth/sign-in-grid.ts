/** Words the sign-in grid throws out from a click, as the web UI grid does. */
export const SIGN_IN_WORDS = [
  "AI",
  "ML",
  "LLM",
  "NLP",
  "GPT",
  "RAG",
  "AGI",
  "neural",
  "model",
  "train",
  "infer",
  "embed",
  "vector",
  "token",
  "prompt",
  "agent",
  "chain",
  "ROI",
  "KPI",
  "ERP",
  "CRM",
  "B2B",
  "SaaS",
  "strategy",
  "insight",
  "analyze",
  "optimize",
  "benchmark",
  "transform",
  "deliver",
  "value",
  "process",
  "workflow",
  "metrics",
  "growth",
  "Hackett",
  "XT",
  "COE",
  "HLM",
  "finance",
  "supply",
  "digital",
  "human",
  "data",
  "query",
  "report",
  "visual",
  "dashboard",
] as const;

/** How many pastel tones the click chips cycle through. The colours live in CSS. */
export const SIGN_IN_TONES = 8;

export const GRID_COLUMNS = 40;
export const GRID_ROWS = 30;
export const GRID_CELL = 50;
export const GRID_RIPPLE = 5;
export const GRID_BURST = 12;

export interface GridChip {
  word: string;
  tone: number;
}

function within(index: number, origin: number, columns: number, radius: number): boolean {
  const originX = origin % columns;
  const originY = Math.floor(origin / columns);
  const x = index % columns;
  const y = Math.floor(index / columns);
  const distance = Math.hypot(x - originX, y - originY);
  return distance <= radius;
}

/** 0 and 1 in the cells around the pointer, the hover ripple. */
export function binaryRipple(origin: number, columns: number, rows: number, radius: number): Map<number, string> {
  const values = new Map<number, string>();
  const total = columns * rows;
  for (let index = 0; index < total; index += 1) {
    if (within(index, origin, columns, radius)) values.set(index, Math.random() > 0.5 ? "1" : "0");
  }
  return values;
}

/** The words a click scatters, each one a cell inside the burst. */
export function clickChips(origin: number, columns: number, rows: number, radius: number): Map<number, GridChip> {
  const chips = new Map<number, GridChip>();
  const total = columns * rows;
  for (let index = 0; index < total; index += 1) {
    if (!within(index, origin, columns, radius) || Math.random() <= 0.4) continue;
    chips.set(index, {
      word: SIGN_IN_WORDS[Math.floor(Math.random() * SIGN_IN_WORDS.length)] ?? "AI",
      tone: Math.floor(Math.random() * SIGN_IN_TONES),
    });
  }
  return chips;
}

export function squareDistance(index: number, origin: number, columns: number): number {
  const originX = origin % columns;
  const originY = Math.floor(origin / columns);
  const x = index % columns;
  const y = Math.floor(index / columns);
  return Math.hypot(x - originX, y - originY);
}
