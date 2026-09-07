"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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
              push({ title: `${created.key} created`, detail: "You will get an email with every reply.", tone: "success" });
              router.push(`/portal/requests/${created.key}`);
            } catch (error) {
              setServerError(describeError(apiError(error)));
            }
          }}
        />
      </PortalCard>
    </div>
  );
}
