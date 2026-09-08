"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PortalUploadControl, usePortalUploads } from "@/components/portal/attachments";
import { DynamicRequestForm } from "@/components/portal/dynamic-request-form";
import { PortalCard } from "@/components/portal/primitives";
import { RequestForm } from "@/components/portal/request-form";
import { useToast } from "@/components/xms/toast";
import { apiError, describeError } from "@/lib/admin/api-error";
import { submissionError, type PortalFormView, type SubmissionError } from "@/lib/portal/forms";
import { useTrack } from "@/lib/telemetry/provider";
import { cn } from "@/lib/utils";
import { useCreatePortalTicketMutation, usePortalFormQuery, usePortalFormsQuery } from "@/redux/portalApi";
import type { CreatePortalTicketBody } from "@/redux/portalApi";

/**
 * New request (User Experience 4.3 step 2). Where the account has published a
 * form for a request type (CP-03), that form is what the client fills in: the
 * fields, their order and their conditions are the server's, and the answers
 * post as `{ type, answers }`. Where it has published none, the fixed default
 * form stays exactly as it was, which is also what happens while the forms
 * route is not deployed.
 */
export default function PortalNewRequestPage() {
  const router = useRouter();
  const forms = usePortalFormsQuery();
  const [create, state] = useCreatePortalTicketMutation();
  const { push } = useToast();
  const track = useTrack("portal.request.submit");
  const [serverError, setServerError] = useState<string | undefined>();
  const [refusal, setRefusal] = useState<SubmissionError | undefined>();
  const [type, setType] = useState<string>("");
  const [files, setFiles] = useState<File[]>([]);
  const uploads = usePortalUploads(undefined);

  const items = forms.data?.items ?? [];
  const anyPublished = items.some((item) => item.source === "published");
  // The chosen type is read again through its own route, so the definition
  // being filled in is the one the server serves for it right now.
  const chosen = usePortalFormQuery(type, { skip: !type || !anyPublished });

  const send = async (body: CreatePortalTicketBody, onRefusal: (error: unknown) => void) => {
    setServerError(undefined);
    setRefusal(undefined);
    try {
      const created = await create(body).unwrap();
      track({ request: created.key, type: body.type });
      if (files.length > 0) await uploads.add(files, created.key);
      push({
        title: `${created.key} created`,
        detail: "You will get an email with every reply.",
        tone: "success",
      });
      router.push(`/portal/requests/${created.key}`);
    } catch (error) {
      onRefusal(error);
    }
  };

  const fixedForm = (chosenType?: "incident" | "service_request") => (
    <RequestForm
      type={chosenType}
      submitting={state.isLoading}
      serverError={serverError}
      onSubmit={(body) => void send(body, (error) => setServerError(describeError(apiError(error))))}
    />
  );

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xms-ink text-[22px] font-semibold">New request</h1>
      <PortalCard>
        {anyPublished ? (
          <div className="flex flex-col gap-5">
            <RequestTypeChoice items={items} value={type} onChange={setType} />
            {chosen.data ? (
              chosen.data.source === "published" ? (
                <DynamicRequestForm
                  key={chosen.data.form_version_id ?? chosen.data.ticket_type}
                  view={chosen.data}
                  submitting={state.isLoading}
                  error={refusal}
                  onSubmit={(body) => void send(body, (error) => setRefusal(submissionError(error)))}
                />
              ) : (
                fixedForm(chosen.data.ticket_type as "incident" | "service_request")
              )
            ) : null}
          </div>
        ) : (
          fixedForm()
        )}
        <div className="border-xms-line border-t pt-4">
          <p className="text-xms-ink mb-2 text-[14px] font-medium">Files</p>
          <PortalUploadControl
            onFiles={(list) => setFiles((current) => [...current, ...Array.from(list)])}
            items={
              uploads.items.length > 0
                ? uploads.items
                : files.map((file, index) => ({
                    id: `q${index}`,
                    name: file.name,
                    size: file.size,
                    stage: "presigning" as const,
                  }))
            }
            disabled={state.isLoading}
          />
          {files.length > 0 && uploads.items.length === 0 ? (
            <p className="text-xms-label text-[13px]">Files are checked and added once the request is created.</p>
          ) : null}
        </div>
      </PortalCard>
    </div>
  );
}

/** The request types this account offers, named by the API rather than here. */
function RequestTypeChoice({
  items,
  value,
  onChange,
}: {
  items: PortalFormView[];
  value: string;
  onChange: (type: string) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-xms-ink mb-1 text-[14px] font-medium">What kind of request is this?</legend>
      {items.map((item) => (
        <label
          key={item.ticket_type}
          className={cn(
            "border-xms-line has-[:checked]:border-xms-accent has-[:checked]:bg-xms-tint",
            "flex cursor-pointer items-start gap-3 rounded-[6px] border p-3",
          )}
        >
          <input
            type="radio"
            name="type"
            value={item.ticket_type}
            checked={value === item.ticket_type}
            onChange={() => onChange(item.ticket_type)}
            className="mt-1"
          />
          <span>
            <span className="text-xms-ink block text-[14px] font-medium">{item.name}</span>
            <span className="text-xms-label block text-[13px]">{item.description}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
