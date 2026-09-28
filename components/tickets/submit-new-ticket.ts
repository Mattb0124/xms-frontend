import type { NewTicketDraft } from "@/components/tickets/new-ticket-fields";
import { apiError, describeError } from "@/lib/admin/api-error";
import { uploadAttachment } from "@/lib/attachments/upload";
import type { CreateTicketBody } from "@/redux/ticketsApi";

interface CreatedTicket {
  key: string;
  type: string;
  priority: string;
}

interface ContractChoice {
  id: string;
  key: string;
  name: string;
}

export interface SubmitNewTicketInput {
  accountId: string;
  contractId: string;
  draft: NewTicketDraft;
  files: File[];
  create: (body: CreateTicketBody) => Promise<CreatedTicket>;
  track: (facts: { type: string; priority: string }) => void;
  push: (toast: { title: string; detail?: string; tone: "success" | "error" }) => void;
  goTo: (href: string) => void;
  setUploading: (value: boolean) => void;
  setError: (value: string | null) => void;
  setDetails: (value: string[]) => void;
  setContractChoices: (value: ContractChoice[] | null) => void;
}

function choicesOf(caught: unknown): ContractChoice[] | undefined {
  if (typeof caught !== "object" || caught === null || !("data" in caught)) return undefined;
  const data = caught.data;
  if (typeof data !== "object" || data === null || !("choices" in data)) return undefined;
  if (!Array.isArray(data.choices)) return undefined;
  const choices = data.choices.filter(
    (choice): choice is ContractChoice =>
      typeof choice === "object" &&
      choice !== null &&
      "id" in choice &&
      "key" in choice &&
      "name" in choice &&
      typeof choice.id === "string" &&
      typeof choice.key === "string" &&
      typeof choice.name === "string",
  );
  return choices.length > 0 ? choices : undefined;
}

/**
 * Creates the case, then uploads any queued files. A file the scan or the
 * API refuses is reported and does not undo the case.
 */
export async function submitNewTicket(input: SubmitNewTicketInput): Promise<void> {
  const { draft } = input;
  input.setError(null);
  input.setDetails([]);
  const body: CreateTicketBody = {
    account_id: input.accountId,
    type: draft.type,
    short_description: draft.short_description.trim(),
    description: draft.description.trim() || undefined,
    category: draft.category.trim() || undefined,
    impact: draft.impact || undefined,
    urgency: draft.urgency || undefined,
    group_id: draft.group_id || undefined,
    assignee_id: draft.assignee_id || undefined,
    contract_id: input.contractId || undefined,
    requester_email: draft.requester_email.trim() || undefined,
    requester_name: draft.requester_name.trim() || undefined,
  };
  try {
    const ticket = await input.create(body);
    input.track({ type: ticket.type, priority: ticket.priority });
    if (input.files.length > 0) {
      input.setUploading(true);
      let failed = 0;
      for (const file of input.files) {
        try {
          await uploadAttachment(ticket.key, file, { visibility: "public" });
        } catch {
          failed += 1;
        }
      }
      input.setUploading(false);
      input.push({
        title: `${ticket.key} created`,
        detail:
          failed > 0
            ? `${failed} file${failed === 1 ? "" : "s"} could not be attached.`
            : `${input.files.length} file${input.files.length === 1 ? "" : "s"} attached.`,
        tone: failed > 0 ? "error" : "success",
      });
    } else {
      input.push({ title: `${ticket.key} created`, tone: "success" });
    }
    input.goTo(`/cases/${ticket.key}`);
  } catch (caught) {
    const parsed = apiError(caught);
    const choices = choicesOf(caught);
    if (parsed.code === "contract_required" && choices) {
      input.setContractChoices(choices);
      input.setError("This account has more than one active contract; choose one.");
    } else if (parsed.code === "no_active_contract") {
      input.setError("Set up a contract on this account to start taking tickets.");
    } else {
      input.setError(describeError(parsed));
      input.setDetails(parsed.details ?? []);
    }
  }
}
