import { describe, expect, it } from "vitest";
import {
  alertsLabel,
  describeEngagementError,
  draftFromEngagement,
  emptyEngagementDraft,
  engagementBody,
  engagementError,
  engagementName,
  expiringEngagements,
  noticeDeadline,
  noticeLabel,
  NOTICE_NEEDS_RENEWAL,
  ownerLabel,
  patchEngagementBody,
  renewalChipLabel,
  renewalChipTitle,
  renewalChipTone,
  renewalLabel,
  validateEngagement,
} from "@/lib/contracts/engagements";
import { anEngagement, anExpiringEngagement, OWNER_USER_ID } from "@/test-kit/tickets";

describe("the engagement words", () => {
  it("words the renewal date, the notice period and its deadline", () => {
    expect(renewalLabel("2027-03-31")).toBe("2027-03-31");
    expect(renewalLabel(null)).toBe("No renewal date");
    expect(noticeLabel(null)).toBe("No notice period");
    expect(noticeLabel(1)).toBe("1 day of notice");
    expect(noticeLabel(30)).toBe("30 days of notice");
    expect(noticeDeadline(anEngagement())).toBe("2027-03-01");
    expect(noticeDeadline(anEngagement({ notice_period_days: null }))).toBeNull();
    expect(noticeDeadline(anEngagement({ renewal_date: null, notice_period_days: null }))).toBeNull();
  });

  it("words the alert ledger, with 0 read as the notice period", () => {
    expect(alertsLabel([])).toBe("None sent");
    expect(alertsLabel([90])).toBe("90 days");
    expect(alertsLabel([60, 90])).toBe("90 days and 60 days");
    expect(alertsLabel([0, 30, 60, 90])).toBe("90 days, 60 days, 30 days and the notice period");
  });

  it("names the owner and the engagement, falling back to the short id", () => {
    const names = { [OWNER_USER_ID]: "Ada Ellis" };
    expect(ownerLabel(OWNER_USER_ID, names)).toBe("Ada Ellis");
    expect(ownerLabel(OWNER_USER_ID, {})).toBe(OWNER_USER_ID.slice(0, 8));
    expect(ownerLabel(null, names)).toBe("No owner");
    const engagements = [anEngagement()];
    expect(engagementName(anEngagement().id, engagements)).toBe("Managed services 2026");
    expect(engagementName(null, engagements)).toBe("Not filed");
    expect(engagementName("e9e9e9e9-e9e9-4e9e-8e9e-e9e9e9e9e9e9", engagements)).toBe("e9e9e9e9");
  });
});

describe("the renewal chip", () => {
  it("announces only what the server marked expiring", () => {
    expect(expiringEngagements(undefined)).toEqual([]);
    expect(expiringEngagements([anEngagement(), anEngagement({ status: "ended" })])).toEqual([]);
    expect(expiringEngagements([anEngagement(), anExpiringEngagement()]).map((row) => row.name)).toEqual([
      "Hosting renewal",
    ]);
  });

  it("counts the days down from the server's date", () => {
    const engagement = anExpiringEngagement();
    expect(renewalChipLabel(engagement, "2026-09-08")).toBe("Hosting renewal renews in 23 days");
    expect(renewalChipLabel(engagement, "2026-09-30")).toBe("Hosting renewal renews tomorrow");
    expect(renewalChipLabel(engagement, "2026-10-01")).toBe("Hosting renewal renews today");
    expect(renewalChipLabel(engagement, "2026-10-02")).toBe("Hosting renewal renewed on 2026-10-01");
    expect(renewalChipLabel(anExpiringEngagement({ renewal_date: null }), "2026-09-08")).toBe(
      "Hosting renewal renews on a date not yet set",
    );
  });

  it("turns red once the notice period has been entered, and says why", () => {
    const engagement = anExpiringEngagement();
    // 30 days of notice on a 2026-10-01 renewal: decide by 2026-09-01.
    expect(renewalChipTone(engagement, "2026-08-31")).toBe("needs-input");
    expect(renewalChipTone(engagement, "2026-09-01")).toBe("overdue");
    expect(renewalChipTone(engagement, "2026-09-20")).toBe("overdue");
    expect(renewalChipTone(anExpiringEngagement({ notice_period_days: null }), "2026-09-20")).toBe("needs-input");
    expect(renewalChipTitle(engagement)).toBe("Renewal date 2026-10-01; 30 days of notice, so decide by 2026-09-01");
    expect(renewalChipTitle(anExpiringEngagement({ notice_period_days: null }))).toBe("Renewal date 2026-10-01");
  });
});

