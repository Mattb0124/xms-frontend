"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PortalUploadControl, usePortalUploads } from "@/components/portal/attachments";
import { PortalCard } from "@/components/portal/primitives";
import { RequestForm } from "@/components/portal/request-form";
import { useToast } from "@/components/xms/toast";
import { apiError, describeError } from "@/lib/admin/api-error";
import { useTrack } from "@/lib/telemetry/provider";
import { useCreatePortalTicketMutation } from "@/redux/portalApi";

/** New request (User Experience 4.3 step 2): the default form for the chosen type. */
export default function PortalNewRequestPage() {
  const router = useRouter();
  const [create, state] = useCreatePortalTicketMutation();
  const { push } = useToast();
  const track = useTrack("portal.request.submit");
  const [serverError, setServerError] = useState<string | undefined>();
  const [files, setFiles] = useState<File[]>([]);
  const uploads = usePortalUploads(undefined);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xms-ink text-[22px] font-semibold">New request</h1>
      <PortalCard>
        <RequestForm
          submitting={state.isLoading}
          serverError={serverError}
          onSubmit={async (body) => {
            setServerError(undefined);
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
              setServerError(describeError(apiError(error)));
            }
          }}
        />
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
