import type { AccuracyReport, AiDefaultsBody, AiSettingsView, CapabilitySetting, SuggestionView } from "@/redux/aiApi";

/** Constructed AI fixtures shared by the suggestion, panel and admin tests. */
export function aSuggestion(overrides: Partial<SuggestionView> = {}): SuggestionView {
  return {
    id: "sg-1",
    capability: "classify",
    target_kind: "ticket",
    target_id: "t-1",
    status: "offered",
    withheld_reason: null,
    payload: {
      category: "Consolidation",
      ticket_type: "incident",
      ci_ids: [],
      reasons: { category: "Error text names the consolidation rule set" },
      confidence: 0.91,
    },
    confidence: 0.91,
    agent_id: "xms-classifier",
    prompt_version: "classify/2026-09-07.1",
    model_id: "sonnet-5",
    thread_id: null,
    expires_at: null,
    created_at: "2026-09-07T10:00:00Z",
    decision: null,
    ...overrides,
  };
}

export function aPrioritise(overrides: Partial<SuggestionView> = {}): SuggestionView {
  return aSuggestion({
    id: "sg-2",
    capability: "prioritise",
    payload: {
      impact: "high",
      urgency: "medium",
      priority: "p2",
      reason: "Month-end close is blocked",
      confidence: 0.8,
    },
    confidence: 0.8,
    ...overrides,
  });
}

export function aDuplicate(overrides: Partial<SuggestionView> = {}): SuggestionView {
  return aSuggestion({
    id: "sg-3",
    capability: "duplicate",
    payload: {
      candidates: [
        { ticket_id: "8b1e6b2e-1111-4a2b-9c3d-000000000001", similarity: 0.92, reason: "Same error on the same CI" },
        { ticket_id: "8b1e6b2e-1111-4a2b-9c3d-000000000002", similarity: 0.7, reason: "Same requester this week" },
      ],
      merge_into: "8b1e6b2e-1111-4a2b-9c3d-000000000001",
      confidence: 0.9,
    },
    confidence: 0.9,
    ...overrides,
  });
}

export function aSummary(overrides: Partial<SuggestionView> = {}): SuggestionView {
  return aSuggestion({
    id: "sg-4",
    capability: "summarise",
    payload: {
      situation: "Consolidation fails for the EU entity.",
      done: "Rate table and hierarchy ruled out.",
      waiting_on: "Client confirmation of the ownership date.",
      next_step: "Rerun with the ownership date set.",
      risks: "Friday close.",
      sources: { comments: 12, work_notes: 4, events: 21 },
    },
    confidence: null,
    ...overrides,
  });
}

export function aDraft(overrides: Partial<SuggestionView> = {}): SuggestionView {
  return aSuggestion({
    id: "sg-5",
    capability: "draft_reply",
    payload: {
      text: "Hello Helena, the rerun is in progress.",
      citations: [{ article_version_id: "v-1" }],
      tone: "plain",
    },
    confidence: null,
    ...overrides,
  });
}

export function aCapability(overrides: Partial<CapabilitySetting> = {}): CapabilitySetting {
  return { enabled: true, threshold: 0.7, auto_apply: false, auto_min: 0.9, expires_minutes: 240, ...overrides };
}

export function anAiSettings(overrides: Partial<AiSettingsView> = {}): AiSettingsView {
  return {
    account_id: "acct-1",
    enabled: true,
    dpa_reference: "DPA-2026-07",
    residency_region: "us",
    redaction_profile: "standard",
    draft_tone: "plain",
    capabilities: {
      classify: aCapability(),
      prioritise: aCapability({ threshold: 0.75 }),
      duplicate: aCapability({ threshold: 0.8 }),
      summarise: aCapability({ threshold: 0 }),
      draft_reply: aCapability({ threshold: 0 }),
      wsr_narrative: aCapability({ enabled: false }),
      time_entry: aCapability({ enabled: false }),
      burn_anomaly: aCapability({ enabled: false }),
    },
    auto_apply_approval_ref: null,
    version: 3,
    effective: { on: true },
    ...overrides,
  };
}

export function anAccuracyReport(overrides: Partial<AccuracyReport> = {}): AccuracyReport {
  return {
    from: "2026-08-08T00:00:00.000Z",
    to: "2026-09-07T00:00:00.000Z",
    threshold: null,
    capabilities: [
      {
        capability: "classify",
        offered: 40,
        withheld: 10,
        accepted: 28,
        edited_accepted: 4,
        rejected: 4,
        auto_applied: 0,
        expired: 2,
        open: 2,
        withheld_reasons: { below_threshold: 8, switch_off: 2 },
        acceptance_rate: 0.889,
        what_if: null,
      },
    ],
    ...overrides,
  };
}

export function anAiDefaults(overrides: Partial<AiDefaultsBody> = {}): AiDefaultsBody {
  return {
    kill_switch: false,
    harness_regions: ["us", "eu"],
    agents: {
      classify: "xms-classifier",
      prioritise: "xms-prioritiser",
      duplicate: "xms-duplicates",
      summarise: "xms-summariser",
      draft_reply: "xms-drafter",
      wsr_narrative: "xms-narrator",
      time_entry: "xms-time",
      burn_anomaly: "xms-burn",
    },
    capabilities: anAiSettings().capabilities,
    ...overrides,
  };
}
