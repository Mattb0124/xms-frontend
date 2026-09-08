import type { SignalTone } from "@/components/xms/signal-pill";
import { keyLabel, periodLabel, scoreLabel } from "@/lib/portal/csat";
import type { CsatQuarterly, CsatResponse, CsatScore, CsatSummary } from "@/redux/reportingApi";

/**
 * The operator's view of CSAT (Client Portal functional 5.7, results per
 * account): the range the API defaults to, the figures as words, the
 * distribution as five rows for the bars, the respondent line, and the
 * quarterly relationship survey as its own block. Every number comes from
 * the server's summary; nothing is recomputed here.
 */
export const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function isDay(value: string): boolean {
  return DAY.test(value);
}

/** The API's own default: the last ninety days up to today. */
export function defaultCsatRange(now: Date = new Date()): { from: string; to: string } {
  const to = now.toISOString().slice(0, 10);
  const from = new Date(now.getTime() - 90 * 86_400_000).toISOString().slice(0, 10);
  return { from, to };
}

/** "3.5 of 5", or the words when nothing was answered. */
export function formatAverage(average: number | null): string {
  return average === null ? "No responses yet" : `${average.toFixed(1)} of 5`;
}

export interface DistributionRow {
  score: number;
  label: string;
  count: number;
  /** Of the largest bar, so the widest row fills the track. */
  percent: number;
}

/** Five rows from very satisfied down to very dissatisfied, widths against the largest count. */
export function distributionRows(summary: Pick<CsatSummary, "distribution">): DistributionRow[] {
  const counts = (["5", "4", "3", "2", "1"] as CsatScore[]).map((key) => ({
    score: Number(key),
    count: summary.distribution[key] ?? 0,
  }));
  const max = Math.max(0, ...counts.map((row) => row.count));
  return counts.map((row) => ({
    ...row,
    label: scoreLabel(row.score),
    percent: max === 0 ? 0 : Math.round((row.count / max) * 100),
  }));
}

/** The respondent by name and address, or "Anonymous" when the account keeps them so. */
export function respondentLabel(response: Pick<CsatResponse, "contact_name" | "contact_email">): string {
  if (!response.contact_name && !response.contact_email) return "Anonymous";
  if (response.contact_name && response.contact_email) return `${response.contact_name} (${response.contact_email})`;
  return response.contact_name ?? response.contact_email ?? "Anonymous";
}

/** Low scores read as overdue, neutral as needs input, the rest as complete. */
export function scoreTone(score: number): SignalTone {
  return score <= 2 ? "overdue" : score === 3 ? "needs-input" : "complete";
}

// The quarterly relationship survey -------------------------------------------

/**
 * Whether the API answered with a quarterly block that has something in it.
 * An older API sends none, and an account that has never answered one sends
 * a block with no period; neither is drawn as a panel full of dashes.
 */
export function hasQuarterly(quarterly: CsatQuarterly | undefined): quarterly is CsatQuarterly {
  return Boolean(quarterly && (quarterly.latest_period !== null || quarterly.trend.length > 0));
}

export interface QuarterlyQuestionRow {
  key: string;
  label: string;
  average: number | null;
}

/**
 * One row per question in the latest period, in the order the survey asks
 * them where the server named its questions, and otherwise in the order the
 * averages arrived. The label is the question key in words: the question
 * text itself is a sentence, too long for a column.
 */
export function quarterlyQuestionRows(quarterly: CsatQuarterly): QuarterlyQuestionRow[] {
  const keys = quarterly.questions?.length
    ? quarterly.questions.map((question) => question.key)
    : Object.keys(quarterly.averages);
  return keys.map((key) => ({ key, label: keyLabel(key), average: quarterly.averages[key] ?? null }));
}

export interface QuarterlyTrendRow {
  period: string;
  label: string;
  responses: number;
  average: number | null;
  /** Of five, so the bars share one scale rather than one per column. */
  percent: number;
}

/** The trend oldest first, each period's mean as a share of the five-point scale. */
export function quarterlyTrendRows(quarterly: CsatQuarterly): QuarterlyTrendRow[] {
  return quarterly.trend.map((row) => ({
    period: row.period,
    label: periodLabel(row.period) ?? row.period,
    responses: row.responses,
    average: row.average,
    percent: row.average === null ? 0 : Math.round((row.average / 5) * 100),
  }));
}

/** "2026 Q2", or the words when the account has answered no quarterly survey. */
export function latestPeriodLabel(quarterly: CsatQuarterly): string {
  return periodLabel(quarterly.latest_period) ?? "No period answered yet";
}