describe("the engagement form", () => {
  it("reads a record into a draft and refuses what the API would refuse", () => {
    expect(draftFromEngagement(anEngagement())).toEqual({
      name: "Managed services 2026",
      ownerUserId: OWNER_USER_ID,
      renewalDate: "2027-03-31",
      noticePeriodDays: "30",
      status: "active",
    });
    expect(
      draftFromEngagement(anEngagement({ owner_user_id: null, renewal_date: null, notice_period_days: null })),
    ).toEqual({
      name: "Managed services 2026",
      ownerUserId: "",
      renewalDate: "",
      noticePeriodDays: "",
      status: "active",
    });

    const draft = draftFromEngagement(anEngagement());
    expect(validateEngagement(draft)).toBeNull();
    expect(validateEngagement(emptyEngagementDraft)).toBe("Give the engagement a name.");
    expect(validateEngagement({ ...draft, name: "x".repeat(161) })).toBe("The name is at most 160 characters.");
    expect(validateEngagement({ ...draft, renewalDate: "31-03-2027" })).toBe("The renewal date is a calendar date.");
    expect(validateEngagement({ ...draft, noticePeriodDays: "thirty" })).toBe(
      "The notice period is a whole number of days.",
    );
    expect(validateEngagement({ ...draft, noticePeriodDays: "400" })).toBe("The notice period is at most 365 days.");
    // The server's renewal_date_required, refused before it is asked.
    expect(validateEngagement({ ...draft, renewalDate: "", noticePeriodDays: "30" })).toBe(NOTICE_NEEDS_RENEWAL);
    expect(validateEngagement({ ...draft, renewalDate: "", noticePeriodDays: "" })).toBeNull();
  });

  it("sends null for what was left empty, never an empty string", () => {
    expect(engagementBody(draftFromEngagement(anEngagement()))).toEqual({
      name: "Managed services 2026",
      owner_user_id: OWNER_USER_ID,
      renewal_date: "2027-03-31",
      notice_period_days: 30,
    });
    expect(engagementBody({ ...emptyEngagementDraft, name: "  Renewal 2027  " })).toEqual({
      name: "Renewal 2027",
      owner_user_id: null,
      renewal_date: null,
      notice_period_days: null,
    });
  });

  it("sends the status only when a person changed it by hand", () => {
    const engagement = anExpiringEngagement();
    const draft = draftFromEngagement(engagement);
    // Untouched: the server's own rule decides the status from the new date.
    expect(patchEngagementBody(engagement, { ...draft, renewalDate: "2027-01-01" })).toEqual({
      version: 4,
      name: "Hosting renewal",
      owner_user_id: OWNER_USER_ID,
      renewal_date: "2027-01-01",
      notice_period_days: 30,
    });
    expect(patchEngagementBody(engagement, { ...draft, status: "ended" })).toMatchObject({
      version: 4,
      status: "ended",
    });
  });
});

describe("the engagement refusals", () => {
  it("words each code the API answers with", () => {
    const refusal = (status: number, code: string) =>
      describeEngagementError(engagementError({ status, data: { code } }));
    expect(refusal(400, "renewal_date_required")).toBe(NOTICE_NEEDS_RENEWAL);
    expect(refusal(409, "stale_version")).toBe("Someone else changed this engagement. It has been reloaded.");
    expect(refusal(404, "not_found")).toBe("This engagement is not on this account any more.");
    expect(refusal(403, "forbidden")).toBe("You need the contracts:manage permission.");
    expect(refusal(500, "server_error")).toBe("The request failed (server_error).");
  });
});
