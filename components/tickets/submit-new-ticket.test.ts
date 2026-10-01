import { describe, expect, it, vi } from "vitest";
import { EMPTY_TICKET_DRAFT } from "@/components/tickets/new-ticket-fields";
import { submitNewTicket } from "@/components/tickets/submit-new-ticket";

describe("submitNewTicket", () => {
  it("sends the configuration item chosen on the create form", async () => {
    const create = vi.fn().mockResolvedValue({ key: "CS1000200", type: "incident", priority: "p3" });
    await submitNewTicket({
      accountId: "account-1",
      contractId: "contract-1",
      draft: {
        ...EMPTY_TICKET_DRAFT,
        short_description: "The close will not run",
        configuration_item_id: "ci-1",
      },
      files: [],
      create,
      track: vi.fn(),
      push: vi.fn(),
      goTo: vi.fn(),
      setUploading: vi.fn(),
      setError: vi.fn(),
      setDetails: vi.fn(),
      setContractChoices: vi.fn(),
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        account_id: "account-1",
        configuration_item_id: "ci-1",
        short_description: "The close will not run",
      }),
    );
  });
});
