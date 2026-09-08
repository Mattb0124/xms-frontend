import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReportPackView } from "@/components/reporting/report-pack";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";
import { aHeldPack, HELD_PACK_ID } from "@/test-kit/reporting";

vi.mock("next/navigation", () => ({ usePathname: () => `/reports/packs/${HELD_PACK_ID}` }));

const PACK = `GET /v1/reports/packs/${HELD_PACK_ID}`;
const PPTX = "https://files.example.test/packs/held.pptx?signature=constructed";
const PDF = "https://files.example.test/packs/held.pdf?signature=constructed";

/** The pack as the API answers it: the frozen record plus the one rendition asked for. */
function packResponse(format: "pptx" | "pdf", download: string | null) {
  const pack = aHeldPack();
  return json({
    id: pack.id,
    period_start: pack.period_start,
    period_end: pack.period_end,
    measures: pack.measures,
    notable: pack.notable,
    narrative_versions: pack.narrative_versions,
    format,
    download,
  });
}

describe("ReportPackView", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("opens on the deck and mints the PDF only when it is asked for", async () => {
    const opened: string[] = [];
    vi.stubGlobal("open", (url: string) => {
      opened.push(url);
      return null;
    });
    let rendition: "pptx" | "pdf" = "pptx";
    const calls = stubFetch({
      [PACK]: () => packResponse(rendition, rendition === "pdf" ? PDF : PPTX),
    });
    renderDesk(<ReportPackView packId={HELD_PACK_ID} />);

    // The deck link is the presigned URL, opened with no opener and no referrer.
    const deck = await screen.findByRole("link", { name: "Download PPTX" });
    expect(deck.getAttribute("href")).toBe(PPTX);
    expect(deck.getAttribute("rel")).toBe("noopener noreferrer");
    // The first read carries no format: each PDF link costs a security event
    // on the API, so it is not minted for every view of the screen.
    expect(calls.filter((call) => call.key === PACK).map((call) => call.search)).toEqual([""]);

    rendition = "pdf";
    fireEvent.click(screen.getByRole("button", { name: "Download PDF" }));
    await waitFor(() => expect(opened).toEqual([PDF]));
    expect(calls.filter((call) => call.key === PACK).map((call) => call.search)).toEqual(["", "?format=pdf"]);
  });

  it("says so when the pack never stored a PDF, and opens nothing", async () => {
    const opened: string[] = [];
    vi.stubGlobal("open", (url: string) => {
      opened.push(url);
      return null;
    });
    stubFetch({ [PACK]: () => packResponse("pdf", null) });
    renderDesk(<ReportPackView packId={HELD_PACK_ID} />);
    await screen.findByTestId("report-pack");
    fireEvent.click(screen.getByRole("button", { name: "Download PDF" }));

    await screen.findByText("No PDF for this pack");
    expect(opened).toEqual([]);
    // Nothing left to try, so the control stops offering the file.
    await waitFor(() =>
      expect((screen.getByRole("button", { name: "Download PDF" }) as HTMLButtonElement).disabled).toBe(true),
    );
  });
});
